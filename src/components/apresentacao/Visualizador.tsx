/**
 * Visualizador de slides 16:9 — usado pelo RGM mensal e pela visão anual.
 *
 *  modo reunião: um slide por vez, tela cheia (F), setas/espaço navegam,
 *                G abre a grade, links internos (sumário, capítulos) navegam;
 *  modo PDF:     todos os slides empilhados, uma página 16:9 por slide, e a
 *                janela de impressão abre sozinha.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Grid3x3, Maximize2, Printer, X } from "lucide-react";
import { ALTURA, LARGURA, Palco } from "./moldura";
import type { SlideMontado } from "./slides";

export const Visualizador = ({
  slides,
  modoPdf,
  sair,
}: {
  slides: Pick<SlideMontado, "id" | "titulo" | "node">[];
  modoPdf: boolean;
  sair: () => void;
}) => {
  const [indice, setIndice] = useState(0);
  const [grade, setGrade] = useState(false);
  const total = slides.length;
  const ir = useCallback((delta: number) => setIndice((i) => Math.min(Math.max(i + delta, 0), Math.max(total - 1, 0))), [total]);
  const telaCheia = () =>
    document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen().catch(() => undefined);

  useEffect(() => {
    if (modoPdf) return;
    const tecla = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        ir(1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        ir(-1);
      } else if (e.key === "Home") setIndice(0);
      else if (e.key === "End") setIndice(total - 1);
      else if (e.key.toLowerCase() === "g") setGrade((g) => !g);
      else if (e.key === "Escape" && !document.fullscreenElement) {
        if (grade) setGrade(false);
        else sair();
      } else if (e.key.toLowerCase() === "f") telaCheia();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ir, sair, modoPdf, total, grade]);

  // No modo PDF, abre a impressão quando fontes e imagens terminaram de carregar.
  useEffect(() => {
    if (!modoPdf || !slides.length) return;
    let cancelado = false;
    const imprimir = async () => {
      await document.fonts?.ready;
      const imgs = [...document.querySelectorAll<HTMLImageElement>(".slides-impressao img")];
      await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => img.addEventListener("load", r, { once: true })))));
      await new Promise((r) => setTimeout(r, 400));
      if (!cancelado) window.print();
    };
    void imprimir();
    return () => {
      cancelado = true;
    };
  }, [modoPdf, slides.length]);

  /* ------------------------------------------------------------ PDF */
  if (modoPdf) {
    return (
      <div className="min-h-screen bg-[#e9eaf0]">
        <div className="screen-only sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
          <div className="text-sm">
            <p className="font-bold">PDF do relatório · {slides.length} páginas</p>
            <p className="text-xs text-muted-foreground">
              Na janela de impressão escolha <strong>Salvar como PDF</strong>, margens <strong>Nenhuma</strong> e ative{" "}
              <strong>Gráficos de plano de fundo</strong>.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground">
              <Printer className="h-4 w-4" /> Imprimir / salvar PDF
            </button>
            <button type="button" onClick={sair} className="rounded-md border border-input px-3.5 py-2 text-sm font-semibold">
              Voltar
            </button>
          </div>
        </div>
        <div className="slides-impressao flex flex-col items-center gap-6 py-6">
          {slides.map((s) => (
            <div key={s.id} id={`slide-${s.id}`} className="slide-pagina bg-white shadow-lg" style={{ width: LARGURA, height: ALTURA }}>
              {s.node}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- apresentação */
  return (
    <div className="fixed inset-0 flex flex-col bg-[#0f0e2e]">
      <main
        className="relative min-h-0 flex-1 p-4"
        onClick={(e) => {
          // Links do sumário, dos capítulos e do rodapé levam ao slide; o resto avança/volta.
          const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#slide-"]');
          if (link) {
            e.preventDefault();
            const alvo = slides.findIndex((s) => `#slide-${s.id}` === link.getAttribute("href"));
            if (alvo >= 0) setIndice(alvo);
            return;
          }
          if (e.clientX > window.innerWidth / 2) ir(1);
          else ir(-1);
        }}
      >
        <Palco>
          {/* key: cada troca de slide reinicia a entrada animada */}
          <div key={slides[indice]?.id} className="rgm-entrada">
            {slides[indice]?.node}
          </div>
        </Palco>
      </main>

      {grade ? (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f0e2e]/95 p-8">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setIndice(i);
                  setGrade(false);
                }}
                className={`group text-left ${i === indice ? "ring-2 ring-[#02B4D7]" : ""}`}
              >
                <div className="pointer-events-none aspect-video overflow-hidden bg-white">
                  <div style={{ width: LARGURA, height: ALTURA, transform: "scale(0.22)", transformOrigin: "top left" }}>{s.node}</div>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-white/80 group-hover:text-white">
                  {i + 1}. {s.titulo}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <footer className="flex shrink-0 items-center justify-between gap-4 bg-[#0f0e2e] px-5 py-2.5 text-white/70">
        <div className="flex items-center gap-1">
          <button type="button" onClick={sair} title="Sair (Esc)" aria-label="Sair da apresentação" className="rounded-md p-2 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <button type="button" onClick={telaCheia} title="Tela cheia (F)" aria-label="Alternar tela cheia" className="rounded-md p-2 transition hover:bg-white/10 hover:text-white">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setGrade((g) => !g)} title="Todos os slides (G)" aria-label="Ver todos os slides" className="rounded-md p-2 transition hover:bg-white/10 hover:text-white">
            <Grid3x3 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 items-center gap-1">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndice(i)}
              title={s.titulo}
              aria-label={`Ir para ${s.titulo}`}
              className={`h-1.5 flex-1 rounded-full transition ${i === indice ? "bg-[#02B4D7]" : i < indice ? "bg-white/40" : "bg-white/15"}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-2 hidden text-xs font-semibold sm:inline">{slides[indice]?.titulo}</span>
          <span className="text-xs font-semibold tabular-nums">
            {indice + 1} / {total}
          </span>
          <button type="button" onClick={() => ir(-1)} disabled={indice === 0} aria-label="Slide anterior" className="rounded-md p-2 transition hover:bg-white/10 hover:text-white disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => ir(1)} disabled={indice === total - 1} aria-label="Próximo slide" className="rounded-md p-2 transition hover:bg-white/10 hover:text-white disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};
