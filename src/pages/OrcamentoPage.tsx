import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Edit3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatBRL,
  formatMonthBR,
  formatPct,
  getBudgetTrafficLight,
  getLancamentoValorNoPolo,
  getPreviousMonth,
  roundCents,
} from '../utils/financeRules';

export const OrcamentoPage: React.FC = () => {
  const {
    rede,
    visiblePolos,
    categorias,
    lancamentos,
    orcamentos,
    selectedMonth,
    selectedPoloId,
    canApproveLaunches,
    saveOrcamentoTeto,
    copyPreviousMonthOrcamentos,
  } = useApp();

  const [editingCell, setEditingCell] = useState<{
    poloId: string;
    categoriaId: string;
    valor: string;
  } | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [busyCopy, setBusyCopy] = useState(false);

  const prevMonth = useMemo(() => getPreviousMonth(selectedMonth), [selectedMonth]);

  const activePolos = useMemo(() => {
    if (selectedPoloId !== 'ALL') {
      return visiblePolos.filter((p) => p.id === selectedPoloId);
    }
    return visiblePolos.filter((p) => p.ativo);
  }, [visiblePolos, selectedPoloId]);

  const activeCategorias = useMemo(
    () => categorias.filter((c) => c.ativa),
    [categorias]
  );

  const handleCopyPreviousMonth = async () => {
    setBusyCopy(true);
    setCopyMessage(null);
    try {
      const count = await copyPreviousMonthOrcamentos(selectedMonth, prevMonth);
      if (count > 0) {
        setCopyMessage(
          `Copiados ${count} tetos orçamentários de ${formatMonthBR(prevMonth)} para ${formatMonthBR(selectedMonth)}.`
        );
      } else {
        setCopyMessage(`Nenhum teto encontrado em ${formatMonthBR(prevMonth)} para copiar.`);
      }
    } finally {
      setBusyCopy(false);
    }
  };

  const handleSaveTeto = async () => {
    if (!editingCell) return;
    const numeric = Number(editingCell.valor);
    if (!Number.isFinite(numeric) || numeric < 0) return;
    await saveOrcamentoTeto(
      selectedMonth,
      editingCell.poloId,
      editingCell.categoriaId,
      numeric
    );
    setEditingCell(null);
  };

  // Summary rows per category for selectedPoloId
  const categoryRows = useMemo(() => {
    return activeCategorias.map((cat) => {
      const gastoTotal = roundCents(
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

      const tetoTotal = roundCents(
        orcamentos
          .filter(
            (o) =>
              o.mes === selectedMonth &&
              o.categoriaId === cat.id &&
              (selectedPoloId === 'ALL' || o.poloId === selectedPoloId)
          )
          .reduce((acc, o) => acc + o.teto, 0)
      );

      const pct = tetoTotal > 0 ? roundCents((gastoTotal / tetoTotal) * 100) : null;
      const traffic = getBudgetTrafficLight(pct, rede?.config);

      return {
        cat,
        gastoTotal,
        tetoTotal,
        pct,
        traffic,
      };
    });
  }, [activeCategorias, lancamentos, orcamentos, selectedMonth, selectedPoloId, rede?.config]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Orçamento Mensal (Matriz Polo × Categoria × Mês)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Semáforo: Verde até {rede?.config.alerta1Pct || 80}%, Amarelo de{' '}
            {rede?.config.alerta1Pct || 80}% a {rede?.config.alerta2Pct || 100}%, Vermelho acima de{' '}
            {rede?.config.alerta2Pct || 100}%.
          </p>
        </div>

        {canApproveLaunches && (
          <button
            type="button"
            disabled={busyCopy}
            onClick={handleCopyPreviousMonth}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Copy className="w-4 h-4" />
            {busyCopy
              ? 'Copiando...'
              : `Copiar Tetos de ${formatMonthBR(prevMonth)}`}
          </button>
        )}
      </div>

      {copyMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-200">
          {copyMessage}
        </div>
      )}

      {/* Progress Cards by Category */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Execução Orçamentária por Categoria — {formatMonthBR(selectedMonth)}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categoryRows.map(({ cat, gastoTotal, tetoTotal, pct, traffic }) => (
            <div
              key={cat.id}
              data-testid={`budget-card-${cat.id}`}
              className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">{cat.nome}</span>
                  <span className="text-slate-400 ml-1.5">· {cat.tipo}</span>
                </div>
                <span
                  className={`font-mono tabular-nums font-bold ${
                    traffic === 'vermelho'
                      ? 'text-red-600 dark:text-red-400'
                      : traffic === 'amarelo'
                      ? 'text-amber-600 dark:text-amber-400'
                      : traffic === 'verde'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {pct !== null ? formatPct(pct) : 'Sem teto definido'}
                </span>
              </div>

              {/* Traffic Light Progress Bar */}
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  data-testid={`budget-bar-${cat.id}`}
                  data-traffic={traffic}
                  className={`h-full transition-all ${
                    traffic === 'vermelho'
                      ? 'bg-red-600'
                      : traffic === 'amarelo'
                      ? 'bg-amber-500'
                      : traffic === 'verde'
                      ? 'bg-emerald-600'
                      : 'bg-slate-300'
                  }`}
                  style={{ width: `${Math.min(100, pct || 0)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                <span>Gasto aprovado: {formatBRL(gastoTotal)}</span>
                <span>
                  Teto: {tetoTotal > 0 ? formatBRL(tetoTotal) : 'Sem teto definido'}
                </span>
              </div>

              {traffic === 'vermelho' && (
                <div className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Teto ultrapassado em {formatBRL(gastoTotal - tetoTotal)} (Alerta Crítico &gt;{' '}
                    {rede?.config.alerta2Pct || 100}%)
                  </span>
                </div>
              )}
              {traffic === 'amarelo' && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Atenção: categoria atingiu {formatPct(pct)} do teto mensal
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Matrix Table: Categoria x Polo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Matriz Editável de Tetos por Polo e Categoria ({formatMonthBR(selectedMonth)})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Clique no ícone de edição ao lado de qualquer teto para ajustar o limite mensal do polo.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4 font-medium">Categoria</th>
                {activePolos.map((polo) => (
                  <th key={polo.id} className="py-3 px-3 font-medium">
                    <div>{polo.nome}</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      Gasto / Teto Mensal
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {activeCategorias.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                    <div>{cat.nome}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{cat.tipo}</div>
                  </td>

                  {activePolos.map((polo) => {
                    const orc = orcamentos.find(
                      (o) =>
                        o.mes === selectedMonth &&
                        o.poloId === polo.id &&
                        o.categoriaId === cat.id
                    );
                    const teto = orc?.teto || 0;
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
                    const pct = teto > 0 ? roundCents((gasto / teto) * 100) : null;
                    const traffic = getBudgetTrafficLight(pct, rede?.config);

                    const isEditing =
                      editingCell?.poloId === polo.id &&
                      editingCell?.categoriaId === cat.id;

                    return (
                      <td key={polo.id} className="py-3 px-3 align-top min-w-[180px]">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="50"
                              aria-label={`Novo teto ${cat.nome} ${polo.nome}`}
                              value={editingCell.valor}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  valor: e.target.value,
                                })
                              }
                              className="w-24 px-2 py-1 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                            />
                            <button
                              type="button"
                              aria-label="Salvar teto"
                              onClick={handleSaveTeto}
                              className="p-1 text-white bg-emerald-600 rounded hover:bg-emerald-700"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                {formatBRL(gasto)} /{' '}
                                <strong className="text-slate-900 dark:text-white">
                                  {teto > 0 ? formatBRL(teto) : 'Sem teto'}
                                </strong>
                              </span>
                              {canApproveLaunches && (
                                <button
                                  type="button"
                                  aria-label={`Editar teto ${cat.nome} em ${polo.nome}`}
                                  onClick={() =>
                                    setEditingCell({
                                      poloId: polo.id,
                                      categoriaId: cat.id,
                                      valor: String(teto),
                                    })
                                  }
                                  className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  traffic === 'vermelho'
                                    ? 'bg-red-600'
                                    : traffic === 'amarelo'
                                    ? 'bg-amber-500'
                                    : traffic === 'verde'
                                    ? 'bg-emerald-600'
                                    : 'bg-slate-300'
                                }`}
                                style={{ width: `${Math.min(100, pct || 0)}%` }}
                              />
                            </div>

                            <div
                              className={`text-[10px] font-mono tabular-nums font-semibold ${
                                traffic === 'vermelho'
                                  ? 'text-red-600 dark:text-red-400'
                                  : traffic === 'amarelo'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : traffic === 'verde'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {pct !== null ? `${formatPct(pct)} utilizado` : 'Sem teto definido'}
                            </div>
                          </div>
                        )}
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
  );
};
