export type PerfilUsuario = 'admin' | 'gestor' | 'operador' | 'leitor';
export type TipoCategoria = 'interno' | 'marketing';
export type StatusLancamento = 'pendente' | 'aprovado' | 'rejeitado';
export type CriterioRateio = 'igual' | 'proporcional' | 'manual';
export type CanalMarketing = 'impressao' | 'brindes' | 'divulgacao_digital' | 'trafego_pago';
export type TipoAcaoMarketing = 'lead' | 'visita' | 'matricula';
export type StatusPlanoAcao = 'aberto' | 'em_andamento' | 'concluido' | 'cancelado';
export type AcaoAuditoria = 'criar' | 'editar' | 'excluir' | 'aprovar' | 'rejeitar';

export interface RedeConfig {
  limiteAprovacao: number; // default 500
  alerta1Pct: number; // default 80
  alerta2Pct: number; // default 100
  maxDiversasPct: number; // default 5
  rotuloTamanho: string; // default "Alunos ativos"
}

export interface Rede {
  id: string;
  nome: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
  config: RedeConfig;
}

export interface UsuarioRede {
  id: string;
  uid: string;
  redeId: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  poloIds: string[];
  ativo: boolean;
  conviteId?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type StatusConvite = 'pendente' | 'aceito' | 'cancelado' | 'expirado';

export interface ConviteUsuario {
  id: string;
  redeId: string;
  redeNome: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  poloIds: string[];
  status: StatusConvite;
  tokenHash: string;
  aceitoTokenHash: string;
  expiraEm: string;
  expiraEmMillis: number;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
  aceitoPorUid: string;
  aceitoEm: string;
}

export interface Polo {
  id: string;
  redeId: string;
  nome: string;
  cidade: string;
  ativo: boolean;
  indicadorTamanho: number;
  demo?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Categoria {
  id: string;
  redeId: string;
  nome: string;
  tipo: TipoCategoria;
  ativa: boolean;
  demo?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Fornecedor {
  id: string;
  redeId: string;
  nome: string;
  contato: string;
  demo?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ItemCatalogo {
  id: string;
  redeId: string;
  nome: string;
  unidade: string;
  categoriaId: string;
  estoqueMinimo: number;
  demo?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ParteRateio {
  poloId: string;
  valor: number;
}

export interface RateioLancamento {
  ativo: boolean;
  criterio: CriterioRateio;
  partes: ParteRateio[];
}

export interface Lancamento {
  id: string;
  redeId: string;
  data: string; // YYYY-MM-DD
  competencia: string; // YYYY-MM
  poloId: string;
  tipo: TipoCategoria;
  categoriaId: string;
  itemId: string;
  descricao: string;
  fornecedorId: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  formaPagamento: string;
  responsavelUid: string;
  emergencial: boolean;
  justificativa: string;
  campanhaId: string;
  rateio: RateioLancamento;
  status: StatusLancamento;
  comprovanteUrl: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
  excluido: boolean;
  demo?: boolean;
}

export interface Orcamento {
  id: string; // YYYY-MM_poloId_categoriaId
  redeId: string;
  mes: string; // YYYY-MM
  poloId: string;
  categoriaId: string;
  teto: number;
  demo?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Campanha {
  id: string;
  redeId: string;
  poloId: string; // specific poloId or 'ALL'
  canal: CanalMarketing;
  nome: string;
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD
  leads: number;
  acoes: number;
  tipoAcao: TipoAcaoMarketing;
  metaCustoPorAcao: number;
  demo?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface PlanoAcao {
  id: string;
  redeId: string;
  titulo: string;
  poloId: string;
  categoriaId: string;
  responsavelUid: string;
  prazo: string; // YYYY-MM-DD
  economiaEstimada: number;
  status: StatusPlanoAcao;
  origemAlerta: string;
  demo?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Auditoria {
  id: string;
  redeId: string;
  entidade: string;
  entidadeId: string;
  acao: AcaoAuditoria;
  uid: string;
  resumo: string;
  antes: string;
  depois: string;
  em: string;
}

export type GravidadeAlerta = 'alta' | 'media' | 'baixa';

export interface AlertaDesperdicio {
  id: string;
  tipoNumero: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  titulo: string;
  descricao: string;
  sugestao: string;
  gravidade: GravidadeAlerta;
  poloId: string;
  poloNome: string;
  categoriaId: string;
  categoriaNome: string;
  valorEnvolvido: number;
  economiaSugerida: number;
  lancamentoIds: string[];
}
