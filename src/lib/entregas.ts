/**
 * Entrega do RGM — o relatório é obrigação contratual.
 *
 * A competência de referência é o mês FECHADO (em novembro se apresenta
 * outubro). O prazo de entrega é o dia PRAZO_DIA do mês seguinte à
 * competência. O painel usa isto para mostrar quem está atrasado.
 */

import { competenciaAnterior, competenciaDe } from "./format";
import type { Relatorio } from "./types";

/** Dia do mês seguinte em que o RGM deve estar publicado. Ajuste conforme o contrato. */
export const PRAZO_DIA = 10;

export type SituacaoEntrega = "publicado" | "em_elaboracao" | "nao_iniciado" | "atrasado";

/** Mês de referência padrão do painel: o último mês fechado. */
export const competenciaDeReferencia = (hoje = new Date()) =>
  competenciaAnterior(competenciaDe(hoje.getFullYear(), hoje.getMonth() + 1));

/** "2026-10-01" → "2026-11-10" */
export const prazoEntrega = (competencia: string) => {
  const [ano, mes] = competencia.split("-").map(Number);
  const proximoAno = mes === 12 ? ano + 1 : ano;
  const proximoMes = mes === 12 ? 1 : mes + 1;
  return `${proximoAno}-${String(proximoMes).padStart(2, "0")}-${String(PRAZO_DIA).padStart(2, "0")}`;
};

const isoDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const situacaoEntrega = (relatorio: Relatorio | null, competencia: string, hoje = new Date()): SituacaoEntrega => {
  if (relatorio?.status === "publicado") return "publicado";
  if (isoDia(hoje) > prazoEntrega(competencia)) return "atrasado";
  return relatorio ? "em_elaboracao" : "nao_iniciado";
};

/** Dias até o prazo (negativo = atrasado). */
export const diasParaPrazo = (competencia: string, hoje = new Date()) => {
  const [a, m, d] = prazoEntrega(competencia).split("-").map(Number);
  const alvo = Date.UTC(a, m - 1, d);
  const ref = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - ref) / 86_400_000);
};

/** Últimos N meses para o seletor, do mais recente ao mais antigo. */
export const ultimasCompetencias = (n = 12, hoje = new Date()) => {
  const lista: string[] = [];
  let c = competenciaDe(hoje.getFullYear(), hoje.getMonth() + 1);
  for (let i = 0; i < n; i++) {
    lista.push(c);
    c = competenciaAnterior(c);
  }
  return lista;
};
