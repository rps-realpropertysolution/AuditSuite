/**
 * Busca as contas de água e energia de um prédio pela API e roda o leitor —
 * o mesmo caminho da importação automática. Não grava nada.
 *
 *   npx vite-node -c scripts/vite-node.config.ts scripts/rgm/testar-faturas.ts -- --cd 1006 --competencia 2026-10
 */

import { criarClienteLF } from "../../supabase/functions/_shared/livefacilities/cliente.ts";
import { buscarFaturas } from "../../supabase/functions/_shared/livefacilities/faturas.ts";
import { interpretarArquivo } from "../../src/lib/relatoriosSistema/interpretar";
import { lerPdfBytes } from "./lerArquivoNode";

const args = process.argv.slice(2).filter((a) => a !== "--");
const valor = (n: string) => args[args.indexOf(`--${n}`) + 1];
const cd = valor("cd");
const competencia = `${valor("competencia")}-01`;

const lf = criarClienteLF({ usuario: process.env.LF_USUARIO!, senha: process.env.LF_SENHA! });
const r = await buscarFaturas(lf, cd, competencia);

console.log(`\n${cd} · consumo de ${competencia.slice(0, 7)}`);
for (const [nome, c] of Object.entries(r.custos)) {
  console.log(`custo ${nome}: ${c ? c.total.toLocaleString("pt-BR") : "—"}${c ? `  (${c.itens.map((i) => `${i.fornecedor.slice(0, 22)} ${i.valor}`).join(" + ")})` : ""}`);
}
console.log(`anexos baixados: ${r.anexos.length}`);
for (const a of r.anexos) {
  const lido = interpretarArquivo(await lerPdfBytes(a.nome, Buffer.from(a.base64, "base64")));
  const x = "relatorio" in lido ? lido.relatorio : null;
  console.log(
    `  ${a.fornecedor.slice(0, 26).padEnd(26)} venc ${a.vencimento} pago ${a.valorPago} → ` +
      (x && "consumo" in x ? `${x.concessionaria} ${x.competencia}: ${x.consumo} ${x.unidade}, fatura ${x.valor} (anterior ${x.consumoAnterior})` : `não é fatura: ${"erro" in lido ? lido.erro : x?.tipo}`),
  );
}
r.avisos.forEach((a) => console.log("  !", a));
