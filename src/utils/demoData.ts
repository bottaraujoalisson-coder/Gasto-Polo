import {
  Auditoria,
  Campanha,
  Categoria,
  Fornecedor,
  ItemCatalogo,
  Lancamento,
  Orcamento,
  PlanoAcao,
  Polo,
  UsuarioRede,
} from '../types';
import { CATEGORIAS_PADRAO, getLastNMonths, roundCents } from './financeRules';

export interface DemoDataset {
  polos: Polo[];
  categorias: Categoria[];
  fornecedores: Fornecedor[];
  itens: ItemCatalogo[];
  orcamentos: Orcamento[];
  campanhas: Campanha[];
  lancamentos: Lancamento[];
  planosAcao: PlanoAcao[];
  usuariosExtras: UsuarioRede[];
  auditoria: Auditoria[];
}

export function buildDemoDataset(
  redeId: string,
  adminUid: string,
  baseMonth: string,
  existingCategorias: Categoria[]
): DemoDataset {
  const now = new Date().toISOString();

  // Ensure all 11 default categories exist
  const categorias: Categoria[] =
    existingCategorias.length >= 11
      ? existingCategorias
      : CATEGORIAS_PADRAO.map((c, idx) => ({
          id: `cat-padrao-${idx + 1}`,
          redeId,
          nome: c.nome,
          tipo: c.tipo,
          ativa: true,
          demo: existingCategorias.length === 0,
          criadoEm: now,
          atualizadoEm: now,
        }));

  const findCatId = (partialName: string): string => {
    const found = categorias.find((c) =>
      c.nome.toLowerCase().includes(partialName.toLowerCase())
    );
    return found ? found.id : categorias[0].id;
  };

  const catEscritorio = findCatId('escritório');
  const catLimpeza = findCatId('limpeza');
  const catCopa = findCatId('copa');
  const catAtendimento = findCatId('atendimento');
  const catManutencao = findCatId('manutenção');
  const catEquipamentos = findCatId('equipamentos');
  const catDiversas = findCatId('diversas');
  const catImpressao = findCatId('impressão');
  const catBrindes = findCatId('brindes');
  const catDigital = findCatId('divulgação');
  const catTrafego = findCatId('tráfego');

  // 3 Polos realistas
  const polos: Polo[] = [
    {
      id: 'demo-polo-centro',
      redeId,
      nome: 'Polo Centro — Matriz',
      cidade: 'São Paulo / SP',
      ativo: true,
      indicadorTamanho: 620,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-polo-campinas',
      redeId,
      nome: 'Polo Campinas Norte',
      cidade: 'Campinas / SP',
      ativo: true,
      indicadorTamanho: 410,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-polo-santos',
      redeId,
      nome: 'Polo Santos Litoral',
      cidade: 'Santos / SP',
      ativo: true,
      indicadorTamanho: 280,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
  ];

  const usuariosExtras: UsuarioRede[] = [
    {
      id: 'demo-user-gestor-centro',
      uid: 'demo-user-gestor-centro',
      redeId,
      nome: 'Mariana Costa (Gestora Centro/Campinas)',
      email: 'mariana.gestora@gastopolo.com.br',
      perfil: 'gestor',
      poloIds: ['demo-polo-centro', 'demo-polo-campinas'],
      ativo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-user-operador-centro',
      uid: 'demo-user-operador-centro',
      redeId,
      nome: 'Lucas Ribeiro (Operador Polo Centro)',
      email: 'lucas.centro@gastopolo.com.br',
      perfil: 'operador',
      poloIds: ['demo-polo-centro'],
      ativo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-user-operador-santos',
      uid: 'demo-user-operador-santos',
      redeId,
      nome: 'Fernanda Alves (Operadora Polo Santos)',
      email: 'fernanda.santos@gastopolo.com.br',
      perfil: 'operador',
      poloIds: ['demo-polo-santos'],
      ativo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-user-leitor',
      uid: 'demo-user-leitor',
      redeId,
      nome: 'Carlos Eduardo (Conselho / Leitor)',
      email: 'carlos.conselho@gastopolo.com.br',
      perfil: 'leitor',
      poloIds: ['demo-polo-centro', 'demo-polo-campinas', 'demo-polo-santos'],
      ativo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
  ];

  const fornecedores: Fornecedor[] = [
    {
      id: 'demo-forn-kalunga',
      redeId,
      nome: 'Kalunga Suprimentos Corporativos',
      contato: 'comercial@kalunga.com.br · (11) 3344-5500',
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-forn-limpmax',
      redeId,
      nome: 'LimpMax Distribuidora Higiene',
      contato: 'pedidos@limpmax.com.br · (11) 4002-8922',
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-forn-grafica',
      redeId,
      nome: 'Gráfica Expressa Paulista',
      contato: 'orcamento@graficapaulista.com.br · (19) 3211-9000',
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-forn-meta',
      redeId,
      nome: 'Meta Ads / Google Ads Brasil',
      contato: 'billing@ads.marketing.br',
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-forn-cafe',
      redeId,
      nome: 'Torrefação Café do Vale',
      contato: 'vendas@cafedovale.com.br · (13) 3222-1188',
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
  ];

  const itens: ItemCatalogo[] = [
    {
      id: 'demo-item-resma-a4',
      redeId,
      nome: 'Papel Sulfite A4 75g (Caixa 10 resmas)',
      unidade: 'cx',
      categoriaId: catEscritorio,
      estoqueMinimo: 6,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-item-toner',
      redeId,
      nome: 'Cartucho Toner Laser Preto Alto Rendimento',
      unidade: 'un',
      categoriaId: catEscritorio,
      estoqueMinimo: 4,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-item-papel-toalha',
      redeId,
      nome: 'Papel Toalha Interfolha 100% Celulose (Fardo 5000 fls)',
      unidade: 'fd',
      categoriaId: catLimpeza,
      estoqueMinimo: 8,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-item-detergente',
      redeId,
      nome: 'Desinfetante & Multiuso Concentrado 5L',
      unidade: 'gl',
      categoriaId: catLimpeza,
      estoqueMinimo: 6,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-item-cafe',
      redeId,
      nome: 'Café Torrado e Moído Tradicional 500g',
      unidade: 'pct',
      categoriaId: catCopa,
      estoqueMinimo: 20,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-item-copo',
      redeId,
      nome: 'Copo Descartável 200ml Biodegradável (Cx 2500 un)',
      unidade: 'cx',
      categoriaId: catCopa,
      estoqueMinimo: 5,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-item-panfleto',
      redeId,
      nome: 'Folheto Captação Vestibular Couchê 150g (Milheiro)',
      unidade: 'mil',
      categoriaId: catImpressao,
      estoqueMinimo: 5,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-item-kit-boas-vindas',
      redeId,
      nome: 'Kit Brinde Calouro (Garrafa Térmica + Caderno)',
      unidade: 'kit',
      categoriaId: catBrindes,
      estoqueMinimo: 50,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
  ];

  const months = getLastNMonths(baseMonth, 6);
  const orcamentos: Orcamento[] = [];

  const baseTetosByCat: Record<string, number> = {
    [catEscritorio]: 1400,
    [catLimpeza]: 1100,
    [catCopa]: 950,
    [catAtendimento]: 700,
    [catManutencao]: 1600,
    [catEquipamentos]: 2200,
    [catDiversas]: 350,
    [catImpressao]: 1500,
    [catBrindes]: 1200,
    [catDigital]: 1800,
    [catTrafego]: 3200,
  };

  for (const m of months) {
    for (const p of polos) {
      const scale = p.id === 'demo-polo-centro' ? 1.25 : p.id === 'demo-polo-campinas' ? 0.95 : 0.75;
      for (const c of categorias) {
        const tetoBase = baseTetosByCat[c.id] || 1000;
        const teto = Math.round((tetoBase * scale) / 50) * 50;
        orcamentos.push({
          id: `${m}_${p.id}_${c.id}`,
          redeId,
          mes: m,
          poloId: p.id,
          categoriaId: c.id,
          teto,
          demo: true,
          criadoEm: now,
          atualizadoEm: now,
        });
      }
    }
  }

  const campanhas: Campanha[] = [
    {
      id: 'demo-camp-vestibular-digital',
      redeId,
      poloId: 'demo-polo-centro',
      canal: 'trafego_pago',
      nome: 'Captação Matrículas 2º Semestre — Meta & Search',
      inicio: `${months[3]}-01`,
      fim: `${baseMonth}-28`,
      leads: 420,
      acoes: 68,
      tipoAcao: 'matricula',
      metaCustoPorAcao: 85,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-camp-acao-bairros',
      redeId,
      poloId: 'demo-polo-campinas',
      canal: 'impressao',
      nome: 'Plantão de Bolsas Presencial — Campinas Norte',
      inicio: `${months[4]}-01`,
      fim: `${baseMonth}-25`,
      leads: 195,
      acoes: 22,
      tipoAcao: 'matricula',
      metaCustoPorAcao: 75, // Will trigger CPA above target!
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-camp-open-day-santos',
      redeId,
      poloId: 'demo-polo-santos',
      canal: 'divulgacao_digital',
      nome: 'Semana Portas Abertas Litoral',
      inicio: `${months[4]}-10`,
      fim: `${baseMonth}-28`,
      leads: 310,
      acoes: 95,
      tipoAcao: 'visita',
      metaCustoPorAcao: 28,
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
  ];

  const lancamentos: Lancamento[] = [];
  let seq = 1;

  const addLaunch = (partial: Partial<Lancamento> & { data: string; poloId: string; categoriaId: string; descricao: string; quantidade: number; valorUnitario: number }) => {
    const valorTotal = roundCents(partial.quantidade * partial.valorUnitario);
    const id = `demo-lanc-${String(seq++).padStart(3, '0')}`;
    const cat = categorias.find((c) => c.id === partial.categoriaId);
    lancamentos.push({
      id,
      redeId,
      data: partial.data,
      competencia: partial.data.slice(0, 7),
      poloId: partial.poloId,
      tipo: cat?.tipo || 'interno',
      categoriaId: partial.categoriaId,
      itemId: partial.itemId || '',
      descricao: partial.descricao,
      fornecedorId: partial.fornecedorId || 'demo-forn-kalunga',
      quantidade: partial.quantidade,
      unidade: partial.unidade || 'un',
      valorUnitario: partial.valorUnitario,
      valorTotal,
      formaPagamento: partial.formaPagamento || 'PIX / Faturado 28d',
      responsavelUid: adminUid,
      emergencial: partial.emergencial ?? false,
      justificativa: partial.justificativa || '',
      campanhaId: partial.campanhaId || '',
      rateio: partial.rateio || { ativo: false, criterio: 'igual', partes: [] },
      status: partial.status || 'aprovado',
      comprovanteUrl: partial.comprovanteUrl || '',
      criadoPor: adminUid,
      criadoEm: now,
      atualizadoEm: now,
      excluido: false,
      demo: true,
    });
  };

  // Generate 6 months of realistic launches across all 3 polos
  months.forEach((m, mIdx) => {
    const isCurrentMonth = m === baseMonth;
    const isPrevMonth = mIdx === months.length - 2;
    const seasonalFactor = 0.88 + mIdx * 0.04;

    // Routine monthly purchases per polo
    polos.forEach((p, pIdx) => {
      const pScale = pIdx === 0 ? 1.2 : pIdx === 1 ? 0.95 : 0.72;

      // 1. Papel Sulfite A4
      const unitPriceSulfite =
        isCurrentMonth && p.id === 'demo-polo-campinas'
          ? 345 // +23% above min price 280 -> triggers Alert 3!
          : 280;
      addLaunch({
        data: `${m}-05`,
        poloId: p.id,
        categoriaId: catEscritorio,
        itemId: 'demo-item-resma-a4',
        descricao: 'Papel Sulfite A4 75g (Caixa 10 resmas)',
        fornecedorId: 'demo-forn-kalunga',
        quantidade: Math.max(2, Math.round(4 * pScale * seasonalFactor)),
        unidade: 'cx',
        valorUnitario: unitPriceSulfite,
      });

      // 2. Papel Toalha Interfolha
      addLaunch({
        data: `${m}-08`,
        poloId: p.id,
        categoriaId: catLimpeza,
        itemId: 'demo-item-papel-toalha',
        descricao: 'Papel Toalha Interfolha 100% Celulose (Fardo 5000 fls)',
        fornecedorId: 'demo-forn-limpmax',
        quantidade: isCurrentMonth && p.id === 'demo-polo-centro' ? 14 : Math.max(3, Math.round(6 * pScale)),
        unidade: 'fd',
        valorUnitario: 118,
      });

      // 3. Café Torrado e Moído
      addLaunch({
        data: `${m}-11`,
        poloId: p.id,
        categoriaId: catCopa,
        itemId: 'demo-item-cafe',
        descricao: 'Café Torrado e Moído Tradicional 500g',
        fornecedorId: 'demo-forn-cafe',
        quantidade: isCurrentMonth && p.id === 'demo-polo-centro' ? 38 : Math.round(18 * pScale),
        unidade: 'pct',
        valorUnitario: 24.5,
      });

      // 4. Manutenção Predial & Limpeza Técnica
      addLaunch({
        data: `${m}-15`,
        poloId: p.id,
        categoriaId: catManutencao,
        descricao: 'Manutenção preventiva de climatização e elétrica das salas',
        fornecedorId: 'demo-forn-limpmax',
        quantidade: 1,
        unidade: 'sv',
        valorUnitario: roundCents(980 * pScale * seasonalFactor),
      });

      // 5. Tráfego Pago vinculado à campanha
      const campId =
        p.id === 'demo-polo-centro'
          ? 'demo-camp-vestibular-digital'
          : p.id === 'demo-polo-campinas'
          ? 'demo-camp-acao-bairros'
          : 'demo-camp-open-day-santos';

      addLaunch({
        data: `${m}-19`,
        poloId: p.id,
        categoriaId: p.id === 'demo-polo-campinas' ? catImpressao : catTrafego,
        itemId: p.id === 'demo-polo-campinas' ? 'demo-item-panfleto' : '',
        descricao:
          p.id === 'demo-polo-campinas'
            ? 'Folheto Captação Vestibular Couchê 150g (Milheiro)'
            : `Impulsionamento Digital Captação Local — ${p.nome}`,
        fornecedorId: p.id === 'demo-polo-campinas' ? 'demo-forn-grafica' : 'demo-forn-meta',
        quantidade: p.id === 'demo-polo-campinas' ? 4 : 1,
        unidade: p.id === 'demo-polo-campinas' ? 'mil' : 'sv',
        valorUnitario: p.id === 'demo-polo-campinas' ? 420 : roundCents(1950 * pScale),
        campanhaId: campId,
      });
    });

    // Special waste alert scenarios in the last 2 months
    if (isPrevMonth) {
      // Emergency purchase #1 of Toner in Polo Centro (within 90 days)
      addLaunch({
        data: `${m}-22`,
        poloId: 'demo-polo-centro',
        categoriaId: catEscritorio,
        itemId: 'demo-item-toner',
        descricao: 'Cartucho Toner Laser Preto Alto Rendimento',
        fornecedorId: 'demo-forn-kalunga',
        quantidade: 3,
        unidade: 'un',
        valorUnitario: 245,
        emergencial: true,
        justificativa: 'Toner da secretaria zerou durante período de rematrícula sem reserva no armário.',
      });
    }

    if (isCurrentMonth) {
      // Emergency purchase #2 of Toner in Polo Centro (triggers Alert 2: 2+ emergency purchases in 90d AND pushes Escritório over ceiling -> triggers Alert 1!)
      addLaunch({
        data: `${m}-14`,
        poloId: 'demo-polo-centro',
        categoriaId: catEscritorio,
        itemId: 'demo-item-toner',
        descricao: 'Cartucho Toner Laser Preto Alto Rendimento',
        fornecedorId: 'demo-forn-kalunga',
        quantidade: 4,
        unidade: 'un',
        valorUnitario: 260,
        emergencial: true,
        justificativa: 'Compra emergencial para impressoras do atendimento — estoque mínimo não configurado.',
      });

      // Emergency purchase #3 of Papel Toalha in Polo Centro (pushes Limpeza over ceiling in Polo Centro -> Alert 1!)
      addLaunch({
        data: `${m}-18`,
        poloId: 'demo-polo-centro',
        categoriaId: catLimpeza,
        itemId: 'demo-item-detergente',
        descricao: 'Desinfetante & Multiuso Concentrado 5L',
        fornecedorId: 'demo-forn-limpmax',
        quantidade: 10,
        unidade: 'gl',
        valorUnitario: 78,
        emergencial: true,
        justificativa: 'Mutirão de higienização pós-evento acadêmico no auditório.',
      });

      // Despesas diversas above 5% in Polo Campinas (triggers Alert 5!)
      addLaunch({
        data: `${m}-16`,
        poloId: 'demo-polo-campinas',
        categoriaId: catDiversas,
        descricao: 'Serviço de chaveiro, frete motoboy avulso e taxas de cartório urgentes',
        fornecedorId: 'demo-forn-kalunga',
        quantidade: 1,
        unidade: 'sv',
        valorUnitario: 790,
        emergencial: true,
        justificativa: 'Troca emergencial de fechaduras da coordenação e envio de documentos.',
      });

      // Brindes sem campanha vinculada in Polo Santos (triggers Alert 6!)
      addLaunch({
        data: `${m}-17`,
        poloId: 'demo-polo-santos',
        categoriaId: catBrindes,
        itemId: 'demo-item-kit-boas-vindas',
        descricao: 'Kit Brinde Calouro (Garrafa Térmica + Caderno)',
        fornecedorId: 'demo-forn-grafica',
        quantidade: 30,
        unidade: 'kit',
        valorUnitario: 34,
        campanhaId: '', // Sem campanha!
      });

      // Rateio launch proportional across all 3 polos (Divulgação Digital Institucional)
      addLaunch({
        data: `${m}-20`,
        poloId: 'demo-polo-centro',
        categoriaId: catDigital,
        descricao: 'Produção de Vídeo Institucional & Mídia Compartilhada da Rede',
        fornecedorId: 'demo-forn-meta',
        quantidade: 1,
        unidade: 'sv',
        valorUnitario: 2620,
        campanhaId: 'demo-camp-vestibular-digital',
        rateio: {
          ativo: true,
          criterio: 'proporcional',
          partes: [
            { poloId: 'demo-polo-centro', valor: 1240 },
            { poloId: 'demo-polo-campinas', valor: 820 },
            { poloId: 'demo-polo-santos', valor: 560 },
          ],
        },
      });

      // Pending high-value launches (> R$ 500) awaiting Gestor/Admin approval
      addLaunch({
        data: `${m}-22`,
        poloId: 'demo-polo-centro',
        categoriaId: catEquipamentos,
        descricao: 'Substituição de 2 Projetores Multimídia HDMI Salas 04 e 05',
        fornecedorId: 'demo-forn-kalunga',
        quantidade: 2,
        unidade: 'un',
        valorUnitario: 1890,
        status: 'pendente',
        justificativa: 'Projetores antigos apresentaram falha na lâmpada durante aulas noturnas.',
      });

      addLaunch({
        data: `${m}-23`,
        poloId: 'demo-polo-campinas',
        categoriaId: catAtendimento,
        descricao: 'Totem de Autoatendimento e Senhas para Secretaria',
        fornecedorId: 'demo-forn-kalunga',
        quantidade: 1,
        unidade: 'un',
        valorUnitario: 1450,
        status: 'pendente',
        justificativa: 'Reduzir fila de atendimento nos horários de pico.',
      });
    }
  });

  const planosAcao: PlanoAcao[] = [
    {
      id: 'demo-plano-01',
      redeId,
      titulo: 'Contrato corporativo de Toner e Papel A4 com entrega programada',
      poloId: 'demo-polo-centro',
      categoriaId: catEscritorio,
      responsavelUid: adminUid,
      prazo: `${baseMonth}-28`,
      economiaEstimada: 680,
      status: 'em_andamento',
      origemAlerta: 'Compras emergenciais recorrentes: Cartucho Toner Laser Preto Alto Rendimento',
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
    {
      id: 'demo-plano-02',
      redeId,
      titulo: 'Reclassificar despesas avulsas de manutenção e limitar caixa pequeno',
      poloId: 'demo-polo-campinas',
      categoriaId: catDiversas,
      responsavelUid: adminUid,
      prazo: `${baseMonth}-30`,
      economiaEstimada: 440,
      status: 'aberto',
      origemAlerta: 'Despesas diversas acima de 5% no Polo Campinas Norte',
      demo: true,
      criadoEm: now,
      atualizadoEm: now,
    },
  ];

  const auditoria: Auditoria[] = [
    {
      id: 'demo-aud-01',
      redeId,
      entidade: 'Rede',
      entidadeId: redeId,
      acao: 'criar',
      uid: adminUid,
      resumo: 'Carga de dados de demonstração (3 polos e 6 meses de histórico)',
      antes: '',
      depois: '3 polos, 11 categorias, 6 meses de lançamentos e orçamentos',
      em: now,
    },
  ];

  return {
    polos,
    categorias,
    fornecedores,
    itens,
    orcamentos,
    campanhas,
    lancamentos,
    planosAcao,
    usuariosExtras,
    auditoria,
  };
}
