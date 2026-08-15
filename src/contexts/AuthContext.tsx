import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Papel, Perfil } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  perfil: Perfil | null;
  papeis: Papel[];
  /** Time RPS (diretoria/gestor): edita relatórios. Cliente externo só lê. */
  interno: boolean;
  /** Autenticado, mas sem papel: aguardando liberação da administração. */
  pendente: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [papeisCarregados, setPapeisCarregados] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * Busca perfil e papéis fora do callback do onAuthStateChange: chamar o
   * cliente Supabase dentro daquele callback pode travar (deadlock conhecido).
   */
  const carregarPerfil = useCallback(async (userId: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, email, nome, cargo").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setPerfil((p as Perfil) ?? null);
    setPapeis(((r ?? []) as { role: Papel }[]).map((x) => x.role));
    setPapeisCarregados(true);
  }, []);

  useEffect(() => {
    let ativo = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, nova) => {
      if (!ativo) return;
      setSession(nova);
      setUser(nova?.user ?? null);
      if (!nova?.user) {
        setPerfil(null);
        setPapeis([]);
        setPapeisCarregados(false);
      }
    });

    supabase.auth
      .getSession()
      .then(async ({ data: { session: atual } }) => {
        if (!ativo) return;
        setSession(atual);
        setUser(atual?.user ?? null);
        if (atual?.user) await carregarPerfil(atual.user.id);
      })
      .catch(() => undefined)
      .finally(() => ativo && setLoading(false));

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, [carregarPerfil]);

  // Reage a login/logout já fora do callback do listener
  useEffect(() => {
    if (user && !perfil) void carregarPerfil(user.id);
  }, [user, perfil, carregarPerfil]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setPerfil(null);
    setPapeis([]);
    setPapeisCarregados(false);
  }, []);

  const valor = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      perfil,
      papeis,
      // Sem papel confirmado, ninguém é interno. Uma versão anterior assumia
      // `interno` enquanto os papéis carregavam, para evitar um piscar de tela
      // — o que liberava a interface de edição para quem ainda não foi
      // autorizado. Preferir o estado de carregamento a errar para o lado
      // permissivo. (A RLS no banco barra de qualquer forma; isto é a camada
      // de interface, que deve concordar com ela.)
      interno: papeis.some((p) => p === "diretoria" || p === "gestor"),
      pendente: papeisCarregados && papeis.length === 0,
      // Só termina de carregar quando os papéis chegaram: o roteador precisa
      // deles para decidir entre a aplicação e a tela de acesso em análise.
      loading: loading || (Boolean(user) && !papeisCarregados),
      signOut,
    }),
    [user, session, perfil, papeis, papeisCarregados, loading, signOut],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
};
