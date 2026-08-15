import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Empreendimento } from "@/lib/types";

export const useEmpreendimentos = () =>
  useQuery({
    queryKey: ["empreendimentos"],
    queryFn: async (): Promise<Empreendimento[]> => {
      const { data, error } = await supabase
        .from("empreendimentos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Empreendimento[];
    },
  });

export const useEmpreendimento = (id: string | undefined) =>
  useQuery({
    queryKey: ["empreendimento", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Empreendimento | null> => {
      const { data, error } = await supabase
        .from("empreendimentos")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as Empreendimento) ?? null;
    },
  });

export const useSalvarEmpreendimento = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emp: Partial<Empreendimento> & { nome: string }) => {
      if (emp.id) {
        const { data, error } = await supabase
          .from("empreendimentos")
          .update(emp)
          .eq("id", emp.id)
          .select()
          .single();
        if (error) throw error;
        return data as Empreendimento;
      }
      const { data: sessao } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("empreendimentos")
        .insert({ ...emp, created_by: sessao.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as Empreendimento;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["empreendimentos"] });
    },
  });
};

export const useArquivarEmpreendimento = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("empreendimentos").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["empreendimentos"] });
    },
  });
};
