import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
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
  ConviteUsuario,
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
  generateInviteToken,
  getCurrentMonthSaoPaulo,
  hashInviteTokenSha256,
  isInviteExpired,
} from '../utils/financeRules';
import { buildDemoDataset } from '../utils/demoData';

const LOCAL_STORAGE_KEY = 'gastopolo_demo_workspace_v2';

interface LocalWorkspaceState {
  rede: Rede | null;
  usuarios: UsuarioRede[];
  convites: ConviteUsuario[];
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
  isEmailVerified: boolean;
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

  // Collections (Filtered by RBAC polo isolation)
  usuarios: UsuarioRede[];
  convites: ConviteUsuario[];
  myPendingInvites: ConviteUsuario[];
  lastIssuedInviteTokens: Record<string, string>;
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

  // Auth & Email Verification Actions
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (nome: string, email: string, pass: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  enterInteractiveWorkspace: (withDemoData?: boolean) => Promise<void>;
  logout: () => Promise<void>;

  // Onboarding, Invites & Demo Data Actions
  completeOnboarding: (params: {
    nomeRede: string;
    rotuloTamanho: string;
    limiteAprovacao: number;
    primeiroPolo: { nome: string; cidade: string; indicadorTamanho: number };
    convidados: Array<{ nome: string; email: string; perfil: PerfilUsuario }>;
    carregarDemo: boolean;
  }) => Promise<void>;
  createInvite: (params: {
    nome: string;
    email: string;
    perfil: PerfilUsuario;
    poloIds: string[];
    diasValidade?: number;
  }) => Promise<{ convite: ConviteUsuario; rawToken: string }>;
  cancelInvite: (conviteId: string) => Promise<void>;
  acceptInvite: (conviteId: string, rawToken: string, nomeConfirmado?: string) => Promise<void>;
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  // Demo mode is NEVER auto-activated by URL params or localStorage; requires explicit user action
  const [isLocalWorkspace, setIsLocalWorkspace] = useState<boolean>(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('gastopolo_theme') === 'dark';
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthSaoPaulo());
  const [selectedPoloId, setSelectedPoloId] = useState<string | 'ALL'>('ALL');
  const [activePersonaId, setActivePersonaIdState] = useState<string | null>(null);

  // Domain states
  const [rede, setRede] = useState<Rede | null>(null);
  const [ownMemberProfile, setOwnMemberProfile] = useState<UsuarioRede | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioRede[]>([]);
  const [convites, setConvites] = useState<ConviteUsuario[]>([]);
  const [myPendingInvites, setMyPendingInvites] = useState<ConviteUsuario[]>([]);
  const [lastIssuedInviteTokens, setLastIssuedInviteTokens] = useState<Record<string, string>>({});
  const [polos, setPolos] = useState<Polo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [planosAcao, setPlanosAcao] = useState<PlanoAcao[]>([]);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);

  // Persona switching is strictly restricted to isolated Demo Mode (isLocalWorkspace)
  const setActivePersonaId = (uid: string | null) => {
    if (!isLocalWorkspace) {
      setActivePersonaIdState(null);
      return;
    }
    setActivePersonaIdState(uid);
  };

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

  const persistLocalState = (next: LocalWorkspaceState) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Unable to persist local demo state:', e);
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      setFirebaseUser(user);
      setIsEmailVerified(Boolean(user?.emailVerified));

      if (!user) {
        setOwnMemberProfile(null);
        setMyPendingInvites([]);
        setAuthLoading(false);
        return;
      }

      // Real authenticated Firebase user disables isolated local demo workspace
      setIsLocalWorkspace(false);
      setActivePersonaIdState(null);

      if (!user.emailVerified) {
        setRede(null);
        setOwnMemberProfile(null);
        setDataLoading(false);
        setAuthLoading(false);
        return;
      }

      setDataLoading(true);
      try {
        const userRedeDocRef = doc(db, 'userRedes', user.uid);
        const userRedeSnap = await getDoc(userRedeDocRef);
        if (!isMounted) return;

        if (userRedeSnap.exists()) {
          const { redeId } = userRedeSnap.data() as { redeId: string };
          const [redeSnap, memberSnap] = await Promise.all([
            getDoc(doc(db, 'redes', redeId)),
            getDoc(doc(db, 'redes', redeId, 'usuarios', user.uid)),
          ]);
          if (!isMounted) return;
          if (memberSnap.exists()) {
            const memberData = {
              id: memberSnap.id,
              ...(memberSnap.data() as Omit<UsuarioRede, 'id'>),
            };
            setOwnMemberProfile(memberData);
            setUsuarios([memberData]);
          } else {
            setOwnMemberProfile(null);
          }
          if (redeSnap.exists()) {
            setRede({ id: redeSnap.id, ...(redeSnap.data() as Omit<Rede, 'id'>) });
          }
        } else {
          setRede(null);
          setOwnMemberProfile(null);
        }
      } catch (err) {
        console.warn('Initial tenant lookup:', err);
      } finally {
        if (isMounted) {
          setDataLoading(false);
          setAuthLoading(false);
        }
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Subscribe to pending invitations addressed to the authenticated, verified user's email
  useEffect(() => {
    if (isLocalWorkspace || !firebaseUser || !isEmailVerified || !firebaseUser.email) {
      setMyPendingInvites([]);
      return;
    }

    const normalizedEmail = firebaseUser.email.trim().toLowerCase();
    const q = query(collection(db, 'convites'), where('email', '==', normalizedEmail));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ConviteUsuario, 'id'>) }))
          .filter((c) => c.status === 'pendente' && !isInviteExpired(c.expiraEmMillis));
        setMyPendingInvites(list);
      },
      (err) => {
        console.warn('Pending invite lookup error:', err);
      }
    );

    return () => unsub();
  }, [isLocalWorkspace, firebaseUser, isEmailVerified]);

  // Subscribe to the user's own member document in redes/{redeId}/usuarios/{uid}
  useEffect(() => {
    if (isLocalWorkspace || !firebaseUser || !isEmailVerified || !rede?.id) {
      setOwnMemberProfile(null);
      return;
    }

    const redeId = rede.id;
    const memberRef = doc(db, 'redes', redeId, 'usuarios', firebaseUser.uid);
    const unsub = onSnapshot(
      memberRef,
      (snap) => {
        if (snap.exists()) {
          const member: UsuarioRede = {
            id: snap.id,
            ...(snap.data() as Omit<UsuarioRede, 'id'>),
          };
          setOwnMemberProfile(member);
          setUsuarios((prev) => {
            const others = prev.filter((u) => u.uid !== member.uid);
            return [member, ...others];
          });
        } else {
          setOwnMemberProfile(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `redes/${redeId}/usuarios/${firebaseUser.uid}`)
    );

    return () => unsub();
  }, [isLocalWorkspace, firebaseUser, isEmailVerified, rede?.id]);

  // Subscribe to Firestore subcollections when authenticated, verified, & active member of Rede
  useEffect(() => {
    if (
      isLocalWorkspace ||
      !firebaseUser ||
      !isEmailVerified ||
      !rede?.id ||
      !ownMemberProfile ||
      !ownMemberProfile.ativo
    ) {
      return;
    }

    const redeId = rede.id;
    const perfil = ownMemberProfile.perfil;
    const userPoloIds = ownMemberProfile.poloIds || [];
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

    // Network-wide collections readable by all active members
    const sharedCollections: Array<{
      name: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setter: React.Dispatch<React.SetStateAction<any[]>>;
    }> = [
      { name: 'polos', setter: setPolos },
      { name: 'categorias', setter: setCategorias },
      { name: 'fornecedores', setter: setFornecedores },
      { name: 'itens', setter: setItens },
    ];

    for (const sub of sharedCollections) {
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

    // Admin or Gestor can list all network users and audit trail
    if (perfil === 'admin' || perfil === 'gestor') {
      const usersQ = query(collection(db, 'redes', redeId, 'usuarios'), where('redeId', '==', redeId));
      unsubs.push(
        onSnapshot(
          usersQ,
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UsuarioRede, 'id'>) }));
            setUsuarios(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `redes/${redeId}/usuarios`)
        )
      );

      const audQ = query(collection(db, 'redes', redeId, 'auditoria'), where('redeId', '==', redeId));
      unsubs.push(
        onSnapshot(
          audQ,
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Auditoria, 'id'>) }));
            setAuditoria(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `redes/${redeId}/auditoria`)
        )
      );
    } else {
      setUsuarios([ownMemberProfile]);
      setAuditoria([]);
    }

    // Only Admin can list network invitations
    if (perfil === 'admin') {
      const convQ = query(collection(db, 'convites'), where('redeId', '==', redeId));
      unsubs.push(
        onSnapshot(
          convQ,
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ConviteUsuario, 'id'>),
            }));
            setConvites(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'convites')
        )
      );
    } else {
      setConvites([]);
    }

    // Polo-scoped collections: Admin queries all polos; non-admin queries only authorized poloIds
    const poloScopedCollections: Array<{
      name: string;
      includeAllKeyword?: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setter: React.Dispatch<React.SetStateAction<any[]>>;
    }> = [
      { name: 'lancamentos', setter: setLancamentos },
      { name: 'orcamentos', setter: setOrcamentos },
      { name: 'campanhas', includeAllKeyword: true, setter: setCampanhas },
      { name: 'planosAcao', setter: setPlanosAcao },
    ];

    for (const sub of poloScopedCollections) {
      if (perfil === 'admin') {
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
      } else if (userPoloIds.length > 0) {
        const allowedList = sub.includeAllKeyword
          ? Array.from(new Set([...userPoloIds.slice(0, 9), 'ALL']))
          : userPoloIds.slice(0, 10);
        const q = query(
          collection(db, 'redes', redeId, sub.name),
          where('redeId', '==', redeId),
          where('poloId', 'in', allowedList)
        );
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
      } else {
        sub.setter([]);
      }
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [
    isLocalWorkspace,
    firebaseUser,
    isEmailVerified,
    rede?.id,
    ownMemberProfile?.uid,
    ownMemberProfile?.ativo,
    ownMemberProfile?.perfil,
    JSON.stringify(ownMemberProfile?.poloIds || []),
  ]);

  // Resolve current active user profile:
  // - In Production (!isLocalWorkspace): strictly by authenticated Firebase UID and valid network link. NEVER falls back to usuarios[0] or activePersonaId.
  // - In Isolated Demo Mode (isLocalWorkspace): supports persona simulation for evaluating RBAC isolation.
  const currentUserProfile = useMemo<UsuarioRede | null>(() => {
    if (isLocalWorkspace) {
      if (usuarios.length === 0) return null;
      if (activePersonaId) {
        const persona = usuarios.find((u) => u.id === activePersonaId || u.uid === activePersonaId);
        if (persona) return persona;
      }
      return (
        usuarios.find((u) => u.uid === 'admin-demo-uid' || u.uid === 'admin-local-uid') || null
      );
    }

    if (!firebaseUser || !rede) return null;
    if (ownMemberProfile && ownMemberProfile.uid === firebaseUser.uid && ownMemberProfile.redeId === rede.id) {
      return ownMemberProfile;
    }
    return usuarios.find((u) => u.uid === firebaseUser.uid && u.redeId === rede.id) || null;
  }, [isLocalWorkspace, usuarios, activePersonaId, firebaseUser, rede, ownMemberProfile]);

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

  // Reset selectedPoloId if user doesn't have access to current selectedPoloId
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

  // Audit helper (only writers create audit entries)
  const recordAudit = async (params: {
    redeId: string;
    entidade: string;
    entidadeId: string;
    acao: AcaoAuditoria;
    resumo: string;
    antes?: unknown;
    depois?: unknown;
  }) => {
    const uid = isLocalWorkspace
      ? currentUserProfile?.uid || 'admin-demo-uid'
      : firebaseUser?.uid;
    if (!uid) return null;

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
      setAuditoria((prev) => [entry, ...prev]);
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
      convites,
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
    convites,
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
    const cred = await signInWithPopup(auth, googleProvider);
    setFirebaseUser(cred.user);
    setIsEmailVerified(Boolean(cred.user.emailVerified));
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    setFirebaseUser(cred.user);
    setIsEmailVerified(Boolean(cred.user.emailVerified));
  };

  const registerWithEmail = async (nome: string, email: string, pass: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (cred.user) {
      if (nome.trim()) {
        await updateProfile(cred.user, { displayName: nome.trim() });
      }
      await sendEmailVerification(cred.user);
      setFirebaseUser(cred.user);
      setIsEmailVerified(Boolean(cred.user.emailVerified));
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('Nenhum usuário autenticado para reenviar o e-mail.');
    }
    await sendEmailVerification(auth.currentUser);
  };

  const refreshEmailVerification = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const verified = Boolean(auth.currentUser.emailVerified);
    if (verified) {
      // Force token refresh so Firestore security rules immediately receive email_verified == true
      await auth.currentUser.getIdToken(true);
    }
    setFirebaseUser(auth.currentUser);
    setIsEmailVerified(verified);

    if (verified) {
      setDataLoading(true);
      try {
        const userRedeSnap = await getDoc(doc(db, 'userRedes', auth.currentUser.uid));
        if (userRedeSnap.exists()) {
          const { redeId } = userRedeSnap.data() as { redeId: string };
          const [redeSnap, memberSnap] = await Promise.all([
            getDoc(doc(db, 'redes', redeId)),
            getDoc(doc(db, 'redes', redeId, 'usuarios', auth.currentUser.uid)),
          ]);
          if (memberSnap.exists()) {
            const memberData = {
              id: memberSnap.id,
              ...(memberSnap.data() as Omit<UsuarioRede, 'id'>),
            };
            setOwnMemberProfile(memberData);
            setUsuarios([memberData]);
          }
          if (redeSnap.exists()) {
            setRede({ id: redeSnap.id, ...(redeSnap.data() as Omit<Rede, 'id'>) });
          }
        }
      } catch (err) {
        console.warn('Post-verification tenant lookup:', err);
      } finally {
        setDataLoading(false);
      }
    }

    return verified;
  };

  const enterInteractiveWorkspace = async (withDemoData = true) => {
    if (firebaseUser) {
      await signOut(auth);
      setFirebaseUser(null);
      setIsEmailVerified(false);
    }
    const now = new Date().toISOString();
    const redeId = 'rede-educar-brasil';
    const adminUid = 'admin-demo-uid';
    const baseMonth = selectedMonth;

    const initialRede: Rede = {
      id: redeId,
      nome: 'Rede Educar Brasil (Ambiente Demo Isolado)',
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
        nome: 'Administrador (Demo)',
        email: 'admin@gastopolo.com.br',
        perfil: 'admin',
        poloIds: demo.polos.map((p) => p.id),
        ativo: true,
        criadoEm: now,
        atualizadoEm: now,
      };
      setIsLocalWorkspace(true);
      setRede(initialRede);
      setOwnMemberProfile(adminUser);
      setUsuarios([adminUser, ...demo.usuariosExtras]);
      setConvites([]);
      setPolos(demo.polos);
      setCategorias(demo.categorias);
      setFornecedores(demo.fornecedores);
      setItens(demo.itens);
      setLancamentos(demo.lancamentos);
      setOrcamentos(demo.orcamentos);
      setCampanhas(demo.campanhas);
      setPlanosAcao(demo.planosAcao);
      setAuditoria(demo.auditoria);
      setActivePersonaIdState(null);
    } else {
      setIsLocalWorkspace(true);
      setRede(null);
      setOwnMemberProfile(null);
      setUsuarios([]);
      setConvites([]);
      setPolos([]);
      setCategorias([]);
      setFornecedores([]);
      setItens([]);
      setLancamentos([]);
      setOrcamentos([]);
      setCampanhas([]);
      setPlanosAcao([]);
      setAuditoria([]);
      setActivePersonaIdState(null);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  const logout = async () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setIsLocalWorkspace(false);
    setRede(null);
    setOwnMemberProfile(null);
    setUsuarios([]);
    setConvites([]);
    setMyPendingInvites([]);
    setLastIssuedInviteTokens({});
    setPolos([]);
    setCategorias([]);
    setFornecedores([]);
    setItens([]);
    setLancamentos([]);
    setOrcamentos([]);
    setCampanhas([]);
    setPlanosAcao([]);
    setAuditoria([]);
    setActivePersonaIdState(null);
    if (firebaseUser) {
      await signOut(auth);
    }
  };

  // Controlled Onboarding: creates Rede, First Admin (strictly bound to creator UID), first Polo, 11 categories, and secure pending Invites
  const completeOnboarding = async (params: {
    nomeRede: string;
    rotuloTamanho: string;
    limiteAprovacao: number;
    primeiroPolo: { nome: string; cidade: string; indicadorTamanho: number };
    convidados: Array<{ nome: string; email: string; perfil: PerfilUsuario }>;
    carregarDemo: boolean;
  }) => {
    if (!isLocalWorkspace) {
      if (!firebaseUser) {
        throw new Error('Autenticação obrigatória para criar uma Rede.');
      }
      if (!isEmailVerified && !firebaseUser.emailVerified) {
        throw new Error('Confirme seu endereço de e-mail antes de concluir o cadastro da Rede.');
      }
    }

    const now = new Date().toISOString();
    const redeId = generateId('rede');
    const adminUid = isLocalWorkspace ? 'admin-local-uid' : firebaseUser!.uid;
    const adminEmail = isLocalWorkspace
      ? 'admin@gastopolo.com.br'
      : (firebaseUser!.email || '').trim().toLowerCase();
    const adminNome = isLocalWorkspace
      ? 'Administrador da Rede (Demo)'
      : firebaseUser!.displayName || 'Administrador da Rede';

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

    // Build real pending invitations (NEVER fake usuarios with random UIDs!)
    const expiraEmMillis = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const expiraEm = new Date(expiraEmMillis).toISOString();
    const pendingInvites: ConviteUsuario[] = [];
    const generatedTokens: Record<string, string> = {};

    for (const c of params.convidados) {
      if (!c.nome.trim() || !c.email.trim()) continue;
      const conviteId = generateId('conv');
      const rawToken = generateInviteToken();
      const tokenHash = await hashInviteTokenSha256(rawToken);
      generatedTokens[conviteId] = rawToken;
      pendingInvites.push({
        id: conviteId,
        redeId,
        redeNome: newRede.nome,
        nome: c.nome.trim(),
        email: c.email.trim().toLowerCase(),
        perfil: c.perfil,
        poloIds: c.perfil === 'admin' ? allPolosList.map((p) => p.id) : [firstPoloId],
        status: 'pendente',
        tokenHash,
        aceitoTokenHash: '',
        expiraEm,
        expiraEmMillis,
        criadoPor: adminUid,
        criadoEm: now,
        atualizadoEm: now,
        aceitoPorUid: '',
        aceitoEm: '',
      });
    }

    if (isLocalWorkspace) {
      const localUsers = [
        adminUsuario,
        ...(demoData ? demoData.usuariosExtras : []),
      ];
      setRede(newRede);
      setOwnMemberProfile(adminUsuario);
      setPolos(allPolosList);
      setCategorias(defaultCategorias);
      setUsuarios(localUsers);
      setConvites(pendingInvites);
      setLastIssuedInviteTokens((prev) => ({ ...prev, ...generatedTokens }));
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

    // Firestore persistence: Atomic bootstrap of Rede + First Admin + UserRedeMap
    try {
      const bootstrapBatch = writeBatch(db);
      const { id: _rId, ...redeDoc } = newRede;
      bootstrapBatch.set(doc(db, 'redes', redeId), redeDoc);

      const { id: _uId, ...adminDoc } = adminUsuario;
      bootstrapBatch.set(doc(db, 'redes', redeId, 'usuarios', adminUid), adminDoc);

      bootstrapBatch.set(doc(db, 'userRedes', adminUid), {
        uid: adminUid,
        redeId,
        email: adminEmail,
        perfil: 'admin',
        atualizadoEm: now,
      });
      await bootstrapBatch.commit();

      const setupBatch = writeBatch(db);
      for (const p of allPolosList) {
        const { id, ...pDoc } = p;
        setupBatch.set(doc(db, 'redes', redeId, 'polos', id), pDoc);
      }
      for (const c of defaultCategorias) {
        const { id, ...cDoc } = c;
        setupBatch.set(doc(db, 'redes', redeId, 'categorias', id), cDoc);
      }
      for (const inv of pendingInvites) {
        const { id, ...invDoc } = inv;
        setupBatch.set(doc(db, 'convites', id), invDoc);
      }
      await setupBatch.commit();

      setLastIssuedInviteTokens((prev) => ({ ...prev, ...generatedTokens }));
      setOwnMemberProfile(adminUsuario);
      setUsuarios([adminUsuario]);
      setConvites(pendingInvites);
      setRede(newRede);

      if (params.carregarDemo) {
        await loadDemoDataForRede(redeId, adminUid, defaultCategorias);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `redes/${redeId}`);
    }
  };

  // Real User Invitation Issuance (Admin only)
  const createInvite = async (params: {
    nome: string;
    email: string;
    perfil: PerfilUsuario;
    poloIds: string[];
    diasValidade?: number;
  }): Promise<{ convite: ConviteUsuario; rawToken: string }> => {
    if (!rede) throw new Error('Nenhuma rede ativa.');
    if (!canManageNetwork) {
      throw new Error('Apenas o Administrador da Rede pode emitir convites de usuários.');
    }

    const cleanNome = params.nome.trim();
    const cleanEmail = params.email.trim().toLowerCase();
    if (!cleanNome || !cleanEmail) {
      throw new Error('Informe o nome e o e-mail do usuário convidado.');
    }

    const now = new Date().toISOString();
    const dias = params.diasValidade && params.diasValidade > 0 ? params.diasValidade : 7;
    const expiraEmMillis = Date.now() + dias * 24 * 60 * 60 * 1000;
    const expiraEm = new Date(expiraEmMillis).toISOString();
    const conviteId = generateId('conv');
    const rawToken = generateInviteToken();
    const tokenHash = await hashInviteTokenSha256(rawToken);
    const adminUid = isLocalWorkspace
      ? currentUserProfile?.uid || 'admin-demo-uid'
      : firebaseUser!.uid;

    const assignedPolos =
      params.perfil === 'admin' ? polos.map((p) => p.id) : params.poloIds;

    const convite: ConviteUsuario = {
      id: conviteId,
      redeId: rede.id,
      redeNome: rede.nome,
      nome: cleanNome,
      email: cleanEmail,
      perfil: params.perfil,
      poloIds: assignedPolos,
      status: 'pendente',
      tokenHash,
      aceitoTokenHash: '',
      expiraEm,
      expiraEmMillis,
      criadoPor: adminUid,
      criadoEm: now,
      atualizadoEm: now,
      aceitoPorUid: '',
      aceitoEm: '',
    };

    if (isLocalWorkspace) {
      setConvites((prev) => [convite, ...prev]);
    } else {
      const { id: _id, ...docData } = convite;
      try {
        await setDoc(doc(db, 'convites', conviteId), docData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `convites/${conviteId}`);
      }
    }

    setLastIssuedInviteTokens((prev) => ({ ...prev, [conviteId]: rawToken }));

    await recordAudit({
      redeId: rede.id,
      entidade: 'Convite',
      entidadeId: conviteId,
      acao: 'criar',
      resumo: `Convite pendente emitido para ${cleanNome} (${cleanEmail}) com perfil ${params.perfil.toUpperCase()}`,
      depois: { email: cleanEmail, perfil: params.perfil, poloIds: assignedPolos, expiraEm },
    });

    return { convite, rawToken };
  };

  const cancelInvite = async (conviteId: string) => {
    if (!rede || !canManageNetwork) return;
    const existing = convites.find((c) => c.id === conviteId);
    if (!existing || existing.status !== 'pendente') return;
    const now = new Date().toISOString();

    if (isLocalWorkspace) {
      setConvites((prev) =>
        prev.map((c) => (c.id === conviteId ? { ...c, status: 'cancelado', atualizadoEm: now } : c))
      );
    } else {
      try {
        await updateDoc(doc(db, 'convites', conviteId), {
          status: 'cancelado',
          atualizadoEm: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `convites/${conviteId}`);
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Convite',
      entidadeId: conviteId,
      acao: 'excluir',
      resumo: `Convite para ${existing.email} cancelado pelo Administrador`,
      antes: { status: existing.status },
      depois: { status: 'cancelado' },
    });
  };

  // Real Invite Acceptance: verifies email match, expiration, and single-use SHA-256 tokenHash, then atomically binds real Firebase UID
  const acceptInvite = async (
    conviteId: string,
    rawToken: string,
    nomeConfirmado?: string
  ) => {
    if (!firebaseUser) {
      throw new Error('Faça login ou crie sua conta antes de aceitar o convite.');
    }
    if (!isEmailVerified && !firebaseUser.emailVerified) {
      throw new Error('Confirme seu endereço de e-mail antes de aceitar o convite.');
    }

    const userEmail = (firebaseUser.email || '').trim().toLowerCase();
    const submittedHash = await hashInviteTokenSha256(rawToken);
    const now = new Date().toISOString();

    const snap = await getDoc(doc(db, 'convites', conviteId));
    if (!snap.exists()) {
      throw new Error('Convite não encontrado.');
    }

    const convite: ConviteUsuario = {
      id: snap.id,
      ...(snap.data() as Omit<ConviteUsuario, 'id'>),
    };

    if (convite.status !== 'pendente') {
      throw new Error(`Este convite já foi ${convite.status} e não pode ser reutilizado.`);
    }
    if (isInviteExpired(convite.expiraEmMillis)) {
      throw new Error('Este convite expirou. Solicite um novo convite ao Administrador da Rede.');
    }
    if (convite.email.trim().toLowerCase() !== userEmail) {
      throw new Error(
        `Este convite foi enviado exclusivamente para ${convite.email}. Você está autenticado como ${userEmail}.`
      );
    }
    if (submittedHash !== convite.tokenHash) {
      throw new Error(
        'Código/token de convite inválido. Verifique o código de uso único fornecido pelo Administrador.'
      );
    }

    const finalNome = (nomeConfirmado || firebaseUser.displayName || convite.nome).trim();
    const newMemberDoc: Omit<UsuarioRede, 'id'> = {
      uid: firebaseUser.uid,
      redeId: convite.redeId,
      nome: finalNome,
      email: userEmail,
      perfil: convite.perfil,
      poloIds: convite.poloIds,
      ativo: true,
      conviteId: convite.id,
      criadoEm: now,
      atualizadoEm: now,
    };

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'convites', convite.id), {
        status: 'aceito',
        aceitoPorUid: firebaseUser.uid,
        aceitoEm: now,
        aceitoTokenHash: submittedHash,
        atualizadoEm: now,
      });
      batch.set(doc(db, 'redes', convite.redeId, 'usuarios', firebaseUser.uid), newMemberDoc);
      batch.set(doc(db, 'userRedes', firebaseUser.uid), {
        uid: firebaseUser.uid,
        redeId: convite.redeId,
        email: userEmail,
        perfil: convite.perfil,
        atualizadoEm: now,
      });
      await batch.commit();

      const redeSnap = await getDoc(doc(db, 'redes', convite.redeId));
      const fullMember: UsuarioRede = { id: firebaseUser.uid, ...newMemberDoc };
      setOwnMemberProfile(fullMember);
      setUsuarios([fullMember]);
      if (redeSnap.exists()) {
        setRede({ id: redeSnap.id, ...(redeSnap.data() as Omit<Rede, 'id'>) });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `convites/${convite.id}`);
    }
  };

  const loadDemoDataForRede = async (
    targetRedeId: string,
    adminUid: string,
    currentCategorias: Categoria[]
  ) => {
    const demo = buildDemoDataset(targetRedeId, adminUid, selectedMonth, currentCategorias);

    if (isLocalWorkspace) {
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

    // In production Firestore, never insert fake demo users into `usuarios` (keeps `usuarios` 100% bound to real Firebase Auth UIDs)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const operations: Array<{ col: string; id: string; data: any }> = [];
      demo.polos.forEach(({ id, ...data }) => operations.push({ col: 'polos', id, data }));
      if (currentCategorias.length < 11) {
        demo.categorias.forEach(({ id, ...data }) =>
          operations.push({ col: 'categorias', id, data })
        );
      }
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
    if (isLocalWorkspace) {
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

  // Updates an EXISTING registered user's RBAC profile/polos/active status.
  // Never creates arbitrary fake user records without an authenticated UID.
  const saveUsuario = async (
    payload: Omit<UsuarioRede, 'id' | 'uid' | 'redeId' | 'criadoEm' | 'atualizadoEm'>,
    id?: string
  ) => {
    if (!rede) return;
    if (!id) {
      throw new Error(
        'Para adicionar um novo usuário, utilize o fluxo de Convite Seguro por E-mail.'
      );
    }
    const existing = usuarios.find((u) => u.id === id || u.uid === id);
    if (!existing) {
      throw new Error('Usuário não encontrado na rede.');
    }

    const now = new Date().toISOString();
    const record: UsuarioRede = {
      ...existing,
      nome: payload.nome.trim(),
      perfil: payload.perfil,
      poloIds: payload.poloIds,
      ativo: payload.ativo,
      atualizadoEm: now,
    };

    if (isLocalWorkspace) {
      setUsuarios((prev) => prev.map((u) => (u.id === existing.id ? record : u)));
    } else {
      try {
        await updateDoc(doc(db, 'redes', rede.id, 'usuarios', existing.uid), {
          nome: record.nome,
          perfil: record.perfil,
          poloIds: record.poloIds,
          ativo: record.ativo,
          atualizadoEm: now,
        });
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `redes/${rede.id}/usuarios/${existing.uid}`
        );
      }
    }

    await recordAudit({
      redeId: rede.id,
      entidade: 'Usuario',
      entidadeId: existing.uid,
      acao: 'editar',
      resumo: `Atualizado usuário ${record.nome} (${record.perfil}, Ativo: ${record.ativo ? 'Sim' : 'Não'})`,
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
    if (!currentUserProfile) throw new Error('Perfil de usuário não autorizado.');
    const now = new Date().toISOString();
    const existing = existingId ? lancamentos.find((l) => l.id === existingId) : undefined;
    const lancId = existingId || generateId('lanc');
    const uid = isLocalWorkspace ? currentUserProfile.uid : firebaseUser!.uid;

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
      responsavelUid:
        payload.responsavelUid || currentUserProfile?.uid || firebaseUser?.uid || 'admin',
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
        isEmailVerified,
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
        convites,
        myPendingInvites,
        lastIssuedInviteTokens,
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
        resendVerificationEmail,
        refreshEmailVerification,
        enterInteractiveWorkspace,
        logout,
        completeOnboarding,
        createInvite,
        cancelInvite,
        acceptInvite,
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
