/**
 * Blocos de montagem das seções do relatório.
 *
 * `TabelaEditavel` centraliza o comportamento que antes estava copiado em
 * nove funções `update*` quase idênticas — e acrescenta o que faltava:
 * remover linha, duplicar linha, estado vazio explicativo e modo somente
 * leitura (para quando quem abre é o síndico, não o gestor).
 */

import { useState, type ReactNode } from "react";
import { Plus, Copy, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Cartão de seção                                                             */
/* -------------------------------------------------------------------------- */

interface SecaoProps {
  id?: string;
  titulo: string;
  descricao?: string;
  icone?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  /** Alerta contextual no topo da seção (ex.: "3 documentos vencem em 60 dias"). */
  aviso?: ReactNode;
  className?: string;
}

export const Secao = ({ id, titulo, descricao, icone, acoes, children, aviso, className }: SecaoProps) => (
  <section
    id={id}
    className={cn("scroll-mt-24 rounded-xl border border-border bg-card shadow-sm", className)}
  >
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="flex items-start gap-3">
        {icone ? <span className="mt-0.5 text-primary">{icone}</span> : null}
        <div>
          <h2 className="text-lg font-bold leading-tight text-foreground">{titulo}</h2>
          {descricao ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{descricao}</p>
          ) : null}
        </div>
      </div>
      {acoes ? <div className="flex items-center gap-2">{acoes}</div> : null}
    </header>

    {aviso ? <div className="border-b border-border px-5 py-3">{aviso}</div> : null}
    <div className="space-y-5 p-5">{children}</div>
  </section>
);

/* -------------------------------------------------------------------------- */
/* Tabela editável                                                             */
/* -------------------------------------------------------------------------- */

export interface Coluna<T> {
  chave: string;
  titulo: string;
  /** Classe de largura, ex.: "w-40" ou "min-w-[220px]". */
  largura?: string;
  alinhar?: "esquerda" | "direita" | "centro";
  render: (linha: T, atualizar: (patch: Partial<T>) => void, indice: number) => ReactNode;
}

interface TabelaProps<T extends { id: string }> {
  linhas: T[];
  colunas: Coluna<T>[];
  onChange: (linhas: T[]) => void;
  novaLinha: () => T;
  rotuloAdicionar?: string;
  somenteLeitura?: boolean;
  vazio?: { titulo: string; descricao: string };
  /** Linha de totais renderizada no rodapé. */
  rodape?: ReactNode;
}

export const TabelaEditavel = <T extends { id: string }>({
  linhas,
  colunas,
  onChange,
  novaLinha,
  rotuloAdicionar = "Adicionar linha",
  somenteLeitura = false,
  vazio,
  rodape,
}: TabelaProps<T>) => {
  const atualizarLinha = (indice: number, patch: Partial<T>) =>
    onChange(linhas.map((l, i) => (i === indice ? { ...l, ...patch } : l)));

  const remover = (indice: number) => onChange(linhas.filter((_, i) => i !== indice));

  const duplicar = (indice: number) => {
    const copia = { ...linhas[indice], ...novaLinha(), ...linhas[indice] };
    copia.id = novaLinha().id;
    onChange([...linhas.slice(0, indice + 1), copia, ...linhas.slice(indice + 1)]);
  };

  const alinhamento = (a?: Coluna<T>["alinhar"]) =>
    a === "direita" ? "text-right" : a === "centro" ? "text-center" : "text-left";

  if (linhas.length === 0 && vazio) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-soft/50 px-6 py-10 text-center">
        <h3 className="font-semibold text-foreground">{vazio.titulo}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
          {vazio.descricao}
        </p>
        {!somenteLeitura ? (
          <button
            type="button"
            onClick={() => onChange([novaLinha()])}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {rotuloAdicionar}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-soft">
              {colunas.map((c) => (
                <th
                  key={c.chave}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground",
                    alinhamento(c.alinhar),
                    c.largura,
                  )}
                >
                  {c.titulo}
                </th>
              ))}
              {!somenteLeitura ? <th className="w-20 px-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, i) => (
              <tr key={linha.id} className="border-t border-border align-top transition hover:bg-surface-soft/40">
                {colunas.map((c) => (
                  <td key={c.chave} className={cn("px-3 py-2", alinhamento(c.alinhar))}>
                    {c.render(linha, (patch) => atualizarLinha(i, patch), i)}
                  </td>
                ))}
                {!somenteLeitura ? (
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => duplicar(i)}
                        title="Duplicar linha"
                        aria-label={`Duplicar linha ${i + 1}`}
                        className="rounded p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(i)}
                        title="Remover linha"
                        aria-label={`Remover linha ${i + 1}`}
                        className="rounded p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          {rodape ? <tfoot className="border-t-2 border-border bg-surface-soft">{rodape}</tfoot> : null}
        </table>
      </div>

      {!somenteLeitura ? (
        <button
          type="button"
          onClick={() => onChange([...linhas, novaLinha()])}
          className="inline-flex items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" /> {rotuloAdicionar}
        </button>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Comentário do gestor                                                        */
/* -------------------------------------------------------------------------- */

export const ComentarioGestor = ({
  valor,
  onChange,
  somenteLeitura,
  exemplo,
}: {
  valor: string;
  onChange: (v: string) => void;
  somenteLeitura?: boolean;
  exemplo?: string;
}) => {
  if (somenteLeitura) {
    if (!valor.trim()) return null;
    return (
      <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Análise do gestor</h4>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{valor}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 p-4">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-primary">
          Análise do gestor
        </span>
        <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
          É aqui que o síndico entende <em>por quê</em>. Os números já estão na tabela.
        </p>
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="Explique os desvios, o risco e o que será feito."
          className="w-full rounded-md border border-input bg-background p-3 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      {exemplo && !valor ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/80">
          <span className="font-semibold">Exemplo:</span> {exemplo}
        </p>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Painel colapsável — usado para detalhes opcionais                           */
/* -------------------------------------------------------------------------- */

export const Colapsavel = ({
  titulo,
  children,
  abertoInicial = false,
}: {
  titulo: string;
  children: ReactNode;
  abertoInicial?: boolean;
}) => {
  const [aberto, setAberto] = useState(abertoInicial);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold transition hover:bg-surface-soft"
      >
        {titulo}
        {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {aberto ? <div className="border-t border-border p-4">{children}</div> : null}
    </div>
  );
};
