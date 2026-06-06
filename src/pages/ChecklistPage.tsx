import { useEffect, useMemo, useState, useCallback } from "react";
import { useEmpreendimento } from "@/contexts/EmpreendimentoContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Clock, Upload, Paperclip, Trash2, Loader2 } from "lucide-react";

type Status = "pendente" | "conforme" | "nao_conforme" | "parcial" | "nao_aplicavel";
type Criticidade = "baixa" | "media" | "alta" | "critica";

interface Category { id: number; codigo: string; nome: string; ordem: number; }
interface Item { id: string; codigo: string; pergunta: string; category_id: number; criticidade: Criticidade; sla_dias: number; evidencia_obrigatoria: boolean; ordem: number; }
interface Answer { id: string; item_id: string; status: Status; comentario: string | null; responsavel: string | null; prazo: string | null; }
interface Evidence { id: string; answer_id: string; file_name: string; storage_path: string; }

const statusMeta: Record<Status, { label: string; icon: any; cls: string }> = {
  pendente:      { label: "Pendente",        icon: Clock,       cls: "bg-muted text-muted-foreground" },
  conforme:      { label: "Conforme",        icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  parcial:       { label: "Parcial",         icon: AlertTriangle,cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  nao_conforme:  { label: "Não Conforme",    icon: XCircle,     cls: "bg-destructive/15 text-destructive" },
  nao_aplicavel: { label: "N/A",             icon: MinusCircle, cls: "bg-muted text-muted-foreground" },
};

const critMeta: Record<Criticidade, string> = {
  baixa: "border-muted text-muted-foreground",
  media: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  alta:  "border-orange-500/40 text-orange-700 dark:text-orange-400",
  critica: "border-destructive/50 text-destructive",
};

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function ChecklistPage() {
  const { selected, selectedObj } = useEmpreendimento();
  const [period, setPeriod] = useState(currentPeriod());
  const [reportId, setReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [evidences, setEvidences] = useState<Record<string, Evidence[]>>({});

  const ensureReport = useCallback(async () => {
    if (!selected) return null;
    const { data: existing } = await supabase.from("audit_reports")
      .select("id").eq("empreendimento_id", selected).eq("period", period).maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await supabase.from("audit_reports")
      .insert({ empreendimento_id: selected, period }).select("id").single();
    if (error) { toast.error(error.message); return null; }
    return data.id;
  }, [selected, period]);

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    const rid = await ensureReport();
    setReportId(rid);
    const [{ data: catData }, { data: itemData }, { data: ansData }] = await Promise.all([
      supabase.from("audit_categories").select("*").order("ordem"),
      supabase.from("audit_items").select("*").eq("ativo", true).order("ordem"),
      rid ? supabase.from("audit_answers").select("*").eq("report_id", rid) : Promise.resolve({ data: [] as any[] }),
    ]);
    setCats((catData ?? []) as Category[]);
    setItems((itemData ?? []) as Item[]);
    const map: Record<string, Answer> = {};
    (ansData ?? []).forEach((a: any) => (map[a.item_id] = a));
    setAnswers(map);
    const answerIds = Object.values(map).map((a) => a.id);
    if (answerIds.length) {
      const { data: evData } = await supabase.from("evidences").select("*").in("answer_id", answerIds);
      const evMap: Record<string, Evidence[]> = {};
      (evData ?? []).forEach((e: any) => { (evMap[e.answer_id] ||= []).push(e); });
      setEvidences(evMap);
    } else setEvidences({});
    setLoading(false);
  }, [selected, ensureReport]);

  useEffect(() => { load(); }, [load]);

  const upsertAnswer = async (item: Item, patch: Partial<Answer>) => {
    if (!reportId || !selected) return;
    const existing = answers[item.id];
    const payload: any = {
      report_id: reportId, item_id: item.id, empreendimento_id: selected,
      status: patch.status ?? existing?.status ?? "pendente",
      comentario: patch.comentario ?? existing?.comentario ?? null,
      responsavel: patch.responsavel ?? existing?.responsavel ?? null,
      prazo: patch.prazo ?? existing?.prazo ?? null,
    };
    if (existing) {
      const { data, error } = await supabase.from("audit_answers").update(payload).eq("id", existing.id).select().single();
      if (error) return toast.error(error.message);
      setAnswers((p) => ({ ...p, [item.id]: data as Answer }));
    } else {
      const { data, error } = await supabase.from("audit_answers").insert(payload).select().single();
      if (error) return toast.error(error.message);
      setAnswers((p) => ({ ...p, [item.id]: data as Answer }));
    }
  };

  const progress = useMemo(() => {
    const total = items.length;
    const ok = items.filter((i) => answers[i.id]?.status === "conforme").length;
    const nc = items.filter((i) => answers[i.id]?.status === "nao_conforme").length;
    const answered = items.filter((i) => answers[i.id] && answers[i.id].status !== "pendente").length;
    return { total, answered, ok, nc };
  }, [items, answers]);

  if (!selected) return (
    <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um empreendimento na barra superior.</CardContent></Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Checklist de Auditoria</h1>
          <p className="text-sm text-muted-foreground">
            {selectedObj?.codigo} · {selectedObj?.nome} — período {period}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Período</label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 w-40" />
          </div>
          <Button variant="outline" onClick={load}>Atualizar</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Itens" value={items.length} />
        <Stat label="Respondidos" value={progress.answered} accent="text-primary" />
        <Stat label="Conformes" value={progress.ok} accent="text-emerald-600 dark:text-emerald-400" />
        <Stat label="Não Conformes" value={progress.nc} accent="text-destructive" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
      ) : (
        <Accordion type="multiple" defaultValue={cats.map(c => c.codigo)} className="space-y-3">
          {cats.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id);
            if (!catItems.length) return null;
            const ok = catItems.filter((i) => answers[i.id]?.status === "conforme").length;
            return (
              <AccordionItem key={cat.id} value={cat.codigo} className="border rounded-lg bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    <Badge variant="outline" className="border-primary/30 text-primary">{cat.codigo}</Badge>
                    <span className="font-medium">{cat.nome}</span>
                    <span className="text-xs text-muted-foreground ml-auto mr-2">{ok}/{catItems.length} conformes</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pb-2">
                    {catItems.map((item) => (
                      <ItemRow key={item.id} item={item} answer={answers[item.id]}
                        evidences={evidences[answers[item.id]?.id ?? ""] ?? []}
                        onChange={(patch) => upsertAnswer(item, patch)}
                        empreendimentoId={selected}
                        onEvidenceUpdated={load}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold ${accent ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ItemRow({
  item, answer, evidences, onChange, empreendimentoId, onEvidenceUpdated,
}: {
  item: Item; answer?: Answer; evidences: Evidence[]; empreendimentoId: string;
  onChange: (patch: Partial<Answer>) => void; onEvidenceUpdated: () => void;
}) {
  const status: Status = answer?.status ?? "pendente";
  const meta = statusMeta[status];
  const StatusIcon = meta.icon;

  return (
    <div className="border rounded-md p-3 bg-background/40">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{item.codigo}</Badge>
            <Badge variant="outline" className={`text-[10px] ${critMeta[item.criticidade]}`}>{item.criticidade}</Badge>
            {item.evidencia_obrigatoria && <Badge variant="outline" className="text-[10px]">evidência obrigatória</Badge>}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${meta.cls}`}>
              <StatusIcon className="h-3 w-3" />{meta.label}
            </span>
          </div>
          <div className="mt-1 text-sm">{item.pergunta}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(v) => onChange({ status: v as Status })}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(statusMeta) as Status[]).map((s) => (
                <SelectItem key={s} value={s}>{statusMeta[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <EvidenceDialog item={item} answerId={answer?.id} empreendimentoId={empreendimentoId}
            evidences={evidences} onChanged={onEvidenceUpdated}
            ensureAnswer={async () => {
              if (answer?.id) return answer.id;
              await onChange({ status });
              return null;
            }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_220px_160px] gap-2">
        <Textarea placeholder="Comentário / tratativa" rows={2}
          defaultValue={answer?.comentario ?? ""}
          onBlur={(e) => e.target.value !== (answer?.comentario ?? "") && onChange({ comentario: e.target.value })}
        />
        <Input placeholder="Responsável"
          defaultValue={answer?.responsavel ?? ""}
          onBlur={(e) => e.target.value !== (answer?.responsavel ?? "") && onChange({ responsavel: e.target.value })}
        />
        <Input type="date" defaultValue={answer?.prazo ?? ""}
          onBlur={(e) => e.target.value !== (answer?.prazo ?? "") && onChange({ prazo: e.target.value || null })}
        />
      </div>
    </div>
  );
}

function EvidenceDialog({
  item, answerId, empreendimentoId, evidences, onChanged, ensureAnswer,
}: {
  item: Item; answerId?: string; empreendimentoId: string; evidences: Evidence[];
  onChanged: () => void; ensureAnswer: () => Promise<string | null>;
}) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (files: File[]) => {
    let aid = answerId;
    if (!aid) { await ensureAnswer(); toast.message("Defina o status antes de anexar"); return; }
    setUploading(true);
    for (const file of files) {
      const path = `${empreendimentoId}/${aid}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("audit-evidences").upload(path, file, { upsert: false });
      if (upErr) { toast.error(upErr.message); continue; }
      const { error: insErr } = await supabase.from("evidences").insert({
        answer_id: aid, empreendimento_id: empreendimentoId, file_name: file.name,
        storage_path: path, mime_type: file.type, size_bytes: file.size,
      });
      if (insErr) toast.error(insErr.message);
    }
    setUploading(false);
    onChanged();
    toast.success("Evidência(s) enviada(s)");
  }, [answerId, empreendimentoId, ensureAnswer, onChanged]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, disabled: !answerId || uploading });

  const removeEvidence = async (ev: Evidence) => {
    await supabase.storage.from("audit-evidences").remove([ev.storage_path]);
    await supabase.from("evidences").delete().eq("id", ev.id);
    onChanged();
  };

  const downloadEvidence = async (ev: Evidence) => {
    const { data, error } = await supabase.storage.from("audit-evidences").createSignedUrl(ev.storage_path, 60);
    if (error || !data) return toast.error("Falha ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Paperclip className="h-3.5 w-3.5 mr-1" />{evidences.length}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Evidências · {item.codigo}</DialogTitle></DialogHeader>
        <div {...getRootProps()} className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition
          ${isDragActive ? "border-primary bg-primary/5" : "border-muted"} ${!answerId ? "opacity-50 cursor-not-allowed" : ""}`}>
          <input {...getInputProps()} />
          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <div className="text-sm">{uploading ? "Enviando..." : isDragActive ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para selecionar"}</div>
          {!answerId && <div className="text-xs text-muted-foreground mt-1">Defina um status no item primeiro</div>}
        </div>
        <div className="space-y-1 max-h-60 overflow-auto">
          {evidences.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">Nenhuma evidência anexada</div>}
          {evidences.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between border rounded px-2 py-1.5 text-sm">
              <button className="truncate text-left flex-1 hover:underline" onClick={() => downloadEvidence(ev)}>{ev.file_name}</button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEvidence(ev)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
