import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageNumber, Header, Footer, PageOrientation, LevelFormat,
} from "docx";
import type { ReportData, Narrative } from "./reportData";
import type { ReportParams } from "./reportPdf";
import { ImageRun } from "docx";
import logoUrl from "@/assets/logo-rps.png";

let _logoBytes: Uint8Array | null = null;
let _logoDataUrl: string | null = null;
async function getLogo(): Promise<{ bytes: Uint8Array; dataUrl: string } | null> {
  try {
    if (!_logoBytes || !_logoDataUrl) {
      const res = await fetch(logoUrl);
      const buf = await res.arrayBuffer();
      _logoBytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < _logoBytes.length; i++) bin += String.fromCharCode(_logoBytes[i]);
      _logoDataUrl = "data:image/png;base64," + btoa(bin);
    }
    return { bytes: _logoBytes, dataUrl: _logoDataUrl };
  } catch { return null; }
}

/* ------------------------- Excel ------------------------- */
export function buildExcel(d: ReportData, params: ReportParams): Blob {
  const wb = XLSX.utils.book_new();
  const meta = [
    ["Relatório Executivo de Auditoria Operacional e de Conformidade"],
    ["Código", d.reportCode],
    ["Empreendimento", `${d.emp.codigo} — ${d.emp.nome}`],
    ["Cliente", d.emp.nome],
    ["Administradora", "RPS — Real Property Services"],
    ["Tipo de auditoria", params.tipoAuditoria],
    ["Período auditado", params.periodoLabel],
    ["Data de emissão", new Date(d.emittedAt).toLocaleString("pt-BR")],
    ["Responsável técnico", params.responsavelTecnico],
    ["Auditor responsável", params.auditorResponsavel],
    ["Classificação", params.classificacao],
    [], ["KPI", "Valor"],
    ["Itens auditados", d.kpi.total], ["Conformes", d.kpi.conformes],
    ["Não Conformes", d.kpi.nc], ["Parciais", d.kpi.parcial], ["Pendentes", d.kpi.pendente],
    ["Score operacional (%)", d.kpi.score], ["Classificação geral", d.kpi.classificacao],
    ["Críticos abertos", d.kpi.criticos], ["Planos vencidos", d.kpi.vencidos],
    ["Reincidências", d.kpi.reincidencias], ["SLA médio (dias)", d.kpi.slaMedio],
    ["Índice de risco", d.kpi.riscoIndex], ["Cobertura amostral (%)", d.amostragem.cobertura],
    ["Universo de itens", d.amostragem.universo], ["Evidências coletadas", d.amostragem.evidencias],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Capa & KPIs");

  const disc = d.byCat.map(b => ({
    Código: b.cat.codigo, Disciplina: b.cat.nome,
    Itens: b.total, Conformes: b.conformes, Parciais: b.parcial, NCs: b.nc, Pendentes: b.pendente,
    "Conformidade (%)": b.conformidade, Risco: b.risco,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(disc), "Disciplinas");

  const itens = d.answers.map(a => {
    const item = d.items.find(i => i.id === a.item_id);
    const cat = d.cats.find(c => c.id === item?.category_id);
    return {
      Código: item?.codigo, Disciplina: cat?.codigo, Pergunta: item?.pergunta,
      Criticidade: item?.criticidade, Status: a.status,
      Responsável: a.responsavel ?? "", Prazo: a.prazo ?? "", Comentário: a.comentario ?? "",
      "Data resposta": a.created_at.slice(0,10),
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itens), "Itens auditados");

  const ncs = d.byCat.flatMap(b => b.nclist.map(x => ({
    "Código NC": x.item.codigo, Disciplina: b.cat.codigo, Descrição: x.item.pergunta,
    Criticidade: x.item.criticidade, Responsável: x.answer.responsavel ?? "",
    Prazo: x.answer.prazo ?? "", Comentário: x.answer.comentario ?? "",
  })));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ncs.length ? ncs : [{ "Código NC": "—" }]), "Não Conformidades");

  const today = new Date().toISOString().slice(0,10);
  const planos = d.plans.map((p, i) => ({
    ID: String(i + 1).padStart(3, "0"), "Ação": p.titulo, Responsável: p.responsavel ?? "",
    Criticidade: p.prioridade, Prazo: p.prazo ?? "", Status: p.status,
    Vencido: (p.status !== "concluido" && p.prazo && p.prazo < today) ? "SIM" : "",
    "Conclusão": p.data_conclusao ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planos.length ? planos : [{ ID: "—" }]), "Plano de Ação");

  const reinc = d.reincidencias.map(r => ({
    Código: r.item.codigo, Disciplina: r.cat.codigo, Item: r.item.pergunta,
    Ocorrências: r.qtd, "Última ocorrência": r.ultima.slice(0,10),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reinc.length ? reinc : [{ Código: "—" }]), "Reincidências");

  const hist = d.historico.map(h => ({
    Período: h.period, Mês: h.label, "Itens auditados": h.total,
    "NCs": h.nc, "Score (%)": h.score,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hist), "Evolução Histórica");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ------------------------- PowerPoint ------------------------- */
export async function buildPptx(d: ReportData, n: Narrative, params: ReportParams): Promise<Blob> {
  const p = new PptxGenJS();
  p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  const NAVY = "0F1B3D", GOLD = "C9A84C", LIGHT = "F5F7FA", MUTED = "6B7280", RED = "C72129", GREEN = "2A8C52", BLUE = "335FC6", ORANGE = "E07D21";

  const addFooter = (s: PptxGenJS.Slide, n: number) => {
    s.addShape("rect", { x: 0, y: 7.2, w: 13.33, h: 0.3, fill: { color: NAVY } });
    s.addText(`${d.emp.codigo} · ${d.emp.nome}  ·  ${params.periodoLabel}  ·  ${d.reportCode}`, { x: 0.3, y: 7.22, w: 11, h: 0.26, fontSize: 9, color: "FFFFFF", fontFace: "Calibri" });
    s.addText(`${n}`, { x: 12.6, y: 7.22, w: 0.6, h: 0.26, fontSize: 9, color: GOLD, bold: true, align: "right" });
  };

  // 1 Cover
  let s = p.addSlide(); s.background = { color: NAVY };
  s.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.15, fill: { color: GOLD } });
  const logo = await getLogo();
  if (logo) {
    s.addImage({ data: logo.dataUrl, x: 0.4, y: 0.35, w: 1.6, h: 0.78 });
    s.addText("Auditoria Operacional & Conformidade", { x: 2.1, y: 0.55, w: 8, h: 0.4, fontSize: 14, color: "FFFFFF", fontFace: "Calibri" });
  } else {
    s.addShape("rect", { x: 0.5, y: 0.4, w: 0.7, h: 0.7, fill: { color: GOLD } });
    s.addText("RPS", { x: 0.5, y: 0.4, w: 0.7, h: 0.7, align: "center", fontSize: 22, bold: true, color: NAVY, fontFace: "Calibri" });
    s.addText("RPS · Auditoria Operacional & Conformidade", { x: 1.4, y: 0.55, w: 8, h: 0.4, fontSize: 14, color: "FFFFFF", fontFace: "Calibri" });
  }
  s.addText(params.classificacao, { x: 10.6, y: 0.5, w: 2.4, h: 0.45, align: "center", fontSize: 11, bold: true, color: NAVY, fill: { color: GOLD } });
  s.addText("RELATÓRIO EXECUTIVO DE", { x: 0.5, y: 2.4, w: 12, h: 0.6, fontSize: 22, color: "FFFFFF", fontFace: "Calibri", bold: true });
  s.addText("AUDITORIA OPERACIONAL E DE CONFORMIDADE", { x: 0.5, y: 3.0, w: 12, h: 0.7, fontSize: 30, color: GOLD, bold: true, fontFace: "Calibri" });
  s.addText(d.emp.nome, { x: 0.5, y: 4.3, w: 12, h: 0.8, fontSize: 40, bold: true, color: "FFFFFF", fontFace: "Calibri" });
  s.addText(`${params.tipoAuditoria}  ·  Período ${params.periodoLabel}  ·  Emitido em ${new Date(d.emittedAt).toLocaleDateString("pt-BR")}`,
    { x: 0.5, y: 5.1, w: 12, h: 0.4, fontSize: 13, color: LIGHT, fontFace: "Calibri" });
  s.addText(`Código do relatório: ${d.reportCode}`, { x: 0.5, y: 6.6, w: 12, h: 0.3, fontSize: 11, color: GOLD, fontFace: "Calibri" });

  const titleSlide = (n2: number, title: string) => {
    const sl = p.addSlide();
    sl.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: NAVY } });
    sl.addShape("rect", { x: 0, y: 0.5, w: 13.33, h: 0.05, fill: { color: GOLD } });
    sl.addText(`${n2}. ${title}`, { x: 0.4, y: 0.06, w: 12, h: 0.4, fontSize: 15, bold: true, color: "FFFFFF", fontFace: "Calibri" });
    return sl;
  };

  // 2 Resumo Executivo
  s = titleSlide(2, "Resumo Executivo");
  const colors: Record<string, string> = { Excelente: GREEN, Adequado: BLUE, "Atenção": ORANGE, "Crítico": RED };
  s.addShape("rect", { x: 0.5, y: 1, w: 4, h: 5.5, fill: { color: LIGHT }, line: { color: NAVY, width: 0.5 } });
  s.addText("SCORE OPERACIONAL", { x: 0.7, y: 1.2, w: 3.6, h: 0.3, fontSize: 11, color: MUTED, bold: true });
  s.addText(`${d.kpi.score}%`, { x: 0.7, y: 1.7, w: 3.6, h: 1.6, fontSize: 90, bold: true, color: NAVY, align: "center" });
  s.addText(d.kpi.classificacao, { x: 0.7, y: 3.5, w: 3.6, h: 0.6, fontSize: 24, bold: true, color: colors[d.kpi.classificacao], align: "center" });
  s.addText("Faixas: ≥90 Excelente · ≥75 Adequado · ≥60 Atenção · <60 Crítico", { x: 0.7, y: 5.9, w: 3.6, h: 0.4, fontSize: 9, color: MUTED, align: "center", italic: true });
  const cards = [
    ["Itens auditados", d.kpi.total, NAVY], ["Conformes", d.kpi.conformes, GREEN], ["NCs", d.kpi.nc, RED],
    ["Críticos", d.kpi.criticos, RED], ["Vencidos", d.kpi.vencidos, ORANGE], ["Reincidências", d.kpi.reincidencias, ORANGE],
    ["Cobertura", `${d.amostragem.cobertura}%`, BLUE], ["SLA médio", `${d.kpi.slaMedio}d`, BLUE], ["Evidências", d.amostragem.evidencias, GOLD],
  ];
  cards.forEach((c, i) => {
    const x = 5 + (i % 3) * 2.7, y = 1 + Math.floor(i / 3) * 1.85;
    s.addShape("rect", { x, y, w: 2.5, h: 1.65, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 0.75 } });
    s.addShape("rect", { x, y, w: 0.08, h: 1.65, fill: { color: c[2] as string } });
    s.addText(String(c[0]), { x: x + 0.15, y: y + 0.1, w: 2.2, h: 0.3, fontSize: 9, color: MUTED, bold: true });
    s.addText(String(c[1]), { x: x + 0.15, y: y + 0.5, w: 2.2, h: 1, fontSize: 32, bold: true, color: NAVY });
  });
  addFooter(s, 2);

  // 3 Conformidade por disciplina
  s = titleSlide(3, "Conformidade por Disciplina");
  s.addChart(p.ChartType.bar, [{
    name: "Conformidade (%)",
    labels: d.byCat.map(b => `${b.cat.codigo}`),
    values: d.byCat.map(b => b.conformidade),
  }], {
    x: 0.5, y: 1, w: 12.3, h: 5.5, chartColors: [NAVY], catAxisLabelFontSize: 10,
    showValue: true, dataLabelFontSize: 9, valAxisMaxVal: 100,
    showTitle: true, title: "Conformidade por disciplina (%)", titleFontSize: 12,
  });
  addFooter(s, 3);

  // 4 Distribuição
  s = titleSlide(4, "Distribuição de Status");
  s.addChart(p.ChartType.doughnut, [{
    name: "Status",
    labels: ["Conforme", "Parcial", "Pendente", "Não Conforme"],
    values: [d.kpi.conformes, d.kpi.parcial, d.kpi.pendente, d.kpi.nc],
  }], { x: 0.5, y: 1, w: 6, h: 5.5, chartColors: [GREEN, ORANGE, MUTED, RED], showLegend: true, legendPos: "r" });
  s.addText("Visão de Risco por Disciplina", { x: 7, y: 1, w: 5.8, h: 0.4, fontSize: 13, bold: true, color: NAVY });
  const rows: PptxGenJS.TableRow[] = [
    [{ text: "Disciplina", options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } }, { text: "Risco", options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } }],
    ...d.byCat.map(b => [{ text: b.cat.nome }, { text: b.risco, options: { color: "FFFFFF", fill: { color: b.risco === "Crítico" ? RED : b.risco === "Alto" ? ORANGE : b.risco === "Médio" ? "B59A1C" : GREEN } } }]),
  ];
  s.addTable(rows, { x: 7, y: 1.5, w: 5.8, fontSize: 10, colW: [3.8, 2] });
  addFooter(s, 4);

  // 5 Parecer
  s = titleSlide(5, "Parecer Executivo");
  s.addText(n.parecerExecutivo, { x: 0.5, y: 1, w: 12.3, h: 6, fontSize: 13, color: "1F2937", fontFace: "Calibri", paraSpaceAfter: 6 });
  addFooter(s, 5);

  // 6 NCs críticas
  s = titleSlide(6, "Não Conformidades Críticas");
  const ncTop = d.byCat.flatMap(b => b.nclist.map(x => ({ ...x, cat: b.cat })))
    .filter(x => x.item.criticidade === "critica" || x.item.criticidade === "alta").slice(0, 12);
  const ncRows: PptxGenJS.TableRow[] = [
    ["Código", "Disciplina", "Descrição", "Criticidade"].map(t => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, fontSize: 10 } })),
    ...(ncTop.length ? ncTop.map(x => [
      { text: x.item.codigo, options: { fontSize: 9 } }, { text: x.cat.codigo, options: { fontSize: 9 } },
      { text: x.item.pergunta, options: { fontSize: 9 } },
      { text: x.item.criticidade, options: { fontSize: 9, color: "FFFFFF", fill: { color: x.item.criticidade === "critica" ? RED : ORANGE }, bold: true } },
    ]) : [[{ text: "Nenhuma NC crítica identificada", options: { colspan: 4, italic: true, color: MUTED } }]]),
  ];
  s.addTable(ncRows, { x: 0.5, y: 1, w: 12.3, colW: [1.5, 1.5, 7.3, 2] });
  addFooter(s, 6);

  // 7 Plano de ação top
  s = titleSlide(7, "Plano de Ação");
  const today = new Date().toISOString().slice(0, 10);
  const planRows: PptxGenJS.TableRow[] = [
    ["ID", "Ação", "Responsável", "Criticidade", "Prazo", "Status"].map(t => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, fontSize: 10 } })),
    ...(d.plans.slice(0, 12).map((pl, i) => {
      const venc = pl.status !== "concluido" && pl.prazo && pl.prazo < today;
      return [
        { text: String(i + 1).padStart(3, "0"), options: { fontSize: 9 } },
        { text: pl.titulo, options: { fontSize: 9 } },
        { text: pl.responsavel ?? "—", options: { fontSize: 9 } },
        { text: pl.prioridade, options: { fontSize: 9, color: "FFFFFF", fill: { color: pl.prioridade === "critica" ? RED : pl.prioridade === "alta" ? ORANGE : pl.prioridade === "media" ? "B59A1C" : BLUE } } },
        { text: pl.prazo ?? "—", options: { fontSize: 9, color: venc ? RED : "111827", bold: !!venc } },
        { text: pl.status, options: { fontSize: 9 } },
      ];
    })),
  ];
  if (d.plans.length === 0) planRows.push([{ text: "Nenhum plano ativo", options: { colspan: 6, italic: true, color: MUTED } }]);
  s.addTable(planRows, { x: 0.5, y: 1, w: 12.3, colW: [0.8, 5.3, 1.8, 1.5, 1.4, 1.5] });
  addFooter(s, 7);

  // 8 Conclusão
  s = titleSlide(8, "Conclusão Executiva");
  s.addText(n.conclusao, { x: 0.5, y: 1, w: 12.3, h: 3, fontSize: 13, color: "1F2937", fontFace: "Calibri", paraSpaceAfter: 6 });
  s.addText("Recomendações estratégicas", { x: 0.5, y: 4.1, w: 12.3, h: 0.4, fontSize: 13, bold: true, color: NAVY });
  s.addText(n.recomendacoes, { x: 0.5, y: 4.5, w: 12.3, h: 2.5, fontSize: 11, color: "1F2937", fontFace: "Calibri", paraSpaceAfter: 4 });
  addFooter(s, 8);

  // 9 Evolução histórica
  s = titleSlide(9, "Evolução Histórica (últimos 6 meses)");
  s.addChart(p.ChartType.line, [{
    name: "Score operacional (%)",
    labels: d.historico.map(h => h.label),
    values: d.historico.map(h => h.score),
  }], {
    x: 0.5, y: 1, w: 8, h: 5.5, chartColors: [NAVY], lineSize: 3, lineDataSymbol: "circle",
    valAxisMaxVal: 100, valAxisMinVal: 0, showValue: true, dataLabelFontSize: 9,
    showTitle: true, title: "Score operacional mensal (%)", titleFontSize: 12,
  });
  const histRows: PptxGenJS.TableRow[] = [
    ["Mês", "Itens", "NCs", "Score"].map(t => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, fontSize: 10 } })),
    ...d.historico.map(h => [
      { text: h.label, options: { fontSize: 10 } },
      { text: String(h.total), options: { fontSize: 10 } },
      { text: String(h.nc), options: { fontSize: 10, color: h.nc > 0 ? RED : "111827" } },
      { text: `${h.score}%`, options: { fontSize: 10, bold: true, color: h.score >= 75 ? GREEN : h.score >= 60 ? ORANGE : RED } },
    ]),
  ];
  s.addTable(histRows, { x: 8.8, y: 1, w: 4.2, colW: [1.2, 1, 1, 1] });
  addFooter(s, 9);

  const buf = (await p.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

/* ------------------------- Word ------------------------- */
function tRun(text: string, opts: any = {}) { return new TextRun({ text, font: "Calibri", ...opts }); }
function tParagraph(text: string, opts: any = {}) {
  return new Paragraph({ children: [tRun(text, opts.run)], ...opts });
}
function tCell(text: string, opts: { bold?: boolean; color?: string; bg?: string; w: number }) {
  return new TableCell({
    width: { size: opts.w, type: WidthType.DXA },
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [tRun(text, { bold: opts.bold, color: opts.color, size: 18 })] })],
  });
}
function tTable(headers: string[], rows: Array<Array<string | { text: string; bg?: string; color?: string }>>, widths: number[]) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => tCell(h, { bold: true, color: "FFFFFF", bg: "0F1B3D", w: widths[i] })),
      }),
      ...rows.map((r, ri) => new TableRow({
        children: r.map((cell, i) => {
          const obj = typeof cell === "string" ? { text: cell } : cell;
          return tCell(obj.text, { bg: obj.bg ?? (ri % 2 ? "F5F7FA" : undefined), color: obj.color, w: widths[i] });
        }),
      })),
    ],
  });
}
function h(text: string, level: typeof HeadingLevel.HEADING_1, num?: string) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [
      ...(num ? [tRun(num + " ", { bold: true, color: "C9A84C", size: 26 })] : []),
      tRun(text.toUpperCase(), { bold: true, color: "0F1B3D", size: 26 }),
    ],
  });
}
function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 80 },
    children: [tRun(text, { bold: true, color: "1B2E5C", size: 22 })],
  });
}
function p(text: string, italic = false) {
  return new Paragraph({
    spacing: { after: 120, line: 320 }, alignment: AlignmentType.JUSTIFIED,
    children: text.split("\n").map(line => tRun(line + " ", { italic, size: 20, color: "1F2937" })),
  });
}
const cCrit = (c: string) => c === "critica" ? "C72129" : c === "alta" ? "E07D21" : c === "media" ? "B59A1C" : "335FC6";
const cRisk = (r: string) => r === "Crítico" ? "C72129" : r === "Alto" ? "E07D21" : r === "Médio" ? "B59A1C" : "2A8C52";

export async function buildWord(d: ReportData, n: Narrative, params: ReportParams): Promise<Blob> {
  const today = new Date().toISOString().slice(0, 10);
  const children: (Paragraph | Table)[] = [];

  // Cover
  children.push(
    new Paragraph({ spacing: { before: 0, after: 80 }, children: [tRun(params.classificacao, { bold: true, color: "C9A84C", size: 20 })] }),
    new Paragraph({ spacing: { after: 100 }, children: [tRun(params.tipoAuditoria.toUpperCase(), { bold: true, color: "6B7280", size: 18 })] }),
    new Paragraph({ spacing: { after: 200 }, children: [tRun("RELATÓRIO EXECUTIVO DE AUDITORIA OPERACIONAL E DE CONFORMIDADE", { bold: true, color: "0F1B3D", size: 36 })] }),
    new Paragraph({ spacing: { after: 80 }, children: [tRun(d.emp.nome, { bold: true, color: "0F1B3D", size: 48 })] }),
    new Paragraph({ spacing: { after: 400 }, children: [tRun(`Código: ${d.emp.codigo}${d.emp.cidade ? " · " + d.emp.cidade : ""}`, { color: "6B7280", size: 20 })] }),
  );
  children.push(tTable(
    ["Campo", "Conteúdo"],
    [
      ["Cliente", d.emp.nome], ["Administradora", "RPS — Real Property Services"],
      ["Tipo de auditoria", params.tipoAuditoria], ["Período auditado", params.periodoLabel],
      ["Data de emissão", new Date(d.emittedAt).toLocaleDateString("pt-BR")],
      ["Código do relatório", d.reportCode], ["Versão", "1.0"],
      ["Responsável técnico", params.responsavelTecnico], ["Auditor responsável", params.auditorResponsavel],
      ["Classificação", params.classificacao],
    ],
    [3000, 6360]
  ));

  // 2 Folha de controle
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Folha de Controle", HeadingLevel.HEADING_1, "2."));
  children.push(p("Documento submetido aos processos de revisão técnica e aprovação interna. As alterações são rastreadas pelo controle de versão indicado."));
  children.push(h2("Histórico de revisões"));
  children.push(tTable(["Versão", "Data", "Autor", "Descrição"],
    [["1.0", new Date(d.emittedAt).toLocaleDateString("pt-BR"), params.auditorResponsavel, "Emissão inicial"]],
    [1100, 1600, 3000, 3660]));
  children.push(h2("Aprovações"));
  children.push(tTable(["Função", "Responsável", "Data", "Assinatura"],
    [
      ["Auditor responsável", params.auditorResponsavel, "", ""],
      ["Responsável técnico", params.responsavelTecnico, "", ""],
      ["Diretoria RPS", "", "", ""], ["Cliente / representante", "", "", ""],
      ["Ciência da gestão local", "", "", ""],
    ],
    [2400, 3000, 2000, 1960]));

  // 3 Sumário (lista simples — Word vai gerar TOC ao abrir se necessário)
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Sumário", HeadingLevel.HEADING_1, "3."));
  ["1. Capa","2. Folha de controle","3. Sumário","4. Introdução","5. Metodologia",
   "6. Disciplinas auditadas","7. Amostragem","8. Resumo executivo",
   "9. Análise por disciplina","10. Não conformidades","11. Análise de riscos",
   "12. Reincidências","13. Desempenho da gestão","14. Plano de ação",
   "15. Conclusão","16. Assinaturas","17. Anexos"].forEach(t =>
    children.push(new Paragraph({ spacing: { after: 40 }, children: [tRun(t, { size: 20 })] })));

  // 4 Introdução
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Introdução", HeadingLevel.HEADING_1, "4."));
  children.push(p(n.introducao));
  children.push(h2("Premissas e limitações"));
  children.push(p("A presente avaliação baseia-se em evidências amostrais coletadas no período auditado, considerando documentação fornecida, inspeções in loco e entrevistas. Eventuais não conformidades não identificadas em itens não amostrados não invalidam o parecer técnico, dado o caráter representativo da amostragem adotada.", true));

  // 5 Metodologia
  children.push(h("Metodologia de Auditoria", HeadingLevel.HEADING_1, "5."));
  children.push(p(n.metodologia));
  children.push(h2("Critérios de classificação"));
  children.push(tTable(["Status", "Pontuação", "Significado"],
    [
      [{ text: "Conforme", color: "2A8C52" }, "100", "Atende integralmente"],
      [{ text: "Parcial",  color: "E07D21" }, "50",  "Atende parcialmente"],
      [{ text: "Pendente", color: "6B7280" }, "25",  "Em verificação"],
      [{ text: "Não Conforme", color: "C72129" }, "0", "Não atende — gera plano"],
      [{ text: "Não Aplicável", color: "6B7280" }, "—", "Não pertinente"],
    ], [2200, 1400, 5860]));

  // 6 Disciplinas
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Disciplinas Auditadas", HeadingLevel.HEADING_1, "6."));
  children.push(tTable(["Disciplina", "Itens", "Conformidade", "Risco", "NCs"],
    d.byCat.map(b => [
      `${b.cat.codigo} — ${b.cat.nome}`, String(b.total),
      { text: `${b.conformidade}%`, color: b.conformidade >= 90 ? "2A8C52" : b.conformidade >= 75 ? "335FC6" : b.conformidade >= 60 ? "E07D21" : "C72129" },
      { text: b.risco, color: cRisk(b.risco) }, String(b.nc),
    ]), [4000, 1200, 1900, 1500, 860]));

  // 7 Amostragem
  children.push(h("Amostragem", HeadingLevel.HEADING_1, "7."));
  children.push(p(`A auditoria avaliou ${d.amostragem.auditado} itens (cobertura de ${d.amostragem.cobertura}% sobre o universo de ${d.amostragem.universo} itens auditáveis), com coleta de ${d.amostragem.evidencias} evidências documentais e fotográficas. A amostragem priorizou itens de criticidade alta e crítica.`));

  // 8 Resumo executivo
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Resumo Executivo", HeadingLevel.HEADING_1, "8."));
  children.push(new Paragraph({ spacing: { after: 200 }, children: [
    tRun(`Score operacional: `, { bold: true, size: 22 }),
    tRun(`${d.kpi.score}%  `, { bold: true, color: "0F1B3D", size: 40 }),
    tRun(d.kpi.classificacao, { bold: true, color: cRisk(d.kpi.classificacao === "Excelente" ? "Baixo" : d.kpi.classificacao === "Adequado" ? "Médio" : d.kpi.classificacao === "Atenção" ? "Alto" : "Crítico"), size: 28 }),
  ]}));
  children.push(tTable(["Indicador", "Valor"],
    [
      ["Itens auditados", String(d.kpi.total)], ["Conformes", String(d.kpi.conformes)],
      ["Não Conformes", String(d.kpi.nc)], ["Parciais", String(d.kpi.parcial)],
      ["Pendentes", String(d.kpi.pendente)], ["Críticos abertos", String(d.kpi.criticos)],
      ["Planos vencidos", String(d.kpi.vencidos)], ["Reincidências", String(d.kpi.reincidencias)],
      ["SLA médio (dias)", String(d.kpi.slaMedio)], ["Índice de risco", String(d.kpi.riscoIndex)],
    ], [5000, 4360]));

  // 9 Análise por disciplina
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Análise Analítica das Disciplinas", HeadingLevel.HEADING_1, "9."));
  d.byCat.forEach(b => {
    children.push(h2(`${b.cat.codigo} — ${b.cat.nome}  ·  Conformidade ${b.conformidade}%  ·  Risco ${b.risco}`));
    children.push(p(n.disciplinas[b.cat.codigo] ?? "Comentário técnico em elaboração."));
    if (b.nclist.length) children.push(tTable(["Código", "Não conformidade", "Criticidade"],
      b.nclist.slice(0, 8).map(x => [x.item.codigo, x.item.pergunta, { text: x.item.criticidade, color: cCrit(x.item.criticidade) }]),
      [1100, 6700, 1560]));
  });

  // 10 NCs
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Não Conformidades", HeadingLevel.HEADING_1, "10."));
  const allNc = d.byCat.flatMap(b => b.nclist.map(x => ({ ...x, cat: b.cat })));
  if (allNc.length === 0) children.push(p("Nenhuma não conformidade identificada no período auditado."));
  else children.push(tTable(["Código", "Disciplina", "Descrição", "Criticidade", "Responsável", "Prazo"],
    allNc.map(x => [x.item.codigo, x.cat.codigo, x.item.pergunta,
      { text: x.item.criticidade, bg: cCrit(x.item.criticidade), color: "FFFFFF" },
      x.answer.responsavel ?? "—", x.answer.prazo ?? "—"]),
    [1000, 1100, 4200, 1400, 1100, 960]));

  // 11 Riscos
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Análise de Riscos", HeadingLevel.HEADING_1, "11."));
  children.push(p(`Matriz 5×5 (probabilidade × impacto) — total de planos de ação ativos: ${d.plans.filter(x => x.status !== "concluido").length}. Índice consolidado de risco operacional: ${d.kpi.riscoIndex}.`));
  const matRows: any[][] = [["P\\I", "1", "2", "3", "4", "5"], ...d.riskMatrix.map((row, i) => [String(i + 1), ...row.map(v => String(v))])];
  children.push(tTable(matRows[0], matRows.slice(1), [800, 1700, 1700, 1700, 1700, 1760]));

  // 12 Reincidências
  children.push(h("Reincidências", HeadingLevel.HEADING_1, "12."));
  if (d.reincidencias.length === 0) children.push(p("Nenhum item reincidente identificado."));
  else children.push(tTable(["Código", "Disciplina", "Item", "Ocorrências", "Última"],
    d.reincidencias.map(r => [r.item.codigo, r.cat.codigo, r.item.pergunta,
      { text: `${r.qtd}x`, color: "C72129" }, r.ultima.slice(0,10)]),
    [1000, 1100, 5500, 1100, 1060]));

  // 13 Gestão
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Desempenho da Gestão", HeadingLevel.HEADING_1, "13."));
  const avg = (codes: string[]) => {
    const list = d.byCat.filter(b => codes.includes(b.cat.codigo));
    return list.length ? Math.round(list.reduce((s, b) => s + b.conformidade, 0) / list.length) : d.kpi.score;
  };
  children.push(tTable(["Dimensão", "Score"],
    [
      ["Organização operacional", `${avg(["OPE","MAN"])}%`],
      ["Controle documental", `${avg(["DOC","COM"])}%`],
      ["Gestão financeira", `${avg(["FIN"])}%`],
      ["Gestão de contratos", `${avg(["CON"])}%`],
      ["Controle de fornecedores", `${avg(["PRE","FOR"])}%`],
      ["Governança & compliance", `${avg(["GOV","COM"])}%`],
      ["Capacidade de resposta", `${Math.max(0, 100 - d.kpi.slaMedio * 2)}%`],
      ["Controle de riscos", `${Math.max(0, 100 - d.kpi.riscoIndex)}%`],
      ["Maturidade geral", `${d.kpi.score}%`],
    ], [6000, 3360]));

  // 14 Plano de ação
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Plano de Ação", HeadingLevel.HEADING_1, "14."));
  children.push(p("SLA: Crítica 48h · Alta 5 dias · Média 15 dias · Baixa 30 dias. Itens vencidos destacados em vermelho.", true));
  if (d.plans.length === 0) children.push(p("Nenhum plano de ação ativo no momento."));
  else children.push(tTable(["ID", "Ação corretiva", "Responsável", "Criticidade", "Prazo", "Status"],
    d.plans.map((pl, i) => {
      const venc = pl.status !== "concluido" && pl.prazo && pl.prazo < today;
      return [
        String(i + 1).padStart(3, "0"), pl.titulo, pl.responsavel ?? "—",
        { text: pl.prioridade, color: cCrit(pl.prioridade) },
        { text: pl.prazo ?? "—", color: venc ? "C72129" : "1F2937", bg: venc ? "FEE2E2" : undefined },
        { text: pl.status, color: pl.status === "concluido" ? "2A8C52" : venc ? "C72129" : "1F2937" },
      ];
    }),
    [700, 3800, 1600, 1300, 1100, 860]));

  // 15 Conclusão
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Conclusão Executiva", HeadingLevel.HEADING_1, "15."));
  children.push(p(n.parecerExecutivo));
  children.push(p(n.conclusao));
  children.push(h2("Recomendações estratégicas"));
  children.push(p(n.recomendacoes));

  // 16 Assinaturas
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Assinaturas", HeadingLevel.HEADING_1, "16."));
  ["Auditor responsável: " + params.auditorResponsavel,
   "Responsável técnico: " + params.responsavelTecnico,
   "Diretoria RPS",
   "Cliente / representante",
   "Ciência da gestão local"].forEach(label => {
    children.push(new Paragraph({ spacing: { before: 360 }, children: [tRun("_____________________________________________", { color: "0F1B3D" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [tRun(label, { bold: true, color: "0F1B3D", size: 20 })] }));
   });

  // 17 Anexos
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(h("Anexos", HeadingLevel.HEADING_1, "17."));
  children.push(p("Os anexos estão armazenados no Sistema RPS de Auditoria Operacional e compreendem evidências fotográficas, planilhas analíticas, checklists completos, logs de tratativas e relatórios complementares."));
  children.push(p(`Total de evidências registradas no período: ${d.evidencesCount}.`, true));

  // Evolução histórica (Anexo de série temporal)
  children.push(h2("Evolução histórica (últimos 6 meses)"));
  children.push(tTable(["Mês", "Itens auditados", "NCs", "Score"],
    d.historico.map(hh => [
      hh.label, String(hh.total), String(hh.nc),
      { text: `${hh.score}%`, color: hh.score >= 75 ? "2A8C52" : hh.score >= 60 ? "E07D21" : "C72129" },
    ]),
    [2000, 3000, 2000, 2360]));

  const doc = new Document({
    creator: "RPS — Auditoria Operacional",
    title: `Relatório Executivo ${d.emp.codigo} ${params.periodoLabel}`,
    styles: {
      default: { document: { run: { font: "Calibri", size: 20 } } },
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } } },
      headers: { default: new Header({ children: [ new Paragraph({
        children: [
          ...(await (async () => {
            const lg = await getLogo();
            return lg ? [new ImageRun({
              type: "png",
              data: lg.bytes,
              transformation: { width: 80, height: 40 },
              altText: { title: "RPS", description: "Logo RPS", name: "logo-rps" },
            })] : [];
          })()),
          tRun("   Auditoria Operacional e de Conformidade", { bold: true, color: "0F1B3D", size: 16 }),
          tRun(`    ${d.reportCode}`, { color: "6B7280", size: 16 }),
        ],
      })] }) },
      footers: { default: new Footer({ children: [ new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          tRun(`CONFIDENCIAL — USO INTERNO  ·  ${d.emp.codigo} ${d.emp.nome}  ·  Página `, { size: 14, color: "6B7280" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "6B7280" }),
        ],
      })] }) },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  return blob;
}

/* ------------------------- Trigger download ------------------------- */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}