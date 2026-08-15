/**
 * Campos de entrada do relatório.
 *
 * Todos guardam `number` e mostram máscara pt-BR. O gestor digita "1234,56"
 * ou cola "R$ 1.234,56" do Excel — os dois funcionam. Isso substitui os
 * inputs de texto puro da versão anterior, onde o valor era string e os
 * cálculos usavam `replace(/\D/g,"")` (que corrompia centavos e comia o "-").
 */

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatarMoeda, formatarNumero, lerNumero } from "@/lib/format";
import type { Semaforo } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Base                                                                        */
/* -------------------------------------------------------------------------- */

const baseInput =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none " +
  "transition focus:border-primary focus:ring-2 focus:ring-primary/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60 placeholder:text-muted-foreground/60";

interface RotuloProps {
  label?: string;
  dica?: string;
  obrigatorio?: boolean;
  children: ReactNode;
  className?: string;
}

export const Campo = ({ label, dica, obrigatorio, children, className }: RotuloProps) => (
  <label className={cn("block space-y-1.5", className)}>
    {label ? (
      <span className="flex items-baseline gap-1.5 text-xs font-semibold text-muted-foreground">
        {label}
        {obrigatorio ? <span className="text-destructive">*</span> : null}
        {dica ? <span className="font-normal normal-case opacity-70">· {dica}</span> : null}
      </span>
    ) : null}
    {children}
  </label>
);

/* -------------------------------------------------------------------------- */
/* Texto                                                                       */
/* -------------------------------------------------------------------------- */

interface TextoProps {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  desabilitado?: boolean;
}

export const CampoTexto = ({ valor, onChange, placeholder, className, desabilitado }: TextoProps) => (
  <input
    type="text"
    value={valor}
    disabled={desabilitado}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={cn(baseInput, className)}
  />
);

interface AreaProps extends TextoProps {
  linhas?: number;
  /** Sugestão exibida quando o campo está vazio — orienta sem preencher sozinho. */
  exemplo?: string;
}

export const CampoTextoLongo = ({
  valor,
  onChange,
  placeholder,
  linhas = 4,
  className,
  desabilitado,
  exemplo,
}: AreaProps) => (
  <div className="space-y-1">
    <textarea
      value={valor}
      disabled={desabilitado}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={linhas}
      className={cn(baseInput, "resize-y leading-relaxed", className)}
    />
    {exemplo && !valor ? (
      <p className="text-xs leading-relaxed text-muted-foreground/80">
        <span className="font-semibold">Exemplo:</span> {exemplo}
      </p>
    ) : null}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Numéricos                                                                   */
/* -------------------------------------------------------------------------- */

interface NumeroProps {
  valor: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  desabilitado?: boolean;
  /** Casas decimais na exibição (fora de foco). */
  casas?: number;
  sufixo?: string;
}

/**
 * Enquanto o campo está em foco mostra o texto cru (fácil de editar);
 * ao sair, formata. Evita a briga entre máscara e cursor.
 */
const useNumeroEditavel = (valor: number, casas: number, formatar: (n: number) => string) => {
  const [texto, setTexto] = useState("");
  const [focado, setFocado] = useState(false);

  // Fora de foco mostra a máscara; zero vira campo vazio para o placeholder aparecer.
  const exibicao = focado ? texto : valor === 0 ? "" : formatar(valor);

  const aoFocar = () => {
    setFocado(true);
    setTexto(valor === 0 ? "" : formatarNumero(valor, casas));
  };

  return { exibicao, setTexto, setFocado, aoFocar };
};

export const CampoMoeda = ({
  valor,
  onChange,
  placeholder = "R$ 0,00",
  className,
  desabilitado,
}: NumeroProps) => {
  const { exibicao, setTexto, setFocado, aoFocar } = useNumeroEditavel(valor, 2, formatarMoeda);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={exibicao}
      disabled={desabilitado}
      placeholder={placeholder}
      onFocus={aoFocar}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={(e) => {
        setFocado(false);
        onChange(lerNumero(e.target.value));
      }}
      className={cn(baseInput, "text-right tabular-nums", className)}
    />
  );
};

export const CampoNumero = ({
  valor,
  onChange,
  placeholder = "0",
  className,
  desabilitado,
  casas = 0,
  sufixo,
}: NumeroProps) => {
  const { exibicao, setTexto, setFocado, aoFocar } = useNumeroEditavel(valor, casas, (n) =>
    `${formatarNumero(n, casas)}${sufixo ? ` ${sufixo}` : ""}`,
  );

  return (
    <input
      type="text"
      inputMode="decimal"
      value={exibicao}
      disabled={desabilitado}
      placeholder={placeholder}
      onFocus={aoFocar}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={(e) => {
        setFocado(false);
        onChange(lerNumero(e.target.value));
      }}
      className={cn(baseInput, "text-right tabular-nums", className)}
    />
  );
};

/** Percentual 0–100, travado no intervalo para não gerar barra de 340%. */
export const CampoPercentual = ({
  valor,
  onChange,
  className,
  desabilitado,
  casas = 1,
}: NumeroProps) => {
  const { exibicao, setTexto, setFocado, aoFocar } = useNumeroEditavel(
    valor,
    casas,
    (n) => `${formatarNumero(n, casas)}%`,
  );

  return (
    <input
      type="text"
      inputMode="decimal"
      value={exibicao}
      disabled={desabilitado}
      placeholder="0%"
      onFocus={aoFocar}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={(e) => {
        setFocado(false);
        onChange(Math.min(Math.max(lerNumero(e.target.value), 0), 100));
      }}
      className={cn(baseInput, "text-right tabular-nums", className)}
    />
  );
};

/* -------------------------------------------------------------------------- */
/* Data e seleção                                                              */
/* -------------------------------------------------------------------------- */

export const CampoData = ({
  valor,
  onChange,
  className,
  desabilitado,
}: {
  valor: string;
  onChange: (v: string) => void;
  className?: string;
  desabilitado?: boolean;
}) => (
  <input
    type="date"
    value={valor || ""}
    disabled={desabilitado}
    onChange={(e) => onChange(e.target.value)}
    className={cn(baseInput, className)}
  />
);

interface SelecaoProps<T extends string> {
  valor: T;
  onChange: (v: T) => void;
  opcoes: readonly { valor: T; rotulo: string }[];
  className?: string;
  desabilitado?: boolean;
}

export const CampoSelecao = <T extends string>({
  valor,
  onChange,
  opcoes,
  className,
  desabilitado,
}: SelecaoProps<T>) => (
  <select
    value={valor}
    disabled={desabilitado}
    onChange={(e) => onChange(e.target.value as T)}
    className={cn(baseInput, "cursor-pointer", className)}
  >
    {opcoes.map((o) => (
      <option key={o.valor} value={o.valor}>
        {o.rotulo}
      </option>
    ))}
  </select>
);

/* -------------------------------------------------------------------------- */
/* Lista de bullets — para "Principais resultados" / "Pontos de atenção"       */
/* -------------------------------------------------------------------------- */

export const CampoListaBullets = ({
  itens,
  onChange,
  placeholder = "Digite e pressione Enter",
  desabilitado,
}: {
  itens: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  desabilitado?: boolean;
}) => {
  const [rascunho, setRascunho] = useState("");
  const id = useId();

  const adicionar = () => {
    const t = rascunho.trim();
    if (!t) return;
    onChange([...itens, t]);
    setRascunho("");
  };

  return (
    <div className="space-y-2">
      {itens.map((item, i) => (
        <div key={`${id}-${i}`} className="flex items-start gap-2">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <textarea
            value={item}
            disabled={desabilitado}
            rows={Math.max(1, Math.ceil(item.length / 70))}
            onChange={(e) => onChange(itens.map((x, j) => (j === i ? e.target.value : x)))}
            className={cn(baseInput, "resize-none py-1.5")}
          />
          <button
            type="button"
            disabled={desabilitado}
            onClick={() => onChange(itens.filter((_, j) => j !== i))}
            aria-label={`Remover item ${i + 1}`}
            className="mt-1 rounded p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          type="text"
          value={rascunho}
          disabled={desabilitado}
          placeholder={placeholder}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          className={cn(baseInput, "border-dashed")}
        />
        <button
          type="button"
          disabled={desabilitado || !rascunho.trim()}
          onClick={adicionar}
          className="shrink-0 rounded-md border border-input px-3 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Semáforo — a linguagem visual que a RPS já usa no PPTX                      */
/* -------------------------------------------------------------------------- */

const CORES_SEMAFORO: Record<Semaforo, string> = {
  verde: "bg-semaforo-verde/12 text-semaforo-verde border-semaforo-verde/30",
  amarelo: "bg-semaforo-amarelo/12 text-semaforo-amarelo border-semaforo-amarelo/35",
  vermelho: "bg-semaforo-vermelho/12 text-semaforo-vermelho border-semaforo-vermelho/30",
};

const ROTULOS: Record<Semaforo, string> = {
  verde: "Verde",
  amarelo: "Amarelo",
  vermelho: "Vermelho",
};

export const BadgeSemaforo = ({
  semaforo,
  rotulo,
  className,
}: {
  semaforo: Semaforo;
  rotulo?: string;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold",
      CORES_SEMAFORO[semaforo],
      className,
    )}
  >
    <span className="h-2 w-2 rounded-full bg-current" />
    {rotulo ?? ROTULOS[semaforo]}
  </span>
);

export const PontoSemaforo = ({ semaforo, className }: { semaforo: Semaforo; className?: string }) => (
  <span
    className={cn(
      "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
      semaforo === "verde"
        ? "bg-semaforo-verde"
        : semaforo === "amarelo"
          ? "bg-semaforo-amarelo"
          : "bg-semaforo-vermelho",
      className,
    )}
    aria-label={ROTULOS[semaforo]}
  />
);
