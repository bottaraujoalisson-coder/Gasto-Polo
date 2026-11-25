import React, { useEffect, useState } from 'react';
import { KeyRound, LogOut, MailCheck, RefreshCw, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDateBR } from '../utils/financeRules';

const UNIMAR_LOGO_PATH = '/assets/aistudio/logo__2__b3705f1f.png';

export const AuthAndOnboardingPage: React.FC = () => {
  const {
    firebaseUser,
    isEmailVerified,
    isLocalWorkspace,
    rede,
    myPendingInvites,
    loginWithEmail,
    resendVerificationEmail,
    refreshEmailVerification,
    logout,
    acceptInvite,
  } = useApp();

  // Login states
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Email verification states (when required by Firebase Auth)
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Pending invite acceptance states (for users invited to the company)
  const [inviteTokensById, setInviteTokensById] = useState<Record<string, string>>({});
  const [manualInviteToken, setManualInviteToken] = useState('');
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invId = params.get('inviteId');
    const tok = params.get('token');
    if (invId && tok) {
      setManualInviteToken(tok);
      setInviteTokensById((prev) => ({ ...prev, [invId]: tok }));
    }
  }, []);

  const needsEmailVerification = Boolean(firebaseUser) && !isEmailVerified && !isLocalWorkspace;
  const hasPendingInviteToAccept =
    !needsEmailVerification &&
    Boolean(firebaseUser) &&
    !isLocalWorkspace &&
    !rede &&
    myPendingInvites.length > 0;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!loginUser.trim() || !loginPass.trim()) {
      setAuthError('Informe o usuário e a senha.');
      return;
    }
    setAuthSubmitting(true);
    try {
      await loginWithEmail(loginUser.trim(), loginPass);
    } catch {
      setAuthError('Credenciais inválidas. Verifique seu usuário e senha.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setVerifyError(null);
    setVerifyNotice(null);
    setResendBusy(true);
    try {
      await resendVerificationEmail();
      setVerifyNotice(`Link enviado para ${firebaseUser?.email}.`);
    } catch {
      setVerifyError('Não foi possível reenviar o e-mail de confirmação.');
    } finally {
      setResendBusy(false);
    }
  };

  const handleCheckVerificationStatus = async () => {
    setVerifyError(null);
    setVerifyNotice(null);
    setVerifyBusy(true);
    try {
      const verified = await refreshEmailVerification();
      if (!verified) {
        setVerifyError('Confirmação de e-mail ainda pendente.');
      }
    } catch {
      setVerifyError('Erro ao verificar status.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleAcceptInvite = async (conviteId: string, tokenValue: string) => {
    setInviteError(null);
    if (!conviteId.trim() || !tokenValue.trim()) {
      setInviteError('Informe o código do convite.');
      return;
    }
    setInviteBusyId(conviteId);
    try {
      await acceptInvite(
        conviteId.trim(),
        tokenValue.trim(),
        firebaseUser?.displayName || undefined
      );
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err));
    } finally {
      setInviteBusyId(null);
    }
  };

  // Minimal Email Verification View (when required by Firebase Auth)
  if (needsEmailVerification) {
    return (
      <div className="min-h-screen bg-[#04162E] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="bg-[#002855] px-8 py-7 flex flex-col items-center justify-center border-b border-[#003875]">
            <img
              src={UNIMAR_LOGO_PATH}
              alt="Unimar"
              referrerPolicy="no-referrer"
              className="h-11 w-auto object-contain"
            />
          </div>

          <div className="p-8 space-y-5">
            <div className="flex items-center gap-3">
              <MailCheck className="w-5 h-5 text-[#004B8D] shrink-0" />
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                Confirmação de E-mail ({firebaseUser?.email})
              </h1>
            </div>

            {verifyNotice && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-900 dark:text-blue-200">
                {verifyNotice}
              </div>
            )}

            {verifyError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                {verifyError}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={verifyBusy}
                onClick={handleCheckVerificationStatus}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#002855] hover:bg-[#003875] rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${verifyBusy ? 'animate-spin' : ''}`} />
                {verifyBusy ? 'Verificando...' : 'Confirmar Acesso'}
              </button>

              <button
                type="button"
                disabled={resendBusy}
                onClick={handleResendVerification}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {resendBusy ? 'Enviando...' : 'Reenviar Link'}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Voltar ao Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pending Invite Acceptance View (only when an invited user logs in with a pending invite)
  if (hasPendingInviteToAccept) {
    return (
      <div className="min-h-screen bg-[#04162E] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="bg-[#002855] px-8 py-7 flex flex-col items-center justify-center border-b border-[#003875]">
            <img
              src={UNIMAR_LOGO_PATH}
              alt="Unimar"
              referrerPolicy="no-referrer"
              className="h-11 w-auto object-contain"
            />
          </div>

          <div className="p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <KeyRound className="w-4 h-4 text-[#004B8D]" />
                <span>Confirmar Vínculo de Acesso</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Sair
              </button>
            </div>

            {inviteError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {inviteError}
              </div>
            )}

            {myPendingInvites.map((conv) => (
              <div key={conv.id} className="space-y-2">
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <strong>{conv.redeNome}</strong> · {conv.perfil.toUpperCase()} · Expira em{' '}
                  {formatDateBR(conv.expiraEm)}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Token de acesso"
                    value={inviteTokensById[conv.id] || manualInviteToken}
                    onChange={(e) =>
                      setInviteTokensById((prev) => ({
                        ...prev,
                        [conv.id]: e.target.value,
                      }))
                    }
                    className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    disabled={inviteBusyId === conv.id}
                    onClick={() =>
                      handleAcceptInvite(
                        conv.id,
                        inviteTokensById[conv.id] || manualInviteToken
                      )
                    }
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#002855] hover:bg-[#003875] rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Exclusive Unimar Login View
  // Contains ONLY: Unimar Logo, Usuário/Login field, Senha field, and Entrar button.
  return (
    <div className="min-h-screen bg-[#04162E] flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {/* Logo da Unimar em posição de destaque */}
        <div className="bg-[#002855] px-8 py-8 flex flex-col items-center justify-center border-b border-[#003875]">
          <img
            src={UNIMAR_LOGO_PATH}
            alt="Unimar"
            referrerPolicy="no-referrer"
            className="h-12 w-auto object-contain"
          />
        </div>

        <div className="p-8 space-y-5">
          {authError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
              {authError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-usuario"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Usuário ou Login
              </label>
              <input
                id="login-usuario"
                type="text"
                required
                autoComplete="username"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="usuario@unimar.br"
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
              />
            </div>

            <div>
              <label
                htmlFor="login-senha"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Senha
              </label>
              <input
                id="login-senha"
                type="password"
                required
                autoComplete="current-password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
              />
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#002855] hover:bg-[#003875] rounded-lg transition-colors cursor-pointer"
            >
              {authSubmitting ? 'Autenticando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
