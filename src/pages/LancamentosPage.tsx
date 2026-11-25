import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Lancamento } from '../types';
import {
  formatBRL,
  formatDateBR,
  formatMonthBR,
  getCurrentDateSaoPaulo,
  getLancamentoValorNoPolo,
  roundCents,
} from '../utils/financeRules';
import { exportLancamentosCSV } from '../utils/exportUtils';

export const LancamentosPage: React.FC = () => {
  const {
    currentUserProfile,
    visiblePolos,
    allPolos,
    categorias,
    fornecedores,
    lancamentos,
    selectedMonth,
    setSelectedMonth,
    selectedPoloId,
    setSelectedPoloId,
    canCreateLaunches,
    canEditLaunch,
    canDeleteLaunch,
    canManageNetwork,
    saveCategoria,
    saveLancamento,
    softDeleteLancamento,
  } = useApp();

  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoriaId, setFilterCategoriaId] = useState('ALL');
  const [filterTodoPeriodo, setFilterTodoPeriodo] = useState(false);
  const [sortBy, setSortBy] = useState<'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc'>(
    'data_desc'
  );
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [notice, setNotice] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    data: getCurrentDateSaoPaulo(),
    poloId: '',
    categoriaId: '',
    formaPagamento: 'PIX',
    observacoes: '',
    comprovanteUrl: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [addingNewCat, setAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [confirmDeleteItem, setConfirmDeleteItem] = useState<Lancamento | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const activeCategorias = useMemo(() => {
    return categorias.filter((c) => c.ativa);
  }, [categorias]);

  useEffect(() => {
    if (searchParams.get('novo') === '1' && canCreateLaunches) {
      openNewModal();
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  const openNewModal = () => {
    const activePolos = visiblePolos.filter((p) => p.ativo);
    const defaultPolo =
      selectedPoloId !== 'ALL'
        ? selectedPoloId
        : activePolos[0]?.id || visiblePolos[0]?.id || '';
    const defaultCat = activeCategorias[0]?.id || categorias[0]?.id || '';
    const today = getCurrentDateSaoPaulo();
    const defaultDate = today.startsWith(selectedMonth) ? today : `${selectedMonth}-15`;

    setEditingId(undefined);
    setFormError(null);
    setFormData({
      descricao: '',
      valor: '',
      data: defaultDate,
      poloId: defaultPolo,
      categoriaId: defaultCat,
      formaPagamento: 'PIX',
      observacoes: '',
      comprovanteUrl: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (l: Lancamento) => {
    setEditingId(l.id);
    setFormError(null);
    setFormData({
      descricao: l.descricao,
      valor: String(l.valorTotal),
      data: l.data,
      poloId: l.poloId,
      categoriaId: l.categoriaId,
      formaPagamento: l.formaPagamento || 'PIX',
      observacoes: l.justificativa || '',
      comprovanteUrl: l.comprovanteUrl || '',
    });
    setIsModalOpen(true);
  };

  const handleQuickAddCategory = async () => {
    if (!newCatName.trim()) return;
    await saveCategoria({
      nome: newCatName.trim(),
      tipo: newCatName.trim().toLowerCase().includes('marketing') ? 'marketing' : 'interno',
      ativa: true,
    });
    setNewCatName('');
    setAddingNewCat(false);
    showNotice('Categoria adicionada.');
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanDesc = formData.descricao.trim();
    if (!cleanDesc) {
      setFormError('Informe a descrição da despesa.');
      return;
    }

    const parsedValor = Number(String(formData.valor).replace(',', '.'));
    if (!Number.isFinite(parsedValor) || parsedValor <= 0) {
      setFormError('Informe um valor válido maior que R$ 0,00.');
      return;
    }

    if (!formData.data || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(formData.data)) {
      setFormError('Informe uma data válida.');
      return;
    }

    const [y, m, d] = formData.data.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (
      dateObj.getFullYear() !== y ||
      dateObj.getMonth() !== m - 1 ||
      dateObj.getDate() !== d
    ) {
      setFormError('Data inválida.');
      return;
    }

    if (!formData.poloId) {
      setFormError('Selecione o polo.');
      return;
    }

    if (!formData.categoriaId) {
      setFormError('Selecione a categoria.');
      return;
    }

    const catObj = categorias.find((c) => c.id === formData.categoriaId);
    const valorFinal = roundCents(parsedValor);

    setSubmitting(true);
    try {
      await saveLancamento(
        {
          data: formData.data,
          poloId: formData.poloId,
          tipo: catObj?.tipo || 'interno',
          categoriaId: formData.categoriaId,
          itemId: '',
          descricao: cleanDesc,
          fornecedorId: '',
          quantidade: 1,
          unidade: 'un',
          valorUnitario: valorFinal,
          valorTotal: valorFinal,
          formaPagamento: formData.formaPagamento || 'PIX',
          responsavelUid: currentUserProfile?.uid || 'admin',
          emergencial: false,
          justificativa: formData.observacoes.trim(),
          campanhaId: '',
          rateio: {
            ativo: false,
            criterio: 'igual',
            partes: [],
          },
          comprovanteUrl: formData.comprovanteUrl.trim(),
        },
        editingId
      );
      setIsModalOpen(false);
      showNotice(editingId ? 'Despesa atualizada.' : 'Despesa cadastrada.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredList = useMemo(() => {
    return lancamentos
      .filter((l) => {
        if (l.excluido || l.status === 'rejeitado') return false;
        if (!filterTodoPeriodo && l.competencia !== selectedMonth) return false;
        if (getLancamentoValorNoPolo(l, selectedPoloId) <= 0) return false;
        if (filterCategoriaId !== 'ALL' && l.categoriaId !== filterCategoriaId) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchDesc = l.descricao.toLowerCase().includes(q);
          const matchObs = (l.justificativa || '').toLowerCase().includes(q);
          if (!matchDesc && !matchObs) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'data_desc') return b.data.localeCompare(a.data);
        if (sortBy === 'data_asc') return a.data.localeCompare(b.data);
        const valA = getLancamentoValorNoPolo(a, selectedPoloId);
        const valB = getLancamentoValorNoPolo(b, selectedPoloId);
        if (sortBy === 'valor_desc') return valB - valA;
        return valA - valB;
      });
  }, [
    lancamentos,
    filterTodoPeriodo,
    selectedMonth,
    selectedPoloId,
    filterCategoriaId,
    searchTerm,
    sortBy,
  ]);

  const totalFiltrado = useMemo(() => {
    return roundCents(
      filteredList.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
    );
  }, [filteredList, selectedPoloId]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const paginatedList = filteredList.slice((page - 1) * pageSize, page * pageSize);

  const poloMap = useMemo(() => new Map(allPolos.map((p) => [p.id, p.nome])), [allPolos]);
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Lançamentos de Despesas
        </h2>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              exportLancamentosCSV({
                lancamentos: filteredList,
                polos: allPolos,
                categorias,
                fornecedores,
              })
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exportar ({filteredList.length})
          </button>

          {canCreateLaunches && (
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#002855] hover:bg-[#003875] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Despesa
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Filtrado</div>
            <div
              data-testid="lancamentos-total-aprovado"
              className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5"
            >
              {formatBRL(totalFiltrado)}
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{filteredList.length} registro(s)</div>
            <div>{filterTodoPeriodo ? 'Histórico completo' : formatMonthBR(selectedMonth)}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Escopo</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {selectedPoloId === 'ALL'
                ? `Todos os Polos (${visiblePolos.length})`
                : poloMap.get(selectedPoloId) || selectedPoloId}
            </div>
          </div>
          {selectedPoloId !== 'ALL' && visiblePolos.length > 1 && (
            <button
              type="button"
              onClick={() => setSelectedPoloId('ALL')}
              className="text-xs font-semibold text-[#004B8D] dark:text-blue-400 hover:underline cursor-pointer"
            >
              Todos os Polos
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              aria-label="Pesquisar por descrição"
              placeholder="Pesquisar descrição..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>

          <input
            type="month"
            aria-label="Filtrar por Período"
            value={selectedMonth}
            disabled={filterTodoPeriodo}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedMonth(e.target.value);
                setPage(1);
              }
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
          />

          <select
            aria-label="Filtrar por Polo"
            value={selectedPoloId}
            onChange={(e) => {
              setSelectedPoloId(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            {visiblePolos.length > 1 && <option value="ALL">Todos os Polos</option>}
            {visiblePolos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por Categoria"
            value={filterCategoriaId}
            onChange={(e) => {
              setFilterCategoriaId(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="ALL">Todas as Categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          <select
            aria-label="Ordenar lançamentos"
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as 'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc'
              )
            }
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="data_desc">Data (Recentes)</option>
            <option value="data_asc">Data (Antigos)</option>
            <option value="valor_desc">Valor (Maior)</option>
            <option value="valor_asc">Valor (Menor)</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filterTodoPeriodo}
              onChange={(e) => {
                setFilterTodoPeriodo(e.target.checked);
                setPage(1);
              }}
              className="rounded border-slate-300"
            />
            Exibir todos os períodos
          </label>

          <span className="text-slate-500 dark:text-slate-400">
            {paginatedList.length} de {filteredList.length} registro(s)
          </span>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {paginatedList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nenhuma despesa encontrada.
            </p>
            {canCreateLaunches && (
              <button
                type="button"
                onClick={openNewModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#002855] hover:bg-[#003875] rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nova Despesa
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">Data</th>
                  <th className="py-3 px-3 font-medium">Descrição</th>
                  <th className="py-3 px-3 font-medium">Polo</th>
                  <th className="py-3 px-3 font-medium">Categoria</th>
                  <th className="py-3 px-3 font-medium">Pagamento</th>
                  <th className="py-3 px-3 font-medium text-right">Valor (R$)</th>
                  <th className="py-3 px-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginatedList.map((l) => {
                  const valNoPolo = getLancamentoValorNoPolo(l, selectedPoloId);
                  const editable = canEditLaunch(l);
                  const deletable = canDeleteLaunch(l);
                  return (
                    <tr
                      key={l.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                        {formatDateBR(l.data)}
                      </td>
                      <td className="py-3 px-3 max-w-sm">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {l.descricao}
                        </div>
                        {l.justificativa && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {l.justificativa}
                          </div>
                        )}
                        {l.comprovanteUrl && (
                          <a
                            href={l.comprovanteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#004B8D] dark:text-blue-400 hover:underline mt-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Comprovante
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {poloMap.get(l.poloId) || l.poloId}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {catMap.get(l.categoriaId) || l.categoriaId}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {l.formaPagamento || '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatBRL(valNoPolo)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {editable && (
                            <button
                              type="button"
                              aria-label={`Editar ${l.descricao}`}
                              onClick={() => openEditModal(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                          )}

                          {deletable && (
                            <button
                              type="button"
                              aria-label={`Excluir ${l.descricao}`}
                              onClick={() => setConfirmDeleteItem(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/70 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir
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
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation before deleting expense */}
      {confirmDeleteItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Excluir Despesa
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Confirmar exclusão de <strong>&ldquo;{confirmDeleteItem.descricao}&rdquo;</strong> (
              <strong>{formatBRL(confirmDeleteItem.valorTotal)}</strong>)?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await softDeleteLancamento(confirmDeleteItem.id);
                  setConfirmDeleteItem(null);
                  showNotice('Despesa excluída.');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cadastrar / Editar Despesa */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-lancamento-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3
                id="modal-lancamento-titulo"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                {editingId ? 'Editar Despesa' : 'Nova Despesa'}
              </h3>
              <button
                type="button"
                aria-label="Fechar formulário"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="lanc-descricao"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Descrição *
                </label>
                <input
                  id="lanc-descricao"
                  type="text"
                  required
                  placeholder="Descrição da despesa"
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, descricao: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="lanc-valor"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Valor (R$) *
                  </label>
                  <input
                    id="lanc-valor"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={formData.valor}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, valor: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lanc-data"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Data *
                  </label>
                  <input
                    id="lanc-data"
                    type="date"
                    required
                    value={formData.data}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, data: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="lanc-polo"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Polo *
                  </label>
                  <select
                    id="lanc-polo"
                    required
                    value={formData.poloId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, poloId: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {visiblePolos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="lanc-categoria"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Categoria *
                    </label>
                    {canManageNetwork && (
                      <button
                        type="button"
                        onClick={() => setAddingNewCat((prev) => !prev)}
                        className="text-[11px] font-semibold text-[#004B8D] dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        {addingNewCat ? 'Cancelar' : '+ Categoria'}
                      </button>
                    )}
                  </div>
                  <select
                    id="lanc-categoria"
                    required
                    value={formData.categoriaId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, categoriaId: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {activeCategorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {addingNewCat && canManageNetwork && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome da categoria"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddCategory}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#002855] rounded-md cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="lanc-pagamento"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Forma de Pagamento
                  </label>
                  <select
                    id="lanc-pagamento"
                    value={formData.formaPagamento}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, formaPagamento: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Cartão Corporativo">Cartão Corporativo</option>
                    <option value="Transferência / TED">Transferência / TED</option>
                    <option value="Débito Automático">Débito Automático</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="lanc-comprovante"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Comprovante / Anexo (URL)
                  </label>
                  <input
                    id="lanc-comprovante"
                    type="url"
                    placeholder="https://..."
                    value={formData.comprovanteUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, comprovanteUrl: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="lanc-observacoes"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Observações
                </label>
                <textarea
                  id="lanc-observacoes"
                  rows={2}
                  placeholder="Observações opcionais"
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, observacoes: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#002855] hover:bg-[#003875] rounded-lg cursor-pointer"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LancamentosPage;
