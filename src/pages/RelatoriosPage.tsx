import { useEffect, useState } from "react";
import { useEmpreendimento } from "@/contexts/EmpreendimentoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Presentation, FileType2, Sparkles, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadReportData, generateNarrative, type ReportData, type Narrative } from "@/lib/reportData";
import { buildExecutivePdf, type ReportParams } from "@/lib/reportPdf";
import { buildExcel, buildPptx, buildWord, download } from "@/lib/reportExports";

const monthLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function RelatoriosPage() {
  const { selectedObj } = useEmpreendimento();
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [tipo, setTipo] = useState("Auditoria Operacional e de Conformidade");
  const [respTec, setRespTec] = useState("Diretoria Técnica RPS");
  const [auditor, setAuditor] = useState("Equipe de Auditoria RPS");
  const [classif, setClassif] = useState("CONFIDENCIAL — USO INTERNO");
  const [data, setData] = useState<ReportData | null>(null);
  const [narr, setNarr] = useState<Narrative | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { document.title = "RPS · Relatórios Executivos"; }, []);

  useEffect(() => {
    if (!selectedObj) return;
    setLoading(true); setNarr(null);
    loadReportData(selectedObj.id, period)
      .then(setData)
      .catch((e) => toast({ title: "Erro ao carregar dados", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [selectedObj, period, toast]);

  const params: ReportParams = {
    tipoAuditoria: tipo, periodoLabel: monthLabel(period),
    responsavelTecnico: respTec, auditorResponsavel: auditor, classificacao: classif,
  };

  const gerarNarrativa = async () => {
    if (!data) return;
    setAiLoading(true);
    try {
      const n = await generateNarrative(data);
      setNarr(n);
      toast({ title: "Narrativa gerada", description: "Introdução, metodologia, parecer e conclusão prontos para os 4 formatos." });
    } catch (e: any) {
      toast({ title: "Erro IA", description: e.message, variant: "destructive" });
    } finally { setAiLoading(false); }
  };

  const ensureNarr = (): Narrative => narr ?? {
    introducao: "Narrativa não gerada. Clique em 'Gerar narrativa com IA' para preencher automaticamente as seções textuais do relatório.",
    metodologia: "A auditoria adota método por amostragem, com inspeção visual, entrevistas e análise documental, alinhada às melhores práticas ISO 9001, ISO 41001 e ISO 45001.",
    parecerExecutivo: "Parecer pendente de geração via IA.",
    conclusao: "Conclusão pendente de geração via IA.",
    recomendacoes: "- Gerar a narrativa com IA antes de exportar para obter recomendações estratégicas.",
    disciplinas: {},
  };

  const fname = (ext: string) => `RPS_${data?.reportCode ?? "relatorio"}.${ext}`;

  const onExport = async (kind: "pdf" | "xlsx" | "pptx" | "docx") => {
    if (!data) return;
    setExporting(kind);
    try {
      const n = ensureNarr();
      if (kind === "pdf") {
        const bytes = await buildExecutivePdf(data, n, params);
        download(new Blob([bytes as BlobPart], { type: "application/pdf" }), fname("pdf"));
      } else if (kind === "xlsx") {
        download(buildExcel(data, params), fname("xlsx"));
      } else if (kind === "pptx") {
        download(await buildPptx(data, n, params), fname("pptx"));
      } else if (kind === "docx") {
        download(await buildWord(data, n, params), fname("docx"));
      }
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally { setExporting(null); }
  };

  if (!selectedObj) return <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um empreendimento para gerar relatórios.</CardContent></Card>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />Relatório Executivo de Auditoria
        </h1>
        <p className="text-sm text-muted-foreground">{selectedObj.codigo} · {selectedObj.nome} · Padrão Big Four (PDF, PPTX, Word, Excel)</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Parâmetros institucionais</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1"><Label className="text-xs">Período auditado</Label><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Tipo de auditoria</Label><Input value={tipo} onChange={(e) => setTipo(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Classificação documental</Label><Input value={classif} onChange={(e) => setClassif(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Responsável técnico</Label><Input value={respTec} onChange={(e) => setRespTec(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Auditor responsável</Label><Input value={auditor} onChange={(e) => setAuditor(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Código do relatório</Label><Input readOnly value={data?.reportCode ?? "—"} className="bg-muted/40" /></div>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Pré-visualização dos indicadores</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">{data.kpi.total} itens</Badge>
            <Badge variant="outline" className="border-success/40 text-success">{data.kpi.conformes} conformes</Badge>
            <Badge variant="outline" className="border-destructive/40 text-destructive">{data.kpi.nc} NC</Badge>
            <Badge variant="outline" className="border-primary/40 text-primary">Score {data.kpi.score}% · {data.kpi.classificacao}</Badge>
            <Badge variant="outline">{data.kpi.criticos} críticos abertos</Badge>
            <Badge variant="outline" className="border-warning/40">{data.kpi.vencidos} vencidos</Badge>
            <Badge variant="outline">{data.kpi.reincidencias} reincidências</Badge>
            <Badge variant="outline">Cobertura {data.amostragem.cobertura}%</Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Narrativa executiva (IA)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Gera introdução, metodologia, comentário por disciplina, parecer técnico, conclusão e recomendações estratégicas com linguagem corporativa Big Four. Incluído automaticamente em PDF, PPTX e Word.</p>
          <Button onClick={gerarNarrativa} disabled={aiLoading || loading || !data} variant="outline" size="sm">
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />}
            {narr ? "Regenerar narrativa" : "Gerar narrativa com IA"}
          </Button>
          {narr && (
            <div className="grid md:grid-cols-2 gap-3 mt-2">
              <div className="p-3 bg-muted/40 rounded-md text-xs"><strong className="block mb-1 text-primary">Parecer Executivo</strong><span className="whitespace-pre-wrap line-clamp-6">{narr.parecerExecutivo}</span></div>
              <div className="p-3 bg-muted/40 rounded-md text-xs"><strong className="block mb-1 text-primary">Conclusão</strong><span className="whitespace-pre-wrap line-clamp-6">{narr.conclusao}</span></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Exportar relatório executivo</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Button onClick={() => onExport("pdf")} disabled={!data || !!exporting} className="h-24 flex-col gap-1">
            {exporting === "pdf" ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileText className="h-6 w-6" />}
            PDF Executivo<span className="text-[10px] font-normal opacity-80">17 seções · Big Four</span>
          </Button>
          <Button onClick={() => onExport("pptx")} disabled={!data || !!exporting} variant="secondary" className="h-24 flex-col gap-1">
            {exporting === "pptx" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Presentation className="h-6 w-6" />}
            PowerPoint<span className="text-[10px] font-normal opacity-80">8 slides editáveis</span>
          </Button>
          <Button onClick={() => onExport("docx")} disabled={!data || !!exporting} variant="outline" className="h-24 flex-col gap-1">
            {exporting === "docx" ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileType2 className="h-6 w-6" />}
            Word<span className="text-[10px] font-normal opacity-80">Documento completo</span>
          </Button>
          <Button onClick={() => onExport("xlsx")} disabled={!data || !!exporting} variant="outline" className="h-24 flex-col gap-1">
            {exporting === "xlsx" ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6" />}
            Excel analítico<span className="text-[10px] font-normal opacity-80">6 abas</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}