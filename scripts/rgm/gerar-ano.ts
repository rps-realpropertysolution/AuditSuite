/**
 * Gera os RGMs de um ano para todos os empreendimentos do LiveFacilities.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npx vite-node --config scripts/vite-node.config.ts scripts/rgm/gerar-ano.ts -- --ano 2026 --ate 10
 *
 * - Lê o LiveFacilities SOMENTE para consulta (LF_USUARIO/LF_SENHA do .env).
 * - Cadastra os empreendimentos que faltam e vincula os códigos dos existentes.
 * - Cria, como RASCUNHO, cada mês que ainda não existe — encadeado a partir do
 *   mês anterior (herança + importação), exatamente como o botão do sistema.
 * - NUNCA sobrescreve um relatório existente: se o mês já existe, ele só serve
 *   de base para o mês seguinte.
 *
 * A chave de serviço ignora a RLS: use só em máquina do time, passe por
 * variável de ambiente no momento de rodar e nunca grave em arquivo versionado.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { criarClienteLF } from "../../supabase/functions/_shared/livefacilities/cliente.ts";
import { importarCompetencia } from "../../supabase/functions/_shared/livefacilities/importar.ts";
import { descobrirEmpreendimentos } from "../../supabase/functions/_shared/livefacilities/empreendimentos.ts";
import { herdarDoMesAnterior, normalizarDados, relatorioEmBranco } from "../../src/lib/defaults";
import { aplicarImportacao } from "../../src/lib/importacao";
import { calcularIndiceExecutivo } from "../../src/lib/metrics";
import { planejarSincronizacao } from "../../src/lib/sincronizarEmpreendimentos";
import type { DadosRelatorio, Empreendimento } from "../../src/lib/types";

const arg = (nome: string, padrao?: string) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : padrao;
};
const ano = Number(arg("ano", "2026"));
const ateMes = Number(arg("ate", "10"));
// opcional: só estes códigos (ex.: --cd 1002,1003)
const apenasLista = (arg("cd", "") ?? "").split(",").filter(Boolean);
const apenas = apenasLista.length ? new Set(apenasLista) : null;
const exceto = new Set((arg("exceto", "") ?? "").split(",").filter(Boolean)); // códigos a pular
const paralelo = Number(arg("paralelo", "3"));

const url = process.env.VITE_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave || !process.env.LF_USUARIO || !process.env.LF_SENHA) {
  console.error("Faltam VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LF_USUARIO ou LF_SENHA no ambiente.");
  process.exit(1);
}

const sb = createClient(url, chave, { auth: { persistSession: false } });
const lf = criarClienteLF({ usuario: process.env.LF_USUARIO, senha: process.env.LF_SENHA });
const pasta = join(process.cwd(), "scripts", "livefacilities", "saida", `rgm-${ano}`);
mkdirSync(pasta, { recursive: true });

const comp = (m: number) => `${ano}-${String(m).padStart(2, "0")}-01`;
const log: Record<string, unknown>[] = [];

/* 1. Empreendimentos ------------------------------------------------------ */
console.log("Descobrindo empreendimentos no LiveFacilities…");
const descobertos = (await descobrirEmpreendimentos(lf)).filter((e) => !apenas || apenas.has(e.cdCondominio));
const { data: existentes, error: e1 } = await sb.from("empreendimentos").select("*");
if (e1) throw e1;

for (const acao of planejarSincronizacao((existentes ?? []) as Empreendimento[], descobertos)) {
  const codigos = { lf_cd_condominio: acao.lf.cdCondominio, lf_id_empreendimento: acao.lf.idEmpreendimento };
  if (acao.tipo === "criar") {
    const { error } = await sb.from("empreendimentos").insert({ nome: acao.lf.nome, tipo: "comercial", ...codigos });
    if (error) throw error;
    console.log(`  + cadastrado ${acao.lf.cdCondominio} ${acao.lf.nome}`);
  } else if (acao.tipo === "vincular" || acao.tipo === "completar_id") {
    const { error } = await sb.from("empreendimentos").update(codigos).eq("id", acao.emp.id);
    if (error) throw error;
    console.log(`  ↔ vinculado ${acao.emp.nome} → ${acao.lf.cdCondominio}`);
  }
}

const { data: emps, error: e2 } = await sb.from("empreendimentos").select("*").not("lf_cd_condominio", "is", null);
if (e2) throw e2;
const alvos = (emps as Empreendimento[]).filter(
  (e) => (!apenas || apenas.has(e.lf_cd_condominio ?? "")) && !exceto.has(e.lf_cd_condominio ?? ""),
);

/* 2. Relatórios mês a mês --------------------------------------------------- */
const gerarEmpreendimento = async (emp: Empreendimento) => {
  const { data: rels } = await sb
    .from("relatorios")
    .select("id, competencia, dados, status")
    .eq("empreendimento_id", emp.id)
    .gte("competencia", `${ano - 1}-12-01`)
    .lte("competencia", comp(ateMes));
  const existentes = new Map((rels ?? []).map((r) => [r.competencia as string, r]));

  // base de janeiro: dezembro do ano anterior, se existir
  let anterior: DadosRelatorio | null = existentes.has(`${ano - 1}-12-01`)
    ? normalizarDados(existentes.get(`${ano - 1}-12-01`)!.dados)
    : null;

  for (let m = 1; m <= ateMes; m++) {
    const c = comp(m);
    const ja = existentes.get(c);
    if (ja) {
      anterior = normalizarDados(ja.dados);
      log.push({ cd: emp.lf_cd_condominio, nome: emp.nome, competencia: c, resultado: `mantido (${ja.status})` });
      continue;
    }

    const base = anterior ? herdarDoMesAnterior(anterior) : relatorioEmBranco();
    const inicio = Date.now();
    try {
      const r = await importarCompetencia(lf, {
        idEmpreendimento: emp.lf_id_empreendimento,
        cdCondominio: emp.lf_cd_condominio!,
        competencia: c,
      });
      const { dados, preenchido, avisos } = aplicarImportacao(base, r);
      const { error } = await sb.from("relatorios").insert({
        empreendimento_id: emp.id,
        competencia: c,
        status: "rascunho",
        dados,
        indice_executivo: calcularIndiceExecutivo(dados),
      });
      if (error) throw error;
      writeFileSync(join(pasta, `${emp.lf_cd_condominio}-${c.slice(0, 7)}.json`), JSON.stringify({ dados, consultas: r.consultas }, null, 1));
      anterior = dados;
      const falhas = r.consultas.filter((x) => !x.ok).map((x) => x.nome);
      log.push({
        cd: emp.lf_cd_condominio,
        nome: emp.nome,
        competencia: c,
        resultado: "criado",
        blocos: preenchido.length,
        avisos: avisos.length,
        falhas: falhas.join(", "),
        segundos: Math.round((Date.now() - inicio) / 1000),
      });
      console.log(`  ✓ ${emp.lf_cd_condominio} ${emp.nome} ${c.slice(0, 7)} · ${preenchido.length} blocos${falhas.length ? ` · falhas: ${falhas.join(", ")}` : ""}`);
    } catch (e) {
      log.push({ cd: emp.lf_cd_condominio, nome: emp.nome, competencia: c, resultado: "ERRO", erro: (e as Error).message });
      console.log(`  ✗ ${emp.lf_cd_condominio} ${emp.nome} ${c.slice(0, 7)} · ${(e as Error).message}`);
      // segue para o próximo mês com a mesma base: a cadeia não para por uma falha
    }
  }
};

console.log(`\nGerando ${alvos.length} empreendimentos × ${ateMes} meses de ${ano}…`);
for (let i = 0; i < alvos.length; i += paralelo) {
  await Promise.all(alvos.slice(i, i + paralelo).map(gerarEmpreendimento));
}

writeFileSync(join(pasta, "_log.json"), JSON.stringify(log, null, 1));
const criados = log.filter((l) => l.resultado === "criado").length;
const erros = log.filter((l) => l.resultado === "ERRO").length;
console.log(`\nFim: ${criados} relatórios criados, ${log.length - criados - erros} mantidos, ${erros} com erro. Log em ${pasta}`);
