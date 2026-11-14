/**
 * Modelo de domínio do Relatório Gerencial Mensal.
 *
 * A estrutura espelha o RGM que a RPS entrega hoje em PPTX
 * (ver public/templates — exemplo Send Cooliving, Junho/2026):
 *   capa · sumário 360° · financeiro · operação · fornecedores · contratos ·
 *   documentos · jurídico · utilidades · CAPEX · riscos · próximos passos.
 *
 * Regra central: tudo que pode ser CALCULADO não é digitado nem armazenado.
 * O gestor informa o dado bruto (orçado, realizado, consumo, data de validade);
 * status, semáforo, variação, saldo e o sumário executivo saem de `metrics.ts`.
 * É isso que corta a redigitação mensal.
 */

export type Criticidade = "baixa" | "media" | "alta";
export type StatusRelatorio = "rascunho" | "revisao" | "publicado";
export type Semaforo = "verde" | "amarelo" | "vermelho";

/**
 * Ficha técnica do ativo — o slide "O empreendimento".
 * Antes era texto repetido à mão todo mês no PPTX; agora é cadastro.
 */
export interface FichaEmpreendimento {
  areaConstruida?: number | null;
  areaPrivativa?: number | null;
  torres?: string;
  pavimentos?: string;
  vagas?: number | null;
  elevadores?: number | null;
  /** YYYY-MM */
  inicioGestao?: string;
  /** Diferenciais do ativo: "Heliponto homologado", "Mercado Livre de energia"… */
  destaques?: string[];
  sindicoDocumento?: string;
}

export interface Empreendimento {
  id: string;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  tipo: string;
  unidades: number | null;
  area_total: number | null;
  sindico_nome: string | null;
  proprietario_nome: string | null;
  gestor_nome: string | null;
  ativo: boolean;
  /** Número interno do empreendimento no LiveFacilities (ex.: 231). */
  lf_id_empreendimento: number | null;
  /** Código de 4 dígitos do topo do sistema (ex.: "0231"). Nem sempre igual ao id. */
  lf_cd_condominio: string | null;
  ficha: FichaEmpreendimento | null;
  foto_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Relatorio {
  id: string;
  empreendimento_id: string;
  competencia: string; // YYYY-MM-DD, sempre dia 1
  status: StatusRelatorio;
  dados: DadosRelatorio;
  indice_executivo: number | null;
  publicado_em: string | null;
  created_at: string;
  updated_at: string;
  empreendimento?: Empreendimento;
}

/* -------------------------------------------------------------------------- */
/* Linhas das tabelas                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Resumo financeiro contábil por fundo — a tabela que hoje é print do sistema
 * contábil: "Fundo | Anterior | Créditos | Débitos | Saldo".
 *
 * Receita, despesa e saldo do mês são os TOTAIS destas linhas, calculados em
 * `metrics.ts`. Uma versão anterior pedia os três totais como campos avulsos,
 * o que permitia o resumo contradizer o detalhe.
 */
export interface LinhaFundo {
  id: string;
  fundo: string;
  anterior: number;
  creditos: number;
  debitos: number;
  // saldo é DERIVADO: anterior + creditos - debitos
}

/** Posição de inadimplência por rubrica — também print do sistema contábil. */
export interface LinhaRubricaInadimplencia {
  id: string;
  rubrica: string;
  /** Posição acumulada até o fechamento do mês anterior. */
  ateAnterior: number;
  recebido: number;
  doMes: number;
  // total é DERIVADO: ateAnterior - recebido + doMes
}

/** Slide FINANCEIRO — "Grupo contábil | Orçado | Realizado | Status" */
export interface LinhaGrupoContabil {
  id: string;
  grupo: string;
  orcado: number;
  realizado: number;
  /** Justificativa do desvio. O template marca "Pendente*" quando falta. */
  observacao: string;
}

/** Slide OPERAÇÃO E MANUTENÇÃO — "Ocorrência | Ação executada | Resultado" */
export interface LinhaOcorrencia {
  id: string;
  ocorrencia: string;
  tipo: "preventiva" | "corretiva" | "melhoria";
  acao: string;
  resultado: string;
  concluida: boolean;
}

/** Slide FORNECEDORES E SLA */
export interface LinhaFornecedor {
  id: string;
  fornecedor: string;
  disciplina: string;
  /** Volume entregue no mês (ex.: 142 OS, 318 rotinas). */
  realizado: number;
  unidade: string;
  /** % de aderência ao SLA contratado. */
  sla: number;
  criticidade: Criticidade;
}

/** Slide CONTRATOS */
export interface LinhaContrato {
  id: string;
  fornecedor: string;
  objeto: string;
  situacao: "vigente" | "vencido" | "em_renovacao";
  vencimento: string; // YYYY-MM-DD (opcional)
  observacao: string;
}

/** Slide DOCUMENTOS E COMPLIANCE — status vem da data, não é digitado. */
export interface LinhaDocumento {
  id: string;
  documento: string;
  orgao: string;
  validade: string; // YYYY-MM-DD
  /** Documento sem vencimento (convenção, escritura…). Conta como "em dia". */
  permanente?: boolean;
  observacao: string;
}

/** Acordo de inadimplência (LiveFacilities: /Acordo/ListaAcordo). */
export interface LinhaAcordo {
  id: string;
  unidade: string;
  devedor: string;
  parcelas: number;
  parcelasPagas: number;
  valor: number;
  valorPago: number;
  status: string;
}

export type Prognostico = "provavel" | "possivel" | "remoto" | "nao_apurado";

/** Slide JURÍDICO · DILIGÊNCIA E CERTIDÕES */
export interface LinhaProcesso {
  id: string;
  numero: string;
  vara: string;
  /** Trabalhista, cível, fiscal… */
  tipo?: string;
  objeto: string;
  andamento: string;
  proximaData: string; // YYYY-MM-DD
  criticidade: Criticidade;
  /** Valor da causa informado pelo escritório. 0 = não apurado. */
  valor?: number;
  prognostico?: Prognostico;
}

/** Certidões do condomínio (CND federal, FGTS, CNDT, estadual, municipal). */
export interface LinhaCertidao {
  id: string;
  certidao: string;
  orgao: string;
  /** YYYY-MM-DD; vazio = não informada. */
  validade: string;
  /** Positiva = há pendência. */
  positiva?: boolean;
}

/**
 * Valor gerado no período — o que a gestão entregou em dinheiro.
 * O tipo é o critério RPS: só é "realizado" o que está comprovado em caixa ou
 * campo; estimativa de terceiro e projeção dependente de aprovação ficam à parte.
 */
export interface LinhaValorGerado {
  id: string;
  tipo: "realizado" | "estimado" | "projetado" | "investido";
  valor: number;
  /** Ex.: "inadimplência recuperada em setembro/2026" */
  descricao: string;
  /** Ex.: "/ano", "/mês" — vazio = valor único. */
  periodicidade?: string;
  observacao: string;
}

/** Slide UTILIDADES E SUSTENTABILIDADE */
export interface LinhaUtilidade {
  id: string;
  utilidade: string;
  unidade: string; // m³, kWh
  consumo: number;
  consumoAnterior: number;
  /** Energia: consumo na ponta e fora de ponta. Água deixa em zero. */
  ponta: number;
  foraPonta: number;
  /** Interrupções de fornecimento no mês. */
  faltas: number;
  detalhamento: string;
  fatura: number;
  faturaAnterior: number;
  observacao: string;
  // variação de consumo/custo e consumo médio diário são DERIVADOS
}

/**
 * Contagem de manutenções por disciplina — hoje é print do dashboard do
 * sistema de OS. Preenchido em formulário; quando a API do sistema estiver
 * disponível, ela popula estes mesmos campos sem mudar a estrutura.
 */
export interface LinhaDisciplina {
  id: string;
  disciplina: string;
  quantidade: number;
}

/** Slide SUPRIMENTOS — pedidos de compra do mês (Lista de Pedidos do LiveFacilities). */
export interface LinhaPedido {
  id: string;
  pedido: string;
  categoria: string;
  /** Grupo contábil (nível 2 da conta). */
  grupo: string;
  /** Como vem do sistema: Aprovado, Finalizado, Em orçamento… */
  status: string;
  valor: number;
  solicitacao: string; // YYYY-MM-DD
  prazo: string; // YYYY-MM-DD
}

/** Slide CAPEX E MELHORIAS */
export interface LinhaCapex {
  id: string;
  iniciativa: string;
  orcado: number;
  realizado: number;
  status: "planejado" | "em_andamento" | "concluido";
  beneficio: string;
  // desvio % é DERIVADO
}

/** Slide MATRIZ DE RISCOS E PLANO DE AÇÃO (action log) */
export interface LinhaRisco {
  id: string;
  assunto: string;
  criticidade: Criticidade;
  /** O que acontece se nada for feito. */
  consequencia?: string;
  acao: string;
  responsavel: string;
  prazo: string; // YYYY-MM-DD
  status?: "em_andamento" | "concluida" | "outra";
}

/** Slide PRÓXIMOS PASSOS E DECISÕES */
export interface LinhaProximoPasso {
  id: string;
  decisao: string;
  prazo: string;
  status: string;
  /** Marca decisões que dependem do síndico/proprietário, não do gestor. */
  dependeDoCliente: boolean;
}

export interface Foto {
  id: string;
  path: string; // caminho no Supabase Storage
  legenda: string;
  categoria: "melhoria" | "ocorrencia" | "manutencao" | "geral";
}

/* -------------------------------------------------------------------------- */
/* Corpo do relatório (persistido em relatorios.dados)                         */
/* -------------------------------------------------------------------------- */

/** Situação das ordens de serviço no período — o "painel de OS" do sistema. */
export interface SituacaoOS {
  concluidasNoPrazo: number;
  concluidasComAtraso: number;
  abertasNoPrazo: number;
  abertasAtrasadas: number;
  canceladas: number;
}

/** De onde vieram os dados — vira a linha "Fontes:" de cada slide. */
export interface RegistroImportacao {
  fonte: string;
  em: string; // ISO
  /** Seções preenchidas pela importação (ids de SECOES + "arrecadacao", "os"…). */
  secoes: string[];
  avisos: string[];
}

export interface DadosRelatorio {
  versao: 5;

  /**
   * Mês da prestação de contas usada no financeiro (YYYY-MM-01). O RGM de
   * outubro apresenta o financeiro de setembro — a última prestação fechada.
   * Vazio = mês anterior à competência (o padrão).
   */
  competenciaFinanceira: string;

  /** Slide 2 — o texto é do gestor; a tabela de semáforos é derivada. */
  sumario: {
    avaliacaoGeral: string;
    principaisResultados: string[];
    pontosAtencao: string[];
  };

  financeiro: {
    /** Receita, despesa e saldo do mês saem daqui — não são digitados. */
    fundos: LinhaFundo[];
    grupos: LinhaGrupoContabil[];
    /** Arrecadação da conta ordinária no mês: emitido x recebido. Taxa é derivada. */
    arrecadacao: { emitido: number; recebido: number };
    /** Saldo contábil x saldo bancário — conciliação dos fundos. */
    conciliacao: string;
    comentario: string;
  };

  operacao: {
    ocorrencias: LinhaOcorrencia[];
    /** Agregado do sistema de OS (o "dashboard" do relatório atual). */
    resumo: {
      preventivas: number;
      corretivas: number;
      acompanhamentos: number;
      rondas: number;
      /** Ordens programadas que não foram executadas no período. */
      naoRealizadas: number;
    };
    /** Prazo das OS: concluídas no prazo / com atraso, abertas, canceladas. */
    situacaoOS: SituacaoOS;
    disciplinas: LinhaDisciplina[];
    acessosFixos: number;
    acessosVisitantes: number;
    ocupacao: number; // %  (vacância é derivada)
    comentario: string;
  };

  fornecedores: { linhas: LinhaFornecedor[]; comentario: string };
  contratos: { linhas: LinhaContrato[]; comentario: string };
  documentos: { linhas: LinhaDocumento[]; comentario: string };

  juridico: {
    processos: LinhaProcesso[];
    /** Total consolidado é DERIVADO da soma das rubricas. */
    inadimplencia: { rubricas: LinhaRubricaInadimplencia[] };
    acordos: LinhaAcordo[];
    certidoes: LinhaCertidao[];
    /** Escritório que acompanha os processos. */
    escritorio: string;
    comentario: string;
  };

  utilidades: { linhas: LinhaUtilidade[]; comentario: string };
  suprimentos: { pedidos: LinhaPedido[]; comentario: string };
  capex: { linhas: LinhaCapex[]; comentario: string };
  valorGerado: { linhas: LinhaValorGerado[] };
  riscos: { linhas: LinhaRisco[]; comentario: string };
  proximosPassos: { linhas: LinhaProximoPasso[]; comentario: string };

  fotos: Foto[];
  conclusao: string;

  /** Última importação do LiveFacilities, se houve. */
  importacao: RegistroImportacao | null;

  /** Relatórios exportados do sistema (PDF/Excel) que o gestor importou. */
  arquivosImportados: RegistroArquivo[];
}

/** Um relatório do sistema importado por arquivo — vira a linha "Fontes:". */
export interface RegistroArquivo {
  nome: string;
  /** "Previsto x Realizado", "Posição Financeira"… */
  titulo: string;
  /** YYYY-MM do conteúdo do arquivo. */
  competencia: string;
  em: string; // ISO
  /** Mesmas chaves de RegistroImportacao.secoes ("financeiro", "utilidades"…). */
  secoes: string[];
}

export const SECOES = [
  "sumario",
  "financeiro",
  "operacao",
  "fornecedores",
  "contratos",
  "documentos",
  "juridico",
  "utilidades",
  "suprimentos",
  "capex",
  "valorGerado",
  "riscos",
  "proximosPassos",
  "fotos",
  "conclusao",
] as const;

export type SecaoId = (typeof SECOES)[number];

export interface Perfil {
  id: string;
  email: string;
  nome: string | null;
  cargo: string | null;
}

export type Papel = "administrador" | "diretoria" | "gestor" | "sindico" | "proprietario";

/** Papéis do time RPS — enxergam e editam todos os empreendimentos. */
export const PAPEIS_INTERNOS: Papel[] = ["administrador", "diretoria", "gestor"];
