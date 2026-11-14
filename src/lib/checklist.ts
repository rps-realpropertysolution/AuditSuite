/**
 * "Para fechar o RGM" — o que ainda falta no relatório do mês, na ordem em
 * que o gestor deve fazer. É o roteiro curto que substitui "preencher 14
 * seções": o sistema traz os números; aqui só aparece o que é do gestor, já
 * com uma sugestão de texto quando dá para escrever a partir dos dados.
 */

import { calcularAlertas, variacao } from "./metrics";
import { leituraFinanceiro, resumoDoMes } from "./leitura";
import type { DadosRelatorio, SecaoId } from "./types";

export type TipoPendencia = "importar_lf" | "importar_arquivos" | "texto" | "desvios" | "ocupacao" | "riscos" | "ir";

export interface Pendencia {
  id: string;
  titulo: string;
  explicacao: string;
  feito: boolean;
  tipo: TipoPendencia;
  /** Seção do editor onde o item mora (para o botão "ir"). */
  secao?: SecaoId;
  /** Campo de texto que o item preenche (tipo "texto"). */
  campo?: "avaliacaoGeral" | "conclusao" | "comentarioFinanceiro";
  /** Texto que o sistema propõe a partir dos números. */
  sugestao?: string;
}

const DESVIO_RELEVANTE = 10; // % acima do orçado que pede justificativa

export const desviosSemJustificativa = (d: DadosRelatorio) =>
  d.financeiro.grupos.filter((g) => {
    const dv = variacao(g.realizado, g.orcado);
    return g.orcado > 0 && dv !== null && dv > DESVIO_RELEVANTE && !g.observacao.trim();
  });

const juntarTopicos = (t: { destaque: string; texto: string }[]) => t.map((x) => `${x.destaque} ${x.texto}`.trim()).join("\n");

export const pendenciasDoMes = (d: DadosRelatorio, opcoes: { integrado: boolean; hoje?: Date }): Pendencia[] => {
  const hoje = opcoes.hoje ?? new Date();
  const titulos = new Set(d.arquivosImportados.map((a) => a.titulo));
  const lista: Pendencia[] = [];

  if (opcoes.integrado) {
    lista.push({
      id: "lf",
      titulo: "Puxar os números do LiveFacilities",
      explicacao: "Financeiro, inadimplência, OS, contratos e documentos em um clique.",
      feito: Boolean(d.importacao),
      tipo: "importar_lf",
    });
  }
  lista.push({
    id: "arquivos",
    titulo: "Importar os relatórios do sistema",
    explicacao: "Previsto x Realizado e Posição Financeira (orçado e saldo por fundo), contas de água e luz, pedidos de compra.",
    feito: titulos.has("Previsto x Realizado") && titulos.has("Posição Financeira"),
    tipo: "importar_arquivos",
  });

  const sugestaoResumo = (() => {
    const copia = { ...d, sumario: { ...d.sumario, avaliacaoGeral: "" } };
    return resumoDoMes(copia, undefined, hoje);
  })();
  lista.push({
    id: "leitura",
    titulo: "Escrever a leitura do mês",
    explicacao: "Duas ou três frases para o proprietário: como foi o mês e o que importa.",
    feito: d.sumario.avaliacaoGeral.trim().length >= 40,
    tipo: "texto",
    campo: "avaliacaoGeral",
    sugestao: sugestaoResumo || undefined,
  });

  const desvios = desviosSemJustificativa(d);
  lista.push({
    id: "desvios",
    titulo: desvios.length ? `Justificar ${desvios.length} desvio(s) do orçamento` : "Justificar desvios do orçamento",
    explicacao: `Grupos mais de ${DESVIO_RELEVANTE}% acima do orçado precisam de uma linha de explicação.`,
    feito: desvios.length === 0,
    tipo: "desvios",
    secao: "financeiro",
  });

  lista.push({
    id: "comentario-financeiro",
    titulo: "Comentar o financeiro",
    explicacao: "O que explica o resultado e o saldo do mês.",
    feito: d.financeiro.comentario.trim().length >= 20,
    tipo: "texto",
    campo: "comentarioFinanceiro",
    sugestao: juntarTopicos(leituraFinanceiro(d)) || undefined,
  });

  lista.push({
    id: "ocupacao",
    titulo: "Informar a ocupação",
    explicacao: "Percentual da área ocupada no fim do mês.",
    feito: d.operacao.ocupacao > 0,
    tipo: "ocupacao",
    secao: "operacao",
  });

  lista.push({
    id: "fotos",
    titulo: "Escolher as fotos do mês",
    explicacao: "De 3 a 6 fotos — dá para tirar da Prestação de Contas Operacional do sistema.",
    feito: d.fotos.length >= 3,
    tipo: "ir",
    secao: "fotos",
  });

  const alertas = calcularAlertas(d, hoje).filter((a) => a.severidade !== "verde");
  lista.push({
    id: "riscos",
    titulo: "Montar o plano de ação",
    explicacao: alertas.length
      ? `O sistema encontrou ${alertas.length} ponto(s) de atenção — vire-os em ações com um clique.`
      : "Riscos e ações em andamento no prédio.",
    feito: d.riscos.linhas.length > 0,
    tipo: "riscos",
    secao: "riscos",
  });

  lista.push({
    id: "decisoes",
    titulo: "Registrar as decisões do proprietário",
    explicacao: "O que você precisa que o cliente aprove neste mês (pode ser nenhuma).",
    feito: d.proximosPassos.linhas.length > 0,
    tipo: "ir",
    secao: "proximosPassos",
  });

  lista.push({
    id: "conclusao",
    titulo: "Fechar com a conclusão",
    explicacao: "Uma mensagem final ao proprietário — vira a tela de encerramento.",
    feito: d.conclusao.trim().length >= 40,
    tipo: "texto",
    campo: "conclusao",
    sugestao: sugestaoResumo
      ? `${sugestaoResumo}${d.proximosPassos.linhas.some((p) => p.dependeDoCliente) ? " Contamos com a sua deliberação sobre as decisões apresentadas." : ""}`
      : undefined,
  });

  return lista;
};
