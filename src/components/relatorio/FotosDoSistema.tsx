/**
 * Fotos da Prestação de Contas Operacional do LiveFacilities.
 *
 * O PDF do sistema traz centenas de fotos das OS. O gestor escolhe as que
 * contam a história do mês; a legenda já vem com o título da atividade.
 * Tudo é extraído no navegador — só as fotos escolhidas sobem.
 */

import { useEffect, useRef, useState } from "react";
import { Check, FileImage, Loader2, X } from "lucide-react";
import type { FotoExtraida } from "@/lib/relatoriosSistema/ler";
import type { Foto } from "@/lib/types";

/** O slide mostra 6 fotos; deixamos escolher um pouco mais para o gestor ter folga. */
const MAX_ESCOLHA = 12;

interface Props {
  jaTem: number;
  onEscolher: (arquivos: File[], meta: Pick<Foto, "legenda" | "categoria">[]) => Promise<void>;
}

export const FotosDoSistema = ({ jaTem, onEscolher }: Props) => {
  const [aberto, setAberto] = useState(false);
  const [progresso, setProgresso] = useState<{ pagina: number; total: number; fotos: number } | null>(null);
  const [fotos, setFotos] = useState<FotoExtraida[]>([]);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cancelar = useRef<AbortController | null>(null);

  const limpar = () => {
    cancelar.current?.abort();
    fotos.forEach((f) => URL.revokeObjectURL(f.url));
    setFotos([]);
    setEscolhidas([]);
    setProgresso(null);
    setErro(null);
  };
  useEffect(() => () => fotos.forEach((f) => URL.revokeObjectURL(f.url)), [fotos]);

  // o "Importar arquivos" manda para cá o PDF da Prestação de Contas Operacional
  useEffect(() => {
    const receber = (e: Event) => {
      const arquivo = (e as CustomEvent<File>).detail;
      document.getElementById("fotos")?.scrollIntoView({ behavior: "smooth" });
      void lerRef.current(arquivo);
    };
    window.addEventListener("rgm:fotos-prestacao", receber);
    return () => window.removeEventListener("rgm:fotos-prestacao", receber);
  }, []);

  const ler = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    limpar();
    setAberto(true);
    const controle = new AbortController();
    cancelar.current = controle;
    try {
      const { extrairFotosPrestacao } = await import("@/lib/relatoriosSistema/ler");
      const extraidas = await extrairFotosPrestacao(arquivo, (pagina, total, n) => setProgresso({ pagina, total, fotos: n }), controle.signal);
      if (controle.signal.aborted) return;
      if (!extraidas.length) setErro("Nenhuma foto encontrada. Gere a Prestação de Contas Operacional com a opção de fotos marcada.");
      setFotos(extraidas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o PDF.");
    } finally {
      setProgresso(null);
    }
  };

  const lerRef = useRef(ler);
  lerRef.current = ler;

  const alternar = (id: string) =>
    setEscolhidas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : atual.length >= MAX_ESCOLHA ? atual : [...atual, id]));

  const adicionar = async () => {
    const lista = escolhidas.map((id) => fotos.find((f) => f.id === id)!).filter(Boolean);
    setEnviando(true);
    try {
      await onEscolher(
        lista.map((f, i) => new File([f.blob], `os-${f.os || "sem-numero"}-${i + 1}.jpg`, { type: "image/jpeg" })),
        lista.map((f) => ({ legenda: f.legenda, categoria: f.categoria })),
      );
      limpar();
      setAberto(false);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary">
        <FileImage className="h-4 w-4" /> Escolher fotos da Prestação de Contas Operacional (PDF do LiveFacilities)
        <input
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={(e) => {
            void ler(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {aberto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-executive/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Fotos do LiveFacilities">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-border bg-card shadow-xl">
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">Fotos das ordens de serviço</h2>
                <p className="text-xs text-muted-foreground">
                  Escolha até {MAX_ESCOLHA} fotos. A apresentação mostra as 6 primeiras do relatório
                  {jaTem ? ` (já há ${jaTem} anexada${jaTem > 1 ? "s" : ""})` : ""}. A legenda vem do título da OS e pode ser editada depois.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => {
                  limpar();
                  setAberto(false);
                }}
                className="rounded p-1.5 text-muted-foreground transition hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {progresso ? (
                <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  Lendo página {progresso.pagina} de {progresso.total} · {progresso.fotos} foto(s) encontradas
                  <div className="h-1.5 w-64 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(progresso.pagina / progresso.total) * 100}%` }} />
                  </div>
                </div>
              ) : erro ? (
                <p className="py-16 text-center text-sm text-destructive">{erro}</p>
              ) : !fotos.length ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {fotos.map((f) => {
                    const ordem = escolhidas.indexOf(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => alternar(f.id)}
                        className={`group overflow-hidden rounded-lg border-2 text-left transition ${ordem >= 0 ? "border-primary" : "border-transparent hover:border-primary/40"}`}
                      >
                        <div className="relative aspect-[4/3] bg-surface-soft">
                          <img src={f.url} alt={f.legenda} className="h-full w-full object-cover" loading="lazy" />
                          {ordem >= 0 ? (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                              {ordem + 1}
                            </span>
                          ) : null}
                        </div>
                        <p className="line-clamp-2 px-2 py-1.5 text-xs leading-snug">
                          <strong>OS {f.os || "—"}</strong> · {f.legenda}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
              <span className="text-xs text-muted-foreground">
                {fotos.length ? `${fotos.length} fotos no PDF · ${escolhidas.length} escolhida(s)` : ""}
              </span>
              <button
                type="button"
                disabled={!escolhidas.length || enviando}
                onClick={() => void adicionar()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Adicionar {escolhidas.length || ""} foto(s) ao RGM
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
};
