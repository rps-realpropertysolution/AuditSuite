import { supabase } from "@/integrations/supabase/client";

export interface Empreendimento { id: string; codigo: string; nome: string; cidade?: string | null; cnpj?: string | null; endereco?: string | null; sindico_nome?: string | null; }
export interface Category { id: number; codigo: string; nome: string; }
export interface Item { id: string; codigo: string; pergunta: string; criticidade: string; category_id: number; sla_dias: number; }
export interface Answer { id: string; status: string; comentario: string | null; responsavel: string | null; prazo: string | null; created_at: string; item_id: string; }
export interface Plan { id: string; titulo: string; descricao: string | null; acao_corretiva: string | null; prioridade: string; status: string; prazo: string | null; responsavel: string | null; created_at: string; data_conclusao: string | null; }

export interface DisciplineStat {
  cat: Category;
  total: number; conformes: number; nc: number; parcial: number; pendente: number; na: number;
  conformidade: number;     // %
  risco: "Baixo" | "Médio" | "Alto" | "Crítico";
  nclist: Array<{ item: Item; answer: Answer }>;
}

export interface ReportData {
  emp: Empreendimento;
  period: string;            // YYYY-MM
  startISO: string; endISO: string;
  reportCode: string;
  emittedAt: string;         // ISO
  cats: Category[]; items: Item[]; answers: Answer[]; plans: Plan[];
  byCat: DisciplineStat[];
  kpi: {
    total: number; conformes: number; nc: number; parcial: number; pendente: number;
    score: number;            // 0-100
    classificacao: "Excelente" | "Adequado" | "Atenção" | "Crítico";
    criticos: number; vencidos: number; reincidencias: number; slaMedio: number;
    riscoIndex: number;
  };
  amostragem: { universo: number; auditado: number; cobertura: number; criticos: number; evidencias: number };
  reincidencias: Array<{ item: Item; cat: Category; qtd: number; ultima: string }>;
  riskMatrix: number[][];    // 5x5 [prob][impact] count
  evidencesCount: number;
  historico: Array<{ period: string; label: string; score: number; nc: number; total: number }>;
  criticidadeDist: { critica: number; alta: number; media: number; baixa: number };
  evidenceShots: Array<{ catCodigo: string; itemCodigo: string; pergunta: string; bytes: Uint8Array; mime: string }>;
}

const classify = (score: number): ReportData["kpi"]["classificacao"] =>
  score >= 90 ? "Excelente" : score >= 75 ? "Adequado" : score >= 60 ? "Atenção" : "Crítico";

const riskFromConformity = (c: number, ncCrit: number): DisciplineStat["risco"] =>
  ncCrit > 0 || c < 60 ? "Crítico" : c < 75 ? "Alto" : c < 90 ? "Médio" : "Baixo";

export async function loadReportData(empId: string, period: string): Promise<ReportData> {
  const [y, m] = period.split("-").map(Number);
  const startISO = `${period}-01`;
  const endISO = new Date(y, m, 1).toISOString().slice(0, 10);
  const [{ data: empData }, { data: cats }, { data: items }, { data: ans }, { data: pls }, { data: evs }] = await Promise.all([
    supabase.from("empreendimentos").select("*").eq("id", empId).single(),
    supabase.from("audit_categories").select("id,codigo,nome").order("ordem"),
    supabase.from("audit_items").select("id,codigo,pergunta,criticidade,category_id,sla_dias"),
    supabase.from("audit_answers").select("id,status,comentario,responsavel,prazo,created_at,item_id").eq("empreendimento_id", empId).gte("created_at", startISO).lt("created_at", endISO),
    supabase.from("action_plans").select("id,titulo,descricao,acao_corretiva,prioridade,status,prazo,responsavel,created_at,data_conclusao").eq("empreendimento_id", empId),
    supabase.from("evidences").select("id,answer_id").eq("empreendimento_id", empId),
  ]);
  const emp = empData as Empreendimento;
  const categories = (cats ?? []) as Category[];
  const allItems = (items ?? []) as Item[];
  const answers = (ans ?? []) as Answer[];
  const plans = (pls ?? []) as Plan[];
  const itemMap = new Map(allItems.map(i => [i.id, i]));
  const today = new Date().toISOString().slice(0, 10);

  // Per discipline
  const byCat: DisciplineStat[] = categories.map(cat => {
    const catItems = allItems.filter(i => i.category_id === cat.id);
    const catAns = answers.filter(a => itemMap.get(a.item_id)?.category_id === cat.id);
    const total = catAns.filter(a => a.status !== "nao_aplicavel").length;
    const conformes = catAns.filter(a => a.status === "conforme").length;
    const nc = catAns.filter(a => a.status === "nao_conforme").length;
    const parcial = catAns.filter(a => a.status === "parcial").length;
    const pendente = catAns.filter(a => a.status === "pendente").length;
    const na = catAns.filter(a => a.status === "nao_aplicavel").length;
    const conformidade = total ? Math.round(((conformes * 100 + parcial * 50) / total)) : 0;
    const nclist = catAns.filter(a => a.status === "nao_conforme").map(a => ({ item: itemMap.get(a.item_id)!, answer: a })).filter(x => x.item);
    const ncCrit = nclist.filter(x => x.item.criticidade === "critica").length;
    return { cat, total, conformes, nc, parcial, pendente, na, conformidade, risco: riskFromConformity(conformidade, ncCrit), nclist };
  });

  // Global KPIs
  const total = answers.filter(a => a.status !== "nao_aplicavel").length;
  const conformes = answers.filter(a => a.status === "conforme").length;
  const parcial = answers.filter(a => a.status === "parcial").length;
  const nc = answers.filter(a => a.status === "nao_conforme").length;
  const pendente = answers.filter(a => a.status === "pendente").length;
  const score = total ? Math.round((conformes * 100 + parcial * 50) / total) : 0;
  const criticos = plans.filter(p => p.prioridade === "critica" && p.status !== "concluido").length;
  const vencidos = plans.filter(p => p.status !== "concluido" && p.prazo && p.prazo < today).length;
  const concl = plans.filter(p => p.status === "concluido" && p.data_conclusao);
  const slaMedio = concl.length ? Math.round(concl.reduce((a, p) => a + (new Date(p.data_conclusao!).getTime() - new Date(p.created_at).getTime()) / 86400000, 0) / concl.length) : 0;

  // Recurrence (all-time, not just period)
  const { data: allNc } = await supabase.from("audit_answers")
    .select("item_id,created_at").eq("empreendimento_id", empId).eq("status", "nao_conforme");
  const recMap = new Map<string, { qtd: number; ultima: string }>();
  (allNc ?? []).forEach((a: any) => {
    const c = recMap.get(a.item_id);
    if (c) { c.qtd++; if (a.created_at > c.ultima) c.ultima = a.created_at; }
    else recMap.set(a.item_id, { qtd: 1, ultima: a.created_at });
  });
  const reincidencias = Array.from(recMap.entries())
    .filter(([, v]) => v.qtd > 1)
    .map(([itemId, v]) => ({ item: itemMap.get(itemId)!, cat: categories.find(c => c.id === itemMap.get(itemId)?.category_id)!, qtd: v.qtd, ultima: v.ultima }))
    .filter(r => r.item && r.cat)
    .sort((a, b) => b.qtd - a.qtd);

  // Risk matrix 5x5 — derived from NC criticidade & status
  const matrix = Array.from({ length: 5 }, () => Array(5).fill(0));
  plans.filter(p => p.status !== "concluido").forEach(p => {
    const prob = p.prioridade === "critica" ? 4 : p.prioridade === "alta" ? 3 : p.prioridade === "media" ? 2 : 1;
    const imp = vencidos > 0 && p.prazo && p.prazo < today ? 4 : prob;
    matrix[prob][imp]++;
  });

  const riscoIndex = nc * 3 + criticos * 5 + vencidos * 2;
  const universo = allItems.length;
  const naCount = answers.filter(a => a.status === "nao_aplicavel").length;
  const auditado = total + naCount;
  const cobertura = universo ? Math.round((auditado / universo) * 100) : 0;

  const code = `RPS-AOC-${emp.codigo}-${period.replace("-", "")}-v1`;

  // --- Histórico dos últimos 6 meses (inclusive período atual) ---
  const historico: ReportData["historico"] = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(y, m - 1 - i, 1);
    const py = dt.getFullYear(); const pm = dt.getMonth() + 1;
    const pStart = `${py}-${String(pm).padStart(2, "0")}-01`;
    const pEnd = new Date(py, pm, 1).toISOString().slice(0, 10);
    const { data: pa } = await supabase.from("audit_answers")
      .select("status").eq("empreendimento_id", empId).gte("created_at", pStart).lt("created_at", pEnd);
    const list = (pa ?? []) as Array<{ status: string }>;
    const ttl = list.filter(a => a.status !== "nao_aplicavel").length;
    const c = list.filter(a => a.status === "conforme").length;
    const pc = list.filter(a => a.status === "parcial").length;
    const ncc = list.filter(a => a.status === "nao_conforme").length;
    const sc = ttl ? Math.round((c * 100 + pc * 50) / ttl) : 0;
    historico.push({
      period: `${py}-${String(pm).padStart(2, "0")}`,
      label: dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
      score: sc, nc: ncc, total: ttl,
    });
  }

  // --- Distribuição por criticidade das NCs ---
  const ncItems = answers.filter(a => a.status === "nao_conforme")
    .map(a => itemMap.get(a.item_id)).filter(Boolean) as Item[];
  const criticidadeDist = {
    critica: ncItems.filter(i => i.criticidade === "critica").length,
    alta: ncItems.filter(i => i.criticidade === "alta").length,
    media: ncItems.filter(i => i.criticidade === "media").length,
    baixa: ncItems.filter(i => i.criticidade === "baixa").length,
  };

  // --- Evidências (imagens) para embarcar no PDF — top 6 NCs com evidência ---
  const evidenceShots: ReportData["evidenceShots"] = [];
  const ncAnswerIds = answers.filter(a => a.status === "nao_conforme").map(a => a.id);
  if (ncAnswerIds.length) {
    const { data: evList } = await supabase.from("evidences")
      .select("answer_id,storage_path,mime_type")
      .in("answer_id", ncAnswerIds).limit(20);
    const imgs = (evList ?? []).filter((e: any) => (e.mime_type ?? "").startsWith("image/"));
    for (const ev of imgs.slice(0, 6)) {
      try {
        const { data: signed } = await supabase.storage.from("audit-evidences")
          .createSignedUrl((ev as any).storage_path, 600);
        if (!signed?.signedUrl) continue;
        const resp = await fetch(signed.signedUrl);
        if (!resp.ok) continue;
        const buf = new Uint8Array(await resp.arrayBuffer());
        const ans = answers.find(a => a.id === (ev as any).answer_id);
        const it = ans ? itemMap.get(ans.item_id) : undefined;
        const ct = categories.find(c => c.id === it?.category_id);
        if (!it || !ct) continue;
        evidenceShots.push({
          catCodigo: ct.codigo, itemCodigo: it.codigo, pergunta: it.pergunta,
          bytes: buf, mime: (ev as any).mime_type || "image/jpeg",
        });
      } catch { /* ignore */ }
    }
  }

  return {
    emp, period, startISO, endISO, reportCode: code, emittedAt: new Date().toISOString(),
    cats: categories, items: allItems, answers, plans, byCat,
    kpi: { total, conformes, nc, parcial, pendente, score, classificacao: classify(score), criticos, vencidos, reincidencias: reincidencias.length, slaMedio, riscoIndex },
    amostragem: { universo, auditado, cobertura, criticos: nc, evidencias: (evs ?? []).length },
    reincidencias, riskMatrix: matrix, evidencesCount: (evs ?? []).length,
    historico, criticidadeDist, evidenceShots,
  };
}

export interface Narrative {
  introducao: string;
  metodologia: string;
  parecerExecutivo: string;
  conclusao: string;
  recomendacoes: string;
  disciplinas: Record<string, string>; // category code -> commentary
}

export async function generateNarrative(d: ReportData): Promise<Narrative> {
  const sumario = `Empreendimento: ${d.emp.codigo} - ${d.emp.nome}\nPeríodo: ${d.period}\nItens auditados: ${d.kpi.total}\nConformidade: ${d.kpi.score}% (${d.kpi.classificacao})\nNCs: ${d.kpi.nc} | Críticos abertos: ${d.kpi.criticos} | Vencidos: ${d.kpi.vencidos} | Reincidências: ${d.kpi.reincidencias}\nDisciplinas: ${d.byCat.map(b => `${b.cat.codigo} ${b.conformidade}% (${b.risco})`).join(" · ")}`;

  const ask = async (action: string, question: string, context = sumario) => {
    const { data, error } = await supabase.functions.invoke("audit-assistant", { body: { action, context, question } });
    if (error) throw error;
    return (data as any).content as string;
  };

  const [introducao, metodologia, parecerExecutivo, conclusao, recomendacoes] = await Promise.all([
    ask("livre", "Escreva a INTRODUÇÃO do relatório executivo (3 parágrafos curtos, linguagem corporativa Big Four): objetivo da auditoria, escopo, contexto operacional do empreendimento, importância da conformidade, premissas e limitações. Sem títulos, apenas o texto."),
    ask("livre", "Escreva a seção METODOLOGIA (2 parágrafos): cite auditoria por amostragem, entrevistas, inspeções visuais, análise documental, cruzamento de evidências e os referenciais ISO 9001, ISO 41001, ISO 45001 e práticas de compliance operacional e gestão de riscos. Sem títulos."),
    ask("parecer", "Produza o PARECER EXECUTIVO técnico (3 parágrafos) destacando conformidade, principais riscos, NCs críticas, reincidências, vencidos e maturidade da gestão."),
    ask("livre", "Escreva a CONCLUSÃO EXECUTIVA (2 parágrafos): situação geral, maturidade operacional, riscos centrais, oportunidades, necessidade de ações imediatas."),
    ask("livre", "Liste de 5 a 8 RECOMENDAÇÕES ESTRATÉGICAS objetivas (bullets curtos) priorizadas por impacto. Use apenas '- ' como marcador."),
  ]);

  // Per discipline commentary — single call returning all
  const discCtx = sumario + "\n\nDetalhe por disciplina:\n" + d.byCat.map(b =>
    `${b.cat.codigo} (${b.cat.nome}): ${b.conformidade}% conformidade, NCs=${b.nc}, risco=${b.risco}. ${b.nclist.slice(0,3).map(x=>x.item.codigo+" "+x.item.pergunta).join(" | ")}`
  ).join("\n");
  const discResp = await ask("livre",
    `Para CADA disciplina abaixo gere 2 frases técnicas (visão geral + principal recomendação). Responda no formato exato:\n${d.byCat.map(b=>"["+b.cat.codigo+"] <texto>").join("\n")}\nSem outros textos. Cada disciplina em uma linha começando por [CODIGO].`,
    discCtx);
  const disciplinas: Record<string, string> = {};
  discResp.split(/\n+/).forEach(line => {
    const m = line.match(/^\[([^\]]+)\]\s*(.+)$/);
    if (m) disciplinas[m[1].trim()] = m[2].trim();
  });

  return { introducao, metodologia, parecerExecutivo, conclusao, recomendacoes, disciplinas };
}