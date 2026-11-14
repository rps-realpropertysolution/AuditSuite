/**
 * Leitura gerencial automática.
 *
 * O motivo de existir: o gestor que não tem tempo de escrever não pode
 * gerar um slide vazio. Quando o comentário da seção está em branco, a
 * apresentação usa estes tópicos — frases curtas, com o número que importa
 * em destaque, no mesmo tom do RGM corporativo. Quando o gestor escreve,
 * o texto dele sempre prevalece.
 */

import {
  calcularAlertas,
  contarContratos,
  contarDocumentos,
  despesaTotal,
  inadimplenciaDoMes,
  inadimplenciaRecebida,
  inadimplenciaTotal,
  percentualOSCanceladas,
  percentualOSNoPrazo,
  receitaTotal,
  resultadoFinanceiro,
  saldoTotal,
  situacaoContrato,
  situacaoDocumento,
  taxaInadimplenciaMes,
  totalOS,
  variacao,
} from "./metrics";
import { formatarCompetenciaCurta, formatarData, formatarMoedaMil, formatarNumero, formatarVariacao } from "./format";
import type { DadosRelatorio } from "./types";

export interface Topico {
  destaque: string;
  texto: string;
}

/** Texto livre do gestor → tópicos. "Destaque: texto" vira negrito + texto. */
export const comentarioParaTopicos = (comentario: string): Topico[] =>
  comentario
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean)
    .map((linha) => {
      const i = linha.indexOf(":");
      return i > 0 && i < 70
        ? { destaque: `${linha.slice(0, i + 1)}`, texto: linha.slice(i + 1).trim() }
        : { destaque: "", texto: linha };
    });

/** Comentário do gestor, ou a leitura automática quando ele está vazio. */
export const leituraOuAutomatica = (comentario: string, automatica: () => Topico[]) =>
  comentario.trim() ? { topicos: comentarioParaTopicos(comentario), automatica: false } : { topicos: automatica(), automatica: true };

/* -------------------------------------------------------------------------- */

export const leituraFinanceiro = (d: DadosRelatorio, anterior?: { competencia: string; dados: DadosRelatorio }): Topico[] => {
  const t: Topico[] = [];
  const receita = receitaTotal(d);
  const despesa = despesaTotal(d);
  if (!receita && !despesa) return t;

  const resultado = resultadoFinanceiro(d);
  if (anterior && (receitaTotal(anterior.dados) || despesaTotal(anterior.dados))) {
    const resAnt = resultadoFinanceiro(anterior.dados);
    const melhora = resultado - resAnt;
    t.push({
      destaque: `Resultado de ${formatarMoedaMil(resultado)}:`,
      texto: `${melhora >= 0 ? "melhora" : "piora"} de ${formatarMoedaMil(Math.abs(melhora))} frente a ${formatarCompetenciaCurta(anterior.competencia)} (${formatarMoedaMil(resAnt)}).`,
    });
  } else {
    t.push({
      destaque: `Resultado de ${formatarMoedaMil(resultado)}:`,
      texto: `${formatarMoedaMil(receita)} de créditos contra ${formatarMoedaMil(despesa)} de débitos.`,
    });
  }

  const saldo = saldoTotal(d);
  if (anterior) {
    const saldoAnt = saldoTotal(anterior.dados);
    const v = variacao(saldo, saldoAnt);
    if (v !== null && Math.abs(v) >= 1) {
      t.push({
        destaque: `Saldo consolidado ${v < 0 ? "recua" : "sobe"} ${formatarNumero(Math.abs(v), 1)}%:`,
        texto: `de ${formatarMoedaMil(saldoAnt)} para ${formatarMoedaMil(saldo)}.`,
      });
    }
  } else if (saldo) {
    t.push({ destaque: "Saldo consolidado:", texto: `${formatarMoedaMil(saldo)} ao fim do mês.` });
  }

  const maiorDesvio = d.financeiro.grupos
    .map((g) => ({ g, dv: variacao(g.realizado, g.orcado) }))
    .filter((x) => x.dv !== null && x.dv > 5)
    .sort((a, b) => b.g.realizado - b.g.orcado - (a.g.realizado - a.g.orcado))[0];
  if (maiorDesvio) {
    t.push({
      destaque: `${maiorDesvio.g.grupo} ${formatarNumero(maiorDesvio.dv!, 1)}% acima do orçado:`,
      texto: maiorDesvio.g.observacao || "justificativa em análise com o fornecedor.",
    });
  }
  return t;
};

export const leituraInadimplencia = (d: DadosRelatorio): Topico[] => {
  const t: Topico[] = [];
  const total = inadimplenciaTotal(d);
  const anterior = d.juridico.inadimplencia.rubricas.reduce((s, r) => s + r.ateAnterior, 0);
  const recebido = inadimplenciaRecebida(d);
  if (anterior > 0) {
    const v = variacao(total, anterior);
    t.push({
      destaque:
        v !== null && v < 0
          ? `Inadimplência caiu ${formatarNumero(Math.abs(v), 0)}%:`
          : `Inadimplência ${v !== null && v > 0 ? "subiu" : "estável"}:`,
      texto: `de ${formatarMoedaMil(anterior)} para ${formatarMoedaMil(total)}, com ${formatarMoedaMil(recebido)} recuperados no mês.`,
    });
  } else if (total > 0) {
    t.push({ destaque: `${formatarMoedaMil(total)} em aberto`, texto: "ao fim do mês." });
  }
  const taxa = taxaInadimplenciaMes(d);
  if (taxa !== null) {
    t.push({
      destaque: `Taxa do mês de ${formatarNumero(taxa, 1)}%:`,
      texto: `${formatarMoedaMil(d.financeiro.arrecadacao.emitido - d.financeiro.arrecadacao.recebido)} em aberto sobre ${formatarMoedaMil(d.financeiro.arrecadacao.emitido)} emitidos.`,
    });
  } else if (inadimplenciaDoMes(d) > 0) {
    t.push({ destaque: `Novo atraso de ${formatarMoedaMil(inadimplenciaDoMes(d))}`, texto: "vencido no mês." });
  }
  const ativos = d.juridico.acordos.filter((a) => a.parcelasPagas < a.parcelas);
  if (ativos.length) {
    t.push({
      destaque: `${ativos.length} acordo(s) em curso:`,
      texto: "manter a régua de cobrança até a quitação.",
    });
  }
  return t;
};

export const leituraOS = (d: DadosRelatorio): Topico[] => {
  const t: Topico[] = [];
  if (!totalOS(d)) return t;
  const s = d.operacao.situacaoOS;
  const noPrazo = percentualOSNoPrazo(d);
  if (noPrazo !== null) {
    t.push({
      destaque: `${formatarNumero(noPrazo, 1)}% no prazo:`,
      texto: `${formatarNumero(s.concluidasNoPrazo)} de ${formatarNumero(s.concluidasNoPrazo + s.concluidasComAtraso)} OS concluídas dentro do prazo.`,
    });
  }
  if (s.abertasAtrasadas > 0) {
    t.push({ destaque: `${formatarNumero(s.abertasAtrasadas)} OS abertas em atraso:`, texto: "priorizar no plano da semana." });
  }
  const canc = percentualOSCanceladas(d);
  if (canc !== null && canc >= 10) {
    t.push({
      destaque: `${formatarNumero(canc, 1)}% de cancelamentos:`,
      texto: "revisar a programação e exigir justificativa no sistema.",
    });
  }
  return t;
};

export const leituraDocumentos = (d: DadosRelatorio, hoje = new Date()): Topico[] => {
  const t: Topico[] = [];
  const vencidos = d.documentos.linhas.filter((l) => situacaoDocumento(l, hoje).rotulo === "Vencido");
  const aVencer = d.documentos.linhas
    .map((l) => ({ l, s: situacaoDocumento(l, hoje) }))
    .filter((x) => x.s.rotulo === "A vencer")
    .sort((a, b) => (a.s.diasRestantes ?? 0) - (b.s.diasRestantes ?? 0));
  if (vencidos.length) {
    t.push({ destaque: `${vencidos.length} vencido(s):`, texto: vencidos.slice(0, 3).map((v) => v.documento).join("; ") + "." });
  }
  if (aVencer.length) {
    const p = aVencer[0];
    t.push({
      destaque: `Próximo vencimento:`,
      texto: `${p.l.documento} em ${formatarData(p.l.validade)} (${p.s.diasRestantes} dias).`,
    });
  }
  const c = contarDocumentos(d, hoje);
  if (c.percentualEmDia !== null) {
    t.push({ destaque: `${formatarNumero(c.percentualEmDia, 0)}% em dia`, texto: `de ${c.total} documentos cadastrados.` });
  }
  return t;
};

export const leituraContratos = (d: DadosRelatorio, hoje = new Date()): Topico[] => {
  const t: Topico[] = [];
  const c = contarContratos(d, hoje);
  if (c.vencidos) t.push({ destaque: `${c.vencidos} contrato(s) vencido(s):`, texto: "atualizar a vigência no sistema ou renovar." });
  const renovar = d.contratos.linhas.filter((l) => situacaoContrato(l, hoje).situacao === "em_renovacao");
  if (renovar.length) {
    t.push({ destaque: `Renovação em até 120 dias:`, texto: renovar.slice(0, 4).map((r) => r.fornecedor).join(", ") + "." });
  }
  return t;
};

/**
 * "Outubro/2026 em uma leitura" — o parágrafo que abre o painel executivo.
 * Usa a avaliação do gestor quando existe.
 */
export const resumoDoMes = (
  d: DadosRelatorio,
  anterior: { competencia: string; dados: DadosRelatorio } | undefined,
  hoje = new Date(),
): string => {
  if (d.sumario.avaliacaoGeral.trim()) return d.sumario.avaliacaoGeral.trim();

  const partes: string[] = [];
  const receita = receitaTotal(d);
  const despesa = despesaTotal(d);
  if (receita || despesa) {
    const resultado = resultadoFinanceiro(d);
    let frase = `${resultado >= 0 ? "Superávit" : "Déficit"} de ${formatarMoedaMil(Math.abs(resultado))} no mês`;
    if (anterior && (receitaTotal(anterior.dados) || despesaTotal(anterior.dados))) {
      const resAnt = resultadoFinanceiro(anterior.dados);
      frase += resultado > resAnt ? `, melhor que ${formatarCompetenciaCurta(anterior.competencia)}` : `, abaixo de ${formatarCompetenciaCurta(anterior.competencia)}`;
    }
    partes.push(`${frase}.`);
  }

  const prioridades = calcularAlertas(d, hoje)
    .filter((a) => a.severidade === "vermelho")
    .slice(0, 3)
    .map((a) => a.titulo.charAt(0).toLowerCase() + a.titulo.slice(1));
  if (prioridades.length) partes.push(`Prioridades: ${prioridades.join("; ")}.`);
  else if (partes.length) partes.push("Sem pontos críticos abertos nesta competência.");

  return partes.join(" ");
};
