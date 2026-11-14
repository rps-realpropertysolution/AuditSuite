/**
 * De onde veio cada dado — TEMPORÁRIO, para conferência visual no editor:
 * azul = LiveFacilities (API), amarelo = arquivos que o gestor importou.
 *
 * Marcamos pela diferença antes/depois de cada importação: linha de tabela
 * nova ou alterada (pelo id) e blocos de campos soltos (arrecadação, OS…).
 */

import type { DadosRelatorio } from "./types";

export type OrigemDado = "lf" | "arquivo";

export interface MapaOrigem {
  linhas: Record<string, OrigemDado>;
  blocos: Record<string, OrigemDado>;
}

const LISTAS: ((d: DadosRelatorio) => { id: string }[])[] = [
  (d) => d.financeiro.fundos,
  (d) => d.financeiro.grupos,
  (d) => d.contratos.linhas,
  (d) => d.documentos.linhas,
  (d) => d.juridico.inadimplencia.rubricas,
  (d) => d.juridico.acordos,
  (d) => d.juridico.certidoes,
  (d) => d.operacao.disciplinas,
  (d) => d.utilidades.linhas,
  (d) => d.suprimentos.pedidos,
];

/** Blocos de campos soltos que a importação preenche. */
export const BLOCOS: Record<string, (d: DadosRelatorio) => unknown> = {
  "financeiro.arrecadacao": (d) => d.financeiro.arrecadacao,
  "operacao.situacaoOS": (d) => d.operacao.situacaoOS,
  "operacao.resumo": (d) => d.operacao.resumo,
  "operacao.ocupacao": (d) => d.operacao.ocupacao,
};

export const marcarOrigem = (antes: DadosRelatorio, depois: DadosRelatorio, origem: OrigemDado): DadosRelatorio => {
  const mapa: MapaOrigem = {
    linhas: { ...(depois.origemDados?.linhas ?? antes.origemDados?.linhas ?? {}) },
    blocos: { ...(depois.origemDados?.blocos ?? antes.origemDados?.blocos ?? {}) },
  };
  for (const lista of LISTAS) {
    const anteriores = new Map(lista(antes).map((l) => [l.id, JSON.stringify(l)]));
    for (const l of lista(depois)) {
      if (anteriores.get(l.id) !== JSON.stringify(l)) mapa.linhas[l.id] = origem;
    }
  }
  for (const [chave, ler] of Object.entries(BLOCOS)) {
    if (JSON.stringify(ler(antes)) !== JSON.stringify(ler(depois))) mapa.blocos[chave] = origem;
  }
  return { ...depois, origemDados: mapa };
};

export const COR_ORIGEM: Record<OrigemDado, { linha: string; bloco: string; rotulo: string }> = {
  lf: { linha: "bg-sky-100/80", bloco: "rounded-lg bg-sky-100/70 ring-2 ring-sky-300 p-2", rotulo: "LiveFacilities (API)" },
  arquivo: { linha: "bg-amber-100/80", bloco: "rounded-lg bg-amber-100/70 ring-2 ring-amber-300 p-2", rotulo: "Arquivos do gestor" },
};
