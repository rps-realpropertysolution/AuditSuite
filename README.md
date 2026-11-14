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
| Todo mês remontava a planilha do zero | O mês novo herda a estrutura do anterior (contratos, documentos, fornecedores, fundos, disciplinas) |
| Digitava "Vigente" ao lado do documento | Informa a **data de validade**; vigente/a vencer/vencido é calculado |
| Digitava a variação de consumo | Informa o consumo; a variação e a base de comparação vêm do mês anterior |
| Montava a tabela de semáforos do sumário à mão | O **Sumário 360°** se monta a partir das outras seções — nunca fica inconsistente |
| Somava saldo e inadimplência na calculadora | Derivados da tabela por fundo/rubrica e encadeados entre meses |
| Apresentava um PPTX estático | Modo apresentação em tela cheia + PDF, a partir do mesmo dado |

### De onde vinham os dados

O relatório em uso hoje (`public/templates`, fora do versionamento) tem 36 slides e é montado
com **prints de sete origens diferentes** — sistema contábil, Excel de orçamento, Excel de
utilidades, dashboard do sistema de OS, PDFs de certidões, PJe e fotos de campo. O tempo do
gestor não vai em escrever: vai em navegar esses sistemas e recortar tela.

O modelo de dados foi desenhado a partir desses prints, mantendo a mesma abertura que o síndico
já conhece — e de forma **independente da origem**: hoje o gestor digita, amanhã uma API popula
os mesmos campos sem alterar a estrutura.

| Bloco | Estrutura | Derivado |
| --- | --- | --- |
| Resumo financeiro | por fundo: anterior · créditos · débitos | saldo, receita, despesa, resultado |
| Inadimplência | por rubrica: até o mês anterior · recebido · do mês | total por rubrica e consolidado |
| Manutenção | preventivas · corretivas · acompanhamentos · rondas · não realizadas | total, % preventiva, % do programado |
| Utilidades | consumo · ponta · fora ponta · fatura · faltas | variação, consumo médio diário |

## 2. Estrutura do relatório

Segue o **Template Corporativo RPS 360°**: capa · sumário navegável · painel executivo 360° · sete
capítulos · encerramento. Cada slide tem os botões de capítulo no topo e um rodapé com capítulo,
contexto (empreendimento · competência · financeiro · cidade), link para o sumário e número de
página — clicáveis na apresentação e no PDF.

| Capítulo | Slides |
| --- | --- |
| 01 · O empreendimento | ficha do ativo · controle de acesso e ocupação |
| 02 · Gestão financeira | resultado e tendência · fundos e reserva · previsto x realizado · estrutura de custos · arrecadação e inadimplência |
| 03 · Governança e compliance | contratos · documentos legais · jurídico, diligência e certidões |
| 04 · Performance operacional | operação e manutenção · ordens de serviço · fornecedores · registro fotográfico |
| 05 · Sustentabilidade e eficiência | gestão de utilidades |
| 06 · Investimentos e valor gerado | CAPEX · valor gerado (realizado / estimado / projetado / investido) |
| 07 · Gestão de riscos e decisões | plano de ação e matriz de riscos · decisões e próximos passos |

Slide sem dado não entra; o sumário e a paginação se ajustam sozinhos.

### Duas competências

O RGM de outubro apresenta a **operação de outubro** e o **financeiro de setembro** — a última
prestação de contas fechada. O relatório guarda `competenciaFinanceira` (padrão: mês anterior,
ajustável no editor); a importação do LiveFacilities consulta o financeiro nesse mês e a operação no
mês do relatório, e os slides financeiros trazem o mês no título ("· SETEMBRO/2026").

### Índice executivo

Média ponderada de dez indicadores, cada um com critério de semáforo explícito e visível ao
síndico. Indicadores **sem dado lançado saem do cálculo** (os pesos são renormalizados) em vez de
virar zero — um relatório em preenchimento não é punido por seções ainda vazias.

## 3. Stack

Vite 5 · React 18 · TypeScript · Tailwind + shadcn/ui · Recharts · React Query ·
react-router v6 · Supabase (Postgres + Auth + Storage + Edge Functions) · Vitest.

```
src/
  lib/
    types.ts      → modelo de domínio (valores são number, não string)
    format.ts     → formatação pt-BR e parsing tolerante de valores colados do Excel
    metrics.ts    → TUDO que é derivado: semáforos, índice, alertas, sumário 360°
    defaults.ts   → relatório em branco, herança do mês anterior, normalização do JSONB
    leitura.ts    → leitura gerencial automática dos slides
    importacao.ts → mescla dos dados do LiveFacilities no relatório
    entregas.ts   → mês de referência e prazo de entrega
  hooks/          → useRelatorios, useAutosave, useFotos, useEmpreendimentos
  components/
    campos/       → inputs com máscara pt-BR e badges de semáforo
    relatorio/    → seções editáveis do editor
    apresentacao/ → slides 16:9 no padrão RPS (apresentação e PDF)
    layout/       → AppShell
  pages/
    Auth · Dashboard · Empreendimentos · EditorRelatorio · Apresentacao · Acessos
supabase/
  migrations/     → schema completo (idempotente)
  functions/
    livefacilities-importar/   → Edge Function (senha do LiveFacilities fica no servidor)
    _shared/livefacilities/    → cliente somente-leitura + mapeamentos (Deno, Node e Vitest)
scripts/livefacilities/        → teste local da integração
```

## 4. Configuração

### 4.1 Banco de dados

No **SQL Editor** do Supabase, rode **em ordem** os arquivos de `supabase/migrations/`. Todos são
idempotentes — rodar de novo não quebra nada:

1. `20260815000000_rgm_schema.sql` — tabelas, RLS, bucket de fotos, gatilho de perfil;
2. `20260815010000_acesso_por_liberacao.sql` — cadastro sem papel automático;
3. `20261113000000_seguranca_e_integracao.sql` — endurecimento de segurança e campos do
   LiveFacilities (detalhes na seção 5).

### 4.2 Confirmação de e-mail — manter LIGADA

**Authentication → Sign In / Providers → Email → Confirm email** precisa ficar **ligado**.

O papel `gestor` é concedido automaticamente a e-mails `@rpsglobal.com.br` — mas só depois que o
e-mail é confirmado. Com a confirmação desligada, o Supabase marca todo cadastro como confirmado e
qualquer pessoa que digitasse `fulano@rpsglobal.com.br` passaria a ver o financeiro de todos os
clientes. Confira também se o SMTP está configurado (o SMTP padrão do Supabase tem limite baixo).

Para contas internas criadas à mão: **Authentication → Users → Add user** com *Auto Confirm User*.

### 4.3 Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha com **Project URL** e a chave **anon/publishable** (Dashboard → Project Settings → API).

> A chave `service_role` ignora todas as regras de segurança do banco. Ela nunca vai no
> frontend nem no Git. O `.env` está no `.gitignore`.

### 4.4 Integração com o LiveFacilities (RP Smart)

O RGM puxa do LiveFacilities, em um clique, o que hoje é print de sistema:

| Bloco do RGM | Consulta no LiveFacilities |
| --- | --- |
| Resultado e saldo do mês | `GET /FluxoCaixa/FluxoCaixa` |
| Despesas por grupo (previsto x realizado) | `GET /PrestacaoContas/despesas` |
| Arrecadação (emitido x recebido) | `GET /PrestacaoContas/ListaResumoEmissao` |
| Inadimplência por rubrica | `GET /Boleto/ListaBoleto` (paginado) |
| Acordos | `GET /Acordo/ListaAcordo` |
| Ordens de serviço (prazo, backlog, disciplinas) | `GET /OrdemServico/ListaAtividade` |
| Contratos e vigências | `GET /ContratoCompleto` |
| Documentos e validades | `GET /Documento/ListaDocumentoEmpreendimento` |
| Aviso de mês ainda não fechado | `GET /ControleFechamento/ListaControleFechamento` |

**Somente leitura, garantido em código:** o cliente (`supabase/functions/_shared/livefacilities/cliente.ts`)
só aceita as rotas de consulta listadas nele — qualquer rota que grave no sistema é recusada antes
de sair da máquina. A importação **não trava nada**: preenche os campos, o gestor revisa e edita
livremente; justificativas, observações e orçado já escritos são preservados.

Fica para o gestor: leitura do mês e comentários, ocupação e acesso, utilidades, frentes
operacionais, fotos, plano de ação e decisões.

**Passo a passo:**

1. **Usuário de integração** no LiveFacilities, com perfil próprio e só as rotas de leitura
   liberadas (`GERAL > CONFIGURAÇÕES > SISTEMA > GESTÃO DE ACESSOS API(S)`).
2. **Teste local** (na máquina do time — a API pode não ser acessível de ambientes de nuvem):
   ```bash
   # no .env: LF_USUARIO e LF_SENHA (nunca no chat, nunca no Git — e nunca no .env.example)
   npm run lf:empreendimentos                                   # lista código + id de todos os prédios
   npm run lf:testar -- --cd 1006 --id 122 --competencia 2026-10   # financeiro = set/2026
   ```
   Mostra o que o RGM receberia e grava as respostas brutas em `scripts/livefacilities/saida/`
   (fora do Git) para ajustar os mapeamentos em `mapear.ts`, se preciso.
3. **Publicar a Edge Function** (a senha fica nos secrets do Supabase, nunca no navegador):
   ```bash
   supabase secrets set LF_USUARIO=... LF_SENHA=...
   supabase functions deploy livefacilities-importar
   ```
4. **Cadastrar os prédios**: na tela Empreendimentos, **Trazer do LiveFacilities** lista os prédios com
   `cd_condominio` (código de 4 dígitos, ex.: `1006`) e `id_empreendimento` (ex.: 122) e cadastra ou
   vincula os marcados. Prédios só com operação no sistema (sem financeiro) ficam sem id e importam
   apenas as OS.

**Comportamentos da API confirmados contra o sistema real (13/11/2026)** — já tratados no código:

- `PageIndex` começa em **0**; páginas de até 500. Consultas de muitas páginas repetem e perdem itens
  (sem ordenação estável) — por isso a inadimplência busca só boletos em aberto e os pagos depois do
  mês anterior, em janelas pequenas. Validado contra um RGM real: posição, recuperado e novos batem centavo a
  centavo com o RGM de setembro/2026.
- `/OrdemServico/ListaAtividade` pode ignorar o filtro de prédio → filtramos pelo código; lançamentos
  "Somente Registro" (2ª via de boleto etc.) ficam fora da contagem.
- `/ContratoCompleto` e `/Documento/ListaDocumentoEmpreendimento` exigem período (sem ele: erro 500 /
  "período obrigatório").
- O fluxo de caixa dá o consolidado e o **movimento** por fundo, não o saldo por fundo: na primeira
  importação o saldo anterior fica em "Saldo anterior a distribuir" até o gestor repartir.
- Não há rota que liste empreendimentos: a lista sai do controle de fechamento, varrendo os códigos.

### 4.5 Rodar

```bash
npm install
npm run dev        # http://localhost:8080  ·  /demo/rgm mostra os slides com dados fictícios
npm run build
npm run test       # motor de cálculo, integração LiveFacilities, prazos de entrega
npm run typecheck
npm run lint
```

## 5. Papéis e acesso

| Papel | Enxerga | Pode editar |
| --- | --- | --- |
| `administrador` | tudo — passa em qualquer verificação de papel; só ele concede/revoga `administrador` | sim |
| `diretoria`, `gestor` | todos os empreendimentos, inclusive rascunhos | sim |
| `sindico`, `proprietario` | só os ativos vinculados, só relatórios **publicados** | não |

### Como alguém ganha acesso

O cadastro **não concede acesso automaticamente**:

- e-mail `@rpsglobal.com.br` **confirmado** → recebe `gestor`;
- qualquer outro e-mail → fica **sem papel** e vê a tela *Acesso em análise*.

Para liberar um síndico ou proprietário, use a tela **Acessos**: vincule o empreendimento e conceda
o papel. Conceder papéis é exclusivo da `diretoria` (e do `administrador`, o único que concede
`administrador`); vincular empreendimentos, do time interno.
As regras valem **no banco (RLS)**, não só na interface.

### Proteções no banco

- Relatório **publicado não muda**: só o status pode ser alterado (reabrir). Excluir um publicado,
  só a diretoria.
- **Fotos** seguem a permissão do relatório: síndico só vê foto de relatório publicado do seu prédio;
  quem está "em análise" não vê nada.
- Funções auxiliares de permissão não são executáveis pelo papel anônimo.

## 6. Fluxo de trabalho

1. **Painel de entregas** abre no mês **fechado** (em novembro, outubro), com o prazo de entrega
   (dia 10 do mês seguinte — `PRAZO_DIA` em `src/lib/entregas.ts`) e quem está atrasado.
2. **Gerar o mês de todos os ativos** em um clique: cria cada relatório herdando o mês anterior e,
   nos integrados, já importa os números do LiveFacilities.
3. **Importe os arquivos do sistema** (botão *Importar arquivos*): o que a API não entrega sai de
   relatórios do LiveFacilities que o gestor exporta e arrasta no editor — tudo lido no navegador:

   | Arquivo | Onde gerar | Preenche |
   | --- | --- | --- |
   | Previsto x Realizado (PDF) | Relatórios › Financeiro | orçado e realizado por grupo |
   | Posição Financeira (PDF) | Relatórios › Financeiro | saldo de cada fundo |
   | Lista de Boletos Pagos (Excel) | Relatórios › Financeiro | conferência dos créditos do mês |
   | Contas Sabesp / Enel (PDF) | Lista Geral de Contas › Documento | água e energia |
   | Lista de Pedidos (Excel) | Administrativo › Compras | slide de suprimentos |
   | Prestação de Contas Operacional (PDF) | Operacional (com fotos) | fotos das OS — na seção Evidências |

   O arquivo é recusado, com o motivo, se for de outro prédio ou de outro mês (o financeiro do RGM é
   a **última prestação fechada**, normalmente o mês anterior). Em lote: `scripts/rgm/importar-arquivos.ts`.
4. **Revise e complete** no editor: o resumo da importação mostra o que veio, o que conferir e o
   que fica com você. Autosave contínuo; a barra lateral mostra o que falta.
5. Sem tempo para escrever? A apresentação gera uma **leitura gerencial automática** a partir dos
   números. O texto do gestor, quando existe, sempre prevalece.
6. **Publique** — o relatório congela e fica visível para síndico e proprietário.
7. **Apresente** ou gere o **PDF**: os mesmos slides 16:9 no padrão visual RPS (capa, painel 360°,
   financeiro, inadimplência, OS, contratos, documentos, riscos, decisões…). Slide sem dado não entra.

Atalhos da apresentação: `→` `espaço` avança · `←` volta · `G` todos os slides · `F` tela cheia ·
`Esc` sai.

## 7. Próximos passos sugeridos

1. Validar a importação com dados reais (`npm run lf:testar`) e ajustar os mapeamentos.
2. **Exportar PPTX editável** (PptxGenJS) a partir dos mesmos dados, para quem precisar mexer no
   arquivo.
3. Slides do template ainda sem fonte de dados no sistema: **suprimentos e pedidos de compra**,
   **Mercado Livre de energia e ESG** e o cronograma (Gantt) de CAPEX.
4. Ocupação e lista de empreendimentos pela API antiga do LiveFacilities.
5. Login com a conta Microsoft da RPS (Azure AD) para o time interno, no lugar do domínio de e-mail.
6. Link público com token para o proprietário abrir sem criar conta.
7. Lembrete automático ao gestor quando o prazo de entrega se aproxima.

---

RPS Real Property Solution · *Qualidade e confiança para seu patrimônio.*
