/**
 * Teste local da integração com o LiveFacilities — roda na máquina do time.
 *
 *   npm run lf:testar -- --id 231 --cd 0231 --competencia 2026-10 [--financeiro 2026-09]
 *
 * Lê LF_USUARIO e LF_SENHA do arquivo .env (nunca do código, nunca do chat).
 * Faz SOMENTE consultas (o cliente recusa qualquer rota que grave) e:
 *   1. imprime o resumo do que o RGM receberia;
 *   2. salva as respostas brutas em scripts/livefacilities/saida/ (fora do
 *      Git — contém dados de cliente) para ajustar os mapeamentos.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { criarClienteLF } from "../../supabase/functions/_shared/livefacilities/cliente.ts";
import { importarCompetencia } from "../../supabase/functions/_shared/livefacilities/importar.ts";

const argumento = (nome: string) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/** id_empreendimento é opcional: prédios só com operação no LiveFacilities não têm. */
const id = Number(argumento("id")) || null;
const cd = argumento("cd");
const competencia = argumento("competencia");
/** Mês da prestação de contas (financeiro). Padrão: mês anterior à competência. */
const financeiro = argumento("financeiro");

if (!cd || !competencia || !/^\d{4}-\d{2}$/.test(competencia) || (financeiro && !/^\d{4}-\d{2}$/.test(financeiro))) {
  console.error("Uso: npm run lf:testar -- --cd 1006 [--id 122] --competencia 2026-10 [--financeiro 2026-09]");
  process.exit(1);
}

const usuario = process.env.LF_USUARIO;
const senha = process.env.LF_SENHA;
if (!usuario || !senha) {
  console.error("Defina LF_USUARIO e LF_SENHA no arquivo .env (veja .env.example).");
  process.exit(1);
}

const pasta = join(process.cwd(), "scripts", "livefacilities", "saida", `${cd}-${competencia}`);
mkdirSync(pasta, { recursive: true });

/** fetch que grava cada resposta (menos o login) para análise. */
let contador = 0;
const fetchGravando: typeof fetch = async (entrada, init) => {
  const resp = await fetch(entrada, init);
  const url = String(entrada);
  if (url.endsWith("/Login")) return resp;
  const texto = await resp.clone().text();
  const rota = new URL(url).pathname.replace(/^\/api\//, "").replace(/\//g, "_");
  contador++;
  writeFileSync(join(pasta, `${String(contador).padStart(2, "0")}_${rota}_${resp.status}.json`), texto);
  return resp;
};

const cliente = criarClienteLF({
  usuario,
  senha,
  baseUrl: process.env.LF_BASE_URL || undefined,
  fetch: fetchGravando,
});

const inicio = Date.now();
const resultado = await importarCompetencia(cliente, {
  idEmpreendimento: id,
  cdCondominio: cd,
  competencia,
  competenciaFinanceira: financeiro,
});

console.log(
  `\nLiveFacilities · empreendimento ${id} / ${cd} · competência ${competencia} · financeiro ${resultado.dados.periodoFinanceiro.competencia.slice(0, 7)}`,
);
console.log(`(${((Date.now() - inicio) / 1000).toFixed(1)} s)\n`);
console.table(
  resultado.consultas.map((c) => ({
    consulta: c.nome,
    ok: c.ok ? "sim" : "NÃO",
    registros: c.registros ?? "",
    erro: c.erro ? c.erro.slice(0, 90) : "",
  })),
);

const d = resultado.dados;
if (d.financeiro) console.log("Fluxo de caixa:", d.financeiro);
if (d.arrecadacao) console.log("Arrecadação:", { emitido: d.arrecadacao.emitido, recebido: d.arrecadacao.recebido, conta: d.arrecadacao.contaReferencia });
if (d.despesasPorGrupo) console.log("Despesas por grupo:", d.despesasPorGrupo.slice(0, 10));
if (d.inadimplencia) console.log("Inadimplência por rubrica:", d.inadimplencia);
if (d.os) console.log("OS:", { total: d.os.total, ...d.os.situacao, resumo: d.os.resumo });
if (d.contratos) console.log(`Contratos: ${d.contratos.length}`);
if (d.documentos) console.log(`Documentos: ${d.documentos.length}`);
if (d.acordos) console.log(`Acordos: ${d.acordos.length}`);
if (resultado.avisos.length) {
  console.log("\nAvisos:");
  resultado.avisos.forEach((a) => console.log(` - ${a}`));
}
writeFileSync(join(pasta, "_resultado.json"), JSON.stringify(resultado, null, 2));
console.log(`\nRespostas brutas e resultado em: ${pasta}`);
