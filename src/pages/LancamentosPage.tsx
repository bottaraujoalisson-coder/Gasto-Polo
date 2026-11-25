import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Edit3,
  Plus,
  Search,
  Split,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  CriterioRateio,
  Lancamento,
  ParteRateio,
  StatusLancamento,
  TipoCategoria,
} from '../types';
import {
  calculateRateioPartes,
  calculateValorTotal,
  formatBRL,
  formatDateBR,
  formatNumberBR,
  getLancamentoValorNoPolo,
  isDespesaDiversa,
  validateRateioSum,
} from '../utils/financeRules';
import { exportLancamentosCSV } from '../utils/exportUtils';

export const LancamentosPage: React.FC = () => {
  const {
    rede,
    currentUserProfile,
    visiblePolos,
    allPolos,
    categorias,
    fornecedores,
    itens,
    campanhas,
    lancamentos,
    selectedMonth,
    selectedPoloId,
    canCreateLaunches,
    canApproveLaunches,
    canEditLaunch,
    saveLancamento,
    duplicateLancamento,
    updateLancamentoStatus,
    softDeleteLancamento,
  } = useApp();

  const [searchParams, setSearchParams] = useSearchParams();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoriaId, setFilterCategoriaId] = useState('ALL');
  const [filterTipo, setFilterTipo] = useState<'ALL' | TipoCategoria>('ALL');
  const [filterEmergencial, setFilterEmergencial] = useState<'ALL' | 'SIM' | 'NAO'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | StatusLancamento>(() => {
    const st = searchParams.get('status') as StatusLancamento | null;
    return st || 'ALL';
  });
  const [filterFornecedorId, setFilterFornecedorId] = useState('ALL');
  const [filterTodoPeriodo, setFilterTodoPeriodo] = useState(false);
  const [sortBy, setSortBy] = useState<'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc'>(
    'data_desc'
  );
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modal Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    data: `${selectedMonth}-15`,
    poloId: visiblePolos[0]?.id || '',
    tipo: 'interno' as TipoCategoria,
    categoriaId: categorias[0]?.id || '',
    itemId: '',
    descricao: '',
    fornecedorId: '',
    quantidade: 1,
    unidade: 'un',
    valorUnitario: 0,
    formaPagamento: 'PIX',
    emergencial: false,
    justificativa: '',
    campanhaId: '',
    rateioAtivo: false,
    rateioCriterio: 'proporcional' as CriterioRateio,
    rateioPoloIds: [] as string[],
    rateioPartes: [] as ParteRateio[],
    comprovanteUrl: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Open modal automatically if ?novo=1
  useEffect(() => {
    if (searchParams.get('novo') === '1' && canCreateLaunches) {
      openNewModal();
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
    const statusParam = searchParams.get('status') as StatusLancamento | null;
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [searchParams]);

  const openNewModal = () => {
    const defaultPolo =
      selectedPoloId !== 'ALL' ? selectedPoloId : visiblePolos[0]?.id || '';
    const defaultCat = categorias.find((c) => c.ativa) || categorias[0];
    setEditingId(undefined);
    setFormError(null);
    setFormData({
      data: `${selectedMonth}-${String(Math.min(28, new Date().getDate())).padStart(2, '0')}`,
      poloId: defaultPolo,
      tipo: defaultCat?.tipo || 'interno',
      categoriaId: defaultCat?.id || '',
      itemId: '',
      descricao: '',
      fornecedorId: fornecedores[0]?.id || '',
      quantidade: 1,
      unidade: 'un',
      valorUnitario: 0,
      formaPagamento: 'PIX',
      emergencial: false,
      justificativa: '',
      campanhaId: '',
      rateioAtivo: false,
      rateioCriterio: 'proporcional',
      rateioPoloIds: visiblePolos.map((p) => p.id),
      rateioPartes: [],
      comprovanteUrl: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (l: Lancamento) => {
    setEditingId(l.id);
    setFormError(null);
    setFormData({
      data: l.data,
      poloId: l.poloId,
      tipo: l.tipo,
      categoriaId: l.categoriaId,
      itemId: l.itemId,
      descricao: l.descricao,
      fornecedorId: l.fornecedorId,
      quantidade: l.quantidade,
      unidade: l.unidade,
      valorUnitario: l.valorUnitario,
      formaPagamento: l.formaPagamento,
      emergencial: l.emergencial,
      justificativa: l.justificativa,
      campanhaId: l.campanhaId,
      rateioAtivo: Boolean(l.rateio?.ativo),
      rateioCriterio: l.rateio?.criterio || 'proporcional',
      rateioPoloIds:
        l.rateio?.ativo && l.rateio.partes.length > 0
          ? l.rateio.partes.map((pt) => pt.poloId)
          : visiblePolos.map((p) => p.id),
      rateioPartes: l.rateio?.partes || [],
      comprovanteUrl: l.comprovanteUrl || '',
    });
    setIsModalOpen(true);
  };

  const valorTotalCalculado = useMemo(
    () => calculateValorTotal(formData.quantidade, formData.valorUnitario),
    [formData.quantidade, formData.valorUnitario]
  );

  // Recalculate rateio parts automatically when total, criterio, or selected polos change (unless manual)
  useEffect(() => {
    if (!formData.rateioAtivo) return;
    if (formData.rateioCriterio === 'manual') return;
    const targetPolos = allPolos.filter((p) => formData.rateioPoloIds.includes(p.id));
    const partes = calculateRateioPartes(
      valorTotalCalculado,
      formData.rateioCriterio,
      targetPolos
    );
    setFormData((prev) => ({ ...prev, rateioPartes: partes }));
  }, [
    formData.rateioAtivo,
    formData.rateioCriterio,
    formData.rateioPoloIds,
    valorTotalCalculado,
    allPolos,
  ]);

  const selectedCategoriaObj = useMemo(
    () => categorias.find((c) => c.id === formData.categoriaId),
    [categorias, formData.categoriaId]
  );

  const requiresJustificativa =
    formData.emergencial ||
    (selectedCategoriaObj ? isDespesaDiversa(selectedCategoriaObj.nome) : false);

  const willBePending =
    valorTotalCalculado > (rede?.config.limiteAprovacao ?? 500);

  const handleSelectCatalogItem = (itemId: string) => {
    if (!itemId) {
      setFormData((prev) => ({ ...prev, itemId: '' }));
      return;
    }
    const item = itens.find((i) => i.id === itemId);
    if (!item) return;
    const cat = categorias.find((c) => c.id === item.categoriaId);
    setFormData((prev) => ({
      ...prev,
      itemId: item.id,
      descricao: item.nome,
      unidade: item.unidade,
      categoriaId: item.categoriaId || prev.categoriaId,
      tipo: cat?.tipo || prev.tipo,
    }));
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.poloId) {
      setFormError('Selecione o polo responsável.');
      return;
    }
    if (!formData.categoriaId) {
      setFormError('Selecione uma categoria.');
      return;
    }
    if (!formData.descricao.trim()) {
      setFormError('Informe a descrição ou selecione um item do catálogo.');
      return;
    }
    if (valorTotalCalculado <= 0) {
      setFormError('O valor total do lançamento deve ser maior que zero.');
      return;
    }
    if (requiresJustificativa && !formData.justificativa.trim()) {
      setFormError(
        formData.emergencial
          ? 'Compras emergenciais exigem justificativa obrigatória.'
          : 'Lançamentos em "Despesas diversas" exigem justificativa detalhada.'
      );
      return;
    }
    if (formData.rateioAtivo) {
      if (formData.rateioPartes.length < 2) {
        setFormError('Selecione pelo menos 2 polos para realizar o rateio.');
        return;
      }
      if (!validateRateioSum(valorTotalCalculado, formData.rateioPartes)) {
        const somaAtual = formData.rateioPartes.reduce((a, b) => a + b.valor, 0);
        setFormError(
          `A soma das partes do rateio (${formatBRL(somaAtual)}) deve fechar exatamente o valor total (${formatBRL(valorTotalCalculado)}).`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      await saveLancamento(
        {
          data: formData.data,
          poloId: formData.poloId,
          tipo: selectedCategoriaObj?.tipo || formData.tipo,
          categoriaId: formData.categoriaId,
          itemId: formData.itemId,
          descricao: formData.descricao.trim(),
          fornecedorId: formData.fornecedorId,
          quantidade: Number(formData.quantidade) || 1,
          unidade: formData.unidade.trim() || 'un',
          valorUnitario: Number(formData.valorUnitario) || 0,
          valorTotal: valorTotalCalculado,
          formaPagamento: formData.formaPagamento,
          responsavelUid: currentUserProfile?.uid || 'admin',
          emergencial: formData.emergencial,
          justificativa: formData.justificativa.trim(),
          campanhaId: formData.campanhaId,
          rateio: formData.rateioAtivo
            ? {
                ativo: true,
                criterio: formData.rateioCriterio,
                partes: formData.rateioPartes,
              }
            : {
                ativo: false,
                criterio: 'igual',
                partes: [],
              },
          comprovanteUrl: formData.comprovanteUrl,
        },
        editingId
      );
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered and Sorted Launches
  const filteredList = useMemo(() => {
    return lancamentos
      .filter((l) => {
        if (l.excluido) return false;
        if (!filterTodoPeriodo && l.competencia !== selectedMonth) return false;
        if (getLancamentoValorNoPolo(l, selectedPoloId) <= 0) return false;
        if (filterCategoriaId !== 'ALL' && l.categoriaId !== filterCategoriaId) return false;
        if (filterTipo !== 'ALL' && l.tipo !== filterTipo) return false;
        if (filterEmergencial === 'SIM' && !l.emergencial) return false;
        if (filterEmergencial === 'NAO' && l.emergencial) return false;
        if (filterStatus !== 'ALL' && l.status !== filterStatus) return false;
        if (filterFornecedorId !== 'ALL' && l.fornecedorId !== filterFornecedorId) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchDesc = l.descricao.toLowerCase().includes(q);
          const matchJust = l.justificativa.toLowerCase().includes(q);
          if (!matchDesc && !matchJust) return false;
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
    filterTipo,
    filterEmergencial,
    filterStatus,
    filterFornecedorId,
    searchTerm,
    sortBy,
  ]);

  const summaryTotals = useMemo(() => {
    let aprovado = 0;
    let pendente = 0;
    let emergencial = 0;
    for (const l of filteredList) {
      const v = getLancamentoValorNoPolo(l, selectedPoloId);
      if (l.status === 'aprovado') {
        aprovado += v;
        if (l.emergencial) emergencial += v;
      } else if (l.status === 'pendente') {
        pendente += v;
      }
    }
    return {
      aprovado,
      pendente,
      emergencial,
      count: filteredList.length,
    };
  }, [filteredList, selectedPoloId]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const paginatedList = filteredList.slice((page - 1) * pageSize, page * pageSize);

  const poloMap = useMemo(() => new Map(allPolos.map((p) => [p.id, p.nome])), [allPolos]);
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);
  const fornMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Lançamentos de Despesas e Rateios
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Limite de aprovação automática: <strong>{formatBRL(rede?.config.limiteAprovacao || 500)}</strong>. Acima deste valor, o lançamento aguarda aprovação do Gestor.
          </p>
        </div>

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
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Exportar CSV ({filteredList.length})
          </button>

          {canCreateLaunches && (
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Novo Lançamento
            </button>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total Aprovado (Filtro Atual)
          </div>
          <div
            data-testid="lancamentos-total-aprovado"
            className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1"
          >
            {formatBRL(summaryTotals.aprovado)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Pendentes de Aprovação (À Parte)
          </div>
          <div
            data-testid="lancamentos-total-pendente"
            className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1"
          >
            {formatBRL(summaryTotals.pendente)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Compras Emergenciais Aprovadas
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400 mt-1">
            {formatBRL(summaryTotals.emergencial)}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              aria-label="Buscar lançamentos"
              placeholder="Buscar descrição ou justificativa..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>

          {/* Categoria */}
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

          {/* Status */}
          <select
            aria-label="Filtrar por Status"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as 'ALL' | StatusLancamento);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="ALL">Todos os Status</option>
            <option value="aprovado">Aprovados</option>
            <option value="pendente">Pendentes</option>
            <option value="rejeitado">Rejeitados</option>
          </select>

          {/* Emergencial */}
          <select
            aria-label="Filtrar por Emergencial"
            value={filterEmergencial}
            onChange={(e) => {
              setFilterEmergencial(e.target.value as 'ALL' | 'SIM' | 'NAO');
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="ALL">Emergencial: Todos</option>
            <option value="SIM">Apenas Emergenciais</option>
            <option value="NAO">Apenas Planejados</option>
          </select>

          {/* Ordenação */}
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
            <option value="data_desc">Data (Mais recentes)</option>
            <option value="data_asc">Data (Mais antigos)</option>
            <option value="valor_desc">Maior Valor</option>
            <option value="valor_asc">Menor Valor</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <div className="flex items-center gap-4">
            <select
              aria-label="Filtrar por Tipo"
              value={filterTipo}
              onChange={(e) => {
                setFilterTipo(e.target.value as 'ALL' | TipoCategoria);
                setPage(1);
              }}
              className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">Tipo: Interno + Marketing</option>
              <option value="interno">Apenas Interno</option>
              <option value="marketing">Apenas Marketing</option>
            </select>

            <select
              aria-label="Filtrar por Fornecedor"
              value={filterFornecedorId}
              onChange={(e) => {
                setFilterFornecedorId(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">Todos os Fornecedores</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>

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
              Exibir todos os meses (histórico completo)
            </label>
          </div>

          <span className="text-slate-500 dark:text-slate-400">
            Exibindo {paginatedList.length} de {filteredList.length} lançamento(s)
          </span>
        </div>
      </div>

      {/* Launches Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {paginatedList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nenhum lançamento encontrado para os filtros selecionados.
            </p>
            {canCreateLaunches && (
              <button
                type="button"
                onClick={openNewModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Registrar Primeiro Lançamento
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">Data</th>
                  <th className="py-3 px-3 font-medium">Polo</th>
                  <th className="py-3 px-3 font-medium">Descrição / Fornecedor</th>
                  <th className="py-3 px-3 font-medium">Categoria</th>
                  <th className="py-3 px-3 font-medium text-right">Qtd × Unit.</th>
                  <th className="py-3 px-3 font-medium text-right">Valor no Polo</th>
                  <th className="py-3 px-3 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginatedList.map((l) => {
                  const valNoPolo = getLancamentoValorNoPolo(l, selectedPoloId);
                  const editable = canEditLaunch(l);
                  return (
                    <tr
                      key={l.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                        {formatDateBR(l.data)}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                        <div>{poloMap.get(l.poloId) || l.poloId}</div>
                        {l.rateio?.ativo && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Split className="w-3 h-3" />
                            <span>
                              Rateado ({l.rateio.criterio} · Total {formatBRL(l.valorTotal)})
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-slate-900 dark:text-white truncate">
                          {l.descricao}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {fornMap.get(l.fornecedorId) || 'Fornecedor avulso'} · {l.formaPagamento}
                          {l.emergencial && (
                            <span className="text-red-600 dark:text-red-400 font-semibold ml-1.5">
                              · EMERGENCIAL
                            </span>
                          )}
                        </div>
                        {l.justificativa && (
                          <div className="text-[11px] text-slate-500 italic truncate">
                            Motivo: {l.justificativa}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        <div>{catMap.get(l.categoriaId) || l.categoriaId}</div>
                        <div className="text-[10px] text-slate-400 uppercase">{l.tipo}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatNumberBR(l.quantidade)} {l.unidade} × {formatBRL(l.valorUnitario)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatBRL(valNoPolo)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`font-semibold uppercase text-[11px] ${
                            l.status === 'aprovado'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : l.status === 'pendente'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {l.status === 'pendente' && canApproveLaunches && (
                            <>
                              <button
                                type="button"
                                aria-label={`Aprovar ${l.descricao}`}
                                onClick={() => updateLancamentoStatus(l.id, 'aprovado')}
                                className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded"
                              >
                                Aprovar
                              </button>
                              <button
                                type="button"
                                aria-label={`Rejeitar ${l.descricao}`}
                                onClick={() => updateLancamentoStatus(l.id, 'rejeitado')}
                                className="px-2 py-1 text-[11px] font-medium text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 rounded"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}

                          {editable && (
                            <button
                              type="button"
                              aria-label={`Editar ${l.descricao}`}
                              onClick={() => openEditModal(l)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canCreateLaunches && (
                            <button
                              type="button"
                              aria-label={`Duplicar ${l.descricao}`}
                              onClick={() => duplicateLancamento(l)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {editable &&
                            (confirmDeleteId === l.id ? (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    softDeleteLancamento(l.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-0.5 text-[10px] font-semibold text-white bg-red-600 rounded"
                                >
                                  Excluir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-0.5 text-[10px] text-slate-600 bg-slate-100 rounded"
                                >
                                  Não
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Excluir ${l.descricao}`}
                                onClick={() => setConfirmDeleteId(l.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950/50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
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
                className="px-3 py-1 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Novo / Editar Lançamento */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-lancamento-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3
                id="modal-lancamento-titulo"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                {editingId ? 'Editar Lançamento' : 'Novo Lançamento de Gasto'}
              </h3>
              <button
                type="button"
                aria-label="Fechar formulário"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="lanc-data"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Data da Despesa *
                  </label>
                  <input
                    id="lanc-data"
                    type="date"
                    required
                    value={formData.data}
                    onChange={(e) => setFormData((prev) => ({ ...prev, data: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lanc-polo"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Polo Principal *
                  </label>
                  <select
                    id="lanc-polo"
                    required
                    value={formData.poloId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, poloId: e.target.value }))}
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
                  <label
                    htmlFor="lanc-categoria"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Categoria *
                  </label>
                  <select
                    id="lanc-categoria"
                    required
                    value={formData.categoriaId}
                    onChange={(e) => {
                      const cat = categorias.find((c) => c.id === e.target.value);
                      setFormData((prev) => ({
                        ...prev,
                        categoriaId: e.target.value,
                        tipo: cat?.tipo || prev.tipo,
                      }));
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {categorias
                      .filter((c) => c.ativa)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} ({c.tipo === 'marketing' ? 'Marketing' : 'Interno'})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Catálogo de Itens + Descrição */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="lanc-item-catalogo"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Item Padronizado (Opcional)
                  </label>
                  <select
                    id="lanc-item-catalogo"
                    value={formData.itemId}
                    onChange={(e) => handleSelectCatalogItem(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Digitar descrição livre...</option>
                    {itens.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.nome} ({it.unidade})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-7">
                  <label
                    htmlFor="lanc-descricao"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Descrição do Item ou Serviço *
                  </label>
                  <input
                    id="lanc-descricao"
                    type="text"
                    required
                    placeholder="Ex: Compra de cartuchos de toner / Manutenção ar-condicionado"
                    value={formData.descricao}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, descricao: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* Quantidade, Unidade, Valor Unitário e Total Calculado Automaticamente */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <div>
                  <label
                    htmlFor="lanc-qtd"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Quantidade *
                  </label>
                  <input
                    id="lanc-qtd"
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={formData.quantidade}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        quantidade: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lanc-unidade"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Unidade
                  </label>
                  <input
                    id="lanc-unidade"
                    type="text"
                    value={formData.unidade}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, unidade: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lanc-valor-unit"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Valor Unitário (R$) *
                  </label>
                  <input
                    id="lanc-valor-unit"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={formData.valorUnitario}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        valorUnitario: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Valor Total Calculado
                  </div>
                  <div
                    data-testid="form-valor-total-calculado"
                    className="px-3 py-2 text-sm font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg"
                  >
                    {formatBRL(valorTotalCalculado)}
                  </div>
                </div>
              </div>

              {/* Approval Threshold Warning */}
              {willBePending && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Valor acima do limite de aprovação automática (
                    <strong>{formatBRL(rede?.config.limiteAprovacao || 500)}</strong>). Este
                    lançamento ficará com status <strong>PENDENTE</strong> até aprovação do Gestor
                    ou Admin.
                  </span>
                </div>
              )}

              {/* Fornecedor, Forma de Pagamento e Campanha (se Marketing) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="lanc-fornecedor"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Fornecedor
                  </label>
                  <select
                    id="lanc-fornecedor"
                    value={formData.fornecedorId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, fornecedorId: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Fornecedor avulso / Não cadastrado</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>

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
                    <option value="Boleto Faturado 28d">Boleto Faturado 28d</option>
                    <option value="Cartão Corporativo">Cartão Corporativo</option>
                    <option value="Transferência TED">Transferência TED</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="lanc-campanha"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Campanha de Marketing
                  </label>
                  <select
                    id="lanc-campanha"
                    value={formData.campanhaId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, campanhaId: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Sem campanha vinculada</option>
                    {campanhas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Emergencial Toggle & Justificativa */}
              <div className="space-y-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.emergencial}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, emergencial: e.target.checked }))
                    }
                    className="rounded border-slate-300"
                  />
                  Marcar como Compra Emergencial (fora do planejamento mensal)
                </label>

                <div>
                  <label
                    htmlFor="lanc-justificativa"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Justificativa / Motivo {requiresJustificativa ? '* (Obrigatório)' : '(Opcional)'}
                  </label>
                  <textarea
                    id="lanc-justificativa"
                    rows={2}
                    required={requiresJustificativa}
                    placeholder={
                      requiresJustificativa
                        ? 'Explique obrigatoriamente o motivo da compra emergencial ou da despesa diversa...'
                        : 'Observações adicionais sobre o lançamento...'
                    }
                    value={formData.justificativa}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, justificativa: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* Rateio entre Polos */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.rateioAtivo}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          rateioAtivo: e.target.checked,
                          rateioPoloIds:
                            prev.rateioPoloIds.length > 0
                              ? prev.rateioPoloIds
                              : allPolos.map((p) => p.id),
                        }))
                      }
                      className="rounded border-slate-300"
                    />
                    <Split className="w-4 h-4 text-emerald-600" />
                    Ratear (dividir) este gasto entre múltiplos polos
                  </label>

                  {formData.rateioAtivo && (
                    <select
                      aria-label="Critério de Rateio"
                      value={formData.rateioCriterio}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          rateioCriterio: e.target.value as CriterioRateio,
                        }))
                      }
                      className="px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
                    >
                      <option value="proporcional">
                        Proporcional a {rede?.config.rotuloTamanho || 'Alunos ativos'}
                      </option>
                      <option value="igual">Divisão Igualitária</option>
                      <option value="manual">Valores Manuais</option>
                    </select>
                  )}
                </div>

                {formData.rateioAtivo && (
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] text-slate-500">
                      Selecione os polos participantes do rateio (a soma fecha exatamente{' '}
                      <strong>{formatBRL(valorTotalCalculado)}</strong>):
                    </div>
                    <div className="space-y-2">
                      {allPolos.map((p) => {
                        const isSelected = formData.rateioPoloIds.includes(p.id);
                        const parte = formData.rateioPartes.find((pt) => pt.poloId === p.id);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                          >
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setFormData((prev) => {
                                    const nextIds = checked
                                      ? [...prev.rateioPoloIds, p.id]
                                      : prev.rateioPoloIds.filter((id) => id !== p.id);
                                    return {
                                      ...prev,
                                      rateioPoloIds: nextIds,
                                      rateioCriterio:
                                        prev.rateioCriterio === 'manual'
                                          ? 'proporcional'
                                          : prev.rateioCriterio,
                                    };
                                  });
                                }}
                                className="rounded border-slate-300"
                              />
                              <span className="font-medium">{p.nome}</span>
                              <span className="text-[11px] text-slate-400">
                                ({p.indicadorTamanho} {rede?.config.rotuloTamanho})
                              </span>
                            </label>

                            {isSelected && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  aria-label={`Valor rateio ${p.nome}`}
                                  value={parte?.valor ?? 0}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setFormData((prev) => ({
                                      ...prev,
                                      rateioCriterio: 'manual',
                                      rateioPartes: prev.rateioPartes.map((pt) =>
                                        pt.poloId === p.id ? { ...pt, valor: val } : pt
                                      ),
                                    }));
                                  }}
                                  className="w-28 px-2 py-1 text-right font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 font-mono">
                      <span>Soma das partes:</span>
                      <span
                        className={
                          validateRateioSum(valorTotalCalculado, formData.rateioPartes)
                            ? 'text-emerald-600 font-bold'
                            : 'text-red-600 font-bold'
                        }
                      >
                        {formatBRL(
                          formData.rateioPartes.reduce((acc, pt) => acc + (pt.valor || 0), 0)
                        )}{' '}
                        / {formatBRL(valorTotalCalculado)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg hover:opacity-90"
                >
                  <Check className="w-4 h-4" />
                  {submitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
