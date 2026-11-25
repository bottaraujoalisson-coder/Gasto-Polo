import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, Printer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  calculateMonthlyVariation,
  formatBRL,
  formatDateBR,
  formatMonthBR,
  formatNumberBR,
  formatPct,
  getLancamentoValorNoPolo,
  getPreviousMonth,
  roundCents,
} from '../utils/financeRules';
import { generateMonthlyReportPDF } from '../utils/exportUtils';

export const RelatorioPage: React.FC = () => {
  const {
    rede,
    visiblePolos,
    categorias,
    lancamentos,
    orcamentos,
    campanhas,
    alertas,
    planosAcao,
    selectedMonth,
    selectedPoloId,
  } = useApp();

  const [lastExportedFilename, setLastExportedFilename] = useState<string | null>(null);

  const prevMonth = useMemo(() => getPreviousMonth(selectedMonth), [selectedMonth]);

  const reportData = useMemo(() => {
    const approvedCurrent = lancamentos.filter(
      (l) => !l.excluido && l.status === 'aprovado' && l.competencia === selectedMonth
    );
    const approvedPrev = lancamentos.filter(
      (l) => !l.excluido && l.status === 'aprovado' && l.competencia === prevMonth
    );

    const totalMes = roundCents(
      approvedCurrent.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
    );
    const totalMesAnterior = roundCents(
      approvedPrev.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
    );
    const variacaoPct = calculateMonthlyVariation(totalMes, totalMesAnterior);

    const tetoTotal = roundCents(
      orcamentos
        .filter(
          (o) =>
            o.mes === selectedMonth &&
            (selectedPoloId === 'ALL' || o.poloId === selectedPoloId)
        )
        .reduce((acc, o) => acc + o.teto, 0)
    );
    const pctTeto = tetoTotal > 0 ? roundCents((totalMes / tetoTotal) * 100) : null;

    const emergenciaisList = approvedCurrent.filter(
      (l) => l.emergencial && getLancamentoValorNoPolo(l, selectedPoloId) > 0
    );
    const totalEmergencial = roundCents(
      emergenciaisList.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedPoloId), 0)
    );
    const pctEmergencial = totalMes > 0 ? roundCents((totalEmergencial / totalMes) * 100) : 0;

    const indicadorTotal = visiblePolos
      .filter((p) => selectedPoloId === 'ALL' || p.id === selectedPoloId)
      .reduce((acc, p) => acc + p.indicadorTamanho, 0);

    return {
      totalMes,
      totalMesAnterior,
      variacaoPct,
      tetoTotal,
      pctTeto,
      emergenciaisList,
      totalEmergencial,
      pctEmergencial,
      indicadorTotal,
    };
  }, [lancamentos, orcamentos, visiblePolos, selectedMonth, prevMonth, selectedPoloId]);

  const handleExportPDF = () => {
    if (!rede) return;
    const fname = generateMonthlyReportPDF({
      rede,
      mes: selectedMonth,
      poloFilter: selectedPoloId,
      polos: visiblePolos,
      categorias,
      lancamentos,
      orcamentos,
      campanhas,
      alertas,
      planosAcao,
      ...reportData,
    });
    setLastExportedFilename(fname);
  };

  const poloLabel =
    selectedPoloId === 'ALL'
      ? `Consolidado da Rede (${visiblePolos.length} polos)`
      : visiblePolos.find((p) => p.id === selectedPoloId)?.nome || selectedPoloId;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Relatório Mensal Consolidado & por Polo
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Documento executivo pronto para exportação em PDF (A4) e impressão para diretoria e
            gestores.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50"
          >
            <Printer className="w-4 h-4" />
            Imprimir (A4)
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg hover:opacity-90"
          >
            <Download className="w-4 h-4" />
            Exportar em PDF (A4)
          </button>
        </div>
      </div>

      {lastExportedFilename && (
        <div
          role="status"
          data-testid="pdf-export-success"
          className="no-print p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Relatório PDF gerado e baixado com sucesso: <strong>{lastExportedFilename}</strong>
          </span>
        </div>
      )}

      {/* Printable A4 Report Sheet */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 md:p-8 space-y-8">
        {/* Document Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              RELATÓRIO DE FECHAMENTO MENSAL — GASTOPOLO
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {rede?.nome} — {poloLabel}
            </h3>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 text-right font-mono">
            <div>Competência: {formatMonthBR(selectedMonth)}</div>
            <div>Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        {/* 1. Resumo Executivo */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            01. Resumo Executivo do Mês
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">Total Aprovado</div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5">
                {formatBRL(reportData.totalMes)}
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">Variação vs Mês Ant.</div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5">
                {formatPct(reportData.variacaoPct)}
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">% do Teto Utilizado</div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5">
                {reportData.pctTeto !== null ? formatPct(reportData.pctTeto) : 'Sem teto'}
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">Compras Emergenciais</div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5">
                {formatBRL(reportData.totalEmergencial)} ({formatPct(reportData.pctEmergencial)})
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">
                Gasto / {rede?.config.rotuloTamanho}
              </div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5">
                {reportData.indicadorTotal > 0
                  ? formatBRL(reportData.totalMes / reportData.indicadorTotal)
                  : '—'}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Categorias x Teto */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            02. Execução por Categoria × Teto Mensal
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Categoria</th>
                  <th className="py-2 px-3 font-medium">Tipo</th>
                  <th className="py-2 px-3 font-medium text-right">Gasto Aprovado</th>
                  <th className="py-2 px-3 font-medium text-right">Teto Mensal</th>
                  <th className="py-2 pl-3 font-medium text-right">% Utilizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {categorias
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
                    return (
                      <tr key={cat.id}>
                        <td className="py-2 pr-3 font-medium">{cat.nome}</td>
                        <td className="py-2 px-3 uppercase text-[11px] text-slate-500">
                          {cat.tipo}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                          {formatBRL(gasto)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {teto > 0 ? formatBRL(teto) : 'Sem teto definido'}
                        </td>
                        <td
                          className={`py-2 pl-3 text-right font-mono tabular-nums font-bold ${
                            pct !== null && pct > (rede?.config.alerta2Pct || 100)
                              ? 'text-red-600'
                              : pct !== null && pct >= (rede?.config.alerta1Pct || 80)
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {pct !== null ? formatPct(pct) : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Compras Emergenciais */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            03. Detalhamento de Compras Emergenciais ({reportData.emergenciaisList.length})
          </h4>
          {reportData.emergenciaisList.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nenhuma compra emergencial registrada neste período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 px-3 font-medium">Descrição</th>
                    <th className="py-2 px-3 font-medium">Justificativa</th>
                    <th className="py-2 pl-3 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {reportData.emergenciaisList.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2 pr-3 font-mono">{formatDateBR(l.data)}</td>
                      <td className="py-2 px-3 font-medium">{l.descricao}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                        {l.justificativa || '—'}
                      </td>
                      <td className="py-2 pl-3 text-right font-mono tabular-nums font-semibold">
                        {formatBRL(getLancamentoValorNoPolo(l, selectedPoloId))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 4. Alertas de Desperdício e Planos de Ação */}
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            04. Alertas de Desperdício ({alertas.length}) & Planos de Ação ({planosAcao.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white">
                Principais Alertas do Mês
              </div>
              {alertas.length === 0 ? (
                <p className="text-slate-500">Nenhum alerta ativo.</p>
              ) : (
                <ul className="space-y-2">
                  {alertas.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-2">
                      <span>
                        <strong>[{a.gravidade.toUpperCase()}]</strong> {a.titulo} ({a.poloNome})
                      </span>
                      <span className="font-mono font-semibold shrink-0 text-emerald-600">
                        -{formatBRL(a.economiaSugerida)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white">
                Planos de Ação Corretiva
              </div>
              {planosAcao.length === 0 ? (
                <p className="text-slate-500">Nenhum plano de ação registrado.</p>
              ) : (
                <ul className="space-y-2">
                  {planosAcao.slice(0, 5).map((pa) => (
                    <li key={pa.id} className="flex items-start justify-between gap-2">
                      <span>
                        <strong>[{pa.status.toUpperCase()}]</strong> {pa.titulo} (Prazo:{' '}
                        {formatDateBR(pa.prazo)})
                      </span>
                      <span className="font-mono font-semibold shrink-0">
                        {formatBRL(pa.economiaEstimada)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
