# RGM Insights — Relatório Gerencial Mensal

> Plataforma da **RPS Real Property Solution** para elaborar, publicar e apresentar o
> Relatório Gerencial Mensal dos empreendimentos administrados.
> Substitui o fluxo Excel → gráficos → PowerPoint por um relatório vivo, versionado por
> competência, com modo apresentação para a reunião e PDF para o arquivo.

---

## 1. O problema que este sistema resolve

O gestor levava horas por mês coletando dados, montando gráficos no Excel e transportando
tudo para o PPTX — a ponto de alguns relatórios simplesmente não serem entregues.

A resposta aqui não é "um editor de slides mais rápido". É **eliminar a redigitação**:

| Antes | Agora |
| --- | --- |
| Todo mês remontava a planilha do zero | O mês novo herda a estrutura do anterior (contratos, documentos, fornecedores, grupos contábeis) |
| Digitava "Vigente" ao lado do documento | Informa a **data de validade**; vigente/a vencer/vencido é calculado |
| Digitava a variação de consumo | Informa o consumo; a variação e a base de comparação vêm do mês anterior |
| Montava a tabela de semáforos do sumário à mão | O **Sumário 360°** se monta a partir das outras seções — nunca fica inconsistente |
| Somava saldo e inadimplência na calculadora | Saldo e posição consolidada são derivados e encadeados entre meses |
| Apresentava um PPTX estático | Modo apresentação em tela cheia + PDF, a partir do mesmo dado |

## 2. Estrutura do relatório

Espelha o RGM que a RPS já entrega (ver `public/templates`, exemplo Send Cooliving):
capa · **sumário executivo 360°** · financeiro · operação e manutenção · fornecedores e SLA ·
contratos · documentos e compliance · jurídico e inadimplência · utilidades · CAPEX ·
matriz de riscos · próximos passos · evidências fotográficas · conclusão.

### Índice executivo

Média ponderada de dez indicadores, cada um com critério de semáforo explícito e visível ao
síndico. Indicadores **sem dado lançado saem do cálculo** (os pesos são renormalizados) em vez de
virar zero — um relatório em preenchimento não é punido por seções ainda vazias.

## 3. Stack

Vite 5 · React 18 · TypeScript · Tailwind + shadcn/ui · Recharts · React Query ·
react-router v6 · Supabase (Postgres + Auth + Storage) · Vitest.

```
src/
  lib/
    types.ts      → modelo de domínio (valores são number, não string)
    format.ts     → formatação pt-BR e parsing tolerante de valores colados do Excel
    metrics.ts    → TUDO que é derivado: semáforos, índice, alertas, sumário 360°
    defaults.ts   → relatório em branco, herança do mês anterior, normalização do JSONB
  hooks/          → useRelatorios, useAutosave, useFotos, useEmpreendimentos
  components/
    campos/       → inputs com máscara pt-BR e badges de semáforo
    relatorio/    → seções editáveis + RelatorioImpresso (versão A4)
    layout/       → AppShell
  pages/
    Auth · Dashboard · Empreendimentos · EditorRelatorio · Apresentacao
supabase/
  migrations/     → schema completo (idempotente)
```

## 4. Configuração

### 4.1 Banco de dados

Abra o **SQL Editor** do projeto Supabase, cole o conteúdo de
`supabase/migrations/20260815000000_rgm_schema.sql` e execute. É idempotente — rodar de novo não
quebra nada. Isso cria tabelas, RLS, o bucket de fotos e o gatilho de criação de perfil.

### 4.2 Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha com **Project URL** e a chave **anon/publishable** (Dashboard → Project Settings → API).

> A chave `service_role` ignora todas as regras de segurança do banco. Ela nunca vai no
> frontend nem no Git. O `.env` está no `.gitignore`.

### 4.3 Rodar

```bash
npm install
npm run dev      # http://localhost:8080
npm run build
npm run test     # 28 testes do motor de cálculo
npm run lint
```

## 5. Papéis e acesso

| Papel | Enxerga | Pode editar |
| --- | --- | --- |
| `diretoria`, `gestor` | todos os empreendimentos, inclusive rascunhos | sim |
| `sindico`, `proprietario` | só os ativos vinculados, só relatórios **publicados** | não |

O vínculo do cliente externo com o ativo é feito na tabela `empreendimento_acessos`.
Quem se cadastra recebe o papel `gestor` por padrão — ajuste em `user_roles` conforme a política
interna. As regras são aplicadas por **RLS no banco**, não apenas na interface.

## 6. Fluxo de trabalho

1. **Cadastre o empreendimento** (uma vez).
2. **Crie o relatório do mês** — se existir o mês anterior, ele já nasce preenchido.
3. **Preencha** com autosave contínuo; a barra lateral mostra o que falta.
4. O editor **detecta pendências** (documento vencendo, desvio sem justificativa, SLA baixo) e
   permite virar cada uma em item da matriz de riscos com um clique.
5. **Publique** — o relatório congela e fica visível para síndico e proprietário.
6. **Apresente** (`Apresentar`) ou gere o **PDF** (`Ctrl+P` / botão PDF).

Atalhos da apresentação: `→` `espaço` avança · `←` volta · `F` tela cheia · `Esc` sai.

## 7. Estado atual e próximos passos

**Entregue:** persistência por empreendimento/competência, autosave, login e papéis com RLS,
herança do mês anterior, cálculo derivado de status/variações/índice, upload de fotos para o
Storage (com URL assinada, entrando no PDF), modo apresentação, exportação em PDF.

**Próximos passos sugeridos:**

1. Link público com token para o proprietário abrir sem criar conta.
2. Importar a fatura da concessionária / extrato para preencher utilidades e financeiro.
3. Notificação automática quando documento entra na janela de 60 dias.
4. Comparativo entre empreendimentos para a diretoria.
5. Code splitting — o bundle passou de 500 kB e hoje é um chunk único.

---

RPS Real Property Solution · *Qualidade e confiança para seu patrimônio.*
