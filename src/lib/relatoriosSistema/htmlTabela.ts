/**
 * Os ".xls" que o LiveFacilities exporta NÃO são Excel: são páginas HTML com
 * <table> (às vezes em UTF-16 com BOM). Aqui viram linhas e células de texto —
 * o mesmo formato da planilha .xlsx — sem biblioteca e sem DOM (roda no Node).
 */

/** Bytes do arquivo → texto, respeitando o BOM (UTF-16 LE/BE ou UTF-8). */
export const decodificarTexto = (bytes: Uint8Array): string => {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  // sem BOM e com caractere inválido: provavelmente Windows-1252
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8.replace(/^﻿/, "");
};

/** É um "xls" em HTML? (o Excel binário de verdade começa com D0 CF 11 E0) */
export const ehHtml = (texto: string) => /<(table|html|div|style)\b/i.test(texto.slice(0, 4000));

const ENTIDADES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const textoDaCelula = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCharCode(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTIDADES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();

/** Todas as linhas de todas as tabelas, na ordem do documento. Linhas vazias saem. */
export const linhasDeHtml = (html: string): string[][] => {
  const linhas: string[][] = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const celulas = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => textoDaCelula(c[1]));
    if (celulas.some((c) => c)) linhas.push(celulas);
  }
  return linhas;
};

/** .xlsx de verdade é um ZIP ("PK\x03\x04"). */
export const ehZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
