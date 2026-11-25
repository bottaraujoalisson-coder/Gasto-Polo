import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { AuthAndOnboardingPage } from './pages/AuthAndOnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { LancamentosPage } from './pages/LancamentosPage';
import { PolosPage } from './pages/PolosPage';
import { RelatorioPage } from './pages/RelatorioPage';
import { UsuariosPage } from './pages/UsuariosPage';

const AppRoutes: React.FC = () => {
  const { authLoading, dataLoading, firebaseUser, isEmailVerified, isLocalWorkspace, rede } =
    useApp();

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full space-y-4">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mx-auto" />
          <div className="h-28 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Block unverified email accounts from accessing protected onboarding or network routes
  if (firebaseUser && !isEmailVerified && !isLocalWorkspace) {
    return <AuthAndOnboardingPage />;
  }

  if (!rede) {
    return <AuthAndOnboardingPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/lancamentos" element={<LancamentosPage />} />
        <Route path="/polos" element={<PolosPage />} />
        <Route path="/relatorios" element={<RelatorioPage />} />
        <Route path="/relatorio" element={<Navigate to="/relatorios" replace />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/configuracoes" element={<Navigate to="/usuarios" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
