import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Empreendimento {
  id: string; codigo: string; nome: string; cidade?: string | null;
}
interface Ctx {
  empreendimentos: Empreendimento[];
  selected: string;
  setSelected: (id: string) => void;
  reload: () => Promise<void>;
  selectedObj?: Empreendimento;
}
const EmpCtx = createContext<Ctx | null>(null);

export function EmpreendimentoProvider({ children }: { children: ReactNode }) {
  const [emps, setEmps] = useState<Empreendimento[]>([]);
  const [selected, setSelectedState] = useState<string>(() => localStorage.getItem("emp:selected") ?? "");

  const reload = useCallback(async () => {
    const { data } = await supabase.from("empreendimentos").select("id,codigo,nome,cidade").eq("ativo", true).order("codigo");
    const list = (data ?? []) as Empreendimento[];
    setEmps(list);
    if (list.length && !list.find(e => e.id === selected)) {
      setSelectedState(list[0].id);
      localStorage.setItem("emp:selected", list[0].id);
    }
  }, [selected]);

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setSelected = (id: string) => {
    setSelectedState(id);
    localStorage.setItem("emp:selected", id);
  };

  return (
    <EmpCtx.Provider value={{ empreendimentos: emps, selected, setSelected, reload, selectedObj: emps.find(e => e.id === selected) }}>
      {children}
    </EmpCtx.Provider>
  );
}

export const useEmpreendimento = () => {
  const ctx = useContext(EmpCtx);
  if (!ctx) throw new Error("useEmpreendimento must be inside EmpreendimentoProvider");
  return ctx;
};