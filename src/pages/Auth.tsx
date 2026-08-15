import { useState } from "react";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logoRps from "@/assets/logo-rps.svg";
import headerBg from "@/assets/header-sp-2.jpg";

const esquemaLogin = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  senha: z.string().min(1, "Informe a senha"),
});

const esquemaCadastro = z.object({
  nome: z.string().trim().min(2, "Informe seu nome completo").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  senha: z
    .string()
    .min(8, "A senha precisa de ao menos 8 caracteres")
    .max(128)
    .regex(/[a-zA-Z]/, "Inclua ao menos uma letra")
    .regex(/\d/, "Inclua ao menos um número"),
});

type Aba = "entrar" | "criar";

const MENSAGENS: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar.",
  "User already registered": "Este e-mail já tem conta. Use a aba Entrar.",
};

const traduzir = (msg: string) =>
  MENSAGENS[msg] ??
  (msg.toLowerCase().includes("already")
    ? "Este e-mail já tem conta. Use a aba Entrar."
    : msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network")
      ? "Não foi possível falar com o servidor. Verifique sua conexão."
      : msg);

const Auth = () => {
  const { user, loading } = useAuth();
  const [aba, setAba] = useState<Aba>("entrar");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [verSenha, setVerSenha] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const trocarAba = (nova: Aba) => {
    setAba(nova);
    setErro(null);
    setAviso(null);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    if (aba === "entrar") {
      const r = esquemaLogin.safeParse({ email, senha });
      if (!r.success) return setErro(r.error.errors[0].message);

      setEnviando(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: r.data.email,
        password: r.data.senha,
      });
      setEnviando(false);
      if (error) setErro(traduzir(error.message));
      // Sucesso: o AuthProvider detecta a sessão e o roteador redireciona.
      return;
    }

    const r = esquemaCadastro.safeParse({ nome, email, senha });
    if (!r.success) return setErro(r.error.errors[0].message);

    setEnviando(true);
    const { data, error } = await supabase.auth.signUp({
      email: r.data.email,
      password: r.data.senha,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { nome: r.data.nome, full_name: r.data.nome },
      },
    });
    setEnviando(false);

    if (error) return setErro(traduzir(error.message));
    if (data.user && !data.session) {
      setAviso("Conta criada. Confirme o e-mail que enviamos para poder entrar.");
      setAba("entrar");
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca — contexto para quem abre o link pela primeira vez */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-executive-foreground lg:flex"
        style={{
          backgroundImage: `linear-gradient(135deg, hsl(var(--executive) / 0.94), hsl(var(--primary) / 0.88) 55%, hsl(var(--secondary) / 0.82)), url(${headerBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <img src={logoRps} alt="RPS Global" className="h-14 w-auto brightness-0 invert" />

        <div className="max-w-lg space-y-5">
          <h2 className="text-4xl font-bold leading-tight">
            Relatório Gerencial Mensal, sem Excel e sem PowerPoint.
          </h2>
          <p className="text-lg leading-relaxed text-executive-foreground/85">
            O gestor lança os números uma vez. O sumário executivo, os semáforos e as tendências se
            montam sozinhos — e o síndico recebe um relatório que dá para entender.
          </p>
          <ul className="space-y-2.5 pt-2 text-sm">
            {[
              "O mês novo já nasce preenchido com a estrutura do anterior",
              "Status de documento calculado pela data de validade",
              "Modo apresentação pronto para a reunião de prestação de contas",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="text-executive-foreground/90">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-executive-foreground/60">
          RPS Real Property Solution · Property Management
        </p>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-sm">
          <img src={logoRps} alt="RPS Global" className="mb-8 h-12 w-auto lg:hidden" />

          <h1 className="text-2xl font-bold text-foreground">
            {aba === "entrar" ? "Entrar na plataforma" : "Criar sua conta"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {aba === "entrar"
              ? "Use o e-mail corporativo cadastrado pela RPS."
              : "Sua conta começa com acesso de gestor."}
          </p>

          <div
            role="tablist"
            aria-label="Alternar entre entrar e criar conta"
            className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
          >
            {(["entrar", "criar"] as const).map((valor) => (
              <button
                key={valor}
                role="tab"
                type="button"
                aria-selected={aba === valor}
                onClick={() => trocarAba(valor)}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  aba === valor
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {valor === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={enviar} className="mt-6 space-y-4" noValidate>
            {aba === "criar" ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-foreground">Nome completo</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como você assina o relatório"
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-foreground">E-mail</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@rpsglobal.com.br"
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-foreground">Senha</span>
              <div className="relative">
                <input
                  type={verSenha ? "text" : "password"}
                  autoComplete={aba === "entrar" ? "current-password" : "new-password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={aba === "criar" ? "Mínimo 8 caracteres, com número" : "Sua senha"}
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 pr-11 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2 text-muted-foreground transition hover:text-foreground"
                >
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {erro ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {erro}
              </p>
            ) : null}

            {aviso ? (
              <p
                role="status"
                className="rounded-md border border-semaforo-verde/30 bg-semaforo-verde/5 p-3 text-sm text-semaforo-verde"
              >
                {aviso}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={enviando}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            >
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {aba === "entrar" ? "Entrando…" : "Criando conta…"}
                </>
              ) : (
                <>
                  {aba === "entrar" ? "Entrar" : "Criar conta"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            RPS Global · Relatório Gerencial Mensal
          </p>
        </div>
      </main>
    </div>
  );
};

export default Auth;
