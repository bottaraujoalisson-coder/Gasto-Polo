import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Building2,
  FileText,
  Users,
  Sun,
  Moon,
  LogOut,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatMonthBR,
  getCurrentMonthSaoPaulo,
  getNextMonth,
  getPreviousMonth,
  getSelectableMonths,
} from '../utils/financeRules';

const UNIMAR_LOGO_PATH = '/assets/aistudio/logo__2__b3705f1f.png';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    firebaseUser,
    rede,
    currentUserProfile,
    visiblePolos,
    selectedMonth,
    setSelectedMonth,
    selectedPoloId,
    setSelectedPoloId,
    darkMode,
    toggleDarkMode,
    logout,
  } = useApp();

  const location = useLocation();

  const availableMonths = React.useMemo(
    () => getSelectableMonths(getCurrentMonthSaoPaulo(), selectedMonth),
    [selectedMonth]
  );

  const navItems = [
    { to: '/', label: 'Painel Geral', icon: LayoutDashboard },
    { to: '/lancamentos', label: 'Lançamentos', icon: Receipt },
    { to: '/polos', label: 'Polos', icon: Building2 },
    { to: '/relatorios', label: 'Relatórios', icon: FileText },
    { to: '/usuarios', label: 'Usuários e Permissões', icon: Users },
  ];

  const currentPageTitle =
    navItems.find((item) => item.to === location.pathname)?.label || 'Painel Geral';

  if (!currentUserProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#04162E] p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Acesso Não Vinculado ({firebaseUser?.email || 'Usuário'})
          </h1>
          <button
            type="button"
            onClick={logout}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#002855] hover:bg-[#003875] rounded-lg cursor-pointer"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  if (!currentUserProfile.ativo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#04162E] p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Acesso Inativo ({currentUserProfile.email})
          </h1>
          <button
            type="button"
            onClick={logout}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#002855] hover:bg-[#003875] rounded-lg cursor-pointer"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const perfilLabel =
    currentUserProfile.perfil === 'admin'
      ? 'Administrador'
      : currentUserProfile.perfil === 'gestor'
      ? 'Gestor'
      : 'Operador';

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar — Unimar Institutional Brand Identity */}
      <aside className="no-print hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-[#002855] text-white border-r border-[#003875] z-30">
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <img
            src={UNIMAR_LOGO_PATH}
            alt="Unimar"
            referrerPolicy="no-referrer"
            className="h-8 w-auto object-contain"
          />
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={darkMode ? 'Tema claro' : 'Tema escuro'}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Company & User Summary (Unboxed clean metadata) */}
        <div className="px-6 py-4 border-b border-white/10 space-y-1">
          <div className="text-xs font-semibold text-white truncate">{rede?.nome || 'Unimar'}</div>
          <div className="text-xs text-blue-200 truncate">
            {currentUserProfile.nome} · {perfilLabel}
          </div>
        </div>

        {/* 5 Core Navigation Modules */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Menu principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#004B8D] text-white font-semibold'
                      : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-100/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 md:pl-64 flex flex-col min-h-screen pb-16 md:pb-0">
        {/* Top Header */}
        <header className="no-print sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile Unimar Logo Badge */}
            <div className="md:hidden bg-[#002855] px-2.5 py-1.5 rounded-md flex items-center">
              <img
                src={UNIMAR_LOGO_PATH}
                alt="Unimar"
                referrerPolicy="no-referrer"
                className="h-4 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                {rede?.nome || 'Unimar'}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700 hidden sm:inline">
                /
              </span>
              <h1 className="font-semibold text-slate-900 dark:text-white">{currentPageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Global Polo Selector */}
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                aria-label="Filtrar por Polo"
                value={selectedPoloId}
                onChange={(e) => setSelectedPoloId(e.target.value)}
                className="text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
              >
                {(currentUserProfile.perfil === 'admin' || visiblePolos.length > 1) && (
                  <option value="ALL">
                    Todos os Polos ({visiblePolos.filter((p) => p.ativo).length})
                  </option>
                )}
                {visiblePolos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} {!p.ativo ? '(Inativo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Global Period Selector */}
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-0.5" />
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => setSelectedMonth(getPreviousMonth(selectedMonth))}
                className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <select
                aria-label="Filtrar por Período"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthBR(m)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => setSelectedMonth(getNextMonth(selectedMonth))}
                className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile Theme Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Tema claro' : 'Tema escuro'}
              className="md:hidden p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 px-4 md:px-8 py-6 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navegação móvel"
        className="no-print md:hidden fixed bottom-0 inset-x-0 bg-[#002855] text-white border-t border-[#003875] z-30 flex items-center justify-around py-1.5 px-1"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[11px] font-medium ${
                  isActive ? 'text-white font-semibold bg-[#004B8D]' : 'text-blue-200/80'
                }`
              }
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate max-w-[68px]">{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
