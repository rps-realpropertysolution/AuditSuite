/**
 * Painel de entregas do RGM.
 *
 * O RGM é obrigação de contrato. A pergunta que este painel responde ao
 * abrir: "de qual prédio o relatório do mês fechado ainda não saiu?".
 * Mostra o mês de referência, o prazo, quem está atrasado — e gera o mês de
 * todos os ativos de uma vez, já com os números do LiveFacilities.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  CloudDownload,
  Loader2,
  PenLine,
  Plus,
  Sparkles,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BadgeSemaforo } from "@/components/campos";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpreendimentos } from "@/hooks/useEmpreendimentos";
import { criarRelatorio, salvarDados, useRelatorios } from "@/hooks/useRelatorios";
import { buscarImportacaoLF } from "@/hooks/useImportacaoLF";
import { aplicarImportacao } from "@/lib/importacao";
import { marcarOrigem } from "@/lib/origem";
import {
  competenciaDeReferencia,
  prazoEntrega,
  situacaoEntrega,
  ultimasCompetencias,
  type SituacaoEntrega,
} from "@/lib/entregas";
import { formatarCompetencia, formatarData } from "@/lib/format";
import { percentualPreenchido, semaforoDaNota } from "@/lib/metrics";
import type { Empreendimento, Relatorio, StatusRelatorio } from "@/lib/types";

const ROTULO_STATUS: Record<StatusRelatorio, string> = {
  rascunho: "Rascunho",
  revisao: "Em revisão",
  publicado: "Publicado",
};

const ENTREGA: Record<SituacaoEntrega, { rotulo: string; estilo: string }> = {
  publicado: { rotulo: "Entregue", estilo: "bg-semaforo-verde/12 text-semaforo-verde" },
  em_elaboracao: { rotulo: "Em elaboração", estilo: "bg-primary/10 text-primary" },
  nao_iniciado: { rotulo: "Não iniciado", estilo: "bg-muted text-muted-foreground" },
  atrasado: { rotulo: "Atrasado", estilo: "bg-semaforo-vermelho/12 text-semaforo-vermelho" },
};

interface ProgressoLote {
  empreendimento: string;
  estado: "aguardando" | "processando" | "ok" | "erro" | "pulado";
  detalhe?: string;
}

const integrado = (e: Empreendimento) => Boolean(e.lf_cd_condominio);

const Dashboard = () => {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const { interno } = useAuth();
  const { data: todosEmp = [], isLoading: carregandoEmp } = useEmpreendimentos();
  const { data: relatorios = [], isLoading: carregandoRel } = useRelatorios();
  const [competencia, setCompetencia] = useState(competenciaDeReferencia());
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [lote, setLote] = useState<ProgressoLote[] | null>(null);
  const [rodandoLote, setRodandoLote] = useState(false);
  /** Prédios abertos na lista — cada um mostra os relatórios dele. */
  const [abertos, setAbertos] = useState<string[]>([]);
  const alternar = (id: string) => setAbertos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const empreendimentos = useMemo(() => todosEmp.filter((e) => e.ativo), [todosEmp]);

  const situacao = useMemo(
    () =>
      empreendimentos.map((emp) => {
        const doAtivo = relatorios.filter((r) => r.empreendimento_id === emp.id);
        const doMes = doAtivo.find((r) => r.competencia === competencia) ?? null;
        return {
          empreendimento: emp,
          doMes,
          ultimo: doAtivo[0] ?? null,
          total: doAtivo.length,
          entrega: situacaoEntrega(doMes, competencia),
        };
      }),
    [empreendimentos, relatorios, competencia],
  );

  const contagem = useMemo(() => {
    const c = { publicado: 0, em_elaboracao: 0, nao_iniciado: 0, atrasado: 0 } as Record<SituacaoEntrega, number>;
    situacao.forEach((s) => c[s.entrega]++);
    return c;
  }, [situacao]);

  const faltando = situacao.filter((s) => !s.doMes || (!s.doMes.dados.importacao && s.doMes.status !== "publicado" && integrado(s.empreendimento)));

  const abrirOuCriar = async (empreendimentoId: string, existente: Relatorio | null) => {
    setErro(null);
    if (existente) return navegar(`/relatorio/${existente.id}`);
    setAbrindo(empreendimentoId);
    try {
      const novo = await criarRelatorio({ empreendimentoId, competencia });
      void qc.invalidateQueries({ queryKey: ["relatorios"] });
      navegar(`/relatorio/${novo.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o relatório.");
    } finally {
      setAbrindo(null);
    }
  };

  /**
   * Gera o mês para todos os ativos: cria o relatório (herdando o mês anterior)
   * e, para os integrados, importa os números do LiveFacilities. Um por vez,
   * para não sobrecarregar o sistema; uma falha não interrompe os demais.
   */
  const gerarMes = async () => {
    const alvos = faltando;
    setRodandoLote(true);
    setLote(alvos.map((s) => ({ empreendimento: s.empreendimento.nome, estado: "aguardando" })));
    const atualizar = (i: number, p: Partial<ProgressoLote>) =>
      setLote((atual) => (atual ? atual.map((x, k) => (k === i ? { ...x, ...p } : x)) : atual));

    for (let i = 0; i < alvos.length; i++) {
      const { empreendimento: emp, doMes } = alvos[i];
      atualizar(i, { estado: "processando" });
      try {
        const rel = doMes ?? (await criarRelatorio({ empreendimentoId: emp.id, competencia }));
        if (!integrado(emp)) {
          atualizar(i, { estado: "ok", detalhe: "criado · sem integração com o LiveFacilities" });
          continue;
        }
        const resultado = await buscarImportacaoLF(rel.id);
        const mescla = aplicarImportacao(rel.dados, resultado);
        await salvarDados(rel.id, marcarOrigem(rel.dados, mescla.dados, "lf"));
        atualizar(i, {
          estado: "ok",
          detalhe: `${mescla.preenchido.length} blocos importados${mescla.avisos.length ? ` · ${mescla.avisos.length} aviso(s)` : ""}`,
        });
      } catch (e) {
        atualizar(i, { estado: "erro", detalhe: e instanceof Error ? e.message : "falhou" });
      }
    }
    setRodandoLote(false);
    void qc.invalidateQueries({ queryKey: ["relatorios"] });
  };

  const carregando = carregandoEmp || carregandoRel;

  return (
    <AppShell>
      <main className="mx-auto max-w-[1600px] px-5 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatório Gerencial Mensal</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Competência</span>
              <select
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="rounded-md border border-input bg-card px-2.5 py-1.5 text-sm font-semibold capitalize text-foreground"
              >
                {ultimasCompetencias(13).map((c) => (
                  <option key={c} value={c}>
                    {formatarCompetencia(c)}
                  </option>
                ))}
              </select>
              <span>
                · entrega até <strong className="text-foreground">{formatarData(prazoEntrega(competencia))}</strong>
              </span>
            </div>
          </div>
          {interno ? (
            <div className="flex flex-wrap gap-2">
              {faltando.length ? (
                <button
                  type="button"
                  onClick={() => void gerarMes()}
                  disabled={rodandoLote}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {rodandoLote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar {formatarCompetencia(competencia)} para {faltando.length} {faltando.length === 1 ? "ativo" : "ativos"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => navegar("/empreendimentos")}
                className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
              >
                <Plus className="h-4 w-4" /> Novo empreendimento
              </button>
            </div>
          ) : null}
        </header>

        {/* Placar de entrega */}
        {interno && situacao.length ? (
          <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["publicado", "em_elaboracao", "nao_iniciado", "atrasado"] as SituacaoEntrega[]).map((k) => (
              <div key={k} className="rounded-xl border border-border bg-card p-4">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${ENTREGA[k].estilo}`}>{ENTREGA[k].rotulo}</span>
                <p className="mt-2 text-3xl font-bold tabular-nums">
                  {contagem[k]}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">/ {situacao.length}</span>
                </p>
              </div>
            ))}
          </section>
        ) : null}

        {lote ? (
          <section className="mb-6 rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <CloudDownload className="h-4 w-4 text-primary" /> Geração de {formatarCompetencia(competencia)}
              </h2>
              {!rodandoLote ? (
                <button type="button" onClick={() => setLote(null)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                  Fechar
                </button>
              ) : null}
            </div>
            <ul className="grid gap-1.5 text-sm md:grid-cols-2">
              {lote.map((p) => (
                <li key={p.empreendimento} className="flex items-start gap-2">
                  {p.estado === "processando" ? (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : p.estado === "ok" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-semaforo-verde" />
                  ) : p.estado === "erro" ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-semaforo-vermelho" />
                  ) : (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30" />
                  )}
                  <span>
                    <strong>{p.empreendimento}</strong>
                    {p.detalhe ? <span className="text-muted-foreground"> — {p.detalhe}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {erro ? (
          <p role="alert" className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {erro}
          </p>
        ) : null}

        {carregando ? (
          <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : empreendimentos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-bold">Nenhum empreendimento cadastrado</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {interno
                ? "Cadastre o primeiro ativo para começar a gerar relatórios mensais."
                : "Nenhum ativo foi liberado para o seu acesso ainda. Fale com a administradora."}
            </p>
            {interno ? (
              <button
                type="button"
                onClick={() => navegar("/empreendimentos")}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> Cadastrar empreendimento
              </button>
            ) : null}
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Building2 className="h-4 w-4 text-primary" /> Empreendimentos
              </h2>
              <p className="text-xs text-muted-foreground">
                Situação de {formatarCompetencia(competencia)} · clique no prédio para ver os relatórios dele
              </p>
            </header>
            <ul className="divide-y divide-border">
              {[...situacao]
                .sort((a, b) => {
                  const ordem: Record<SituacaoEntrega, number> = { atrasado: 0, nao_iniciado: 1, em_elaboracao: 2, publicado: 3 };
                  return ordem[a.entrega] - ordem[b.entrega] || a.empreendimento.nome.localeCompare(b.empreendimento.nome);
                })
                .map(({ empreendimento: emp, doMes, ultimo, total, entrega }) => {
                  const preenchimento = doMes ? percentualPreenchido(doMes.dados) : 0;
                  const nota = doMes?.indice_executivo ?? null;
                  const aberto = abertos.includes(emp.id);
                  const doPredio = relatorios.filter((r) => r.empreendimento_id === emp.id);
                  return (
                    <li key={emp.id}>
                      <button
                        type="button"
                        onClick={() => alternar(emp.id)}
                        aria-expanded={aberto}
                        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition hover:bg-surface-soft/60"
                      >
                        <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-90" : ""}`} />
                        <div className="min-w-[180px] flex-1">
                          <p className="font-bold text-foreground">{emp.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {[emp.cidade, emp.gestor_nome].filter(Boolean).join(" · ") || (integrado(emp) ? "integrado ao LiveFacilities" : "—")}
                          </p>
                        </div>
                        {doMes ? (
                          <div className="hidden w-40 sm:block">
                            <div className="mb-1 flex justify-between text-[11px] font-semibold text-muted-foreground">
                              <span>Preenchimento</span>
                              <span className="tabular-nums">{preenchimento}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${preenchimento}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="hidden w-40 text-xs text-muted-foreground sm:block">
                            sem RGM de {formatarCompetencia(competencia).split(" ")[0]}
                          </span>
                        )}
                        <span className="w-24 text-xs tabular-nums text-muted-foreground">
                          {total} {total === 1 ? "relatório" : "relatórios"}
                        </span>
                        {nota !== null ? <BadgeSemaforo semaforo={semaforoDaNota(nota)} rotulo={`Índice ${nota}`} /> : null}
                        {interno ? (
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${ENTREGA[entrega].estilo}`}>
                            {entrega === "atrasado" ? <AlertTriangle className="h-3 w-3" /> : null}
                            {ENTREGA[entrega].rotulo}
                          </span>
                        ) : null}
                      </button>

                      {aberto ? (
                        <div className="border-t border-border bg-surface-soft/40 px-5 py-4 sm:pl-12">
                          <div className="mb-3 flex flex-wrap gap-2">
                            {interno ? (
                              <button
                                type="button"
                                disabled={abrindo === emp.id || rodandoLote}
                                onClick={() => void abrirOuCriar(emp.id, doMes)}
                                className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                              >
                                {abrindo === emp.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : doMes ? (
                                  <>
                                    {doMes.status === "publicado" ? "Abrir" : "Continuar"} {formatarCompetencia(competencia)}{" "}
                                    <ArrowRight className="h-4 w-4" />
                                  </>
                                ) : (
                                  <>
                                    <CalendarPlus className="h-4 w-4" /> Criar {formatarCompetencia(competencia)}
                                    {ultimo ? " a partir do mês anterior" : ""}
                                  </>
                                )}
                              </button>
                            ) : null}
                            {total > 0 ? (
                              <button
                                type="button"
                                onClick={() => navegar(`/empreendimento/${emp.id}/ano/${competencia.slice(0, 4)}`)}
                                className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3.5 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
                              >
                                <CalendarRange className="h-4 w-4" /> Visão anual {competencia.slice(0, 4)}
                              </button>
                            ) : null}
                          </div>

                          {doPredio.length ? (
                            <div className="overflow-x-auto rounded-lg border border-border bg-card">
                              <table className="w-full border-collapse text-sm">
                                <thead>
                                  <tr className="bg-surface-soft text-left">
                                    {["Competência", "Status", "Índice", "Atualizado", ""].map((h) => (
                                      <th key={h} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {doPredio.map((r) => (
                                    <tr
                                      key={r.id}
                                      className={`border-t border-border transition hover:bg-surface-soft/50 ${r.competencia === competencia ? "bg-primary/5" : ""}`}
                                    >
                                      <td className="px-4 py-2 font-semibold capitalize">{formatarCompetencia(r.competencia)}</td>
                                      <td className="px-4 py-2">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                                          {r.status === "publicado" ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-semaforo-verde" />
                                          ) : (
                                            <PenLine className="h-3.5 w-3.5" />
                                          )}
                                          {ROTULO_STATUS[r.status]}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 tabular-nums">
                                        {r.indice_executivo !== null ? (
                                          <BadgeSemaforo semaforo={semaforoDaNota(r.indice_executivo)} rotulo={`${r.indice_executivo}`} />
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-muted-foreground">{formatarData(r.updated_at)}</td>
                                      <td className="px-4 py-2 text-right">
                                        <button
                                          type="button"
                                          onClick={() => navegar(`/relatorio/${r.id}`)}
                                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                                        >
                                          Abrir <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum relatório deste prédio ainda.</p>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </section>
        )}
      </main>
    </AppShell>
  );
};

export default Dashboard;
