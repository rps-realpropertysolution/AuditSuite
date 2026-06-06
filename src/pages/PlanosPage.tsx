import { useCallback, useEffect, useMemo, useState } from "react";
import { useEmpreendimento } from "@/contexts/EmpreendimentoContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

type Status = "aberto" | "em_andamento" | "concluido" | "vencido" | "cancelado";
type Prioridade = "baixa" | "media" | "alta" | "critica";

interface Plan {
  id: string; titulo: string; descricao: string | null; acao_corretiva: string | null;
  responsavel: string | null; prazo: string | null; data_conclusao: string | null;
  status: Status; prioridade: Prioridade; empreendimento_id: string; observacoes: string | null;
}

const statusOrder: Status[] = ["aberto", "em_andamento", "concluido", "vencido", "cancelado"];
const statusLabel: Record<Status, string> = {
  aberto: "Aberto", em_andamento: "Em andamento", concluido: "Concluído", vencido: "Vencido", cancelado: "Cancelado",
};
const prioridadeColor: Record<Prioridade, string> = {
  baixa: "border-muted text-muted-foreground",
  media: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  alta: "border-orange-500/40 text-orange-700 dark:text-orange-400",
  critica: "border-destructive/50 text-destructive",
};

const slaColor = (prazo: string | null, status: Status) => {
  if (status === "concluido" || status === "cancelado") return "text-muted-foreground";
  if (!prazo) return "text-muted-foreground";
  const days = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000);
  if (days < 0) return "text-destructive font-semibold";
  if (days <= 3) return "text-amber-600 dark:text-amber-400 font-medium";
  return "text-emerald-600 dark:text-emerald-400";
};

export default function PlanosPage() {
  const { selected, selectedObj } = useEmpreendimento();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"todos" | Status>("todos");

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    const { data } = await supabase.from("action_plans").select("*")
      .eq("empreendimento_id", selected).order("prazo", { ascending: true, nullsFirst: false });
    setPlans((data ?? []) as Plan[]);
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const g: Record<Status, Plan[]> = { aberto: [], em_andamento: [], concluido: [], vencido: [], cancelado: [] };
    plans.forEach((p) => {
      const isOverdue = p.prazo && new Date(p.prazo) < new Date() && p.status !== "concluido" && p.status !== "cancelado";
      const s = isOverdue ? "vencido" : p.status;
      g[s].push(p);
    });
    return g;
  }, [plans]);

  const filtered = filter === "todos" ? plans : plans.filter((p) => p.status === filter);

  if (!selected) return (
    <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um empreendimento na barra superior.</CardContent></Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plano de Ação</h1>
          <p className="text-sm text-muted-foreground">{selectedObj?.codigo} · {selectedObj?.nome}</p>
        </div>
        <PlanDialog empreendimentoId={selected} onSaved={load}>
          <Button><Plus className="h-4 w-4 mr-1" />Nova ação</Button>
        </PlanDialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statusOrder.map((s) => (
          <Card key={s}>
            <CardContent className="py-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{statusLabel[s]}</div>
              <div className="text-2xl font-semibold">{grouped[s].length}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="tabela">Tabela</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          {loading ? <Loader2 className="animate-spin h-6 w-6 mx-auto text-muted-foreground" /> : (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {statusOrder.map((s) => (
                <div key={s} className="bg-muted/30 rounded-lg p-2 min-h-[200px]">
                  <div className="text-xs font-semibold uppercase tracking-wider px-2 py-1 text-muted-foreground">
                    {statusLabel[s]} · {grouped[s].length}
                  </div>
                  <div className="space-y-2">
                    {grouped[s].map((p) => (
                      <PlanCard key={p.id} plan={p} onChanged={load} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tabela" className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {statusOrder.map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-md">{p.titulo}</TableCell>
                    <TableCell><Badge variant="outline" className={prioridadeColor[p.prioridade]}>{p.prioridade}</Badge></TableCell>
                    <TableCell>{p.responsavel ?? "—"}</TableCell>
                    <TableCell className={slaColor(p.prazo, p.status)}>{p.prazo ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{statusLabel[p.status]}</Badge></TableCell>
                    <TableCell className="text-right">
                      <PlanDialog plan={p} empreendimentoId={selected} onSaved={load}>
                        <Button variant="ghost" size="sm">Editar</Button>
                      </PlanDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum plano de ação</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlanCard({ plan, onChanged }: { plan: Plan; onChanged: () => void }) {
  return (
    <PlanDialog plan={plan} empreendimentoId={plan.empreendimento_id} onSaved={onChanged}>
      <div className="bg-card border rounded-md p-3 hover:shadow-md transition cursor-pointer space-y-2">
        <div className="flex items-start gap-2">
          <Badge variant="outline" className={`text-[10px] ${prioridadeColor[plan.prioridade]}`}>{plan.prioridade}</Badge>
        </div>
        <div className="text-sm font-medium line-clamp-2">{plan.titulo}</div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground truncate">{plan.responsavel ?? "Sem resp."}</span>
          <span className={slaColor(plan.prazo, plan.status)}>{plan.prazo ?? "—"}</span>
        </div>
      </div>
    </PlanDialog>
  );
}

function PlanDialog({
  children, plan, empreendimentoId, onSaved,
}: { children: React.ReactNode; plan?: Plan; empreendimentoId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Plan>>(plan ?? {
    titulo: "", descricao: "", acao_corretiva: "", responsavel: "", prazo: null,
    status: "aberto", prioridade: "media", observacoes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(plan ?? { titulo: "", status: "aberto", prioridade: "media" }); }, [open, plan]);

  const save = async () => {
    if (!form.titulo) return toast.error("Título é obrigatório");
    setSaving(true);
    const payload = { ...form, empreendimento_id: empreendimentoId } as any;
    if (plan?.id) {
      const { error } = await supabase.from("action_plans").update(payload).eq("id", plan.id);
      if (error) { setSaving(false); return toast.error(error.message); }
    } else {
      const { error } = await supabase.from("action_plans").insert(payload);
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    setSaving(false); setOpen(false); onSaved(); toast.success("Plano salvo");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{plan ? "Editar plano" : "Novo plano de ação"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Título</label>
            <Input value={form.titulo ?? ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Prioridade</label>
              <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as Prioridade })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["baixa","media","alta","critica"] as Prioridade[]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statusOrder.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Responsável</label>
              <Input value={form.responsavel ?? ""} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prazo</label>
              <Input type="date" value={form.prazo ?? ""} onChange={(e) => setForm({ ...form, prazo: e.target.value || null })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descrição / contexto</label>
            <Textarea rows={2} value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ação corretiva</label>
            <Textarea rows={2} value={form.acao_corretiva ?? ""} onChange={(e) => setForm({ ...form, acao_corretiva: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Observações</label>
            <Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
