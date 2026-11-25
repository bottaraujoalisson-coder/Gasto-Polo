import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PerfilUsuario, UsuarioRede } from '../types';
import {
  Users,
  UserPlus,
  Building2,
  CheckCircle2,
  XCircle,
  Edit3,
  Power,
  Tag,
  Plus,
  X,
  Lock,
  Mail,
} from 'lucide-react';

const PERFIL_LABELS: Record<string, { label: string; colorClass: string }> = {
  admin: {
    label: 'Administrador',
    colorClass: 'text-[#002855] dark:text-blue-300 font-semibold',
  },
  gestor: {
    label: 'Gestor',
    colorClass: 'text-[#004B8D] dark:text-blue-400 font-semibold',
  },
  operador: {
    label: 'Operador',
    colorClass: 'text-slate-700 dark:text-slate-300 font-medium',
  },
  leitor: {
    label: 'Operador (Consulta)',
    colorClass: 'text-slate-500 dark:text-slate-400 font-medium',
  },
};

export const UsuariosPage: React.FC = () => {
  const {
    rede,
    allPolos,
    categorias,
    usuarios,
    convites,
    lastIssuedInviteTokens,
    currentUserProfile,
    canManageNetwork,
    createInvite,
    cancelInvite,
    saveUsuario,
    saveCategoria,
    updateRedeSettings,
  } = useApp();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNome, setInviteNome] = useState('');
  const [invitePerfil, setInvitePerfil] = useState<PerfilUsuario>('operador');
  const [invitePoloIds, setInvitePoloIds] = useState<string[]>([]);
  const [submittingInvite, setSubmittingInvite] = useState(false);

  const [editingUser, setEditingUser] = useState<UsuarioRede | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editPerfil, setEditPerfil] = useState<PerfilUsuario>('operador');
  const [editPoloIds, setEditPoloIds] = useState<string[]>([]);
  const [editAtivo, setEditAtivo] = useState(true);
  const [savingUser, setSavingUser] = useState(false);

  const [companyName, setCompanyName] = useState(rede?.nome || '');
  const [newCatNome, setNewCatNome] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const toggleInvitePolo = (id: string) => {
    setInvitePoloIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleEditPolo = (id: string) => {
    setEditPoloIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteNome.trim()) {
      setFeedback({ type: 'error', message: 'Preencha o nome e o e-mail do usuário.' });
      return;
    }
    if (invitePerfil !== 'admin' && invitePoloIds.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Selecione ao menos um polo autorizado.',
      });
      return;
    }

    setSubmittingInvite(true);
    setFeedback(null);
    try {
      const { rawToken } = await createInvite({
        nome: inviteNome.trim(),
        email: inviteEmail.trim().toLowerCase(),
        perfil: invitePerfil,
        poloIds: invitePerfil === 'admin' ? allPolos.map((p) => p.id) : invitePoloIds,
      });
      setInviteEmail('');
      setInviteNome('');
      setInvitePerfil('operador');
      setInvitePoloIds([]);
      setFeedback({
        type: 'success',
        message: `Permissão criada. Token de vínculo: ${rawToken}`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao autorizar novo usuário.',
      });
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleOpenEditUser = (u: UsuarioRede) => {
    setEditingUser(u);
    setEditNome(u.nome);
    setEditPerfil(u.perfil === 'leitor' ? 'operador' : u.perfil);
    setEditPoloIds(u.poloIds || []);
    setEditAtivo(u.ativo);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (editPerfil !== 'admin' && editPoloIds.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Selecione ao menos um polo para Gestor ou Operador.',
      });
      return;
    }

    setSavingUser(true);
    setFeedback(null);
    try {
      await saveUsuario(
        {
          nome: editNome.trim() || editingUser.nome,
          email: editingUser.email,
          perfil: editPerfil,
          poloIds: editPerfil === 'admin' ? allPolos.map((p) => p.id) : editPoloIds,
          ativo: editAtivo,
        },
        editingUser.id
      );
      setEditingUser(null);
      setFeedback({ type: 'success', message: 'Permissões atualizadas com sucesso.' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Não foi possível atualizar o usuário.',
      });
    } finally {
      setSavingUser(false);
    }
  };

  const handleToggleUserActive = async (u: UsuarioRede) => {
    try {
      await saveUsuario(
        {
          nome: u.nome,
          email: u.email,
          perfil: u.perfil,
          poloIds: u.poloIds,
          ativo: !u.ativo,
        },
        u.id
      );
      setFeedback({
        type: 'success',
        message: u.ativo ? 'Acesso do usuário bloqueado.' : 'Acesso do usuário reativado.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao alterar status do usuário.',
      });
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNome.trim()) return;
    try {
      await saveCategoria({
        nome: newCatNome.trim(),
        tipo: 'interno',
        ativa: true,
      });
      setNewCatNome('');
      setFeedback({ type: 'success', message: 'Categoria adicionada com sucesso.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao salvar categoria.' });
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rede || !companyName.trim()) return;
    setSavingCompany(true);
    try {
      await updateRedeSettings(companyName.trim(), rede.config);
      setFeedback({ type: 'success', message: 'Identificação da empresa atualizada.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao atualizar empresa.' });
    } finally {
      setSavingCompany(false);
    }
  };

  const activePerfilInfo =
    PERFIL_LABELS[currentUserProfile?.perfil || 'operador'] || PERFIL_LABELS.operador;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Usuários e Permissões
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Perfil ativo:</span>
          <span className={activePerfilInfo.colorClass}>{activePerfilInfo.label}</span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline ml-4 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {!canManageNetwork ? (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#002855] dark:text-blue-300 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Acesso Restrito ao Administrador
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Conta autenticada como {activePerfilInfo.label} ({currentUserProfile?.email}).
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Formulário: Liberar Acesso / Novo Usuário */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <UserPlus className="w-4 h-4 text-[#002855] dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Autorizar Novo Usuário
              </h3>
            </div>

            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Usuário *
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteNome}
                    onChange={(e) => setInviteNome(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    E-mail / Login *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="usuario@unimar.br"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nível de Permissão *
                  </label>
                  <select
                    value={invitePerfil}
                    onChange={(e) => setInvitePerfil(e.target.value as PerfilUsuario)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
                  >
                    <option value="operador">Operador</option>
                    <option value="gestor">Gestor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              {invitePerfil !== 'admin' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Polos Autorizados *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allPolos.map((p) => {
                      const selected = invitePoloIds.includes(p.id);
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => toggleInvitePolo(p.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            selected
                              ? 'bg-[#002855] text-white border-[#002855]'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          {p.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submittingInvite}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#002855] hover:bg-[#003875] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  {submittingInvite ? 'Autorizando...' : 'Autorizar Acesso'}
                </button>
              </div>
            </form>
          </div>

          {/* Convites Pendentes */}
          {convites.filter((c) => c.status === 'pendente').length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#004B8D]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Acessos Pré-Autorizados Pendentes
                  </h3>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {convites
                  .filter((c) => c.status === 'pendente')
                  .map((c) => {
                    const pInfo = PERFIL_LABELS[c.perfil] || PERFIL_LABELS.operador;
                    const issuedToken = lastIssuedInviteTokens[c.id];
                    return (
                      <div
                        key={c.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {c.nome}{' '}
                            <span className="text-slate-500 font-normal">({c.email})</span>
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                            <span className={pInfo.colorClass}>{pInfo.label}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">
                              Polos:{' '}
                              {c.perfil === 'admin'
                                ? 'Todos os Polos'
                                : c.poloIds
                                    .map((id) => allPolos.find((p) => p.id === id)?.nome || id)
                                    .join(', ')}
                            </span>
                            {issuedToken && (
                              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                Token: {issuedToken}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => cancelInvite(c.id)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 self-start sm:self-center cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Lista de Usuários Cadastrados */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-[#002855] dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Usuários Cadastrados ({usuarios.length})
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-800/40">
                    <th className="py-3.5 px-4">Usuário</th>
                    <th className="py-3.5 px-4">E-mail</th>
                    <th className="py-3.5 px-4">Nível de Acesso</th>
                    <th className="py-3.5 px-4">Polos Autorizados</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {usuarios.map((u) => {
                    const pInfo = PERFIL_LABELS[u.perfil] || PERFIL_LABELS.operador;
                    const userPolos =
                      u.perfil === 'admin'
                        ? 'Todos os Polos'
                        : (u.poloIds || [])
                            .map((id) => allPolos.find((p) => p.id === id)?.nome || id)
                            .join(', ') || 'Nenhum polo';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {u.nome}
                          {u.id === currentUserProfile?.id && (
                            <span className="ml-2 text-[11px] font-normal text-[#004B8D] dark:text-blue-400">
                              (Atual)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {u.email}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <span className={pInfo.colorClass}>{pInfo.label}</span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          {userPolos}
                        </td>
                        <td className="py-3.5 px-4">
                          {u.ativo ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                              <XCircle className="w-3.5 h-3.5" />
                              Bloqueado
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            {u.id !== currentUserProfile?.id && (
                              <button
                                onClick={() => handleToggleUserActive(u)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  u.ativo
                                    ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={u.ativo ? 'Bloquear acesso' : 'Reativar acesso'}
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Configurações Básicas da Empresa e Categorias de Despesa */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Nome da Empresa */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-[#002855] dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Identificação da Empresa
                </h3>
              </div>
              <form onSubmit={handleSaveCompany} className="flex gap-2">
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nome da Empresa"
                  className="flex-1 px-3.5 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
                />
                <button
                  type="submit"
                  disabled={savingCompany}
                  className="px-4 py-2 bg-[#002855] hover:bg-[#003875] text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {savingCompany ? 'Salvando...' : 'Salvar'}
                </button>
              </form>
            </div>

            {/* Categorias de Despesas */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#002855] dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Categorias de Despesas
                </h3>
              </div>
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  value={newCatNome}
                  onChange={(e) => setNewCatNome(e.target.value)}
                  placeholder="Nova categoria..."
                  className="flex-1 px-3.5 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-4 py-2 bg-[#002855] hover:bg-[#003875] text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </form>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      saveCategoria({ nome: c.nome, tipo: c.tipo, ativa: !c.ativa }, c.id)
                    }
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      c.ativa
                        ? 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                    }`}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Editar Permissões do Usuário */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Permissões — {editingUser.nome}
                </h3>
                <p className="text-xs text-slate-500">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nível de Permissão
                </label>
                <select
                  value={editPerfil}
                  onChange={(e) => setEditPerfil(e.target.value as PerfilUsuario)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl bg-white"
                >
                  <option value="admin">Administrador</option>
                  <option value="gestor">Gestor</option>
                  <option value="operador">Operador</option>
                </select>
              </div>

              {editPerfil !== 'admin' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Polos Autorizados
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allPolos.map((p) => {
                      const selected = editPoloIds.includes(p.id);
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => toggleEditPolo(p.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            selected
                              ? 'bg-[#002855] text-white border-[#002855]'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          {p.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Acesso Ativo
                </span>
                <input
                  type="checkbox"
                  checked={editAtivo}
                  disabled={editingUser.id === currentUserProfile?.id}
                  onChange={(e) => setEditAtivo(e.target.checked)}
                  className="w-4 h-4 accent-[#002855] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2 bg-[#002855] hover:bg-[#003875] disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {savingUser ? 'Salvando...' : 'Salvar Permissões'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;
