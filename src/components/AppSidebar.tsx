import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, ClipboardCheck, ListChecks, ListTodo, AlertOctagon,
  FileText, Building2, Megaphone, Settings,
} from "lucide-react";
import logoRps from "@/assets/logo-rps.svg";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Auditoria",    url: "/auditoria", icon: ClipboardCheck },
  { title: "Checklist",    url: "/checklist", icon: ListChecks },
  { title: "Plano de Ação", url: "/planos", icon: ListTodo },
  { title: "Reincidências", url: "/reincidencias", icon: AlertOctagon },
  { title: "Relatórios",   url: "/relatorios", icon: FileText },
  { title: "Empreendimentos", url: "/empreendimentos", icon: Building2 },
  { title: "Campanhas",    url: "/campanhas", icon: Megaphone },
  { title: "Configurações", url: "/config", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (url: string) => url === "/" ? pathname === "/" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-3 px-2 py-3">
          <img src={logoRps} alt="RPS" className="h-9 w-auto shrink-0" />
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold text-sidebar-foreground">RPS</div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70">Auditoria Operacional</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/60">Módulos</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground hover:bg-sidebar-accent/60">
                    <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}