import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { EmpreendimentoProvider, useEmpreendimento } from "@/contexts/EmpreendimentoContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, LogOut } from "lucide-react";
import AIAssistantDrawer from "@/components/AIAssistantDrawer";

function Topbar() {
  const { profile, primaryRole, signOut } = useAuth();
  const { empreendimentos, selected, setSelected } = useEmpreendimento();
  return (
    <header className="h-16 border-b bg-card flex items-center gap-4 px-4 sticky top-0 z-30">
      <SidebarTrigger />
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="max-w-md h-9 border-0 shadow-none focus:ring-1">
            <SelectValue placeholder="Selecione um empreendimento" />
          </SelectTrigger>
          <SelectContent>
            {empreendimentos.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.codigo} · {e.nome}{e.cidade ? ` — ${e.cidade}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="hidden md:inline-flex border-primary/30 text-primary">
          {empreendimentos.length} ativos
        </Badge>
      </div>
      <div className="hidden sm:block text-right text-xs">
        <div className="font-medium text-foreground">{profile?.nome ?? profile?.email ?? "—"}</div>
        <div className="text-muted-foreground capitalize">{primaryRole ?? "sem perfil"}</div>
      </div>
      <AIAssistantDrawer />
      <Button variant="ghost" size="sm" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-1" />Sair
      </Button>
    </header>
  );
}

export default function AppShell() {
  return (
    <EmpreendimentoProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar />
            <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </EmpreendimentoProvider>
  );
}