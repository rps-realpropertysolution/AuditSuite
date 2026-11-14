/**
 * Coloca no RGM o que veio dos relatórios exportados do LiveFacilities.
 *
 * Mesmo princípio da importação pela API: os NÚMEROS vêm do sistema, o texto
 * do gestor fica. Cada arquivo é conferido antes de entrar:
 *  - é do mesmo prédio (código do condomínio, quando o arquivo traz);
 *  - é do mês certo — financeiro = competência financeira do RGM
 *    (normalmente o mês anterior); operação = mês do RGM.
 * Arquivo que não confere é recusado com o motivo, nunca aplicado pela metade.
 */

import { chaveNome } from "../../../supabase/functions/_shared/livefacilities/mapear.ts";
import { novoId, pedidoEmAberto } from "../defaults";
import { formatarCompetencia, formatarMoeda, formatarNumero } from "../format";
import type { DadosRelatorio, LinhaFundo, LinhaGrupoContabil, LinhaPedido, LinhaUtilidade, RegistroArquivo } from "../types";
import type { ItemResumoImportacao } from "../importacao";
import type {
  BoletosPagos,
  FaturaConcessionaria,
  PedidosCompra,
  PosicaoFinanceira,
  PrevistoRealizado,
  RelatorioSistema,
} from "./tipos";

export const TITULO_RELATORIO: Record<RelatorioSistema["tipo"], string> = {
  previsto_realizado: "Previsto x Realizado",
  posicao_financeira: "Posição Financeira",
  boletos_pagos: "Lista de Boletos Pagos",
  fatura_agua: "Conta de água",
  fatura_energia: "Conta de energia",
  pedidos_compra: "Lista de Pedidos de Compra",
  informativo: "Relatório informativo",
};

export interface ContextoAplicacao {
  /** YYYY-MM-01 — mês do RGM (operação). */
  competencia: string;
  /** YYYY-MM-01 — prestação de contas usada no financeiro. */
  competenciaFinanceira: string;
  cdCondominio: string | null;
  agora?: Date;
}

export interface ArquivoParaAplicar {
  nome: string;
  relatorio: RelatorioSistema;
}

export interface ResultadoArquivos {
  dados: DadosRelatorio;
  preenchido: ItemResumoImportacao[];
  avisos: string[];
  /** Arquivos que não entraram, com o motivo. */
  recusados: { nome: string; motivo: string }[];
}

const mesAno = (comp: string) => formatarCompetencia(`${comp.slice(0, 7)}-01`);
const ehOrdinaria = (s: string) => /ordinari/.test(chaveNome(s));

/* -------------------------------------------------------------------------- */

const aplicarPrevistoRealizado = (d: DadosRelatorio, r: PrevistoRealizado, avisos: string[]) => {
  const temOrdinaria = r.despesas.some((x) => ehOrdinaria(x.fundo));
  const doOrcamento = r.despesas.filter((x) => (temOrdinaria ? ehOrdinaria(x.fundo) : true) && (x.previsto || x.realizado));

  const usados = new Set<string>();
  const grupos: LinhaGrupoContabil[] = doOrcamento.map((x) => {
    const existente = d.financeiro.grupos.find((g) => !usados.has(g.id) && chaveNome(g.grupo) === chaveNome(x.grupo));
    if (existente) usados.add(existente.id);
    return {
      id: existente?.id ?? novoId(),
      grupo: existente?.grupo || x.grupo,
      orcado: x.previsto,
      realizado: x.realizado,
      observacao: existente?.observacao ?? "",
    };
  });

  const sobras = d.financeiro.grupos.filter((g) => !usados.has(g.id) && (g.realizado > 0 || g.observacao.trim()));
  if (sobras.length) {
    avisos.push(
      `${sobras.length} grupo(s) que estavam no RGM não aparecem no Previsto x Realizado e foram mantidos: ` +
        `${sobras.map((g) => g.grupo).join(", ")}. Confira se são duplicados (nome diferente no sistema).`,
    );
  }

  let arrecadacao = d.financeiro.arrecadacao;
  const recebimentos = r.receitas.find((x) => ehOrdinaria(x.fundo) && /recebimento/.test(chaveNome(x.conta)));
  if (recebimentos && !arrecadacao.emitido && !arrecadacao.recebido) {
    arrecadacao = { emitido: recebimentos.previsto, recebido: recebimentos.realizado };
  }

  const orcado = grupos.reduce((s, g) => s + g.orcado, 0);
  const realizado = grupos.reduce((s, g) => s + g.realizado, 0);
  return {
    dados: { ...d, financeiro: { ...d.financeiro, grupos: [...grupos, ...sobras], arrecadacao } },
    item: {
      secao: "financeiro",
      rotulo: "Previsto x realizado",
      detalhe: `${grupos.length} grupos · previsto ${formatarMoeda(orcado)} · realizado ${formatarMoeda(realizado)}`,
    },
    secoes: ["financeiro", ...(arrecadacao !== d.financeiro.arrecadacao ? ["arrecadacao"] : [])],
  };
};

const aplicarPosicao = (d: DadosRelatorio, r: PosicaoFinanceira, avisos: string[]) => {
  const usados = new Set<string>();
  const fundos: LinhaFundo[] = r.fundos.map((f) => {
    const existente = d.financeiro.fundos.find((x) => !usados.has(x.id) && chaveNome(x.fundo) === chaveNome(f.fundo));
    if (existente) usados.add(existente.id);
    return { id: existente?.id ?? novoId(), fundo: existente?.fundo ?? f.fundo, anterior: f.anterior, creditos: f.creditos, debitos: f.debitos };
  });

  const removidos = d.financeiro.fundos.filter((x) => !usados.has(x.id) && (x.anterior || x.creditos || x.debitos));
  if (removidos.length) {
    avisos.push(
      `Fundos substituídos pela Posição Financeira: ${removidos.map((x) => x.fundo).join(", ")} saíram ` +
        `(eram linhas provisórias da importação ou não existem no sistema).`,
    );
  }

  const saldo = (lista: LinhaFundo[]) => lista.reduce((s, f) => s + f.anterior + f.creditos - f.debitos, 0);
  const anteriorAntes = d.financeiro.fundos.reduce((s, f) => s + f.anterior, 0);
  const anteriorAgora = fundos.reduce((s, f) => s + f.anterior, 0);
  if (anteriorAntes && Math.abs(anteriorAntes - anteriorAgora) > 1) {
    const finalConfere = Math.abs(saldo(d.financeiro.fundos) - saldo(fundos)) <= 1;
    avisos.push(
      finalConfere
        ? `O saldo final confere com o que estava no RGM (${formatarMoeda(saldo(fundos))}); o saldo anterior difere em ` +
            `${formatarMoeda(anteriorAntes - anteriorAgora)} — reclassificação entre contas no fluxo de caixa. Vale o da Posição Financeira.`
        : `O saldo anterior mudou de ${formatarMoeda(anteriorAntes)} para ${formatarMoeda(anteriorAgora)} com a Posição Financeira. ` +
            `Confira se o arquivo é do mês certo.`,
    );
  }

  return {
    dados: { ...d, financeiro: { ...d.financeiro, fundos } },
    item: { secao: "financeiro", rotulo: "Saldo por fundo", detalhe: `${fundos.length} fundos · saldo final ${formatarMoeda(saldo(fundos))}` },
    secoes: ["financeiro"],
  };
};

const aplicarBoletos = (d: DadosRelatorio, r: BoletosPagos) => ({
  dados: d,
  item: {
    secao: "financeiro",
    rotulo: "Boletos pagos (conferência)",
    detalhe:
      `${formatarNumero(r.boletos.quantidade)} boletos · ${formatarMoeda(r.boletos.valor)} em todas as contas` +
      (r.outrosCreditos ? ` + ${formatarMoeda(r.outrosCreditos)} de rendimentos e outros créditos` : "") +
      ` = ${formatarMoeda(r.totalGeral)}`,
  },
  secoes: [] as string[],
});

const aplicarFatura = (d: DadosRelatorio, r: FaturaConcessionaria) => {
  const padrao = r.tipo === "fatura_agua" ? /agua/ : /energia|eletric/;
  const linhas = [...d.utilidades.linhas];
  let i = linhas.findIndex((u) => padrao.test(chaveNome(u.utilidade)));
  if (i < 0) {
    linhas.push({
      id: novoId(),
      utilidade: r.tipo === "fatura_agua" ? "Água" : "Energia",
      unidade: r.unidade,
      consumo: 0,
      consumoAnterior: 0,
      ponta: 0,
      foraPonta: 0,
      faltas: 0,
      detalhamento: "",
      fatura: 0,
      faturaAnterior: 0,
      observacao: "",
    });
    i = linhas.length - 1;
  }
  const atual = linhas[i];
  const nova: LinhaUtilidade = {
    ...atual,
    unidade: r.unidade,
    consumo: r.consumo,
    consumoAnterior: r.consumoAnterior ?? atual.consumoAnterior,
    ponta: r.ponta,
    foraPonta: r.foraPonta,
    fatura: r.valor,
    detalhamento: r.detalhamento,
  };
  linhas[i] = nova;
  return {
    dados: { ...d, utilidades: { ...d.utilidades, linhas } },
    item: {
      secao: "utilidades",
      rotulo: nova.utilidade,
      detalhe: `${formatarNumero(r.consumo)} ${r.unidade} · fatura ${formatarMoeda(r.valor)} · conta em nome de ${r.cliente || "—"}`,
    },
    secoes: ["utilidades"],
  };
};

const aplicarPedidos = (d: DadosRelatorio, r: PedidosCompra) => {
  const atuais = d.suprimentos.pedidos;
  const doArquivo: LinhaPedido[] = r.pedidos.map((p) => ({
    id: atuais.find((a) => a.pedido === p.pedido)?.id ?? novoId(),
    ...p,
  }));
  const numeros = new Set(doArquivo.map((p) => p.pedido));
  // pedidos do mês passado ainda em curso, que não vieram neste arquivo, continuam
  const emCurso = atuais.filter((a) => !numeros.has(a.pedido) && pedidoEmAberto(a.status));
  const pedidos = [...doArquivo, ...emCurso];
  const total = doArquivo.reduce((s, p) => s + p.valor, 0);
  return {
    dados: { ...d, suprimentos: { ...d.suprimentos, pedidos } },
    item: {
      secao: "suprimentos",
      rotulo: "Pedidos de compra",
      detalhe: `${doArquivo.length} pedido(s) · ${formatarMoeda(total)} aprovados` + (emCurso.length ? ` · ${emCurso.length} em curso do mês anterior` : ""),
    },
    secoes: ["suprimentos"],
  };
};

/* -------------------------------------------------------------------------- */

/** Mês esperado de cada tipo de arquivo: financeiro x operação. */
const mesesAceitos = (tipo: RelatorioSistema["tipo"], ctx: ContextoAplicacao): string[] => {
  const op = ctx.competencia.slice(0, 7);
  const fin = ctx.competenciaFinanceira.slice(0, 7);
  if (tipo === "previsto_realizado" || tipo === "posicao_financeira" || tipo === "boletos_pagos") return [fin];
  // contas e compras: o mês do RGM ou o da prestação (as contas chegam com atraso)
  return [...new Set([op, fin])];
};

export const aplicarArquivos = (
  dados: DadosRelatorio,
  arquivos: ArquivoParaAplicar[],
  ctx: ContextoAplicacao,
): ResultadoArquivos => {
  const agora = (ctx.agora ?? new Date()).toISOString();
  const avisos: string[] = [];
  const preenchido: ItemResumoImportacao[] = [];
  const recusados: ResultadoArquivos["recusados"] = [];
  const registros: RegistroArquivo[] = [];
  let d = dados;

  // Posição antes do previsto x realizado não importa, mas a ordem fixa deixa o resumo previsível.
  const ordem: RelatorioSistema["tipo"][] = ["posicao_financeira", "previsto_realizado", "boletos_pagos", "fatura_agua", "fatura_energia", "pedidos_compra", "informativo"];
  const ordenados = [...arquivos].sort((a, b) => ordem.indexOf(a.relatorio.tipo) - ordem.indexOf(b.relatorio.tipo));

  for (const { nome, relatorio: r } of ordenados) {
    if (r.tipo === "informativo") {
      recusados.push({ nome, motivo: r.motivo });
      continue;
    }

    const cd = "cdCondominio" in r ? r.cdCondominio : null;
    if (cd && ctx.cdCondominio && cd !== ctx.cdCondominio) {
      recusados.push({ nome, motivo: `é do empreendimento ${cd}; este RGM é do ${ctx.cdCondominio}.` });
      continue;
    }

    const competencia = r.competencia;
    const aceitos = mesesAceitos(r.tipo, ctx);
    if (competencia && !aceitos.includes(competencia)) {
      const financeiro = r.tipo === "previsto_realizado" || r.tipo === "posicao_financeira" || r.tipo === "boletos_pagos";
      recusados.push({
        nome,
        motivo:
          `é de ${mesAno(competencia)}, mas ` +
          (financeiro
            ? `o financeiro deste RGM é a prestação de ${mesAno(ctx.competenciaFinanceira)}. Gere o relatório desse mês ou ajuste a competência financeira na seção Financeiro.`
            : `este RGM é de ${mesAno(ctx.competencia)}.`),
      });
      continue;
    }

    const aplicado =
      r.tipo === "previsto_realizado"
        ? aplicarPrevistoRealizado(d, r, avisos)
        : r.tipo === "posicao_financeira"
          ? aplicarPosicao(d, r, avisos)
          : r.tipo === "boletos_pagos"
            ? aplicarBoletos(d, r)
            : r.tipo === "pedidos_compra"
              ? aplicarPedidos(d, r)
              : aplicarFatura(d, r);

    d = aplicado.dados;
    preenchido.push({ ...aplicado.item, rotulo: `${aplicado.item.rotulo}${competencia ? ` · ${mesAno(competencia)}` : ""}` });
    registros.push({ nome, titulo: TITULO_RELATORIO[r.tipo], competencia: competencia ?? "", em: agora, secoes: aplicado.secoes });
  }

  // Conferência cruzada: boletos pagos x créditos da posição financeira.
  const posicao = arquivos.find((a) => a.relatorio.tipo === "posicao_financeira")?.relatorio as PosicaoFinanceira | undefined;
  const boletos = arquivos.find((a) => a.relatorio.tipo === "boletos_pagos")?.relatorio as BoletosPagos | undefined;
  if (posicao?.total && boletos && posicao.competencia === boletos.competencia) {
    const dif = boletos.totalGeral - posicao.total.creditos;
    if (Math.abs(dif) > 1) {
      avisos.push(`Os boletos pagos (${formatarMoeda(boletos.totalGeral)}) não batem com os créditos da Posição Financeira (${formatarMoeda(posicao.total.creditos)}).`);
    }
  }

  if (registros.length) {
    const novos = new Set(registros.map((x) => x.titulo));
    d = { ...d, arquivosImportados: [...d.arquivosImportados.filter((x) => !novos.has(x.titulo)), ...registros] };
  }

  return { dados: d, preenchido, avisos, recusados };
};
