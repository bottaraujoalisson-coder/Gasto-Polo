import React, { useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  Database,
  FolderKanban,
  History,
  KeyRound,
  Package,
  Plus,
  Settings,
  Shield,
  Truck,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PerfilUsuario, TipoCategoria } from '../types';
import { formatDateBR, formatNumberBR, isInviteExpired } from '../utils/financeRules';

type ConfigTab =
  | 'rede'
  | 'polos'
  | 'usuarios'
  | 'categorias'
  | 'fornecedores'
  | 'itens'
  | 'auditoria';

export const ConfiguracoesPage: React.FC = () => {
  const {
    isLocalWorkspace,
    rede,
    allPolos,
    usuarios,
    convites,
    lastIssuedInviteTokens,
    categorias,
    fornecedores,
    itens,
    auditoria,
    canManageNetwork,
    hasDemoData,
    loadDemoData,
    removeDemoData,
    updateRedeSettings,
    savePolo,
    saveUsuario,
    createInvite,
    cancelInvite,
    saveCategoria,
    saveFornecedor,
    saveItemCatalogo,
    setActivePersonaId,
  } = useApp();

  const [activeTab, setActiveTab] = useState<ConfigTab>('rede');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [latestIssuedInviteInfo, setLatestIssuedInviteInfo] = useState<{
    id: string;
    email: string;
    rawToken: string;
  } | null>(null);

  // Rede Form
  const [nomeRede, setNomeRede] = useState(rede?.nome || '');
  const [limiteAprovacao, setLimiteAprovacao] = useState(rede?.config.limiteAprovacao ?? 500);
  const [alerta1Pct, setAlerta1Pct] = useState(rede?.config.alerta1Pct ?? 80);
  const [alerta2Pct, setAlerta2Pct] = useState(rede?.config.alerta2Pct ?? 100);
  const [maxDiversasPct, setMaxDiversasPct] = useState(rede?.config.maxDiversasPct ?? 5);
  const [rotuloTamanho, setRotuloTamanho] = useState(
    rede?.config.rotuloTamanho || 'Alunos ativos'
  );

  // Polo Form
  const [poloNome, setPoloNome] = useState('');
  const [poloCidade, setPoloCidade] = useState('');
  const [poloIndicador, setPoloIndicador] = useState(350);

  // Invite Form
  const [usrNome, setUsrNome] = useState('');
  const [usrEmail, setUsrEmail] = useState('');
  const [usrPerfil, setUsrPerfil] = useState<PerfilUsuario>('operador');
  const [usrPoloIds, setUsrPoloIds] = useState<string[]>(
    allPolos[0]?.id ? [allPolos[0].id] : []
  );

  // Categoria Form
  const [catNome, setCatNome] = useState('');
  const [catTipo, setCatTipo] = useState<TipoCategoria>('interno');

  // Fornecedor Form
  const [fornNome, setFornNome] = useState('');
  const [fornContato, setFornContato] = useState('');

  // Item Catalogo Form
  const [itemNome, setItemNome] = useState('');
  const [itemUnidade, setItemUnidade] = useState('un');
  const [itemCatId, setItemCatId] = useState(categorias[0]?.id || '');
  const [itemEstoqueMin, setItemEstoqueMin] = useState(5);

  const showNotice = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 4000);
  };

  const handleSaveRede = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateRedeSettings(nomeRede, {
      limiteAprovacao: Number(limiteAprovacao),
      alerta1Pct: Number(alerta1Pct),
      alerta2Pct: Number(alerta2Pct),
      maxDiversasPct: Number(maxDiversasPct),
      rotuloTamanho: rotuloTamanho.trim() || 'Alunos ativos',
    });
    showNotice('Parâmetros da Rede atualizados com sucesso.');
  };

  const handleCreatePolo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poloNome.trim() || !poloCidade.trim()) return;
    await savePolo({
      nome: poloNome.trim(),
      cidade: poloCidade.trim(),
      indicadorTamanho: Number(poloIndicador) || 100,
      ativo: true,
    });
    setPoloNome('');
    setPoloCidade('');
    setPoloIndicador(350);
    showNotice('Novo polo cadastrado com sucesso.');
  };

  const handleCreateUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usrNome.trim() || !usrEmail.trim()) return;
    const assignedPolos =
      usrPerfil === 'admin'
        ? allPolos.map((p) => p.id)
        : usrPoloIds.length > 0
        ? usrPoloIds
        : allPolos[0]?.id
        ? [allPolos[0].id]
        : [];
    const { convite, rawToken } = await createInvite({
      nome: usrNome.trim(),
      email: usrEmail.trim().toLowerCase(),
      perfil: usrPerfil,
      poloIds: assignedPolos,
      diasValidade: 7,
    });
    setLatestIssuedInviteInfo({
      id: convite.id,
      email: convite.email,
      rawToken,
    });
    setUsrNome('');
    setUsrEmail('');
    showNotice(
      'Convite seguro emitido com hash SHA-256 e expiração de 7 dias. Compartilhe o token de uso único com o convidado.'
    );
  };

  const handleCreateCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNome.trim()) return;
    await saveCategoria({
      nome: catNome.trim(),
      tipo: catTipo,
      ativa: true,
    });
    setCatNome('');
    showNotice('Categoria cadastrada com sucesso.');
  };

  const handleCreateFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornNome.trim()) return;
    await saveFornecedor({
      nome: fornNome.trim(),
      contato: fornContato.trim(),
    });
    setFornNome('');
    setFornContato('');
    showNotice('Fornecedor cadastrado com sucesso.');
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemNome.trim()) return;
    await saveItemCatalogo({
      nome: itemNome.trim(),
      unidade: itemUnidade.trim() || 'un',
      categoriaId: itemCatId || categorias[0]?.id || '',
      estoqueMinimo: Number(itemEstoqueMin) || 0,
    });
    setItemNome('');
    showNotice('Item adicionado ao catálogo com estoque mínimo.');
  };

  const tabs: Array<{ id: ConfigTab; label: string; icon: React.ElementType }> = [
    { id: 'rede', label: 'Rede & Limites', icon: Settings },
    { id: 'polos', label: `Polos (${allPolos.length})`, icon: Building2 },
    {
      id: 'usuarios',
      label: `Usuários (${usuarios.length}) & Convites (${convites.length})`,
      icon: Users,
    },
    { id: 'categorias', label: `Categorias (${categorias.length})`, icon: FolderKanban },
    { id: 'fornecedores', label: `Fornecedores (${fornecedores.length})`, icon: Truck },
    { id: 'itens', label: `Catálogo de Itens (${itens.length})`, icon: Package },
    { id: 'auditoria', label: `Auditoria (${auditoria.length})`, icon: History },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Configurações da Rede, Cadastros e Governança
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Gerencie polos, usuários, categorias, catálogo de itens com estoque mínimo, limites de
          aprovação e trilha de auditoria.
        </p>
      </div>

      {savedNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-200">
          {savedNotice}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'bg-slate-900 text-white dark:bg-emerald-600'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Rede & Limites */}
      {activeTab === 'rede' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveRede}
            className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Parâmetros Gerais e Limites de Alerta
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="cfg-nome-rede"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nome da Rede
                </label>
                <input
                  id="cfg-nome-rede"
                  type="text"
                  disabled={!canManageNetwork}
                  value={nomeRede}
                  onChange={(e) => setNomeRede(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-rotulo"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Rótulo do Indicador de Tamanho
                </label>
                <input
                  id="cfg-rotulo"
                  type="text"
                  disabled={!canManageNetwork}
                  value={rotuloTamanho}
                  onChange={(e) => setRotuloTamanho(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-limite"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Limite p/ Aprovação Automática (R$)
                </label>
                <input
                  id="cfg-limite"
                  type="number"
                  min="0"
                  step="50"
                  disabled={!canManageNetwork}
                  value={limiteAprovacao}
                  onChange={(e) => setLimiteAprovacao(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-diversas"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Teto Máximo de Despesas Diversas (% do Polo)
                </label>
                <input
                  id="cfg-diversas"
                  type="number"
                  min="1"
                  max="50"
                  disabled={!canManageNetwork}
                  value={maxDiversasPct}
                  onChange={(e) => setMaxDiversasPct(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-alerta1"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Faixa Amarela do Semáforo (% do Teto)
                </label>
                <input
                  id="cfg-alerta1"
                  type="number"
                  min="10"
                  max="100"
                  disabled={!canManageNetwork}
                  value={alerta1Pct}
                  onChange={(e) => setAlerta1Pct(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-alerta2"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Faixa Vermelha / Teto Estourado (% do Teto)
                </label>
                <input
                  id="cfg-alerta2"
                  type="number"
                  min="50"
                  max="200"
                  disabled={!canManageNetwork}
                  value={alerta2Pct}
                  onChange={(e) => setAlerta2Pct(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            {canManageNetwork && (
              <div className="pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg hover:opacity-90"
                >
                  <Check className="w-4 h-4" />
                  Salvar Parâmetros da Rede
                </button>
              </div>
            )}
          </form>

          {/* Demo Dataset Card */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Dados de Demonstração</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Carregue 3 polos realistas (Centro, Campinas, Santos) e 6 meses de lançamentos,
              orçamentos, campanhas e alertas. Todos os registros são marcados com{' '}
              <code>demo: true</code> e podem ser removidos com um clique.
            </p>
            {canManageNetwork && (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    await loadDemoData();
                    showNotice('Dados de exemplo carregados com sucesso (3 polos e 6 meses).');
                  }}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  Carregar dados de exemplo
                </button>
                {hasDemoData && (
                  <button
                    type="button"
                    onClick={async () => {
                      await removeDemoData();
                      showNotice('Todos os dados de demonstração foram removidos.');
                    }}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 rounded-lg"
                  >
                    Remover dados de exemplo (1 clique)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Polos */}
      {activeTab === 'polos' && (
        <div className="space-y-6">
          {canManageNetwork && (
            <form
              onSubmit={handleCreatePolo}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <div>
                <label
                  htmlFor="new-polo-nome"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nome do Polo *
                </label>
                <input
                  id="new-polo-nome"
                  type="text"
                  required
                  placeholder="Ex: Polo Ribeirão Preto"
                  value={poloNome}
                  onChange={(e) => setPoloNome(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="new-polo-cidade"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Cidade / UF *
                </label>
                <input
                  id="new-polo-cidade"
                  type="text"
                  required
                  placeholder="Ex: Ribeirão Preto / SP"
                  value={poloCidade}
                  onChange={(e) => setPoloCidade(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="new-polo-ind"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  {rede?.config.rotuloTamanho || 'Alunos ativos'} *
                </label>
                <input
                  id="new-polo-ind"
                  type="number"
                  min="1"
                  required
                  value={poloIndicador}
                  onChange={(e) => setPoloIndicador(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Polo
              </button>
            </form>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500">
                  <th className="py-3 px-4 font-medium">Nome do Polo</th>
                  <th className="py-3 px-3 font-medium">Cidade</th>
                  <th className="py-3 px-3 font-medium text-right">
                    {rede?.config.rotuloTamanho || 'Alunos ativos'}
                  </th>
                  <th className="py-3 px-3 font-medium">Situação</th>
                  <th className="py-3 px-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {allPolos.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {p.nome}
                    </td>
                    <td className="py-3 px-3">{p.cidade}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatNumberBR(p.indicadorTamanho)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={
                          p.ativo ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'
                        }
                      >
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canManageNetwork && (
                        <button
                          type="button"
                          onClick={() =>
                            savePolo(
                              {
                                nome: p.nome,
                                cidade: p.cidade,
                                indicadorTamanho: p.indicadorTamanho,
                                ativo: !p.ativo,
                              },
                              p.id
                            )
                          }
                          className="text-xs font-medium text-slate-600 dark:text-slate-300 underline"
                        >
                          {p.ativo ? 'Inativar' : 'Reativar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Usuários & Perfis RBAC */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6">
          {canManageNetwork && (
            <form
              onSubmit={handleCreateUsuario}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Emitir Convite Seguro para Novo Usuário
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    O usuário só será criado em <code className="font-mono">usuarios/&#123;uid&#125;</code> após autenticar-se, confirmar o e-mail e validar o token único (SHA-256).
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <KeyRound className="w-3.5 h-3.5" />
                  Validade: 7 dias · Uso único
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="usr-nome"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Nome do Convidado *
                  </label>
                  <input
                    id="usr-nome"
                    type="text"
                    required
                    value={usrNome}
                    onChange={(e) => setUsrNome(e.target.value)}
                    placeholder="Ex: Juliana Mendes"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="usr-email"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    E-mail Corporativo *
                  </label>
                  <input
                    id="usr-email"
                    type="email"
                    required
                    value={usrEmail}
                    onChange={(e) => setUsrEmail(e.target.value)}
                    placeholder="juliana@rede.com.br"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="usr-perfil"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Perfil de Acesso *
                  </label>
                  <select
                    id="usr-perfil"
                    value={usrPerfil}
                    onChange={(e) => setUsrPerfil(e.target.value as PerfilUsuario)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="operador">
                      Operador (cria e edita próprios pendentes no seu polo)
                    </option>
                    <option value="gestor">
                      Gestor do Polo (vê seus polos e aprova pendentes)
                    </option>
                    <option value="leitor">Leitor (apenas consulta)</option>
                    <option value="admin">Admin da Rede (acesso total)</option>
                  </select>
                </div>
              </div>

              {usrPerfil !== 'admin' && (
                <div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Polos Autorizados para este Convite:
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {allPolos.map((p) => (
                      <label
                        key={p.id}
                        className="inline-flex items-center gap-1.5 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={usrPoloIds.includes(p.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setUsrPoloIds((prev) =>
                              checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                            );
                          }}
                          className="rounded border-slate-300"
                        />
                        <span>{p.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Emitir Convite Seguro
              </button>

              {latestIssuedInviteInfo && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Convite emitido para {latestIssuedInviteInfo.email}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                      ID: {latestIssuedInviteInfo.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    Por segurança, apenas o hash SHA-256 foi salvo no banco. Copie o token ou link de uso único abaixo e envie ao usuário convidado:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <div className="truncate">
                        <div className="text-[10px] uppercase text-slate-400 font-semibold">
                          Token de Uso Único
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate">
                          {latestIssuedInviteInfo.rawToken}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(latestIssuedInviteInfo.rawToken);
                          showNotice('Token do convite copiado para a área de transferência.');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded-md shrink-0"
                      >
                        <Copy className="w-3 h-3" />
                        Copiar Token
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <div className="truncate">
                        <div className="text-[10px] uppercase text-slate-400 font-semibold">
                          Link Direto de Aceite
                        </div>
                        <div className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                          {`${window.location.origin}/?inviteId=${encodeURIComponent(
                            latestIssuedInviteInfo.id
                          )}&token=${encodeURIComponent(latestIssuedInviteInfo.rawToken)}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const link = `${window.location.origin}/?inviteId=${encodeURIComponent(
                            latestIssuedInviteInfo.id
                          )}&token=${encodeURIComponent(latestIssuedInviteInfo.rawToken)}`;
                          navigator.clipboard?.writeText(link);
                          showNotice('Link de aceite copiado para a área de transferência.');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-900 dark:bg-slate-700 text-white rounded-md shrink-0"
                      >
                        <Copy className="w-3 h-3" />
                        Copiar Link
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* Tabela 1: Usuários Efetivamente Cadastrados (com UID Real) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Usuários Efetivamente Vinculados à Rede ({usuarios.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Membros com identidade autenticada (<code className="font-mono">uid</code>) e vínculo ativo ou inativo.
                </p>
              </div>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500">
                  <th className="py-3 px-4 font-medium">Usuário & UID</th>
                  <th className="py-3 px-3 font-medium">Perfil</th>
                  <th className="py-3 px-3 font-medium">Polos Vinculados</th>
                  <th className="py-3 px-3 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{u.nome}</div>
                      <div className="text-[11px] text-slate-500">{u.email}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        UID: {u.uid}
                      </div>
                    </td>
                    <td className="py-3 px-3 uppercase font-semibold">{u.perfil}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {u.perfil === 'admin'
                        ? 'Todos os Polos da Rede'
                        : u.poloIds
                            .map((pid) => allPolos.find((p) => p.id === pid)?.nome || pid)
                            .join(', ')}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={
                          u.ativo
                            ? 'text-emerald-600 font-semibold'
                            : 'text-red-600 font-semibold'
                        }
                      >
                        {u.ativo ? 'Ativo' : 'Inativo (Acesso Bloqueado)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                      {isLocalWorkspace && (
                        <button
                          type="button"
                          onClick={() => setActivePersonaId(u.id)}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 underline"
                        >
                          Simular Visão (Demo)
                        </button>
                      )}
                      {canManageNetwork && (
                        <button
                          type="button"
                          onClick={() =>
                            saveUsuario(
                              {
                                nome: u.nome,
                                email: u.email,
                                perfil: u.perfil,
                                poloIds: u.poloIds,
                                ativo: !u.ativo,
                              },
                              u.id
                            )
                          }
                          className="text-xs font-medium text-slate-600 dark:text-slate-300 underline"
                        >
                          {u.ativo ? 'Inativar Acesso' : 'Reativar Acesso'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabela 2: Convites Emitidos (Pendentes, Aceitos, Expirados, Cancelados) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Convites de Acesso Emitidos ({convites.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Convites pendentes não concedem acesso até o aceite autenticado com validação do hash SHA-256.
                </p>
              </div>
            </div>
            {convites.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Nenhum convite emitido nesta rede até o momento.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500">
                    <th className="py-3 px-4 font-medium">Convidado</th>
                    <th className="py-3 px-3 font-medium">Perfil & Polos</th>
                    <th className="py-3 px-3 font-medium">Validade</th>
                    <th className="py-3 px-3 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {convites.map((c) => {
                    const expired = c.status === 'pendente' && isInviteExpired(c.expiraEmMillis);
                    const effectiveStatus = expired ? 'expirado' : c.status;
                    const sessionRawToken = lastIssuedInviteTokens[c.id];
                    return (
                      <tr key={c.id}>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {c.nome}
                          </div>
                          <div className="text-[11px] text-slate-500">{c.email}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            ID: {c.id}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="uppercase font-semibold text-slate-800 dark:text-slate-200">
                            {c.perfil}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {c.perfil === 'admin'
                              ? 'Todos os Polos'
                              : c.poloIds
                                  .map((pid) => allPolos.find((p) => p.id === pid)?.nome || pid)
                                  .join(', ')}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          <div>Expira: {formatDateBR(c.expiraEm.slice(0, 10))}</div>
                          {c.aceitoEm && (
                            <div className="text-[10px] text-emerald-600">
                              Aceito em {formatDateBR(c.aceitoEm.slice(0, 10))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                              effectiveStatus === 'aceito'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : effectiveStatus === 'pendente'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            }`}
                          >
                            {effectiveStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                          {sessionRawToken && effectiveStatus === 'pendente' && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(sessionRawToken);
                                showNotice('Token copiado para a área de transferência.');
                              }}
                              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 underline"
                            >
                              Copiar Token
                            </button>
                          )}
                          {canManageNetwork && effectiveStatus === 'pendente' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await cancelInvite(c.id);
                                showNotice('Convite cancelado com sucesso.');
                              }}
                              className="text-xs font-medium text-red-600 dark:text-red-400 underline"
                            >
                              Cancelar Convite
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Categorias */}
      {activeTab === 'categorias' && (
        <div className="space-y-6">
          {canManageNetwork && (
            <form
              onSubmit={handleCreateCategoria}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
            >
              <div>
                <label
                  htmlFor="cat-nome"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nome da Categoria *
                </label>
                <input
                  id="cat-nome"
                  type="text"
                  required
                  value={catNome}
                  onChange={(e) => setCatNome(e.target.value)}
                  placeholder="Ex: Eventos e Feiras Escolares"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="cat-tipo"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Tipo *
                </label>
                <select
                  id="cat-tipo"
                  value={catTipo}
                  onChange={(e) => setCatTipo(e.target.value as TipoCategoria)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="interno">Interno / Operacional</option>
                  <option value="marketing">Marketing / Captação</option>
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Adicionar Categoria
              </button>
            </form>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500">
                  <th className="py-3 px-4 font-medium">Nome da Categoria</th>
                  <th className="py-3 px-3 font-medium">Tipo</th>
                  <th className="py-3 px-3 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {categorias.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {c.nome}
                    </td>
                    <td className="py-3 px-3 uppercase text-slate-500">{c.tipo}</td>
                    <td className="py-3 px-3">
                      <span
                        className={
                          c.ativa ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'
                        }
                      >
                        {c.ativa ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canManageNetwork && (
                        <button
                          type="button"
                          onClick={() =>
                            saveCategoria(
                              {
                                nome: c.nome,
                                tipo: c.tipo,
                                ativa: !c.ativa,
                              },
                              c.id
                            )
                          }
                          className="text-xs font-medium text-slate-600 dark:text-slate-300 underline"
                        >
                          {c.ativa ? 'Inativar' : 'Reativar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Fornecedores */}
      {activeTab === 'fornecedores' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateFornecedor}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
          >
            <div>
              <label
                htmlFor="forn-nome"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Razão Social / Nome Fantasia *
              </label>
              <input
                id="forn-nome"
                type="text"
                required
                value={fornNome}
                onChange={(e) => setFornNome(e.target.value)}
                placeholder="Ex: Papelaria Central"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label
                htmlFor="forn-contato"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Contato (E-mail / Telefone / CNPJ)
              </label>
              <input
                id="forn-contato"
                type="text"
                value={fornContato}
                onChange={(e) => setFornContato(e.target.value)}
                placeholder="contato@fornecedor.com.br · (11) 99999-0000"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Fornecedor
            </button>
          </form>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500">
                  <th className="py-3 px-4 font-medium">Fornecedor</th>
                  <th className="py-3 px-3 font-medium">Dados de Contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {fornecedores.map((f) => (
                  <tr key={f.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {f.nome}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{f.contato}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Catálogo de Itens */}
      {activeTab === 'itens' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateItem}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
          >
            <div className="sm:col-span-2">
              <label
                htmlFor="item-nome"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Nome Padronizado do Item *
              </label>
              <input
                id="item-nome"
                type="text"
                required
                value={itemNome}
                onChange={(e) => setItemNome(e.target.value)}
                placeholder="Ex: Sabonete Líquido Refil 5L"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label
                htmlFor="item-cat"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Categoria Padrão
              </label>
              <select
                id="item-cat"
                value={itemCatId}
                onChange={(e) => setItemCatId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="item-un"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Unid.
                </label>
                <input
                  id="item-un"
                  type="text"
                  value={itemUnidade}
                  onChange={(e) => setItemUnidade(e.target.value)}
                  className="w-full px-2 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="item-est"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Est. Mín.
                </label>
                <input
                  id="item-est"
                  type="number"
                  min="0"
                  value={itemEstoqueMin}
                  onChange={(e) => setItemEstoqueMin(Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Salvar Item
            </button>
          </form>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500">
                  <th className="py-3 px-4 font-medium">Item do Catálogo</th>
                  <th className="py-3 px-3 font-medium">Categoria</th>
                  <th className="py-3 px-3 font-medium">Unidade</th>
                  <th className="py-3 px-4 font-medium text-right">Estoque Mínimo Recomendado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {itens.map((it) => (
                  <tr key={it.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {it.nome}
                    </td>
                    <td className="py-3 px-3">
                      {categorias.find((c) => c.id === it.categoriaId)?.nome || it.categoriaId}
                    </td>
                    <td className="py-3 px-3 font-mono">{it.unidade}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {it.estoqueMinimo} {it.unidade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Auditoria & Regras */}
      {activeTab === 'auditoria' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Trilha Imutável de Auditoria e Segurança Firestore</span>
            </div>
            <p className="text-xs text-slate-500">
              Toda criação, edição, aprovação, rejeição e exclusão lógica gera automaticamente um
              registro de auditoria com estado anterior e posterior.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500">
                  <th className="py-3 px-4 font-medium">Data / Hora</th>
                  <th className="py-3 px-3 font-medium">Entidade</th>
                  <th className="py-3 px-3 font-medium">Ação</th>
                  <th className="py-3 px-3 font-medium">Resumo da Operação</th>
                  <th className="py-3 px-4 font-medium">Autor (UID)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {auditoria.slice(0, 40).map((a) => (
                  <tr key={a.id}>
                    <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                      {new Date(a.em).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-3 font-semibold">{a.entidade}</td>
                    <td className="py-3 px-3 uppercase font-mono text-[11px]">{a.acao}</td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{a.resumo}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{a.uid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
