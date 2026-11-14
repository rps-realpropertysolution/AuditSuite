/**
 * Mostra como o importador do editor enxerga um relatório exportado do
 * LiveFacilities (PDF ou Excel). Serve para depurar o reconhecimento.
 *
 *   npx vite-node -c scripts/vite-node.config.ts scripts/rgm/ler-arquivo.ts -- <arquivo> [--linhas]
 */

import { interpretarArquivo } from "@/lib/relatoriosSistema/interpretar";
import { lerArquivoNode } from "./lerArquivoNode";

const args = process.argv.slice(2).filter((a) => a !== "--");
const caminho = args.find((a) => !a.startsWith("--"));

(async () => {
  if (!caminho) throw new Error("informe o arquivo");
  const lido = await lerArquivoNode(caminho);
  if (args.includes("--linhas")) {
    if (lido.tipo === "pdf") lido.paginas.forEach((p, i) => console.log(`--- página ${i + 1}\n${p.join("\n")}`));
    else lido.linhas.slice(0, 15).forEach((l) => console.log(JSON.stringify(l)));
  }
  console.log(JSON.stringify(interpretarArquivo(lido), null, 1));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
