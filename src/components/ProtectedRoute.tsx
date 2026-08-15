import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AcessoEmAnalise from "@/pages/AcessoEmAnalise";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, pendente, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  // Guarda o destino para voltar a ele depois do login
  if (!user) return <Navigate to="/auth" replace state={{ de: location.pathname }} />;

  // Autenticado mas ainda sem papel: nenhuma tela da aplicação faz sentido.
  if (pendente) return <AcessoEmAnalise />;

  return <>{children}</>;
};

export default ProtectedRoute;
