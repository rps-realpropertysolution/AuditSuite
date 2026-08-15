import { Clock, LogOut, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logoRps from "@/assets/logo-rps.svg";

/**
 * Usuário autenticado, mas ainda sem papel atribuído.
 *
 * O cadastro deixou de conceder acesso automaticamente: só e-mail do domínio
 * corporativo entra direto. Síndicos e proprietários precisam ser vinculados
 * ao empreendimento pela administração — até lá caem aqui.
 */
const AcessoEmAnalise = () => {
  const { perfil, user, signOut } = useAuth();
  const email = perfil?.email ?? user?.email ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <main className="w-full max-w-md text-center">
        <img src={logoRps} alt="RPS Real Property Solution" className="mx-auto h-11 w-auto" />

        <div className="mt-8 rounded-xl border border-border bg-card p-8 shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-semaforo-amarelo/12">
            <Clock className="h-6 w-6 text-semaforo-amarelo" />
          </span>

          <h1 className="mt-5 text-xl font-bold text-foreground">Acesso em análise</h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Seu cadastro foi registrado, mas ainda não há empreendimento liberado para esta conta. A
            administração precisa autorizar o acesso antes que os relatórios fiquem visíveis.
          </p>

          {email ? (
            <p className="mt-5 rounded-md bg-surface-soft px-3 py-2.5 text-sm font-semibold text-foreground">
              {email}
            </p>
          ) : null}

          <p className="mt-5 flex items-start justify-center gap-2 text-xs leading-relaxed text-muted-foreground">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Se o acesso já deveria estar liberado, procure o gestor responsável pelo seu
              empreendimento.
            </span>
          </p>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} RPS Real Property Solution · Acesso restrito
        </p>
      </main>
    </div>
  );
};

export default AcessoEmAnalise;
