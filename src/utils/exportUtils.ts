import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Categoria, Fornecedor, Lancamento, Polo } from '../types';
import { formatBRL, formatDateBR, getLancamentoValorNoPolo } from './financeRules';

export interface ConsolidatedCategoryRow {
  categoria: string;
  valor: number;
  percentual: number;
  qtd: number;
}

export interface MonthlyEvolutionRow {
  mes: string;
  valor: number;
}

export interface PoloReportRow {
  posicao: number;
  poloId: string;
  poloNome: string;
  cidade: string;
  status: string;
  valorPeriodo: number;
  percentual: number;
  qtdLancamentos: number;
}

export interface DetailedExpenseRow {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  polo: string;
  formaPagamento: string;
  observacoes: string;
  valor: number;
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const escapeCsv = (val: string | number | boolean) => {
  const str = String(val ?? '').replace(/"/g, '""');
  return `"${str}"`;
};

export function exportLancamentosCSV(params: {
  lancamentos: Lancamento[];
  polos: Polo[];
  categorias: Categoria[];
  fornecedores?: Fornecedor[];
  filename?: string;
}): void {
  const { lancamentos, polos, categorias, filename } = params;
  const poloMap = new Map(polos.map((p) => [p.id, p.nome]));
  const catMap = new Map(categorias.map((c) => [c.id, c.nome]));

  const headers = [
    'Data',
    'Descrição da Despesa',
    'Categoria',
    'Polo',
    'Forma de Pagamento',
    'Observações',
    'Valor (R$)',
  ];

  const rows = lancamentos.map((l) => [
    formatDateBR(l.data),
    l.descricao,
    catMap.get(l.categoriaId) || 'Outros',
    poloMap.get(l.poloId) || l.poloId,
    l.formaPagamento || '-',
    l.justificativa || '',
    l.valorTotal.toFixed(2).replace('.', ','),
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(';'), ...rows.map((r) => r.map(escapeCsv).join(';'))].join('\n');

  triggerDownload(
    csvContent,
    filename || `unimar-despesas-${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8;'
  );
}

export function exportCorporateReportExcel(params: {
  reportType: 'consolidado' | 'por_polo' | 'detalhamento';
  empresaNome: string;
  periodoLabel: string;
  totalAcumulado: number;
  byCategory: ConsolidatedCategoryRow[];
  monthlyEvolution: MonthlyEvolutionRow[];
  byPolo: PoloReportRow[];
  detailedExpenses: DetailedExpenseRow[];
}): void {
  const {
    reportType,
    empresaNome,
    periodoLabel,
    totalAcumulado,
    byCategory,
    monthlyEvolution,
    byPolo,
    detailedExpenses,
  } = params;

  const lines: string[] = [];
  const addRow = (cols: (string | number)[]) => {
    lines.push(cols.map(escapeCsv).join(';'));
  };

  addRow([`Unimar - Gestão Financeira de Polos`]);
  addRow([`Empresa: ${empresaNome}`, `Período: ${periodoLabel}`]);
  addRow([`Total Acumulado no Período:`, totalAcumulado.toFixed(2).replace('.', ',')]);
  addRow([]);

  if (reportType === 'consolidado') {
    addRow(['RELATÓRIO CONSOLIDADO']);
    addRow([]);
    addRow(['DESPESAS POR CATEGORIA']);
    addRow(['Categoria', 'Quantidade', 'Total (R$)', 'Participação (%)']);
    byCategory.forEach((c) => {
      addRow([
        c.categoria,
        c.qtd,
        c.valor.toFixed(2).replace('.', ','),
        c.percentual.toFixed(1).replace('.', ',') + '%',
      ]);
    });
    addRow([]);
    addRow(['EVOLUÇÃO MENSAL']);
    addRow(['Mês / Competência', 'Total (R$)']);
    monthlyEvolution.forEach((m) => {
      addRow([m.mes, m.valor.toFixed(2).replace('.', ',')]);
    });
  } else if (reportType === 'por_polo') {
    addRow(['RELATÓRIO DE DESPESAS POR POLO']);
    addRow(['Posição', 'Polo', 'Cidade', 'Status', 'Lançamentos', 'Total (R$)', 'Participação (%)']);
    byPolo.forEach((p) => {
      addRow([
        `${p.posicao}º`,
        p.poloNome,
        p.cidade,
        p.status,
        p.qtdLancamentos,
        p.valorPeriodo.toFixed(2).replace('.', ','),
        p.percentual.toFixed(1).replace('.', ',') + '%',
      ]);
    });
  } else {
    addRow(['RELATÓRIO DETALHADO DE DESPESAS']);
    addRow(['Data', 'Descrição', 'Categoria', 'Polo', 'Forma de Pagamento', 'Observações', 'Valor (R$)']);
    detailedExpenses.forEach((d) => {
      addRow([
        formatDateBR(d.data),
        d.descricao,
        d.categoria,
        d.polo,
        d.formaPagamento,
        d.observacoes,
        d.valor.toFixed(2).replace('.', ','),
      ]);
    });
    addRow(['TOTAL', '', '', '', '', '', totalAcumulado.toFixed(2).replace('.', ',')]);
  }

  const csvContent = '\uFEFF' + lines.join('\n');
  const dateTag = new Date().toISOString().slice(0, 10);
  triggerDownload(
    csvContent,
    `relatorio-${reportType}-unimar-${dateTag}.csv`,
    'text/csv;charset=utf-8;'
  );
}

export function exportCorporateReportPDF(params: {
  reportType: 'consolidado' | 'por_polo' | 'detalhamento';
  empresaNome: string;
  periodoLabel: string;
  poloFiltroLabel: string;
  totalAcumulado: number;
  byCategory: ConsolidatedCategoryRow[];
  monthlyEvolution: MonthlyEvolutionRow[];
  byPolo: PoloReportRow[];
  detailedExpenses: DetailedExpenseRow[];
}): string {
  const {
    reportType,
    empresaNome,
    periodoLabel,
    poloFiltroLabel,
    totalAcumulado,
    byCategory,
    monthlyEvolution,
    byPolo,
    detailedExpenses,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const reportTitles: Record<typeof reportType, string> = {
    consolidado: 'Relatório Consolidado',
    por_polo: 'Relatório por Polo',
    detalhamento: 'Detalhamento de Despesas',
  };

  // Unimar Institutional Navy Header Banner (#002855 -> RGB 0, 40, 85)
  doc.setFillColor(0, 40, 85);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(`Unimar — ${reportTitles[reportType]}`, 14, 13);
  doc.setFontSize(9.5);
  doc.text(`Empresa: ${empresaNome}   |   Escopo: ${poloFiltroLabel}`, 14, 21);
  doc.text(
    `Período: ${periodoLabel}   |   Total Acumulado: ${formatBRL(totalAcumulado)}   |   Emissão: ${new Date().toLocaleDateString('pt-BR')}`,
    14,
    28
  );

  let yPos = 42;
  doc.setTextColor(15, 23, 42);

  if (reportType === 'consolidado') {
    doc.setFontSize(12);
    doc.text('1. Despesas por Categoria', 14, yPos);
    yPos += 4;

    autoTable(doc, {
      startY: yPos,
      head: [['Categoria', 'Qtd. Lançamentos', 'Total no Período', 'Participação (%)']],
      body:
        byCategory.length > 0
          ? byCategory.map((c) => [
              c.categoria,
              String(c.qtd),
              formatBRL(c.valor),
              `${c.percentual.toFixed(1)}%`,
            ])
          : [['Nenhuma despesa no período', '0', 'R$ 0,00', '0%']],
      foot: [['Total Acumulado', '', formatBRL(totalAcumulado), '100%']],
      theme: 'striped',
      headStyles: { fillColor: [0, 40, 85] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 9 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = ((doc as any).lastAutoTable?.finalY || yPos + 40) + 10;

    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.text('2. Evolução Mensal dos Gastos', 14, yPos);
    yPos += 4;

    autoTable(doc, {
      startY: yPos,
      head: [['Mês / Competência', 'Total de Despesas']],
      body: monthlyEvolution.map((m) => [m.mes, formatBRL(m.valor)]),
      theme: 'grid',
      headStyles: { fillColor: [0, 75, 141] },
      styles: { fontSize: 9 },
    });
  } else if (reportType === 'por_polo') {
    doc.setFontSize(12);
    doc.text('Comparativo e Ranking de Despesas por Polo', 14, yPos);
    yPos += 4;

    autoTable(doc, {
      startY: yPos,
      head: [['Ranking', 'Polo / Unidade', 'Cidade', 'Status', 'Lançamentos', 'Total (R$)', '% do Total']],
      body:
        byPolo.length > 0
          ? byPolo.map((p) => [
              `${p.posicao}º`,
              p.poloNome,
              p.cidade,
              p.status,
              String(p.qtdLancamentos),
              formatBRL(p.valorPeriodo),
              `${p.percentual.toFixed(1)}%`,
            ])
          : [['-', 'Nenhum polo encontrado', '-', '-', '0', 'R$ 0,00', '0%']],
      foot: [['', 'Total Consolidado', '', '', '', formatBRL(totalAcumulado), '100%']],
      theme: 'striped',
      headStyles: { fillColor: [0, 40, 85] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 9 },
    });
  } else {
    doc.setFontSize(12);
    doc.text(`Lista Detalhada de Despesas (${detailedExpenses.length} registros)`, 14, yPos);
    yPos += 4;

    autoTable(doc, {
      startY: yPos,
      head: [['Data', 'Descrição', 'Categoria', 'Polo', 'Pagamento', 'Valor']],
      body:
        detailedExpenses.length > 0
          ? detailedExpenses.map((d) => [
              formatDateBR(d.data),
              d.descricao,
              d.categoria,
              d.polo,
              d.formaPagamento,
              formatBRL(d.valor),
            ])
          : [['-', 'Nenhuma despesa registrada no período selecionado', '-', '-', '-', 'R$ 0,00']],
      foot: [['', 'Total Acumulado no Período', '', '', '', formatBRL(totalAcumulado)]],
      theme: 'striped',
      headStyles: { fillColor: [0, 40, 85] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 8.5 },
    });
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `relatorio-${reportType}-unimar-${dateTag}.pdf`;
  doc.save(filename);
  return filename;
}

export { getLancamentoValorNoPolo };
