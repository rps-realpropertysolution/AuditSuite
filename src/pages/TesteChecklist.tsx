/**
 * SÓ EM DESENVOLVIMENTO: o painel "Para fechar o RGM" com um relatório local
 * (saida/demo/<mes>.json) — para revisar a tela sem login.  /teste-checklist?mes=2026-10&limpar=1
 */

import { useEffect, useState } from "react";
import { ChecklistMes } from "@/components/relatorio/ChecklistMes";
import { ImportarArquivos } from "@/components/relatorio/ImportarArquivos";
import { normalizarDados } from "@/lib/defaults";
import type { DadosRelatorio } from "@/lib/types";

const RAIZ = import.meta.env.DEV ? `/@fs/${(import.meta.env.VITE_RAIZ_SAIDA as string | undefined) ?? ""}` : "";

const TesteChecklist = () => {
  const p = new URLSearchParams(window.location.search);
  const [dados, setDados] = useState<DadosRelatorio | null>(null);

  useEffect(() => {
    void (async () => {
      const { dados: bruto } = await (await fetch(`${RAIZ}/demo/${p.get("mes") ?? "2026-10"}.json`)).json();
      const d = normalizarDados(bruto);
      // ?limpar=1 simula o relatório recém-importado: sem os textos do gestor
      if (p.get("limpar")) {
        d.sumario.avaliacaoGeral = "";
        d.conclusao = "";
        d.financeiro.comentario = "";
        d.riscos.linhas = [];
        d.fotos = [];
        d.financeiro.grupos = d.financeiro.grupos.map((g) => ({ ...g, observacao: "" }));
      }
      setDados(d);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dados) return <p className="p-6">carregando…</p>;
  if (p.get("importar"))
    return (
      <ImportarArquivos
        dados={dados}
        contexto={{ competencia: "2026-10-01", competenciaFinanceira: "2026-09-01", cdCondominio: "1003" }}
        nomeEmpreendimento="P500"
        onAplicar={() => undefined}
        onFechar={() => undefined}
      />
    );
  return (
    <div className="mx-auto max-w-3xl p-6">
      <ChecklistMes
        dados={dados}
        atualizar={(k, v) => setDados((d) => (d ? { ...d, [k]: v } : d))}
        integrado
        importandoLF={false}
        onImportarLF={() => undefined}
        onImportarArquivos={() => undefined}
      />
    </div>
  );
};

export default TesteChecklist;
