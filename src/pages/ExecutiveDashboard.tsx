import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { TrendingUp, ShieldCheck, AlertTriangle, AlertOctagon, Clock, Repeat, Activity, Gauge, LucideIcon } from "lucide-react";

interface Answer { status: string; created_at: string; empreendimento_id: string; item_id: string; }
interface ActionRow { status: string; prazo: string | null; data_conclusao: string | null; prioridade: string; empreendimento_id: string; created_at: string; }
interface Emp { id: string; codigo: string; nome: string; }

const STATUS_COLORS: Record<string,string> = {
  conforme: "hsl(var(--success))", parcial: "hsl(var(--warning))",
  pendente: "hsl(var(--muted-foreground))", nao_conforme: "hsl(var(--destructive))",
};
const CRIT_COLORS: Record<string,string> = {
  critica: "hsl(var(--destructive))", alta: "hsl(var(--warning))",
  media: "hsl(var(--info))", baixa: "hsl(var(--success))",
};

export default function ExecutiveDashboard() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "RPS · Dashboard Executivo"; }, []);
  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: ap }, { data: e }] = await Promise.all([
        supabase.from("audit_answers").select("status,created_at,empreendimento_id,item_id"),
        supabase.from("action_plans").select("status,prazo,data_conclusao,prioridade,empreendimento_id,created_at"),
        supabase.from("empreendimentos").select("id,codigo,nome").eq("ativo", true),
      ]);
      setAnswers((a ?? []) as Answer[]);
      setActions((ap ?? []) as ActionRow[]);
      setEmps((e ?? []) as Emp[]);
      setLoading(false);
    })();
  }, []);

  const k = useMemo(() => {
    const total = answers.filter(x => x.status !== "nao_aplicavel").length;
    const conformes = answers.filter(x => x.status === "conforme").length;
    const nc = answers.filter(x => x.status === "nao_conforme").length;
    const pendentes = answers.filter(x => x.status === "pendente").length;
    const criticos = actions.filter(x => x.prioridade === "critica" && x.status !== "concluido").length;
    const conformidade = total ? Math.round((conformes / total) * 100) : 0;
    const concluidas = actions.filter(x => x.status === "concluido" && x.data_conclusao);
    const slaMedio = concluidas.length
      ? Math.round(concluidas.reduce((acc, a) => acc + (new Date(a.data_conclusao!).getTime() - new Date(a.created_at).getTime()) / 86400000, 0) / concluidas.length)
      : 0;
    const today = new Date().toISOString().slice(0,10);
    const vencidos = actions.filter(x => x.status !== "concluido" && x.prazo && x.prazo < today).length;
    const map = new Map<string, number>();
    answers.filter(x => x.status === "nao_conforme").forEach(x => {
      const key = `${x.empreendimento_id}|${x.item_id}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    const reincidencias = Array.from(map.values()).filter(v => v > 1).length;
    const risco = nc * 3 + criticos * 5 + vencidos * 2;
    return { total, conformes, nc, pendentes, criticos, conformidade, slaMedio, reincidencias, vencidos, risco };
  }, [answers, actions]);

  const porEmpreendimento = useMemo(() => {
    return emps.map(e => {
      const list = answers.filter(a => a.empreendimento_id === e.id && a.status !== "nao_aplicavel");
      const c = list.filter(a => a.status === "conforme").length;
      return { name: e.codigo, score: list.length ? Math.round((c / list.length) * 100) : 0 };
    }).sort((a,b) => b.score - a.score).slice(0, 12);
  }, [emps, answers]);

  const distStatus = useMemo(() => {
    const map: Record<string, number> = {};
    answers.filter(a => a.status !== "nao_aplicavel").forEach(a => { map[a.status] = (map[a.status] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] ?? "hsl(var(--muted))" }));
  }, [answers]);

  const riscoCrit = useMemo(() => {
    const map: Record<string, number> = { critica: 0, alta: 0, media: 0, baixa: 0 };
    actions.filter(a => a.status !== "concluido").forEach(a => { map[a.prioridade] = (map[a.prioridade] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value, fill: CRIT_COLORS[name] }));
  }, [actions]);

  const evolucao = useMemo(() => {
    const buckets: Record<string, { mes: string; total: number; conf: number }> = {};
    answers.filter(a => a.status !== "nao_aplicavel").forEach(a => {
      const mes = a.created_at.slice(0, 7);
      buckets[mes] ??= { mes, total: 0, conf: 0 };
      buckets[mes].total++;
      if (a.status === "conforme") buckets[mes].conf++;
    });
    return Object.values(buckets).sort((a,b) => a.mes.localeCompare(b.mes)).slice(-6)
      .map(b => ({ mes: b.mes, conformidade: b.total ? Math.round((b.conf / b.total) * 100) : 0 }));
  }, [answers]);

  const kpis: { l: string; v: number | string; suffix?: string; icon: LucideIcon; tone: string }[] = [
    { l: "Itens auditados", v: k.total, icon: ShieldCheck, tone: "text-primary" },
    { l: "Conformes", v: k.conformes, icon: ShieldCheck, tone: "text-success" },
    { l: "Não Conformes", v: k.nc, icon: AlertOctagon, tone: "text-destructive" },
    { l: "Críticos abertos", v: k.criticos, icon: AlertTriangle, tone: "text-destructive" },
    { l: "Pendentes", v: k.pendentes, icon: Clock, tone: "text-muted-foreground" },
    { l: "Conformidade", v: k.conformidade, suffix: "%", icon: Gauge, tone: "text-primary" },
    { l: "SLA médio", v: k.slaMedio, suffix: " d", icon: Activity, tone: "text-info" },
    { l: "Reincidências", v: k.reincidencias, icon: Repeat, tone: "text-warning" },
    { l: "Risco operacional", v: k.risco, icon: TrendingUp, tone: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard Executivo</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada da auditoria operacional · todos os empreendimentos</p>
      </div>

      {loading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Carregando dados…</CardContent></Card>
      ) : k.total === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">Nenhuma auditoria de checklist registrada ainda</p>
            <p className="text-sm text-muted-foreground">O <strong>Checklist</strong> de itens será liberado na Fase 2. Use <strong>Auditoria</strong> para os indicadores numéricos por processo.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {kpis.map((it) => (
              <Card key={it.l} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{it.l}</span>
                    <it.icon className={`h-4 w-4 ${it.tone}`} />
                  </div>
                  <div className="text-2xl font-semibold">{it.v}{it.suffix ?? ""}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Conformidade por empreendimento</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer><BarChart data={porEmpreendimento}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0,100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[6,6,0,0]}>
                    {porEmpreendimento.map((d, i) => (
                      <Cell key={i} fill={d.score >= 90 ? "hsl(var(--success))" : d.score >= 75 ? "hsl(var(--info))" : d.score >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart></ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Distribuição de status</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer><PieChart>
                  <Pie data={distStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {distStatus.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart></ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Evolução mensal da conformidade</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer><LineChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis domain={[0,100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="conformidade" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart></ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Planos de ação por criticidade</CardTitle>
                <Badge variant="outline" className="border-destructive/30 text-destructive">{k.vencidos} vencidos</Badge>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer><BarChart data={riscoCrit} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0,6,6,0]}>
                    {riscoCrit.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart></ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}