import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Erro inesperado na aplicação.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let parsedError: Record<string, unknown> | null = null;
      try {
        parsedError = JSON.parse(this.state.errorMessage);
      } catch {
        parsedError = null;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold">Erro de Permissão ou Operação</h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              A operação foi bloqueada pelas regras de segurança ou ocorreu uma falha inesperada.
            </p>
            {parsedError ? (
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono space-y-1 overflow-x-auto text-slate-700 dark:text-slate-200">
                <div>Operação: {String(parsedError.operationType || '')}</div>
                <div>Caminho: {String(parsedError.path || '')}</div>
                <div>Detalhe: {String(parsedError.error || '')}</div>
              </div>
            ) : (
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-200">
                {this.state.errorMessage}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-emerald-600 rounded-lg hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
