# Plano: Auditoria Operacional RPS — Evolução para SaaS Premium

Mantenho **toda a estrutura atual** (Auth, empreendimentos, processes/subprocesses, campanhas, design tokens navy+gold, login). A evolução é feita em fases incrementais, cada uma testável isoladamente.

## Visão geral da arquitetura nova

O sistema atual usa `audit_processes` / `audit_subprocesses` / `audit_results` (pesos + metas numéricas).
Vou **complementar** (não substituir) com um modelo de **checklist por item** (categorias × perguntas × respostas Conforme/NC/Parcial), que é o que sua spec descreve. O Dashboard executivo passa a **agregar automaticamente** dos dois modelos.

```text
[ Auditoria atual: metas numéricas ] ─┐
                                       ├──► Dashboard Executivo (KPIs + gráficos)
[ Checklist novo: itens conforme/NC ] ─┘
                                       │
                                       ├──► Plano de Ação (gerado de NCs)
                                       ├──► Score Operacional
                                       ├──► Reincidências
                                       └──► Relatório Executivo (PDF/XLSX/PPTX)
```

## Fase 1 — Fundação de dados e layout executivo
**Backend (migration):**
- `audit_categories` (10 categorias da spec, seed)
- `audit_items` (código, categoria, pergunta, criticidade, evidência obrigatória, SLA padrão)
- `audit_answers` (resposta por auditoria × item: status, comentário, responsável, prazo, conclusão)
- `evidences` (storage bucket `audit-evidences` + tabela com link ao answer)
- `action_plans` (vinculado ao answer NC: ação, responsável, prazo, prioridade, status, evidência conclusão)
- `recurrence_logs` (view materializada de itens NC repetidos)
- Enums: `criticidade` (baixa/media/alta/critica), `answer_status` (conforme/nao_conforme/parcial/nao_aplicavel/pendente), `action_status` (aberto/em_andamento/concluido/vencido)
- Novos roles: `administrador`, `diretor`, `gerente_regional`, `auditor`, `cliente` (mantém diretoria/gestor/sindico como aliases)
- RLS por empreendimento + papel
- Trigger: ao criar answer NC, gerar `action_plan` automaticamente com prazo SLA pela criticidade

**Frontend:**
- Sidebar fixa executiva (substitui Tabs no topo) com: Dashboard, Auditorias, Checklist, Plano de Ação, Reincidências, Relatórios, Empreendimentos, Campanhas, Configurações
- Layout `AppShell` (sidebar + topbar com filtros globais + breadcrumb)
- Refino de tokens: branco/azul institucional mais executivo, sombras suaves, sem excesso de ícones

## Fase 2 — Checklist + Plano de Ação + Evidências
- Tela **Checklist de Auditoria** por empreendimento/período: tabela por categoria, status, criticidade, upload drag-and-drop (react-dropzone), comentário, responsável, prazo
- Tela **Plano de Ação**: kanban (Aberto / Em andamento / Concluído / Vencido) + tabela com semáforo (vermelho vencido, amarelo ≤3 dias, verde concluído)
- Cálculo de **Score Operacional** (função SQL): conforme=100, parcial=50, pendente=25, NC=0, NA ignorado. Score por empreendimento/categoria/gestor/regional/mês
- Histórico de tratativas por item

## Fase 3 — Dashboard Executivo automático
Substitui `AuditDashboard` por `ExecutiveDashboard` que **lê de answers + action_plans**:
- 9 KPI cards: total auditados, conformes, NC, críticos, pendentes, % conformidade, SLA médio, reincidências, risco consolidado
- Gráficos (Recharts): conformidade por empreendimento (BarChart), NCs por categoria (BarChart horizontal), riscos por criticidade (PieChart), evolução mensal (LineChart), ranking de empreendimentos (BarChart)
- Filtros globais (topbar): empreendimento, regional, gestor, categoria, criticidade, status, período, vencidos, críticos
- Alertas (banner no topo): item crítico aberto, plano vencido, evidência faltante, reincidência, score <75%, auditoria do mês não feita

## Fase 4 — Reincidências, Relatório Executivo e IA
- **Reincidências**: tabela com item/categoria/empreendimento/gestor, qtd, última ocorrência, status, recomendação IA
- **Relatório Executivo**: edge function `generate-executive-report`
  - PDF (pdf-lib server-side) com capa logo RPS + sumário + score + riscos + NCs críticas + evolução + plano + parecer
  - Excel (SheetJS) e PowerPoint (PptxGenJS) — exportações client-side
- **Assistente IA** (drawer lateral): edge function `audit-assistant` usando Lovable AI Gateway (gemini-3-flash-preview), com ações: resumir auditoria, gerar parecer, criar plano de ação, identificar riscos ocultos, gerar e-mail de cobrança, comparar empreendimentos
- Cron diário (`pg_cron`) para detectar planos vencidos e atualizar status

## Detalhes técnicos
- Stack mantida: React + Vite + Tailwind + shadcn + Recharts + Supabase
- Adicionar: `react-dropzone`, `pdf-lib`, `xlsx`, `pptxgenjs`
- Storage bucket `audit-evidences` (privado, RLS por empreendimento)
- AI via Lovable AI Gateway (sem custo de API key extra)
- Compatibilidade: telas atuais (`AuditDashboard`, `CampanhasModule`, `EmpreendimentosModule`) **permanecem funcionais**; ficam acessíveis na sidebar até toda a Fase 3 estar entregue e validada por você

## Execução
Vou começar pela **Fase 1** assim que aprovar. Cada fase termina em estado utilizável — você valida e libera a próxima. Estimativa: Fase 1 (1 turno grande), Fase 2 (1-2 turnos), Fase 3 (1 turno), Fase 4 (1-2 turnos).

**Confirma esse plano ou prefere ajustar prioridade (ex: começar pelo Dashboard executivo + checklist e adiar IA/exportações)?**