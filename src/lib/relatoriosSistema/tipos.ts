/**
 * Relatórios exportados do LiveFacilities (PDF/Excel) que a API não entrega:
 * previsto x realizado, posição financeira, boletos pagos, contas de
 * concessionária e pedidos de compra. O gestor arrasta os arquivos no editor
 * e o RGM se preenche.
 */

/** Arquivo já lido — independente de navegador ou Node. */
export type ArquivoLido =
  | { nome: string; tipo: "pdf"; paginas: string[][]; totalPaginas: number }
  | { nome: string; tipo: "planilha"; linhas: unknown[][] };

export interface ValorPrevistoRealizado {
  previsto: number;
  realizado: number;
}

export interface PrevistoRealizado {
  tipo: "previsto_realizado";
  cdCondominio: string | null;
  /** YYYY-MM */
  competencia: string;
  receitas: ({ fundo: string; conta: string } & ValorPrevistoRealizado)[];
  /** Total de receita por fundo (linha de cabeçalho do fundo). */
  receitasPorFundo: ({ fundo: string } & ValorPrevistoRealizado)[];
  despesas: ({ fundo: string; grupo: string } & ValorPrevistoRealizado)[];
  despesasPorFundo: ({ fundo: string } & ValorPrevistoRealizado)[];
  total: { receita: number; despesa: number } | null;
}

export interface PosicaoFinanceira {
  tipo: "posicao_financeira";
  cdCondominio: string | null;
  competencia: string;
  fundos: { fundo: string; anterior: number; creditos: number; debitos: number; atual: number }[];
  total: { anterior: number; creditos: number; debitos: number; atual: number } | null;
}

export interface BoletosPagos {
  tipo: "boletos_pagos";
  competencia: string;
  boletos: { quantidade: number; valor: number };
  /** Rendimentos de aplicação, IRRF e demais créditos sem recibo. */
  outrosCreditos: number;
  totalGeral: number;
}

export interface FaturaConcessionaria {
  tipo: "fatura_agua" | "fatura_energia";
  concessionaria: string;
  /** Nome do cliente na conta — para conferir que é o prédio certo. */
  cliente: string;
  competencia: string;
  unidade: "m³" | "kWh";
  consumo: number;
  consumoAnterior: number | null;
  ponta: number;
  foraPonta: number;
  valor: number;
  detalhamento: string;
}

export interface PedidoCompra {
  pedido: string;
  status: string;
  valor: number;
  categoria: string;
  /** Grupo contábil (nível 2 da conta). */
  grupo: string;
  solicitacao: string; // YYYY-MM-DD
  prazo: string; // YYYY-MM-DD
}

export interface PedidosCompra {
  tipo: "pedidos_compra";
  cdCondominio: string | null;
  competencia: string | null;
  pedidos: PedidoCompra[];
}

/** Arquivos que reconhecemos mas que não alimentam o RGM (a API já cobre). */
export interface ArquivoInformativo {
  tipo: "informativo";
  titulo: string;
  motivo: string;
}

export type RelatorioSistema =
  | PrevistoRealizado
  | PosicaoFinanceira
  | BoletosPagos
  | FaturaConcessionaria
  | PedidosCompra
  | ArquivoInformativo;

export type ResultadoLeitura =
  | { ok: true; nome: string; relatorio: RelatorioSistema }
  | { ok: false; nome: string; erro: string };
