import { describe, expect, it } from "vitest";
import { calcularVariaveisAusentes } from "@/integrations/supabase/client";

/**
 * Regressão do incidente do primeiro deploy na Vercel: o build saiu sem as
 * variáveis de ambiente, o client lançava erro durante o import e a aplicação
 * entregava uma tela branca — sem nenhuma pista do que estava errado.
 *
 * Duas garantias aqui:
 *  1. importar o módulo do Supabase NUNCA lança, mesmo sem configuração;
 *  2. a lista de variáveis faltando é exata, para a tela de diagnóstico
 *     conseguir dizer ao time o que precisa ser preenchido.
 */

describe("configuração do Supabase", () => {
  it("importar o cliente não lança, mesmo sem variáveis", async () => {
    // Se o módulo voltar a dar throw no import, este await rejeita.
    await expect(import("@/integrations/supabase/client")).resolves.toBeDefined();
  });

  it("aponta as duas variáveis quando nada foi configurado", () => {
    expect(calcularVariaveisAusentes(undefined, undefined)).toEqual([
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
    ]);
  });

  it("aponta só a que falta", () => {
    expect(calcularVariaveisAusentes("https://x.supabase.co", undefined)).toEqual([
      "VITE_SUPABASE_ANON_KEY",
    ]);
    expect(calcularVariaveisAusentes(undefined, "chave")).toEqual(["VITE_SUPABASE_URL"]);
  });

  it("trata string vazia e espaços como ausência", () => {
    // Variável criada na Vercel mas deixada em branco é um erro comum.
    expect(calcularVariaveisAusentes("", "   ")).toEqual([
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
    ]);
  });

  it("não reclama quando as duas estão preenchidas", () => {
    expect(calcularVariaveisAusentes("https://x.supabase.co", "chave-anon")).toEqual([]);
  });
});
