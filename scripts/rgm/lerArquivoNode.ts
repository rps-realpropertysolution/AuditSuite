/** Leitura de PDF/Excel no Node — mesmo formato que o editor produz no navegador. */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import readXlsxFile from "read-excel-file/node";
import { linhasDoPdf } from "@/lib/relatoriosSistema/linhas";
import type { ArquivoLido } from "@/lib/relatoriosSistema/tipos";

/** Páginas de texto lidas por arquivo — os relatórios cabem em poucas páginas. */
const MAX_PAGINAS = 8;

/** PDF já em memória (ex.: anexo baixado da API). */
export const lerPdfBytes = async (nome: string, dados: Uint8Array): Promise<ArquivoLido> => {
  const pdf = await getDocument({ data: dados, isEvalSupported: false, verbosity: 0 }).promise;
  const paginas: string[][] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, MAX_PAGINAS); i++) {
    const pagina = await pdf.getPage(i);
    const conteudo = await pagina.getTextContent();
    paginas.push(linhasDoPdf(conteudo.items as never));
  }
  const totalPaginas = pdf.numPages;
  await pdf.destroy();
  return { nome, tipo: "pdf", paginas: paginas.filter((p) => p.length), totalPaginas };
};

export const lerArquivoNode = async (caminho: string): Promise<ArquivoLido> => {
  const nome = basename(caminho);
  if (/\.xlsx$/i.test(nome)) {
    const linhas = (await readXlsxFile(caminho)) as unknown[][];
    return { nome, tipo: "planilha", linhas };
  }
  return lerPdfBytes(nome, new Uint8Array(await readFile(caminho)));
};
