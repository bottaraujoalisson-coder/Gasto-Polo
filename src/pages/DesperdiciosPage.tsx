import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardCheck,
  Plus,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AlertaDesperdicio, GravidadeAlerta, StatusPlanoAcao } from '../types';
import { formatBRL, formatDateBR, formatMonthBR } from '../utils/financeRules';

export const DesperdiciosPage: React.FC = () => {
  const {
    alertas,
    planosAcao,
    visiblePolos,
    usuarios,
    currentUserProfile,
    selectedMonth,
    canApproveLaunches,
    savePlanoAcao,
  } = useApp();

  const navigate = useNavigate();
  const [filterGravidade, setFilterGravidade] = useState<'ALL' | GravidadeAlerta>('ALL');
  const [filterTipoAlerta, setFilterTipoAlerta] = useState<'ALL' | number>('ALL');

  // Create Action Plan Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [tituloPlano, setTituloPlano] = useState('');
  const [poloIdPlano, setPoloIdPlano] = useState('');
  const [categoriaIdPlano, setCategoriaIdPlano] = useState('');
  const [responsavelUidPlano, setResponsavelUidPlano] = useState('');
  const [prazoPlano, setPrazoPlano] = useState(`${selectedMonth}-28`);
  const [economiaPlano, setEconomiaPlano] = useState(0);
  const [statusPlano, setStatusPlano] = useState<StatusPlanoAcao>('aberto');
  const [origemAlertaPlano, setOrigemAlertaPlano] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredAlertas = useMemo(() => {
    return alertas.filter((a) => {
      if (filterGravidade !== 'ALL' && a.gravidade !== filterGravidade) return false;
      if (filterTipoAlerta !== 'ALL' && a.tipoNumero !== filterTipoAlerta) return false;
      return true;
    });
  }, [alertas, filterGravidade, filterTipoAlerta]);

  const totalEconomiaPotencial = useMemo(
    () => filteredAlertas.reduce((acc, a) => acc + a.economiaSugerida, 0),
    [filteredAlertas]
  );

  const openModalFromAlert = (alerta: AlertaDesperdicio) => {
    setTituloPlano(alerta.sugestao.slice(0, 140));
    setPoloIdPlano(alerta.poloId === 'ALL' ? visiblePolos[0]?.id || '' : alerta.poloId);
    setCategoriaIdPlano(alerta.categoriaId);
    setResponsavelUidPlano(currentUserProfile?.uid || usuarios[0]?.uid || 'admin');
    setPrazoPlano(`${selectedMonth}-28`);
    setEconomiaPlano(alerta.economiaSugerida);
    setStatusPlano('aberto');
    setOrigemAlertaPlano(alerta.titulo);
    setModalOpen(true);
  };

  const openNewBlankPlan = () => {
    setTituloPlano('');
    setPoloIdPlano(visiblePolos[0]?.id || '');
    setCategoriaIdPlano('');
    setResponsavelUidPlano(currentUserProfile?.uid || usuarios[0]?.uid || 'admin');
    setPrazoPlano(`${selectedMonth}-28`);
    setEconomiaPlano(500);
    setStatusPlano('aberto');
    setOrigemAlertaPlano('Iniciativa interna de redução de custos');
    setModalOpen(true);
  };

  const handleSavePlano = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tituloPlano.trim() || !poloIdPlano) return;
    setSubmitting(true);
    try {
      await savePlanoAcao({
        titulo: tituloPlano.trim(),
        poloId: poloIdPlano,
        categoriaId: categoriaIdPlano,
        responsavelUid: responsavelUidPlano,
        prazo: prazoPlano,
        economiaEstimada: Number(economiaPlano) || 0,
        status: statusPlano,
        origemAlerta: origemAlertaPlano,
      });
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const poloMap = useMemo(
    () => new Map(visiblePolos.map((p) => [p.id, p.nome])),
    [visiblePolos]
  );
  const userMap = useMemo(
    () => new Map(usuarios.map((u) => [u.uid, u.nome])),
    [usuarios]
  );

  const alertTypeLabels: Record<number, string> = {
    1: '1. Categoria acima do teto',
    2: '2. Item emergencial 2+ vezes em 90d',
    3: '3. Preço unitário 15%+ acima do menor da rede',
    4: '4. Consumo 30%+ acima da média trimestral',
    5: '5. Despesas diversas acima do limite %',
    6: '6. Brindes/Impressos sem campanha',
    7: '7. Custo por ação (CPA) acima da meta',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Diagnóstico de Desperdícios & Planos de Ação
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitoramento automático de 7 regras de ineficiência operacional e de marketing em{' '}
            {formatMonthBR(selectedMonth)}.
          </p>
        </div>

        {canApproveLaunches && (
          <button
            type="button"
            onClick={openNewBlankPlan}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Novo Plano de Ação
          </button>
        )}
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Alertas Detectados no Período
          </div>
          <div
            data-testid="alertas-count"
            className="text-2xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400 mt-1"
          >
            {filteredAlertas.length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Economia Potencial Identificada
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {formatBRL(totalEconomiaPotencial)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Planos de Ação Ativos / Concluídos
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {planosAcao.length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filtrar por Regra de Desperdício"
            value={filterTipoAlerta}
            onChange={(e) =>
              setFilterTipoAlerta(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
            }
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="ALL">Todas as 7 Regras de Desperdício</option>
            {Object.entries(alertTypeLabels).map(([num, label]) => (
              <option key={num} value={num}>
                {label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por Gravidade"
            value={filterGravidade}
            onChange={(e) =>
              setFilterGravidade(e.target.value as 'ALL' | GravidadeAlerta)
            }
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="ALL">Todas as Gravidades</option>
            <option value="alta">Gravidade Alta</option>
            <option value="media">Gravidade Média</option>
            <option value="baixa">Gravidade Baixa</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">
          {filteredAlertas.length} alerta(s) encontrado(s)
        </span>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlertas.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-2">
            <ClipboardCheck className="w-8 h-8 text-emerald-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Nenhum desperdício detectado para este filtro!
            </div>
            <p className="text-xs text-slate-500">
              Todas as categorias e polos filtrados estão operando dentro dos parâmetros configurados.
            </p>
          </div>
        ) : (
          filteredAlertas.map((alerta) => (
            <div
              key={alerta.id}
              data-testid={`alerta-tipo-${alerta.tipoNumero}`}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`font-bold uppercase ${
                      alerta.gravidade === 'alta'
                        ? 'text-red-600 dark:text-red-400'
                        : alerta.gravidade === 'media'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Gravidade {alerta.gravidade}
                  </span>
                  <span>·</span>
                  <span className="text-slate-500">
                    {alertTypeLabels[alerta.tipoNumero]}
                  </span>
                  <span>·</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {alerta.poloNome}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {alerta.titulo}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {alerta.descricao}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  Recomendação: {alerta.sugestao}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
                <div className="text-left lg:text-right">
                  <div className="text-[11px] text-slate-500">
                    Valor Envolvido:{' '}
                    <strong className="font-mono text-slate-900 dark:text-white">
                      {formatBRL(alerta.valorEnvolvido)}
                    </strong>
                  </div>
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    Economia estimada: {formatBRL(alerta.economiaSugerida)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/lancamentos')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                  >
                    Ver Lançamentos
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {canApproveLaunches && (
                    <button
                      type="button"
                      onClick={() => openModalFromAlert(alerta)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:opacity-90 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Criar plano de ação
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Plans Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Planos de Ação Registrados ({planosAcao.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Acompanhamento de medidas corretivas, prazos e economia estimada
            </p>
          </div>
        </div>

        {planosAcao.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">
            Nenhum plano de ação cadastrado até o momento. Clique em &ldquo;Criar plano de
            ação&rdquo; em qualquer alerta acima.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3 font-medium">Título do Plano / Origem</th>
                  <th className="py-2.5 px-3 font-medium">Polo</th>
                  <th className="py-2.5 px-3 font-medium">Responsável</th>
                  <th className="py-2.5 px-3 font-medium">Prazo</th>
                  <th className="py-2.5 px-3 font-medium text-right">Economia Est.</th>
                  <th className="py-2.5 pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {planosAcao.map((plano) => (
                  <tr key={plano.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {plano.titulo}
                      </div>
                      {plano.origemAlerta && (
                        <div className="text-[11px] text-slate-500">
                          Origem: {plano.origemAlerta}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">{poloMap.get(plano.poloId) || plano.poloId}</td>
                    <td className="py-3 px-3">
                      {userMap.get(plano.responsavelUid) || 'Administrador'}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums">
                      {formatDateBR(plano.prazo)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatBRL(plano.economiaEstimada)}
                    </td>
                    <td className="py-3 pl-3">
                      <select
                        aria-label={`Status do plano ${plano.titulo}`}
                        disabled={!canApproveLaunches}
                        value={plano.status}
                        onChange={(e) =>
                          savePlanoAcao(
                            {
                              titulo: plano.titulo,
                              poloId: plano.poloId,
                              categoriaId: plano.categoriaId,
                              responsavelUid: plano.responsavelUid,
                              prazo: plano.prazo,
                              economiaEstimada: plano.economiaEstimada,
                              status: e.target.value as StatusPlanoAcao,
                              origemAlerta: plano.origemAlerta,
                            },
                            plano.id
                          )
                        }
                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-medium"
                      >
                        <option value="aberto">Aberto</option>
                        <option value="em_andamento">Em Andamento</option>
                        <option value="concluido">Concluído</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Criar Plano de Ação */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-plano-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3
                id="modal-plano-titulo"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Criar Plano de Ação Corretiva
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

            <form onSubmit={handleSavePlano} className="space-y-3.5">
              <div>
                <label
                  htmlFor="plano-titulo"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Título da Ação *
                </label>
                <input
                  id="plano-titulo"
                  type="text"
                  required
                  value={tituloPlano}
                  onChange={(e) => setTituloPlano(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="plano-polo"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Polo *
                  </label>
                  <select
                    id="plano-polo"
                    required
                    value={poloIdPlano}
                    onChange={(e) => setPoloIdPlano(e.target.value)}
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
                    htmlFor="plano-resp"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Responsável
                  </label>
                  <select
                    id="plano-resp"
                    value={responsavelUidPlano}
                    onChange={(e) => setResponsavelUidPlano(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.uid}>
                        {u.nome} ({u.perfil})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="plano-prazo"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Prazo *
                  </label>
                  <input
                    id="plano-prazo"
                    type="date"
                    required
                    value={prazoPlano}
                    onChange={(e) => setPrazoPlano(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="plano-economia"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Economia Estimada (R$)
                  </label>
                  <input
                    id="plano-economia"
                    type="number"
                    min="0"
                    step="10"
                    value={economiaPlano}
                    onChange={(e) => setEconomiaPlano(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="plano-status"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Status Inicial
                  </label>
                  <select
                    id="plano-status"
                    value={statusPlano}
                    onChange={(e) => setStatusPlano(e.target.value as StatusPlanoAcao)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="aberto">Aberto</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
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
                  {submitting ? 'Salvando...' : 'Salvar Plano de Ação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
