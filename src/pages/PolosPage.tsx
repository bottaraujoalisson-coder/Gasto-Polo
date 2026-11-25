import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  formatBRL,
  formatDateBR,
  formatMonthBR,
  getCurrentMonthSaoPaulo,
  getLastNMonths,
  getLancamentoValorNoPolo,
} from '../utils/financeRules';
import {
  Building2,
  Plus,
  Edit3,
  Power,
  History,
  TrendingUp,
  Receipt,
  MapPin,
  CheckCircle2,
  XCircle,
  X,
  ArrowRight,
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
import { Polo } from '../types';

export const PolosPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    rede,
    allPolos,
    visiblePolos,
    categorias,
    lancamentos,
    selectedMonth,
    setSelectedPoloId,
    canManageNetwork,
    savePolo,
  } = useApp();

  const [showPoloModal, setShowPoloModal] = useState(false);
  const [editingPolo, setEditingPolo] = useState<Polo | null>(null);
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [historyPoloId, setHistoryPoloId] = useState<string | null>(null);
  const [confirmTogglePolo, setConfirmTogglePolo] = useState<Polo | null>(null);

  const currentYear = selectedMonth.slice(0, 4);
  const activeLancamentos = useMemo(
    () => lancamentos.filter((l) => !l.excluido && l.status !== 'rejeitado'),
    [lancamentos]
  );

  const displayedPolos = canManageNetwork ? allPolos : visiblePolos;

  const poloStats = useMemo(() => {
    return displayedPolos.map((p) => {
      let totalMes = 0;
      let totalAno = 0;
      let qtdMes = 0;
      let qtdTotal = 0;

      activeLancamentos.forEach((l) => {
        const val = getLancamentoValorNoPolo(l, p.id);
        if (val > 0) {
          qtdTotal += 1;
          if (l.data.startsWith(currentYear)) {
            totalAno += val;
          }
          if (l.data.startsWith(selectedMonth)) {
            totalMes += val;
            qtdMes += 1;
          }
        }
      });

      return {
        polo: p,
        totalMes,
        totalAno,
        qtdMes,
        qtdTotal,
      };
    });
  }, [displayedPolos, activeLancamentos, selectedMonth, currentYear]);

  const totalGeralMes = useMemo(
    () => poloStats.reduce((acc, s) => acc + s.totalMes, 0),
    [poloStats]
  );

  const totalGeralAno = useMemo(
    () => poloStats.reduce((acc, s) => acc + s.totalAno, 0),
    [poloStats]
  );

  const selectedHistoryPolo = useMemo(
    () => displayedPolos.find((p) => p.id === historyPoloId) || null,
    [displayedPolos, historyPoloId]
  );

  const poloHistoryData = useMemo(() => {
    if (!selectedHistoryPolo) return null;

    const months = getLastNMonths(getCurrentMonthSaoPaulo(), 6);
    const monthlyChart = months.map((m) => {
      const total = activeLancamentos
        .filter((l) => l.data.startsWith(m))
        .reduce((acc, l) => acc + getLancamentoValorNoPolo(l, selectedHistoryPolo.id), 0);
      return {
        mes: formatMonthBR(m),
        total,
      };
    });

    const expenses = activeLancamentos
      .filter((l) => getLancamentoValorNoPolo(l, selectedHistoryPolo.id) > 0)
      .sort((a, b) => b.data.localeCompare(a.data));

    const byCategoryMap = new Map<string, number>();
    expenses.forEach((l) => {
      const catName = categorias.find((c) => c.id === l.categoriaId)?.nome || 'Outros';
      const val = getLancamentoValorNoPolo(l, selectedHistoryPolo.id);
      byCategoryMap.set(catName, (byCategoryMap.get(catName) || 0) + val);
    });

    const byCategory = Array.from(byCategoryMap.entries())
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor);

    return {
      monthlyChart,
      expenses,
      byCategory,
    };
  }, [selectedHistoryPolo, activeLancamentos, categorias]);

  const handleOpenNew = () => {
    setEditingPolo(null);
    setNome('');
    setCidade('');
    setAtivo(true);
    setFeedback(null);
    setShowPoloModal(true);
  };

  const handleOpenEdit = (p: Polo) => {
    setEditingPolo(p);
    setNome(p.nome);
    setCidade(p.cidade);
    setAtivo(p.ativo);
    setFeedback(null);
    setShowPoloModal(true);
  };

  const handleSavePolo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cidade.trim()) {
      setFeedback({ type: 'error', message: 'Informe o nome e a cidade do polo.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await savePolo(
        {
          nome: nome.trim(),
          cidade: cidade.trim(),
          ativo,
          indicadorTamanho: editingPolo?.indicadorTamanho || 1,
        },
        editingPolo?.id
      );
      setShowPoloModal(false);
      setFeedback({
        type: 'success',
        message: editingPolo
          ? 'Polo atualizado com sucesso.'
          : 'Novo polo cadastrado com sucesso.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Não foi possível salvar o polo.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!confirmTogglePolo) return;
    try {
      await savePolo(
        {
          nome: confirmTogglePolo.nome,
          cidade: confirmTogglePolo.cidade,
          ativo: !confirmTogglePolo.ativo,
          indicadorTamanho: confirmTogglePolo.indicadorTamanho || 1,
        },
        confirmTogglePolo.id
      );
      setConfirmTogglePolo(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao alterar status do polo.',
      });
      setConfirmTogglePolo(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Polos — {rede?.nome || 'Unimar'}
          </h2>
        </div>
        {canManageNetwork && (
          <button
            onClick={handleOpenNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#002855] hover:bg-[#003875] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Polo
          </button>
        )}
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

      {/* Resumo dos Polos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Unidades Ativas
            </span>
            <Building2 className="w-4 h-4 text-[#002855] dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {displayedPolos.filter((p) => p.ativo).length}
            <span className="text-sm font-normal text-slate-400 ml-1.5">
              / {displayedPolos.length}
            </span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total no Mês ({formatMonthBR(selectedMonth)})
            </span>
            <Receipt className="w-4 h-4 text-[#004B8D] dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatBRL(totalGeralMes)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Acumulado no Ano ({currentYear})
            </span>
            <TrendingUp className="w-4 h-4 text-[#002855] dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatBRL(totalGeralAno)}
          </p>
        </div>
      </div>

      {/* Tabela de Polos */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Unidades e Desempenho Financeiro
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-800/40">
                <th className="py-3.5 px-4">Polo / Unidade</th>
                <th className="py-3.5 px-4">Cidade</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Despesas no Mês</th>
                <th className="py-3.5 px-4 text-right">Acumulado no Ano</th>
                <th className="py-3.5 px-4 text-center">Lançamentos</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {poloStats.map(({ polo, totalMes, totalAno, qtdMes, qtdTotal }) => (
                <tr
                  key={polo.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          polo.ativo
                            ? 'bg-[#002855] text-white'
                            : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                        }`}
                      >
                        {polo.nome.slice(0, 2).toUpperCase()}
                      </div>
                      <span>{polo.nome}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {polo.cidade}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {polo.ativo ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <XCircle className="w-3.5 h-3.5" />
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatBRL(totalMes)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                    {formatBRL(totalAno)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-xs text-slate-500 tabular-nums">
                    {qtdMes} no mês ({qtdTotal} total)
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        onClick={() =>
                          setHistoryPoloId(historyPoloId === polo.id ? null : polo.id)
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          historyPoloId === polo.id
                            ? 'bg-[#002855] text-white'
                            : 'bg-slate-100 text-[#002855] hover:bg-slate-200 dark:bg-slate-800 dark:text-blue-300'
                        }`}
                        title="Histórico financeiro"
                      >
                        <History className="w-3.5 h-3.5" />
                        Histórico
                      </button>

                      {canManageNetwork && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(polo)}
                            className="p-1.5 text-slate-500 hover:text-[#002855] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Editar Polo"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmTogglePolo(polo)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              polo.ativo
                                ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={polo.ativo ? 'Desativar Polo' : 'Ativar Polo'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {poloStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Nenhum polo cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico Financeiro Individual do Polo Selecionado */}
      {selectedHistoryPolo && poloHistoryData && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-[#002855]/25 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#004B8D] dark:text-blue-400">
                Histórico Individual
              </span>
              <span className="text-slate-300">•</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedHistoryPolo.nome} — {selectedHistoryPolo.cidade}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedPoloId(selectedHistoryPolo.id);
                  navigate('/lancamentos');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#002855] hover:bg-[#003875] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Ver em Lançamentos
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setHistoryPoloId(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                title="Fechar Histórico"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Evolução Mensal do Polo */}
            <div className="bg-slate-50/70 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Evolução Mensal ({selectedHistoryPolo.nome})
              </h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={poloHistoryData.monthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                    <Bar
                      dataKey="total"
                      name="Total no Mês"
                      fill="#002855"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gastos por Categoria neste Polo */}
            <div className="bg-slate-50/70 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Despesas por Categoria ({selectedHistoryPolo.nome})
              </h4>
              {poloHistoryData.byCategory.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-slate-400">
                  Nenhuma despesa registrada para este polo.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {poloHistoryData.byCategory.map((item) => {
                    const sumAll = poloHistoryData.byCategory.reduce((a, b) => a + b.valor, 0);
                    const pct = sumAll > 0 ? (item.valor / sumAll) * 100 : 0;
                    return (
                      <div
                        key={item.categoria}
                        className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 tabular-nums">
                          <span>{item.categoria}</span>
                          <span>
                            {formatBRL(item.valor)} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#004B8D] rounded-full"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Lista de Despesas do Polo */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Últimas Despesas Registradas ({poloHistoryData.expenses.length})
            </h4>
            <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/60">
                    <th className="py-2.5 px-4">Data</th>
                    <th className="py-2.5 px-4">Descrição</th>
                    <th className="py-2.5 px-4">Categoria</th>
                    <th className="py-2.5 px-4">Pagamento</th>
                    <th className="py-2.5 px-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {poloHistoryData.expenses.slice(0, 15).map((l) => {
                    const cat = categorias.find((c) => c.id === l.categoriaId);
                    const val = getLancamentoValorNoPolo(l, selectedHistoryPolo.id);
                    return (
                      <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formatDateBR(l.data)}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                          {l.descricao}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                          {cat?.nome || 'Geral'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">{l.formaPagamento || '-'}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatBRL(val)}
                        </td>
                      </tr>
                    );
                  })}
                  {poloHistoryData.expenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        Nenhuma despesa registrada neste polo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Polo */}
      {showPoloModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingPolo ? 'Editar Polo' : 'Novo Polo'}
              </h3>
              <button
                onClick={() => setShowPoloModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePolo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Polo / Unidade *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Polo Marília"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cidade / UF *
                </label>
                <input
                  type="text"
                  required
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: Marília - SP"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004B8D]"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Polo Ativo
                </span>
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="w-4 h-4 accent-[#002855] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPoloModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#002855] hover:bg-[#003875] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  {saving ? 'Salvando...' : editingPolo ? 'Salvar Alterações' : 'Cadastrar Polo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Ativar/Desativar Polo */}
      {confirmTogglePolo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {confirmTogglePolo.ativo ? 'Desativar Polo?' : 'Reativar Polo?'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmTogglePolo.ativo
                ? `Confirma a desativação do polo "${confirmTogglePolo.nome}"?`
                : `Confirma a reativação do polo "${confirmTogglePolo.nome}"?`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmTogglePolo(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmToggleStatus}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl cursor-pointer ${
                  confirmTogglePolo.ativo
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-[#002855] hover:bg-[#003875]'
                }`}
              >
                {confirmTogglePolo.ativo ? 'Confirmar Desativação' : 'Confirmar Ativação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolosPage;
