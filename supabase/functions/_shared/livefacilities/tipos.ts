/**
 * Tipos da API do LiveFacilities (RP Smart) — só o que o RGM consome.
 *
 * Fonte: Swagger do próprio sistema (`/api/swagger/v1/swagger.json`,
 * openapi 3.0.4), levantado em 13/11/2026. Todos os campos vêm como
 * opcionais/nulos no Swagger, por isso tudo aqui é `?`.
 *
 * Este arquivo é TypeScript puro, sem dependências: é usado pela Edge
 * Function (Deno), pelo script de teste local (Node) e pelos testes (Vitest).
 */

/* -------------------------------------------------------------------------- */
/* Envelope padrão                                                             */
/* -------------------------------------------------------------------------- */

export interface RetornoLF<T> {
  success?: boolean;
  statusCode?: number;
  errors?: { title?: string; detail?: string; errorMessage?: string } | null;
  data?: T[] | null;
  total?: number;
  pageIndex?: number;
  pageSize?: number;
  totalPages?: number;
}

/* -------------------------------------------------------------------------- */
/* Respostas usadas                                                            */
/* -------------------------------------------------------------------------- */

/** GET /OrdemServico/ListaAtividade */
export interface AtividadeLF {
  id_os?: number | null;
  cd_condominio?: string | null;
  nm_bloco?: string | null;
  tx_processocaminho?: string | null;
  nm_processopai?: string | null;
  nm_executante?: string | null;
  dt_ocorrencia?: string | null;
  dt_fimocorrencia?: string | null;
  dt_agendamento?: string | null;
  dt_conclusao?: string | null;
  dt_fechamento?: string | null;
  ds_atividade?: string | null;
  tx_statusatividade?: string | null;
  nm_statusatividade?: string | null;
  nm_atividadetipo?: string | null;
  nm_atividade?: string | null;
  nm_servico?: string | null;
  nm_periodo?: string | null;
}

export interface BoletoDetalheLF {
  nm_contacontabilgrau_1?: string | null;
  nm_contacontabilgrau_2?: string | null;
  nm_contacontabilgrau_3?: string | null;
  vl_recibodetalhe?: number | null;
}

/** GET /Boleto/ListaBoleto */
export interface BoletoLF {
  id_recibo?: number | null;
  id_unidade?: number | null;
  cd_unidade?: string | null;
  nm_bloco?: string | null;
  nm_pagador?: string | null;
  nm_recibostatus?: string | null;
  dt_vencimento?: string | null;
  dt_competencia?: string | null;
  dt_pagamento?: string | null;
  vl_recibo?: number | null;
  vl_recebido?: number | null;
  vl_recebidototal?: number | null;
  recibo_detalhe?: BoletoDetalheLF[] | null;
}

/** GET /Acordo/ListaAcordo */
export interface AcordoLF {
  cdUnidade?: string | null;
  nmBloco?: string | null;
  nmProprietario?: string | null;
  acordo?: { idAcordo?: number; acordo?: string | null } | null;
  detalhesParcelas?: { parcela?: number | null; valor?: number | null; valorRecebido?: number | null; vencimento?: string | null; pagamento?: string | null }[] | null;
  resumoAcordo?: { status?: string | null; quantidadeParcelas?: number | null; total?: number | null; totalPago?: number | null } | null;
}

/** GET /FluxoCaixa/FluxoCaixa */
export interface FluxoCaixaLF {
  id_empreendimento?: number;
  cd_empreendimento?: string | null;
  vl_saldoanterior?: number | null;
  vl_debito?: number | null;
  vl_credito?: number | null;
  vl_saldoatual?: number | null;
  /** Lançamentos do período. A hierarquia começa pelo fundo: "466. ORDINÁRIA -> 516. GRUPO GERADORES -> …" */
  listaFluxoCaixaDados?: { nm_contacontabilhierarquia?: string | null; vl_debito?: number | null; vl_credito?: number | null }[] | null;
}

/** GET /PrestacaoContas/ListaResumoEmissao */
export interface ResumoEmissaoLF {
  nm_contaprincipal?: string | null;
  vl_previsto?: number;
  vl_realizado?: number;
  vl_diferenca?: number;
}

/** GET /PrestacaoContas/despesas — envelope próprio (DespesasSaida). */
export interface DespesasSaidaLF {
  id_erro?: number;
  ds_mensagemErro?: string | null;
  total?: number;
  data?: DespesaLF[] | null;
}

export interface DespesaLF {
  dt_pagamento?: string | null;
  tx_historico?: string | null;
  vl_conta?: number;
  nm_conta1?: string | null;
  nm_conta2?: string | null;
  nm_conta3?: string | null;
}

/** GET /ContratoCompleto */
export interface ContratoLF {
  id_contrato?: number;
  nu_contrato?: string | null;
  nm_contratado?: string | null;
  nm_status?: string | null;
  dt_inicio?: string | null;
  dt_termino?: string | null;
  nm_tipocontrato?: string | null;
  nm_classificacao?: string | null;
  tipoClassificacao?: string | null;
  tx_objeto?: string | null;
}

/** GET /Documento/ListaDocumentoEmpreendimento — vem aninhado em 3 níveis. */
export interface DocumentoListaLF {
  empreendimento?: {
    empreendimentoId?: number | null;
    documentoTipo?: {
      documentoTipoNome?: string | null;
      documento?: DocumentoLF[] | null;
    }[] | null;
  }[] | null;
}

export interface DocumentoLF {
  documentoId?: number | null;
  documentoPaiId?: number | null;
  documentoTitulo?: string | null;
  dataFinal?: string | null;
  dataValidade?: string | null;
  documentoAtivo?: boolean | null;
}

/** GET /ControleFechamento/ListaControleFechamento */
export interface FechamentoLF {
  dt_periodoinicio?: string | null;
  dt_periodofinal?: string | null;
  nm_controlefechamentostatus?: string | null;
  sn_fechado?: boolean | null;
}

/* -------------------------------------------------------------------------- */
/* Saída neutra da importação                                                  */
/*                                                                             */
/* Não depende do modelo do RGM (src/lib/types.ts): a Edge Function não        */
/* enxerga a pasta src. Quem converte isto em DadosRelatorio é                 */
/* src/lib/importacao.ts, no navegador, com o gestor revisando.                */
/* -------------------------------------------------------------------------- */

export interface PeriodoLF {
  /** YYYY-MM-01 */
  competencia: string;
  /** YYYY-MM-DD */
  inicio: string;
  fim: string;
  /** Último dia do mês anterior — base da posição de inadimplência. */
  fimAnterior: string;
}

export interface SituacaoOSLF {
  concluidasNoPrazo: number;
  concluidasComAtraso: number;
  abertasNoPrazo: number;
  abertasAtrasadas: number;
  canceladas: number;
}

export interface DadosLF {
  /** Período operacional (OS, contratos, documentos). */
  periodo: PeriodoLF;
  /** Período financeiro: a última prestação de contas fechada (normalmente o mês anterior). */
  periodoFinanceiro: PeriodoLF;

  financeiro?: {
    saldoAnterior: number;
    creditos: number;
    debitos: number;
    saldoAtual: number;
    /** Movimento do mês por fundo (o saldo por fundo a API não informa). */
    porFundo?: { fundo: string; creditos: number; debitos: number }[];
  };
  despesasPorGrupo?: { grupo: string; valor: number }[];
  arrecadacao?: {
    emitido: number;
    recebido: number;
    contaReferencia: string;
    porConta: { conta: string; previsto: number; realizado: number }[];
  };
  inadimplencia?: { rubrica: string; ateAnterior: number; recebido: number; doMes: number }[];
  acordos?: {
    unidade: string;
    devedor: string;
    parcelas: number;
    parcelasPagas: number;
    valor: number;
    valorPago: number;
    status: string;
  }[];
  os?: {
    total: number;
    resumo: { preventivas: number; corretivas: number; acompanhamentos: number; rondas: number; naoRealizadas: number };
    situacao: SituacaoOSLF;
    disciplinas: { disciplina: string; quantidade: number }[];
  };
  contratos?: {
    fornecedor: string;
    objeto: string;
    vencimento: string;
    status: string;
    tipo: string;
  }[];
  documentos?: { documento: string; orgao: string; validade: string; permanente: boolean }[];
  fechamento?: { fechado: boolean; status: string } | null;
}

export interface ConsultaLF {
  nome: string;
  rota: string;
  ok: boolean;
  registros?: number;
  erro?: string;
}

export interface ResultadoImportacaoLF {
  dados: DadosLF;
  consultas: ConsultaLF[];
  avisos: string[];
}
