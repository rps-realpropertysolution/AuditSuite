/**
 * Edge Function: cria o acesso de uma pessoa (nome, e-mail e senha) sem
 * enviar e-mail — quem cria repassa a URL, o login e a senha.
 *
 * Só diretoria/administrador (a checagem usa has_role, em que administrador
 * passa). A chave de serviço (SUPABASE_SERVICE_ROLE_KEY, injetada pelo
 * Supabase) só existe aqui no servidor.
 *
 * Opcional: já concede um papel e vincula empreendimentos (síndico/proprietário).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

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

const PAPEIS = ["sindico", "proprietario", "gestor", "diretoria", "administrador"] as const;
type Papel = (typeof PAPEIS)[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro(405, "Use POST.");

  try {
    const autorizacao = req.headers.get("Authorization");
    if (!autorizacao) return erro(401, "Faça login.");
    const url = Deno.env.get("SUPABASE_URL")!;

    // quem está pedindo — com o JWT dele, pela RLS normal
    const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: autorizacao } },
      auth: { persistSession: false },
    });
    const { data: eu } = await comoUsuario.auth.getUser();
    if (!eu.user) return erro(401, "Sessão inválida. Entre de novo.");
    const { data: ehDiretoria } = await comoUsuario.rpc("has_role", { _user_id: eu.user.id, _role: "diretoria" });
    if (!ehDiretoria) return erro(403, "Somente a diretoria ou o administrador cria acessos.");
    const { data: ehAdmin } = await comoUsuario.rpc("is_administrador", { _user_id: eu.user.id });

    const corpo = (await req.json().catch(() => ({}))) as {
      nome?: string;
      email?: string;
      senha?: string;
      papel?: string;
      empreendimentos?: string[];
    };
    const nome = (corpo.nome ?? "").trim();
    const email = (corpo.email ?? "").trim().toLowerCase();
    const senha = corpo.senha ?? "";
    const papel = (PAPEIS as readonly string[]).includes(corpo.papel ?? "") ? (corpo.papel as Papel) : null;
    const empreendimentos = Array.isArray(corpo.empreendimentos) ? corpo.empreendimentos.filter((x) => typeof x === "string") : [];

    if (nome.length < 2) return erro(400, "Informe o nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro(400, "E-mail inválido.");
    if (senha.length < 8) return erro(400, "A senha precisa ter pelo menos 8 caracteres.");
    if (papel === "administrador" && !ehAdmin) return erro(403, "Só um administrador cria outro administrador.");

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    // e-mail já confirmado: a pessoa entra direto com a senha, sem e-mail de confirmação
    const { data: criado, error: e1 } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (e1 || !criado.user) {
      const jaExiste = /already|registered|exists/i.test(e1?.message ?? "");
      return erro(jaExiste ? 409 : 400, jaExiste ? "Já existe um acesso com este e-mail." : `Não foi possível criar: ${e1?.message}`);
    }
    const id = criado.user.id;

    // o gatilho do banco cria o perfil; garante o nome digitado
    await admin.from("profiles").upsert({ id, email, nome }, { onConflict: "id" });
    if (papel) await admin.from("user_roles").upsert({ user_id: id, role: papel }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (empreendimentos.length) {
      await admin
        .from("empreendimento_acessos")
        .upsert(empreendimentos.map((empreendimento_id) => ({ user_id: id, empreendimento_id })), { onConflict: "empreendimento_id,user_id", ignoreDuplicates: true });
    }

    return resposta(200, { id, email, nome, papel });
  } catch (e) {
    return erro(500, e instanceof Error ? e.message : "Falha inesperada.");
  }
});
