/**
 * Correção única: a importação antiga usava `dataFinal` (fim do registro no
 * sistema) quando o documento não tinha validade — Habite-se, convenção e
 * outros permanentes apareciam como vencidos. Busca os documentos de cada
 * prédio uma vez e corrige validade/permanente nos rascunhos, casando pelo
 * título. O que o gestor escreveu (observação) fica. Guarda backup.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npx vite-node -c scripts/vite-node.config.ts scripts/rgm/corrigir-documentos.ts -- [--gravar]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { criarClienteLF } from "../../supabase/functions/_shared/livefacilities/cliente.ts";
import { chaveNome, mapearDocumentos } from "../../supabase/functions/_shared/livefacilities/mapear.ts";
import type { DocumentoListaLF } from "../../supabase/functions/_shared/livefacilities/tipos.ts";
import type { LinhaDocumento } from "../../src/lib/types";

const gravar = process.argv.includes("--gravar");
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const lf = criarClienteLF({ usuario: process.env.LF_USUARIO!, senha: process.env.LF_SENHA! });

const { data: emps } = await sb.from("empreendimentos").select("id, nome, lf_id_empreendimento, lf_cd_condominio").not("lf_cd_condominio", "is", null);
const backup: unknown[] = [];
let corrigidos = 0;

for (const emp of emps ?? []) {
  const r = await lf.get<{ data?: DocumentoListaLF[] }>("/Documento/ListaDocumentoEmpreendimento", {
    EmprendimentoId: emp.lf_id_empreendimento ?? undefined,
    EmprendimentoCodigo: emp.lf_cd_condominio,
    DataInicio: "2000-01-01",
    DataFinal: "2040-12-31",
    DocumentoAtivo: true,
  }).catch(() => ({ data: [] }));
  const certos = new Map(mapearDocumentos(r.data ?? [], emp.lf_id_empreendimento ?? undefined).map((d) => [chaveNome(d.documento), d]));
  if (!certos.size) continue;

  const { data: rels } = await sb.from("relatorios").select("id, competencia, status, dados").eq("empreendimento_id", emp.id).neq("status", "publicado");
  let mudou = 0;
  for (const rel of rels ?? []) {
    const linhas: LinhaDocumento[] = rel.dados?.documentos?.linhas ?? [];
    const novas = linhas.map((l) => {
      const c = certos.get(chaveNome(l.documento));
      return c && (c.validade !== l.validade || Boolean(c.permanente) !== Boolean(l.permanente)) ? { ...l, validade: c.validade, permanente: c.permanente } : l;
    });
    if (novas.every((l, i) => l === linhas[i])) continue;
    mudou++;
    backup.push({ id: rel.id, documentos: linhas });
    if (gravar) {
      const dados = { ...rel.dados, documentos: { ...rel.dados.documentos, linhas: novas } };
      const { error } = await sb.from("relatorios").update({ dados }).eq("id", rel.id);
      if (error) throw new Error(`${emp.nome} ${rel.competencia}: ${error.message}`);
    }
  }
  const permanentes = [...certos.values()].filter((d) => d.permanente).length;
  console.log(`${emp.nome.padEnd(26)} ${certos.size} documentos (${permanentes} sem validade) · ${mudou} rascunho(s) a corrigir`);
  corrigidos += mudou;
}

if (gravar && backup.length) {
  const pasta = join("scripts", "livefacilities", "saida", "backup");
  mkdirSync(pasta, { recursive: true });
  const arquivo = join(pasta, `documentos-antes-da-correcao-${Date.now()}.json`);
  writeFileSync(arquivo, JSON.stringify(backup));
  console.log(`Gravado: ${corrigidos} rascunho(s). Backup em ${arquivo}`);
} else console.log(`${corrigidos} rascunho(s) a corrigir${gravar ? "" : " (simulação — use --gravar)"}`);
