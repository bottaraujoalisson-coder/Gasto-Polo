import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateValorTotal,
  calculateRateioPartes,
  validateRateioSum,
  determineInitialStatus,
  getBudgetTrafficLight,
  getLancamentoValorNoPolo,
  detectWasteAlerts,
  DEFAULT_REDE_CONFIG,
} from './financeRules';
import { Categoria, Lancamento, Orcamento, Polo } from '../types';

test('calculateValorTotal multiplies quantity by unit value with 2 decimal precision', () => {
  assert.equal(calculateValorTotal(3, 19.99), 59.97);
  assert.equal(calculateValorTotal(1, 500), 500);
});

test('determineInitialStatus marks launches above approval limit as pendente', () => {
  assert.equal(determineInitialStatus(500, 500), 'aprovado');
  assert.equal(determineInitialStatus(500.01, 500), 'pendente');
  assert.equal(determineInitialStatus(1250, 500), 'pendente');
});

test('calculateRateioPartes closes exact cent sum for equal and proportional splits', () => {
  const polos = [
    { id: 'polo-a', indicadorTamanho: 300 },
    { id: 'polo-b', indicadorTamanho: 500 },
    { id: 'polo-c', indicadorTamanho: 200 },
  ];

  // Equal split of R$ 100,00 across 3 polos (33.34 + 33.33 + 33.33 = 100.00)
  const partesIgual = calculateRateioPartes(100, 'igual', polos);
  assert.equal(partesIgual.length, 3);
  assert.equal(validateRateioSum(100, partesIgual), true);

  // Proportional split of R$ 1.000,00 across 300/500/200 (300, 500, 200)
  const partesProp = calculateRateioPartes(1000, 'proporcional', polos);
  assert.equal(partesProp[0].valor, 300);
  assert.equal(partesProp[1].valor, 500);
  assert.equal(partesProp[2].valor, 200);
  assert.equal(validateRateioSum(1000, partesProp), true);
});

test('getBudgetTrafficLight returns verde <= 80, amarelo 80-100, vermelho > 100', () => {
  assert.equal(getBudgetTrafficLight(75, DEFAULT_REDE_CONFIG), 'verde');
  assert.equal(getBudgetTrafficLight(80, DEFAULT_REDE_CONFIG), 'amarelo');
  assert.equal(getBudgetTrafficLight(100, DEFAULT_REDE_CONFIG), 'amarelo');
  assert.equal(getBudgetTrafficLight(100.1, DEFAULT_REDE_CONFIG), 'vermelho');
  assert.equal(getBudgetTrafficLight(null, DEFAULT_REDE_CONFIG), 'neutro');
});

test('getLancamentoValorNoPolo allocates rateio shares to each individual polo', () => {
  const lancamentoRateado: Lancamento = {
    id: 'l1',
    redeId: 'r1',
    data: '2026-11-10',
    competencia: '2026-11',
    poloId: 'polo-a',
    tipo: 'marketing',
    categoriaId: 'cat-1',
    itemId: '',
    descricao: 'Campanha Regional',
    fornecedorId: 'f1',
    quantidade: 1,
    unidade: 'sv',
    valorUnitario: 900,
    valorTotal: 900,
    formaPagamento: 'PIX',
    responsavelUid: 'u1',
    emergencial: false,
    justificativa: '',
    campanhaId: '',
    rateio: {
      ativo: true,
      criterio: 'proporcional',
      partes: [
        { poloId: 'polo-a', valor: 400 },
        { poloId: 'polo-b', valor: 500 },
      ],
    },
    status: 'aprovado',
    comprovanteUrl: '',
    criadoPor: 'u1',
    criadoEm: '2026-11-10T10:00:00Z',
    atualizadoEm: '2026-11-10T10:00:00Z',
    excluido: false,
  };

  assert.equal(getLancamentoValorNoPolo(lancamentoRateado, 'polo-a'), 400);
  assert.equal(getLancamentoValorNoPolo(lancamentoRateado, 'polo-b'), 500);
  assert.equal(getLancamentoValorNoPolo(lancamentoRateado, 'polo-c'), 0);
  assert.equal(getLancamentoValorNoPolo(lancamentoRateado, 'ALL'), 900);
  assert.equal(getLancamentoValorNoPolo(lancamentoRateado, 'ALL', ['polo-a']), 400);
});

test('detectWasteAlerts triggers Alert 1 (Over Ceiling), Alert 2 (2+ Emergency in 90d), and Alert 5 (Despesas Diversas > 5%)', () => {
  const polos: Polo[] = [
    {
      id: 'polo-a',
      redeId: 'r1',
      nome: 'Polo Centro',
      cidade: 'São Paulo',
      ativo: true,
      indicadorTamanho: 400,
      criadoEm: '2026-01-01',
      atualizadoEm: '2026-01-01',
    },
  ];
  const categorias: Categoria[] = [
    {
      id: 'cat-limpeza',
      redeId: 'r1',
      nome: 'Materiais de limpeza',
      tipo: 'interno',
      ativa: true,
      criadoEm: '2026-01-01',
      atualizadoEm: '2026-01-01',
    },
    {
      id: 'cat-diversas',
      redeId: 'r1',
      nome: 'Despesas diversas',
      tipo: 'interno',
      ativa: true,
      criadoEm: '2026-01-01',
      atualizadoEm: '2026-01-01',
    },
  ];
  const orcamentos: Orcamento[] = [
    {
      id: '2026-11_polo-a_cat-limpeza',
      redeId: 'r1',
      mes: '2026-11',
      poloId: 'polo-a',
      categoriaId: 'cat-limpeza',
      teto: 500,
      criadoEm: '2026-11-01',
      atualizadoEm: '2026-11-01',
    },
  ];

  const baseLaunch = {
    redeId: 'r1',
    poloId: 'polo-a',
    tipo: 'interno' as const,
    fornecedorId: 'f1',
    unidade: 'cx',
    formaPagamento: 'PIX',
    responsavelUid: 'u1',
    campanhaId: '',
    rateio: { ativo: false, criterio: 'igual' as const, partes: [] },
    status: 'aprovado' as const,
    comprovanteUrl: '',
    criadoPor: 'u1',
    criadoEm: '2026-11-05',
    atualizadoEm: '2026-11-05',
    excluido: false,
  };

  const lancamentos: Lancamento[] = [
    {
      ...baseLaunch,
      id: 'l-emerg-1',
      data: '2026-10-15',
      competencia: '2026-10',
      categoriaId: 'cat-limpeza',
      itemId: 'item-papel',
      descricao: 'Papel Toalha Interfolha',
      quantidade: 4,
      valorUnitario: 80,
      valorTotal: 320,
      emergencial: true,
      justificativa: 'Acabou antes da entrega mensal',
    },
    {
      ...baseLaunch,
      id: 'l-emerg-2',
      data: '2026-11-12',
      competencia: '2026-11',
      categoriaId: 'cat-limpeza',
      itemId: 'item-papel',
      descricao: 'Papel Toalha Interfolha',
      quantidade: 8,
      valorUnitario: 80,
      valorTotal: 640, // crosses R$ 500 teto!
      emergencial: true,
      justificativa: 'Falta de estoque',
    },
    {
      ...baseLaunch,
      id: 'l-div-1',
      data: '2026-11-18',
      competencia: '2026-11',
      categoriaId: 'cat-diversas',
      itemId: '',
      descricao: 'Chaveiro urgente e taxas avulsas',
      quantidade: 1,
      valorUnitario: 120,
      valorTotal: 120, // 120 / (640 + 120) = 15.7% > 5%!
      emergencial: false,
      justificativa: 'Troca de fechadura da recepção',
    },
  ];

  const alerts = detectWasteAlerts({
    mesReferencia: '2026-11',
    poloIdFilter: 'ALL',
    polos,
    categorias,
    itens: [],
    lancamentos,
    orcamentos,
    campanhas: [],
    config: DEFAULT_REDE_CONFIG,
  });

  const types = alerts.map((a) => a.tipoNumero);
  assert.ok(types.includes(1), 'Should detect Alert 1 (Categoria acima do teto)');
  assert.ok(types.includes(2), 'Should detect Alert 2 (Item comprado em emergência 2+ vezes em 90 dias)');
  assert.ok(types.includes(5), 'Should detect Alert 5 (Despesas diversas acima de 5%)');
});
