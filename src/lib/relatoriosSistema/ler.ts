/**
 * Leitura dos arquivos no NAVEGADOR — nada sai da máquina do gestor além dos
 * números já interpretados (e das fotos que ele escolher).
 *
 * pdf.js e o leitor de Excel são pesados: carregam só quando o gestor importa.
 */

import { capitalizar } from "../../../supabase/functions/_shared/livefacilities/mapear.ts";
import type { Foto } from "../types";
import { decodificarTexto, ehHtml, linhasDeHtml } from "./htmlTabela";
import { linhasDoPdf } from "./linhas";
import type { ArquivoLido } from "./tipos";

const MAX_PAGINAS_TEXTO = 8;
const TAMANHO_MAX_ARQUIVO = 150 * 1024 * 1024;

const carregarPdfJs = async () => {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
};

const abrirPdf = async (arquivo: File) => {
  const pdfjs = await carregarPdfJs();
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: dados, isEvalSupported: false }).promise;
  return { pdfjs, pdf };
};

/**
 * ".xls" do LiveFacilities = página HTML com tabela (às vezes UTF-16). Vira
 * planilha sem conversão manual. Excel binário antigo (BIFF) não é lido.
 */
export const planilhaDeXls = (nome: string, bytes: Uint8Array): ArquivoLido => {
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new Error("Excel antigo (.xls binário) — abra no Excel e salve como .xlsx");
  }
  const texto = decodificarTexto(bytes);
  if (!ehHtml(texto)) throw new Error("não reconheci o conteúdo deste .xls");
  return { nome, tipo: "planilha", linhas: linhasDeHtml(texto) };
};

export const lerArquivo = async (arquivo: File): Promise<ArquivoLido> => {
  if (arquivo.size > TAMANHO_MAX_ARQUIVO) throw new Error("arquivo acima de 150 MB");
  if (/\.xlsx$/i.test(arquivo.name)) {
    const { default: readXlsxFile } = await import("read-excel-file");
    const linhas = (await readXlsxFile(arquivo)) as unknown[][];
    return { nome: arquivo.name, tipo: "planilha", linhas };
  }
  if (/\.(xls|html?)$/i.test(arquivo.name)) return planilhaDeXls(arquivo.name, new Uint8Array(await arquivo.arrayBuffer()));
  if (!/\.pdf$/i.test(arquivo.name)) throw new Error("formato não suportado — use PDF ou Excel (.xlsx ou .xls)");

  const { pdf } = await abrirPdf(arquivo);
  try {
    const paginas: string[][] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, MAX_PAGINAS_TEXTO); i++) {
      const pagina = await pdf.getPage(i);
      const conteudo = await pagina.getTextContent();
      paginas.push(linhasDoPdf(conteudo.items as never));
    }
    return { nome: arquivo.name, tipo: "pdf", paginas, totalPaginas: pdf.numPages };
  } finally {
    await pdf.destroy();
  }
};

/* -------------------------------------------------------------------------- */
/* Fotos da Prestação de Contas Operacional                                    */
/* -------------------------------------------------------------------------- */

export interface FotoExtraida {
  id: string;
  blob: Blob;
  url: string; // object URL para a miniatura
  legenda: string;
  categoria: Foto["categoria"];
  os: string;
  pagina: number;
}

/** Fotos pequenas demais são ícones e logotipos do relatório, não evidência. */
const LADO_MINIMO = 220;
const LADO_MAXIMO = 1600;

interface ImagemPdf {
  width: number;
  height: number;
  bitmap?: ImageBitmap;
  data?: Uint8ClampedArray | Uint8Array;
  kind?: number;
}

const paraCanvas = (img: ImagemPdf): HTMLCanvasElement | null => {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  if (!img.data) return null;

  // kind: 1 = 1 bit cinza, 2 = RGB 24 bits, 3 = RGBA 32 bits
  const rgba = new Uint8ClampedArray(img.width * img.height * 4);
  if (img.kind === 3) rgba.set(img.data.subarray(0, rgba.length));
  else if (img.kind === 2) {
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      rgba[i] = img.data[j];
      rgba[i + 1] = img.data[j + 1];
      rgba[i + 2] = img.data[j + 2];
      rgba[i + 3] = 255;
    }
  } else return null;

  const original = document.createElement("canvas");
  original.width = img.width;
  original.height = img.height;
  original.getContext("2d")?.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
  ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/**
 * Imagem quase lisa não é foto: o relatório desenha molduras brancas com
 * faixas escuras nas bordas. Mede a variação de brilho só no MIOLO (metade
 * central), numa miniatura 24×24.
 */
const ehLisa = (canvas: HTMLCanvasElement) => {
  const mini = document.createElement("canvas");
  mini.width = 24;
  mini.height = 24;
  const ctx = mini.getContext("2d");
  if (!ctx) return false;
  const w = canvas.width;
  const h = canvas.height;
  ctx.drawImage(canvas, w / 4, h / 4, w / 2, h / 2, 0, 0, 24, 24);
  const px = ctx.getImageData(0, 0, 24, 24).data;
  const lum: number[] = [];
  for (let i = 0; i < px.length; i += 4) lum.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
  const media = lum.reduce((s, v) => s + v, 0) / lum.length;
  const desvio = Math.sqrt(lum.reduce((s, v) => s + (v - media) ** 2, 0) / lum.length);
  return desvio < 8;
};

const jpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((ok) => canvas.toBlob((b) => ok(b), "image/jpeg", 0.85));

/**
 * Percorre o PDF da Prestação de Contas Operacional e devolve as fotos das OS
 * com o título da atividade como legenda. As fotos aparecem depois do bloco
 * da OS (às vezes na página seguinte), então a OS "corrente" atravessa páginas.
 */
export const extrairFotosPrestacao = async (
  arquivo: File,
  aoAvancar?: (pagina: number, total: number, fotos: number) => void,
  sinal?: AbortSignal,
): Promise<FotoExtraida[]> => {
  const { pdfjs, pdf } = await abrirPdf(arquivo);
  const fotos: FotoExtraida[] = [];
  let os = { numero: "", titulo: "", tipo: "" };

  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      if (sinal?.aborted) break;
      const pagina = await pdf.getPage(p);
      const linhas = linhasDoPdf((await pagina.getTextContent()).items as never);

      // OS corrente no momento em que as fotos aparecem ("FOTOS DA OS")
      const inicioFotos = linhas.findIndex((l) => /^FOTOS DA OS/i.test(l));
      const ateFotos = inicioFotos >= 0 ? linhas.slice(0, inicioFotos) : linhas;
      // Bloco da OS no PDF:  "OS PERIODICIDADE TIPO" / "63793 PONTUAL ATENDIMENTO" …
      //                      "TÍTULO ATIVIDADE" / "SDAI - CONFIGURAÇÃO …"
      const lerOS = (trecho: string[], atual: typeof os) => {
        let r = { ...atual };
        trecho.forEach((l, i) => {
          if (/^OS\s+PERIODICIDADE/i.test(l)) {
            const valores = (trecho[i + 1] ?? "").split(" ");
            r = { numero: /^\d+$/.test(valores[0] ?? "") ? valores[0] : "", titulo: "", tipo: valores[valores.length - 1] ?? "" };
          }
          const titulo = l.match(/^T[IÍ]TULO ATIVIDADE\s*(.*)$/i);
          if (titulo) r.titulo = titulo[1] || trecho[i + 1] || "";
        });
        return r;
      };
      const osDasFotos = inicioFotos >= 0 ? lerOS(ateFotos, os) : os;

      if (inicioFotos >= 0) {
        const ops = await pagina.getOperatorList();
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
          const id = ops.argsArray[i][0] as string;
          const fonte = id.startsWith("g_") ? pagina.commonObjs : pagina.objs;
          const img = await new Promise<ImagemPdf | null>((ok) => {
            try {
              fonte.get(id, (x: ImagemPdf) => ok(x));
            } catch {
              ok(null);
            }
          });
          if (!img || Math.min(img.width, img.height) < LADO_MINIMO) continue;
          const canvas = paraCanvas(img);
          if (!canvas || ehLisa(canvas)) continue;
          const blob = await jpeg(canvas);
          if (!blob) continue;
          const corretiva = /corretiv/i.test(osDasFotos.tipo);
          fotos.push({
            id: `${p}-${i}`,
            blob,
            url: URL.createObjectURL(blob),
            legenda: capitalizar(osDasFotos.titulo || `OS ${osDasFotos.numero}`),
            categoria: corretiva ? "ocorrencia" : /melhori/i.test(osDasFotos.tipo) ? "melhoria" : "manutencao",
            os: osDasFotos.numero,
            pagina: p,
          });
        }
      }

      // a OS corrente segue para a próxima página
      os = lerOS(linhas, os);
      pagina.cleanup();
      aoAvancar?.(p, pdf.numPages, fotos.length);
    }
  } finally {
    await pdf.destroy();
  }
  return fotos;
};
