import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  formatBRL,
  formatDateBR,
  formatMonthBR,
  getCurrentMonthSaoPaulo,
  getLastNMonths,
  getSelectableMonths,
  getLancamentoValorNoPolo,
} from '../utils/financeRules';
import {
  exportCorporateReportExcel,
  exportCorporateReportPDF,
  ConsolidatedCategoryRow,
  MonthlyEvolutionRow,
  PoloReportRow,
  DetailedExpenseRow,
} from '../utils/exportUtils';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Building2,
  PieChart as PieChartIcon,
  ListFilter,
  Award,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

type ReportTab = 'consolidado' | 'por_polo' | 'detalhamento';
type PeriodMode = 'mes' | 'ano' | 'personalizado';

export const RelatorioPage: React.FC = () => {
  const {
    rede,
    visiblePolos,
    categorias,
    lancamentos,
    selectedMonth,
    setSelectedMonth,
    selectedPoloId,
    setSelectedPoloId,
  } = useApp();

  const [activeTab, setActiveTab] = useState<ReportTab>('consolidado');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('mes');
  const [selectedYear, setSelectedYear] = useState<string>(selectedMonth.slice(0, 4));
  const [customStartDate, setCustomStartDate] = useState<string>(`${selectedMonth}-01`);
  const [customEndDate, setCustomEndDate] = useState<string>(`${selectedMonth}-31`);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('ALL');

  const months = useMemo(
    () => getSelectableMonths(getCurrentMonthSaoPaulo(), selectedMonth, 14, 2),
    [selectedMonth]
  );

  const filteredLancamentos = useMemo(() => {
    return lancamentos.filter((l) => {
      if (l.excluido || l.status === 'rejeitado') return false;

      if (periodMode === 'mes') {
        if (!l.data.startsWith(selectedMonth)) return false;
      } else if (periodMode === 'ano') {
        if (!l.data.startsWith(selectedYear)) return false;
      } else {
        if (customStartDate && l.data < customStartDate) return false;
        if (customEndDate && l.data > customEndDate) return false;
      }

      if (selectedCategoriaId !== 'ALL' && l.categoriaId !== selectedCategoriaId) {
        return false;
      }

      const val = getLancamentoValorNoPolo(l, selectedPoloId);
      return val > 0;
    });
  }, [
    lancamentos,
    periodMode,
    selectedMonth,
    selectedYear,
    customStartDate,
    customEndDate,
    selectedCategoriaId,
    selectedPoloId,
  ]);

  const totalAcumulado = useMemo(() => {
    return filteredLancamentos.reduce(
      (acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId),
      0
    );
  }, [filteredLancamentos, selectedPoloId]);

  const periodoLabel = useMemo(() => {
    if (periodMode === 'mes') {
      return formatMonthBR(selectedMonth);
    }
    if (periodMode === 'ano') {
      return `Ano ${selectedYear}`;
    }
    return `${formatDateBR(customStartDate)} até ${formatDateBR(customEndDate)}`;
  }, [periodMode, selectedMonth, selectedYear, customStartDate, customEndDate]);

  const poloFiltroLabel = useMemo(() => {
    if (selectedPoloId === 'ALL') return 'Todos os Polos';
    return visiblePolos.find((p) => p.id === selectedPoloId)?.nome || 'Polo Selecionado';
  }, [selectedPoloId, visiblePolos]);

  const byCategory: ConsolidatedCategoryRow[] = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number }>();
    filteredLancamentos.forEach((l) => {
      const catName = categorias.find((c) => c.id === l.categoriaId)?.nome || 'Outros';
      const val = getLancamentoValorNoPolo(l, selectedPoloId);
      const curr = map.get(catName) || { valor: 0, qtd: 0 };
      map.set(catName, { valor: curr.valor + val, qtd: curr.qtd + 1 });
    });

    return Array.from(map.entries())
      .map(([categoria, { valor, qtd }]) => ({
        categoria,
        valor,
        qtd,
        percentual: totalAcumulado > 0 ? (valor / totalAcumulado) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [filteredLancamentos, categorias, selectedPoloId, totalAcumulado]);

  const monthlyEvolution: MonthlyEvolutionRow[] = useMemo(() => {
    const last6 = getLastNMonths(getCurrentMonthSaoPaulo(), 6);
    return last6.map((m) => {
      const valor = lancamentos
        .filter((l) => !l.excluido && l.status !== 'rejeitado' && l.data.startsWith(m))
        .filter((l) => selectedCategoriaId === 'ALL' || l.categoriaId === selectedCategoriaId)
        .reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0);
      return {
        mes: formatMonthBR(m),
        valor,
      };
    });
  }, [lancamentos, selectedCategoriaId, selectedPoloId]);

  const byPolo: PoloReportRow[] = useMemo(() => {
    const raw = visiblePolos.map((p) => {
      let valorPeriodo = 0;
      let qtdLancamentos = 0;

      lancamentos
        .filter((l) => !l.excluido && l.status !== 'rejeitado')
        .filter((l) => {
          if (periodMode === 'mes') return l.data.startsWith(selectedMonth);
          if (periodMode === 'ano') return l.data.startsWith(selectedYear);
          if (customStartDate && l.data < customStartDate) return false;
          if (customEndDate && l.data > customEndDate) return false;
          return true;
        })
        .filter((l) => selectedCategoriaId === 'ALL' || l.categoriaId === selectedCategoriaId)
        .forEach((l) => {
          const val = getLancamentoValorNoPolo(l, p.id);
          if (val > 0) {
            valorPeriodo += val;
            qtdLancamentos += 1;
          }
        });

      return {
        poloId: p.id,
        poloNome: p.nome,
        cidade: p.cidade,
        status: p.ativo ? 'Ativo' : 'Inativo',
        valorPeriodo,
        qtdLancamentos,
      };
    });

    const sumAllPolos = raw.reduce((acc, r) => acc + r.valorPeriodo, 0);

    return raw
      .sort((a, b) => b.valorPeriodo - a.valorPeriodo)
      .map((item, idx) => ({
        ...item,
        posicao: idx + 1,
        percentual: sumAllPolos > 0 ? (item.valorPeriodo / sumAllPolos) * 100 : 0,
      }));
  }, [
    visiblePolos,
    lancamentos,
    periodMode,
    selectedMonth,
    selectedYear,
    customStartDate,
    customEndDate,
    selectedCategoriaId,
  ]);

  const detailedExpenses: DetailedExpenseRow[] = useMemo(() => {
    const poloMap = new Map(visiblePolos.map((p) => [p.id, p.nome]));
    const catMap = new Map(categorias.map((c) => [c.id, c.nome]));

    return [...filteredLancamentos]
      .sort((a, b) => b.data.localeCompare(a.data))
      .map((l) => ({
        id: l.id,
        data: l.data,
        descricao: l.descricao,
        categoria: catMap.get(l.categoriaId) || 'Outros',
        polo: poloMap.get(l.poloId) || 'Polo',
        formaPagamento: l.formaPagamento || '-',
        observacoes: l.justificativa || '',
        valor: getLancamentoValorNoPolo(l, selectedPoloId),
      }));
  }, [filteredLancamentos, visiblePolos, categorias, selectedPoloId]);

  const handleExportPDF = () => {
    exportCorporateReportPDF({
      reportType: activeTab,
      empresaNome: rede?.nome || 'Unimar',
      periodoLabel,
      poloFiltroLabel,
      totalAcumulado,
      byCategory,
      monthlyEvolution,
      byPolo,
      detailedExpenses,
    });
  };

  const handleExportExcel = () => {
    exportCorporateReportExcel({
      reportType: activeTab,
      empresaNome: rede?.nome || 'Unimar',
      periodoLabel,
      totalAcumulado,
      byCategory,
      monthlyEvolution,
      byPolo,
      detailedExpenses,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Botões de Exportação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Relatórios Financeiros
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#002855] dark:text-blue-400" />
            Exportar CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#002855] hover:bg-[#003875] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Abas dos 3 Relatórios */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setActiveTab('consolidado')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'consolidado'
              ? 'bg-[#002855] text-white border-[#002855] shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            <span className="text-sm font-bold">Consolidado</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('por_polo')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'por_polo'
              ? 'bg-[#002855] text-white border-[#002855] shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="text-sm font-bold">Por Polo (Ranking)</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('detalhamento')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'detalhamento'
              ? 'bg-[#002855] text-white border-[#002855] shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-bold">Detalhamento de Despesas</span>
          </div>
        </button>
      </div>

      {/* Filtros de Período, Polo e Categoria */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <ListFilter className="w-4 h-4 text-[#002855] dark:text-blue-400" />
          <span>Filtros:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Período
            </label>
            <select
              value={periodMode}
              onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              <option value="mes">Mês específico</option>
              <option value="ano">Ano completo</option>
              <option value="personalizado">Intervalo de datas</option>
            </select>
          </div>

          {periodMode === 'mes' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Mês de Referência
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthBR(m)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodMode === 'ano' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Ano</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>
          )}

          {periodMode === 'personalizado' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">De</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Até</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Polo / Unidade
            </label>
            <select
              value={selectedPoloId}
              onChange={(e) => setSelectedPoloId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              <option value="ALL">Todos os Polos ({visiblePolos.length})</option>
              {visiblePolos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Categoria
            </label>
            <select
              value={selectedCategoriaId}
              onChange={(e) => setSelectedCategoriaId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              <option value="ALL">Todas as Categorias</option>
              {categorias
                .filter((c) => c.ativa)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Faixa de Resumo do Período */}
      <div className="bg-[#002855] text-white p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">
            Total Acumulado ({periodoLabel})
          </span>
          <p className="text-2xl sm:text-3xl font-bold mt-1 tabular-nums">
            {formatBRL(totalAcumulado)}
          </p>
          <p className="text-xs text-blue-100/80 mt-0.5">
            {poloFiltroLabel} • {filteredLancamentos.length} lançamentos
          </p>
        </div>
      </div>

      {/* CONTEÚDO: RELATÓRIO 1 — CONSOLIDADO DA EMPRESA */}
      {activeTab === 'consolidado' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Despesas por Categoria */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Despesas por Categoria
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Categoria</th>
                    <th className="py-2.5 px-3 text-center">Qtd.</th>
                    <th className="py-2.5 px-3 text-right">Valor</th>
                    <th className="py-2.5 px-3 text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {byCategory.map((c) => (
                    <tr key={c.categoria} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                        {c.categoria}
                      </td>
                      <td className="py-2.5 px-3 text-center text-xs text-slate-500 tabular-nums">
                        {c.qtd}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white tabular-nums">
                        {formatBRL(c.valor)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs font-semibold text-[#004B8D] dark:text-blue-400 tabular-nums">
                        {c.percentual.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {byCategory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                        Nenhuma despesa registrada neste período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Evolução Mensal */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Evolução Mensal (6 Meses)
              </h3>
              <TrendingUp className="w-4 h-4 text-[#002855] dark:text-blue-400" />
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                  <Bar
                    dataKey="valor"
                    name="Total no Mês"
                    fill="#002855"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO: RELATÓRIO 2 — POR POLO */}
      {activeTab === 'por_polo' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Ranking e Comparativo por Polo
            </h3>
            <Award className="w-5 h-5 text-[#004B8D] dark:text-blue-400" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/60 dark:bg-slate-800/40">
                  <th className="py-3.5 px-4">Posição</th>
                  <th className="py-3.5 px-4">Polo / Unidade</th>
                  <th className="py-3.5 px-4">Cidade</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Lançamentos</th>
                  <th className="py-3.5 px-4 text-right">Total de Despesas</th>
                  <th className="py-3.5 px-4 text-right">% Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {byPolo.map((p) => (
                  <tr key={p.poloId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-[#002855] dark:text-blue-300 tabular-nums">
                      {p.posicao}º
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {p.poloNome}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{p.cidade}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-semibold ${
                          p.status === 'Ativo'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300 tabular-nums">
                      {p.qtdLancamentos}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatBRL(p.valorPeriodo)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#004B8D] rounded-full"
                            style={{ width: `${Math.min(100, p.percentual)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-12 text-right tabular-nums">
                          {p.percentual.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {byPolo.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Nenhum polo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO: RELATÓRIO 3 — DETALHAMENTO */}
      {activeTab === 'detalhamento' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Detalhamento de Despesas ({detailedExpenses.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/60 dark:bg-slate-800/40">
                  <th className="py-3.5 px-4">Data</th>
                  <th className="py-3.5 px-4">Descrição</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Polo</th>
                  <th className="py-3.5 px-4">Pagamento</th>
                  <th className="py-3.5 px-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {detailedExpenses.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateBR(d.data)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{d.descricao}</p>
                      {d.observacoes && (
                        <p className="text-xs text-slate-500 truncate max-w-md">{d.observacoes}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {d.categoria}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {d.polo}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{d.formaPagamento}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatBRL(d.valor)}
                    </td>
                  </tr>
                ))}
                {detailedExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Nenhuma despesa encontrada para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
              {detailedExpenses.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white">
                    <td colSpan={5} className="py-3.5 px-4 text-right">
                      Total Acumulado no Período:
                    </td>
                    <td className="py-3.5 px-4 text-right text-[#002855] dark:text-blue-400 tabular-nums">
                      {formatBRL(totalAcumulado)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatorioPage;
