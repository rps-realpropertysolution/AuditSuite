/**
 * Confere os relatórios existentes no banco — somente leitura.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npx vite-node --config scripts/vite-node.config.ts scripts/rgm/conferir.ts
 *
 * Para cada relatório: versão do dado, preenchimento, índice, consistência dos
 * totais e — se o empreendimento tem código do LiveFacilities — a comparação do
 * financeiro com o sistema na mesma competência financeira.
 */

import { createClient } from "@supabase/supabase-js";
import { criarClienteLF } from "../../supabase/functions/_shared/livefacilities/cliente.ts";
import { importarCompetencia } from "../../supabase/functions/_shared/livefacilities/importar.ts";
import { normalizarDados } from "../../src/lib/defaults";
import {
  calcularIndiceExecutivo,
  competenciaFinanceira,
  despesaTotal,
  inadimplenciaTotal,
  percentualPreenchido,
  receitaTotal,
  saldoTotal,
} from "../../src/lib/metrics";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const lf = process.env.LF_USUARIO ? criarClienteLF({ usuario: process.env.LF_USUARIO, senha: process.env.LF_SENHA! }) : null;

const { data, error } = await sb
  .from("relatorios")
  .select("id, competencia, status, dados, indice_executivo, empreendimento:empreendimentos(nome, ativo, lf_cd_condominio, lf_id_empreendimento)")
  .order("competencia");
if (error) throw error;

const mil = (v: number) => `${(v / 1000).toFixed(1)}k`;
const linhas: Record<string, unknown>[] = [];

for (const r of data ?? []) {
  const emp = r.empreendimento as unknown as { nome: string; ativo: boolean; lf_cd_condominio: string | null; lf_id_empreendimento: number | null };
  const bruto = r.dados as { versao?: number };
  const d = normalizarDados(r.dados);
  const problemas: string[] = [];

  if ((bruto?.versao ?? 0) < 5) problemas.push(`dado v${bruto?.versao ?? "?"} (migrado na leitura)`);
  const indice = calcularIndiceExecutivo(d);
  if (r.indice_executivo !== indice) problemas.push(`índice gravado ${r.indice_executivo} ≠ recalculado ${indice}`);
  if (d.financeiro.fundos.some((f) => !f.fundo.trim())) problemas.push("fundo sem nome");
  if (d.juridico.inadimplencia.rubricas.some((x) => x.recebido > x.ateAnterior + 0.01)) problemas.push("recebido maior que a posição anterior");
  if (inadimplenciaTotal(d) < 0) problemas.push("inadimplência negativa");
  if (d.financeiro.grupos.some((g) => g.orcado > 0 && g.realizado > g.orcado * 1.15 && !g.observacao.trim())) problemas.push("desvio > 15% sem justificativa");
  if (r.status === "publicado" && percentualPreenchido(d) < 50) problemas.push("publicado com menos de 50% preenchido");

  let comparacao = "";
  if (lf && emp.lf_cd_condominio && receitaTotal(d) + despesaTotal(d) > 0) {
    // O relatório antigo trazia o financeiro do PRÓPRIO mês; testamos os dois
    const candidatos = [r.competencia as string, competenciaFinanceira({ competencia: r.competencia as string, dados: d })];
    for (const c of [...new Set(candidatos)]) {
      const lfR = await importarCompetencia(lf, { idEmpreendimento: emp.lf_id_empreendimento, cdCondominio: emp.lf_cd_condominio, competencia: r.competencia as string, competenciaFinanceira: c });
      const f = lfR.dados.financeiro;
      if (!f) continue;
      const bate = Math.abs(f.creditos - receitaTotal(d)) < 1 && Math.abs(f.debitos - despesaTotal(d)) < 1;
      comparacao += `${c.slice(0, 7)}: LF cred ${mil(f.creditos)} deb ${mil(f.debitos)} saldo ${mil(f.saldoAtual)}${bate ? " ✓" : ""}; `;
    }
  }

  linhas.push({
    empreendimento: emp.nome.slice(0, 26) + (emp.ativo ? "" : " (arquivado)"),
    competencia: (r.competencia as string).slice(0, 7),
    status: r.status,
    preench: `${percentualPreenchido(d)}%`,
    indice,
    rgm: receitaTotal(d) + despesaTotal(d) ? `cred ${mil(receitaTotal(d))} deb ${mil(despesaTotal(d))} saldo ${mil(saldoTotal(d))}` : "sem financeiro",
    problemas: problemas.join("; ") || "ok",
    livefacilities: comparacao,
  });
}

for (const l of linhas) console.log(JSON.stringify(l));
