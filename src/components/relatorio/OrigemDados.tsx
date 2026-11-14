/**
 * TEMPORÁRIO — conferência visual de onde veio cada dado no editor:
 * azul = LiveFacilities (API), amarelo = arquivos que o gestor importou.
 */

import { createContext, useContext, type ReactNode } from "react";
import { COR_ORIGEM, type MapaOrigem } from "@/lib/origem";
import { cn } from "@/lib/utils";

export const ContextoOrigem = createContext<MapaOrigem | null>(null);

/** Classe de fundo da linha de tabela conforme a origem (ou vazio). */
export const useCorLinha = (id: string) => {
  const mapa = useContext(ContextoOrigem);
  const o = mapa?.linhas[id];
  return o ? COR_ORIGEM[o].linha : "";
};

/** Moldura colorida em volta de um bloco de campos soltos importado. */
export const BlocoOrigem = ({ chave, children, className }: { chave: string; children: ReactNode; className?: string }) => {
  const mapa = useContext(ContextoOrigem);
  const o = mapa?.blocos[chave];
  return <div className={cn(className, o ? COR_ORIGEM[o].bloco : "")}>{children}</div>;
};

export const LegendaOrigem = () => {
  const mapa = useContext(ContextoOrigem);
  if (!mapa || (!Object.keys(mapa.linhas).length && !Object.keys(mapa.blocos).length)) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-dashed border-border bg-card px-4 py-2 text-xs text-muted-foreground">
      <strong className="text-foreground">Conferência (temporário):</strong>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-sky-200 ring-1 ring-sky-400" /> veio do LiveFacilities
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-amber-200 ring-1 ring-amber-400" /> veio dos arquivos importados
      </span>
      <span>· sem cor: lançado à mão ou herdado do mês anterior</span>
    </p>
  );
};
