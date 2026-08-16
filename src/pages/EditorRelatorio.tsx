import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleAlert,
  Cloud,
  CloudOff,
  Loader2,
  Play,
  Printer,
  Send,
  Undo2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BadgeSemaforo, PontoSemaforo } from "@/components/campos";
import {
  SecaoCapex,
  SecaoConclusao,
  SecaoFinanceiro,
  SecaoSumario,
} from "@/components/relatorio/secoes-financeiro";
import {
  SecaoFornecedores,
  SecaoFotos,
  SecaoOperacao,
  SecaoUtilidades,
} from "@/components/relatorio/secoes-operacao";
import {
  SecaoContratos,
  SecaoDocumentos,
  SecaoJuridico,
  SecaoProximosPassos,
  SecaoRiscos,
} from "@/components/relatorio/secoes-governanca";
import { RelatorioImpresso } from "@/components/relatorio/RelatorioImpresso";
import { useAuth } from "@/contexts/AuthContext";
import { useAutosave } from "@/hooks/useAutosave";
import { salvarDados, useMudarStatus, useRelatorio } from "@/hooks/useRelatorios";
import { formatarCompetencia, tempoRelativo } from "@/lib/format";
import {
  calcularAlertas,
  calcularIndiceExecutivo,
  percentualPreenchido,
  progressoSecoes,
  semaforoDaNota,
} from "@/lib/metrics";
import { novoId } from "@/lib/defaults";
import type { DadosRelatorio, SecaoId } from "@/lib/types";

const NAV: { id: SecaoId; rotulo: string }[] = [
  { id: "sumario", rotulo: "Sumário 360°" },
  { id: "financeiro", rotulo: "Financeiro" },
  { id: "operacao", rotulo: "Operação" },
  { id: "fornecedores", rotulo: "Fornecedores" },
  { id: "contratos", rotulo: "Contratos" },
  { id: "documentos", rotulo: "Documentos" },
  { id: "juridico", rotulo: "Jurídico" },
  { id: "utilidades", rotulo: "Utilidades" },
  { id: "capex", rotulo: "CAPEX" },
  { id: "riscos", rotulo: "Riscos" },
  { id: "proximosPassos", rotulo: "Próximos passos" },
  { id: "fotos", rotulo: "Evidências" },
  { id: "conclusao", rotulo: "Conclusão" },
];

const EditorRelatorio = () => {
  const { id } = useParams<{ id: string }>();
  const navegar = useNavigate();
  const { interno } = useAuth();
  const { data: relatorio, isLoading, error } = useRelatorio(id);
  const mudarStatus = useMudarStatus();

  const [dados, setDados] = useState<DadosRelatorio | null>(null);
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoId>("sumario");

  // Carrega uma vez; a partir daí o estado local é a fonte de verdade
  useEffect(() => {
    if (relatorio && !dados) setDados(relatorio.dados);
  }, [relatorio, dados]);

  const somenteLeitura = !interno || relatorio?.status === "publicado";

  const salvar = useCallback(
    async (valor: DadosRelatorio) => {
      if (!id) return;
      await salvarDados(id, valor);
    },
    [id],
  );

  const { estado, salvoEm, erro: erroSalvar, salvarAgora } = useAutosave({
    valor: dados as DadosRelatorio,
    salvar,
    ativo: Boolean(dados) && !somenteLeitura,
  });

  const atualizar = useCallback(
    <K extends keyof DadosRelatorio>(chave: K, valor: DadosRelatorio[K]) =>
      setDados((atual) => (atual ? { ...atual, [chave]: valor } : atual)),
    [],
  );

  const alertas = useMemo(() => (dados ? calcularAlertas(dados) : []), [dados]);
  const progresso = useMemo(() => (dados ? progressoSecoes(dados) : {}), [dados]);
  const preenchido = dados ? percentualPreenchido(dados) : 0;
  const indice = dados ? calcularIndiceExecutivo(dados) : null;

  // Destaca no menu a seção visível na tela
  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visivel?.target.id) setSecaoAtiva(visivel.target.id as SecaoId);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: [0.1, 0.5] },
    );
    NAV.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observador.observe(el);
    });
    return () => observador.disconnect();
  }, [dados]);

  /** Converte um alerta detectado em linha da matriz de riscos. */
  const promoverParaRisco = (titulo: string, detalhe: string) => {
    if (!dados) return;
    atualizar("riscos", {
      ...dados.riscos,
      linhas: [
        ...dados.riscos.linhas,
        { id: novoId(), assunto: titulo, criticidade: "media", acao: detalhe, responsavel: "", prazo: "" },
      ],
    });
    document.getElementById("riscos")?.scrollIntoView({ behavior: "smooth" });
  };

  const publicar = async () => {
    if (!id || !relatorio) return;
    await salvarAgora();
    await mudarStatus.mutateAsync({ id, status: "publicado" });
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center gap-3 py-32 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando relatório…
        </div>
      </AppShell>
    );
  }

  if (error || !relatorio || !dados) {
    return (
      <AppShell>
        <main className="mx-auto max-w-lg px-5 py-24 text-center">
          <CircleAlert className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-bold">Relatório não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ele pode ter sido removido ou você não tem acesso a este empreendimento.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar aos relatórios
          </Link>
        </main>
      </AppShell>
    );
  }

  const props = { dados, atualizar, somenteLeitura };

  return (
    <>
      {/* Versão de impressão — fica oculta na tela e assume no @media print */}
      <RelatorioImpresso relatorio={{ ...relatorio, dados }} />

      <div className="screen-only">
        <AppShell>
          {/* Barra de contexto e ações */}
          <div className="sticky top-[57px] z-30 border-b border-border bg-card/95 backdrop-blur">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  to="/"
                  aria-label="Voltar"
                  className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-bold leading-tight">
                    {relatorio.empreendimento?.nome ?? "Empreendimento"}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {formatarCompetencia(relatorio.competencia)}
                    {relatorio.status === "publicado" ? " · publicado" : ""}
                  </p>
                </div>
                {indice !== null ? (
                  <BadgeSemaforo semaforo={semaforoDaNota(indice)} rotulo={`Índice ${indice}`} />
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Estado do autosave */}
                {!somenteLeitura ? (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                      estado === "erro"
                        ? "bg-destructive/10 text-destructive"
                        : estado === "salvando" || estado === "pendente"
                          ? "bg-muted text-muted-foreground"
                          : "bg-semaforo-verde/10 text-semaforo-verde"
                    }`}
                    title={erroSalvar ?? undefined}
                  >
                    {estado === "erro" ? (
                      <>
                        <CloudOff className="h-3.5 w-3.5" /> Falha ao salvar
                      </>
                    ) : estado === "salvando" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
                      </>
                    ) : estado === "pendente" ? (
                      <>
                        <Cloud className="h-3.5 w-3.5" /> Alterações pendentes
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        {salvoEm ? `Salvo ${tempoRelativo(salvoEm)}` : "Tudo salvo"}
                      </>
                    )}
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() => navegar(`/relatorio/${id}/apresentar`)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
                >
                  <Play className="h-4 w-4" /> Apresentar
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
                >
                  <Printer className="h-4 w-4" /> PDF
                </button>

                {interno && relatorio.status !== "publicado" ? (
                  <button
                    type="button"
                    onClick={() => void publicar()}
                    disabled={mudarStatus.isPending}
                    className="inline-flex items-center gap-2 rounded-md bg-semaforo-verde px-3.5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {mudarStatus.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Publicar
                  </button>
                ) : null}

                {interno && relatorio.status === "publicado" ? (
                  <button
                    type="button"
                    onClick={() => void mudarStatus.mutateAsync({ id: id!, status: "rascunho" })}
                    className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
                  >
                    <Undo2 className="h-4 w-4" /> Reabrir para edição
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mx-auto flex max-w-[1600px] gap-6 px-5 py-6">
            {/* Navegação lateral com progresso */}
            <nav className="sticky top-[125px] hidden h-fit w-56 shrink-0 lg:block" aria-label="Seções do relatório">
              <div className="mb-4 rounded-lg border border-border bg-card p-3">
                <div className="mb-1.5 flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Preenchido</span>
                  <span className="tabular-nums">{preenchido}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${preenchido}%` }}
                  />
                </div>
              </div>

              <ul className="space-y-0.5">
                {NAV.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition ${
                        secaoAtiva === s.id
                          ? "bg-primary/10 font-bold text-primary"
                          : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {s.rotulo}
                      {progresso[s.id] ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-semaforo-verde" />
                      ) : (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="min-w-0 flex-1 space-y-6">
              {/* Alertas detectados automaticamente */}
              {alertas.length > 0 ? (
                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    <AlertTriangle className="h-4 w-4 text-semaforo-amarelo" />
                    {alertas.length} {alertas.length === 1 ? "ponto detectado" : "pontos detectados"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Encontrados nos dados que você lançou. Vire qualquer um em item da matriz de riscos.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {alertas.slice(0, 6).map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-surface-soft p-3"
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <PontoSemaforo semaforo={a.severidade} className="mt-1.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{a.titulo}</p>
                            <p className="text-xs leading-relaxed text-muted-foreground">{a.detalhe}</p>
                          </div>
                        </div>
                        {!somenteLeitura ? (
                          <button
                            type="button"
                            onClick={() => promoverParaRisco(a.titulo, a.detalhe)}
                            className="shrink-0 rounded-md border border-input px-2.5 py-1.5 text-xs font-semibold transition hover:border-primary hover:text-primary"
                          >
                            Virar plano de ação
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <SecaoSumario {...props} />
              <SecaoFinanceiro {...props} />
              <SecaoOperacao {...props} />
              <SecaoFornecedores {...props} />
              <SecaoContratos {...props} />
              <SecaoDocumentos {...props} />
              <SecaoJuridico {...props} />
              <SecaoUtilidades {...props} competencia={relatorio.competencia} />
              <SecaoCapex {...props} />
              <SecaoRiscos {...props} />
              <SecaoProximosPassos {...props} />
              <SecaoFotos {...props} relatorioId={relatorio.id} />
              <SecaoConclusao {...props} />
            </div>
          </div>
        </AppShell>
      </div>
    </>
  );
};

export default EditorRelatorio;
