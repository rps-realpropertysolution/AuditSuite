import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from "pdf-lib";
import type { ReportData, Narrative, DisciplineStat } from "./reportData";
import logoUrl from "@/assets/logo-rps.png";

let cachedLogoBytes: Uint8Array | null = null;
async function loadLogoBytes(): Promise<Uint8Array | null> {
  if (cachedLogoBytes) return cachedLogoBytes;
  try {
    const res = await fetch(logoUrl);
    const buf = await res.arrayBuffer();
    cachedLogoBytes = new Uint8Array(buf);
    return cachedLogoBytes;
  } catch {
    return null;
  }
}

const NAVY: RGB = rgb(0.06, 0.11, 0.24);
const NAVY_LIGHT: RGB = rgb(0.16, 0.27, 0.45);
const GOLD: RGB = rgb(0.79, 0.66, 0.30);
const INK: RGB = rgb(0.12, 0.12, 0.14);
const MUTED: RGB = rgb(0.42, 0.45, 0.50);
const LINE: RGB = rgb(0.85, 0.87, 0.91);
const SOFT_BG: RGB = rgb(0.96, 0.97, 0.99);
const RED: RGB = rgb(0.78, 0.13, 0.18);
const ORANGE: RGB = rgb(0.93, 0.49, 0.13);
const YELLOW: RGB = rgb(0.94, 0.78, 0.20);
const BLUE: RGB = rgb(0.20, 0.40, 0.78);
const GREEN: RGB = rgb(0.16, 0.55, 0.32);

const A4 = { w: 595, h: 842 };
const MARGIN = { l: 50, r: 50, t: 95, b: 65 };

const critColor = (c: string): RGB => c === "critica" ? RED : c === "alta" ? ORANGE : c === "media" ? YELLOW : BLUE;
const riskColor = (r: string): RGB => r === "Crítico" ? RED : r === "Alto" ? ORANGE : r === "Médio" ? YELLOW : GREEN;

interface Ctx {
  pdf: PDFDocument;
  font: PDFFont; bold: PDFFont; italic: PDFFont;
  page: PDFPage;
  cursorY: number;
  pageNumber: number;
  meta: { code: string; emp: string; period: string; title: string };
  logo?: { image: any; w: number; h: number };
}

const PDF_TEXT_REPLACEMENTS: Record<string, string> = {
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "←": "<-",
  "•": "-",
  "…": "...",
  "–": "-",
  "—": "-",
  "✓": "OK",
  "✗": "X",
  "⚠": "Alerta",
  "≠": "!=",
};

function sanitizePdfText(text: string, font?: PDFFont) {
  const normalized = String(text ?? "").replace(/[≥≤→←•…–—✓✗⚠≠]/g, (char) => PDF_TEXT_REPLACEMENTS[char] ?? "");
  if (!font) return normalized;

  let out = "";
  for (const char of normalized) {
    if (char === "\n" || char === "\r" || char === "\t") {
      out += char;
      continue;
    }
    try {
      font.encodeText(char);
      out += char;
    } catch {
      const fallback = char.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
      for (const fallbackChar of fallback) {
        try {
          font.encodeText(fallbackChar);
          out += fallbackChar;
        } catch {
          // skip unsupported glyphs on standard fonts
        }
      }
    }
  }

  return out;
}

function patchPage(page: PDFPage) {
  const safePage = page as PDFPage & { __safeDrawText?: boolean };
  if (safePage.__safeDrawText) return page;

  const originalDrawText = page.drawText.bind(page);
  (safePage as PDFPage & { drawText: (text: string, options?: any) => void }).drawText = (text: string, options?: any) => {
    originalDrawText(sanitizePdfText(text, options?.font), options);
  };
  safePage.__safeDrawText = true;
  return page;
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  sanitizePdfText(text, font).split(/\n+/).forEach(par => {
    const words = par.split(/\s+/);
    let line = "";
    words.forEach(w => {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW) { if (line) out.push(line); line = w; }
      else line = test;
    });
    if (line) out.push(line);
    out.push(""); // paragraph break
  });
  if (out[out.length - 1] === "") out.pop();
  return out;
}

function drawHeader(c: Ctx) {
  const { page, bold, font, meta } = c;
  page.drawRectangle({ x: 0, y: A4.h - 60, width: A4.w, height: 60, color: NAVY });
  page.drawRectangle({ x: 0, y: A4.h - 64, width: A4.w, height: 4, color: GOLD });
  // Real RPS logo
  if (c.logo) {
    const h = 34, w = h * (c.logo.w / c.logo.h);
    page.drawImage(c.logo.image, { x: 46, y: A4.h - 50, width: w, height: h });
    page.drawText("AUDITORIA OPERACIONAL & CONFORMIDADE", { x: 46 + w + 12, y: A4.h - 30, size: 9, font: bold, color: rgb(1,1,1) });
    page.drawText(meta.title, { x: 46 + w + 12, y: A4.h - 44, size: 7, font, color: rgb(0.85, 0.87, 0.91) });
  } else {
    page.drawRectangle({ x: 50, y: A4.h - 48, width: 30, height: 30, color: GOLD });
    page.drawText("RPS", { x: 56, y: A4.h - 40, size: 14, font: bold, color: NAVY });
    page.drawText("AUDITORIA OPERACIONAL & CONFORMIDADE", { x: 90, y: A4.h - 30, size: 9, font: bold, color: rgb(1,1,1) });
    page.drawText(meta.title, { x: 90, y: A4.h - 44, size: 7, font, color: rgb(0.85, 0.87, 0.91) });
  }
  page.drawText(meta.code, { x: A4.w - 50, y: A4.h - 30, size: 7, font, color: rgb(0.85,0.87,0.91), maxWidth: 200, lineHeight: 8 });
}

function drawFooter(c: Ctx) {
  const { page, font, meta } = c;
  page.drawLine({ start: { x: MARGIN.l, y: 50 }, end: { x: A4.w - MARGIN.r, y: 50 }, thickness: 0.5, color: LINE });
  page.drawText("CONFIDENCIAL — USO INTERNO", { x: MARGIN.l, y: 35, size: 7, font, color: MUTED });
  page.drawText(`${meta.emp} · ${meta.period}`, { x: A4.w / 2 - 60, y: 35, size: 7, font, color: MUTED });
  page.drawText(`Página ${c.pageNumber}`, { x: A4.w - MARGIN.r - 50, y: 35, size: 7, font, color: MUTED });
}

function newPage(c: Ctx, decorate = true) {
  c.page = patchPage(c.pdf.addPage([A4.w, A4.h]));
  c.pageNumber++;
  c.cursorY = A4.h - MARGIN.t;
  if (decorate) { drawHeader(c); drawFooter(c); }
}

function ensure(c: Ctx, needed: number) {
  if (c.cursorY - needed < MARGIN.b + 20) newPage(c);
}

function h1(c: Ctx, num: string, title: string) {
  ensure(c, 50);
  c.cursorY -= 10;
  c.page.drawRectangle({ x: MARGIN.l, y: c.cursorY - 4, width: 3, height: 22, color: GOLD });
  c.page.drawText(num, { x: MARGIN.l + 10, y: c.cursorY + 5, size: 11, font: c.bold, color: GOLD });
  c.page.drawText(title.toUpperCase(), { x: MARGIN.l + 35, y: c.cursorY + 5, size: 13, font: c.bold, color: NAVY });
  c.cursorY -= 14;
  c.page.drawLine({ start: { x: MARGIN.l, y: c.cursorY }, end: { x: A4.w - MARGIN.r, y: c.cursorY }, thickness: 0.5, color: LINE });
  c.cursorY -= 14;
}

function h2(c: Ctx, title: string) {
  ensure(c, 24);
  c.cursorY -= 4;
  c.page.drawText(title, { x: MARGIN.l, y: c.cursorY, size: 10, font: c.bold, color: NAVY_LIGHT });
  c.cursorY -= 14;
}

function paragraph(c: Ctx, text: string, opts: { size?: number; color?: RGB; font?: PDFFont } = {}) {
  const size = opts.size ?? 9.5;
  const color = opts.color ?? INK;
  const ft = opts.font ?? c.font;
  const maxW = A4.w - MARGIN.l - MARGIN.r;
  const lines = wrap(text, ft, size, maxW);
  lines.forEach(line => {
    ensure(c, size + 3);
    if (line) c.page.drawText(line, { x: MARGIN.l, y: c.cursorY, size, font: ft, color });
    c.cursorY -= size + 3.5;
  });
  c.cursorY -= 3;
}

function kpiCards(c: Ctx, cards: Array<{ label: string; value: string | number; tone?: RGB }>) {
  const cols = 3, gap = 8;
  const w = (A4.w - MARGIN.l - MARGIN.r - gap * (cols - 1)) / cols;
  const h = 50;
  cards.forEach((card, i) => {
    if (i % cols === 0) ensure(c, h + 8);
    const x = MARGIN.l + (i % cols) * (w + gap);
    const y = c.cursorY - h;
    c.page.drawRectangle({ x, y, width: w, height: h, color: SOFT_BG, borderColor: LINE, borderWidth: 0.5 });
    c.page.drawRectangle({ x, y, width: 3, height: h, color: card.tone ?? GOLD });
    c.page.drawText(card.label, { x: x + 10, y: y + h - 14, size: 7, font: c.font, color: MUTED });
    c.page.drawText(String(card.value), { x: x + 10, y: y + 12, size: 18, font: c.bold, color: NAVY });
    if (i % cols === cols - 1 || i === cards.length - 1) c.cursorY -= h + 8;
  });
}

function table(c: Ctx, headers: string[], rows: (string | { text: string; color?: RGB; bg?: RGB })[][], widths: number[]) {
  const rowH = 16, headH = 18;
  ensure(c, headH + rowH);
  // header
  const totalW = widths.reduce((a,b)=>a+b, 0);
  c.page.drawRectangle({ x: MARGIN.l, y: c.cursorY - headH, width: totalW, height: headH, color: NAVY });
  let x = MARGIN.l;
  headers.forEach((h, i) => {
    c.page.drawText(h, { x: x + 4, y: c.cursorY - 12, size: 7.5, font: c.bold, color: rgb(1,1,1) });
    x += widths[i];
  });
  c.cursorY -= headH;
  rows.forEach((r, ri) => {
    ensure(c, rowH);
    if (ri % 2 === 1) c.page.drawRectangle({ x: MARGIN.l, y: c.cursorY - rowH, width: totalW, height: rowH, color: SOFT_BG });
    x = MARGIN.l;
    r.forEach((cell, i) => {
      const obj = typeof cell === "string" ? { text: cell } : cell;
      if (obj.bg) c.page.drawRectangle({ x: x + 2, y: c.cursorY - rowH + 2, width: widths[i] - 4, height: rowH - 4, color: obj.bg });
      const lines = wrap(obj.text ?? "", c.font, 7.5, widths[i] - 8);
      c.page.drawText(lines[0] ?? "", { x: x + 4, y: c.cursorY - 11, size: 7.5, font: c.font, color: obj.color ?? INK });
      x += widths[i];
    });
    c.page.drawLine({ start: { x: MARGIN.l, y: c.cursorY - rowH }, end: { x: MARGIN.l + totalW, y: c.cursorY - rowH }, thickness: 0.3, color: LINE });
    c.cursorY -= rowH;
  });
  c.cursorY -= 6;
}

function bar(c: Ctx, label: string, value: number, max: number, color: RGB, w = 300) {
  ensure(c, 14);
  const pct = max ? Math.min(1, value / max) : 0;
  c.page.drawText(label, { x: MARGIN.l, y: c.cursorY - 9, size: 7.5, font: c.font, color: INK, maxWidth: 130 });
  c.page.drawRectangle({ x: MARGIN.l + 140, y: c.cursorY - 11, width: w, height: 9, color: SOFT_BG });
  c.page.drawRectangle({ x: MARGIN.l + 140, y: c.cursorY - 11, width: w * pct, height: 9, color });
  c.page.drawText(`${value}`, { x: MARGIN.l + 140 + w + 5, y: c.cursorY - 9, size: 7.5, font: c.bold, color: INK });
  c.cursorY -= 14;
}

function gauge(c: Ctx, score: number, classificacao: string) {
  const cx = MARGIN.l + 90, cy = c.cursorY - 80, r = 55;
  ensure(c, 130);
  // segments
  const segs = [{ end: 0.6, color: RED }, { end: 0.75, color: ORANGE }, { end: 0.9, color: YELLOW }, { end: 1, color: GREEN }];
  let start = Math.PI;
  segs.forEach(s => {
    const end = Math.PI - (s.end * Math.PI);
    const steps = 30;
    for (let i = 0; i < steps; i++) {
      const a1 = start - (start - end) * (i / steps);
      const a2 = start - (start - end) * ((i + 1) / steps);
      const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
      const x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
      c.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 10, color: s.color });
    }
    start = end;
  });
  // needle
  const a = Math.PI - (score / 100) * Math.PI;
  c.page.drawLine({ start: { x: cx, y: cy }, end: { x: cx + Math.cos(a) * (r - 5), y: cy + Math.sin(a) * (r - 5) }, thickness: 2, color: NAVY });
  c.page.drawCircle({ x: cx, y: cy, size: 4, color: NAVY });
  c.page.drawText(`${score}%`, { x: cx - 18, y: cy - 22, size: 22, font: c.bold, color: NAVY });
  c.page.drawText("SCORE OPERACIONAL", { x: cx + 110, y: cy + 30, size: 8, font: c.bold, color: MUTED });
  c.page.drawText(classificacao, { x: cx + 110, y: cy + 12, size: 20, font: c.bold, color: classificacao === "Excelente" ? GREEN : classificacao === "Adequado" ? BLUE : classificacao === "Atenção" ? ORANGE : RED });
  c.page.drawText("Faixas: ≥90 Excelente · ≥75 Adequado · ≥60 Atenção · <60 Crítico", { x: cx + 110, y: cy - 6, size: 6.5, font: c.font, color: MUTED });
  c.cursorY -= 140;
}

function riskHeatmap(c: Ctx, matrix: number[][]) {
  const cell = 32;
  const ox = MARGIN.l + 60, oy = c.cursorY - cell * 5 - 10;
  ensure(c, cell * 5 + 40);
  const palette = [
    [GREEN, GREEN, YELLOW, YELLOW, ORANGE],
    [GREEN, YELLOW, YELLOW, ORANGE, ORANGE],
    [YELLOW, YELLOW, ORANGE, ORANGE, RED],
    [YELLOW, ORANGE, ORANGE, RED, RED],
    [ORANGE, ORANGE, RED, RED, RED],
  ];
  for (let p = 0; p < 5; p++) for (let i = 0; i < 5; i++) {
    const x = ox + i * cell, y = oy + p * cell;
    c.page.drawRectangle({ x, y, width: cell - 1, height: cell - 1, color: palette[p][i], opacity: 0.4 });
    c.page.drawText(String(matrix[p]?.[i] ?? 0), { x: x + cell / 2 - 4, y: y + cell / 2 - 4, size: 9, font: c.bold, color: INK });
  }
  c.page.drawText("Probabilidade →", { x: ox, y: oy - 12, size: 7, font: c.bold, color: MUTED });
  c.page.drawText("← Impacto", { x: ox - 50, y: oy + cell * 2.5, size: 7, font: c.bold, color: MUTED, rotate: { type: "degrees", angle: 90 } as any });
  ["1","2","3","4","5"].forEach((n, i) => {
    c.page.drawText(n, { x: ox + i * cell + cell / 2 - 3, y: oy + cell * 5 + 4, size: 7, font: c.font, color: MUTED });
    c.page.drawText(n, { x: ox - 12, y: oy + i * cell + cell / 2 - 3, size: 7, font: c.font, color: MUTED });
  });
  c.cursorY = oy - 20;
}

function donut(c: Ctx, title: string, items: Array<{ label: string; value: number; color: RGB }>, cx: number, cy: number, r: number) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  let start = -Math.PI / 2;
  items.forEach(it => {
    const angle = (it.value / total) * Math.PI * 2;
    const end = start + angle;
    const steps = Math.max(6, Math.ceil(angle * 24));
    for (let i = 0; i < steps; i++) {
      const a1 = start + (end - start) * (i / steps);
      const a2 = start + (end - start) * ((i + 1) / steps);
      const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
      const x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
      c.page.drawLine({ start: { x: cx, y: cy }, end: { x: x1, y: y1 }, thickness: 0.3, color: it.color, opacity: 0 });
      c.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 16, color: it.color });
    }
    start = end;
  });
  c.page.drawCircle({ x: cx, y: cy, size: r - 12, color: rgb(1, 1, 1) });
  c.page.drawText(String(total), { x: cx - 12, y: cy - 4, size: 14, font: c.bold, color: NAVY });
  // title
  c.page.drawText(title, { x: cx - r, y: cy + r + 12, size: 8, font: c.bold, color: NAVY });
  // legend to the right
  let ly = cy + r - 4;
  items.forEach(it => {
    c.page.drawRectangle({ x: cx + r + 18, y: ly - 4, width: 8, height: 8, color: it.color });
    const pct = Math.round((it.value / total) * 100);
    c.page.drawText(`${it.label}  ${it.value} (${pct}%)`, { x: cx + r + 32, y: ly - 3, size: 7.5, font: c.font, color: INK });
    ly -= 14;
  });
}

function lineChart(c: Ctx, title: string, points: Array<{ label: string; value: number }>, w = 480, h = 110) {
  ensure(c, h + 30);
  const x0 = MARGIN.l + 30, y0 = c.cursorY - 10, y1 = y0 - h;
  // title
  c.page.drawText(title, { x: MARGIN.l, y: y0 + 6, size: 9, font: c.bold, color: NAVY });
  // axes
  c.page.drawLine({ start: { x: x0, y: y0 }, end: { x: x0, y: y1 }, thickness: 0.5, color: LINE });
  c.page.drawLine({ start: { x: x0, y: y1 }, end: { x: x0 + w, y: y1 }, thickness: 0.5, color: LINE });
  // y grid 0/50/100
  [0, 50, 100].forEach(v => {
    const y = y1 + (v / 100) * h;
    c.page.drawLine({ start: { x: x0, y }, end: { x: x0 + w, y }, thickness: 0.25, color: rgb(0.92, 0.93, 0.96) });
    c.page.drawText(String(v), { x: x0 - 22, y: y - 3, size: 6.5, font: c.font, color: MUTED });
  });
  const stepX = points.length > 1 ? w / (points.length - 1) : w;
  points.forEach((p, i) => {
    const x = x0 + i * stepX;
    c.page.drawText(p.label, { x: x - 6, y: y1 - 10, size: 6.5, font: c.font, color: MUTED });
    const y = y1 + (Math.max(0, Math.min(100, p.value)) / 100) * h;
    if (i > 0) {
      const px = x0 + (i - 1) * stepX;
      const pv = points[i - 1].value;
      const py = y1 + (Math.max(0, Math.min(100, pv)) / 100) * h;
      c.page.drawLine({ start: { x: px, y: py }, end: { x, y }, thickness: 1.5, color: NAVY_LIGHT });
    }
    c.page.drawCircle({ x, y, size: 2.5, color: GOLD });
    c.page.drawText(`${p.value}%`, { x: x - 8, y: y + 4, size: 6.5, font: c.bold, color: NAVY });
  });
  c.cursorY = y1 - 24;
}

function drawCover(c: Ctx, d: ReportData, params: ReportParams) {
  const p = c.page;
  // navy band top
  p.drawRectangle({ x: 0, y: A4.h - 220, width: A4.w, height: 220, color: NAVY });
  p.drawRectangle({ x: 0, y: A4.h - 226, width: A4.w, height: 6, color: GOLD });
  // Real RPS logo
  if (c.logo) {
    const h = 70, w = h * (c.logo.w / c.logo.h);
    p.drawImage(c.logo.image, { x: 50, y: A4.h - 110, width: w, height: h });
    p.drawText("Auditoria Operacional & Conformidade", { x: 50, y: A4.h - 128, size: 9, font: c.font, color: rgb(0.85,0.87,0.91) });
  } else {
    p.drawRectangle({ x: 50, y: A4.h - 90, width: 48, height: 48, color: GOLD });
    p.drawText("RPS", { x: 56, y: A4.h - 78, size: 22, font: c.bold, color: NAVY });
    p.drawText("RPS", { x: 110, y: A4.h - 70, size: 18, font: c.bold, color: rgb(1,1,1) });
    p.drawText("Auditoria Operacional & Conformidade", { x: 110, y: A4.h - 88, size: 9, font: c.font, color: rgb(0.85,0.87,0.91) });
  }
  // classification
  p.drawRectangle({ x: A4.w - 200, y: A4.h - 70, width: 150, height: 24, color: GOLD });
  p.drawText(params.classificacao, { x: A4.w - 192, y: A4.h - 62, size: 8, font: c.bold, color: NAVY });
  p.drawText(params.tipoAuditoria.toUpperCase(), { x: 50, y: A4.h - 150, size: 9, font: c.bold, color: GOLD });
  p.drawText("RELATÓRIO EXECUTIVO DE", { x: 50, y: A4.h - 170, size: 16, font: c.bold, color: rgb(1,1,1) });
  p.drawText("AUDITORIA OPERACIONAL E DE CONFORMIDADE", { x: 50, y: A4.h - 190, size: 16, font: c.bold, color: rgb(1,1,1) });

  // institutional block
  p.drawText(d.emp.nome, { x: 50, y: A4.h - 290, size: 26, font: c.bold, color: NAVY });
  p.drawText(`Código do empreendimento: ${d.emp.codigo}`, { x: 50, y: A4.h - 312, size: 9, font: c.font, color: MUTED });
  if (d.emp.cidade) p.drawText(`${d.emp.cidade}${d.emp.endereco ? " — " + d.emp.endereco : ""}`, { x: 50, y: A4.h - 326, size: 9, font: c.font, color: MUTED });
  if (d.emp.cnpj) p.drawText(`CNPJ: ${d.emp.cnpj}`, { x: 50, y: A4.h - 340, size: 9, font: c.font, color: MUTED });

  // Big info card
  const cy = 280;
  p.drawRectangle({ x: 50, y: cy, width: A4.w - 100, height: 160, color: SOFT_BG, borderColor: LINE, borderWidth: 0.5 });
  p.drawRectangle({ x: 50, y: cy, width: 4, height: 160, color: GOLD });
  const row = (label: string, value: string, line: number) => {
    p.drawText(label.toUpperCase(), { x: 70, y: cy + 140 - line * 28, size: 7, font: c.bold, color: MUTED });
    p.drawText(value, { x: 70, y: cy + 128 - line * 28, size: 11, font: c.bold, color: NAVY });
  };
  row("Cliente", d.emp.nome, 0);
  row("Administradora", "RPS — Real Property Services", 1);
  row("Tipo de auditoria", params.tipoAuditoria, 2);
  row("Período auditado", params.periodoLabel, 3);
  row("Data de emissão", new Date(d.emittedAt).toLocaleDateString("pt-BR"), 4);

  const rcol = A4.w / 2 + 20;
  const rrow = (label: string, value: string, line: number) => {
    p.drawText(label.toUpperCase(), { x: rcol, y: cy + 140 - line * 28, size: 7, font: c.bold, color: MUTED });
    p.drawText(value, { x: rcol, y: cy + 128 - line * 28, size: 11, font: c.bold, color: NAVY });
  };
  rrow("Código do relatório", d.reportCode, 0);
  rrow("Versão", "1.0", 1);
  rrow("Responsável técnico", params.responsavelTecnico, 2);
  rrow("Auditor responsável", params.auditorResponsavel, 3);
  rrow("Classificação", params.classificacao, 4);

  // footer band
  p.drawRectangle({ x: 0, y: 0, width: A4.w, height: 50, color: NAVY });
  p.drawRectangle({ x: 0, y: 50, width: A4.w, height: 4, color: GOLD });
  p.drawText("Documento gerado pelo Sistema RPS · Auditoria Operacional", { x: 50, y: 22, size: 8, font: c.font, color: rgb(0.85,0.87,0.91) });
  p.drawText(d.reportCode, { x: A4.w - 230, y: 22, size: 8, font: c.bold, color: GOLD });
}

export interface ReportParams {
  tipoAuditoria: string;
  periodoLabel: string;
  responsavelTecnico: string;
  auditorResponsavel: string;
  classificacao: string;
}

export async function buildExecutivePdf(d: ReportData, n: Narrative, params: ReportParams): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  let logo: Ctx["logo"];
  const logoBytes = await loadLogoBytes();
  if (logoBytes) {
    try {
      const img = await pdf.embedPng(logoBytes);
      logo = { image: img, w: img.width, h: img.height };
    } catch { /* ignore */ }
  }
  const ctx: Ctx = {
    pdf, font, bold, italic,
    page: patchPage(pdf.addPage([A4.w, A4.h])),
    cursorY: A4.h - MARGIN.t, pageNumber: 1,
    meta: { code: d.reportCode, emp: `${d.emp.codigo} · ${d.emp.nome}`, period: params.periodoLabel, title: params.tipoAuditoria },
    logo,
  };
  // Cover (no header/footer)
  drawCover(ctx, d, params);

  // ---- 2. Folha de controle
  newPage(ctx);
  h1(ctx, "2.", "Folha de Controle");
  paragraph(ctx, "Documento submetido aos processos de revisão técnica e aprovação interna. As alterações são rastreadas pelo controle de versão indicado abaixo.");
  table(ctx, ["Item", "Conteúdo"], [
    ["Código do relatório", d.reportCode],
    ["Versão / revisão", "1.0 — emissão inicial"],
    ["Data de emissão", new Date(d.emittedAt).toLocaleString("pt-BR")],
    ["Tipo de auditoria", params.tipoAuditoria],
    ["Período auditado", params.periodoLabel],
    ["Empreendimento auditado", `${d.emp.codigo} — ${d.emp.nome}`],
    ["Cliente", d.emp.nome],
    ["Administradora", "RPS — Real Property Services"],
    ["Responsável técnico", params.responsavelTecnico],
    ["Auditor responsável", params.auditorResponsavel],
    ["Classificação documental", params.classificacao],
    ["Distribuição autorizada", "Diretoria · Gerência regional · Gestor local · Cliente"],
  ], [160, 335]);
  h2(ctx, "Histórico de revisões");
  table(ctx, ["Versão", "Data", "Autor", "Descrição"], [
    ["1.0", new Date(d.emittedAt).toLocaleDateString("pt-BR"), params.auditorResponsavel, "Emissão inicial do relatório executivo"],
  ], [60, 90, 160, 185]);
  h2(ctx, "Aprovações");
  table(ctx, ["Função", "Responsável", "Data", "Assinatura"], [
    ["Auditor responsável", params.auditorResponsavel, "____ / ____ / ______", "_______________"],
    ["Responsável técnico", params.responsavelTecnico, "____ / ____ / ______", "_______________"],
    ["Diretoria RPS", "_______________________", "____ / ____ / ______", "_______________"],
    ["Cliente / representante", "_______________________", "____ / ____ / ______", "_______________"],
    ["Ciência da gestão local", "_______________________", "____ / ____ / ______", "_______________"],
  ], [120, 160, 100, 115]);

  // ---- 3. Sumário
  newPage(ctx);
  h1(ctx, "3.", "Sumário");
  const toc = [
    "1. Capa", "2. Folha de controle", "3. Sumário",
    "4. Introdução", "5. Metodologia de auditoria",
    "6. Disciplinas auditadas", "7. Amostragem", "8. Resumo executivo",
    "9. Análise analítica das disciplinas", "10. Não conformidades",
    "11. Análise de riscos", "12. Reincidências", "13. Desempenho da gestão",
    "14. Plano de ação", "15. Conclusão executiva",
    "16. Assinaturas", "17. Anexos",
  ];
  toc.forEach(t => { ensure(ctx, 14); ctx.page.drawText(t, { x: MARGIN.l + 8, y: ctx.cursorY, size: 10, font: ctx.font, color: INK }); ctx.cursorY -= 16; });

  // ---- 4. Introdução
  newPage(ctx); h1(ctx, "4.", "Introdução");
  paragraph(ctx, n.introducao);
  h2(ctx, "Premissas e limitações");
  paragraph(ctx, "A presente avaliação baseia-se em evidências amostrais coletadas no período auditado, considerando documentação fornecida, inspeções in loco e entrevistas. Eventuais não conformidades não identificadas em itens não amostrados não invalidam o parecer técnico, dado o caráter representativo da amostragem adotada.", { color: MUTED, size: 9 });

  // ---- 5. Metodologia
  h1(ctx, "5.", "Metodologia de auditoria");
  paragraph(ctx, n.metodologia);
  h2(ctx, "Critérios de classificação");
  table(ctx, ["Status", "Pontuação", "Significado"], [
    [{ text: "Conforme", color: GREEN }, "100", "Atende integralmente ao requisito"],
    [{ text: "Parcial",  color: ORANGE }, "50",  "Atende parcialmente — requer ajustes"],
    [{ text: "Pendente", color: MUTED }, "25",  "Em verificação ou aguardando evidência"],
    [{ text: "Não Conforme", color: RED }, "0", "Não atende ao requisito; gera plano de ação"],
    [{ text: "Não Aplicável", color: MUTED }, "—", "Item não pertinente ao empreendimento"],
  ], [110, 70, 315]);

  // ---- 6. Disciplinas auditadas
  newPage(ctx); h1(ctx, "6.", "Disciplinas auditadas");
  const discRows = d.byCat.map(b => [
    `${b.cat.codigo} — ${b.cat.nome}`,
    String(b.total),
    { text: `${b.conformidade}%`, color: b.conformidade >= 90 ? GREEN : b.conformidade >= 75 ? BLUE : b.conformidade >= 60 ? ORANGE : RED },
    { text: b.risco, color: riskColor(b.risco) },
    String(b.nc),
  ]);
  table(ctx, ["Disciplina", "Itens", "Conformidade", "Risco", "NCs"], discRows, [200, 50, 90, 90, 65]);

  // ---- 7. Amostragem
  h1(ctx, "7.", "Amostragem");
  paragraph(ctx, `A auditoria avaliou ${d.amostragem.auditado} itens (cobertura de ${d.amostragem.cobertura}% sobre o universo de ${d.amostragem.universo} itens auditáveis), com coleta de ${d.amostragem.evidencias} evidências documentais e fotográficas. A amostragem priorizou itens de criticidade alta e crítica e considerou aleatorização nos demais.`);
  bar(ctx, "Cobertura da amostra", d.amostragem.cobertura, 100, BLUE);
  bar(ctx, "Itens críticos / NCs", d.amostragem.criticos, Math.max(1, d.kpi.total), RED);
  bar(ctx, "Evidências coletadas", d.amostragem.evidencias, Math.max(1, d.amostragem.auditado), GOLD);

  // ---- 8. Resumo executivo
  newPage(ctx); h1(ctx, "8.", "Resumo executivo");
  gauge(ctx, d.kpi.score, d.kpi.classificacao);
  kpiCards(ctx, [
    { label: "Itens auditados", value: d.kpi.total },
    { label: "Conformes", value: d.kpi.conformes, tone: GREEN },
    { label: "Não Conformes", value: d.kpi.nc, tone: RED },
    { label: "Parciais", value: d.kpi.parcial, tone: ORANGE },
    { label: "Pendentes", value: d.kpi.pendente, tone: MUTED },
    { label: "Críticos abertos", value: d.kpi.criticos, tone: RED },
    { label: "Planos vencidos", value: d.kpi.vencidos, tone: ORANGE },
    { label: "Reincidências", value: d.kpi.reincidencias, tone: ORANGE },
    { label: "SLA médio (dias)", value: d.kpi.slaMedio, tone: BLUE },
  ]);

  // Charts side-by-side: status donut + criticidade donut
  ensure(ctx, 180);
  const baseY = ctx.cursorY - 10;
  donut(ctx, "Distribuição de Status", [
    { label: "Conforme",     value: d.kpi.conformes, color: GREEN },
    { label: "Parcial",      value: d.kpi.parcial,   color: ORANGE },
    { label: "Pendente",     value: d.kpi.pendente,  color: MUTED },
    { label: "Não Conforme", value: d.kpi.nc,        color: RED },
  ], MARGIN.l + 55, baseY - 70, 45);
  donut(ctx, "Criticidade das NCs", [
    { label: "Crítica", value: d.criticidadeDist.critica, color: RED },
    { label: "Alta",    value: d.criticidadeDist.alta,    color: ORANGE },
    { label: "Média",   value: d.criticidadeDist.media,   color: YELLOW },
    { label: "Baixa",   value: d.criticidadeDist.baixa,   color: BLUE },
  ], MARGIN.l + 320, baseY - 70, 45);
  ctx.cursorY = baseY - 170;

  // Evolução histórica (6 meses)
  lineChart(ctx, "Evolução do score operacional (últimos 6 meses)",
    d.historico.map(h => ({ label: h.label, value: h.score })));

  // ---- 9. Análise por disciplina
  newPage(ctx); h1(ctx, "9.", "Análise analítica das disciplinas");
  d.byCat.forEach((b: DisciplineStat) => {
    ensure(ctx, 80);
    h2(ctx, `${b.cat.codigo} — ${b.cat.nome}  ·  Conformidade ${b.conformidade}%  ·  Risco ${b.risco}`);
    const com = n.disciplinas[b.cat.codigo] ?? "Comentário técnico não disponível para esta disciplina.";
    paragraph(ctx, com, { size: 9 });
    if (b.nclist.length) {
      table(ctx, ["Código", "Não conformidade identificada", "Criticidade"],
        b.nclist.slice(0, 6).map(x => [x.item.codigo, x.item.pergunta, { text: x.item.criticidade, color: critColor(x.item.criticidade) }]),
        [70, 305, 110]);
    }
  });

  // ---- Evidências fotográficas embarcadas
  if (d.evidenceShots.length) {
    newPage(ctx); h1(ctx, "9A.", "Evidências fotográficas selecionadas");
    paragraph(ctx, "Amostra de evidências coletadas em campo, vinculadas a não conformidades. As demais evidências encontram-se no Sistema RPS, com rastreabilidade integral.", { size: 9, color: MUTED });
    const imgW = 230, imgH = 150, gap = 14;
    for (let i = 0; i < d.evidenceShots.length; i++) {
      const ev = d.evidenceShots[i];
      try {
        const img = ev.mime.includes("png")
          ? await ctx.pdf.embedPng(ev.bytes)
          : await ctx.pdf.embedJpg(ev.bytes);
        const dims = img.scaleToFit(imgW, imgH);
        if (i % 2 === 0) ensure(ctx, imgH + 40);
        const x = MARGIN.l + (i % 2) * (imgW + gap);
        const y = ctx.cursorY - dims.height;
        ctx.page.drawImage(img, { x, y, width: dims.width, height: dims.height });
        ctx.page.drawRectangle({ x, y, width: dims.width, height: dims.height, borderColor: LINE, borderWidth: 0.5 });
        ctx.page.drawText(`${ev.catCodigo} · ${ev.itemCodigo}`, { x, y: y - 10, size: 7.5, font: ctx.bold, color: NAVY });
        const lines = wrap(ev.pergunta, ctx.font, 7, imgW);
        ctx.page.drawText(lines[0] ?? "", { x, y: y - 20, size: 7, font: ctx.font, color: MUTED });
        if (i % 2 === 1 || i === d.evidenceShots.length - 1) ctx.cursorY = y - 32;
      } catch { /* skip broken image */ }
    }
  }

  // ---- 10. NCs
  newPage(ctx); h1(ctx, "10.", "Não conformidades");
  const allNc = d.byCat.flatMap(b => b.nclist.map(x => ({ ...x, cat: b.cat })));
  if (allNc.length === 0) paragraph(ctx, "Nenhuma não conformidade identificada no período auditado.");
  else table(ctx,
    ["Código", "Disciplina", "Descrição", "Criticidade", "Responsável", "Prazo"],
    allNc.slice(0, 60).map(x => [
      x.item.codigo, x.cat.codigo, x.item.pergunta,
      { text: x.item.criticidade, bg: critColor(x.item.criticidade), color: rgb(1,1,1) },
      x.answer.responsavel ?? "—",
      x.answer.prazo ?? "—",
    ]),
    [55, 55, 220, 65, 80, 60]);

  // ---- 11. Riscos
  newPage(ctx); h1(ctx, "11.", "Análise de riscos");
  paragraph(ctx, "Matriz de risco operacional 5×5 cruzando probabilidade × impacto, derivada da criticidade dos planos de ação ativos. O número em cada célula representa a quantidade de planos abertos no respectivo nível de severidade.");
  riskHeatmap(ctx, d.riskMatrix);
  paragraph(ctx, `Índice de risco operacional consolidado: ${d.kpi.riscoIndex}. Quanto maior o índice, maior a exposição operacional acumulada.`, { color: MUTED, size: 9 });

  // ---- 12. Reincidências
  h1(ctx, "12.", "Reincidências");
  if (d.reincidencias.length === 0) paragraph(ctx, "Nenhum item reincidente identificado no histórico do empreendimento.");
  else table(ctx, ["Código", "Disciplina", "Item reincidente", "Ocorrências", "Última"],
    d.reincidencias.slice(0, 15).map(r => [r.item.codigo, r.cat.codigo, r.item.pergunta, { text: `${r.qtd}x`, color: RED }, r.ultima.slice(0,10)]),
    [60, 60, 290, 70, 55]);

  // ---- 13. Desempenho da gestão
  newPage(ctx); h1(ctx, "13.", "Desempenho da gestão");
  paragraph(ctx, "Avaliação consolidada da maturidade da gestão operacional por dimensão. Score derivado da conformidade nas disciplinas correlatas e da efetividade na execução do plano de ação.");
  const dim = (name: string, valor: number) => bar(ctx, name, valor, 100, valor >= 75 ? GREEN : valor >= 60 ? BLUE : valor >= 40 ? ORANGE : RED);
  const avg = (codes: string[]) => {
    const list = d.byCat.filter(b => codes.includes(b.cat.codigo));
    return list.length ? Math.round(list.reduce((s, b) => s + b.conformidade, 0) / list.length) : d.kpi.score;
  };
  dim("Organização operacional", avg(["OPE","MAN"]));
  dim("Controle documental", avg(["DOC","COM"]));
  dim("Gestão financeira", avg(["FIN"]));
  dim("Gestão de contratos", avg(["CON"]));
  dim("Controle de fornecedores", avg(["PRE","FOR"]));
  dim("Governança & compliance", avg(["GOV","COM"]));
  dim("Capacidade de resposta (SLA)", Math.max(0, 100 - d.kpi.slaMedio * 2));
  dim("Controle de riscos", Math.max(0, 100 - d.kpi.riscoIndex));
  dim("Maturidade geral", d.kpi.score);

  // ---- 14. Plano de ação
  newPage(ctx); h1(ctx, "14.", "Plano de ação");
  paragraph(ctx, "SLA: Crítica 48h · Alta 5 dias · Média 15 dias · Baixa 30 dias. Itens vencidos aparecem destacados em vermelho.");
  const today = new Date().toISOString().slice(0,10);
  if (d.plans.length === 0) paragraph(ctx, "Nenhum plano de ação ativo no momento.");
  else table(ctx, ["ID", "Ação corretiva", "Responsável", "Criticidade", "Prazo", "Status"],
    d.plans.slice(0, 60).map((p, i) => {
      const vencido = p.status !== "concluido" && p.prazo && p.prazo < today;
      return [
        String(i + 1).padStart(3, "0"),
        p.titulo,
        p.responsavel ?? "—",
        { text: p.prioridade, color: critColor(p.prioridade) },
        { text: p.prazo ?? "—", color: vencido ? RED : INK, bg: vencido ? rgb(1, 0.92, 0.92) : undefined },
        { text: p.status, color: p.status === "concluido" ? GREEN : vencido ? RED : INK },
      ];
    }),
    [35, 215, 95, 65, 60, 65]);

  // ---- 15. Conclusão
  newPage(ctx); h1(ctx, "15.", "Conclusão executiva");
  paragraph(ctx, n.parecerExecutivo);
  paragraph(ctx, n.conclusao);
  h2(ctx, "Recomendações estratégicas");
  paragraph(ctx, n.recomendacoes);

  // ---- 16. Assinaturas
  newPage(ctx); h1(ctx, "16.", "Assinaturas");
  const sigBox = (label: string, name: string, y: number) => {
    ctx.page.drawLine({ start: { x: MARGIN.l, y }, end: { x: MARGIN.l + 220, y }, thickness: 0.8, color: NAVY });
    ctx.page.drawText(name, { x: MARGIN.l, y: y - 12, size: 9, font: ctx.bold, color: NAVY });
    ctx.page.drawText(label, { x: MARGIN.l, y: y - 24, size: 8, font: ctx.font, color: MUTED });
  };
  let y = ctx.cursorY - 40;
  sigBox("Auditor responsável", params.auditorResponsavel, y); y -= 70;
  sigBox("Responsável técnico", params.responsavelTecnico, y); y -= 70;
  sigBox("Diretoria RPS", "_____________________________", y); y -= 70;
  sigBox("Cliente / representante", "_____________________________", y); y -= 70;
  sigBox("Ciência da gestão local", "_____________________________", y);
  ctx.cursorY = y - 40;

  // ---- 17. Anexos
  newPage(ctx); h1(ctx, "17.", "Anexos");
  paragraph(ctx, "Os anexos do presente relatório encontram-se armazenados no Sistema RPS de Auditoria Operacional, acessíveis aos usuários autorizados, e compreendem:");
  paragraph(ctx, "• Evidências fotográficas vinculadas a cada item auditado\n• Planilhas analíticas exportadas (.xlsx)\n• Checklists completos do período\n• Logs de tratativas e histórico de evidências\n• Relatórios complementares e certificados (quando aplicável)", { size: 9 });
  paragraph(ctx, `Total de evidências registradas no período: ${d.evidencesCount}.`, { color: MUTED, size: 9 });

  return await pdf.save();
}