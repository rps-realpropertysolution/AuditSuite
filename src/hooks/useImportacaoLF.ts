import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ResultadoImportacaoLF } from "../../supabase/functions/_shared/livefacilities/tipos.ts";

/**
 * Chama a Edge Function `livefacilities-importar`. A senha do LiveFacilities
 * fica no servidor; o navegador só recebe os dados já convertidos.
 */
const lerErro = async (error: Error): Promise<never> => {
  const contexto = (error as { context?: Response }).context;
  if (contexto && typeof contexto.json === "function") {
    const corpo = (await contexto.json().catch(() => null)) as { erro?: string } | null;
    if (corpo?.erro) throw new Error(corpo.erro);
  }
  throw new Error(
    /Failed to send|FunctionsFetchError/i.test(error.message)
      ? "A função de importação não respondeu. Ela já foi publicada no Supabase? (supabase functions deploy livefacilities-importar)"
      : error.message,
  );
};

export interface EmpreendimentoDescoberto {
  idEmpreendimento: number | null;
  cdCondominio: string;
  nome: string;
}

/** Empreendimentos do LiveFacilities (código + id), para o cadastro em lote. */
export const buscarEmpreendimentosLF = async (): Promise<EmpreendimentoDescoberto[]> => {
  const { data, error } = await supabase.functions.invoke<{ empreendimentos?: EmpreendimentoDescoberto[]; erro?: string }>(
    "livefacilities-importar",
    { body: { acao: "empreendimentos" } },
  );
  if (error) return lerErro(error);
  if (!data?.empreendimentos) throw new Error(data?.erro ?? "Resposta vazia do LiveFacilities.");
  return data.empreendimentos;
};

export const buscarImportacaoLF = async (relatorioId: string): Promise<ResultadoImportacaoLF> => {
  const { data, error } = await supabase.functions.invoke<ResultadoImportacaoLF & { erro?: string }>(
    "livefacilities-importar",
    { body: { relatorioId } },
  );

  if (error) {
    // A função devolve { erro } com status 4xx/5xx; o supabase-js embrulha em FunctionsHttpError.
    const contexto = (error as { context?: Response }).context;
    if (contexto && typeof contexto.json === "function") {
      const corpo = (await contexto.json().catch(() => null)) as { erro?: string } | null;
      if (corpo?.erro) throw new Error(corpo.erro);
    }
    throw new Error(
      /Failed to send|FunctionsFetchError/i.test(error.message)
        ? "A função de importação não respondeu. Ela já foi publicada no Supabase? (supabase functions deploy livefacilities-importar)"
        : error.message,
    );
  }
  if (!data || data.erro) throw new Error(data?.erro ?? "Resposta vazia da importação.");
  return data;
};

export const useImportacaoLF = () =>
  useMutation({
    mutationFn: buscarImportacaoLF,
  });
