import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertOctagon, Search, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Row {
  item_id: string; empreendimento_id: string; codigo: string; pergunta: string;
  categoria: string; criticidade: string; emp_codigo: string; emp_nome: string;
  qtd: number; ultima: string;
}

export default function ReincidenciasPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [recos, setRecos] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => { document.title = "RPS · Reincidências"; }, []);
  useEffect(() => {
    (async () => {
      const [{ data: ans }, { data: items }, { data: cats }, { data: emps }] = await Promise.all([
        supabase.from("audit_answers").select("item_id,empreendimento_id,created_at").eq("status", "nao_conforme"),
        supabase.from("audit_items").select("id,codigo,pergunta,criticidade,category_id"),
        supabase.from("audit_categories").select("id,nome"),
        supabase.from("empreendimentos").select("id,codigo,nome"),
      ]);
      const itemMap = new Map((items ?? []).map((i: any) => [i.id, i]));
      const catMap = new Map((cats ?? []).map((c: any) => [c.id, c.nome]));
      const empMap = new Map((emps ?? []).map((e: any) => [e.id, e]));
      const agg = new Map<string, Row>();
      (ans ?? []).forEach((a: any) => {
        const key = `${a.empreendimento_id}|${a.item_id}`;
        const it: any = itemMap.get(a.item_id);
        const emp: any = empMap.get(a.empreendimento_id);
        if (!it || !emp) return;
        const cur = agg.get(key);
        if (cur) {
          cur.qtd++;
          if (a.created_at > cur.ultima) cur.ultima = a.created_at;
        } else {
          agg.set(key, {
            item_id: a.item_id, empreendimento_id: a.empreendimento_id,
            codigo: it.codigo, pergunta: it.pergunta, criticidade: it.criticidade,
            categoria: catMap.get(it.category_id) ?? "—",
            emp_codigo: emp.codigo, emp_nome: emp.nome,
            qtd: 1, ultima: a.created_at,
          });
        }
      });
      setRows(Array.from(agg.values()).filter(r => r.qtd > 1).sort((a, b) => b.qtd - a.qtd));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!filter) return rows;
    const q = filter.toLowerCase();
    return rows.filter(r => `${r.codigo} ${r.pergunta} ${r.emp_codigo} ${r.emp_nome} ${r.categoria}`.toLowerCase().includes(q));
  }, [rows, filter]);

  const askAI = async (r: Row) => {
    const key = `${r.empreendimento_id}|${r.item_id}`;
    setAiLoading(key);
    try {
      const { data, error } = await supabase.functions.invoke("audit-assistant", {
        body: {
          action: "plano",
          context: `Item reincidente: ${r.codigo} - ${r.pergunta}\nCategoria: ${r.categoria}\nCriticidade: ${r.criticidade}\nEmpreendimento: ${r.emp_codigo} - ${r.emp_nome}\nReincidências: ${r.qtd}x (última em ${r.ultima.slice(0,10)})`,
          question: "Gere uma recomendação executiva em até 5 bullets para eliminar a reincidência.",
        },
      });
      if (error) throw error;
      setRecos((p) => ({ ...p, [key]: (data as any).content ?? "" }));
    } catch (e: any) {
      toast({ title: "Erro IA", description: e.message ?? "Falha ao consultar assistente", variant: "destructive" });
    } finally { setAiLoading(null); }
  };

  const critColor: Record<string, string> = {
    critica: "bg-destructive/15 text-destructive border-destructive/30",
    alta: "bg-warning/15 text-warning-foreground border-warning/30",
    media: "bg-info/15 text-info border-info/30",
    baixa: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <AlertOctagon className="h-6 w-6 text-destructive" /> Reincidências
        </h1>
        <p className="text-sm text-muted-foreground">Itens marcados como não conformes em mais de uma auditoria · com recomendação IA</p>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{filtered.length} ocorrência(s) reincidentes</CardTitle>
          <div className="relative w-72">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input placeholder="Buscar item, categoria, empreendimento…" className="pl-9" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="py-8 text-center text-muted-foreground">Carregando…</p> :
           filtered.length === 0 ? <p className="py-8 text-center text-muted-foreground">Nenhuma reincidência detectada.</p> :
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead><TableHead>Categoria</TableHead>
                <TableHead>Empreendimento</TableHead><TableHead>Criticidade</TableHead>
                <TableHead className="text-center">Qtd</TableHead><TableHead>Última</TableHead>
                <TableHead className="text-right">IA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const k = `${r.empreendimento_id}|${r.item_id}`;
                return (
                  <>
                    <TableRow key={k}>
                      <TableCell className="max-w-md">
                        <div className="font-medium text-sm">{r.codigo}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{r.pergunta}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.categoria}</TableCell>
                      <TableCell className="text-sm">{r.emp_codigo} · {r.emp_nome}</TableCell>
                      <TableCell><Badge variant="outline" className={critColor[r.criticidade]}>{r.criticidade}</Badge></TableCell>
                      <TableCell className="text-center"><Badge variant="destructive">{r.qtd}x</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.ultima.slice(0,10)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => askAI(r)} disabled={aiLoading === k}>
                          {aiLoading === k ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                          Recomendar
                        </Button>
                      </TableCell>
                    </TableRow>
                    {recos[k] && (
                      <TableRow key={k + "-r"} className="bg-muted/30">
                        <TableCell colSpan={7}>
                          <div className="text-xs whitespace-pre-wrap p-2 leading-relaxed">
                            <Sparkles className="h-3 w-3 inline mr-1 text-primary" />
                            <span className="font-semibold">Recomendação IA:</span>{"\n"}{recos[k]}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>}
        </CardContent>
      </Card>
    </div>
  );
}