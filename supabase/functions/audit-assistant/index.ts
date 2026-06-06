// Lovable AI Gateway — Assistente de Auditoria RPS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, context, question } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const systemPrompts: Record<string, string> = {
      resumir: "Você é um auditor sênior de property management. Resuma a auditoria de forma executiva, em até 6 bullets, destacando conformidade, principais não conformidades, riscos críticos e recomendações.",
      parecer: "Você é um auditor sênior. Produza um parecer técnico executivo (3 parágrafos) sobre o desempenho operacional do empreendimento.",
      plano: "Você é um consultor operacional. Gere um plano de ação prático em formato de lista numerada (ação, responsável sugerido, prazo em dias, prioridade) para corrigir as não conformidades fornecidas.",
      riscos: "Você é um analista de riscos. Identifique riscos ocultos e tendências preocupantes nos dados, com criticidade (Alta/Média/Baixa) e justificativa.",
      email: "Você é gerente regional. Escreva um e-mail formal de cobrança ao gestor do empreendimento sobre pendências de auditoria. Tom profissional e firme.",
      livre: "Você é assistente de auditoria operacional RPS. Responda de forma objetiva e executiva.",
    };
    const system = systemPrompts[action] ?? systemPrompts.livre;
    const userMsg = `Contexto da auditoria:\n${context ?? "(sem contexto)"}\n\nPergunta/Instrução:\n${question ?? "Execute a ação solicitada."}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
      }),
    });
    if (res.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos do Lovable AI insuficientes. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});