/**
 * Aplica relatórios exportados do LiveFacilities (PDF/Excel) a um RGM do banco
 * — o mesmo que o botão "Importar arquivos" do editor faz, para lote ou
 * para preencher pelo time de inovação.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npx vite-node -c scripts/vite-node.config.ts scripts/rgm/importar-arquivos.ts -- \
 *     --cd 1003 --competencia 2026-10 --pasta RGM-relatorios-P500-out2026 [--lf] [--gravar]
 *
 *   --lf       antes dos arquivos, importa o mês da API (como "Importar do LiveFacilities")
 *   --gravar   sem ele, só mostra o que faria
 *
 * Antes de gravar, guarda o conteúdo anterior em saida/backup/.
 */

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { criarClienteLF } from "../../supabase/functions/_shared/livefacilities/cliente.ts";
import { importarCompetencia } from "../../supabase/functions/_shared/livefacilities/importar.ts";
import { normalizarDados } from "../../src/lib/defaults";
import { aplicarImportacao } from "../../src/lib/importacao";
import { calcularIndiceExecutivo, competenciaFinanceira } from "../../src/lib/metrics";
import { interpretarArquivo } from "../../src/lib/relatoriosSistema/interpretar";
import { aplicarArquivos, type ArquivoParaAplicar } from "../../src/lib/relatoriosSistema/aplicar";
import { lerArquivoNode } from "./lerArquivoNode";

const args = process.argv.slice(2).filter((a) => a !== "--");
const valor = (nome: string) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const cd = valor("cd");
const competencia = valor("competencia");
const pasta = valor("pasta");
const gravar = args.includes("--gravar");
const comLF = args.includes("--lf");
if (!cd || !competencia || !pasta) throw new Error("uso: --cd 1003 --competencia 2026-10 --pasta <dir> [--lf] [--gravar]");

const url = process.env.VITE_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) throw new Error("Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
const sb = createClient(url, chave, { auth: { persistSession: false } });

const { data: emp, error: e1 } = await sb.from("empreendimentos").select("*").eq("lf_cd_condominio", cd).single();
if (e1 || !emp) throw new Error(`empreendimento ${cd} não encontrado: ${e1?.message}`);
const { data: rel, error: e2 } = await sb
  .from("relatorios")
  .select("*")
  .eq("empreendimento_id", emp.id)
  .eq("competencia", `${competencia}-01`)
  .single();
if (e2 || !rel) throw new Error(`RGM ${competencia} de ${emp.nome} não encontrado: ${e2?.message}`);
if (rel.status === "publicado") throw new Error("relatório publicado — reabra antes de importar");

let dados = normalizarDados(rel.dados);
const antes = rel.dados;
console.log(`${emp.nome} (${cd}) · RGM ${competencia} · ${rel.status}`);

if (comLF) {
  if (!process.env.LF_USUARIO || !process.env.LF_SENHA) throw new Error("Faltam LF_USUARIO e LF_SENHA para --lf.");
  const lf = criarClienteLF({ usuario: process.env.LF_USUARIO, senha: process.env.LF_SENHA });
  const resultado = await importarCompetencia(
    lf,
    {
      idEmpreendimento: emp.lf_id_empreendimento,
      cdCondominio: cd,
      competencia: `${competencia}-01`,
      competenciaFinanceira: dados.competenciaFinanceira || undefined,
    },
    new Date(),
  );
  const mescla = aplicarImportacao(dados, resultado);
  dados = mescla.dados;
  console.log("\nLiveFacilities (API):");
  mescla.preenchido.forEach((p) => console.log(`  ✓ ${p.rotulo}: ${p.detalhe}`));
  mescla.avisos.forEach((a) => console.log(`  ! ${a}`));
}

const lista = readdirSync(pasta).filter((n) => /\.(pdf|xlsx)$/i.test(n));
const arquivos: ArquivoParaAplicar[] = [];
console.log("\nArquivos:");
for (const nome of lista) {
  // a Prestação de Contas Operacional é das fotos — escolhidas no editor
  if (/presta.*operacional|fotos/i.test(nome)) {
    console.log(`  – ${nome}: fotos são escolhidas no editor (seção Evidências)`);
    continue;
  }
  const r = interpretarArquivo(await lerArquivoNode(join(pasta, nome)));
  if ("erro" in r) console.log(`  ✗ ${nome}: ${r.erro}`);
  else arquivos.push({ nome, relatorio: r.relatorio });
}

const resultado = aplicarArquivos(dados, arquivos, {
  competencia: `${competencia}-01`,
  competenciaFinanceira: competenciaFinanceira({ competencia: `${competencia}-01`, dados }),
  cdCondominio: cd,
});
resultado.preenchido.forEach((p) => console.log(`  ✓ ${p.rotulo}: ${p.detalhe}`));
resultado.recusados.forEach((r) => console.log(`  ✗ ${r.nome}: ${r.motivo}`));
resultado.avisos.forEach((a) => console.log(`  ! ${a}`));
dados = resultado.dados;

if (!gravar) {
  console.log("\n(simulação — rode com --gravar para salvar)");
  process.exit(0);
}

const pastaBackup = join("scripts", "livefacilities", "saida", "backup");
mkdirSync(pastaBackup, { recursive: true });
const arquivoBackup = join(pastaBackup, `${cd}-${competencia}-${Date.now()}.json`);
writeFileSync(arquivoBackup, JSON.stringify({ id: rel.id, dados: antes }, null, 1));

const { error: e3 } = await sb
  .from("relatorios")
  .update({ dados, indice_executivo: calcularIndiceExecutivo(dados) })
  .eq("id", rel.id);
if (e3) throw new Error(`falha ao gravar: ${e3.message}`);
console.log(`\nGravado. Conteúdo anterior em ${arquivoBackup}`);
