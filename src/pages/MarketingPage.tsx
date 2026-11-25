import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Check, Edit3, Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CanalMarketing, Campanha, TipoAcaoMarketing } from '../types';
import { formatBRL, formatDateBR, roundCents } from '../utils/financeRules';

export const MarketingPage: React.FC = () => {
  const {
    campanhas,
    lancamentos,
    visiblePolos,
    selectedPoloId,
    selectedMonth,
    canApproveLaunches,
    saveCampanha,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [nome, setNome] = useState('');
  const [poloId, setPoloId] = useState(visiblePolos[0]?.id || 'ALL');
  const [canal, setCanal] = useState<CanalMarketing>('trafego_pago');
  const [inicio, setInicio] = useState(`${selectedMonth}-01`);
  const [fim, setFim] = useState(`${selectedMonth}-28`);
  const [leads, setLeads] = useState(100);
  const [acoes, setAcoes] = useState(25);
  const [tipoAcao, setTipoAcao] = useState<TipoAcaoMarketing>('matricula');
  const [metaCpa, setMetaCpa] = useState(80);
  const [submitting, setSubmitting] = useState(false);

  const openNewModal = () => {
    setEditingId(undefined);
    setNome('');
    setPoloId(selectedPoloId !== 'ALL' ? selectedPoloId : visiblePolos[0]?.id || 'ALL');
    setCanal('trafego_pago');
    setInicio(`${selectedMonth}-01`);
    setFim(`${selectedMonth}-28`);
    setLeads(120);
    setAcoes(30);
    setTipoAcao('matricula');
    setMetaCpa(80);
    setModalOpen(true);
  };

  const openEditModal = (c: Campanha) => {
    setEditingId(c.id);
    setNome(c.nome);
    setPoloId(c.poloId);
    setCanal(c.canal);
    setInicio(c.inicio);
    setFim(c.fim);
    setLeads(c.leads);
    setAcoes(c.acoes);
    setTipoAcao(c.tipoAcao);
    setMetaCpa(c.metaCustoPorAcao);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSubmitting(true);
    try {
      await saveCampanha(
        {
          nome: nome.trim(),
          poloId,
          canal,
          inicio,
          fim,
          leads: Number(leads) || 0,
          acoes: Number(acoes) || 0,
          tipoAcao,
          metaCustoPorAcao: Number(metaCpa) || 0,
        },
        editingId
      );
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const poloMap = useMemo(
    () => new Map(visiblePolos.map((p) => [p.id, p.nome])),
    [visiblePolos]
  );

  const canalLabels: Record<CanalMarketing, string> = {
    impressao: 'Impressão de Materiais',
    brindes: 'Brindes Promocionais',
    divulgacao_digital: 'Divulgação Digital',
    trafego_pago: 'Tráfego Pago',
  };

  const campaignMetrics = useMemo(() => {
    return campanhas
      .filter((c) => selectedPoloId === 'ALL' || c.poloId === 'ALL' || c.poloId === selectedPoloId)
      .map((camp) => {
        const linkedLaunches = lancamentos.filter(
          (l) => !l.excluido && l.status === 'aprovado' && l.campanhaId === camp.id
        );
        const investimento = roundCents(
          linkedLaunches.reduce((acc, l) => acc + l.valorTotal, 0)
        );
        const cpaReal = camp.acoes > 0 ? roundCents(investimento / camp.acoes) : 0;
        const custoPorLead = camp.leads > 0 ? roundCents(investimento / camp.leads) : 0;
        const acimaDaMeta =
          camp.metaCustoPorAcao > 0 && cpaReal > camp.metaCustoPorAcao;

        return {
          camp,
          investimento,
          cpaReal,
          custoPorLead,
          acimaDaMeta,
          qtdLancamentos: linkedLaunches.length,
        };
      });
  }, [campanhas, lancamentos, selectedPoloId]);

  const chartData = useMemo(() => {
    return campaignMetrics.map((m) => ({
      nome: m.camp.nome.length > 22 ? m.camp.nome.slice(0, 20) + '…' : m.camp.nome,
      cpaReal: m.cpaReal,
      metaCpa: m.camp.metaCustoPorAcao,
    }));
  }, [campaignMetrics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Campanhas de Marketing & Custo por Ação (CPA)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vincule lançamentos de marketing às campanhas para apurar o Custo por Ação (Investimento
            ÷ Ações) contra a meta.
          </p>
        </div>

        {canApproveLaunches && (
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Nova Campanha
          </button>
        )}
      </div>

      {/* CPA Chart vs Target */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Comparativo de Custo por Ação (CPA Real vs Meta)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="nome" fontSize={11} />
                <YAxis tickFormatter={(v) => `R$${v}`} fontSize={11} />
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
                <Bar isAnimationActive={false} dataKey="cpaReal" name="CPA Real (R$)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="metaCpa" name="Meta CPA (R$)" fill="#64748b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Campaigns Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-medium">Campanha / Período</th>
                <th className="py-3 px-3 font-medium">Polo / Canal</th>
                <th className="py-3 px-3 font-medium text-right">Investimento</th>
                <th className="py-3 px-3 font-medium text-right">Leads</th>
                <th className="py-3 px-3 font-medium text-right">Ações</th>
                <th className="py-3 px-3 font-medium text-right">CPA Real</th>
                <th className="py-3 px-3 font-medium text-right">Meta CPA</th>
                <th className="py-3 px-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {campaignMetrics.map(({ camp, investimento, cpaReal, acimaDaMeta, qtdLancamentos }) => (
                <tr key={camp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-white">{camp.nome}</div>
                    <div className="text-[11px] text-slate-500">
                      {formatDateBR(camp.inicio)} a {formatDateBR(camp.fim)} · {qtdLancamentos}{' '}
                      lançamento(s)
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium">
                      {camp.poloId === 'ALL'
                        ? 'Rede Consolidada'
                        : poloMap.get(camp.poloId) || camp.poloId}
                    </div>
                    <div className="text-[11px] text-slate-500">{canalLabels[camp.canal]}</div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                    {formatBRL(investimento)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">{camp.leads}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {camp.acoes} ({camp.tipoAcao}s)
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono tabular-nums font-bold ${
                      acimaDaMeta
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {camp.acoes > 0 ? formatBRL(cpaReal) : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {formatBRL(camp.metaCustoPorAcao)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {canApproveLaunches && (
                      <button
                        type="button"
                        aria-label={`Editar campanha ${camp.nome}`}
                        onClick={() => openEditModal(camp)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Nova / Editar Campanha */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-campanha-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3
                id="modal-campanha-titulo"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                {editingId ? 'Editar Campanha' : 'Nova Campanha de Marketing'}
              </h3>
              <button
                type="button"
                aria-label="Fechar modal"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label
                  htmlFor="camp-nome"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nome da Campanha *
                </label>
                <input
                  id="camp-nome"
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="camp-polo"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Polo
                  </label>
                  <select
                    id="camp-polo"
                    value={poloId}
                    onChange={(e) => setPoloId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="ALL">Rede Toda (Consolidado)</option>
                    {visiblePolos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="camp-canal"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Canal de Marketing
                  </label>
                  <select
                    id="camp-canal"
                    value={canal}
                    onChange={(e) => setCanal(e.target.value as CanalMarketing)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="trafego_pago">Tráfego Pago</option>
                    <option value="divulgacao_digital">Divulgação Digital</option>
                    <option value="impressao">Impressão de Materiais</option>
                    <option value="brindes">Brindes Promocionais</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="camp-inicio"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Início
                  </label>
                  <input
                    id="camp-inicio"
                    type="date"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="camp-fim"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Término
                  </label>
                  <input
                    id="camp-fim"
                    type="date"
                    value={fim}
                    onChange={(e) => setFim(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label
                    htmlFor="camp-leads"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Leads Gerados
                  </label>
                  <input
                    id="camp-leads"
                    type="number"
                    min="0"
                    value={leads}
                    onChange={(e) => setLeads(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="camp-acoes"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Qtd Ações
                  </label>
                  <input
                    id="camp-acoes"
                    type="number"
                    min="0"
                    value={acoes}
                    onChange={(e) => setAcoes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="camp-tipo-acao"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Tipo de Ação
                  </label>
                  <select
                    id="camp-tipo-acao"
                    value={tipoAcao}
                    onChange={(e) => setTipoAcao(e.target.value as TipoAcaoMarketing)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="matricula">Matrícula</option>
                    <option value="visita">Visita ao Polo</option>
                    <option value="lead">Lead Qualificado</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="camp-meta-cpa"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Meta CPA (R$)
                  </label>
                  <input
                    id="camp-meta-cpa"
                    type="number"
                    min="0"
                    step="5"
                    value={metaCpa}
                    onChange={(e) => setMetaCpa(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg"
                >
                  <Check className="w-4 h-4" />
                  {submitting ? 'Salvando...' : 'Salvar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
