import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, PlusCircle, Pencil, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Campanha {
  id: string; nome: string; descricao: string | null; canal: string | null;
  data_inicio: string; data_fim: string | null;
  investimento: number; meta: number; resultado: number;
  status: "planejada" | "em_andamento" | "concluida" | "cancelada"; observacoes: string | null;
}
type CampanhaStatus = "planejada" | "em_andamento" | "concluida" | "cancelada";
type FormState = {
  nome: string; descricao: string; canal: string; data_inicio: string; data_fim: string;
  investimento: number; meta: number; resultado: number; status: CampanhaStatus; observacoes: string;
};
const empty: FormState = { nome: "", descricao: "", canal: "", data_inicio: new Date().toISOString().slice(0,10),
  data_fim: "", investimento: 0, meta: 0, resultado: 0, status: "planejada", observacoes: "" };

export default function CampanhasModule({ empreendimentoId }: { empreendimentoId: string }) {
  const { toast } = useToast();
  const { primaryRole } = useAuth();
  const canEdit = primaryRole === "diretoria" || primaryRole === "gestor";
  const [items, setItems] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campanha | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("campanhas").select("*").eq("empreendimento_id", empreendimentoId).order("data_inicio", { ascending: false });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setItems((data ?? []) as Campanha[]);
    setLoading(false);
  }, [empreendimentoId, toast]);
  useEffect(() => { if (empreendimentoId) reload(); }, [empreendimentoId, reload]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Campanha) => {
    setEditing(c);
    setForm({ nome: c.nome, descricao: c.descricao ?? "", canal: c.canal ?? "",
      data_inicio: c.data_inicio, data_fim: c.data_fim ?? "",
      investimento: Number(c.investimento), meta: Number(c.meta), resultado: Number(c.resultado),
      status: c.status, observacoes: c.observacoes ?? "" });
    setOpen(true);
  };
  const save = async () => {
    if (!form.nome.trim()) return toast({ title: "Informe o nome", variant: "destructive" });
    const payload = { ...form, empreendimento_id: empreendimentoId,
      data_fim: form.data_fim || null, descricao: form.descricao || null,
      canal: form.canal || null, observacoes: form.observacoes || null };
    const { error } = editing
      ? await supabase.from("campanhas").update(payload).eq("id", editing.id)
      : await supabase.from("campanhas").insert(payload);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Atualizada" : "Cadastrada" });
    setOpen(false); reload();
  };
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  const totalInv = items.reduce((a, c) => a + Number(c.investimento), 0);
  const totalRes = items.reduce((a, c) => a + Number(c.resultado), 0);
  const roi = totalInv > 0 ? Math.round(((totalRes - totalInv) / totalInv) * 100) : 0;
  const chart = items.slice(0, 8).reverse().map((c) => ({
    name: c.nome.slice(0, 14), Investimento: Number(c.investimento), Resultado: Number(c.resultado), Meta: Number(c.meta),
  }));

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-elegant border-l-4 border-primary"><CardHeader>
          <CardDescription>Investimento total</CardDescription>
          <CardTitle className="text-2xl">R$ {totalInv.toLocaleString("pt-BR")}</CardTitle></CardHeader></Card>
        <Card className="shadow-elegant border-l-4 border-success"><CardHeader>
          <CardDescription>Resultado total</CardDescription>
          <CardTitle className="text-2xl">R$ {totalRes.toLocaleString("pt-BR")}</CardTitle></CardHeader></Card>
        <Card className="shadow-elegant border-l-4 border-accent"><CardHeader>
          <CardDescription>ROI consolidado</CardDescription>
          <CardTitle className="text-2xl flex items-center gap-2"><TrendingUp className="h-5 w-5" />{roi}%</CardTitle></CardHeader></Card>
      </div>

      {chart.length > 0 && (
        <Card className="shadow-elegant"><CardHeader><CardTitle className="text-base">Performance por campanha</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer><BarChart data={chart}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip /><Legend />
              <Bar dataKey="Investimento" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              <Bar dataKey="Meta" fill="hsl(var(--accent))" radius={[4,4,0,0]} />
              <Bar dataKey="Resultado" fill="hsl(var(--success))" radius={[4,4,0,0]} />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-elegant">
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" />Campanhas e Promoções</CardTitle>
            <CardDescription>Análise de retorno por iniciativa</CardDescription></div>
          {canEdit && <Button onClick={openNew}><PlusCircle className="h-4 w-4 mr-2" />Nova</Button>}
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center text-muted-foreground">Carregando...</div>
            : items.length === 0 ? <div className="py-8 text-center text-muted-foreground">Nenhuma campanha cadastrada.</div>
            : <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead><TableHead>Canal</TableHead><TableHead>Período</TableHead>
                <TableHead className="text-right">Invest.</TableHead><TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Result.</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>{items.map((c) => {
                const r = Number(c.resultado), m = Number(c.meta);
                const atingido = m > 0 ? (r / m) * 100 : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-sm">{c.canal || "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(c.data_inicio).toLocaleDateString("pt-BR")}{c.data_fim ? ` → ${new Date(c.data_fim).toLocaleDateString("pt-BR")}` : ""}</TableCell>
                    <TableCell className="text-right text-sm">R$ {Number(c.investimento).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-sm">R$ {m.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-sm font-medium">R$ {r.toLocaleString("pt-BR")} <span className={`ml-1 text-xs ${atingido >= 100 ? "text-success" : atingido >= 70 ? "text-warning" : "text-destructive"}`}>({Math.round(atingido)}%)</span></TableCell>
                    <TableCell><Badge variant={c.status === "concluida" ? "default" : c.status === "em_andamento" ? "secondary" : "outline"}>{c.status.replace("_"," ")}</Badge></TableCell>
                    <TableCell className="text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Campanha" : "Nova Campanha"}</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-3 py-2">
            <div className="md:col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
            <div><Label>Canal</Label><Input value={form.canal} onChange={(e) => set("canal", e.target.value)} placeholder="Instagram, Email, etc." /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejada">Planejada</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Início *</Label><Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => set("data_fim", e.target.value)} /></div>
            <div><Label>Investimento (R$)</Label><Input type="number" value={form.investimento} onChange={(e) => set("investimento", Number(e.target.value))} /></div>
            <div><Label>Meta (R$)</Label><Input type="number" value={form.meta} onChange={(e) => set("meta", Number(e.target.value))} /></div>
            <div className="md:col-span-2"><Label>Resultado (R$)</Label><Input type="number" value={form.resultado} onChange={(e) => set("resultado", Number(e.target.value))} /></div>
            <div className="md:col-span-2"><Label>Descrição</Label><Textarea rows={2} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
