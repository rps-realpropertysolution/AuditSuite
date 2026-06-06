import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const QUICK = [
  { id: "resumir", label: "Resumir auditoria" },
  { id: "parecer", label: "Gerar parecer" },
  { id: "plano", label: "Sugerir plano de ação" },
  { id: "riscos", label: "Identificar riscos ocultos" },
  { id: "email", label: "E-mail de cobrança" },
];

export default function AIAssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [resp, setResp] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const ask = async (action: string, question?: string) => {
    setLoading(true); setResp("");
    try {
      const { data, error } = await supabase.functions.invoke("audit-assistant", {
        body: { action, question: question ?? q, context: "Sistema RPS · Auditoria Operacional" },
      });
      if (error) throw error;
      setResp((data as any).content ?? "");
    } catch (e: any) {
      toast({ title: "Erro IA", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 border-primary/30 text-primary hover:bg-primary/5">
          <Sparkles className="h-4 w-4" /> IA
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Assistente RPS</SheetTitle>
          <SheetDescription>Auditor sênior virtual. Ações rápidas ou pergunta livre.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap gap-2 mt-4">
          {QUICK.map((a) => (
            <Button key={a.id} size="sm" variant="secondary" disabled={loading} onClick={() => ask(a.id, "Execute esta ação considerando o sistema RPS de auditoria operacional.")}>
              {a.label}
            </Button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto mt-4 p-3 bg-muted/30 rounded-md text-sm whitespace-pre-wrap leading-relaxed min-h-[200px]">
          {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Pensando…</div> : resp || <span className="text-muted-foreground">A resposta aparecerá aqui.</span>}
        </div>
        <div className="space-y-2 mt-3">
          <Textarea placeholder="Pergunte algo sobre auditoria, riscos, plano de ação…" rows={3} value={q} onChange={(e) => setQ(e.target.value)} />
          <Button onClick={() => ask("livre")} disabled={loading || !q.trim()} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Perguntar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}