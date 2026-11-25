import {
  AlertaDesperdicio,
  Campanha,
  Categoria,
  CriterioRateio,
  ItemCatalogo,
  Lancamento,
  Orcamento,
  ParteRateio,
  Polo,
  RedeConfig,
  StatusLancamento,
  TipoCategoria,
} from '../types';

export const CATEGORIAS_PADRAO: Array<{ nome: string; tipo: TipoCategoria }> = [
  { nome: 'Materiais de escritório', tipo: 'interno' },
  { nome: 'Materiais de limpeza', tipo: 'interno' },
  { nome: 'Produtos de copa e cozinha', tipo: 'interno' },
  { nome: 'Materiais de atendimento', tipo: 'interno' },
  { nome: 'Materiais de manutenção', tipo: 'interno' },
  { nome: 'Equipamentos e acessórios', tipo: 'interno' },
  { nome: 'Despesas diversas', tipo: 'interno' },
  { nome: 'Impressão de materiais', tipo: 'marketing' },
  { nome: 'Brindes promocionais', tipo: 'marketing' },
  { nome: 'Divulgação digital', tipo: 'marketing' },
  { nome: 'Tráfego pago', tipo: 'marketing' },
];

export const DEFAULT_REDE_CONFIG: RedeConfig = {
  limiteAprovacao: 500,
  alerta1Pct: 80,
  alerta2Pct: 100,
  maxDiversasPct: 5,
  rotuloTamanho: 'Alunos ativos',
};

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number): string {
  if (!Number.isFinite(value)) return 'R$ 0,00';
  return brlFormatter.format(value);
}

export function formatNumberBR(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return numberFormatter.format(value);
}

export function formatPct(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits).replace('.', ',')}%`;
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return '—';
  const clean = isoDate.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatMonthBR(competencia: string): string {
  if (!competencia || competencia.length < 7) return competencia;
  const [year, month] = competencia.split('-');
  const names = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const idx = parseInt(month, 10) - 1;
  return `${names[idx] || month}/${year}`;
}

export function getCurrentDateSaoPaulo(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback if timezone database is unavailable
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthSaoPaulo(now: Date = new Date()): string {
  return getCurrentDateSaoPaulo(now).slice(0, 7);
}

export function getPreviousMonth(competencia: string): string {
  const [yStr, mStr] = competencia.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function getNextMonth(competencia: string): string {
  const [yStr, mStr] = competencia.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function getLastNMonths(baseCompetencia: string, count: number): string[] {
  const result: string[] = [];
  let curr = baseCompetencia;
  for (let i = 0; i < count; i++) {
    result.unshift(curr);
    curr = getPreviousMonth(curr);
  }
  return result;
}

/**
 * Generates a sorted list of selectable months (descending) centered around
 * the real current month AND always preserving any manually selected month
 * (including neighbors across year rollovers).
 */
export function getSelectableMonths(
  currentMonth: string = getCurrentMonthSaoPaulo(),
  selectedMonth?: string,
  pastMonthsCount = 14,
  futureMonthsCount = 2
): string[] {
  const set = new Set<string>();

  let anchor = currentMonth;
  for (let i = 0; i < futureMonthsCount; i++) {
    anchor = getNextMonth(anchor);
  }
  getLastNMonths(anchor, pastMonthsCount + futureMonthsCount + 1).forEach((m) => set.add(m));

  if (selectedMonth && /^[0-9]{4}-[0-9]{2}$/.test(selectedMonth)) {
    set.add(selectedMonth);
    set.add(getPreviousMonth(selectedMonth));
    set.add(getNextMonth(selectedMonth));
  }

  return Array.from(set).sort().reverse();
}

export function generateInviteToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashInviteTokenSha256(token: string): Promise<string> {
  const clean = token.trim();
  const encoded = new TextEncoder().encode(clean);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isInviteExpired(expiraEmMillis: number, nowMillis: number = Date.now()): boolean {
  return !Number.isFinite(expiraEmMillis) || expiraEmMillis <= nowMillis;
}

export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateValorTotal(quantidade: number, valorUnitario: number): number {
  const q = Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1;
  const v = Number.isFinite(valorUnitario) && valorUnitario >= 0 ? valorUnitario : 0;
  return roundCents(q * v);
}

export function determineInitialStatus(valorTotal: number, limiteAprovacao: number): StatusLancamento {
  return valorTotal > limiteAprovacao ? 'pendente' : 'aprovado';
}

export function calculateRateioPartes(
  valorTotal: number,
  criterio: CriterioRateio,
  polos: Array<{ id: string; indicadorTamanho: number }>
): ParteRateio[] {
  if (polos.length === 0) return [];
  const totalCents = Math.round(valorTotal * 100);
  if (totalCents <= 0) {
    return polos.map((p) => ({ poloId: p.id, valor: 0 }));
  }

  let rawCents: number[] = [];
  if (criterio === 'igual') {
    const base = Math.floor(totalCents / polos.length);
    rawCents = polos.map(() => base);
  } else {
    const totalIndicador = polos.reduce((acc, p) => acc + Math.max(0, p.indicadorTamanho || 0), 0);
    if (totalIndicador <= 0) {
      const base = Math.floor(totalCents / polos.length);
      rawCents = polos.map(() => base);
    } else {
      rawCents = polos.map((p) =>
        Math.floor((totalCents * Math.max(0, p.indicadorTamanho || 0)) / totalIndicador)
      );
    }
  }

  const allocated = rawCents.reduce((a, b) => a + b, 0);
  let remainder = totalCents - allocated;
  let idx = 0;
  while (remainder > 0) {
    rawCents[idx % rawCents.length] += 1;
    remainder -= 1;
    idx += 1;
  }

  return polos.map((p, i) => ({
    poloId: p.id,
    valor: rawCents[i] / 100,
  }));
}

export function validateRateioSum(valorTotal: number, partes: ParteRateio[]): boolean {
  if (!partes || partes.length === 0) return false;
  const sumCents = partes.reduce((acc, p) => acc + Math.round((p.valor || 0) * 100), 0);
  const totalCents = Math.round(valorTotal * 100);
  return sumCents === totalCents;
}

/**
 * Returns the effective monetary portion of a Lancamento that belongs to the given polo filter.
 * Respects rateio splits and RBAC allowedPoloIds.
 */
export function getLancamentoValorNoPolo(
  lancamento: Lancamento,
  poloIdFilter: string | 'ALL',
  allowedPoloIds?: string[]
): number {
  const isAllowed = (pId: string) =>
    !allowedPoloIds || allowedPoloIds.length === 0 || allowedPoloIds.includes(pId);

  if (lancamento.rateio?.ativo && lancamento.rateio.partes?.length > 0) {
    if (poloIdFilter === 'ALL') {
      return roundCents(
        lancamento.rateio.partes
          .filter((pt) => isAllowed(pt.poloId))
          .reduce((acc, pt) => acc + pt.valor, 0)
      );
    }
    if (!isAllowed(poloIdFilter)) return 0;
    const found = lancamento.rateio.partes.find((pt) => pt.poloId === poloIdFilter);
    return found ? roundCents(found.valor) : 0;
  }

  if (poloIdFilter === 'ALL') {
    return isAllowed(lancamento.poloId) ? lancamento.valorTotal : 0;
  }
  if (!isAllowed(poloIdFilter)) return 0;
  return lancamento.poloId === poloIdFilter ? lancamento.valorTotal : 0;
}

export function isDespesaDiversa(categoriaNome: string): boolean {
  return categoriaNome.trim().toLowerCase() === 'despesas diversas';
}

export function getBudgetTrafficLight(
  pct: number | null,
  config: RedeConfig = DEFAULT_REDE_CONFIG
): 'verde' | 'amarelo' | 'vermelho' | 'neutro' {
  if (pct === null || !Number.isFinite(pct)) return 'neutro';
  if (pct > config.alerta2Pct) return 'vermelho';
  if (pct >= config.alerta1Pct) return 'amarelo';
  return 'verde';
}

export function calculateMonthlyVariation(atual: number, anterior: number): number | null {
  if (anterior <= 0) return atual > 0 ? 100 : 0;
  return roundCents(((atual - anterior) / anterior) * 100);
}

/**
 * Detects all 7 automatic waste alerts (Desperdícios) on real data.
 */
export function detectWasteAlerts(params: {
  mesReferencia: string; // YYYY-MM
  poloIdFilter: string | 'ALL';
  allowedPoloIds?: string[];
  polos: Polo[];
  categorias: Categoria[];
  itens: ItemCatalogo[];
  lancamentos: Lancamento[];
  orcamentos: Orcamento[];
  campanhas: Campanha[];
  config: RedeConfig;
}): AlertaDesperdicio[] {
  const {
    mesReferencia,
    poloIdFilter,
    allowedPoloIds,
    polos,
    categorias,
    itens,
    lancamentos,
    orcamentos,
    campanhas,
    config,
  } = params;

  const alerts: AlertaDesperdicio[] = [];
  const activeLaunchList = lancamentos.filter(
    (l) => !l.excluido && l.status === 'aprovado'
  );

  const visiblePolos = polos.filter((p) => {
    if (poloIdFilter !== 'ALL' && p.id !== poloIdFilter) return false;
    if (allowedPoloIds && allowedPoloIds.length > 0 && !allowedPoloIds.includes(p.id)) return false;
    return p.ativo;
  });

  const catMap = new Map(categorias.map((c) => [c.id, c]));
  const itemMap = new Map(itens.map((i) => [i.id, i]));

  // Reference end date for 90-day windows
  const refDateObj = new Date(`${mesReferencia}-28T12:00:00Z`);
  const ninetyDaysAgoObj = new Date(refDateObj.getTime() - 90 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgoISO = ninetyDaysAgoObj.toISOString().slice(0, 10);
  const refDateISO = `${mesReferencia}-31`;

  // 1. Alerta 1: Categoria acima do teto
  for (const polo of visiblePolos) {
    for (const cat of categorias) {
      const orc = orcamentos.find(
        (o) => o.mes === mesReferencia && o.poloId === polo.id && o.categoriaId === cat.id
      );
      if (!orc || orc.teto <= 0) continue;

      const matchingLaunches = activeLaunchList.filter(
        (l) =>
          l.competencia === mesReferencia &&
          l.categoriaId === cat.id &&
          getLancamentoValorNoPolo(l, polo.id) > 0
      );
      const gasto = roundCents(
        matchingLaunches.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, polo.id), 0)
      );
      const pct = (gasto / orc.teto) * 100;

      if (pct > config.alerta2Pct) {
        const excesso = roundCents(gasto - orc.teto);
        alerts.push({
          id: `alerta-1-${mesReferencia}-${polo.id}-${cat.id}`,
          tipoNumero: 1,
          titulo: `Categoria acima do teto: ${cat.nome}`,
          descricao: `O polo ${polo.nome} gastou ${formatBRL(gasto)} (${pct.toFixed(1)}%) para um teto de ${formatBRL(orc.teto)} em ${formatMonthBR(mesReferencia)}.`,
          sugestao: `Renegociar fornecedores de ${cat.nome} ou bloquear novas compras não urgentes no polo ${polo.nome}.`,
          gravidade: pct >= 120 ? 'alta' : 'media',
          poloId: polo.id,
          poloNome: polo.nome,
          categoriaId: cat.id,
          categoriaNome: cat.nome,
          valorEnvolvido: gasto,
          economiaSugerida: excesso,
          lancamentoIds: matchingLaunches.map((l) => l.id),
        });
      }
    }
  }

  // 2. Alerta 2: Item comprado em emergência 2+ vezes em 90 dias (sugerir estoque mínimo)
  const window90Launches = activeLaunchList.filter(
    (l) => l.data >= ninetyDaysAgoISO && l.data <= refDateISO
  );

  for (const polo of visiblePolos) {
    const emergencyByItem = new Map<string, Lancamento[]>();
    for (const l of window90Launches) {
      if (!l.emergencial) continue;
      if (getLancamentoValorNoPolo(l, polo.id) <= 0) continue;
      const key = l.itemId || l.descricao.trim().toLowerCase();
      const arr = emergencyByItem.get(key) || [];
      arr.push(l);
      emergencyByItem.set(key, arr);
    }

    for (const [key, list] of emergencyByItem.entries()) {
      if (list.length >= 2) {
        const first = list[0];
        const cat = catMap.get(first.categoriaId);
        const catalogItem = itemMap.get(first.itemId);
        const itemLabel = catalogItem?.nome || first.descricao;
        const totalEmergencia = roundCents(
          list.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, polo.id), 0)
        );
        const qtdTotal = list.reduce((acc, l) => acc + (l.quantidade || 1), 0);
        const estoqueSugerido = Math.max(catalogItem?.estoqueMinimo || 0, Math.ceil(qtdTotal / 2));

        alerts.push({
          id: `alerta-2-${polo.id}-${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
          tipoNumero: 2,
          titulo: `Compras emergenciais recorrentes: ${itemLabel}`,
          descricao: `Comprado em caráter emergencial ${list.length} vezes nos últimos 90 dias no polo ${polo.nome}, somando ${formatBRL(totalEmergencia)}.`,
          sugestao: `Definir estoque mínimo de ${estoqueSugerido} ${first.unidade || 'un'} no catálogo e programar compra mensal planejada.`,
          gravidade: list.length >= 3 ? 'alta' : 'media',
          poloId: polo.id,
          poloNome: polo.nome,
          categoriaId: first.categoriaId,
          categoriaNome: cat?.nome || 'Geral',
          valorEnvolvido: totalEmergencia,
          economiaSugerida: roundCents(totalEmergencia * 0.2),
          lancamentoIds: list.map((l) => l.id),
        });
      }
    }
  }

  // 3. Alerta 3: Mesmo item com preço unitário 15%+ acima do menor preço pago na rede em 90 dias
  const minPriceByItem = new Map<string, number>();
  for (const l of window90Launches) {
    if (!l.valorUnitario || l.valorUnitario <= 0) continue;
    const key = l.itemId || l.descricao.trim().toLowerCase();
    const currentMin = minPriceByItem.get(key);
    if (currentMin === undefined || l.valorUnitario < currentMin) {
      minPriceByItem.set(key, l.valorUnitario);
    }
  }

  for (const polo of visiblePolos) {
    const monthPoloLaunches = activeLaunchList.filter(
      (l) => l.competencia === mesReferencia && l.poloId === polo.id && l.valorUnitario > 0
    );
    for (const l of monthPoloLaunches) {
      const key = l.itemId || l.descricao.trim().toLowerCase();
      const minNetworkPrice = minPriceByItem.get(key);
      if (minNetworkPrice && l.valorUnitario >= minNetworkPrice * 1.15) {
        const diffPct = ((l.valorUnitario - minNetworkPrice) / minNetworkPrice) * 100;
        const sobrecusto = roundCents((l.valorUnitario - minNetworkPrice) * (l.quantidade || 1));
        const catalogItem = itemMap.get(l.itemId);
        const cat = catMap.get(l.categoriaId);
        const itemLabel = catalogItem?.nome || l.descricao;
        alerts.push({
          id: `alerta-3-${l.id}`,
          tipoNumero: 3,
          titulo: `Variação de preço unitário (+${diffPct.toFixed(0)}%): ${itemLabel}`,
          descricao: `Pago ${formatBRL(l.valorUnitario)}/${l.unidade || 'un'} no polo ${polo.nome}, enquanto o menor preço na rede nos últimos 90 dias foi ${formatBRL(minNetworkPrice)}.`,
          sugestao: `Padronizar compra com o fornecedor de menor custo da rede para economizar ${formatBRL(sobrecusto)}.`,
          gravidade: diffPct >= 30 ? 'alta' : 'media',
          poloId: polo.id,
          poloNome: polo.nome,
          categoriaId: l.categoriaId,
          categoriaNome: cat?.nome || 'Geral',
          valorEnvolvido: l.valorTotal,
          economiaSugerida: sobrecusto,
          lancamentoIds: [l.id],
        });
      }
    }
  }

  // 4. Alerta 4: Consumo do item 30%+ acima da média dos últimos 3 meses
  const m1 = getPreviousMonth(mesReferencia);
  const m2 = getPreviousMonth(m1);
  const m3 = getPreviousMonth(m2);
  const prev3Months = [m1, m2, m3];

  for (const polo of visiblePolos) {
    const currentMonthLaunches = activeLaunchList.filter(
      (l) => l.competencia === mesReferencia && l.poloId === polo.id
    );
    const currentQtyByItem = new Map<string, { qty: number; valor: number; launches: Lancamento[] }>();
    for (const l of currentMonthLaunches) {
      const key = l.itemId || l.descricao.trim().toLowerCase();
      const cur = currentQtyByItem.get(key) || { qty: 0, valor: 0, launches: [] };
      cur.qty += l.quantidade || 1;
      cur.valor += l.valorTotal;
      cur.launches.push(l);
      currentQtyByItem.set(key, cur);
    }

    for (const [key, currData] of currentQtyByItem.entries()) {
      const prevLaunches = activeLaunchList.filter(
        (l) =>
          prev3Months.includes(l.competencia) &&
          l.poloId === polo.id &&
          (l.itemId || l.descricao.trim().toLowerCase()) === key
      );
      if (prevLaunches.length === 0) continue;
      const totalPrevQty = prevLaunches.reduce((acc, l) => acc + (l.quantidade || 1), 0);
      const avgPrevQty = totalPrevQty / 3;
      if (avgPrevQty > 0 && currData.qty >= avgPrevQty * 1.3) {
        const first = currData.launches[0];
        const catalogItem = itemMap.get(first.itemId);
        const cat = catMap.get(first.categoriaId);
        const itemLabel = catalogItem?.nome || first.descricao;
        const aumentoPct = ((currData.qty - avgPrevQty) / avgPrevQty) * 100;
        alerts.push({
          id: `alerta-4-${mesReferencia}-${polo.id}-${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
          tipoNumero: 4,
          titulo: `Consumo +${aumentoPct.toFixed(0)}% acima da média: ${itemLabel}`,
          descricao: `Consumo de ${formatNumberBR(currData.qty)} ${first.unidade || 'un'} em ${formatMonthBR(mesReferencia)} no polo ${polo.nome} contra média trimestral de ${formatNumberBR(roundCents(avgPrevQty))}.`,
          sugestao: `Auditar controle de estoque e requisição interna de ${itemLabel} no polo ${polo.nome}.`,
          gravidade: aumentoPct >= 50 ? 'alta' : 'media',
          poloId: polo.id,
          poloNome: polo.nome,
          categoriaId: first.categoriaId,
          categoriaNome: cat?.nome || 'Geral',
          valorEnvolvido: roundCents(currData.valor),
          economiaSugerida: roundCents(currData.valor * 0.25),
          lancamentoIds: currData.launches.map((l) => l.id),
        });
      }
    }
  }

  // 5. Alerta 5: Despesas diversas acima de maxDiversasPct do total do polo
  const catDiversas = categorias.find((c) => isDespesaDiversa(c.nome));
  if (catDiversas) {
    for (const polo of visiblePolos) {
      const poloMonthLaunches = activeLaunchList.filter(
        (l) => l.competencia === mesReferencia && getLancamentoValorNoPolo(l, polo.id) > 0
      );
      const totalPolo = roundCents(
        poloMonthLaunches.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, polo.id), 0)
      );
      if (totalPolo <= 0) continue;

      const diversasLaunches = poloMonthLaunches.filter((l) => l.categoriaId === catDiversas.id);
      const totalDiversas = roundCents(
        diversasLaunches.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, polo.id), 0)
      );
      const diversasPct = (totalDiversas / totalPolo) * 100;

      if (diversasPct > config.maxDiversasPct) {
        const limiteReais = roundCents((totalPolo * config.maxDiversasPct) / 100);
        alerts.push({
          id: `alerta-5-${mesReferencia}-${polo.id}`,
          tipoNumero: 5,
          titulo: `Despesas diversas acima de ${config.maxDiversasPct}% no ${polo.nome}`,
          descricao: `Despesas diversas somam ${formatBRL(totalDiversas)} (${diversasPct.toFixed(1)}% do total do polo), superando o limite configurado de ${config.maxDiversasPct}% (${formatBRL(limiteReais)}).`,
          sugestao: `Reclassificar gastos recorrentes em categorias específicas e restringir compras sem classificação.`,
          gravidade: diversasPct >= config.maxDiversasPct * 2 ? 'alta' : 'media',
          poloId: polo.id,
          poloNome: polo.nome,
          categoriaId: catDiversas.id,
          categoriaNome: catDiversas.nome,
          valorEnvolvido: totalDiversas,
          economiaSugerida: roundCents(Math.max(0, totalDiversas - limiteReais)),
          lancamentoIds: diversasLaunches.map((l) => l.id),
        });
      }
    }
  }

  // 6. Alerta 6: Brindes e impressos sem campanha vinculada
  const catMarketingFisicoIds = new Set(
    categorias
      .filter((c) => {
        const n = c.nome.toLowerCase();
        return n.includes('brinde') || n.includes('impress');
      })
      .map((c) => c.id)
  );

  for (const polo of visiblePolos) {
    const semCampanha = activeLaunchList.filter(
      (l) =>
        l.competencia === mesReferencia &&
        catMarketingFisicoIds.has(l.categoriaId) &&
        !l.campanhaId &&
        getLancamentoValorNoPolo(l, polo.id) > 0
    );
    if (semCampanha.length > 0) {
      const valorSemCampanha = roundCents(
        semCampanha.reduce((acc, l) => acc + getLancamentoValorNoPolo(l, polo.id), 0)
      );
      const firstCat = catMap.get(semCampanha[0].categoriaId);
      alerts.push({
        id: `alerta-6-${mesReferencia}-${polo.id}`,
        tipoNumero: 6,
        titulo: `Brindes/Impressos sem campanha vinculada (${polo.nome})`,
        descricao: `${semCampanha.length} lançamento(s) de materiais promocionais (${formatBRL(valorSemCampanha)}) sem campanha associada para mensuração de retorno.`,
        sugestao: `Vincular todos os gastos de brindes e impressos a uma campanha ativa com meta de leads/matrículas.`,
        gravidade: 'baixa',
        poloId: polo.id,
        poloNome: polo.nome,
        categoriaId: semCampanha[0].categoriaId,
        categoriaNome: firstCat?.nome || 'Marketing',
        valorEnvolvido: valorSemCampanha,
        economiaSugerida: roundCents(valorSemCampanha * 0.15),
        lancamentoIds: semCampanha.map((l) => l.id),
      });
    }
  }

  // 7. Alerta 7: Custo por ação (CPA) acima da meta
  for (const camp of campanhas) {
    if (
      poloIdFilter !== 'ALL' &&
      camp.poloId !== 'ALL' &&
      camp.poloId !== poloIdFilter
    ) {
      continue;
    }
    if (
      allowedPoloIds &&
      allowedPoloIds.length > 0 &&
      camp.poloId !== 'ALL' &&
      !allowedPoloIds.includes(camp.poloId)
    ) {
      continue;
    }
    const campLaunches = activeLaunchList.filter((l) => l.campanhaId === camp.id);
    const investimento = roundCents(
      campLaunches.reduce((acc, l) => acc + l.valorTotal, 0)
    );
    if (investimento <= 0 || camp.metaCustoPorAcao <= 0) continue;
    const cpaReal = camp.acoes > 0 ? roundCents(investimento / camp.acoes) : investimento;
    if (cpaReal > camp.metaCustoPorAcao) {
      const poloObj = polos.find((p) => p.id === camp.poloId);
      const excessoCpa = roundCents(
        camp.acoes > 0 ? (cpaReal - camp.metaCustoPorAcao) * camp.acoes : investimento * 0.3
      );
      alerts.push({
        id: `alerta-7-${camp.id}`,
        tipoNumero: 7,
        titulo: `Custo por ${camp.tipoAcao} acima da meta: ${camp.nome}`,
        descricao: `CPA atual de ${formatBRL(cpaReal)} (${camp.acoes} ${camp.tipoAcao}s para ${formatBRL(investimento)} investidos) supera a meta de ${formatBRL(camp.metaCustoPorAcao)}.`,
        sugestao: `Realocar verba da campanha "${camp.nome}" para canais com menor CPA ou revisar criativos/abordagem comercial.`,
        gravidade: cpaReal >= camp.metaCustoPorAcao * 1.3 ? 'alta' : 'media',
        poloId: camp.poloId,
        poloNome: poloObj?.nome || 'Rede Consolidada',
        categoriaId: campLaunches[0]?.categoriaId || '',
        categoriaNome: 'Marketing',
        valorEnvolvido: investimento,
        economiaSugerida: Math.max(0, excessoCpa),
        lancamentoIds: campLaunches.map((l) => l.id),
      });
    }
  }

  const weight = { alta: 3, media: 2, baixa: 1 };
  const isCoreAlert = (t: number) => (t === 1 || t === 2 || t === 5 ? 1 : 0);
  return alerts.sort(
    (a, b) =>
      isCoreAlert(b.tipoNumero) - isCoreAlert(a.tipoNumero) ||
      weight[b.gravidade] - weight[a.gravidade] ||
      b.valorEnvolvido - a.valorEnvolvido
  );
}
