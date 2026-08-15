import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import logoRps from "@/assets/logo-rps.svg";

const LINKS = [
  { para: "/", rotulo: "Relatórios", icone: LayoutDashboard },
  { para: "/empreendimentos", rotulo: "Empreendimentos", icone: Building2 },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { perfil, user, interno, signOut } = useAuth();
  const { pathname } = useLocation();

  const nome = perfil?.nome ?? user?.email ?? "";
  const iniciais = nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logoRps} alt="RPS Global" className="h-9 w-auto" />
              <span className="hidden text-sm font-bold uppercase tracking-wide text-foreground sm:block">
                Relatório Gerencial
              </span>
            </Link>

            {interno ? (
              <nav className="flex items-center gap-1">
                {LINKS.map((l) => {
                  const ativo = l.para === "/" ? pathname === "/" : pathname.startsWith(l.para);
                  return (
                    <Link
                      key={l.para}
                      to={l.para}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition",
                        ativo
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <l.icone className="h-4 w-4" />
                      <span className="hidden sm:inline">{l.rotulo}</span>
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-foreground">{nome}</p>
              <p className="text-xs text-muted-foreground">
                {interno ? "Gestor RPS" : "Acesso do cliente"}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {iniciais || "?"}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              title="Sair"
              aria-label="Sair da conta"
              className="rounded-md p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
};
