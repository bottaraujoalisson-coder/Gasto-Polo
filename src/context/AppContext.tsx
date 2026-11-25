import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import {
  AcaoAuditoria,
  AlertaDesperdicio,
  Auditoria,
  Campanha,
  Categoria,
  Fornecedor,
  ItemCatalogo,
  Lancamento,
  Orcamento,
  PerfilUsuario,
  PlanoAcao,
  Polo,
  Rede,
  RedeConfig,
  StatusLancamento,
  UsuarioRede,
} from '../types';
import {
  CATEGORIAS_PADRAO,
  DEFAULT_REDE_CONFIG,
  detectWasteAlerts,
  determineInitialStatus,
} from '../utils/financeRules';
import { buildDemoDataset } from '../utils/demoData';

const LOCAL_STORAGE_KEY = 'gastopolo_workspace_v1';

interface LocalWorkspaceState {
  rede: Rede | null;
  usuarios: UsuarioRede[];
  polos: Polo[];
  categorias: Categoria[];
  fornecedores: Fornecedor[];
  itens: ItemCatalogo[];
  lancamentos: Lancamento[];
  orcamentos: Orcamento[];
  campanhas: Campanha[];
  planosAcao: PlanoAcao[];
  auditoria: Auditoria[];
}

interface AppContextValue {
  // Auth & Tenant State
  firebaseUser: User | null;
  authLoading: boolean;
  dataLoading: boolean;
  isLocalWorkspace: boolean;
  rede: Rede | null;
  currentUserProfile: UsuarioRede | null;
  activePersonaId: string | null;
  setActivePersonaId: (uid: string | null) => void;

  // Global Filters
  selectedMonth: string; // YYYY-MM
  setSelectedMonth: (mes: string) => void;
  selectedPoloId: string | 'ALL';
  setSelectedPoloId: (poloId: string | 'ALL') => void;
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Collections (Filtered by RBAC polo isolation!)
  usuarios: UsuarioRede[];
  allPolos: Polo[];
  visiblePolos: Polo[];
  categorias: Categoria[];
  fornecedores: Fornecedor[];
  itens: ItemCatalogo[];
  lancamentos: Lancamento[];
  orcamentos: Orcamento[];
  campanhas: Campanha[];
  planosAcao: PlanoAcao[];
  auditoria: Auditoria[];
  alertas: AlertaDesperdicio[];

  // Permissions helpers
  canManageNetwork: boolean; // Admin
  canApproveLaunches: boolean; // Admin or Gestor
  canCreateLaunches: boolean; // Admin, Gestor, Operador
  canEditLaunch: (l: Lancamento) => boolean;
  hasDemoData: boolean;

  // Auth Actions
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (nome: string, email: string, pass: string) => Promise<void>;
  enterInteractiveWorkspace: (withDemoData?: boolean) => Promise<void>;
  logout: () => Promise<void>;

  // Onboarding & Demo Data Actions
  completeOnboarding: (params: {
    nomeRede: string;
    rotuloTamanho: string;
    limiteAprovacao: number;
    primeiroPolo: { nome: string; cidade: string; indicadorTamanho: number };
    convidados: Array<{ nome: string; email: string; perfil: PerfilUsuario }>;
    carregarDemo: boolean;
  }) => Promise<void>;
  loadDemoData: () => Promise<void>;
  removeDemoData: () => Promise<void>;

  // CRUD Mutations (with automatic audit trail)
  updateRedeSettings: (nome: string, config: RedeConfig) => Promise<void>;
  savePolo: (polo: Omit<Polo, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>, id?: string) => Promise<void>;
  saveUsuario: (
    usuario: Omit<UsuarioRede, 'id' | 'uid' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => Promise<void>;
  saveCategoria: (
    cat: Omit<Categoria, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => Promise<void>;
  saveFornecedor: (
    forn: Omit<Fornecedor, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => Promise<void>;
  saveItemCatalogo: (
    item: Omit<ItemCatalogo, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => Promise<void>;
  saveLancamento: (
    payload: Omit<
      Lancamento,
      'id' | 'redeId' | 'competencia' | 'status' | 'criadoPor' | 'criadoEm' | 'atualizadoEm' | 'excluido'
    >,
    existingId?: string
  ) => Promise<Lancamento>;
  duplicateLancamento: (lancamento: Lancamento) => Promise<Lancamento>;
  updateLancamentoStatus: (lancamentoId: string, novoStatus: StatusLancamento, motivo?: string) => Promise<void>;
  softDeleteLancamento: (lancamentoId: string) => Promise<void>;
  saveOrcamentoTeto: (mes: string, poloId: string, categoriaId: string, teto: number) => Promise<void>;
  copyPreviousMonthOrcamentos: (targetMes: string, sourceMes: string) => Promise<number>;
  saveCampanha: (
    camp: Omit<Campanha, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => Promise<void>;
  savePlanoAcao: (
    plano: Omit<PlanoAcao, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

function getDefaultCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [isLocalWorkspace, setIsLocalWorkspace] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return true;
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return Boolean(saved);
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('gastopolo_theme') === 'dark';
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(getDefaultCurrentMonth);
  const [selectedPoloId, setSelectedPoloId] = useState<string | 'ALL'>('ALL');
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);

  // Domain states
  const [rede, setRede] = useState<Rede | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioRede[]>([]);
  const [polos, setPolos] = useState<Polo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [planosAcao, setPlanosAcao] = useState<PlanoAcao[]>([]);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);

  // Apply Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('gastopolo_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('gastopolo_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  // Sync LocalWorkspace state to localStorage when in local workspace mode
  const persistLocalState = (next: LocalWorkspaceState) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  };

  // Initialize Local Workspace or ?autostart=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw) as LocalWorkspaceState;
        if (parsed.rede) {
          setRede(parsed.rede);
          setUsuarios(parsed.usuarios || []);
          setPolos(parsed.polos || []);
          setCategorias(parsed.categorias || []);
          setFornecedores(parsed.fornecedores || []);
          setItens(parsed.itens || []);
          setLancamentos(parsed.lancamentos || []);
          setOrcamentos(parsed.orcamentos || []);
          setCampanhas(parsed.campanhas || []);
          setPlanosAcao(parsed.planosAcao || []);
          setAuditoria(parsed.auditoria || []);
        }
      } catch (e) {
        console.error('Failed to parse saved workspace:', e);
      }
    } else if (params.get('autostart') === '1') {
      // Automatically seed full demo workspace for instant evaluation
      const now = new Date().toISOString();
      const redeId = 'rede-educar-brasil';
      const adminUid = 'admin-demo-uid';
      const baseMonth = getDefaultCurrentMonth();
      const demo = buildDemoDataset(redeId, adminUid, baseMonth, []);
      const initialRede: Rede = {
        id: redeId,
        nome: 'Rede Educar Brasil (Multi-Polos)',
        criadoPor: adminUid,
        criadoEm: now,
        atualizadoEm: now,
        config: DEFAULT_REDE_CONFIG,
      };
      const adminUser: UsuarioRede = {
        id: adminUid,
        uid: adminUid,
        redeId,
        nome: 'Alisson Araujo (Admin da Rede)',
        email: 'admin@gastopolo.com.br',
        perfil: 'admin',
        poloIds: demo.polos.map((p) => p.id),
        ativo: true,
        criadoEm: now,
        atualizadoEm: now,
      };
      const allUsers = [adminUser, ...demo.usuariosExtras];
      setRede(initialRede);
      setUsuarios(allUsers);
      setPolos(demo.polos);
      setCategorias(demo.categorias);
      setFornecedores(demo.fornecedores);
      setItens(demo.itens);
      setLancamentos(demo.lancamentos);
      setOrcamentos(demo.orcamentos);
      setCampanhas(demo.campanhas);
      setPlanosAcao(demo.planosAcao);
      setAuditoria(demo.auditoria);
      persistLocalState({
        rede: initialRede,
        usuarios: allUsers,
        polos: demo.polos,
        categorias: demo.categorias,
        fornecedores: demo.fornecedores,
        itens: demo.itens,
        lancamentos: demo.lancamentos,
        orcamentos: demo.orcamentos,
        campanhas: demo.campanhas,
        planosAcao: demo.planosAcao,
        auditoria: demo.auditoria,
      });
    }
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setAuthLoading(false);
        return;
      }

      setIsLocalWorkspace(false);
      setDataLoading(true);
      try {
        const userRedeDocRef = doc(db, 'userRedes', user.uid);
        const userRedeSnap = await getDoc(userRedeDocRef);
        if (userRedeSnap.exists()) {
          const { redeId } = userRedeSnap.data() as { redeId: string };
          const redeSnap = await getDoc(doc(db, 'redes', redeId));
          if (redeSnap.exists()) {
            setRede({ id: redeSnap.id, ...(redeSnap.data() as Omit<Rede, 'id'>) });
          }
        }
      } catch (err) {
        console.warn('Initial tenant lookup:', err);
      } finally {
        setDataLoading(false);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore subcollections when authenticated with Firebase & Rede exists
  useEffect(() => {
    if (isLocalWorkspace || !firebaseUser || !rede?.id) return;
    const redeId = rede.id;

    const unsubs: Array<() => void> = [];

    // Rede doc listener
    unsubs.push(
      onSnapshot(
        doc(db, 'redes', redeId),
        (snap) => {
          if (snap.exists()) {
            setRede({ id: snap.id, ...(snap.data() as Omit<Rede, 'id'>) });
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `redes/${redeId}`)
      )
    );

    const subcollections: Array<{
      name: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setter: React.Dispatch<React.SetStateAction<any[]>>;
    }> = [
      { name: 'usuarios', setter: setUsuarios },
      { name: 'polos', setter: setPolos },
      { name: 'categorias', setter: setCategorias },
      { name: 'fornecedores', setter: setFornecedores },
      { name: 'itens', setter: setItens },
      { name: 'lancamentos', setter: setLancamentos },
      { name: 'orcamentos', setter: setOrcamentos },
      { name: 'campanhas', setter: setCampanhas },
      { name: 'planosAcao', setter: setPlanosAcao },
      { name: 'auditoria', setter: setAuditoria },
    ];

    for (const sub of subcollections) {
      const q = query(collection(db, 'redes', redeId, sub.name), where('redeId', '==', redeId));
      unsubs.push(
        onSnapshot(
          q,
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            sub.setter(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `redes/${redeId}/${sub.name}`)
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isLocalWorkspace, firebaseUser, rede?.id]);

  // Resolve current active user profile (supports RBAC persona switching for testing isolation!)
  const currentUserProfile = useMemo<UsuarioRede | null>(() => {
    if (usuarios.length === 0) return null;
    if (activePersonaId) {
      const persona = usuarios.find((u) => u.id === activePersonaId || u.uid === activePersonaId);
      if (persona) return persona;
    }
    if (firebaseUser) {
      const byUid = usuarios.find((u) => u.uid === firebaseUser.uid);
      if (byUid) return byUid;
    }
    return usuarios[0];
  }, [usuarios, activePersonaId, firebaseUser]);

  // Enforce RBAC polo isolation
  const visiblePolos = useMemo<Polo[]>(() => {
    if (!currentUserProfile || !currentUserProfile.ativo) return [];
    if (currentUserProfile.perfil === 'admin') return polos;
    return polos.filter((p) => currentUserProfile.poloIds.includes(p.id));
  }, [polos, currentUserProfile]);

  const allowedPoloIds = useMemo<string[] | undefined>(() => {
    if (!currentUserProfile) return [];
    if (currentUserProfile.perfil === 'admin') return undefined; // All polos
    return currentUserProfile.poloIds;
  }, [currentUserProfile]);

  // Reset selectedPoloId if user switched to a persona that doesn't have access to current selectedPoloId
  useEffect(() => {
    if (!currentUserProfile) return;
    if (
      currentUserProfile.perfil !== 'admin' &&
      selectedPoloId !== 'ALL' &&
      !currentUserProfile.poloIds.includes(selectedPoloId)
    ) {
      setSelectedPoloId(currentUserProfile.poloIds[0] || 'ALL');
    }
  }, [currentUserProfile, selectedPoloId]);

  const filteredLancamentos = useMemo<Lancamento[]>(() => {
    if (!currentUserProfile || !currentUserProfile.ativo) return [];
    if (currentUserProfile.perfil === 'admin') return lancamentos;
    const allowed = new Set(currentUserProfile.poloIds);
    return lancamentos.filter((l) => {
      if (allowed.has(l.poloId)) return true;
      if (l.rateio?.ativo && l.rateio.partes?.some((pt) => allowed.has(pt.poloId))) return true;
      return false;
    });
  }, [lancamentos, currentUserProfile]);

  const filteredOrcamentos = useMemo<Orcamento[]>(() => {
    if (!currentUserProfile || !currentUserProfile.ativo) return [];
    if (currentUserProfile.perfil === 'admin') return orcamentos;
    const allowed = new Set(currentUserProfile.poloIds);
    return orcamentos.filter((o) => allowed.has(o.poloId));
  }, [orcamentos, currentUserProfile]);

  const filteredCampanhas = useMemo<Campanha[]>(() => {
    if (!currentUserProfile || !currentUserProfile.ativo) return [];
    if (currentUserProfile.perfil === 'admin') return campanhas;
    const allowed = new Set(currentUserProfile.poloIds);
    return campanhas.filter((c) => c.poloId === 'ALL' || allowed.has(c.poloId));
  }, [campanhas, currentUserProfile]);

  const filteredPlanosAcao = useMemo<PlanoAcao[]>(() => {
    if (!currentUserProfile || !currentUserProfile.ativo) return [];
    if (currentUserProfile.perfil === 'admin') return planosAcao;
    const allowed = new Set(currentUserProfile.poloIds);
    return planosAcao.filter((pa) => allowed.has(pa.poloId));
  }, [planosAcao, currentUserProfile]);

  const alertas = useMemo<AlertaDesperdicio[]>(() => {
    if (!rede || !currentUserProfile?.ativo) return [];
    return detectWasteAlerts({
      mesReferencia: selectedMonth,
      poloIdFilter: selectedPoloId,
      allowedPoloIds,
      polos,
      categorias,
      itens,
      lancamentos: filteredLancamentos,
      orcamentos: filteredOrcamentos,
      campanhas: filteredCampanhas,
      config: rede.config,
    });
  }, [
    rede,
    currentUserProfile,
    selectedMonth,
    selectedPoloId,
    allowedPoloIds,
    polos,
    categorias,
    itens,
    filteredLancamentos,
    filteredOrcamentos,
    filteredCampanhas,
  ]);

  const canManageNetwork = Boolean(
    currentUserProfile?.ativo && currentUserProfile.perfil === 'admin'
  );
  const canApproveLaunches = Boolean(
    currentUserProfile?.ativo &&
      (currentUserProfile.perfil === 'admin' || currentUserProfile.perfil === 'gestor')
  );
  const canCreateLaunches = Boolean(
    currentUserProfile?.ativo &&
      (currentUserProfile.perfil === 'admin' ||
        currentUserProfile.perfil === 'gestor' ||
        currentUserProfile.perfil === 'operador')
  );

  const canEditLaunch = (l: Lancamento): boolean => {
    if (!currentUserProfile?.ativo) return false;
    if (currentUserProfile.perfil === 'admin') return true;
    if (
      currentUserProfile.perfil === 'gestor' &&
      currentUserProfile.poloIds.includes(l.poloId)
    ) {
      return true;
    }
    if (
      currentUserProfile.perfil === 'operador' &&
      currentUserProfile.poloIds.includes(l.poloId) &&
      (l.criadoPor === currentUserProfile.uid || l.criadoPor === currentUserProfile.id) &&
      l.status === 'pendente'
    ) {
      return true;
    }
    return false;
  };

  const hasDemoData = useMemo(() => {
    return (
      polos.some((p) => p.demo) ||
      lancamentos.some((l) => l.demo) ||
      orcamentos.some((o) => o.demo)
    );
  }, [polos, lancamentos, orcamentos]);

  // Audit helper
  const recordAudit = async (params: {
    redeId: string;
    entidade: string;
    entidadeId: string;
    acao: AcaoAuditoria;
    resumo: string;
    antes?: unknown;
    depois?: unknown;
  }) => {
    const uid = currentUserProfile?.uid || firebaseUser?.uid || 'admin-demo-uid';
    const entry: Auditoria = {
      id: generateId('aud'),
      redeId: params.redeId,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      acao: params.acao,
      uid,
      resumo: params.resumo.slice(0, 300),
      antes: params.antes ? JSON.stringify(params.antes).slice(0, 1900) : '',
      depois: params.depois ? JSON.stringify(params.depois).slice(0, 1900) : '',
      em: new Date().toISOString(),
    };

    if (isLocalWorkspace) {
      setAuditoria((prev) => {
        const next = [entry, ...prev];
        return next;
      });
    } else {
      const path = `redes/${params.redeId}/auditoria/${entry.id}`;
      try {
        const { id: _id, ...docData } = entry;
        await setDoc(doc(db, 'redes', params.redeId, 'auditoria', entry.id), docData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
    return entry;
  };

  // Sync localStorage whenever domain states change in localWorkspace
  useEffect(() => {
    if (!isLocalWorkspace || !rede) return;
    persistLocalState({
      rede,
      usuarios,
      polos,
      categorias,
      fornecedores,
      itens,
      lancamentos,
      orcamentos,
      campanhas,
      planosAcao,
      auditoria,
    });
  }, [
    isLocalWorkspace,
    rede,
    usuarios,
    polos,
    categorias,
    fornecedores,
    itens,
    lancamentos,
    orcamentos,
    campanhas,
    planosAcao,
    auditoria,
  ]);

  // Auth handlers
  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (nome: string, email: string, pass: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user && nome) {
      await updateProfile(cred.user, { displayName: nome });
    }
  };

  const enterInteractiveWorkspace = async (withDemoData = true) => {
    const now = new Date().toISOString();
    const redeId = 'rede-educar-brasil';
    const adminUid = 'admin-demo-uid';
    const baseMonth = selectedMonth;

    const initialRede: Rede = {
      id: redeId,
      nome: 'Rede Educar Brasil (Multi-Polos)',
      criadoPor: adminUid,
      criadoEm: now,
      atualizadoEm: now,
      config: DEFAULT_REDE_CONFIG,
    };

    if (withDemoData) {
      const demo = buildDemoDataset(redeId, adminUid, baseMonth, []);
      const adminUser: UsuarioRede = {
        id: adminUid,
        uid: adminUid,
        redeId,
        nome: 'Alisson Araujo (Admin da Rede)',
        email: 'admin@gastopolo.com.br',
        perfil: 'admin',
        poloIds: demo.polos.map((p) => p.id),
        ativo: true,
        criadoEm: now,
        atualizadoEm: now,
      };
      setIsLocalWorkspace(true);
      setRede(initialRede);
      setUsuarios([adminUser, ...demo.usuariosExtras]);
      setPolos(demo.polos);
      setCategorias(demo.categorias);
      setFornecedores(demo.fornecedores);
      setItens(demo.itens);
      setLancamentos(demo.lancamentos);
      setOrcamentos(demo.orcamentos);
      setCampanhas(demo.campanhas);
      setPlanosAcao(demo.planosAcao);
      setAuditoria(demo.auditoria);
      setActivePersonaId(null);
    } else {
      setIsLocalWorkspace(true);
      setRede(null);
      setUsuarios([]);
      setPolos([]);
      setCategorias([]);
      setFornecedores([]);
      setItens([]);
      setLancamentos([]);
      setOrcamentos([]);
      setCampanhas([]);
      setPlanosAcao([]);
      setAuditoria([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  const logout = async () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setIsLocalWorkspace(false);
    setRede(null);
    setUsuarios([]);
    setPolos([]);
    setCategorias([]);
    setFornecedores([]);
    setItens([]);
    setLancamentos([]);
    setOrcamentos([]);
    setCampanhas([]);
    setPlanosAcao([]);
    setAuditoria([]);
    setActivePersonaId(null);
    if (firebaseUser) {
      await signOut(auth);
    }
  };

  // Onboarding
  const completeOnboarding = async (params: {
    nomeRede: string;
    rotuloTamanho: string;
    limiteAprovacao: number;
    primeiroPolo: { nome: string; cidade: string; indicadorTamanho: number };
    convidados: Array<{ nome: string; email: string; perfil: PerfilUsuario }>;
    carregarDemo: boolean;
  }) => {
    const now = new Date().toISOString();
    const redeId = generateId('rede');
    const adminUid = firebaseUser?.uid || 'admin-local-uid';
    const adminEmail = firebaseUser?.email || 'admin@gastopolo.com.br';
    const adminNome = firebaseUser?.displayName || 'Administrador da Rede';

    const newConfig: RedeConfig = {
      ...DEFAULT_REDE_CONFIG,
      rotuloTamanho: params.rotuloTamanho.trim() || 'Alunos ativos',
      limiteAprovacao: params.limiteAprovacao >= 0 ? params.limiteAprovacao : 500,
    };

    const newRede: Rede = {
      id: redeId,
      nome: params.nomeRede.trim(),
      criadoPor: adminUid,
      criadoEm: now,
      atualizadoEm: now,
      config: newConfig,
    };

    const firstPoloId = generateId('polo');
    const firstPolo: Polo = {
      id: firstPoloId,
      redeId,
      nome: params.primeiroPolo.nome.trim(),
      cidade: params.primeiroPolo.cidade.trim(),
      ativo: true,
      indicadorTamanho: params.primeiroPolo.indicadorTamanho,
      criadoEm: now,
      atualizadoEm: now,
    };

    const defaultCategorias: Categoria[] = CATEGORIAS_PADRAO.map((c, idx) => ({
      id: `cat-padrao-${idx + 1}`,
      redeId,
      nome: c.nome,
      tipo: c.tipo,
      ativa: true,
      criadoEm: now,
      atualizadoEm: now,
    }));

    const demoData = params.carregarDemo
      ? buildDemoDataset(redeId, adminUid, selectedMonth, defaultCategorias)
      : null;

    const allPolosList = demoData ? [firstPolo, ...demoData.polos] : [firstPolo];

    const adminUsuario: UsuarioRede = {
      id: adminUid,
      uid: adminUid,
      redeId,
      nome: adminNome,
      email: adminEmail,
      perfil: 'admin',
      poloIds: allPolosList.map((p) => p.id),
      ativo: true,
      criadoEm: now,
      atualizadoEm: now,
    };

    const invitedUsers: UsuarioRede[] = params.convidados
      .filter((c) => c.nome.trim() && c.email.trim())
      .map((c) => {
        const uid = generateId('usr');
        return {
          id: uid,
          uid,
          redeId,
          nome: c.nome.trim(),
          email: c.email.trim(),
          perfil: c.perfil,
          poloIds: [firstPoloId],
          ativo: true,
          criadoEm: now,
          atualizadoEm: now,
        };
      });

    const allUsuarios = [
      adminUsuario,
      ...invitedUsers,
      ...(demoData ? demoData.usuariosExtras : []),
    ];

    if (isLocalWorkspace || !firebaseUser) {
      setIsLocalWorkspace(true);
      setRede(newRede);
      setPolos(allPolosList);
      setCategorias(defaultCategorias);
      setUsuarios(allUsuarios);
      setFornecedores(demoData ? demoData.fornecedores : []);
      setItens(demoData ? demoData.itens : []);
      setOrcamentos(demoData ? demoData.orcamentos : []);
      setCampanhas(demoData ? demoData.campanhas : []);
      setLancamentos(demoData ? demoData.lancamentos : []);
      setPlanosAcao(demoData ? demoData.planosAcao : []);
      setAuditoria([
        {
          id: generateId('aud'),
          redeId,
          entidade: 'Rede',
          entidadeId: redeId,
          acao: 'criar',
          uid: adminUid,
          resumo: `Onboarding concluído: ${newRede.nome} + 11 categorias padrão`,
          antes: '',
          depois: JSON.stringify({ nome: newRede.nome, poloInicial: firstPolo.nome }),
          em: now,
        },
      ]);
      return;
    }

    // Firestore persistence
    try {
      const { id: _rId, ...redeDoc } = newRede;
      await setDoc(doc(db, 'redes', redeId), redeDoc);

      const { id: _uId, ...adminDoc } = adminUsuario;
      await setDoc(doc(db, 'redes', redeId, 'usuarios', adminUid), adminDoc);

      await setDoc(doc(db, 'userRedes', adminUid), {
        uid: adminUid,
        redeId,
        email: adminEmail,
        perfil: 'admin',
        atualizadoEm: now,
      });

      const batch = writeBatch(db);
      for (const p of allPolosList) {
        const { id, ...pDoc } = p;
        batch.set(doc(db, 'redes', redeId, 'polos', id), pDoc);
      }
      for (const c of defaultCategorias) {
        const { id, ...cDoc } = c;
        batch.set(doc(db, 'redes', redeId, 'categorias', id), cDoc);
      }
      for (const inv of invitedUsers) {
        const { id, ...invDoc } = inv;
        batch.set(doc(db, 'redes', redeId, 'usuarios', id), invDoc);
      }
      await batch.commit();

      setRede(newRede);

      if (params.carregarDemo) {
        await loadDemoDataForRede(redeId, adminUid, defaultCategorias);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `redes/${redeId}`);
    }
  };

  const loadDemoDataForRede = async (
    targetRedeId: string,
    adminUid: string,
    currentCategorias: Categoria[]
  ) => {
    const demo = buildDemoDataset(targetRedeId, adminUid, selectedMonth, currentCategorias);

    if (isLocalWorkspace || !firebaseUser) {
      setPolos((prev) => {
        const nonDemo = prev.filter((p) => !p.demo);
        return [...nonDemo, ...demo.polos];
      });
      if (currentCategorias.length < 11) {
        setCategorias(demo.categorias);
      }
      setUsuarios((prev) => {
        const existingIds = new Set(prev.map((u) => u.id));
        const toAdd = demo.usuariosExtras.filter((u) => !existingIds.has(u.id));
        return [...prev, ...toAdd];
      });
      setFornecedores((prev) => [...prev.filter((f) => !f.demo), ...demo.fornecedores]);
      setItens((prev) => [...prev.filter((i) => !i.demo), ...demo.itens]);
      setOrcamentos((prev) => [...prev.filter((o) => !o.demo), ...demo.orcamentos]);
      setCampanhas((prev) => [...prev.filter((c) => !c.demo), ...demo.campanhas]);
      setLancamentos((prev) => [...prev.filter((l) => !l.demo), ...demo.lancamentos]);
      setPlanosAcao((prev) => [...prev.filter((pa) => !pa.demo), ...demo.planosAcao]);
      await recordAudit({
        redeId: targetRedeId,
        entidade: 'DemoData',
        entidadeId: targetRedeId,
        acao: 'criar',
        resumo: 'Carregados dados de exemplo (3 polos e 6 meses de lançamentos realistas)',
      });
      return;
    }

    // Write demo docs to Firestore in batches of 400
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const operations: Array<{ col: string; id: string; data: any }> = [];
      demo.polos.forEach(({ id, ...data }) => operations.push({ col: 'polos', id, data }));
      if (currentCategorias.length < 11) {
        demo.categorias.forEach(({ id, ...data }) =>
          operations.push({ col: 'categorias', id, data })
        );
      }
      demo.usuariosExtras.forEach(({ id, ...data }) =>
        operations.push({ col: 'usuarios', id, data })
      );
      demo.fornecedores.forEach(({ id, ...data }) =>
        operations.push({ col: 'fornecedores', id, data })
      );
      demo.itens.forEach(({ id, ...data }) => operations.push({ col: 'itens', id, data }));
      demo.orcamentos.forEach(({ id, ...data }) =>
        operations.push({ col: 'orcamentos', id, data })
      );
      demo.campanhas.forEach(({ id, ...data }) =>
        operations.push({ col: 'campanhas', id, data })
      );
      demo.lancamentos.forEach(({ id, ...data }) =>
        operations.push({ col: 'lancamentos', id, data })
      );
      demo.planosAcao.forEach(({ id, ...data }) =>
        operations.push({ col: 'planosAcao', id, data })
      );

      const chunkSize = 350;
      for (let i = 0; i < operations.length; i += chunkSize) {
        const chunk = operations.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const op of chunk) {
          batch.set(doc(db, 'redes', targetRedeId, op.col, op.id), op.data);
        }
        await batch.commit();
      }

      await recordAudit({
        redeId: targetRedeId,
        entidade: 'DemoData',
        entidadeId: targetRedeId,
        acao: 'criar',
        resumo: 'Carregados dados de exemplo no Firestore (3 polos e 6 meses)',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `redes/${targetRedeId}/demo`);
    }
  };

  const loadDemoData = async () => {
    if (!rede) return;
    const adminUid = currentUserProfile?.uid || firebaseUser?.uid || 'admin-demo-uid';
    await loadDemoDataForRede(rede.id, adminUid, categorias);
  };

  const removeDemoData = async () => {
    if (!rede) return;
    if (isLocalWorkspace || !firebaseUser) {
      setPolos((prev) => prev.filter((p) => !p.demo));
      setFornecedores((prev) => prev.filter((f) => !f.demo));
      setItens((prev) => prev.filter((i) => !i.demo));
      setOrcamentos((prev) => prev.filter((o) => !o.demo));
      setCampanhas((prev) => prev.filter((c) => !c.demo));
      setLancamentos((prev) => prev.filter((l) => !l.demo));
      setPlanosAcao((prev) => prev.filter((pa) => !pa.demo));
      setUsuarios((prev) => prev.filter((u) => !u.id.startsWith('demo-user-')));
      setSelectedPoloId('ALL');
      await recordAudit({
        redeId: rede.id,
        entidade: 'DemoData',
        entidadeId: rede.id,
        acao: 'excluir',
        resumo: 'Removidos todos os dados de demonstração com 1 clique',
      });
      return;
    }

    try {
      const cols = [
        'polos',
        'fornecedores',
        'itens',
        'orcamentos',
        'campanhas',
        'lancamentos',
        'planosAcao',
      ];
      for (const colName of cols) {
        const q = query(
          collection(db, 'redes', rede.id, colName),
          where('redeId', '==', rede.id),
          where('demo', '==', true)
        );
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      setSelectedPoloId('ALL');
      await recordAudit({
        redeId: rede.id,
        entidade: 'DemoData',
        entidadeId: rede.id,
        acao: 'excluir',
        resumo: 'Removidos todos os dados de demonstração do Firestore',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `redes/${rede.id}/demo`);
    }
  };

  // CRUD Implementations
  const updateRedeSettings = async (nome: string, config: RedeConfig) => {
    if (!rede) return;
    const now = new Date().toISOString();
    const updated: Rede = { ...rede, nome: nome.trim(), config, atualizadoEm: now };
    if (isLocalWorkspace) {
      setRede(updated);
    } else {
      try {
        await updateDoc(doc(db, 'redes', rede.id), {
          nome: updated.nome,
          config: updated.config,
          atualizadoEm: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `redes/${rede.id}`);
      }
    }
    await recordAudit({
      redeId: rede.id,
      entidade: 'Rede',
      entidadeId: rede.id,
      acao: 'editar',
      resumo: `Configurações da rede atualizadas (Limite aprovação: R$ ${config.limiteAprovacao})`,
      antes: rede.config,
      depois: config,
    });
  };

  const savePolo = async (
    payload: Omit<Polo, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => {
    if (!rede) return;
    const now = new Date().toISOString();
    const existing = id ? polos.find((p) => p.id === id) : undefined;
    const poloId = id || generateId('polo');
    const record: Polo = {
      id: poloId,
      redeId: rede.id,
      nome: payload.nome.trim(),
      cidade: payload.cidade.trim(),
      ativo: payload.ativo,
      indicadorTamanho: Number(payload.indicadorTamanho) || 0,
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
    };

    if (isLocalWorkspace) {
      setPolos((prev) =>
        existing ? prev.map((p) => (p.id === poloId ? record : p)) : [...prev, record]
      );
    } else {
      const { id: _id, ...docData } = record;
      try {
        await setDoc(doc(db, 'redes', rede.id, 'polos', poloId), docData);
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `redes/${rede.id}/polos/${poloId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Polo',
      entidadeId: poloId,
      acao: existing ? 'editar' : 'criar',
      resumo: `${existing ? 'Editado' : 'Criado'} polo ${record.nome} (${record.cidade})`,
      antes: existing,
      depois: record,
    });
  };

  const saveUsuario = async (
    payload: Omit<UsuarioRede, 'id' | 'uid' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => {
    if (!rede) return;
    const now = new Date().toISOString();
    const existing = id ? usuarios.find((u) => u.id === id) : undefined;
    const userId = id || generateId('usr');
    const record: UsuarioRede = {
      id: userId,
      uid: existing?.uid || userId,
      redeId: rede.id,
      nome: payload.nome.trim(),
      email: payload.email.trim(),
      perfil: payload.perfil,
      poloIds: payload.poloIds,
      ativo: payload.ativo,
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
    };

    if (isLocalWorkspace) {
      setUsuarios((prev) =>
        existing ? prev.map((u) => (u.id === userId ? record : u)) : [...prev, record]
      );
    } else {
      const { id: _id, ...docData } = record;
      try {
        await setDoc(doc(db, 'redes', rede.id, 'usuarios', userId), docData);
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `redes/${rede.id}/usuarios/${userId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Usuario',
      entidadeId: userId,
      acao: existing ? 'editar' : 'criar',
      resumo: `${existing ? 'Atualizado' : 'Convidado'} usuário ${record.nome} (${record.perfil}, Ativo: ${record.ativo ? 'Sim' : 'Não'})`,
      antes: existing,
      depois: record,
    });
  };

  const saveCategoria = async (
    payload: Omit<Categoria, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => {
    if (!rede) return;
    const now = new Date().toISOString();
    const existing = id ? categorias.find((c) => c.id === id) : undefined;
    const catId = id || generateId('cat');
    const record: Categoria = {
      id: catId,
      redeId: rede.id,
      nome: payload.nome.trim(),
      tipo: payload.tipo,
      ativa: payload.ativa,
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
    };

    if (isLocalWorkspace) {
      setCategorias((prev) =>
        existing ? prev.map((c) => (c.id === catId ? record : c)) : [...prev, record]
      );
    } else {
      const { id: _id, ...docData } = record;
      try {
        await setDoc(doc(db, 'redes', rede.id, 'categorias', catId), docData);
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `redes/${rede.id}/categorias/${catId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Categoria',
      entidadeId: catId,
      acao: existing ? 'editar' : 'criar',
      resumo: `${existing ? 'Editada' : 'Criada'} categoria ${record.nome} (${record.tipo})`,
      antes: existing,
      depois: record,
    });
  };

  const saveFornecedor = async (
    payload: Omit<Fornecedor, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => {
    if (!rede) return;
    const now = new Date().toISOString();
    const existing = id ? fornecedores.find((f) => f.id === id) : undefined;
    const fornId = id || generateId('forn');
    const record: Fornecedor = {
      id: fornId,
      redeId: rede.id,
      nome: payload.nome.trim(),
      contato: payload.contato.trim(),
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
    };

    if (isLocalWorkspace) {
      setFornecedores((prev) =>
        existing ? prev.map((f) => (f.id === fornId ? record : f)) : [...prev, record]
      );
    } else {
      const { id: _id, ...docData } = record;
      try {
        await setDoc(doc(db, 'redes', rede.id, 'fornecedores', fornId), docData);
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `redes/${rede.id}/fornecedores/${fornId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Fornecedor',
      entidadeId: fornId,
      acao: existing ? 'editar' : 'criar',
      resumo: `${existing ? 'Editado' : 'Cadastrado'} fornecedor ${record.nome}`,
      antes: existing,
      depois: record,
    });
  };

  const saveItemCatalogo = async (
    payload: Omit<ItemCatalogo, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => {
    if (!rede) return;
    const now = new Date().toISOString();
    const existing = id ? itens.find((i) => i.id === id) : undefined;
    const itemId = id || generateId('item');
    const record: ItemCatalogo = {
      id: itemId,
      redeId: rede.id,
      nome: payload.nome.trim(),
      unidade: payload.unidade.trim() || 'un',
      categoriaId: payload.categoriaId,
      estoqueMinimo: Number(payload.estoqueMinimo) || 0,
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
    };

    if (isLocalWorkspace) {
      setItens((prev) =>
        existing ? prev.map((i) => (i.id === itemId ? record : i)) : [...prev, record]
      );
    } else {
      const { id: _id, ...docData } = record;
      try {
        await setDoc(doc(db, 'redes', rede.id, 'itens', itemId), docData);
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `redes/${rede.id}/itens/${itemId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'ItemCatalogo',
      entidadeId: itemId,
      acao: existing ? 'editar' : 'criar',
      resumo: `${existing ? 'Editado' : 'Criado'} item de catálogo ${record.nome} (Estoque mín: ${record.estoqueMinimo} ${record.unidade})`,
      antes: existing,
      depois: record,
    });
  };

  const saveLancamento = async (
    payload: Omit<
      Lancamento,
      'id' | 'redeId' | 'competencia' | 'status' | 'criadoPor' | 'criadoEm' | 'atualizadoEm' | 'excluido'
    >,
    existingId?: string
  ): Promise<Lancamento> => {
    if (!rede) throw new Error('Nenhuma rede ativa.');
    const now = new Date().toISOString();
    const existing = existingId ? lancamentos.find((l) => l.id === existingId) : undefined;
    const lancId = existingId || generateId('lanc');
    const uid = currentUserProfile?.uid || firebaseUser?.uid || 'admin-demo-uid';

    // Rule: Value above approval limit stays pending and goes to Gestor
    const statusInicial = determineInitialStatus(
      payload.valorTotal,
      rede.config.limiteAprovacao
    );
    const finalStatus: StatusLancamento = existing
      ? existing.status === 'pendente' && payload.valorTotal <= rede.config.limiteAprovacao
        ? 'pendente'
        : statusInicial === 'pendente'
        ? 'pendente'
        : existing.status
      : statusInicial;

    const record: Lancamento = {
      id: lancId,
      redeId: rede.id,
      data: payload.data,
      competencia: payload.data.slice(0, 7),
      poloId: payload.poloId,
      tipo: payload.tipo,
      categoriaId: payload.categoriaId,
      itemId: payload.itemId || '',
      descricao: payload.descricao.trim(),
      fornecedorId: payload.fornecedorId || '',
      quantidade: payload.quantidade,
      unidade: payload.unidade || 'un',
      valorUnitario: payload.valorUnitario,
      valorTotal: payload.valorTotal,
      formaPagamento: payload.formaPagamento || 'PIX',
      responsavelUid: payload.responsavelUid || uid,
      emergencial: Boolean(payload.emergencial),
      justificativa: (payload.justificativa || '').trim(),
      campanhaId: payload.campanhaId || '',
      rateio: payload.rateio || { ativo: false, criterio: 'igual', partes: [] },
      status: finalStatus,
      comprovanteUrl: payload.comprovanteUrl || '',
      criadoPor: existing?.criadoPor || uid,
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
      excluido: false,
    };

    if (isLocalWorkspace) {
      setLancamentos((prev) =>
        existing ? prev.map((l) => (l.id === lancId ? record : l)) : [record, ...prev]
      );
    } else {
      const { id: _id, ...docData } = record;
      try {
        await setDoc(doc(db, 'redes', rede.id, 'lancamentos', lancId), docData);
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `redes/${rede.id}/lancamentos/${lancId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Lancamento',
      entidadeId: lancId,
      acao: existing ? 'editar' : 'criar',
      resumo: `${existing ? 'Editado' : 'Registrado'} lançamento "${record.descricao}" — R$ ${record.valorTotal.toFixed(2)} (${record.status.toUpperCase()})`,
      antes: existing,
      depois: record,
    });

    return record;
  };

  const duplicateLancamento = async (l: Lancamento): Promise<Lancamento> => {
    return saveLancamento({
      data: l.data,
      poloId: l.poloId,
      tipo: l.tipo,
      categoriaId: l.categoriaId,
      itemId: l.itemId,
      descricao: `${l.descricao} (Cópia)`,
      fornecedorId: l.fornecedorId,
      quantidade: l.quantidade,
      unidade: l.unidade,
      valorUnitario: l.valorUnitario,
      valorTotal: l.valorTotal,
      formaPagamento: l.formaPagamento,
      responsavelUid: l.responsavelUid,
      emergencial: l.emergencial,
      justificativa: l.justificativa,
      campanhaId: l.campanhaId,
      rateio: l.rateio,
      comprovanteUrl: l.comprovanteUrl,
    });
  };

  const updateLancamentoStatus = async (
    lancamentoId: string,
    novoStatus: StatusLancamento,
    motivo?: string
  ) => {
    if (!rede) return;
    const existing = lancamentos.find((l) => l.id === lancamentoId);
    if (!existing) return;
    const now = new Date().toISOString();
    const updated: Lancamento = {
      ...existing,
      status: novoStatus,
      justificativa: motivo
        ? `${existing.justificativa ? existing.justificativa + ' | ' : ''}${motivo}`
        : existing.justificativa,
      atualizadoEm: now,
    };

    if (isLocalWorkspace) {
      setLancamentos((prev) => prev.map((l) => (l.id === lancamentoId ? updated : l)));
    } else {
      try {
        await updateDoc(doc(db, 'redes', rede.id, 'lancamentos', lancamentoId), {
          status: novoStatus,
          justificativa: updated.justificativa,
          atualizadoEm: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `redes/${rede.id}/lancamentos/${lancamentoId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Lancamento',
      entidadeId: lancamentoId,
      acao: novoStatus === 'aprovado' ? 'aprovar' : 'rejeitar',
      resumo: `Lançamento "${existing.descricao}" (R$ ${existing.valorTotal.toFixed(2)}) marcado como ${novoStatus.toUpperCase()}`,
      antes: { status: existing.status },
      depois: { status: novoStatus },
    });
  };

  const softDeleteLancamento = async (lancamentoId: string) => {
    if (!rede) return;
    const existing = lancamentos.find((l) => l.id === lancamentoId);
    if (!existing) return;
    const now = new Date().toISOString();
    const updated: Lancamento = { ...existing, excluido: true, atualizadoEm: now };

    if (isLocalWorkspace) {
      setLancamentos((prev) => prev.map((l) => (l.id === lancamentoId ? updated : l)));
    } else {
      try {
        await updateDoc(doc(db, 'redes', rede.id, 'lancamentos', lancamentoId), {
          excluido: true,
          atualizadoEm: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `redes/${rede.id}/lancamentos/${lancamentoId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Lancamento',
      entidadeId: lancamentoId,
      acao: 'excluir',
      resumo: `Exclusão lógica do lançamento "${existing.descricao}" (R$ ${existing.valorTotal.toFixed(2)})`,
      antes: { excluido: false },
      depois: { excluido: true },
    });
  };

  const saveOrcamentoTeto = async (
    mes: string,
    poloId: string,
    categoriaId: string,
    teto: number
  ) => {
    if (!rede) return;
    const now = new Date().toISOString();
    const orcId = `${mes}_${poloId}_${categoriaId}`;
    const existing = orcamentos.find((o) => o.id === orcId);
    const record: Orcamento = {
      id: orcId,
      redeId: rede.id,
      mes,
      poloId,
      categoriaId,
      teto: Math.max(0, Number(teto) || 0),
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
    };

    if (isLocalWorkspace) {
      setOrcamentos((prev) =>
        existing ? prev.map((o) => (o.id === orcId ? record : o)) : [...prev, record]
      );
    } else {
      const { id: _id, ...docData } = record;
      try {
        await setDoc(doc(db, 'redes', rede.id, 'orcamentos', orcId), docData);
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `redes/${rede.id}/orcamentos/${orcId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Orcamento',
      entidadeId: orcId,
      acao: existing ? 'editar' : 'criar',
      resumo: `Definido teto de R$ ${record.teto.toFixed(2)} para ${mes} (${poloId} / ${categoriaId})`,
      antes: existing,
      depois: record,
    });
  };

  const copyPreviousMonthOrcamentos = async (
    targetMes: string,
    sourceMes: string
  ): Promise<number> => {
    if (!rede) return 0;
    const sourceItems = filteredOrcamentos.filter((o) => o.mes === sourceMes && o.teto > 0);
    if (sourceItems.length === 0) return 0;
    const now = new Date().toISOString();

    const newRecords: Orcamento[] = sourceItems.map((src) => ({
      id: `${targetMes}_${src.poloId}_${src.categoriaId}`,
      redeId: rede.id,
      mes: targetMes,
      poloId: src.poloId,
      categoriaId: src.categoriaId,
      teto: src.teto,
      criadoEm: now,
      atualizadoEm: now,
    }));

    if (isLocalWorkspace) {
      setOrcamentos((prev) => {
        const map = new Map(prev.map((o) => [o.id, o]));
        newRecords.forEach((nr) => map.set(nr.id, nr));
        return Array.from(map.values());
      });
    } else {
      try {
        const batch = writeBatch(db);
        for (const nr of newRecords) {
          const { id, ...docData } = nr;
          batch.set(doc(db, 'redes', rede.id, 'orcamentos', id), docData);
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `redes/${rede.id}/orcamentos`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Orcamento',
      entidadeId: targetMes,
      acao: 'criar',
      resumo: `Copiados ${newRecords.length} tetos orçamentários de ${sourceMes} para ${targetMes}`,
    });

    return newRecords.length;
  };

  const saveCampanha = async (
    payload: Omit<Campanha, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => {
    if (!rede) return;
    const now = new Date().toISOString();
    const existing = id ? campanhas.find((c) => c.id === id) : undefined;
    const campId = id || generateId('camp');
    const record: Campanha = {
      id: campId,
      redeId: rede.id,
      poloId: payload.poloId,
      canal: payload.canal,
      nome: payload.nome.trim(),
      inicio: payload.inicio,
      fim: payload.fim,
      leads: Number(payload.leads) || 0,
      acoes: Number(payload.acoes) || 0,
      tipoAcao: payload.tipoAcao,
      metaCustoPorAcao: Number(payload.metaCustoPorAcao) || 0,
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
    };

    if (isLocalWorkspace) {
      setCampanhas((prev) =>
        existing ? prev.map((c) => (c.id === campId ? record : c)) : [...prev, record]
      );
    } else {
      const { id: _id, ...docData } = record;
      try {
        await setDoc(doc(db, 'redes', rede.id, 'campanhas', campId), docData);
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `redes/${rede.id}/campanhas/${campId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Campanha',
      entidadeId: campId,
      acao: existing ? 'editar' : 'criar',
      resumo: `${existing ? 'Editada' : 'Criada'} campanha "${record.nome}" (${record.canal})`,
      antes: existing,
      depois: record,
    });
  };

  const savePlanoAcao = async (
    payload: Omit<PlanoAcao, 'id' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => {
    if (!rede) return;
    const now = new Date().toISOString();
    const existing = id ? planosAcao.find((p) => p.id === id) : undefined;
    const planoId = id || generateId('plano');
    const record: PlanoAcao = {
      id: planoId,
      redeId: rede.id,
      titulo: payload.titulo.trim(),
      poloId: payload.poloId,
      categoriaId: payload.categoriaId || '',
      responsavelUid: payload.responsavelUid || currentUserProfile?.uid || 'admin',
      prazo: payload.prazo,
      economiaEstimada: Number(payload.economiaEstimada) || 0,
      status: payload.status,
      origemAlerta: payload.origemAlerta || '',
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
    };

    if (isLocalWorkspace) {
      setPlanosAcao((prev) =>
        existing ? prev.map((p) => (p.id === planoId ? record : p)) : [record, ...prev]
      );
    } else {
      const { id: _id, ...docData } = record;
      try {
        await setDoc(doc(db, 'redes', rede.id, 'planosAcao', planoId), docData);
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, `redes/${rede.id}/planosAcao/${planoId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'PlanoAcao',
      entidadeId: planoId,
      acao: existing ? 'editar' : 'criar',
      resumo: `${existing ? 'Atualizado' : 'Criado'} plano de ação "${record.titulo}" (Economia est.: R$ ${record.economiaEstimada.toFixed(2)})`,
      antes: existing,
      depois: record,
    });
  };

  return (
    <AppContext.Provider
      value={{
        firebaseUser,
        authLoading,
        dataLoading,
        isLocalWorkspace,
        rede,
        currentUserProfile,
        activePersonaId,
        setActivePersonaId,
        selectedMonth,
        setSelectedMonth,
        selectedPoloId,
        setSelectedPoloId,
        darkMode,
        toggleDarkMode,
        usuarios,
        allPolos: polos,
        visiblePolos,
        categorias,
        fornecedores,
        itens,
        lancamentos: filteredLancamentos,
        orcamentos: filteredOrcamentos,
        campanhas: filteredCampanhas,
        planosAcao: filteredPlanosAcao,
        auditoria,
        alertas,
        canManageNetwork,
        canApproveLaunches,
        canCreateLaunches,
        canEditLaunch,
        hasDemoData,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        enterInteractiveWorkspace,
        logout,
        completeOnboarding,
        loadDemoData,
        removeDemoData,
        updateRedeSettings,
        savePolo,
        saveUsuario,
        saveCategoria,
        saveFornecedor,
        saveItemCatalogo,
        saveLancamento,
        duplicateLancamento,
        updateLancamentoStatus,
        softDeleteLancamento,
        saveOrcamentoTeto,
        copyPreviousMonthOrcamentos,
        saveCampanha,
        savePlanoAcao,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
