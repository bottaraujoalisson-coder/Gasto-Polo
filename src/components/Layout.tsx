import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  AlertTriangle,
  Megaphone,
  FileText,
  Settings,
  Sun,
  Moon,
  LogOut,
  Database,
  Trash2,
  ShieldCheck,
  Building2,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatBRL,
  formatMonthBR,
  getLastNMonths,
  getLancamentoValorNoPolo,
  roundCents,
} from '../utils/financeRules';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    rede,
    currentUserProfile,
    usuarios,
    activePersonaId,
    setActivePersonaId,
    visiblePolos,
    selectedMonth,
    setSelectedMonth,
    selectedPoloId,
    setSelectedPoloId,
    darkMode,
    toggleDarkMode,
    canManageNetwork,
    hasDemoData,
    loadDemoData,
    removeDemoData,
    logout,
    alertas,
    lancamentos,
    orcamentos,
    categorias,
  } = useApp();

  const location = useLocation();
  const navigate = useNavigate();
  const [confirmRemoveDemo, setConfirmRemoveDemo] = useState(false);
  const [busyDemo, setBusyDemo] = useState(false);

  const availableMonths = getLastNMonths('2026-12', 14).reverse();

  // Compute budget threshold crossing alerts (80% and 100%) for the current month & polo
  const budgetCrossings = React.useMemo(() => {
    if (!rede) return { over100: 0, over80: 0 };
    let over100 = 0;
    let over80 = 0;
    const activeCats = categorias.filter((c) => c.ativa);
    for (const cat of activeCats) {
      const teto = roundCents(
        orcamentos
          .filter(
            (o) =>
              o.mes === selectedMonth &&
              o.categoriaId === cat.id &&
              (selectedPoloId === 'ALL' || o.poloId === selectedPoloId)
          )
          .reduce((acc, o) => acc + o.teto, 0)
      );
      if (teto <= 0) continue;
      const gasto = roundCents(
        lancamentos
          .filter(
            (l) =>
              !l.excluido &&
              l.status === 'aprovado' &&
              l.competencia === selectedMonth &&
              l.categoriaId === cat.id
          )
          .reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
      );
      const pct = (gasto / teto) * 100;
      if (pct > rede.config.alerta2Pct) over100 += 1;
      else if (pct >= rede.config.alerta1Pct) over80 += 1;
    }
    return { over100, over80 };
  }, [rede, categorias, orcamentos, lancamentos, selectedMonth, selectedPoloId]);

  const pendingCount = React.useMemo(() => {
    return lancamentos.filter(
      (l) =>
        !l.excluido &&
        l.status === 'pendente' &&
        (selectedPoloId === 'ALL' || l.poloId === selectedPoloId)
    ).length;
  }, [lancamentos, selectedPoloId]);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    {
      to: '/lancamentos',
      label: 'Lançamentos',
      icon: Receipt,
      count: pendingCount > 0 ? pendingCount : undefined,
    },
    { to: '/orcamento', label: 'Orçamento', icon: PieChart },
    {
      to: '/desperdicios',
      label: 'Desperdícios',
      icon: AlertTriangle,
      count: alertas.length > 0 ? alertas.length : undefined,
    },
    { to: '/marketing', label: 'Marketing', icon: Megaphone },
    { to: '/relatorio', label: 'Relatório PDF', icon: FileText },
    { to: '/configuracoes', label: 'Configurações', icon: Settings },
  ];

  const currentPageTitle =
    navItems.find((item) => item.to === location.pathname)?.label || 'Visão Geral';

  const handleLoadDemo = async () => {
    setBusyDemo(true);
    try {
      await loadDemoData();
    } finally {
      setBusyDemo(false);
    }
  };

  const handleRemoveDemo = async () => {
    setBusyDemo(true);
    try {
      await removeDemoData();
      setConfirmRemoveDemo(false);
    } finally {
      setBusyDemo(false);
    }
  };

  if (currentUserProfile && !currentUserProfile.ativo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Acesso Revogado (Usuário Inativo)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sua conta ({currentUserProfile.email}) está marcada como inativa na rede{' '}
            <strong>{rede?.nome}</strong>. Contate o Administrador da Rede ou alterne o perfil de
            teste abaixo.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            {usuarios.length > 1 && (
              <button
                type="button"
                onClick={() => setActivePersonaId(null)}
                className="w-full py-2 px-4 text-sm font-medium text-white bg-slate-900 dark:bg-emerald-600 rounded-lg"
              >
                Voltar ao Perfil Admin da Rede
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="w-full py-2 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            GastoPolo
          </span>
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Network & Active Profile summary */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 space-y-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            Rede: <strong className="text-slate-800 dark:text-slate-200">{rede?.nome}</strong>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Perfil ativo:{' '}
            <strong className="text-slate-900 dark:text-emerald-400 uppercase">
              {currentUserProfile?.perfil}
            </strong>{' '}
            · {currentUserProfile?.nome.split(' ')[0]}
          </div>

          {/* RBAC Profile Simulator so Admin/Evaluator can verify strict Polo Isolation */}
          {usuarios.length > 1 && (
            <div className="pt-1">
              <label
                htmlFor="rbac-persona-select"
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                Testar Isolamento RBAC (Perfil):
              </label>
              <select
                id="rbac-persona-select"
                aria-label="Testar Isolamento RBAC"
                value={currentUserProfile?.id || ''}
                onChange={(e) => setActivePersonaId(e.target.value)}
                className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-slate-800 dark:text-slate-200"
              >
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.perfil.toUpperCase()} — {u.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Menu principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </span>
                {item.count !== undefined && (
                  <span className="text-xs font-mono tabular-nums opacity-90">({item.count})</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Demo Data Controls & Logout */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {canManageNetwork && (
            <div>
              {!hasDemoData ? (
                <button
                  type="button"
                  disabled={busyDemo}
                  onClick={handleLoadDemo}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  <Database className="w-3.5 h-3.5 shrink-0" />
                  {busyDemo ? 'Carregando...' : 'Carregar dados de exemplo'}
                </button>
              ) : !confirmRemoveDemo ? (
                <button
                  type="button"
                  onClick={() => setConfirmRemoveDemo(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  Remover dados de exemplo
                </button>
              ) : (
                <div className="p-2 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg space-y-2">
                  <p className="text-[11px] text-red-700 dark:text-red-300">
                    Remover os 3 polos e 6 meses de dados demo?
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busyDemo}
                      onClick={handleRemoveDemo}
                      className="flex-1 py-1 px-2 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveDemo(false)}
                      className="flex-1 py-1 px-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            Sair / Trocar Rede
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 md:pl-64 flex flex-col min-h-screen pb-16 md:pb-0">
        {/* Top Bar Contract: Breadcrumb on Left, Global Polo/Month Filters & Primary Action on Right */}
        <header className="no-print sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">{rede?.nome}</span>
            <span aria-hidden="true" className="text-slate-400">
              /
            </span>
            <h1 className="font-semibold text-slate-900 dark:text-white">{currentPageTitle}</h1>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* Global Polo Selector */}
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                aria-label="Filtrar por Polo"
                value={selectedPoloId}
                onChange={(e) => setSelectedPoloId(e.target.value)}
                className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
              >
                {visiblePolos.length > 1 && (
                  <option value="ALL">
                    Todos os Polos ({visiblePolos.length})
                  </option>
                )}
                {visiblePolos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Global Competence Month Selector */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                aria-label="Filtrar por Mês de Competência"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthBR(m)} ({m})
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile Theme Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Tema claro' : 'Tema escuro'}
              className="md:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Budget Threshold Crossing Banner (80% and 100% in-app alert) */}
        {(budgetCrossings.over100 > 0 || budgetCrossings.over80 > 0) && (
          <div
            role="status"
            className={`no-print px-4 md:px-8 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b ${
              budgetCrossings.over100 > 0
                ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
                : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Alerta Orçamentário ({formatMonthBR(selectedMonth)}):</strong>{' '}
                {budgetCrossings.over100 > 0 && (
                  <span>
                    {budgetCrossings.over100} categoria(s) ultrapassaram{' '}
                    <strong>{rede?.config.alerta2Pct}% do teto mensal</strong>.{' '}
                  </span>
                )}
                {budgetCrossings.over80 > 0 && (
                  <span>
                    {budgetCrossings.over80} categoria(s) estão na faixa de atenção ({rede?.config.alerta1Pct}% a{' '}
                    {rede?.config.alerta2Pct}%).
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/orcamento')}
                className="font-semibold underline hover:opacity-80 whitespace-nowrap"
              >
                Ver Tetos
              </button>
              <button
                type="button"
                onClick={() => navigate('/desperdicios')}
                className="font-semibold underline hover:opacity-80 whitespace-nowrap"
              >
                Criar Plano de Ação
              </button>
            </div>
          </div>
        )}

        {/* Active RBAC Isolation Indicator when testing non-admin roles */}
        {currentUserProfile && currentUserProfile.perfil !== 'admin' && (
          <div className="no-print px-4 md:px-8 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Isolamento RBAC Ativo: Visualizando como{' '}
                <strong>{currentUserProfile.nome}</strong> (Perfil:{' '}
                <strong className="uppercase">{currentUserProfile.perfil}</strong> · Polos
                autorizados: <strong>{visiblePolos.map((p) => p.nome).join(', ')}</strong>). Dados
                de outros polos estão bloqueados.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActivePersonaId(null)}
              className="text-xs font-semibold text-slate-900 dark:text-emerald-400 underline whitespace-nowrap"
            >
              Restaurar visão Admin
            </button>
          </div>
        )}

        {/* Page Body */}
        <main className="flex-1 px-4 md:px-8 py-6 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navegação móvel"
        className="no-print md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-30 flex items-center justify-around py-1.5 px-1"
      >
        {navItems.slice(0, 6).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[11px] font-medium ${
                  isActive
                    ? 'text-slate-900 dark:text-emerald-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate max-w-[60px]">{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
