/**
 * Correção única: a importação antiga abria os fundos pelo fluxo de caixa da
 * API, que não diz a que fundo pertence cada recebimento. Resultado: fundos
 * com saldo negativo e o dinheiro em "Outros lançamentos" / "Saldo anterior a
 * distribuir". O TOTAL sempre conferiu com o sistema — então juntamos as
 * linhas numa única "Consolidado" (mesmo total, sem a abertura errada).
 *
 * Só toca rascunhos com essas linhas provisórias. Guarda backup antes.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npx vite-node -c scripts/vite-node.config.ts scripts/rgm/corrigir-fundos.ts -- [--gravar]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chaveNome } from "../../supabase/functions/_shared/livefacilities/mapear.ts";
import type { LinhaFundo } from "../../src/lib/types";

const gravar = process.argv.includes("--gravar");
const url = process.env.VITE_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) throw new Error("Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
const sb = createClient(url, chave, { auth: { persistSession: false } });

const PROVISORIOS = new Set(["saldo anterior a distribuir", "outros lancamentos"]);
const arred = (n: number) => Math.round(n * 100) / 100;

const { data: relatorios, error } = await sb.from("relatorios").select("id, competencia, status, dados, empreendimento:empreendimentos(nome)");
if (error) throw error;

const alvos = (relatorios ?? []).filter(
  (r) => r.status !== "publicado" && (r.dados?.financeiro?.fundos ?? []).some((f: LinhaFundo) => PROVISORIOS.has(chaveNome(f.fundo))),
);
console.log(`${alvos.length} rascunho(s) com abertura provisória de fundos (de ${relatorios?.length ?? 0}).`);

const backup: unknown[] = [];
for (const r of alvos) {
  const fundos: LinhaFundo[] = r.dados.financeiro.fundos;
  const soma = (k: keyof Omit<LinhaFundo, "id" | "fundo">) => arred(fundos.reduce((s, f) => s + (Number(f[k]) || 0), 0));
  const consolidado: LinhaFundo = { id: fundos[0].id, fundo: "Consolidado", anterior: soma("anterior"), creditos: soma("creditos"), debitos: soma("debitos") };
  const nome = (r.empreendimento as { nome?: string } | null)?.nome ?? "?";
  console.log(
    `  ${nome.padEnd(28)} ${r.competencia}  ${fundos.length} linhas → saldo ${arred(consolidado.anterior + consolidado.creditos - consolidado.debitos).toLocaleString("pt-BR")}`,
  );
  backup.push({ id: r.id, fundos });
  if (gravar) {
    const dados = { ...r.dados, financeiro: { ...r.dados.financeiro, fundos: [consolidado] } };
    const { error: e } = await sb.from("relatorios").update({ dados }).eq("id", r.id);
    if (e) throw new Error(`${nome} ${r.competencia}: ${e.message}`);
  }
}

if (gravar && backup.length) {
  const pasta = join("scripts", "livefacilities", "saida", "backup");
  mkdirSync(pasta, { recursive: true });
  const arquivo = join(pasta, `fundos-antes-da-correcao-${Date.now()}.json`);
  writeFileSync(arquivo, JSON.stringify(backup, null, 1));
  console.log(`Gravado. Linhas anteriores em ${arquivo}`);
} else if (!gravar) {
  console.log("(simulação — rode com --gravar para salvar)");
}
