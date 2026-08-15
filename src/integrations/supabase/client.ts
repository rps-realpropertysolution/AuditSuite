import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Falha alto e cedo. A versão anterior caía num fallback para localhost com
 * chave placeholder, então o login "não funcionava" sem nenhuma pista do porquê.
 */
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Supabase não configurado. Copie .env.example para .env e preencha " +
      "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const BUCKET_FOTOS = "relatorio-fotos";
