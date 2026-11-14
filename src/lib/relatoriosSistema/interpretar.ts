/**
 * Reconhece e interpreta os relatórios exportados do LiveFacilities.
 *
 * Tudo aqui é puro (texto → dados): roda igual no navegador e no Node, e é
 * testado com linhas de exemplo. A leitura do arquivo em si (pdf.js, Excel)
 * fica em `ler.ts` (navegador) e `scripts/rgm/lerArquivoNode.ts` (Node).
 *
 * Excel é sempre preferível: as colunas já vêm separadas. Do PDF usamos as
 * linhas remontadas por `linhasDoPdf` — rótulo à esquerda, valores à direita.
 */

import { capitalizar, chaveNome } from "../../../supabase/functions/_shared/livefacilities/mapear.ts";
import type {
  ArquivoLido,
  BoletosPagos,
  FaturaConcessionaria,
  PedidoCompra,
  PedidosCompra,
  PosicaoFinanceira,
  PrevistoRealizado,
  RelatorioSistema,
  ResultadoLeitura,
} from "./tipos";

/* -------------------------------------------------------------------------- */
/* Utilitários                                                                 */
/* -------------------------------------------------------------------------- */

const NUMERO_BR = /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/;

/** "1.234,56" → 1234.56 · "327701,11" → 327701.11 · "-763,05" → -763.05 */
export const numeroBR = (s: string): number | null => {
  const t = s.trim().replace(/^R\$\s*/, "");
  if (!NUMERO_BR.test(t)) return null;
  return Number(t.replace(/\./g, "").replace(",", "."));
};

const arred = (n: number) => Math.round(n * 100) / 100;

/** Separa os valores numéricos do fim da linha: "ELEVADORES 10.884,08 11.923,84 …" */
export const rotuloEValores = (linha: string): { rotulo: string; valores: number[] } => {
  const partes = linha.split(" ");
  const valores: number[] = [];
  while (partes.length) {
    const v = numeroBR(partes[partes.length - 1]);
    if (v === null) break;
    valores.unshift(v);
    partes.pop();
  }
  return { rotulo: partes.join(" ").trim(), valores };
};

/** dd/mm/aaaa → aaaa-mm-dd (vazio se inválida) */
export const dataISO = (s: unknown): string => {
  if (s instanceof Date && !Number.isNaN(s.getTime())) return s.toISOString().slice(0, 10);
  const m = String(s ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

/** "1003 - P500" → "1003" */
const codigoCondominio = (texto: string): string | null => texto.match(/\b(\d{4})\s*-\s*\S/)?.[1] ?? null;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Mês mais frequente entre as datas (aaaa-mm-dd) → aaaa-mm */
const mesPredominante = (datas: string[]): string | null => {
  const contagem = new Map<string, number>();
  for (const d of datas) if (d) contagem.set(d.slice(0, 7), (contagem.get(d.slice(0, 7)) ?? 0) + 1);
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const numero = (v: unknown) => (typeof v === "number" ? v : numeroBR(texto(v)) ?? 0);

/* -------------------------------------------------------------------------- */
/* PDF: Previsto x Realizado                                                   */
/* -------------------------------------------------------------------------- */

const CABECALHOS_IGNORADOS = /^(\d{2}\/\d{4}|previsto|periodo|processado|relatorio de previsto)/;

export const interpretarPrevistoRealizado = (linhas: string[]): PrevistoRealizado => {
  const tudo = linhas.join("\n");
  const periodo = tudo.match(/PER[IÍ]ODO\s+(\d{2})\/(\d{4})/i);
  if (!periodo) throw new Error("período (MM/AAAA) não encontrado no Previsto x Realizado");

  const resultado: PrevistoRealizado = {
    tipo: "previsto_realizado",
    cdCondominio: codigoCondominio(tudo),
    competencia: `${periodo[2]}-${periodo[1]}`,
    receitas: [],
    receitasPorFundo: [],
    despesas: [],
    despesasPorFundo: [],
    total: null,
  };

  let secao: "inicio" | "receita" | "despesa" | "total" = "inicio";
  let fundo = "";
  const fundos = new Set<string>();
  let ultimaDespesa: PrevistoRealizado["despesas"][number] | null = null;
  let rotuloBruto = "";

  for (const linha of linhas) {
    const chave = chaveNome(linha);
    if (/^receita previsto/.test(chave)) {
      secao = "receita";
      continue;
    }
    if (/^despesas? previsto/.test(chave)) {
      secao = "despesa";
      fundo = "";
      continue;
    }
    if (/^total receita x despesa/.test(chave)) {
      secao = "total";
      continue;
    }

    const { rotulo, valores } = rotuloEValores(linha);
    const chaveRotulo = chaveNome(rotulo);

    if (secao === "total") {
      // "10/2026 327701,11 441708,10 -114006,99" — o período vira rótulo
      const m = linha.match(/^\d{2}\/\d{4}\s+(\S+)\s+(\S+)/);
      if (m) resultado.total = { receita: numeroBR(m[1]) ?? 0, despesa: numeroBR(m[2]) ?? 0 };
      continue;
    }
    if (secao === "inicio" || CABECALHOS_IGNORADOS.test(chaveRotulo)) continue;

    if (secao === "receita") {
      if (valores.length < 2) continue;
      const conta = rotulo.match(/^\d+\s*-\s*(.+)$/);
      if (conta) {
        resultado.receitas.push({ fundo, conta: capitalizar(conta[1]), previsto: valores[0], realizado: valores[1] });
      } else {
        fundo = capitalizar(rotulo);
        fundos.add(chaveNome(fundo));
        resultado.receitasPorFundo.push({ fundo, previsto: valores[0], realizado: valores[1] });
      }
      continue;
    }

    // despesas
    if (!valores.length) {
      // rótulo que quebrou em duas linhas: "SEGURANÇA PATRIMONIAL E COMBATE A" / "INCÊNDIO"
      if (ultimaDespesa && rotulo && rotulo === rotulo.toUpperCase()) {
        rotuloBruto = `${rotuloBruto} ${rotulo}`;
        ultimaDespesa.grupo = capitalizar(rotuloBruto);
      }
      continue;
    }
    if (chaveRotulo === "cmmq") {
      ultimaDespesa = null;
      continue;
    }
    if (valores.length < 2) continue;
    // cabeçalho de fundo: os da receita, ou qualquer "FUNDO …" que só tenha despesa
    if (fundos.has(chaveRotulo) || /^fundo /.test(chaveRotulo) || !fundo) {
      fundo = capitalizar(rotulo);
      resultado.despesasPorFundo.push({ fundo, previsto: valores[0], realizado: valores[1] });
      ultimaDespesa = null;
      continue;
    }
    rotuloBruto = rotulo;
    ultimaDespesa = { fundo, grupo: capitalizar(rotulo), previsto: valores[0], realizado: valores[1] };
    resultado.despesas.push(ultimaDespesa);
  }

  if (!resultado.despesas.length && !resultado.receitas.length) {
    throw new Error("nenhuma linha de receita ou despesa reconhecida no Previsto x Realizado");
  }
  return resultado;
};

/* -------------------------------------------------------------------------- */
/* PDF: Posição financeira                                                     */
/* -------------------------------------------------------------------------- */

export const interpretarPosicaoFinanceira = (linhas: string[]): PosicaoFinanceira => {
  const tudo = linhas.join("\n");
  const periodo = tudo.match(/PER[IÍ]ODO:?\s*\d{2}\/(\d{2})\/(\d{4})\s*A\s*\d{2}\/(\d{2})\/(\d{4})/i);
  if (!periodo) throw new Error("período não encontrado na Posição Financeira");
  if (periodo[1] !== periodo[3] || periodo[2] !== periodo[4]) {
    throw new Error("a Posição Financeira precisa ser de um único mês (ex.: 01/10/2026 a 31/10/2026)");
  }

  const resultado: PosicaoFinanceira = {
    tipo: "posicao_financeira",
    cdCondominio: codigoCondominio(tudo),
    competencia: `${periodo[2]}-${periodo[1]}`,
    fundos: [],
    total: null,
  };

  for (const linha of linhas) {
    const { rotulo, valores } = rotuloEValores(linha);
    if (valores.length !== 4 || !rotulo) continue;
    const [anterior, creditos, debitos, atual] = valores;
    if (chaveNome(rotulo) === "total") {
      resultado.total = { anterior, creditos, debitos, atual };
      continue;
    }
    resultado.fundos.push({ fundo: capitalizar(rotulo), anterior, creditos, debitos, atual });
  }

  if (!resultado.fundos.length) throw new Error("nenhum fundo reconhecido na Posição Financeira");
  for (const f of resultado.fundos) {
    if (Math.abs(f.anterior + f.creditos - f.debitos - f.atual) > 0.05) {
      throw new Error(`o saldo do fundo "${f.fundo}" não fecha (anterior + crédito − débito ≠ atual)`);
    }
  }
  return resultado;
};

/* -------------------------------------------------------------------------- */
/* PDF: contas de concessionária                                               */
/* -------------------------------------------------------------------------- */

const somarLinha = (linhas: string[], padrao: RegExp) => {
  const linha = linhas.find((l) => padrao.test(l));
  if (!linha) return 0;
  const m = linha.match(padrao);
  return m?.[1] ? numeroBR(m[1]) ?? 0 : 0;
};

export const interpretarFaturaSabesp = (linhas: string[]): FaturaConcessionaria => {
  const leitura = linhas
    .map((l) => l.match(/(\d{2}\/\d{2}\/\d{2})\s+(\d+)\s+(\d{2}\/\d{2}\/\d{2})\s+(\d+)\s+(\d+)\s+(\d+)/))
    .find(Boolean);
  if (!leitura) throw new Error("leituras do hidrômetro não encontradas na conta da Sabesp");
  const [, dataAnterior, , dataAtual, , consumoTxt, diasTxt] = leitura;
  const consumo = Number(consumoTxt);
  const [, mesAtual, anoAtual] = dataAtual.split("/");

  const agua = somarLinha(linhas, /(?:^|\s)Água:\s*([\d.]+,\d{2})\s*$/i);
  const esgoto = somarLinha(linhas, /(?:^|\s)Esgoto:\s*([\d.]+,\d{2})\s*$/i);
  const taxa = somarLinha(linhas, /Taxa de regula\S+.*?([\d.]+,\d{2})\s*$/i);
  const valor = arred(agua + esgoto + taxa);

  // Histórico: datas de emissão e consumos "339(MA)" na mesma ordem.
  const inicioHist = linhas.findIndex((l) => /Hist[oó]rico de Consumo/i.test(l));
  const fimHist = linhas.findIndex((l, i) => i > inicioHist && /^AVISOS/i.test(l));
  let consumoAnterior: number | null = null;
  if (inicioHist >= 0) {
    const bloco = linhas.slice(inicioHist + 1, fimHist > 0 ? fimHist : inicioHist + 8).join(" ");
    const valores = [...bloco.matchAll(/(\d+)\((?:[A-Z]{2,3})\)/g)].map((m) => Number(m[1]));
    if (valores.length) consumoAnterior = valores[valores.length - 1];
  }

  const cliente = linhas.find((l) => /^Cliente:/i.test(l))?.replace(/^Cliente:\s*/i, "") ?? "";
  return {
    tipo: "fatura_agua",
    concessionaria: "Sabesp",
    cliente,
    competencia: `20${anoAtual}-${mesAtual}`,
    unidade: "m³",
    consumo,
    consumoAnterior,
    ponta: 0,
    foraPonta: 0,
    valor,
    detalhamento: `Sabesp · leitura de ${dataAnterior} a ${dataAtual} (${diasTxt} dias)`,
  };
};

export const interpretarFaturaEnel = (linhas: string[]): FaturaConcessionaria => {
  const historico = linhas
    .map((l) => l.match(/^([A-Z]{3})\/(\d{2})\s+[\d.,]+\s+([\d.,]+)\s+([\d.,]+)\s+(\d+)$/))
    .filter((m): m is RegExpMatchArray => !!m && MESES.includes(m[1].toLowerCase()));
  if (!historico.length) throw new Error("histórico de consumo não encontrado na conta da Enel");

  const [atual, anterior] = historico;
  const mes = String(MESES.indexOf(atual[1].toLowerCase()) + 1).padStart(2, "0");
  const ponta = numeroBR(atual[3]) ?? 0;
  const foraPonta = numeroBR(atual[4]) ?? 0;
  const consumoAnterior = anterior ? arred((numeroBR(anterior[3]) ?? 0) + (numeroBR(anterior[4]) ?? 0)) : null;

  const valor =
    somarLinha(linhas, /^TOTAL\s+([\d.]+,\d{2})/) ||
    numeroBR(linhas.join(" ").match(/R\$\s?([\d.]+,\d{2})/)?.[1] ?? "") ||
    0;
  const leitura = linhas.join(" ").match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2})\s+\d{2}\/\d{2}\/\d{4}/);
  const cliente = linhas.find((l) => /^(EDIF|ED\.? |COND|CONJ|CENTRO|SHOPPING)/i.test(l)) ?? "";

  return {
    tipo: "fatura_energia",
    concessionaria: "Enel",
    cliente,
    competencia: `20${atual[2]}-${mes}`,
    unidade: "kWh",
    consumo: arred(ponta + foraPonta),
    consumoAnterior,
    ponta,
    foraPonta,
    valor,
    detalhamento: leitura
      ? `Enel · leitura de ${leitura[1]} a ${leitura[2]} (${leitura[3]} dias)`
      : "Enel",
  };
};

/**
 * Copel (DANF3E). Histórico de 12 meses: "10/2026 111.286,32 12/11/2026 [pagto] 23956 226643 …"
 * — mês, valor, vencimento, pagamento (opcional), consumo ponta, consumo fora ponta.
 */
export const interpretarFaturaCopel = (linhas: string[]): FaturaConcessionaria => {
  const historico = linhas
    .map((l) => l.match(/^(\d{2})\/(\d{4})\s+([\d.]+,\d{2})\s+\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}\/\d{2}\/\d{4})?\s+(\d+)\s+(\d+)\s/))
    .filter((m): m is RegExpMatchArray => Boolean(m));

  // consumo do mês também aparece nos itens de fatura (garante quando o histórico não vem)
  const itemPonta = linhas.join("\n").match(/CONSUMO PTA kWh\s+([\d.]+)/)?.[1];
  const itemFora = linhas.join("\n").match(/CONSUMO F PTA kWh\s+([\d.]+)/)?.[1];
  const referencia = linhas.join(" ").match(/(\d{2})\/(\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+R\$\s?([\d.]+,\d{2})/);
  if (!historico.length && !referencia) throw new Error("mês de referência não encontrado na conta da Copel");

  const [atual, anterior] = historico;
  const competencia = atual ? `${atual[2]}-${atual[1]}` : `${referencia![2]}-${referencia![1]}`;
  const ponta = atual ? Number(atual[4]) : Number((itemPonta ?? "0").replace(/\./g, ""));
  const foraPonta = atual ? Number(atual[5]) : Number((itemFora ?? "0").replace(/\./g, ""));
  const valor = (atual ? numeroBR(atual[3]) : numeroBR(referencia![3])) ?? 0;
  const leitura = linhas.join(" ").match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2})\s+\d{2}\/\d{2}\/\d{4}/);
  const cliente = linhas.find((l) => /^Nome:/i.test(l))?.replace(/^Nome:\s*/i, "").replace(/\s+\d{2}\/\d{2}\/\d{4}.*$/, "") ?? "";

  return {
    tipo: "fatura_energia",
    concessionaria: "Copel",
    cliente,
    competencia,
    unidade: "kWh",
    consumo: ponta + foraPonta,
    consumoAnterior: anterior ? Number(anterior[4]) + Number(anterior[5]) : null,
    ponta,
    foraPonta,
    valor,
    valorAnterior: anterior ? numeroBR(anterior[3]) : null,
    detalhamento: leitura ? `Copel · leitura de ${leitura[1]} a ${leitura[2]} (${leitura[3]} dias)` : "Copel",
  };
};

/**
 * Sanepar. Leitura do mês: "30 23/10/2026 59385 60913 1528 10/2026" (dias, data,
 * leitura anterior, atual, consumo, referência). Histórico: "11/25 … 09/26" / "1840 … 1542".
 */
export const interpretarFaturaSanepar = (linhas: string[]): FaturaConcessionaria => {
  const leitura = linhas.map((l) => l.match(/^(\d{1,2})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d{2})\/(\d{4})$/)).find(Boolean);
  if (!leitura) throw new Error("leitura do hidrômetro não encontrada na conta da Sanepar");
  const [, dias, data, , , consumo, mes, ano] = leitura;

  // histórico: a linha de meses "MM/AA …" e a de consumos logo abaixo
  const iMeses = linhas.findIndex((l) => /^(\d{2}\/\d{2}\s+){5,}\d{2}\/\d{2}$/.test(l));
  const consumos = iMeses >= 0 ? (linhas[iMeses + 1] ?? "").split(" ").map(Number).filter((n) => !Number.isNaN(n)) : [];

  // "24/11/2026 19.691,02 16.737,37 0,00 36.428,39" → água, esgoto, outros, total
  const totais = linhas.map((l) => l.match(/^\d{2}\/\d{2}\/\d{4}\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})$/)).find(Boolean);
  const valor = totais ? numeroBR(totais[4]) ?? 0 : numeroBR(linhas.join(" ").match(/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4}\s+([\d.]+,\d{2})/)?.[1] ?? "") ?? 0;
  const iConta = linhas.findIndex((l) => /^CONTA$/i.test(l));
  const cliente = iConta >= 0 ? (linhas[iConta + 1] ?? "").replace(/\s+[\d.]+$/, "") : "";

  return {
    tipo: "fatura_agua",
    concessionaria: "Sanepar",
    cliente,
    competencia: `${ano}-${mes}`,
    unidade: "m³",
    consumo: Number(consumo),
    consumoAnterior: consumos.length ? consumos[consumos.length - 1] : null,
    ponta: 0,
    foraPonta: 0,
    valor,
    detalhamento: `Sanepar · leitura em ${data} (${dias} dias)`,
  };
};

/* -------------------------------------------------------------------------- */
/* Excel: boletos pagos                                                        */
/* -------------------------------------------------------------------------- */

const indiceColuna = (cabecalho: unknown[], padrao: RegExp) => cabecalho.findIndex((c) => padrao.test(chaveNome(texto(c))));

export const interpretarBoletosPagos = (linhas: unknown[][]): BoletosPagos => {
  const iCab = linhas.findIndex((l) => chaveNome(texto(l[0])) === "pagamento");
  const cab = linhas[iCab] ?? [];
  const cRecibo = indiceColuna(cab, /^recibo$/);
  const cPago = indiceColuna(cab, /^vl pago$/);
  if (iCab < 0 || cRecibo < 0 || cPago < 0) throw new Error("colunas Pagamento / Recibo / Vl. Pago não encontradas");

  let quantidade = 0;
  let valor = 0;
  let outros = 0;
  let totalGeral = 0;
  const datas: string[] = [];
  for (const l of linhas.slice(iCab + 1)) {
    const primeira = texto(l[0]);
    if (/^total geral/i.test(primeira)) {
      totalGeral = numero(l[cPago]);
      continue;
    }
    // só linhas de pagamento: a 1ª coluna é a data pura ("Total do dia [01/10]" fica fora)
    if (!(l[0] instanceof Date) && !/^\d{2}\/\d{2}\/\d{4}$/.test(primeira)) continue;
    const data = dataISO(l[0]);
    datas.push(data);
    const pago = numero(l[cPago]);
    if (texto(l[cRecibo])) {
      quantidade++;
      valor += pago;
    } else {
      outros += pago;
    }
  }
  const competencia = mesPredominante(datas);
  if (!competencia) throw new Error("nenhum pagamento com data na planilha de boletos pagos");
  return {
    tipo: "boletos_pagos",
    competencia,
    boletos: { quantidade, valor: arred(valor) },
    outrosCreditos: arred(outros),
    totalGeral: arred(totalGeral || valor + outros),
  };
};

/* -------------------------------------------------------------------------- */
/* Excel: pedidos de compra                                                    */
/* -------------------------------------------------------------------------- */

/** "466. ORDINÁRIA -> 539. LIMPEZA E SANIFICAÇÃO -> 541. …" → "Limpeza e sanificação" */
const grupoDaConta = (conta: string) => {
  const niveis = conta.split("->").map((n) => n.replace(/^\s*\d+\.\s*/, "").trim());
  return capitalizar(niveis[1] ?? niveis[0] ?? "");
};

export const interpretarPedidosCompra = (linhas: unknown[][]): PedidosCompra => {
  const iCab = linhas.findIndex((l) => l.some((c) => chaveNome(texto(c)) === "pedido"));
  const cab = linhas[iCab] ?? [];
  const col = {
    emp: indiceColuna(cab, /^empreendimento$/),
    pedido: indiceColuna(cab, /^pedido$/),
    status: indiceColuna(cab, /^status$/),
    valor: indiceColuna(cab, /^vl aprovado$/),
    categoria: indiceColuna(cab, /^categoria$/),
    solicitacao: indiceColuna(cab, /^dt solicitacao$/),
    prazo: indiceColuna(cab, /^prazo estimado$/),
    conta: indiceColuna(cab, /^conta contabil$/),
  };
  if (iCab < 0 || col.pedido < 0 || col.status < 0) throw new Error("colunas Pedido / Status não encontradas");

  const pedidos: PedidoCompra[] = [];
  const codigos = new Set<string>();
  for (const l of linhas.slice(iCab + 1)) {
    const pedido = texto(l[col.pedido]);
    if (!pedido) continue;
    const cd = col.emp >= 0 ? codigoCondominio(texto(l[col.emp])) : null;
    if (cd) codigos.add(cd);
    pedidos.push({
      pedido,
      status: capitalizar(texto(l[col.status])),
      valor: col.valor >= 0 ? numero(l[col.valor]) : 0,
      categoria: col.categoria >= 0 ? capitalizar(texto(l[col.categoria])) : "",
      grupo: col.conta >= 0 ? grupoDaConta(texto(l[col.conta])) : "",
      solicitacao: col.solicitacao >= 0 ? dataISO(l[col.solicitacao]) : "",
      prazo: col.prazo >= 0 ? dataISO(l[col.prazo]) : "",
    });
  }
  if (codigos.size > 1) throw new Error(`a planilha tem pedidos de mais de um empreendimento (${[...codigos].join(", ")})`);
  return {
    tipo: "pedidos_compra",
    cdCondominio: [...codigos][0] ?? null,
    competencia: mesPredominante(pedidos.map((p) => p.solicitacao)),
    pedidos,
  };
};

/**
 * O Previsto x Realizado em ".xls" (HTML) vem na versão ANALÍTICA: abaixo de
 * cada grupo de despesa aparecem as contas ("498 - TELEFONE"). Reescrevemos as
 * linhas no formato do PDF sintético — período, seções e só os grupos — e o
 * mesmo intérprete do PDF faz o resto.
 */
export const linhasDoPrevistoEmPlanilha = (planilha: unknown[][]): string[] => {
  const linhas: string[] = [];
  let secao: "receita" | "despesa" | null = null;
  let periodo = "";
  for (const bruta of planilha) {
    const celulas = bruta.map((c) => texto(c));
    const primeira = chaveNome(celulas[0] ?? "");
    const mes = celulas.find((c) => /^\d{2}\/\d{4}$/.test(c));
    if (/^(receita|despesas?)$/.test(primeira)) {
      secao = primeira.startsWith("receita") ? "receita" : "despesa";
      if (mes && !periodo) {
        periodo = mes;
        linhas.unshift(`PERÍODO ${mes}`, "RELATÓRIO DE PREVISTO X REALIZADO");
      }
      linhas.push(`${secao === "receita" ? "RECEITA" : "DESPESAS"} PREVISTO REALIZADO DIFERENÇA %VARIAÇÃO`);
      continue;
    }
    if (!secao || /^previsto/.test(chaveNome(celulas.filter(Boolean)[0] ?? ""))) continue; // cabeçalho das colunas
    if (/^total receita/.test(primeira)) {
      linhas.push("TOTAL RECEITA X DESPESA");
      secao = null;
      continue;
    }
    // na despesa, a conta analítica ("498 - TELEFONE") já está somada no grupo
    if (secao === "despesa" && /^\d+\s*-\s/.test(celulas[0] ?? "")) continue;
    linhas.push(celulas.filter((c) => c !== "").join(" "));
  }
  if (!periodo) throw new Error("período (MM/AAAA) não encontrado na planilha do Previsto x Realizado");
  return linhas;
};

/* -------------------------------------------------------------------------- */
/* Reconhecimento                                                              */
/* -------------------------------------------------------------------------- */

const reconhecer = (arquivo: ArquivoLido): RelatorioSistema => {
  if (arquivo.tipo === "planilha") {
    const cabecalhos = arquivo.linhas.slice(0, 5).flat().map((c) => chaveNome(texto(c)));
    const tem = (...nomes: string[]) => nomes.every((n) => cabecalhos.includes(n));
    if (tem("pagamento", "recibo", "vl pago")) return interpretarBoletosPagos(arquivo.linhas);
    if (tem("pedido", "status", "vl aprovado")) return interpretarPedidosCompra(arquivo.linhas);
    if (tem("previsto", "realizado") && arquivo.linhas.some((l) => /^(receita|despesas?)$/.test(chaveNome(texto(l[0]))))) {
      return interpretarPrevistoRealizado(linhasDoPrevistoEmPlanilha(arquivo.linhas));
    }
    if (tem("os", "atividade", "prazo")) {
      return {
        tipo: "informativo",
        titulo: "Relatório operacional de OS",
        motivo: "As ordens de serviço já vêm direto do LiveFacilities no botão “Importar do LiveFacilities”. Este arquivo não é necessário.",
      };
    }
    throw new Error("planilha não reconhecida — use as exportações de Previsto x Realizado, Boletos Pagos ou Lista de Pedidos");
  }

  const linhas = arquivo.paginas.flat();
  const inicio = chaveNome(linhas.slice(0, 40).join(" "));
  // impressão da tela "como imagem": só sobra o cabeçalho/rodapé ("PÁGINA 1 DE 3")
  const soCabecalho = arquivo.paginas.every((p) => p.length <= 2) && linhas.every((l) => /p[aá]gina \d+ de \d+/i.test(l));
  if (linhas.length && soCabecalho) {
    throw new Error("este PDF é uma imagem (impressão da tela) e não tem texto para ler — exporte em Excel (.xls) no Live e arraste aqui");
  }
  if (/relatorio de previsto x realizado/.test(inicio)) return interpretarPrevistoRealizado(linhas);
  if (/^posicao financeira/.test(inicio)) return interpretarPosicaoFinanceira(linhas);
  if (!linhas.length) throw new Error("PDF sem texto (conta escaneada) — confira e lance à mão");
  if (/sabesp/.test(inicio)) return interpretarFaturaSabesp(arquivo.paginas[0] ?? linhas);
  if (/copel/.test(inicio)) return interpretarFaturaCopel(linhas);
  if (/sanepar/.test(chaveNome(linhas.join(" ")))) return interpretarFaturaSanepar(linhas);
  if (/enel|eletropaulo/.test(chaveNome(linhas.join(" ")))) return interpretarFaturaEnel(arquivo.paginas[0] ?? linhas);
  if (/prestacao contas operacional/.test(inicio)) {
    return {
      tipo: "informativo",
      titulo: "Prestação de contas operacional",
      motivo: "As fotos deste relatório são escolhidas na seção Registro fotográfico, em “Fotos do LiveFacilities”.",
    };
  }
  if (/lista de boletos pagos|boletos pagos/.test(inicio)) {
    throw new Error("use a versão em Excel da Lista de Boletos Pagos (marque “Excel” ao gerar)");
  }
  throw new Error("PDF não reconhecido como relatório do LiveFacilities ou conta de concessionária");
};

export const interpretarArquivo = (arquivo: ArquivoLido): ResultadoLeitura => {
  try {
    return { ok: true, nome: arquivo.nome, relatorio: reconhecer(arquivo) };
  } catch (e) {
    return { ok: false, nome: arquivo.nome, erro: e instanceof Error ? e.message : String(e) };
  }
};
