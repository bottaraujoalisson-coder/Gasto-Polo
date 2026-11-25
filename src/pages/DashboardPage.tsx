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
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  calculateMonthlyVariation,
  formatBRL,
  formatDateBR,
  formatMonthBR,
  formatNumberBR,
  formatPct,
  getBudgetTrafficLight,
  getLancamentoValorNoPolo,
  getLastNMonths,
  getPreviousMonth,
  roundCents,
} from '../utils/financeRules';

export const DashboardPage: React.FC = () => {
  const {
    rede,
    visiblePolos,
    categorias,
    itens,
    lancamentos,
    orcamentos,
    alertas,
    selectedMonth,
    selectedPoloId,
    canCreateLaunches,
    canApproveLaunches,
    updateLancamentoStatus,
  } = useApp();

  const navigate = useNavigate();
  const [topItemsTab, setTopItemsTab] = useState<'valor' | 'quantidade'>('valor');

  const prevMonth = useMemo(() => getPreviousMonth(selectedMonth), [selectedMonth]);

  // 1. Core KPIs for selectedMonth and selectedPoloId (ONLY approved & non-deleted launches enter totals!)
  const kpis = useMemo(() => {
    const approvedCurrent = lancamentos.filter(
      (l) => !l.excluido && l.status === 'aprovado' && l.competencia === selectedMonth
    );
    const approvedPrev = lancamentos.filter(
      (l) => !l.excluido && l.status === 'aprovado' && l.competencia === prevMonth
    );
    const pendingCurrent = lancamentos.filter(
      (l) => !l.excluido && l.status === 'pendente' && l.competencia === selectedMonth
    );

    const totalMes = roundCents(
      approvedCurrent.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
    );
    const totalMesAnterior = roundCents(
      approvedPrev.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
    );
    const totalPendente = roundCents(
      pendingCurrent.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
    );
    const totalEmergencial = roundCents(
      approvedCurrent
        .filter((l) => l.emergencial)
        .reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
    );

    const tetoTotal = roundCents(
      orcamentos
        .filter(
          (o) =>
            o.mes === selectedMonth &&
            (selectedPoloId === 'ALL' || o.poloId === selectedPoloId)
        )
        .reduce((acc, o) => acc + o.teto, 0)
    );

    const variacaoPct = calculateMonthlyVariation(totalMes, totalMesAnterior);
    const pctTeto = tetoTotal > 0 ? roundCents((totalMes / tetoTotal) * 100) : null;
    const pctEmergencial = totalMes > 0 ? roundCents((totalEmergencial / totalMes) * 100) : 0;

    return {
      totalMes,
      totalMesAnterior,
      variacaoPct,
      tetoTotal,
      pctTeto,
      totalEmergencial,
      pctEmergencial,
      totalPendente,
      qtdPendentes: pendingCurrent.filter((l) => getLancamentoValorNoPolo(l, selectedPoloId) > 0)
        .length,
    };
  }, [lancamentos, orcamentos, selectedMonth, prevMonth, selectedPoloId]);

  // 2. Gastos por Categoria chart data
  const gastosPorCategoria = useMemo(() => {
    return categorias
      .filter((c) => c.ativa)
      .map((cat) => {
        const gasto = roundCents(
          lancamentos
            .filter(
              (l) =>
                !l.excluido &&
                l.status === 'aprovado' &&
                l.competencia === selectedMonth &&
                l.categoriaId === cat.id
            )
            .reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
        );
        const teto = roundCents(
          orcamentos
            .filter(
              (o) =>
                o.mes === selectedMonth &&
                o.categoriaId === cat.id &&
                (selectedPoloId === 'ALL' || o.poloId === selectedPoloId)
            )
            .reduce((acc, o) => acc + o.teto, 0)
        );
        const pct = teto > 0 ? roundCents((gasto / teto) * 100) : null;
        return {
          id: cat.id,
          nome: cat.nome,
          nomeCurto: cat.nome.length > 22 ? cat.nome.slice(0, 20) + '…' : cat.nome,
          tipo: cat.tipo,
          gasto,
          teto,
          pct,
        };
      })
      .filter((c) => c.gasto > 0 || c.teto > 0)
      .sort((a, b) => b.gasto - a.gasto);
  }, [categorias, lancamentos, orcamentos, selectedMonth, selectedPoloId]);

  // 3. Evolução de 12 meses
  const evolucao12Meses = useMemo(() => {
    const months12 = getLastNMonths(selectedMonth, 12);
    return months12.map((m) => {
      const mLaunches = lancamentos.filter(
        (l) => !l.excluido && l.status === 'aprovado' && l.competencia === m
      );
      const aprovado = roundCents(
        mLaunches.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
      );
      const emergencial = roundCents(
        mLaunches
          .filter((l) => l.emergencial)
          .reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
      );
      const teto = roundCents(
        orcamentos
          .filter(
            (o) => o.mes === m && (selectedPoloId === 'ALL' || o.poloId === selectedPoloId)
          )
          .reduce((acc, o) => acc + o.teto, 0)
      );
      return {
        mes: formatMonthBR(m),
        competencia: m,
        aprovado,
        emergencial,
        teto,
      };
    });
  }, [lancamentos, orcamentos, selectedMonth, selectedPoloId]);

  // 4. Ranking entre Polos (total, % do teto, gasto por indicadorTamanho)
  const rankingPolos = useMemo(() => {
    return visiblePolos
      .filter((p) => p.ativo)
      .map((polo) => {
        const gasto = roundCents(
          lancamentos
            .filter((l) => !l.excluido && l.status === 'aprovado' && l.competencia === selectedMonth)
            .reduce((acc, l) => acc + getLancamentoValorNoPolo(l, polo.id), 0)
        );
        const teto = roundCents(
          orcamentos
            .filter((o) => o.mes === selectedMonth && o.poloId === polo.id)
            .reduce((acc, o) => acc + o.teto, 0)
        );
        const pctTeto = teto > 0 ? roundCents((gasto / teto) * 100) : null;
        const gastoPorIndicador =
          polo.indicadorTamanho > 0 ? roundCents(gasto / polo.indicadorTamanho) : 0;
        return {
          polo,
          gasto,
          teto,
          pctTeto,
          gastoPorIndicador,
        };
      })
      .sort((a, b) => b.gasto - a.gasto);
  }, [visiblePolos, lancamentos, orcamentos, selectedMonth]);

  // 5. Top 10 Itens por valor e por quantidade
  const top10Itens = useMemo(() => {
    const itemMap = new Map(itens.map((i) => [i.id, i.nome]));
    const catMap = new Map(categorias.map((c) => [c.id, c.nome]));
    const agg = new Map<
      string,
      { nome: string; categoria: string; unidade: string; valor: number; quantidade: number }
    >();

    const monthApproved = lancamentos.filter(
      (l) => !l.excluido && l.status === 'aprovado' && l.competencia === selectedMonth
    );

    for (const l of monthApproved) {
      const valNoPolo = getLancamentoValorNoPolo(l, selectedPoloId);
      if (valNoPolo <= 0) continue;
      const ratio = l.valorTotal > 0 ? valNoPolo / l.valorTotal : 1;
      const key = l.itemId || l.descricao.trim().toLowerCase();
      const label = itemMap.get(l.itemId) || l.descricao;
      const curr = agg.get(key) || {
        nome: label,
        categoria: catMap.get(l.categoriaId) || 'Geral',
        unidade: l.unidade || 'un',
        valor: 0,
        quantidade: 0,
      };
      curr.valor = roundCents(curr.valor + valNoPolo);
      curr.quantidade = roundCents(curr.quantidade + (l.quantidade || 1) * ratio);
      agg.set(key, curr);
    }

    const list = Array.from(agg.values());
    const byValor = [...list].sort((a, b) => b.valor - a.valor).slice(0, 10);
    const byQuantidade = [...list].sort((a, b) => b.quantidade - a.quantidade).slice(0, 10);
    return { byValor, byQuantidade };
  }, [lancamentos, itens, categorias, selectedMonth, selectedPoloId]);

  // 6. Histórico recente de lançamentos
  const historicoRecente = useMemo(() => {
    return lancamentos
      .filter((l) => !l.excluido && getLancamentoValorNoPolo(l, selectedPoloId) > 0)
      .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, 8);
  }, [lancamentos, selectedPoloId]);

  const trafficColor = getBudgetTrafficLight(kpis.pctTeto, rede?.config);

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Painel Executivo — {formatMonthBR(selectedMonth)}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Somente lançamentos aprovados compõem os totais. Lançamentos pendentes são exibidos à
            parte.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canCreateLaunches && (
            <button
              type="button"
              onClick={() => navigate('/lancamentos?novo=1')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Novo Lançamento
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/relatorio')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <FileText className="w-4 h-4" />
            Relatório Mensal PDF
          </button>
        </div>
      </div>

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total do Mês */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Gasto Aprovado no Mês
          </div>
          <div
            data-testid="kpi-total-mes"
            className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white"
          >
            {formatBRL(kpis.totalMes)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
            <span>Mês anterior: {formatBRL(kpis.totalMesAnterior)}</span>
            {kpis.qtdPendentes > 0 && (
              <button
                type="button"
                onClick={() => navigate('/lancamentos?status=pendente')}
                className="text-amber-600 dark:text-amber-400 font-medium underline"
              >
                +{kpis.qtdPendentes} pendente(s) ({formatBRL(kpis.totalPendente)})
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Variação vs Mês Anterior */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Variação vs Mês Anterior
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                (kpis.variacaoPct || 0) > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {(kpis.variacaoPct || 0) > 0 ? '+' : ''}
              {formatPct(kpis.variacaoPct)}
            </span>
            {(kpis.variacaoPct || 0) > 0 ? (
              <ArrowUpRight className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            Diferença: {formatBRL(kpis.totalMes - kpis.totalMesAnterior)} vs {formatMonthBR(prevMonth)}
          </div>
        </div>

        {/* Card 3: % do Teto Utilizado */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>% do Teto Utilizado</span>
            <span className="font-mono tabular-nums">
              {kpis.tetoTotal > 0 ? `Teto: ${formatBRL(kpis.tetoTotal)}` : 'Sem teto definido'}
            </span>
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              trafficColor === 'vermelho'
                ? 'text-red-600 dark:text-red-400'
                : trafficColor === 'amarelo'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {kpis.pctTeto !== null ? formatPct(kpis.pctTeto) : 'Sem teto'}
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                trafficColor === 'vermelho'
                  ? 'bg-red-600'
                  : trafficColor === 'amarelo'
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.min(100, kpis.pctTeto || 0)}%` }}
            />
          </div>
        </div>

        {/* Card 4: % de Compras Emergenciais */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Compras Emergenciais
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              kpis.pctEmergencial > 15
                ? 'text-red-600 dark:text-red-400'
                : kpis.pctEmergencial > 8
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {formatPct(kpis.pctEmergencial)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between">
            <span>Total emergencial: {formatBRL(kpis.totalEmergencial)}</span>
            {alertas.length > 0 && (
              <button
                type="button"
                onClick={() => navigate('/desperdicios')}
                className="text-red-600 dark:text-red-400 font-semibold underline"
              >
                {alertas.length} alerta(s)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row: Gastos por Categoria & Evolução 12 Meses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gastos por Categoria vs Teto */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Gastos por Categoria vs Teto ({formatMonthBR(selectedMonth)})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparativo entre despesa aprovada e orçamento mensal
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/orcamento')}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline"
            >
              Ajustar Tetos
            </button>
          </div>

          {gastosPorCategoria.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              Nenhum gasto registrado nesta competência.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={gastosPorCategoria}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    fontSize={11}
                  />
                  <YAxis
                    type="category"
                    dataKey="nomeCurto"
                    width={130}
                    fontSize={11}
                  />
                  <Tooltip
                    formatter={(val: unknown) => formatBRL(Number(val ?? 0))}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar isAnimationActive={false} dataKey="gasto" name="Gasto Aprovado" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar isAnimationActive={false} dataKey="teto" name="Teto Mensal" fill="#64748b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Evolução de 12 Meses */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Evolução de Gastos — Últimos 12 Meses
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Histórico mensal de gastos aprovados e compras emergenciais
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucao12Meses} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  fontSize={11}
                />
                <Tooltip
                  formatter={(val: unknown) => formatBRL(Number(val ?? 0))}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="aprovado"
                  name="Total Aprovado"
                  stroke="#0f172a"
                  fill="#10b981"
                  fillOpacity={0.25}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="emergencial"
                  name="Compras Emergenciais"
                  stroke="#dc2626"
                  fill="#ef4444"
                  fillOpacity={0.25}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Ranking entre Polos & Mapa de Calor Categoria x Polo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ranking entre Polos */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Ranking entre Polos ({formatMonthBR(selectedMonth)})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparativo por gasto total, % do teto e custo por {rede?.config.rotuloTamanho}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-2 font-medium">Polo</th>
                  <th className="py-2 px-2 font-medium text-right">Gasto Total</th>
                  <th className="py-2 px-2 font-medium text-right">% Teto</th>
                  <th className="py-2 pl-2 font-medium text-right">
                    R$ / {rede?.config.rotuloTamanho}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rankingPolos.map(({ polo, gasto, pctTeto, gastoPorIndicador }, idx) => {
                  const sem = getBudgetTrafficLight(pctTeto, rede?.config);
                  return (
                    <tr
                      key={polo.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-white">
                        {idx + 1}. {polo.nome}
                        <div className="text-[11px] font-normal text-slate-500">
                          {formatNumberBR(polo.indicadorTamanho)} {rede?.config.rotuloTamanho}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold">
                        {formatBRL(gasto)}
                      </td>
                      <td
                        className={`py-2.5 px-2 text-right font-mono tabular-nums font-semibold ${
                          sem === 'vermelho'
                            ? 'text-red-600 dark:text-red-400'
                            : sem === 'amarelo'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {pctTeto !== null ? formatPct(pctTeto) : 'Sem teto'}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono tabular-nums">
                        {formatBRL(gastoPorIndicador)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mapa de Calor Categoria x Polo */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Mapa de Calor: Categoria × Polo ({formatMonthBR(selectedMonth)})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Intensidade de uso do orçamento por unidade (Verde ≤ {rede?.config.alerta1Pct}%,
              Amarelo {rede?.config.alerta1Pct}–{rede?.config.alerta2Pct}%, Vermelho &gt;{' '}
              {rede?.config.alerta2Pct}%)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Categoria</th>
                  {visiblePolos.map((p) => (
                    <th key={p.id} className="py-2 px-2 font-medium text-right">
                      {p.nome.replace('Polo ', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {categorias
                  .filter((c) => c.ativa)
                  .map((cat) => (
                    <tr key={cat.id}>
                      <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">
                        {cat.nome}
                      </td>
                      {visiblePolos.map((polo) => {
                        const gasto = roundCents(
                          lancamentos
                            .filter(
                              (l) =>
                                !l.excluido &&
                                l.status === 'aprovado' &&
                                l.competencia === selectedMonth &&
                                l.categoriaId === cat.id
                            )
                            .reduce((acc, l) => acc + getLancamentoValorNoPolo(l, polo.id), 0)
                        );
                        const orc = orcamentos.find(
                          (o) =>
                            o.mes === selectedMonth &&
                            o.poloId === polo.id &&
                            o.categoriaId === cat.id
                        );
                        const pct = orc && orc.teto > 0 ? (gasto / orc.teto) * 100 : null;
                        const sem = getBudgetTrafficLight(pct, rede?.config);
                        return (
                          <td
                            key={polo.id}
                            className={`py-2 px-2 text-right font-mono tabular-nums ${
                              sem === 'vermelho'
                                ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-semibold'
                                : sem === 'amarelo'
                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-medium'
                                : gasto > 0
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                                : 'text-slate-400'
                            }`}
                          >
                            <div>{formatBRL(gasto)}</div>
                            <div className="text-[10px] opacity-80">
                              {pct !== null ? `${pct.toFixed(0)}% teto` : 's/ teto'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top 10 Itens & Histórico Recente */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top 10 Itens */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Top 10 Itens / Descrições ({formatMonthBR(selectedMonth)})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Maiores ofensores de custo ou volume consumido
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setTopItemsTab('valor')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  topItemsTab === 'valor'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Por Valor (R$)
              </button>
              <button
                type="button"
                onClick={() => setTopItemsTab('quantidade')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  topItemsTab === 'quantidade'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Por Quantidade
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-2 font-medium">Item / Descrição</th>
                  <th className="py-2 px-2 font-medium">Categoria</th>
                  <th className="py-2 px-2 font-medium text-right">Qtd</th>
                  <th className="py-2 pl-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(topItemsTab === 'valor' ? top10Itens.byValor : top10Itens.byQuantidade).map(
                  (item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 pr-2 font-medium text-slate-900 dark:text-white">
                        {idx + 1}. {item.nome}
                      </td>
                      <td className="py-2 px-2 text-slate-500 dark:text-slate-400">
                        {item.categoria}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">
                        {formatNumberBR(item.quantidade)} {item.unidade}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono tabular-nums font-semibold">
                        {formatBRL(item.valor)}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Histórico Recente de Lançamentos */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Histórico Recente de Lançamentos
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Últimas movimentações e aprovações pendentes
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/lancamentos')}
              className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:underline"
            >
              Ver Todos
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {historicoRecente.map((l) => {
              const poloObj = visiblePolos.find((p) => p.id === l.poloId);
              const val = getLancamentoValorNoPolo(l, selectedPoloId);
              return (
                <div
                  key={l.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 dark:text-white truncate">
                      {l.descricao}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span>{formatDateBR(l.data)}</span>
                      <span>·</span>
                      <span>{poloObj?.nome || l.poloId}</span>
                      {l.emergencial && (
                        <>
                          <span>·</span>
                          <span className="text-red-600 dark:text-red-400 font-semibold">
                            Emergencial
                          </span>
                        </>
                      )}
                      {l.rateio?.ativo && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Rateio ({l.rateio.criterio})
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatBRL(val)}
                      </div>
                      <div
                        className={`text-[11px] font-medium flex items-center justify-end gap-1 ${
                          l.status === 'aprovado'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : l.status === 'pendente'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {l.status === 'aprovado' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        <span className="uppercase">{l.status}</span>
                      </div>
                    </div>

                    {l.status === 'pendente' && canApproveLaunches && (
                      <button
                        type="button"
                        onClick={() => updateLancamentoStatus(l.id, 'aprovado')}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                      >
                        Aprovar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
