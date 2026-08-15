import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { herdarDoMesAnterior, normalizarDados, relatorioEmBranco } from "@/lib/defaults";
import { calcularIndiceExecutivo } from "@/lib/metrics";
import { competenciaAnterior } from "@/lib/format";
import type { DadosRelatorio, Relatorio, StatusRelatorio } from "@/lib/types";

const comDadosNormalizados = (linha: Record<string, unknown>): Relatorio => ({
  ...(linha as unknown as Relatorio),
  dados: normalizarDados(linha.dados),
});

/** Lista para o painel: todos os relatórios visíveis, mais recentes primeiro. */
export const useRelatorios = (empreendimentoId?: string) =>
  useQuery({
    queryKey: ["relatorios", empreendimentoId ?? "todos"],
    queryFn: async (): Promise<Relatorio[]> => {
      let q = supabase
        .from("relatorios")
        .select("*, empreendimento:empreendimentos(*)")
        .order("competencia", { ascending: false });
      if (empreendimentoId) q = q.eq("empreendimento_id", empreendimentoId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(comDadosNormalizados);
    },
  });

export const useRelatorio = (id: string | undefined) =>
  useQuery({
    queryKey: ["relatorio", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Relatorio | null> => {
      const { data, error } = await supabase
        .from("relatorios")
        .select("*, empreendimento:empreendimentos(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? comDadosNormalizados(data) : null;
    },
  });

/**
 * Série histórica para os gráficos de evolução.
 * Substitui o array `monthlyData` hardcoded da versão anterior: a tendência
 * agora vem dos meses realmente fechados, não de números fictícios.
 */
export const useHistorico = (empreendimentoId: string | undefined, meses = 13) =>
  useQuery({
    queryKey: ["historico", empreendimentoId, meses],
    enabled: Boolean(empreendimentoId),
    queryFn: async (): Promise<Relatorio[]> => {
      const { data, error } = await supabase
        .from("relatorios")
        .select("*")
        .eq("empreendimento_id", empreendimentoId!)
        .order("competencia", { ascending: false })
        .limit(meses);
      if (error) throw error;
      // ordem cronológica para o gráfico
      return (data ?? []).map(comDadosNormalizados).reverse();
    },
  });

/**
 * Cria o relatório do mês. Se existir o mês anterior, herda a estrutura dele
 * — é o passo que elimina a remontagem manual a cada competência.
 */
export const useCriarRelatorio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      empreendimentoId,
      competencia,
    }: {
      empreendimentoId: string;
      competencia: string;
    }): Promise<Relatorio> => {
      const { data: anterior } = await supabase
        .from("relatorios")
        .select("dados")
        .eq("empreendimento_id", empreendimentoId)
        .eq("competencia", competenciaAnterior(competencia))
        .maybeSingle();

      const dados = anterior?.dados
        ? herdarDoMesAnterior(normalizarDados(anterior.dados))
        : relatorioEmBranco();

      const { data: sessao } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("relatorios")
        .insert({
          empreendimento_id: empreendimentoId,
          competencia,
          dados,
          status: "rascunho" satisfies StatusRelatorio,
          indice_executivo: calcularIndiceExecutivo(dados),
          created_by: sessao.user?.id,
        })
        .select("*, empreendimento:empreendimentos(*)")
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um relatório para este empreendimento nesta competência.");
        }
        throw error;
      }
      return comDadosNormalizados(data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["relatorios"] });
    },
  });
};

/** Salvamento do corpo do relatório. Usado pelo autosave e pelo botão manual. */
export const salvarDados = async (id: string, dados: DadosRelatorio) => {
  const { error } = await supabase
    .from("relatorios")
    .update({ dados, indice_executivo: calcularIndiceExecutivo(dados) })
    .eq("id", id);
  if (error) throw error;
};

export const useMudarStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusRelatorio }) => {
      const { error } = await supabase
        .from("relatorios")
        .update({
          status,
          publicado_em: status === "publicado" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["relatorio", v.id] });
      void qc.invalidateQueries({ queryKey: ["relatorios"] });
    },
  });
};

export const useExcluirRelatorio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("relatorios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["relatorios"] });
    },
  });
};
