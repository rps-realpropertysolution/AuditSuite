/**
 * Modo apresentação — substitui o PPTX na reunião de prestação de contas.
 *
 * Pensado para quem ASSISTE, não para quem edita: um assunto por tela, número
 * grande, semáforo à vista e linguagem direta. Navegação por seta, espaço,
 * clique ou toque; `F` entra em tela cheia; `Esc` volta ao editor.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight, Loader2, Maximize2, X } from "lucide-react";
import { useUrlsAssinadas } from "@/hooks/useFotos";
import { useHistorico, useRelatorio } from "@/hooks/useRelatorios";
import {
  contarContratos,
  contarDocumentos,
  calcularIndiceExecutivo,
  despesaSobreReceita,
  despesaTotal,
  indicadores360,
  inadimplenciaDoMes,
  inadimplenciaRecebida,
  inadimplenciaTotal,
  percentualPreventiva,
  percentualRealizado,
  receitaTotal,
  saldoTotal,
  semaforoDaNota,
  semaforoGeral,
  situacaoDocumento,
  totalAcessos,
  totalManutencoes,
  vacancia,
  variacao,
  variacaoConsumo,
} from "@/lib/metrics";
import {
  formatarCompetencia,
  formatarCompetenciaCurta,
  formatarData,
  formatarMoeda,
  formatarMoedaCompacta,
  formatarNumero,
  formatarVariacao,
} from "@/lib/format";
import type { Relatorio, Semaforo } from "@/lib/types";
import logoRps from "@/assets/logo-rps.svg";
import headerBg from "@/assets/header-sp-2.jpg";

const COR: Record<Semaforo, string> = {
  verde: "hsl(var(--semaforo-verde))",
  amarelo: "hsl(var(--semaforo-amarelo))",
  vermelho: "hsl(var(--semaforo-vermelho))",
};

const ROTULO: Record<Semaforo, string> = {
  verde: "Sob controle",
  amarelo: "Requer atenção",
  vermelho: "Ação imediata",
};

/* -------------------------------------------------------------------------- */
/* Peças visuais                                                               */
/* -------------------------------------------------------------------------- */

const Slide = ({
  titulo,
  subtitulo,
  children,
}: {
  titulo?: string;
  subtitulo?: string;
  children: ReactNode;
}) => (
  <div className="flex h-full w-full flex-col px-[6vw] py-[5vh]">
    {titulo ? (
      <header className="mb-[3vh] shrink-0">
        <h2 className="text-[clamp(1.6rem,3.4vw,2.8rem)] font-bold leading-tight text-foreground">
          {titulo}
        </h2>
        {subtitulo ? (
          <p className="mt-1 text-[clamp(0.85rem,1.2vw,1.1rem)] text-muted-foreground">{subtitulo}</p>
        ) : null}
      </header>
    ) : null}
    <div className="min-h-0 flex-1">{children}</div>
  </div>
);

const Numerao = ({
  rotulo,
  valor,
  apoio,
  cor,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
  cor?: string;
}) => (
  <div className="flex flex-col justify-center rounded-2xl border border-border bg-card p-[2.2vh] shadow-sm">
    <span className="text-[clamp(0.65rem,0.9vw,0.85rem)] font-bold uppercase tracking-wide text-muted-foreground">
      {rotulo}
    </span>
    <strong
      className="mt-1 block text-[clamp(1.3rem,3vw,2.4rem)] font-bold tabular-nums leading-none"
      style={{ color: cor ?? "hsl(var(--foreground))" }}
    >
      {valor}
    </strong>
    {apoio ? (
      <span className="mt-1.5 text-[clamp(0.65rem,0.95vw,0.9rem)] text-muted-foreground">{apoio}</span>
    ) : null}
  </div>
);

const TabelaSlide = ({ cabecalho, linhas }: { cabecalho: string[]; linhas: ReactNode[][] }) => (
  <div className="h-full overflow-auto rounded-xl border border-border">
    <table className="w-full border-collapse text-[clamp(0.7rem,1.05vw,1rem)]">
      <thead className="sticky top-0">
        <tr className="bg-surface-soft">
          {cabecalho.map((c) => (
            <th key={c} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide text-muted-foreground">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => (
          <tr key={i} className="border-t border-border">
            {linha.map((celula, j) => (
              <td key={j} className="px-3 py-2.5 align-middle">
                {celula}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Farol = ({ semaforo, texto }: { semaforo: Semaforo; texto: string }) => (
  <span
    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-[clamp(0.65rem,0.95vw,0.9rem)] font-bold"
    style={{ backgroundColor: `${COR[semaforo]}1f`, color: COR[semaforo] }}
  >
    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COR[semaforo] }} />
    {texto}
  </span>
);

const SemDados = ({ children }: { children: ReactNode }) => (
  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border">
    <p className="max-w-md text-center text-[clamp(0.85rem,1.2vw,1.1rem)] text-muted-foreground">
      {children}
    </p>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Página                                                                      */
/* -------------------------------------------------------------------------- */

const Apresentacao = () => {
  const { id } = useParams<{ id: string }>();
  const navegar = useNavigate();
  const { data: relatorio, isLoading } = useRelatorio(id);
  const { data: historico = [] } = useHistorico(relatorio?.empreendimento_id, 13);
  const [indice, setIndice] = useState(0);

  const slides = useMemo(() => (relatorio ? montarSlides(relatorio, historico) : []), [relatorio, historico]);
  const total = slides.length;

  const ir = useCallback(
    (delta: number) => setIndice((i) => Math.min(Math.max(i + delta, 0), Math.max(total - 1, 0))),
    [total],
  );

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        ir(1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        ir(-1);
      } else if (e.key === "Escape" && !document.fullscreenElement) {
        navegar(`/relatorio/${id}`);
      } else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => undefined);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ir, navegar, id]);

  if (isLoading || !relatorio) {
    return (
      <div className="flex h-screen items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Preparando apresentação…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Conteúdo */}
      <main className="min-h-0 flex-1">{slides[indice]}</main>

      {/* Controles */}
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-card px-5 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navegar(`/relatorio/${id}`)}
            title="Sair da apresentação (Esc)"
            aria-label="Sair da apresentação"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              document.fullscreenElement
                ? void document.exitFullscreen()
                : void document.documentElement.requestFullscreen().catch(() => undefined)
            }
            title="Tela cheia (F)"
            aria-label="Alternar tela cheia"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Trilha de progresso clicável */}
        <div className="flex flex-1 items-center gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ir para o slide ${i + 1}`}
              className={`h-1.5 flex-1 rounded-full transition ${
                i === indice ? "bg-primary" : i < indice ? "bg-primary/35" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="tabular-nums text-xs font-semibold text-muted-foreground">
            {indice + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => ir(-1)}
            disabled={indice === 0}
            aria-label="Slide anterior"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => ir(1)}
            disabled={indice === total - 1}
            aria-label="Próximo slide"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Montagem dos slides                                                         */
/* -------------------------------------------------------------------------- */

const montarSlides = (relatorio: Relatorio, historico: Relatorio[]): ReactNode[] => {
  const d = relatorio.dados;
  const emp = relatorio.empreendimento;
  const nota = calcularIndiceExecutivo(d);
  const geral = semaforoGeral(d);
  const indicadores = indicadores360(d);
  const contratos = contarContratos(d);
  const documentos = contarDocumentos(d);
  const dsr = despesaSobreReceita(d);

  const serie = historico.map((r) => ({
    mes: formatarCompetenciaCurta(r.competencia),
    receita: receitaTotal(r.dados),
    despesa: despesaTotal(r.dados),
    indice: r.indice_executivo ?? 0,
  }));

  const slides: ReactNode[] = [];

  /* -------------------------------------------------------------- 1. capa */
  slides.push(
    <div
      key="capa"
      className="flex h-full flex-col justify-between p-[6vw] text-white"
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(var(--executive) / 0.95), hsl(var(--primary) / 0.88) 55%, hsl(var(--secondary) / 0.8)), url(${headerBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <img src={logoRps} alt="RPS Global" className="h-[6vh] w-auto brightness-0 invert" />
      <div>
        <p className="text-[clamp(0.75rem,1.2vw,1rem)] font-semibold uppercase tracking-[0.3em] opacity-80">
          Relatório Gerencial Mensal
        </p>
        <h1 className="mt-3 text-[clamp(2rem,6vw,4.5rem)] font-bold leading-none">
          {emp?.nome ?? "Empreendimento"}
        </h1>
        <p className="mt-4 text-[clamp(1rem,2vw,1.6rem)] opacity-90">
          {formatarCompetencia(relatorio.competencia)}
        </p>
      </div>
      <p className="text-[clamp(0.9rem,1.5vw,1.3rem)] font-semibold">
        Qualidade e confiança para seu patrimônio.
      </p>
    </div>,
  );

  /* ------------------------------------------------------ 2. farol do mês */
  slides.push(
    <Slide key="farol">
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-[clamp(0.8rem,1.3vw,1.1rem)] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Como o mês fechou
        </p>
        <div
          className="mt-[3vh] flex h-[24vh] w-[24vh] items-center justify-center rounded-full border-[1.2vh]"
          style={{ borderColor: COR[geral], backgroundColor: `${COR[geral]}12` }}
        >
          <div>
            <strong className="block text-[clamp(2.5rem,7vw,5rem)] font-bold leading-none tabular-nums" style={{ color: COR[geral] }}>
              {nota ?? "—"}
            </strong>
            <span className="text-[clamp(0.7rem,1vw,0.9rem)] font-semibold text-muted-foreground">
              índice executivo
            </span>
          </div>
        </div>
        <p className="mt-[3vh] text-[clamp(1.2rem,2.6vw,2rem)] font-bold" style={{ color: COR[geral] }}>
          {ROTULO[geral]}
        </p>
        {d.sumario.avaliacaoGeral ? (
          <p className="mt-[2vh] max-w-3xl text-[clamp(0.85rem,1.35vw,1.15rem)] leading-relaxed text-muted-foreground">
            {d.sumario.avaliacaoGeral}
          </p>
        ) : null}
      </div>
    </Slide>,
  );

  /* --------------------------------------------------- 3. resultados/atenção */
  if (d.sumario.principaisResultados.length || d.sumario.pontosAtencao.length) {
    slides.push(
      <Slide key="destaques" titulo="O que aconteceu no mês">
        <div className="grid h-full gap-[2vw] lg:grid-cols-2">
          {[
            { titulo: "Principais resultados", itens: d.sumario.principaisResultados, cor: COR.verde },
            { titulo: "Pontos de atenção", itens: d.sumario.pontosAtencao, cor: COR.amarelo },
          ].map((bloco) => (
            <div key={bloco.titulo} className="rounded-2xl border border-border bg-card p-[2.5vh]">
              <h3
                className="mb-[2vh] text-[clamp(0.9rem,1.5vw,1.25rem)] font-bold"
                style={{ color: bloco.cor }}
              >
                {bloco.titulo}
              </h3>
              {bloco.itens.length ? (
                <ul className="space-y-[1.6vh]">
                  {bloco.itens.map((item, i) => (
                    <li key={i} className="flex gap-3 text-[clamp(0.8rem,1.25vw,1.05rem)] leading-relaxed">
                      <span
                        className="mt-2 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: bloco.cor }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[clamp(0.8rem,1.2vw,1rem)] italic text-muted-foreground">
                  Nada registrado nesta competência.
                </p>
              )}
            </div>
          ))}
        </div>
      </Slide>,
    );
  }

  /* -------------------------------------------------- 4. painel 360° */
  slides.push(
    <Slide key="painel" titulo="Painel 360°" subtitulo="Um semáforo por frente de gestão">
      <TabelaSlide
        cabecalho={["Indicador", "Valor", "Status"]}
        linhas={indicadores.map((i) => [
          <span className="font-semibold">{i.rotulo}</span>,
          <span className="tabular-nums">{i.valor}</span>,
          <Farol semaforo={i.semaforo} texto={i.semaforo === "verde" ? "Verde" : i.semaforo === "amarelo" ? "Amarelo" : "Vermelho"} />,
        ])}
      />
    </Slide>,
  );

  /* ------------------------------------------------------- 5. financeiro */
  slides.push(
    <Slide key="financeiro" titulo="Financeiro" subtitulo="Resultado e posição de caixa do período">
      <div className="flex h-full flex-col gap-[2.5vh]">
        <div className="grid shrink-0 grid-cols-2 gap-[1.5vw] lg:grid-cols-4">
          <Numerao rotulo="Receita" valor={formatarMoeda(receitaTotal(d))} />
          <Numerao
            rotulo="Despesa"
            valor={formatarMoeda(despesaTotal(d))}
            apoio={dsr === null ? undefined : `${formatarVariacao(dsr)} vs. receita`}
            cor={dsr !== null && dsr > 10 ? COR.vermelho : undefined}
          />
          <Numerao rotulo="Saldo em conta" valor={formatarMoeda(saldoTotal(d))} cor={COR.verde} />
          <Numerao rotulo="Inadimplência" valor={formatarMoeda(inadimplenciaTotal(d))} cor={COR.amarelo} />
        </div>

        <div className="min-h-0 flex-1 rounded-2xl border border-border bg-card p-[2vh]">
          {d.financeiro.grupos.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={d.financeiro.grupos.map((g) => ({
                  nome: g.grupo.length > 22 ? `${g.grupo.slice(0, 20)}…` : g.grupo,
                  Orçado: g.orcado,
                  Realizado: g.realizado,
                }))}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={54} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatarMoedaCompacta(Number(v))} />
                <Tooltip
                  formatter={(v) => formatarMoeda(Number(v))}
                  contentStyle={{ borderRadius: 8, borderColor: "hsl(var(--border))", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Orçado" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <SemDados>Nenhum grupo contábil lançado nesta competência.</SemDados>
          )}
        </div>
      </div>
    </Slide>,
  );

  /* -------------------------------------- 6. evolução (só com histórico real) */
  if (serie.length >= 2) {
    slides.push(
      <Slide key="evolucao" titulo="Evolução" subtitulo={`Últimos ${serie.length} meses fechados`}>
        <div className="h-full rounded-2xl border border-border bg-card p-[2vh]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatarMoedaCompacta(Number(v))} />
              <Tooltip
                formatter={(v) => formatarMoeda(Number(v))}
                contentStyle={{ borderRadius: 8, borderColor: "hsl(var(--border))", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(var(--secondary))" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="despesa" name="Despesa" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Slide>,
    );
  }

  /* --------------------------------------------------------- 7. operação */
  slides.push(
    <Slide key="operacao" titulo="Operação e manutenção">
      <div className="flex h-full flex-col gap-[2.5vh]">
        <div className="grid shrink-0 grid-cols-3 gap-[1.5vw]">
          <Numerao
            rotulo="Ocupação"
            valor={`${formatarNumero(d.operacao.ocupacao, 0)}%`}
            apoio={`vacância de ${formatarNumero(vacancia(d), 0)}%`}
            cor={d.operacao.ocupacao >= 90 ? COR.verde : COR.amarelo}
          />
          <Numerao
            rotulo="Fluxo de pessoas"
            valor={formatarNumero(totalAcessos(d))}
            apoio={`${formatarNumero(d.operacao.acessosFixos)} fixos + ${formatarNumero(d.operacao.acessosVisitantes)} visitantes`}
          />
          <Numerao
            rotulo="Manutenções"
            valor={
              totalManutencoes(d) > 0
                ? formatarNumero(totalManutencoes(d))
                : `${d.operacao.ocorrencias.filter((o) => o.concluida).length} de ${d.operacao.ocorrencias.length}`
            }
            apoio={
              percentualRealizado(d) !== null
                ? `${percentualRealizado(d)!.toFixed(0)}% do programado`
                : "executadas no mês"
            }
            cor={COR.verde}
          />
        </div>
        <div className="min-h-0 flex-1">
          {d.operacao.ocorrencias.length ? (
            <TabelaSlide
              cabecalho={["Ocorrência", "Ação executada", "Resultado", ""]}
              linhas={d.operacao.ocorrencias.map((o) => [
                <span className="font-semibold">{o.ocorrencia}</span>,
                o.acao,
                o.resultado,
                <Farol semaforo={o.concluida ? "verde" : "amarelo"} texto={o.concluida ? "Concluída" : "Em curso"} />,
              ])}
            />
          ) : (
            <SemDados>Nenhuma manutenção registrada nesta competência.</SemDados>
          )}
        </div>
      </div>
    </Slide>,
  );

  /* ------------------------------- 7b. dashboard de manutenção (agregado) */
  if (totalManutencoes(d) > 0) {
    const porDisciplina = d.operacao.disciplinas
      .filter((x) => x.quantidade > 0)
      .sort((a, b) => b.quantidade - a.quantidade)
      .map((x) => ({ nome: x.disciplina, Finalizadas: x.quantidade }));

    slides.push(
      <Slide key="manutencao" titulo="Manutenção" subtitulo="Volume executado no período">
        <div className="grid h-full gap-[2vw] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid grid-cols-2 content-start gap-[1.5vw]">
            <Numerao rotulo="Preventivas" valor={formatarNumero(d.operacao.resumo.preventivas)} cor={COR.verde} />
            <Numerao rotulo="Corretivas" valor={formatarNumero(d.operacao.resumo.corretivas)} cor={COR.amarelo} />
            <Numerao rotulo="Acompanhamentos" valor={formatarNumero(d.operacao.resumo.acompanhamentos)} />
            <Numerao rotulo="Rondas" valor={formatarNumero(d.operacao.resumo.rondas)} />
            <div className="col-span-2">
              <Numerao
                rotulo="Proporção de preventiva"
                valor={percentualPreventiva(d) === null ? "—" : `${percentualPreventiva(d)!.toFixed(1)}%`}
                apoio={
                  d.operacao.resumo.naoRealizadas > 0
                    ? `${d.operacao.resumo.naoRealizadas} ordens em aberto`
                    : "nenhuma ordem em aberto"
                }
                cor={COR.verde}
              />
            </div>
          </div>

          <div className="min-h-0 rounded-2xl border border-border bg-card p-[2vh]">
            {porDisciplina.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porDisciplina} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="Finalizadas" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <SemDados>Nenhuma disciplina com ordens finalizadas no período.</SemDados>
            )}
          </div>
        </div>
      </Slide>,
    );
  }

  /* ---------------------------------------- 8. conformidade (docs + contratos) */
  slides.push(
    <Slide key="conformidade" titulo="Conformidade legal e contratos">
      <div className="grid h-full gap-[2vw] lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-[1.5vh]">
          <div className="grid shrink-0 grid-cols-3 gap-[1vw]">
            <Numerao rotulo="Vigentes" valor={String(documentos.vigentes)} cor={COR.verde} />
            <Numerao rotulo="A vencer" valor={String(documentos.aVencer)} cor={COR.amarelo} />
            <Numerao rotulo="Vencidos" valor={String(documentos.vencidos)} cor={COR.vermelho} />
          </div>
          <div className="min-h-0 flex-1">
            {d.documentos.linhas.length ? (
              <TabelaSlide
                cabecalho={["Documento", "Validade", "Status"]}
                linhas={d.documentos.linhas.map((doc) => {
                  const s = situacaoDocumento(doc);
                  return [
                    <span className="font-semibold">{doc.documento}</span>,
                    doc.validade ? formatarData(doc.validade) : "—",
                    <Farol semaforo={s.semaforo} texto={s.rotulo} />,
                  ];
                })}
              />
            ) : (
              <SemDados>Nenhum documento cadastrado.</SemDados>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-[1.5vh]">
          <div className="grid shrink-0 grid-cols-3 gap-[1vw]">
            <Numerao rotulo="Contratos vigentes" valor={String(contratos.vigentes)} cor={COR.verde} />
            <Numerao rotulo="Vencidos" valor={String(contratos.vencidos)} cor={COR.vermelho} />
            <Numerao rotulo="Em renovação" valor={String(contratos.emRenovacao)} cor={COR.amarelo} />
          </div>
          <div className="min-h-0 flex-1">
            {d.contratos.linhas.length ? (
              <TabelaSlide
                cabecalho={["Fornecedor", "Objeto", "Situação"]}
                linhas={d.contratos.linhas.map((c) => [
                  <span className="font-semibold">{c.fornecedor}</span>,
                  c.objeto,
                  <Farol
                    semaforo={c.situacao === "vigente" ? "verde" : c.situacao === "vencido" ? "vermelho" : "amarelo"}
                    texto={c.situacao === "em_renovacao" ? "Em renovação" : c.situacao === "vigente" ? "Vigente" : "Vencido"}
                  />,
                ])}
              />
            ) : (
              <SemDados>Nenhum contrato cadastrado.</SemDados>
            )}
          </div>
        </div>
      </div>
    </Slide>,
  );

  /* --------------------------------------------------------- 9. utilidades */
  if (d.utilidades.linhas.some((u) => u.consumo > 0)) {
    slides.push(
      <Slide key="utilidades" titulo="Utilidades" subtitulo="Consumo e custo comparados ao mês anterior">
        <div className="grid h-full gap-[1.5vw]" style={{ gridTemplateColumns: `repeat(${Math.min(d.utilidades.linhas.length, 3)}, minmax(0, 1fr))` }}>
          {d.utilidades.linhas.map((u) => {
            const v = variacaoConsumo(u);
            const sem: Semaforo = v === null ? "amarelo" : v > 25 ? "vermelho" : v > 10 ? "amarelo" : "verde";
            return (
              <div key={u.id} className="flex flex-col justify-center rounded-2xl border border-border bg-card p-[3vh] text-center">
                <h3 className="text-[clamp(1rem,1.8vw,1.5rem)] font-bold">{u.utilidade}</h3>
                <strong className="mt-[2vh] block text-[clamp(1.8rem,4vw,3.2rem)] font-bold leading-none tabular-nums">
                  {formatarNumero(u.consumo)}
                  <span className="ml-1 text-[clamp(0.8rem,1.4vw,1.1rem)] font-semibold text-muted-foreground">
                    {u.unidade}
                  </span>
                </strong>
                <div className="mt-[2vh] flex justify-center">
                  <Farol semaforo={sem} texto={v === null ? "sem base de comparação" : `${formatarVariacao(v)} vs. mês anterior`} />
                </div>
                <p className="mt-[2vh] text-[clamp(0.75rem,1.1vw,0.95rem)] text-muted-foreground">
                  Fatura {formatarMoeda(u.fatura)}
                </p>
                {u.detalhamento ? (
                  <p className="mt-1 text-[clamp(0.7rem,1vw,0.85rem)] text-muted-foreground">{u.detalhamento}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Slide>,
    );
  }

  /* ------------------------------------------------------------ 10. CAPEX */
  if (d.capex.linhas.length) {
    slides.push(
      <Slide key="capex" titulo="Investimentos e melhorias">
        <TabelaSlide
          cabecalho={["Iniciativa", "Orçado", "Realizado", "Desvio", "Status"]}
          linhas={d.capex.linhas.map((c) => {
            const dv = variacao(c.realizado, c.orcado);
            return [
              <span className="font-semibold">{c.iniciativa}</span>,
              <span className="tabular-nums">{formatarMoeda(c.orcado)}</span>,
              <span className="tabular-nums">{formatarMoeda(c.realizado)}</span>,
              <Farol
                semaforo={dv === null ? "amarelo" : dv <= 5 ? "verde" : dv <= 20 ? "amarelo" : "vermelho"}
                texto={dv === null ? "—" : formatarVariacao(dv, 1)}
              />,
              <span className="capitalize">{c.status.replace("_", " ")}</span>,
            ];
          })}
        />
      </Slide>,
    );
  }

  /* ------------------------------------------------------- 11. jurídico */
  if (d.juridico.processos.length || inadimplenciaTotal(d) > 0) {
    slides.push(
      <Slide key="juridico" titulo="Jurídico e inadimplência">
        <div className="flex h-full flex-col gap-[2.5vh]">
          <div className="grid shrink-0 grid-cols-4 gap-[1.5vw]">
            <Numerao
              rotulo="Posição anterior"
              valor={formatarMoeda(d.juridico.inadimplencia.rubricas.reduce((s, r) => s + r.ateAnterior, 0))}
            />
            <Numerao rotulo="Recebido no mês" valor={formatarMoeda(inadimplenciaRecebida(d))} cor={COR.verde} />
            <Numerao rotulo="Novo atraso" valor={formatarMoeda(inadimplenciaDoMes(d))} cor={COR.amarelo} />
            <Numerao rotulo="Total consolidado" valor={formatarMoeda(inadimplenciaTotal(d))} cor={COR.vermelho} />
          </div>
          <div className="min-h-0 flex-1">
            {d.juridico.processos.length ? (
              <TabelaSlide
                cabecalho={["Processo", "Objeto", "Andamento", "Próxima data"]}
                linhas={d.juridico.processos.map((p) => [
                  <span className="font-semibold">{p.numero}</span>,
                  p.objeto,
                  p.andamento,
                  p.proximaData ? formatarData(p.proximaData) : "—",
                ])}
              />
            ) : (
              <SemDados>Nenhum processo em andamento nesta competência.</SemDados>
            )}
          </div>
        </div>
      </Slide>,
    );
  }

  /* --------------------------------------------------------- 12. riscos */
  if (d.riscos.linhas.length) {
    slides.push(
      <Slide key="riscos" titulo="Matriz de riscos" subtitulo="Cada risco com dono e prazo">
        <TabelaSlide
          cabecalho={["Risco / assunto", "Criticidade", "Ação", "Responsável", "Prazo"]}
          linhas={d.riscos.linhas.map((r) => [
            <span className="font-semibold">{r.assunto}</span>,
            <Farol
              semaforo={r.criticidade === "alta" ? "vermelho" : r.criticidade === "media" ? "amarelo" : "verde"}
              texto={r.criticidade === "media" ? "Média" : r.criticidade === "alta" ? "Alta" : "Baixa"}
            />,
            r.acao,
            r.responsavel || "—",
            r.prazo ? formatarData(r.prazo) : "—",
          ])}
        />
      </Slide>,
    );
  }

  /* ------------------------------------------------------ 13. evidências */
  if (d.fotos.length) {
    slides.push(<SlideFotos key="fotos" relatorio={relatorio} />);
  }

  /* --------------------------------------------------- 14. próximos passos */
  const decisoesCliente = d.proximosPassos.linhas.filter((p) => p.dependeDoCliente);
  if (d.proximosPassos.linhas.length) {
    slides.push(
      <Slide
        key="passos"
        titulo="Próximos passos"
        subtitulo={
          decisoesCliente.length
            ? `${decisoesCliente.length} ${decisoesCliente.length === 1 ? "item depende" : "itens dependem"} de decisão do síndico`
            : "Pendências para o próximo período"
        }
      >
        <TabelaSlide
          cabecalho={["Decisão / pendência", "Prazo", "Status", ""]}
          linhas={d.proximosPassos.linhas.map((p) => [
            <span className="font-semibold">{p.decisao}</span>,
            p.prazo || "a definir",
            p.status || "—",
            p.dependeDoCliente ? <Farol semaforo="amarelo" texto="Decisão do síndico" /> : "",
          ])}
        />
      </Slide>,
    );
  }

  /* ------------------------------------------------------- 15. encerramento */
  slides.push(
    <div
      key="fim"
      className="flex h-full flex-col items-center justify-center gap-[3vh] p-[6vw] text-center text-white"
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(var(--executive) / 0.95), hsl(var(--primary) / 0.9))`,
      }}
    >
      <img src={logoRps} alt="RPS Global" className="h-[7vh] w-auto brightness-0 invert" />
      <h2 className="text-[clamp(1.8rem,5vw,3.5rem)] font-bold">Obrigado.</h2>
      {d.conclusao ? (
        <p className="max-w-4xl text-[clamp(0.85rem,1.4vw,1.2rem)] leading-relaxed opacity-90">{d.conclusao}</p>
      ) : null}
      <div className="mt-[2vh] text-[clamp(0.75rem,1.1vw,0.95rem)] opacity-75">
        <p>{emp?.gestor_nome || "Gestão Property Management"}</p>
        <p className="mt-1">RPS Real Property Solution</p>
      </div>
    </div>,
  );

  return slides;
};

/** Componente separado porque usa hook (URLs assinadas do Storage). */
const SlideFotos = ({ relatorio }: { relatorio: Relatorio }) => {
  const urls = useUrlsAssinadas(relatorio.dados.fotos);
  const fotos = relatorio.dados.fotos;

  return (
    <Slide titulo="Evidências do período">
      <div
        className="grid h-full gap-[1.5vw]"
        style={{
          gridTemplateColumns: `repeat(${fotos.length <= 2 ? fotos.length : fotos.length <= 6 ? 3 : 4}, minmax(0, 1fr))`,
        }}
      >
        {fotos.slice(0, 8).map((f, i) => (
          <figure key={f.id} className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="min-h-0 flex-1 bg-surface-soft">
              {urls[f.path] ? (
                <img src={urls[f.path]} alt={f.legenda || `Evidência ${i + 1}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  carregando…
                </div>
              )}
            </div>
            {f.legenda ? (
              <figcaption className="shrink-0 p-2 text-[clamp(0.65rem,0.95vw,0.85rem)] leading-snug">
                {f.legenda}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </Slide>
  );
};

export default Apresentacao;
