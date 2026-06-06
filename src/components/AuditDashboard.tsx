import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis, Cell } from "recharts";
import { CheckCircle2, AlertTriangle, AlertOctagon, Save, ClipboardCheck } from "lucide-react";

interface Process { id: number; name: string; weight: number; ordem: number; }
interface SubProcess { id: string; process_id: number; name: string; objective: string | null; metric: string | null; target: number; weight: number; indicator: string | null; recommended_action: string | null; ordem: number; }
interface Result { subprocess_id: string; actual: number; status: "compliant" | "warning" | "critical"; }

const statusOf = (actual: number, target: number, lowerIsBetter: boolean): Result["status"] => {
  if (target === 0) return "warning";
  const ratio = lowerIsBetter ? target / Math.max(actual, 0.001) : actual / target;
  if (ratio >= 0.95) return "compliant";
  if (ratio >= 0.75) return "warning";
  return "critical";
};
const isLowerBetter = (s: SubProcess) =>
  /(inadimpl|turnover|sinistr|tempo|consumo|dias)/i.test(`${s.name} ${s.indicator ?? ""} ${s.metric ?? ""}`);

export default function AuditDashboard({ empreendimentoId }: { empreendimentoId: string }) {
  const { toast } = useToast();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [subs, setSubs] = useState<SubProcess[]>([]);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [reportId, setReportId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("audit_processes").select("*").order("ordem"),
        supabase.from("audit_subprocesses").select("*").order("ordem"),
      ]);
      setProcesses((p ?? []) as Process[]);
      setSubs((s ?? []) as SubProcess[]);
    })();
  }, []);

  useEffect(() => {
    if (!empreendimentoId) return;
    (async () => {
      setLoading(true);
      const { data: rep } = await supabase.from("audit_reports").select("*").eq("empreendimento_id", empreendimentoId).eq("period", period).maybeSingle();
      if (rep) {
        setReportId(rep.id);
        const { data: rs } = await supabase.from("audit_results").select("*").eq("report_id", rep.id);
        const map: Record<string, Result> = {};
        (rs ?? []).forEach((r: any) => { map[r.subprocess_id] = { subprocess_id: r.subprocess_id, actual: Number(r.actual), status: r.status }; });
        setResults(map);
      } else {
        setReportId(null); setResults({});
      }
      setLoading(false);
    })();
  }, [empreendimentoId, period]);

  const setActual = (sub: SubProcess, value: number) => {
    const status = statusOf(value, sub.target, isLowerBetter(sub));
    setResults((prev) => ({ ...prev, [sub.id]: { subprocess_id: sub.id, actual: value, status } }));
  };

  const overallCompliance = useMemo(() => {
    if (subs.length === 0) return 0;
    let totalW = 0, score = 0;
    for (const sub of subs) {
      const r = results[sub.id];
      totalW += sub.weight;
      if (!r) continue;
      const ratio = isLowerBetter(sub) ? sub.target / Math.max(r.actual, 0.001) : r.actual / sub.target;
      score += sub.weight * Math.max(0, Math.min(1, ratio));
    }
    return totalW ? Math.round((score / totalW) * 100) : 0;
  }, [results, subs]);

  const summary = useMemo(() => {
    const c = { compliant: 0, warning: 0, critical: 0, pending: 0 };
    subs.forEach((s) => { const r = results[s.id]; if (!r) c.pending++; else c[r.status]++; });
    return c;
  }, [results, subs]);

  const chartByProcess = useMemo(() => processes.map((p) => {
    const ps = subs.filter((s) => s.process_id === p.id);
    let totalW = 0, sc = 0;
    ps.forEach((sub) => {
      const r = results[sub.id]; totalW += sub.weight;
      if (!r) return;
      const ratio = isLowerBetter(sub) ? sub.target / Math.max(r.actual, 0.001) : r.actual / sub.target;
      sc += sub.weight * Math.max(0, Math.min(1, ratio));
    });
    const score = totalW ? Math.round((sc / totalW) * 100) : 0;
    return { name: p.name.replace(/^Gestão (de |Comercial)/i, "").slice(0, 18), score };
  }), [processes, subs, results]);

  const save = async () => {
    if (!empreendimentoId) return;
    setSaving(true);
    let rid = reportId;
    if (!rid) {
      const { data, error } = await supabase.from("audit_reports").insert({
        empreendimento_id: empreendimentoId, period, overall_compliance: overallCompliance,
      }).select("id").single();
      if (error) { setSaving(false); return toast({ title: "Erro", description: error.message, variant: "destructive" }); }
      rid = data.id; setReportId(rid);
    } else {
      await supabase.from("audit_reports").update({ overall_compliance: overallCompliance }).eq("id", rid);
    }
    const rows = Object.values(results).map((r) => ({ report_id: rid!, subprocess_id: r.subprocess_id, actual: r.actual, status: r.status }));
    if (rows.length) {
      const { error } = await supabase.from("audit_results").upsert(rows, { onConflict: "report_id,subprocess_id" });
      if (error) { setSaving(false); return toast({ title: "Erro ao salvar resultados", description: error.message, variant: "destructive" }); }
    }
    setSaving(false);
    toast({ title: "Auditoria salva", description: `Conformidade ${overallCompliance}%` });
  };

  const radialData = [{ name: "Conformidade", value: overallCompliance, fill: overallCompliance >= 85 ? "hsl(var(--success))" : overallCompliance >= 65 ? "hsl(var(--warning))" : "hsl(var(--destructive))" }];
  const statusBadge = (s: Result["status"]) => s === "compliant" ? <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Conforme</Badge>
    : s === "warning" ? <Badge className="bg-warning text-warning-foreground"><AlertTriangle className="h-3 w-3 mr-1" />Atenção</Badge>
    : <Badge className="bg-destructive text-destructive-foreground"><AlertOctagon className="h-3 w-3 mr-1" />Crítico</Badge>;

  if (loading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando...</CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card className="shadow-elegant">
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Auditoria Operacional</CardTitle>
            <CardDescription>Período de referência (AAAA-MM)</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" />
            <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="shadow-elegant">
          <CardHeader><CardDescription>Conformidade Geral</CardDescription><CardTitle className="text-3xl">{overallCompliance}%</CardTitle></CardHeader>
          <CardContent className="h-44">
            <ResponsiveContainer><RadialBarChart innerRadius="70%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={10} />
            </RadialBarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-elegant lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Conformidade por Processo</CardTitle></CardHeader>
          <CardContent className="h-44">
            <ResponsiveContainer><BarChart data={chartByProcess}>
              <XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                {chartByProcess.map((d, i) => <Cell key={i} fill={d.score >= 85 ? "hsl(var(--success))" : d.score >= 65 ? "hsl(var(--warning))" : "hsl(var(--destructive))"} />)}
              </Bar>
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Conformes", v: summary.compliant, c: "success" },
          { l: "Atenção", v: summary.warning, c: "warning" },
          { l: "Críticos", v: summary.critical, c: "destructive" },
          { l: "Pendentes", v: summary.pending, c: "muted" },
        ].map((k) => (
          <Card key={k.l} className={`border-l-4 border-${k.c} shadow-elegant`}>
            <CardHeader className="pb-2"><CardDescription className="text-xs uppercase tracking-wider">{k.l}</CardDescription>
              <CardTitle className="text-3xl">{k.v}</CardTitle></CardHeader>
          </Card>
        ))}
      </div>

      <Card className="shadow-elegant">
        <CardHeader><CardTitle className="text-base">Processos Auditáveis</CardTitle>
          <CardDescription>Preencha o realizado de cada sub-processo. Status calculado automaticamente.</CardDescription></CardHeader>
        <CardContent>
          <Accordion type="multiple">
            {processes.map((p) => {
              const ps = subs.filter((s) => s.process_id === p.id);
              const filled = ps.filter((s) => results[s.id]).length;
              return (
                <AccordionItem key={p.id} value={`p${p.id}`}>
                  <AccordionTrigger>
                    <div className="flex-1 flex items-center justify-between pr-4">
                      <div className="text-left"><div className="font-medium">{p.id}. {p.name}</div>
                        <div className="text-xs text-muted-foreground">Peso {p.weight} · {filled}/{ps.length} preenchidos</div></div>
                      <Progress value={ps.length ? (filled / ps.length) * 100 : 0} className="w-32 h-2" />
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {ps.map((sub) => {
                        const r = results[sub.id];
                        return (
                          <div key={sub.id} className="grid md:grid-cols-12 gap-2 items-center p-3 rounded-lg bg-muted/30">
                            <div className="md:col-span-5">
                              <div className="font-medium text-sm">{sub.id} {sub.name}</div>
                              <div className="text-xs text-muted-foreground">{sub.objective} · meta {sub.target} {sub.metric ?? ""}</div>
                            </div>
                            <div className="md:col-span-2"><Input type="number" placeholder="Realizado" value={r?.actual ?? ""} onChange={(e) => setActual(sub, Number(e.target.value || 0))} /></div>
                            <div className="md:col-span-2">{r ? statusBadge(r.status) : <Badge variant="outline">Pendente</Badge>}</div>
                            <div className="md:col-span-3 text-xs text-muted-foreground">{sub.recommended_action ?? "—"}</div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
