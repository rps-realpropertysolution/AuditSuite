import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Quais variáveis faltam. Exportado para a tela de diagnóstico.
 *
 * Este módulo NÃO lança erro quando a configuração está ausente: um `throw`
 * aqui acontece durante o import, antes de o React montar, e o resultado é uma
 * tela branca sem explicação — que foi exatamente o que aconteceu no primeiro
 * deploy na Vercel. Em vez disso, `main.tsx` checa `supabaseConfigurado` e
 * renderiza uma tela dizendo o que precisa ser feito.
 */
export const calcularVariaveisAusentes = (
  url: string | undefined,
  chave: string | undefined,
): string[] =>
  [
    url?.trim() ? null : "VITE_SUPABASE_URL",
    chave?.trim() ? null : "VITE_SUPABASE_ANON_KEY",
  ].filter((v): v is string => v !== null);

export const variaveisAusentes = calcularVariaveisAusentes(SUPABASE_URL, SUPABASE_KEY);

export const supabaseConfigurado = variaveisAusentes.length === 0;

// Valores inertes só para o cliente poder ser construído. Se forem usados,
// as chamadas falham — mas nesse caso a tela de diagnóstico já está no ar.
export const supabase = createClient(
  SUPABASE_URL || "https://configuracao-ausente.supabase.co",
  SUPABASE_KEY || "configuracao-ausente",
  {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export const BUCKET_FOTOS = "relatorio-fotos";
