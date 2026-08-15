import { useCallback, useEffect, useRef, useState } from "react";

export type EstadoSalvamento = "ocioso" | "pendente" | "salvando" | "salvo" | "erro";

interface Opcoes<T> {
  valor: T;
  salvar: (valor: T) => Promise<void>;
  /** Espera após a última tecla antes de gravar. */
  atrasoMs?: number;
  ativo?: boolean;
}

/**
 * Autosave com debounce.
 *
 * Três garantias que faltavam na versão anterior (onde nada era salvo):
 *  - grava só depois que o gestor para de digitar, em vez de a cada tecla;
 *  - avisa o navegador se houver alteração pendente ao fechar a aba;
 *  - grava uma última vez ao desmontar, para não perder o que estava no ar.
 */
export const useAutosave = <T,>({ valor, salvar, atrasoMs = 1200, ativo = true }: Opcoes<T>) => {
  const [estado, setEstado] = useState<EstadoSalvamento>("ocioso");
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ultimoSalvo = useRef<string>();
  const valorRef = useRef(valor);
  const salvarRef = useRef(salvar);

  valorRef.current = valor;
  salvarRef.current = salvar;

  const gravar = useCallback(async (v: T) => {
    const serializado = JSON.stringify(v);
    if (serializado === ultimoSalvo.current) return;

    setEstado("salvando");
    try {
      await salvarRef.current(v);
      ultimoSalvo.current = serializado;
      setSalvoEm(new Date().toISOString());
      setEstado("salvo");
      setErro(null);
    } catch (e) {
      setEstado("erro");
      setErro(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }, []);

  // Marca o estado inicial como já salvo: carregar não é alterar.
  const iniciado = useRef(false);
  useEffect(() => {
    if (!iniciado.current && ativo) {
      iniciado.current = true;
      ultimoSalvo.current = JSON.stringify(valor);
    }
  }, [valor, ativo]);

  useEffect(() => {
    if (!ativo || !iniciado.current) return;
    if (JSON.stringify(valor) === ultimoSalvo.current) return;

    setEstado("pendente");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void gravar(valor), atrasoMs);

    return () => clearTimeout(timer.current);
  }, [valor, ativo, atrasoMs, gravar]);

  // Alerta ao fechar a aba com alteração ainda não gravada
  useEffect(() => {
    const aoSair = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(valorRef.current) !== ultimoSalvo.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, []);

  // Última gravação ao sair da tela
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (JSON.stringify(valorRef.current) !== ultimoSalvo.current) {
        void salvarRef.current(valorRef.current);
      }
    },
    [],
  );

  const salvarAgora = useCallback(() => {
    clearTimeout(timer.current);
    return gravar(valorRef.current);
  }, [gravar]);

  return { estado, salvoEm, erro, salvarAgora };
};
