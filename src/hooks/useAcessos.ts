import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Papel } from "@/lib/types";

export interface UsuarioAcesso {
  id: string;
  email: string;
  nome: string | null;
  criadoEm: string;
  papeis: Papel[];
  empreendimentos: string[];
}

/**
 * Usuários, papéis e vínculos. A RLS só devolve tudo para o time interno;
 * gravar papéis é exclusivo da diretoria (policy "roles: gestao pela diretoria").
 */
export const useUsuarios = () =>
  useQuery({
    queryKey: ["acessos"],
    queryFn: async (): Promise<UsuarioAcesso[]> => {
      const [perfis, papeis, vinculos] = await Promise.all([
        supabase.from("profiles").select("id, email, nome, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("empreendimento_acessos").select("user_id, empreendimento_id"),
      ]);
      if (perfis.error) throw perfis.error;
      if (papeis.error) throw papeis.error;
      if (vinculos.error) throw vinculos.error;

      return (perfis.data ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        nome: p.nome,
        criadoEm: p.created_at,
        papeis: (papeis.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Papel),
        empreendimentos: (vinculos.data ?? []).filter((v) => v.user_id === p.id).map((v) => v.empreendimento_id),
      }));
    },
  });

const useMudanca = <T,>(fn: (v: T) => Promise<void>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["acessos"] }),
  });
};

export const useConcederPapel = () =>
  useMudanca(async ({ userId, papel }: { userId: string; papel: Papel }) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: papel });
    if (error && error.code !== "23505") throw error;
  });

export const useRevogarPapel = () =>
  useMudanca(async ({ userId, papel }: { userId: string; papel: Papel }) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", papel);
    if (error) throw error;
  });

export interface NovoAcesso {
  nome: string;
  email: string;
  senha: string;
  papel?: Papel | null;
  empreendimentos?: string[];
}

/**
 * Cria o login (e-mail já confirmado, sem e-mail enviado) pela Edge Function
 * `acessos-criar` — criar usuário exige a chave de serviço, que fica no servidor.
 */
export const useCriarAcesso = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novo: NovoAcesso) => {
      const { data, error } = await supabase.functions.invoke<{ id?: string; erro?: string }>("acessos-criar", { body: novo });
      if (error) {
        const contexto = (error as { context?: Response }).context;
        const corpo = contexto && typeof contexto.json === "function" ? ((await contexto.json().catch(() => null)) as { erro?: string } | null) : null;
        throw new Error(corpo?.erro ?? (/Failed to send|FunctionsFetchError/i.test(error.message) ? "O serviço de criação de acessos não respondeu." : error.message));
      }
      if (!data?.id) throw new Error(data?.erro ?? "Não foi possível criar o acesso.");
      return data.id;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["acessos"] }),
  });
};

export const useVincular = () =>
  useMudanca(async ({ userId, empreendimentoId }: { userId: string; empreendimentoId: string }) => {
    const { error } = await supabase.from("empreendimento_acessos").insert({ user_id: userId, empreendimento_id: empreendimentoId });
    if (error && error.code !== "23505") throw error;
  });

export const useDesvincular = () =>
  useMudanca(async ({ userId, empreendimentoId }: { userId: string; empreendimentoId: string }) => {
    const { error } = await supabase
      .from("empreendimento_acessos")
      .delete()
      .eq("user_id", userId)
      .eq("empreendimento_id", empreendimentoId);
    if (error) throw error;
  });
