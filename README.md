# RPS Audit Suite — Auditoria & Compliance de Empreendimentos

> **O que é:** Plataforma de **auditoria e conformidade** para os empreendimentos administrados pela RPS.
> Estrutura campanhas de auditoria, checklists por categoria/item, registra respostas (conforme / não
> conforme / parcial), anexa evidências, gera planos de ação para as não-conformidades, controla
> reincidências e produz relatórios executivos — com um assistente de IA de auditoria.

---

## 1. Conceito e público

- **Usuário-alvo:** diretoria, gerentes regionais, auditores e síndicos/clientes (papéis variados).
- **Objetivo:** padronizar e medir a qualidade da operação predial por meio de auditorias recorrentes,
  transformando achados em planos de ação rastreáveis e reduzindo reincidências.
- **Multi-empreendimento:** há um `EmpreendimentoContext` que define o ativo "em foco" em toda a navegação.

## 2. Stack técnica

Vite 5 + React 18 + TS · shadcn/ui + Tailwind · React Query · react-router v6 ·
Supabase (projeto `hpntnbqswgkwjzxsufiy`) · Recharts · jsPDF (relatórios) · Zod · Vitest.

## 3. Estrutura e fluxos

```
src/
  App.tsx                 → /auth + rotas protegidas dentro de AppShell
  contexts/
    AuthContext           → sessão Supabase
    EmpreendimentoContext → empreendimento selecionado (escopo global)
  layouts/AppShell + components/AppSidebar
  pages/
    ExecutiveDashboard    → visão executiva (home)
    AuditoriaPage         → execução da auditoria
    ChecklistPage         → checklist de itens por categoria
    PlanosPage            → planos de ação (não-conformidades)
    ReincidenciasPage     → reincidência de achados
    RelatoriosPage        → relatórios/export
    EmpreendimentosPage, CampanhasPage, ModulePlaceholder (config — Fase 2)
  components/
    AuditDashboard, CampanhasModule, EmpreendimentosModule, AIAssistantDrawer (IA)
  lib/                    → reportData, reportExports, reportPdf
supabase/
  migrations/             → schema de auditoria (ver abaixo)
  functions/audit-assistant → Edge Function de IA (assistente de auditoria)
```

## 4. Modelo de dados (Supabase)

- **Papéis:** `app_role` começa com `(diretoria, gestor, sindico)` e é estendido com
  `administrador, diretor, gerente_regional, auditor, cliente`. `user_roles` separada + `has_role()`.
- **Trigger `handle_new_user`:** cria `profile` (id, email, nome) — papel atribuído depois (`seed.sql`).
- **Tabelas:** `empreendimentos`, `profiles`, `audit_processes` + `audit_subprocesses`,
  `audit_categories` + `audit_items` + `audit_answers`, `evidences`, `action_plans`,
  `audit_reports` + `audit_results`, `campanhas`.
- **Enums:** `audit_status(compliant, warning, critical)`, `answer_status(conforme, nao_conforme,
  parcial, nao_aplicavel, pendente)`, `criticidade`, `campanha_status`, `action_status`.

## 5. Estado atual

- ✅ **Login Supabase já implementado** (`pages/Auth.tsx`).
- ✅ Modelo de auditoria robusto (categorias → itens → respostas → evidências → planos).
- ⚠️ O enum `app_role` foi estendido em migração posterior; conferir consistência das políticas RLS com os novos papéis.

## 6. Melhorias propostas (priorizadas)

**Alta**
1. **Atribuir papel no cadastro** (trigger só cria profile). Sem papel, RLS bloqueia tudo. Ver `seed.sql`.
2. **Restringir signup** ao domínio `@rpsglobal.com.br` (clientes externos, se houver, entram por convite/Admin).
3. **Revisar RLS após extensão de papéis:** garantir que `auditor`, `gerente_regional`, `cliente`
   tenham políticas explícitas coerentes (princípio do menor privilégio).

**Média**
4. Estados de loading/erro/vazio padronizados nas páginas com React Query.
5. Memoização e/ou paginação das listas de itens/respostas em auditorias grandes.
6. Versionar/auditar quem alterou respostas (trilha de auditoria da própria auditoria).

**Baixa**
7. Lazy-load das páginas de relatório (jsPDF é pesado) e do `AIAssistantDrawer`.
8. Testes do cálculo de score/criticidade e de reincidência.
9. Exportações com template visual padronizado RPS.

## 7. Como rodar

```bash
npm install
npm run dev
npm run build
npm run test
```

## 8. Usuários de acesso (seed)

`supabase/seed.sql` cria `lucas.fernandes@rpsglobal.com.br` (**administrador/diretoria**) e
`bruno.aleixo@rpsglobal.com.br` (**gestor**) — rodar após as migrations.
