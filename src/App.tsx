import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/layouts/AppShell";
import ExecutiveDashboard from "@/pages/ExecutiveDashboard";
import AuditoriaPage from "@/pages/AuditoriaPage";
import CampanhasPage from "@/pages/CampanhasPage";
import EmpreendimentosPage from "@/pages/EmpreendimentosPage";
import ModulePlaceholder from "@/pages/ModulePlaceholder";
import ChecklistPage from "@/pages/ChecklistPage";
import PlanosPage from "@/pages/PlanosPage";
import ReincidenciasPage from "@/pages/ReincidenciasPage";
import RelatoriosPage from "@/pages/RelatoriosPage";
import Auth from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="/" element={<ExecutiveDashboard />} />
              <Route path="/auditoria" element={<AuditoriaPage />} />
              <Route path="/checklist" element={<ChecklistPage />} />
              <Route path="/planos" element={<PlanosPage />} />
              <Route path="/reincidencias" element={<ReincidenciasPage />} />
              <Route path="/relatorios" element={<RelatoriosPage />} />
              <Route path="/empreendimentos" element={<EmpreendimentosPage />} />
              <Route path="/campanhas" element={<CampanhasPage />} />
              <Route path="/config" element={<ModulePlaceholder title="Configurações" fase="Fase 2" descricao="Gestão de usuários, perfis e parâmetros do sistema" />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
