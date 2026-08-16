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
  observacao: string;
}

/** Slide JURÍDICO */
export interface LinhaProcesso {
  id: string;
  numero: string;
  vara: string;
  objeto: string;
  andamento: string;
  proximaData: string; // YYYY-MM-DD
  criticidade: Criticidade;
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

/** Slide MATRIZ DE RISCOS E PLANO DE AÇÃO */
export interface LinhaRisco {
  id: string;
  assunto: string;
  criticidade: Criticidade;
  acao: string;
  responsavel: string;
  prazo: string; // YYYY-MM-DD
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

export interface DadosRelatorio {
  versao: 3;

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
    comentario: string;
  };

  utilidades: { linhas: LinhaUtilidade[]; comentario: string };
  capex: { linhas: LinhaCapex[]; comentario: string };
  riscos: { linhas: LinhaRisco[]; comentario: string };
  proximosPassos: { linhas: LinhaProximoPasso[]; comentario: string };

  fotos: Foto[];
  conclusao: string;
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
  "capex",
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

export type Papel = "diretoria" | "gestor" | "sindico" | "proprietario";
