import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Database,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PerfilUsuario } from '../types';
import { CATEGORIAS_PADRAO } from '../utils/financeRules';

export const AuthAndOnboardingPage: React.FC = () => {
  const {
    firebaseUser,
    isLocalWorkspace,
    rede,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    enterInteractiveWorkspace,
    completeOnboarding,
  } = useApp();

  // Auth form states
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [nomeAuth, setNomeAuth] = useState('');
  const [emailAuth, setEmailAuth] = useState('');
  const [senhaAuth, setSenhaAuth] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Onboarding Wizard states
  const [showWizardOnly, setShowWizardOnly] = useState(false);
  const [nomeRede, setNomeRede] = useState('Rede Educar Brasil');
  const [rotuloTamanho, setRotuloTamanho] = useState('Alunos ativos');
  const [limiteAprovacao, setLimiteAprovacao] = useState(500);
  const [poloNome, setPoloNome] = useState('Polo Centro — Matriz');
  const [poloCidade, setPoloCidade] = useState('São Paulo / SP');
  const [poloIndicador, setPoloIndicador] = useState(580);
  const [carregarDemoNoOnboarding, setCarregarDemoNoOnboarding] = useState(true);
  const [convidados, setConvidados] = useState<
    Array<{ nome: string; email: string; perfil: PerfilUsuario }>
  >([
    {
      nome: 'Mariana Costa',
      email: 'mariana.gestora@rede.com.br',
      perfil: 'gestor',
    },
    {
      nome: 'Lucas Ribeiro',
      email: 'lucas.operador@rede.com.br',
      perfil: 'operador',
    },
  ]);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const needsOnboarding = (Boolean(firebaseUser) || isLocalWorkspace || showWizardOnly) && !rede;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!emailAuth.trim() || !senhaAuth.trim()) {
      setAuthError('Preencha e-mail e senha.');
      return;
    }
    setAuthSubmitting(true);
    try {
      if (authTab === 'login') {
        await loginWithEmail(emailAuth.trim(), senhaAuth);
      } else {
        await registerWithEmail(nomeAuth.trim() || 'Administrador', emailAuth.trim(), senhaAuth);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('operation-not-allowed')) {
        setAuthError(
          'Provedor E-mail/Senha ainda não ativado no Firebase Console (Authentication → Sign-in method → Email/Password). Use o Login com Google ou clique em "Acessar Ambiente com Dados Reais" abaixo.'
        );
      } else {
        setAuthError(`Não foi possível autenticar: ${msg}`);
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(
        `Falha ao abrir popup do Google (${msg}). Você também pode iniciar imediatamente clicando em "Acessar Ambiente com Dados Reais" abaixo.`
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleAddConvidado = () => {
    setConvidados((prev) => [...prev, { nome: '', email: '', perfil: 'operador' }]);
  };

  const handleRemoveConvidado = (idx: number) => {
    setConvidados((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardingError(null);
    if (!nomeRede.trim()) {
      setOnboardingError('Informe o nome da Rede.');
      return;
    }
    if (!poloNome.trim() || !poloCidade.trim()) {
      setOnboardingError('Informe o nome e a cidade do primeiro polo.');
      return;
    }
    setOnboardingSubmitting(true);
    try {
      await completeOnboarding({
        nomeRede,
        rotuloTamanho,
        limiteAprovacao: Number(limiteAprovacao) || 500,
        primeiroPolo: {
          nome: poloNome,
          cidade: poloCidade,
          indicadorTamanho: Number(poloIndicador) || 100,
        },
        convidados,
        carregarDemo: carregarDemoNoOnboarding,
      });
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : String(err));
    } finally {
      setOnboardingSubmitting(false);
    }
  };

  if (needsOnboarding) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Configuração Inicial da Rede (Onboarding)
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Cadastre sua Rede, o primeiro polo, convide a equipe e carregue as 11 categorias
                padrão automaticamente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => enterInteractiveWorkspace(true)}
              className="px-3.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap"
            >
              Pular e Abrir com Dados Demo
            </button>
          </div>

          {onboardingError && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
              {onboardingError}
            </div>
          )}

          <form
            onSubmit={handleOnboardingSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-8"
          >
            {/* Step 1: Rede */}
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                01. Dados da Rede e Parâmetros de Governança
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="onb-nome-rede"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Nome da Rede *
                  </label>
                  <input
                    id="onb-nome-rede"
                    type="text"
                    required
                    value={nomeRede}
                    onChange={(e) => setNomeRede(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="onb-rotulo-tamanho"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Rótulo do Indicador de Porte
                  </label>
                  <input
                    id="onb-rotulo-tamanho"
                    type="text"
                    required
                    value={rotuloTamanho}
                    onChange={(e) => setRotuloTamanho(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="onb-limite-aprov"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Limite p/ Aprovação Automática (R$)
                  </label>
                  <input
                    id="onb-limite-aprov"
                    type="number"
                    min={0}
                    step="10"
                    value={limiteAprovacao}
                    onChange={(e) => setLimiteAprovacao(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </section>

            {/* Step 2: Primeiro Polo */}
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                02. Cadastro do Primeiro Polo (Unidade)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="onb-polo-nome"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Nome do Polo *
                  </label>
                  <input
                    id="onb-polo-nome"
                    type="text"
                    required
                    value={poloNome}
                    onChange={(e) => setPoloNome(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="onb-polo-cidade"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Cidade / UF *
                  </label>
                  <input
                    id="onb-polo-cidade"
                    type="text"
                    required
                    value={poloCidade}
                    onChange={(e) => setPoloCidade(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="onb-polo-ind"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Quantidade ({rotuloTamanho})
                  </label>
                  <input
                    id="onb-polo-ind"
                    type="number"
                    min={1}
                    value={poloIndicador}
                    onChange={(e) => setPoloIndicador(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </section>

            {/* Step 3: Convite de Usuários */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  03. Convite de Usuários e Perfis de Acesso
                </h2>
                <button
                  type="button"
                  onClick={handleAddConvidado}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Convidado
                </button>
              </div>
              <div className="space-y-3">
                {convidados.map((conv, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                  >
                    <div className="md:col-span-4">
                      <input
                        type="text"
                        aria-label={`Nome do convidado ${idx + 1}`}
                        placeholder="Nome completo"
                        value={conv.nome}
                        onChange={(e) => {
                          const next = [...convidados];
                          next[idx].nome = e.target.value;
                          setConvidados(next);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <input
                        type="email"
                        aria-label={`E-mail do convidado ${idx + 1}`}
                        placeholder="email@rede.com.br"
                        value={conv.email}
                        onChange={(e) => {
                          const next = [...convidados];
                          next[idx].email = e.target.value;
                          setConvidados(next);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <select
                        aria-label={`Perfil do convidado ${idx + 1}`}
                        value={conv.perfil}
                        onChange={(e) => {
                          const next = [...convidados];
                          next[idx].perfil = e.target.value as PerfilUsuario;
                          setConvidados(next);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                      >
                        <option value="gestor">Gestor do Polo</option>
                        <option value="operador">Operador</option>
                        <option value="leitor">Leitor</option>
                        <option value="admin">Admin da Rede</option>
                      </select>
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <button
                        type="button"
                        aria-label={`Remover convidado ${idx + 1}`}
                        onClick={() => handleRemoveConvidado(idx)}
                        className="p-2 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Step 4: Categorias Padrão & Dados Demo */}
            <section className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                04. Carga Automática das 11 Categorias Padrão
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Internas (7) e Marketing (4): {CATEGORIAS_PADRAO.map((c) => c.nome).join(' · ')}.
              </p>
              <label className="flex items-center gap-2 pt-2 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={carregarDemoNoOnboarding}
                  onChange={(e) => setCarregarDemoNoOnboarding(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Incluir também 3 polos e 6 meses de lançamentos de exemplo (removíveis com 1 clique)
              </label>
            </section>

            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={onboardingSubmitting}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg hover:opacity-90 transition-opacity"
              >
                {onboardingSubmitting
                  ? 'Criando Rede e Categorias...'
                  : 'Concluir Onboarding e Acessar Rede'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Brand & Value Column */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Building2 className="w-4 h-4" />
              <span>Gestão Multi-Tenant e Governança Orçamentária</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              GastoPolo — Controle e Otimização de Gastos por Polo
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Gerencie os gastos operacionais e de marketing de toda a sua rede de unidades. Defina
              tetos mensais por categoria, aprove despesas acima da alçada, faça rateios exatos
              entre polos e receba alertas automáticos de desperdício com planos de ação.
            </p>

            <div className="space-y-2.5 pt-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Isolamento por perfil e polo (Admin, Gestor do Polo, Operador e Leitor)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  7 alertas automáticos de desperdício (teto estourado, emergências recorrentes,
                  variação de preço, consumo, despesas diversas e CPA)
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Exportação de Relatório Mensal em PDF (A4) e lançamentos em CSV com trilha de
                  auditoria completa
                </span>
              </div>
            </div>
          </div>

          {/* Instant Interactive Access Box */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              Acesso Rápido ao Ambiente Funcional
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Explore imediatamente a plataforma com 3 polos e 6 meses de histórico realista, ou
              inicie o passo a passo de cadastro de uma nova Rede do zero.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => enterInteractiveWorkspace(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <Database className="w-4 h-4" />
                Acessar Rede com Dados de Exemplo
              </button>
              <button
                type="button"
                onClick={() => {
                  enterInteractiveWorkspace(false);
                  setShowWizardOnly(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                Criar Nova Rede (Onboarding)
              </button>
            </div>
          </div>
        </div>

        {/* Right Firebase Auth Column */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Autenticação Firebase
              </h2>
              <ShieldCheck className="w-5 h-5 text-slate-400" />
            </div>

            {/* Segmented Login / Register Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setAuthTab('login')}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  authTab === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Entrar com E-mail
              </button>
              <button
                type="button"
                onClick={() => setAuthTab('register')}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  authTab === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Criar Conta Admin
              </button>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                {authError}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              {authTab === 'register' && (
                <div>
                  <label
                    htmlFor="auth-nome"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Seu Nome Completo
                  </label>
                  <input
                    id="auth-nome"
                    type="text"
                    required
                    value={nomeAuth}
                    onChange={(e) => setNomeAuth(e.target.value)}
                    placeholder="Ex: Alisson Araujo"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={emailAuth}
                    onChange={(e) => setEmailAuth(e.target.value)}
                    placeholder="voce@rede.com.br"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="auth-senha"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="auth-senha"
                    type="password"
                    required
                    minLength={6}
                    value={senhaAuth}
                    onChange={(e) => setSenhaAuth(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity"
              >
                {authSubmitting
                  ? 'Autenticando...'
                  : authTab === 'login'
                  ? 'Entrar com E-mail e Senha'
                  : 'Cadastrar e Criar Minha Rede'}
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="flex-shrink mx-3 text-[11px] text-slate-400">ou</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <button
              type="button"
              disabled={authSubmitting}
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Continuar com Conta Google
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
            Nota Firebase Auth: O login Google já está provisionado automaticamente. Para usar
            E-mail/Senha no Cloud Firestore, certifique-se de habilitar o provedor{' '}
            <em>Email/Password</em> no Console do Firebase.
          </p>
        </div>
      </div>
    </div>
  );
};
