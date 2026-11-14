/**
 * "Trazer do LiveFacilities": lista os empreendimentos do sistema com código
 * e id, mostra o que será criado ou vinculado e aplica só o que o gestor marcar.
 */

import { useState } from "react";
import { CheckCircle2, CloudDownload, Link2, Loader2, Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buscarEmpreendimentosLF } from "@/hooks/useImportacaoLF";
import { planejarSincronizacao, type AcaoSincronizacao } from "@/lib/sincronizarEmpreendimentos";
import type { Empreendimento } from "@/lib/types";

const ROTULO: Record<AcaoSincronizacao["tipo"], { texto: string; estilo: string }> = {
  criar: { texto: "Novo no RGM", estilo: "bg-primary/10 text-primary" },
  vincular: { texto: "Vincular código", estilo: "bg-semaforo-amarelo/15 text-semaforo-amarelo" },
  completar_id: { texto: "Completar id", estilo: "bg-semaforo-amarelo/15 text-semaforo-amarelo" },
  ok: { texto: "Já integrado", estilo: "bg-semaforo-verde/12 text-semaforo-verde" },
};

export const SincronizarLF = ({ existentes }: { existentes: Empreendimento[] }) => {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [plano, setPlano] = useState<AcaoSincronizacao[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  const abrir = async () => {
    setAberto(true);
    setErro(null);
    setFeito(null);
    setCarregando(true);
    try {
      const lista = await buscarEmpreendimentosLF();
      const p = planejarSincronizacao(existentes, lista);
      setPlano(p);
      setMarcados(new Set(p.filter((a) => a.tipo !== "ok").map((a) => a.lf.cdCondominio)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível consultar o LiveFacilities.");
    } finally {
      setCarregando(false);
    }
  };

  const aplicar = async () => {
    setAplicando(true);
    setErro(null);
    let criados = 0;
    let vinculados = 0;
    try {
      const { data: sessao } = await supabase.auth.getUser();
      for (const a of plano) {
        if (a.tipo === "ok" || !marcados.has(a.lf.cdCondominio)) continue;
        const codigos = { lf_cd_condominio: a.lf.cdCondominio, lf_id_empreendimento: a.lf.idEmpreendimento };
        if (a.tipo === "criar") {
          const { error } = await supabase
            .from("empreendimentos")
            .insert({ nome: a.lf.nome, tipo: "comercial", ...codigos, created_by: sessao.user?.id });
          if (error) throw error;
          criados++;
        } else {
          const { error } = await supabase.from("empreendimentos").update(codigos).eq("id", a.emp.id);
          if (error) throw error;
          vinculados++;
        }
      }
      setFeito(`${criados} empreendimento(s) cadastrado(s) e ${vinculados} vinculado(s) ao LiveFacilities.`);
      void qc.invalidateQueries({ queryKey: ["empreendimentos"] });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao aplicar.");
    } finally {
      setAplicando(false);
    }
  };

  const pendentes = plano.filter((a) => a.tipo !== "ok");

  return (
    <>
      <button
        type="button"
        onClick={() => void abrir()}
        className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2.5 text-sm font-semibold transition hover:border-primary hover:text-primary"
      >
        <CloudDownload className="h-4 w-4" /> Trazer do LiveFacilities
      </button>

      {aberto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-executive/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Empreendimentos do LiveFacilities">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">Empreendimentos do LiveFacilities</h2>
                <p className="text-xs text-muted-foreground">
                  Marque o que cadastrar ou vincular. Os nomes podem ser ajustados depois.
                </p>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="rounded p-1.5 text-muted-foreground transition hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-5">
              {carregando ? (
                <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Consultando o LiveFacilities (leva alguns segundos)…
                </p>
              ) : (
                <>
                  {plano.length ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          <th className="w-8 py-2" />
                          <th className="py-2">Código</th>
                          <th className="py-2">Nome no LiveFacilities</th>
                          <th className="py-2">No RGM</th>
                          <th className="py-2">Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plano.map((a) => (
                          <tr key={a.lf.cdCondominio} className="border-t border-border">
                            <td className="py-2">
                              {a.tipo !== "ok" ? (
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary"
                                  checked={marcados.has(a.lf.cdCondominio)}
                                  onChange={(e) =>
                                    setMarcados((m) => {
                                      const n = new Set(m);
                                      if (e.target.checked) n.add(a.lf.cdCondominio);
                                      else n.delete(a.lf.cdCondominio);
                                      return n;
                                    })
                                  }
                                  aria-label={`Selecionar ${a.lf.nome}`}
                                />
                              ) : null}
                            </td>
                            <td className="py-2 tabular-nums">
                              {a.lf.cdCondominio}
                              <span className="block text-[11px] text-muted-foreground">{a.lf.idEmpreendimento ? `id ${a.lf.idEmpreendimento}` : "só operação"}</span>
                            </td>
                            <td className="py-2 font-semibold">{a.lf.nome}</td>
                            <td className="py-2 text-muted-foreground">{a.tipo === "criar" ? "—" : a.emp.nome}</td>
                            <td className="py-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${ROTULO[a.tipo].estilo}`}>
                                {a.tipo === "criar" ? <Plus className="h-3 w-3" /> : a.tipo === "ok" ? <CheckCircle2 className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                                {ROTULO[a.tipo].texto}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}

                  {erro ? <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p> : null}
                  {feito ? <p className="mt-4 rounded-md bg-semaforo-verde/10 p-3 text-sm font-semibold text-semaforo-verde">{feito}</p> : null}

                  <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
                    <button type="button" onClick={() => setAberto(false)} className="rounded-md border border-input px-4 py-2 text-sm font-semibold transition hover:bg-muted">
                      Fechar
                    </button>
                    {pendentes.length && !feito ? (
                      <button
                        type="button"
                        disabled={aplicando || marcados.size === 0}
                        onClick={() => void aplicar()}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                      >
                        {aplicando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Aplicar {marcados.size} {marcados.size === 1 ? "item" : "itens"}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
