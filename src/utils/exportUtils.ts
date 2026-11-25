import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertaDesperdicio,
  Campanha,
  Categoria,
  Fornecedor,
  Lancamento,
  Orcamento,
  PlanoAcao,
  Polo,
  Rede,
} from '../types';
import {
  formatBRL,
  formatDateBR,
  formatMonthBR,
  formatNumberBR,
  formatPct,
  getLancamentoValorNoPolo,
  roundCents,
} from './financeRules';

export function exportLancamentosCSV(params: {
  lancamentos: Lancamento[];
  polos: Polo[];
  categorias: Categoria[];
  fornecedores: Fornecedor[];
  filename?: string;
}): void {
  const { lancamentos, polos, categorias, fornecedores, filename } = params;
  const poloMap = new Map(polos.map((p) => [p.id, p.nome]));
  const catMap = new Map(categorias.map((c) => [c.id, c.nome]));
  const fornMap = new Map(fornecedores.map((f) => [f.id, f.nome]));

  const headers = [
    'Data',
    'Competência',
    'Polo',
    'Tipo',
    'Categoria',
    'Descrição / Item',
    'Fornecedor',
    'Quantidade',
    'Unidade',
    'Valor Unitário (R$)',
    'Valor Total (R$)',
    'Emergencial',
    'Rateio',
    'Status',
    'Forma Pagamento',
    'Justificativa',
  ];

  const escapeCsv = (val: string | number | boolean) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = lancamentos.map((l) => [
    formatDateBR(l.data),
    l.competencia,
    poloMap.get(l.poloId) || l.poloId,
    l.tipo === 'marketing' ? 'Marketing' : 'Interno',
    catMap.get(l.categoriaId) || l.categoriaId,
    l.descricao,
    fornMap.get(l.fornecedorId) || 'Não informado',
    String(l.quantidade).replace('.', ','),
    l.unidade,
    l.valorUnitario.toFixed(2).replace('.', ','),
    l.valorTotal.toFixed(2).replace('.', ','),
    l.emergencial ? 'Sim' : 'Não',
    l.rateio?.ativo ? `Sim (${l.rateio.criterio})` : 'Não',
    l.status.toUpperCase(),
    l.formaPagamento,
    l.justificativa,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(';'), ...rows.map((r) => r.map(escapeCsv).join(';'))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `gastopolo-lancamentos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateMonthlyReportPDF(params: {
  rede: Rede;
  mes: string;
  poloFilter: string | 'ALL';
  polos: Polo[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  orcamentos: Orcamento[];
  campanhas: Campanha[];
  alertas: AlertaDesperdicio[];
  planosAcao: PlanoAcao[];
  totalMes: number;
  totalMesAnterior: number;
  variacaoPct: number | null;
  tetoTotal: number;
  pctTeto: number | null;
  totalEmergencial: number;
  pctEmergencial: number;
  indicadorTotal: number;
}): string {
  const {
    rede,
    mes,
    poloFilter,
    polos,
    categorias,
    lancamentos,
    orcamentos,
    campanhas,
    alertas,
    planosAcao,
    totalMes,
    totalMesAnterior,
    variacaoPct,
    tetoTotal,
    pctTeto,
    totalEmergencial,
    pctEmergencial,
    indicadorTotal,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const poloSelecionado =
    poloFilter === 'ALL'
      ? 'Consolidado da Rede (Todos os Polos)'
      : polos.find((p) => p.id === poloFilter)?.nome || poloFilter;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(`GastoPolo — Relatório Mensal de Gastos`, 14, 13);
  doc.setFontSize(10);
  doc.text(`Rede: ${rede.nome}   |   Unidade: ${poloSelecionado}`, 14, 21);
  doc.text(
    `Competência: ${formatMonthBR(mes)}   |   Emitido em: ${new Date().toLocaleDateString('pt-BR')}`,
    14,
    27
  );

  let yPos = 40;

  // 1. Resumo Executivo
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text('1. Resumo Executivo', 14, yPos);
  yPos += 4;

  const custoPorIndicador = indicadorTotal > 0 ? totalMes / indicadorTotal : 0;

  autoTable(doc, {
    startY: yPos,
    head: [['Indicador', 'Valor Apurado', 'Referência / Meta']],
    body: [
      ['Gasto Total Aprovado no Mês', formatBRL(totalMes), `Mês anterior: ${formatBRL(totalMesAnterior)}`],
      ['Variação Mensal', formatPct(variacaoPct), 'Comparativo com competência anterior'],
      [
        'Teto Orçamentário Utilizado',
        tetoTotal > 0 ? `${formatPct(pctTeto)} (${formatBRL(totalMes)})` : 'Sem teto definido',
        tetoTotal > 0 ? `Teto Total: ${formatBRL(tetoTotal)}` : 'Defina tetos na tela de Orçamento',
      ],
      [
        'Compras Emergenciais',
        `${formatBRL(totalEmergencial)} (${formatPct(pctEmergencial)})`,
        'Recomendado abaixo de 10%',
      ],
      [
        `Gasto por ${rede.config.rotuloTamanho}`,
        `${formatBRL(custoPorIndicador)} / unidade`,
        `Base: ${formatNumberBR(indicadorTotal)} ${rede.config.rotuloTamanho}`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = ((doc as any).lastAutoTable?.finalY || yPos + 45) + 8;

  // 2. Categorias x Teto
  doc.setFontSize(12);
  doc.text('2. Desempenho por Categoria × Teto Mensal', 14, yPos);
  yPos += 4;

  const catRows = categorias
    .filter((c) => c.ativa)
    .map((cat) => {
      const gasto = roundCents(
        lancamentos
          .filter((l) => !l.excluido && l.status === 'aprovado' && l.competencia === mes && l.categoriaId === cat.id)
          .reduce((acc, l) => acc + getLancamentoValorNoPolo(l, poloFilter), 0)
      );
      const teto = roundCents(
        orcamentos
          .filter(
            (o) =>
              o.mes === mes &&
              o.categoriaId === cat.id &&
              (poloFilter === 'ALL' || o.poloId === poloFilter)
          )
          .reduce((acc, o) => acc + o.teto, 0)
      );
      const pct = teto > 0 ? (gasto / teto) * 100 : null;
      const statusStr =
        pct === null
          ? 'Sem teto definido'
          : pct > rede.config.alerta2Pct
          ? 'ACIMA DO TETO'
          : pct >= rede.config.alerta1Pct
          ? 'Atenção (80-100%)'
          : 'Dentro do teto';

      return [
        cat.nome,
        cat.tipo === 'marketing' ? 'Marketing' : 'Interno',
        formatBRL(gasto),
        teto > 0 ? formatBRL(teto) : 'Sem teto',
        pct !== null ? formatPct(pct) : '—',
        statusStr,
      ];
    });

  autoTable(doc, {
    startY: yPos,
    head: [['Categoria', 'Tipo', 'Gasto Aprovado', 'Teto Mensal', '% Teto', 'Situação']],
    body: catRows,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 8.5 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = ((doc as any).lastAutoTable?.finalY || yPos + 55) + 8;

  // 3. Top Itens e Compras Emergenciais
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }
  doc.setFontSize(12);
  doc.text('3. Top Lançamentos e Compras Emergenciais do Mês', 14, yPos);
  yPos += 4;

  const approvedMonthLaunches = lancamentos
    .filter(
      (l) =>
        !l.excluido &&
        l.status === 'aprovado' &&
        l.competencia === mes &&
        getLancamentoValorNoPolo(l, poloFilter) > 0
    )
    .sort((a, b) => getLancamentoValorNoPolo(b, poloFilter) - getLancamentoValorNoPolo(a, poloFilter))
    .slice(0, 10);

  const poloMap = new Map(polos.map((p) => [p.id, p.nome]));
  const catMap = new Map(categorias.map((c) => [c.id, c.nome]));

  autoTable(doc, {
    startY: yPos,
    head: [['Data', 'Polo', 'Descrição / Item', 'Categoria', 'Emerg.', 'Valor no Polo']],
    body:
      approvedMonthLaunches.length > 0
        ? approvedMonthLaunches.map((l) => [
            formatDateBR(l.data),
            poloMap.get(l.poloId) || l.poloId,
            l.descricao,
            catMap.get(l.categoriaId) || '',
            l.emergencial ? 'SIM' : 'Não',
            formatBRL(getLancamentoValorNoPolo(l, poloFilter)),
          ])
        : [['—', '—', 'Nenhum lançamento aprovado no período', '—', '—', 'R$ 0,00']],
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 8 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = ((doc as any).lastAutoTable?.finalY || yPos + 45) + 8;

  // 4. Marketing e Custo por Ação + Alertas e Planos de Ação
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }
  doc.setFontSize(12);
  doc.text('4. Campanhas de Marketing & Custo por Ação (CPA)', 14, yPos);
  yPos += 4;

  const visibleCampanhas = campanhas.filter(
    (c) => poloFilter === 'ALL' || c.poloId === 'ALL' || c.poloId === poloFilter
  );

  autoTable(doc, {
    startY: yPos,
    head: [['Campanha', 'Canal', 'Investimento', 'Ações', 'CPA Real', 'Meta CPA']],
    body:
      visibleCampanhas.length > 0
        ? visibleCampanhas.map((c) => {
            const inv = roundCents(
              lancamentos
                .filter((l) => !l.excluido && l.status === 'aprovado' && l.campanhaId === c.id)
                .reduce((acc, l) => acc + l.valorTotal, 0)
            );
            const cpa = c.acoes > 0 ? inv / c.acoes : 0;
            return [
              c.nome,
              c.canal,
              formatBRL(inv),
              `${c.acoes} (${c.tipoAcao})`,
              c.acoes > 0 ? formatBRL(cpa) : '—',
              formatBRL(c.metaCustoPorAcao),
            ];
          })
        : [['Nenhuma campanha registrada', '—', 'R$ 0,00', '0', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 8 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = ((doc as any).lastAutoTable?.finalY || yPos + 35) + 8;

  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }
  doc.setFontSize(12);
  doc.text('5. Alertas de Desperdício & Planos de Ação', 14, yPos);
  yPos += 4;

  autoTable(doc, {
    startY: yPos,
    head: [['Gravidade', 'Polo', 'Alerta Detectado', 'Valor Envolvido', 'Economia Sugerida']],
    body:
      alertas.length > 0
        ? alertas.map((a) => [
            a.gravidade.toUpperCase(),
            a.poloNome,
            a.titulo,
            formatBRL(a.valorEnvolvido),
            formatBRL(a.economiaSugerida),
          ])
        : [['NORMAL', poloSelecionado, 'Nenhum alerta de desperdício no período', 'R$ 0,00', 'R$ 0,00']],
    theme: 'striped',
    headStyles: { fillColor: [185, 28, 28] },
    styles: { fontSize: 8 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = ((doc as any).lastAutoTable?.finalY || yPos + 35) + 8;

  if (planosAcao.length > 0) {
    if (yPos > 235) {
      doc.addPage();
      yPos = 20;
    }
    autoTable(doc, {
      startY: yPos,
      head: [['Plano de Ação', 'Polo', 'Prazo', 'Economia Est.', 'Status']],
      body: planosAcao.map((pa) => [
        pa.titulo,
        poloMap.get(pa.poloId) || pa.poloId,
        formatDateBR(pa.prazo),
        formatBRL(pa.economiaEstimada),
        pa.status.toUpperCase(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52] },
      styles: { fontSize: 8 },
    });
  }

  const filename = `relatorio-gastopolo-${mes}-${poloFilter.toLowerCase()}.pdf`;
  doc.save(filename);
  return filename;
}
