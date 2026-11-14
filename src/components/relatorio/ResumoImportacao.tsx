import { CheckCircle2, CircleAlert, ListTodo, X } from "lucide-react";
import type { ConsultaLF } from "../../../supabase/functions/_shared/livefacilities/tipos.ts";
import { PENDENCIAS_MANUAIS, type ResultadoMescla } from "@/lib/importacao";

export interface EstadoResumoImportacao extends Omit<ResultadoMescla, "dados"> {
  consultas: ConsultaLF[];
}

/**
 * O que a importação trouxe, o que precisa de conferência e o que fica com
 * o gestor. É o "checklist do mês" — o gestor sabe exatamente o que falta.
 */
export const ResumoImportacao = ({ estado, onFechar }: { estado: EstadoResumoImportacao; onFechar: () => void }) => {
  const falhas = estado.consultas.filter((c) => !c.ok);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-executive/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Resultado da importação"
      onClick={onFechar}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Dados importados do LiveFacilities</h2>
            <p className="text-xs text-muted-foreground">Revise nas seções — tudo continua editável.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded p-1.5 text-muted-foreground transition hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-semaforo-verde">Preenchido</h3>
            {estado.preenchido.length ? (
              <ul className="space-y-1.5">
                {estado.preenchido.map((p) => (
                  <li key={p.rotulo} className="flex gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-semaforo-verde" />
                    <span>
                      <strong>{p.rotulo}:</strong> {p.detalhe}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum dado retornou para esta competência.</p>
            )}
          </section>

          {estado.avisos.length || falhas.length ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-semaforo-amarelo">Conferir</h3>
              <ul className="space-y-1.5">
                {estado.avisos.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-semaforo-amarelo" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-lg bg-surface-soft p-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
              <ListTodo className="h-4 w-4" /> Fica com você
            </h3>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {PENDENCIAS_MANUAIS.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {p}
                </li>
              ))}
            </ul>
          </section>

          <div className="flex justify-end">
            <button type="button" onClick={onFechar} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
              Revisar o relatório
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
