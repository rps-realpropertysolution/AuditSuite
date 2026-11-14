import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { Loader2 } from "lucide-react";

// Páginas pesadas (gráficos, editor) carregam sob demanda: o login abre rápido.
const Empreendimentos = lazy(() => import("./pages/Empreendimentos"));
const EditorRelatorio = lazy(() => import("./pages/EditorRelatorio"));
const Apresentacao = lazy(() => import("./pages/Apresentacao"));
const Acessos = lazy(() => import("./pages/Acessos"));
const VisaoAnual = lazy(() => import("./pages/VisaoAnual"));
// Só em desenvolvimento: slides com dados fictícios para revisar o layout.
const DemoApresentacao = import.meta.env.DEV ? lazy(() => import("./pages/DemoApresentacao")) : null;
const PreviaLocal = import.meta.env.DEV ? lazy(() => import("./pages/PreviaLocal")) : null;
const TesteArquivos = import.meta.env.DEV ? lazy(() => import("./pages/TesteArquivos")) : null;

const Carregando = () => (
  <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
  </div>
);
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const protegida = (elemento: React.ReactNode) => (
  <ProtectedRoute>
    <Suspense fallback={<Carregando />}>{elemento}</Suspense>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            {PreviaLocal ? (
              <Route
                path="/previa"
                element={
                  <Suspense fallback={<Carregando />}>
                    <PreviaLocal />
                  </Suspense>
                }
              />
            ) : null}
            {TesteArquivos ? (
              <Route
                path="/teste-arquivos"
                element={
                  <Suspense fallback={<Carregando />}>
                    <TesteArquivos />
                  </Suspense>
                }
              />
            ) : null}
            {DemoApresentacao ? (
              <Route
                path="/demo/rgm"
                element={
                  <Suspense fallback={<Carregando />}>
                    <DemoApresentacao />
                  </Suspense>
                }
              />
            ) : null}
            <Route path="/" element={protegida(<Dashboard />)} />
            <Route path="/empreendimentos" element={protegida(<Empreendimentos />)} />
            <Route path="/acessos" element={protegida(<Acessos />)} />
            <Route path="/empreendimento/:id/ano/:ano" element={protegida(<VisaoAnual />)} />
            <Route path="/relatorio/:id" element={protegida(<EditorRelatorio />)} />
            <Route path="/relatorio/:id/apresentar" element={protegida(<Apresentacao />)} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
