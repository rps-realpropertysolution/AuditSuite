import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  CheckCircle2,
  FileText,
  Loader2,
  PenLine,
  Plus,
  Send,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BadgeSemaforo } from "@/components/campos";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpreendimentos } from "@/hooks/useEmpreendimentos";
import { useCriarRelatorio, useRelatorios } from "@/hooks/useRelatorios";
import { competenciaAtual, formatarCompetencia, formatarData } from "@/lib/format";
import { percentualPreenchido, semaforoDaNota } from "@/lib/metrics";
import type { Relatorio, StatusRelatorio } from "@/lib/types";

const ROTULO_STATUS: Record<StatusRelatorio, string> = {
  rascunho: "Rascunho",
  revisao: "Em revisão",
  publicado: "Publicado",
};

const ESTILO_STATUS: Record<StatusRelatorio, string> = {
  rascunho: "bg-muted text-muted-foreground",
  revisao: "bg-semaforo-amarelo/12 text-semaforo-amarelo",
  publicado: "bg-semaforo-verde/12 text-semaforo-verde",
};

const IconeStatus = ({ status }: { status: StatusRelatorio }) =>
  status === "publicado" ? (
    <CheckCircle2 className="h-3.5 w-3.5" />
  ) : status === "revisao" ? (
    <Send className="h-3.5 w-3.5" />
  ) : (
    <PenLine className="h-3.5 w-3.5" />
  );

const Dashboard = () => {
  const navegar = useNavigate();
  const { interno } = useAuth();
  const { data: empreendimentos = [], isLoading: carregandoEmp } = useEmpreendimentos();
  const { data: relatorios = [], isLoading: carregandoRel } = useRelatorios();
  const criar = useCriarRelatorio();
  const [erro, setErro] = useState<string | null>(null);

  const competencia = competenciaAtual();

  /** Situação de cada ativo no mês corrente — a pergunta que o gestor faz ao abrir. */
  const situacao = useMemo(
    () =>
      empreendimentos.map((emp) => {
        const doAtivo = relatorios.filter((r) => r.empreendimento_id === emp.id);
        return {
          empreendimento: emp,
          doMes: doAtivo.find((r) => r.competencia === competencia) ?? null,
          ultimo: doAtivo[0] ?? null,
          total: doAtivo.length,
        };
      }),
    [empreendimentos, relatorios, competencia],
  );

  const pendentes = situacao.filter((s) => !s.doMes).length;

  const abrirOuCriar = async (empreendimentoId: string, existente: Relatorio | null) => {
    setErro(null);
    if (existente) return navegar(`/relatorio/${existente.id}`);
    try {
      const novo = await criar.mutateAsync({ empreendimentoId, competencia });
      navegar(`/relatorio/${novo.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o relatório.");
    }
  };

  const carregando = carregandoEmp || carregandoRel;

  return (
    <AppShell>
      <main className="mx-auto max-w-[1600px] px-5 py-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios gerenciais</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Competência atual: <strong>{formatarCompetencia(competencia)}</strong>
              {interno && pendentes > 0 ? (
                <>
                  {" · "}
                  <span className="font-semibold text-semaforo-amarelo">
                    {pendentes} {pendentes === 1 ? "ativo ainda sem" : "ativos ainda sem"} relatório
                  </span>
                </>
              ) : null}
            </p>
          </div>
          {interno ? (
            <button
              type="button"
              onClick={() => navegar("/empreendimentos")}
              className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Novo empreendimento
            </button>
          ) : null}
        </header>

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
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {situacao.map(({ empreendimento: emp, doMes, ultimo, total }) => {
              const preenchimento = doMes ? percentualPreenchido(doMes.dados) : 0;
              const nota = doMes?.indice_executivo ?? null;

              return (
                <article
                  key={emp.id}
                  className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold text-foreground">{emp.nome}</h2>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[emp.cidade, emp.tipo].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    {nota !== null ? (
                      <BadgeSemaforo semaforo={semaforoDaNota(nota)} rotulo={`${nota}/100`} />
                    ) : null}
                  </div>

                  <div className="my-4 flex-1 rounded-lg bg-surface-soft p-3.5">
                    {doMes ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {formatarCompetencia(doMes.competencia)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${ESTILO_STATUS[doMes.status]}`}
                          >
                            <IconeStatus status={doMes.status} />
                            {ROTULO_STATUS[doMes.status]}
                          </span>
                        </div>
                        <div className="mt-2.5">
                          <div className="mb-1 flex justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">Preenchimento</span>
                            <span className="tabular-nums">{preenchimento}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${preenchimento}%` }}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        <p className="font-semibold text-semaforo-amarelo">
                          Sem relatório em {formatarCompetencia(competencia)}
                        </p>
                        <p className="mt-1">
                          {ultimo
                            ? `Último: ${formatarCompetencia(ultimo.competencia)} · ${total} no total`
                            : "Nenhum relatório gerado ainda"}
                        </p>
                      </div>
                    )}
                  </div>

                  {interno ? (
                    <button
                      type="button"
                      disabled={criar.isPending}
                      onClick={() => void abrirOuCriar(emp.id, doMes)}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      {criar.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : doMes ? (
                        <>
                          Continuar relatório <ArrowRight className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          <CalendarPlus className="h-4 w-4" />
                          {ultimo ? "Criar a partir do mês anterior" : "Criar relatório"}
                        </>
                      )}
                    </button>
                  ) : ultimo ? (
                    <button
                      type="button"
                      onClick={() => navegar(`/relatorio/${ultimo.id}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
                    >
                      Ver relatório <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {/* Histórico */}
        {relatorios.length > 0 ? (
          <section className="mt-12">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <FileText className="h-5 w-5 text-primary" /> Todos os relatórios
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-soft text-left">
                    {["Empreendimento", "Competência", "Status", "Índice", "Atualizado", ""].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {relatorios.map((r) => (
                    <tr key={r.id} className="border-t border-border transition hover:bg-surface-soft/50">
                      <td className="px-4 py-3 font-semibold">{r.empreendimento?.nome ?? "—"}</td>
                      <td className="px-4 py-3">{formatarCompetencia(r.competencia)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${ESTILO_STATUS[r.status]}`}
                        >
                          <IconeStatus status={r.status} />
                          {ROTULO_STATUS[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {r.indice_executivo !== null ? (
                          <BadgeSemaforo
                            semaforo={semaforoDaNota(r.indice_executivo)}
                            rotulo={`${r.indice_executivo}`}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatarData(r.updated_at)}</td>
                      <td className="px-4 py-3 text-right">
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
          </section>
        ) : null}
      </main>
    </AppShell>
  );
};

export default Dashboard;
