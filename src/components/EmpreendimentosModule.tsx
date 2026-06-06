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
import { Building2, MapPin, User as UserIcon, PlusCircle, Pencil } from "lucide-react";

interface Empreendimento {
  id: string; codigo: string; nome: string;
  endereco: string | null; cidade: string | null; cnpj: string | null;
  area_total: number | null; ativo: boolean;
  sindico_nome: string | null; sindico_cpf: string | null;
  sindico_email: string | null; sindico_celular: string | null;
  sindico_mandato_vencimento: string | null;
}
const empty: Omit<Empreendimento, "id"> = {
  codigo: "", nome: "", endereco: "", cidade: "", cnpj: "",
  area_total: null, ativo: true, sindico_nome: "", sindico_cpf: "",
  sindico_email: "", sindico_celular: "", sindico_mandato_vencimento: null,
};

export default function EmpreendimentosModule() {
  const { toast } = useToast();
  const { primaryRole } = useAuth();
  const [items, setItems] = useState<Empreendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Empreendimento | null>(null);
  const [form, setForm] = useState<Omit<Empreendimento, "id">>(empty);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("empreendimentos").select("*").order("codigo");
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    else setItems((data ?? []) as Empreendimento[]);
    setLoading(false);
  }, [toast]);
  useEffect(() => { reload(); }, [reload]);

  const isDir = primaryRole === "diretoria";
  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (e: Empreendimento) => { setEditing(e); const { id, ...r } = e; setForm(r); setOpen(true); };
  const save = async () => {
    if (!form.codigo.trim() || !form.nome.trim()) return toast({ title: "Preencha código e nome", variant: "destructive" });
    const payload = { ...form,
      area_total: form.area_total === null || (form.area_total as any) === "" ? null : Number(form.area_total),
      sindico_mandato_vencimento: form.sindico_mandato_vencimento || null };
    const { error } = editing
      ? await supabase.from("empreendimentos").update(payload).eq("id", editing.id)
      : await supabase.from("empreendimentos").insert(payload);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Atualizado" : "Cadastrado" });
    setOpen(false); reload();
  };
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <Card className="shadow-elegant">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Empreendimentos</CardTitle>
            <CardDescription>Cadastro centralizado das propriedades sob gestão</CardDescription>
          </div>
          {isDir && <Button onClick={openNew}><PlusCircle className="h-4 w-4 mr-2" /> Novo</Button>}
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-8 text-center text-muted-foreground">Carregando...</div>
            : items.length === 0 ? <div className="py-8 text-center text-muted-foreground">Nenhum cadastrado.</div>
            : <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Cidade</TableHead>
                <TableHead>Síndico</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>{items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.codigo}</TableCell>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell className="text-sm">{e.cidade || "—"}</TableCell>
                  <TableCell className="text-sm">{e.sindico_nome || "—"}</TableCell>
                  <TableCell><Badge variant={e.ativo ? "default" : "secondary"}>{e.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell className="text-right">{isDir && <Button size="sm" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>))}</TableBody>
            </Table>}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Empreendimento" : "Novo Empreendimento"}</DialogTitle></DialogHeader>
          <div className="space-y-6 py-2">
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><MapPin className="h-4 w-4" /> Dados</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Código *</Label><Input value={form.codigo} onChange={(e) => set("codigo", e.target.value)} /></div>
                <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
                <div><Label>CNPJ</Label><Input value={form.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} /></div>
                <div><Label>Cidade</Label><Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Endereço</Label><Textarea rows={2} value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} /></div>
                <div><Label>Área Total (m²)</Label><Input type="number" value={form.area_total ?? ""} onChange={(e) => set("area_total", e.target.value === "" ? null : (Number(e.target.value) as any))} /></div>
                <div className="flex items-end gap-2"><Label className="flex items-center gap-2"><input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />Ativo</Label></div>
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><UserIcon className="h-4 w-4" /> Síndico</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={form.sindico_nome ?? ""} onChange={(e) => set("sindico_nome", e.target.value)} /></div>
                <div><Label>CPF</Label><Input value={form.sindico_cpf ?? ""} onChange={(e) => set("sindico_cpf", e.target.value)} /></div>
                <div><Label>E-mail</Label><Input type="email" value={form.sindico_email ?? ""} onChange={(e) => set("sindico_email", e.target.value)} /></div>
                <div><Label>Celular</Label><Input value={form.sindico_celular ?? ""} onChange={(e) => set("sindico_celular", e.target.value)} /></div>
                <div><Label>Vencimento Mandato</Label><Input type="date" value={form.sindico_mandato_vencimento ?? ""} onChange={(e) => set("sindico_mandato_vencimento", e.target.value || (null as any))} /></div>
              </div>
            </section>
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
