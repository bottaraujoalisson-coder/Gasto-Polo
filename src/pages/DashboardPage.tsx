import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  FileText,
  Filter,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  calculateMonthlyVariation,
  formatBRL,
  formatDateBR,
  formatMonthBR,
  formatPct,
  getLancamentoValorNoPolo,
  getLastNMonths,
  getPreviousMonth,
  roundCents,
} from '../utils/financeRules';

export const DashboardPage: React.FC = () => {
  const {
    visiblePolos,
    categorias,
    lancamentos,
    selectedMonth,
    setSelectedMonth,
    selectedPoloId,
    setSelectedPoloId,
    canCreateLaunches,
  } = useApp();

  const navigate = useNavigate();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');

  const prevMonth = useMemo(() => getPreviousMonth(selectedMonth), [selectedMonth]);
  const currentYear = useMemo(() => selectedMonth.slice(0, 4), [selectedMonth]);

  const activePoloIds = useMemo(
    () => new Set(visiblePolos.filter((p) => p.ativo).map((p) => p.id)),
    [visiblePolos]
  );

  const validExpenses = useMemo(() => {
    return lancamentos.filter((l) => {
      if (l.excluido || l.status === 'rejeitado') return false;
      if (selectedCategoryId !== 'ALL' && l.categoriaId !== selectedCategoryId) return false;
      if (selectedPoloId === 'ALL') {
        return activePoloIds.has(l.poloId);
      }
      return getLancamentoValorNoPolo(l, selectedPoloId) > 0;
    });
  }, [lancamentos, selectedCategoryId, selectedPoloId, activePoloIds]);

  const summary = useMemo(() => {
    const monthLaunches = validExpenses.filter((l) => l.competencia === selectedMonth);
    const prevMonthLaunches = validExpenses.filter((l) => l.competencia === prevMonth);
    const yearLaunches = validExpenses.filter((l) => l.data.startsWith(currentYear));

    const totalMes = roundCents(
      monthLaunches.reduce(
        (acc, l) =>
          acc +
          getLancamentoValorNoPolo(
            l,
            selectedPoloId,
            selectedPoloId === 'ALL' ? Array.from(activePoloIds) : undefined
          ),
        0
      )
    );

    const totalMesAnterior = roundCents(
      prevMonthLaunches.reduce(
        (acc, l) =>
          acc +
          getLancamentoValorNoPolo(
            l,
            selectedPoloId,
            selectedPoloId === 'ALL' ? Array.from(activePoloIds) : undefined
          ),
        0
      )
    );

    const totalAno = roundCents(
      yearLaunches.reduce(
        (acc, l) =>
          acc +
          getLancamentoValorNoPolo(
            l,
            selectedPoloId,
            selectedPoloId === 'ALL' ? Array.from(activePoloIds) : undefined
          ),
        0
      )
    );

    const variacaoPct = calculateMonthlyVariation(totalMes, totalMesAnterior);
    const activePolosList = visiblePolos.filter((p) => p.ativo);

    const gastosPorPoloList = activePolosList
      .map((p) => {
        const valorMes = roundCents(
          monthLaunches.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, p.id), 0)
        );
        const valorMesAnterior = roundCents(
          prevMonthLaunches.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, p.id), 0)
        );
        const valorAno = roundCents(
          yearLaunches.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, p.id), 0)
        );
        return {
          polo: p,
          nome: p.nome,
          cidade: p.cidade,
          valorMes,
          valorMesAnterior,
          valorAno,
        };
      })
      .sort((a, b) => b.valorMes - a.valorMes);

    const maiorPolo =
      gastosPorPoloList.find((item) => item.valorMes > 0) || gastosPorPoloList[0] || null;

    return {
      totalMes,
      totalMesAnterior,
      totalAno,
      variacaoPct,
      qtdPolosAtivos: activePolosList.length,
      maiorPolo,
      gastosPorPoloList,
    };
  }, [
    validExpenses,
    selectedMonth,
    prevMonth,
    currentYear,
    selectedPoloId,
    activePoloIds,
    visiblePolos,
  ]);

  const despesasPorCategoria = useMemo(() => {
    const activeCategories = categorias.filter((c) => c.ativa);
    return activeCategories
      .map((cat) => {
        const mesAtual = roundCents(
          validExpenses
            .filter((l) => l.competencia === selectedMonth && l.categoriaId === cat.id)
            .reduce(
              (acc, l) =>
                acc +
                getLancamentoValorNoPolo(
                  l,
                  selectedPoloId,
                  selectedPoloId === 'ALL' ? Array.from(activePoloIds) : undefined
                ),
              0
            )
        );
        const mesAnterior = roundCents(
          validExpenses
            .filter((l) => l.competencia === prevMonth && l.categoriaId === cat.id)
            .reduce(
              (acc, l) =>
                acc +
                getLancamentoValorNoPolo(
                  l,
                  selectedPoloId,
                  selectedPoloId === 'ALL' ? Array.from(activePoloIds) : undefined
                ),
              0
            )
        );
        return {
          id: cat.id,
          nome: cat.nome,
          nomeCurto: cat.nome.length > 22 ? cat.nome.slice(0, 20) + '…' : cat.nome,
          mesAtual,
          mesAnterior,
        };
      })
      .filter((c) => c.mesAtual > 0 || c.mesAnterior > 0)
      .sort((a, b) => b.mesAtual - a.mesAtual);
  }, [categorias, validExpenses, selectedMonth, prevMonth, selectedPoloId, activePoloIds]);

  const evolucaoMensal = useMemo(() => {
    const months6 = getLastNMonths(selectedMonth, 6);
    return months6.map((m) => {
      const total = roundCents(
        validExpenses
          .filter((l) => l.competencia === m)
          .reduce(
            (acc, l) =>
              acc +
              getLancamentoValorNoPolo(
                l,
                selectedPoloId,
                selectedPoloId === 'ALL' ? Array.from(activePoloIds) : undefined
              ),
            0
          )
      );
      return {
        mes: formatMonthBR(m),
        competencia: m,
        total,
      };
    });
  }, [validExpenses, selectedMonth, selectedPoloId, activePoloIds]);

  const ultimasDespesas = useMemo(() => {
    return validExpenses
      .filter((l) => l.competencia === selectedMonth)
      .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, 6);
  }, [validExpenses, selectedMonth]);

  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);
  const poloMap = useMemo(() => new Map(visiblePolos.map((p) => [p.id, p.nome])), [visiblePolos]);

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Painel Geral — {formatMonthBR(selectedMonth)}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            ·{' '}
            {selectedPoloId === 'ALL'
              ? `${summary.qtdPolosAtivos} polos ativos`
              : poloMap.get(selectedPoloId) || selectedPoloId}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {canCreateLaunches && (
            <button
              type="button"
              onClick={() => navigate('/lancamentos?novo=1')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#002855] hover:bg-[#003875] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Despesa
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/relatorios')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Relatórios
          </button>
        </div>
      </div>

      {/* Compact Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Filter className="w-4 h-4 text-[#004B8D]" />
          <span>Filtros</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label htmlFor="dash-periodo" className="text-xs text-slate-500">
              Período:
            </label>
            <input
              id="dash-periodo"
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) setSelectedMonth(e.target.value);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="dash-polo" className="text-xs text-slate-500">
              Polo:
            </label>
            <select
              id="dash-polo"
              value={selectedPoloId}
              onChange={(e) => setSelectedPoloId(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              {visiblePolos.length > 1 && <option value="ALL">Todos os Polos Ativos</option>}
              {visiblePolos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="dash-categoria" className="text-xs text-slate-500">
              Categoria:
            </label>
            <select
              id="dash-categoria"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
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

          {(selectedPoloId !== 'ALL' || selectedCategoryId !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSelectedPoloId('ALL');
                setSelectedCategoryId('ALL');
              }}
              className="text-xs font-semibold text-[#004B8D] dark:text-blue-400 hover:underline cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total no Mês</span>
            <Calendar className="w-4 h-4 text-[#004B8D]" />
          </div>
          <div
            data-testid="kpi-total-mes"
            className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white"
          >
            {formatBRL(summary.totalMes)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
            <span>Ant: {formatBRL(summary.totalMesAnterior)}</span>
            {summary.variacaoPct !== null && (
              <span
                className={`inline-flex items-center font-mono font-semibold ${
                  summary.variacaoPct > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-[#004B8D] dark:text-blue-400'
                }`}
              >
                {summary.variacaoPct > 0 ? '+' : ''}
                {formatPct(summary.variacaoPct)}
                {summary.variacaoPct > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Acumulado no Ano ({currentYear})</span>
            <TrendingUp className="w-4 h-4 text-[#004B8D]" />
          </div>
          <div
            data-testid="kpi-total-ano"
            className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white"
          >
            {formatBRL(summary.totalAno)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            Exercício {currentYear}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Polos Ativos</span>
            <Building2 className="w-4 h-4 text-[#004B8D]" />
          </div>
          <div
            data-testid="kpi-polos-ativos"
            className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white"
          >
            {summary.qtdPolosAtivos}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between">
            <span>{visiblePolos.length} unidade(s)</span>
            <button
              type="button"
              onClick={() => navigate('/polos')}
              className="text-[#004B8D] dark:text-blue-400 font-semibold hover:underline cursor-pointer"
            >
              Polos
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Maior Volume no Mês
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white truncate">
            {summary.maiorPolo && summary.maiorPolo.valorMes > 0
              ? summary.maiorPolo.nome
              : 'Sem registros'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 font-mono tabular-nums">
            {summary.maiorPolo && summary.maiorPolo.valorMes > 0
              ? `${formatBRL(summary.maiorPolo.valorMes)} (${
                  summary.totalMes > 0
                    ? formatPct((summary.maiorPolo.valorMes / summary.totalMes) * 100)
                    : '0%'
                })`
              : 'R$ 0,00'}
          </div>
        </div>
      </div>

      {/* Row 1: Despesas por Polo & Evolução Mensal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Despesas por Polo — {formatMonthBR(selectedMonth)} vs {formatMonthBR(prevMonth)}
          </h3>

          {summary.gastosPorPoloList.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              Nenhum polo ativo encontrado.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.gastosPorPoloList}
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="nome" fontSize={11} />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={11} />
                  <Tooltip
                    formatter={(val: unknown) => formatBRL(Number(val ?? 0))}
                    contentStyle={{
                      backgroundColor: '#002855',
                      borderColor: '#003875',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    isAnimationActive={false}
                    dataKey="valorMes"
                    name={`Atual (${formatMonthBR(selectedMonth)})`}
                    fill="#004B8D"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="valorMesAnterior"
                    name={`Anterior (${formatMonthBR(prevMonth)})`}
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Evolução Mensal (Últimos 6 Meses)
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucaoMensal} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={11} />
                <Tooltip
                  formatter={(val: unknown) => formatBRL(Number(val ?? 0))}
                  contentStyle={{
                    backgroundColor: '#002855',
                    borderColor: '#003875',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#002855"
                  fill="#004B8D"
                  fillOpacity={0.22}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Despesas por Categoria & Comparativo entre Polos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Despesas por Categoria ({formatMonthBR(selectedMonth)} vs {formatMonthBR(prevMonth)})
          </h3>

          {despesasPorCategoria.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              Nenhuma despesa registrada no período.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={despesasPorCategoria}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    fontSize={11}
                  />
                  <YAxis type="category" dataKey="nomeCurto" width={135} fontSize={11} />
                  <Tooltip
                    formatter={(val: unknown) => formatBRL(Number(val ?? 0))}
                    contentStyle={{
                      backgroundColor: '#002855',
                      borderColor: '#003875',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    isAnimationActive={false}
                    dataKey="mesAtual"
                    name={`Atual (${formatMonthBR(selectedMonth)})`}
                    fill="#004B8D"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="mesAnterior"
                    name={`Anterior (${formatMonthBR(prevMonth)})`}
                    fill="#94a3b8"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Comparativo entre Polos
            </h3>
            {selectedPoloId !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedPoloId('ALL')}
                className="text-xs font-semibold text-[#004B8D] dark:text-blue-400 hover:underline cursor-pointer"
              >
                Todos os Polos
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-2 font-medium">Polo</th>
                  <th className="py-2 px-2 font-medium text-right">Mês Anterior</th>
                  <th className="py-2 px-2 font-medium text-right">Mês Atual</th>
                  <th className="py-2 pl-2 font-medium text-right">Acumulado Ano</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {summary.gastosPorPoloList.map((item, idx) => {
                  const isSelected = selectedPoloId === item.polo.id;
                  return (
                    <tr
                      key={item.polo.id}
                      onClick={() => setSelectedPoloId(isSelected ? 'ALL' : item.polo.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-white">
                        {idx + 1}. {item.nome}
                        <span className="block text-[11px] font-normal text-slate-500">
                          {item.cidade}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatBRL(item.valorMesAnterior)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        {formatBRL(item.valorMes)}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatBRL(item.valorAno)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Lançamentos Recentes ({formatMonthBR(selectedMonth)})
              </span>
              <button
                type="button"
                onClick={() => navigate('/lancamentos')}
                className="text-xs font-medium text-[#004B8D] dark:text-blue-400 hover:underline cursor-pointer"
              >
                Ver todos
              </button>
            </div>
            {ultimasDespesas.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Nenhum lançamento no período.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {ultimasDespesas.map((l) => (
                  <div key={l.id} className="py-1.5 flex items-center justify-between gap-2">
                    <div className="truncate">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {l.descricao}
                      </span>
                      <span className="text-slate-500 ml-2">
                        {formatDateBR(l.data)} · {poloMap.get(l.poloId) || l.poloId} ·{' '}
                        {catMap.get(l.categoriaId) || 'Geral'}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">
                      {formatBRL(getLancamentoValorNoPolo(l, selectedPoloId))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
