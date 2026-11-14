/**
 * Edge Function: importa uma competência do LiveFacilities para o RGM.
 *
 * Por que no servidor: a senha do LiveFacilities nunca pode ir para o
 * navegador. Ela fica nos secrets do Supabase (LF_USUARIO / LF_SENHA) e só
 * esta função a usa.
 *
 * A função NÃO grava no relatório: devolve os dados e o editor mescla,
 * mostra ao gestor o que veio e o autosave salva. O gestor continua dono
 * do conteúdo.
 *
 * Deploy:
 *   supabase secrets set LF_USUARIO=... LF_SENHA=...
 *   supabase functions deploy livefacilities-importar
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { criarClienteLF } from "../_shared/livefacilities/cliente.ts";
import { importarCompetencia } from "../_shared/livefacilities/importar.ts";
import { descobrirEmpreendimentos } from "../_shared/livefacilities/empreendimentos.ts";
import { buscarFaturas } from "../_shared/livefacilities/faturas.ts";

declare const Deno: {
  env: { get(nome: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const erro = (status: number, mensagem: string) => resposta(status, { erro: mensagem });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro(405, "Use POST.");

  try {
    const autorizacao = req.headers.get("Authorization");
    if (!autorizacao) return erro(401, "Faça login no RGM.");

    // Cliente com o JWT de quem chamou: toda leitura passa pela RLS normal.
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: autorizacao } },
      auth: { persistSession: false },
    });

    const { data: usuario } = await sb.auth.getUser();
    if (!usuario.user) return erro(401, "Sessão inválida. Entre de novo.");

    const { data: papeis } = await sb.from("user_roles").select("role").eq("user_id", usuario.user.id);
    const interno = (papeis ?? []).some((p: { role: string }) => ["administrador", "diretoria", "gestor"].includes(p.role));
    if (!interno) return erro(403, "Somente o time RPS pode importar dados.");

    const corpo = (await req.json().catch(() => ({}))) as { relatorioId?: string; acao?: string };

    const usuarioLF = Deno.env.get("LF_USUARIO");
    const senhaLF = Deno.env.get("LF_SENHA");
    if (!usuarioLF || !senhaLF) {
      return erro(503, "Integração não configurada: defina LF_USUARIO e LF_SENHA nos secrets do Supabase.");
    }
    const cliente = criarClienteLF({
      usuario: usuarioLF,
      senha: senhaLF,
      baseUrl: Deno.env.get("LF_BASE_URL") || undefined,
    });

    // Lista os empreendimentos do LiveFacilities (código + id) para o cadastro.
    if (corpo.acao === "empreendimentos") {
      return resposta(200, { empreendimentos: await descobrirEmpreendimentos(cliente) });
    }

    if (!corpo.relatorioId) return erro(400, "Informe relatorioId.");

    const { data: relatorio } = await sb
      .from("relatorios")
      .select("id, competencia, status, dados->>competenciaFinanceira, empreendimento:empreendimentos(id, nome, lf_id_empreendimento, lf_cd_condominio)")
      .eq("id", corpo.relatorioId)
      .maybeSingle();

    if (!relatorio) return erro(404, "Relatório não encontrado ou sem acesso.");
    if (relatorio.status === "publicado") return erro(409, "Relatório publicado. Reabra para edição antes de importar.");

    const emp = relatorio.empreendimento as unknown as {
      nome: string;
      lf_id_empreendimento: number | null;
      lf_cd_condominio: string | null;
    } | null;

    if (!emp?.lf_cd_condominio) {
      return erro(422, `Cadastre o código do condomínio do LiveFacilities em "${emp?.nome ?? "Empreendimento"}".`);
    }

    // Contas de água e energia do mês (anexos dos pagamentos) — o leitor roda no navegador.
    if (corpo.acao === "faturas") {
      return resposta(200, await buscarFaturas(cliente, emp.lf_cd_condominio, relatorio.competencia));
    }

    const resultado = await importarCompetencia(cliente, {
      // sem id (prédio só com operação no LiveFacilities) importa OS e o que sair pelo código
      idEmpreendimento: emp.lf_id_empreendimento,
      cdCondominio: emp.lf_cd_condominio,
      competencia: relatorio.competencia,
      // Mês financeiro escolhido no editor (vazio = mês anterior, a última prestação fechada).
      competenciaFinanceira: (relatorio as { competenciaFinanceira?: string }).competenciaFinanceira || undefined,
    });

    const nenhumaOk = resultado.consultas.every((c) => !c.ok);
    if (nenhumaOk) {
      return erro(502, resultado.avisos[0] ?? "Nenhuma consulta ao LiveFacilities funcionou.");
    }

    return resposta(200, resultado);
  } catch (e) {
    return erro(500, e instanceof Error ? e.message : "Falha inesperada na importação.");
  }
});
