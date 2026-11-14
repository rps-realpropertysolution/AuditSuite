/**
 * Contas de água e energia direto do LiveFacilities — sem o gestor exportar PDF.
 *
 * Caminho (só leitura, autenticado):
 *   POST /ContasPagar/ConsultaPagamento  → pagamentos do período, cada um com
 *        listaContasPagarArquivo[].nm_pagamentoarquivo = /api/ContasPagar/arquivo?token=…
 *   GET  /ContasPagar/arquivo            → o anexo (fatura digitalizada, comprovante…)
 *
 * Quem lê o PDF é o mesmo leitor do "Importar arquivos" (no navegador ou no
 * script): aqui só se escolhe e baixa. O anexo é reconhecido pelo CONTEÚDO —
 * a descrição do Live nem sempre diz a verdade ("BOLETO" que é a fatura,
 * comprovante de banco, conta escaneada sem texto).
 *
 * Custo: no mercado livre a conta da distribuidora é só o "fio". O custo do
 * mês é a soma dos pagamentos da conta contábil (energia: 649 + 495
 * nos prédios vistos; água: 642, só concessionária) que VENCEM no mês seguinte ao
 * consumo (a conta de outubro vence em novembro).
 */

import type { ClienteLF } from "./cliente.ts";
import { chaveNome } from "./mapear.ts";

/** Distribuidoras/concessionárias cuja fatura vale baixar (consumo em kWh / m³). */
const CONCESSIONARIAS =
  /enel|eletropaulo|light s|cemig dist|copel|celesc|cpfl|elektro|energisa|equatorial|neoenergia|coelba|celpe|cosern|edp|sabesp|saneamento|sanepar|copasa|cedae|embasa|corsan|caesb|compesa|cagece|aguas de|águas de/i;
// testadas sobre o nome normalizado (sem acento): "642 - ÁGUA" → "642 agua"
const CONTA_ENERGIA = /energia el/;
const CONTA_AGUA = /(^|\s)agua(\s|$)/;
const normal = (s?: string) => chaveNome(s ?? "");

const MAX_ANEXOS = 8;

export interface PagamentoLF {
  nm_fornecedor?: string;
  cd_contacontabil?: string;
  vl_liquido?: number;
  dt_vencimento?: string;
  ds_competencia?: string;
  nm_pagamentoparcelastatus?: string;
  listaContasPagarArquivo?: { nm_pagamentoarquivo?: string; ds_pagamentoarquivo?: string }[] | null;
}

export interface CustoConcessionaria {
  total: number;
  itens: { fornecedor: string; valor: number; vencimento: string }[];
}

export interface FaturasDoMes {
  /** Anexos baixados (base64) — o leitor decide qual é fatura. */
  anexos: { nome: string; fornecedor: string; valorPago: number; vencimento: string; base64: string }[];
  custos: { energia: CustoConcessionaria | null; agua: CustoConcessionaria | null };
  avisos: string[];
}

const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const iso = (ano: number, mes: number, dia: number) => `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
const seguinte = (ano: number, mes: number) => (mes === 12 ? [ano + 1, 1] : [ano, mes + 1]);

const paraBase64 = (bytes: Uint8Array) => {
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
};

/**
 * Pagamentos do consumo de `competencia` (YYYY-MM-01): os que VENCEM no mês
 * seguinte. O `ds_competencia` do Live não serve — cada prédio lança de um
 * jeito (P500: mês do pagamento; CJB: mês do consumo).
 */
export const pagamentosDoConsumo = (pagamentos: PagamentoLF[], competencia: string) => {
  const [ano, mes] = competencia.split("-").map(Number);
  const [a2, m2] = seguinte(ano, mes);
  const prefixo = `${a2}-${String(m2).padStart(2, "0")}`;
  return pagamentos.filter((p) => !/cancel|estorn/i.test(p.nm_pagamentoparcelastatus ?? "") && (p.dt_vencimento ?? "").startsWith(prefixo));
};

export const somarCusto = (pagamentos: PagamentoLF[], conta: RegExp, soConcessionaria = false): CustoConcessionaria | null => {
  const itens = pagamentos
    .filter((p) => conta.test(normal(p.cd_contacontabil)) && (p.vl_liquido ?? 0) > 0)
    .filter((p) => !soConcessionaria || CONCESSIONARIAS.test(p.nm_fornecedor ?? ""))
    .map((p) => ({ fornecedor: (p.nm_fornecedor ?? "").trim(), valor: p.vl_liquido ?? 0, vencimento: (p.dt_vencimento ?? "").slice(0, 10) }));
  if (!itens.length) return null;
  return { total: Math.round(itens.reduce((s, i) => s + i.valor, 0) * 100) / 100, itens };
};

export const buscarFaturas = async (cliente: ClienteLF, cdCondominio: string, competencia: string): Promise<FaturasDoMes> => {
  const [ano, mes] = competencia.split("-").map(Number);
  const [a2, m2] = seguinte(ano, mes);
  const avisos: string[] = [];

  // do 1º dia do mês do consumo ao último do mês seguinte: a conta de outubro vence em out ou nov
  const r = await cliente.consultar<{ listaContasPagar?: PagamentoLF[]; ds_mensagemErro?: string }>("/ContasPagar/ConsultaPagamento", {
    cd_condominio: cdCondominio,
    dt_vencimentoinicio: iso(ano, mes, 1),
    dt_vencimentofim: iso(a2, m2, ultimoDia(a2, m2)),
    PageIndex: 0,
    PageSize: 500,
    // sem isto a lista de anexos volta vazia (confirmado contra a API real)
    sn_retornarimagem: true,
  });
  const todos = r.listaContasPagar ?? [];
  const doConsumo = pagamentosDoConsumo(todos, competencia);

  const custos = { energia: somarCusto(doConsumo, CONTA_ENERGIA), agua: somarCusto(doConsumo, CONTA_AGUA, true) };

  // faturas: pagamentos de concessionária na conta de energia ou água, no período inteiro
  const candidatos = todos.filter(
    (p) => CONCESSIONARIAS.test(p.nm_fornecedor ?? "") && (CONTA_ENERGIA.test(normal(p.cd_contacontabil)) || CONTA_AGUA.test(normal(p.cd_contacontabil))),
  );
  const anexos: FaturasDoMes["anexos"] = [];
  for (const p of candidatos) {
    for (const a of p.listaContasPagarArquivo ?? []) {
      if (anexos.length >= MAX_ANEXOS) break;
      if (!a.nm_pagamentoarquivo || /comprovante/i.test(a.ds_pagamentoarquivo ?? "")) continue;
      try {
        const { bytes } = await cliente.baixar(a.nm_pagamentoarquivo);
        if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") continue; // só PDF
        const nome = (a.ds_pagamentoarquivo ?? "").match(/\[([^\]]+\.pdf)\]/i)?.[1] ?? `fatura-${anexos.length + 1}.pdf`;
        anexos.push({
          nome,
          fornecedor: (p.nm_fornecedor ?? "").trim(),
          valorPago: p.vl_liquido ?? 0,
          vencimento: (p.dt_vencimento ?? "").slice(0, 10),
          base64: paraBase64(bytes),
        });
      } catch (e) {
        avisos.push(`Anexo de ${(p.nm_fornecedor ?? "").trim()} não baixou: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  if (!candidatos.length) avisos.push("Nenhum pagamento de concessionária de água ou energia no período.");
  return { anexos, custos, avisos };
};
