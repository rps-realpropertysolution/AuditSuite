/**
 * SÓ EM DESENVOLVIMENTO: o painel "Para fechar o RGM" com um relatório local
 * (saida/demo/<mes>.json) — para revisar a tela sem login.  /teste-checklist?mes=2026-10&limpar=1
 */

import { useEffect, useState } from "react";
import { ChecklistMes } from "@/components/relatorio/ChecklistMes";
import { ImportarArquivos } from "@/components/relatorio/ImportarArquivos";
import { ContextoOrigem, LegendaOrigem } from "@/components/relatorio/OrigemDados";
import { SecaoFinanceiro } from "@/components/relatorio/secoes-financeiro";
import { SecaoOperacao } from "@/components/relatorio/secoes-operacao";
import { marcarOrigem } from "@/lib/origem";
import { relatorioEmBranco } from "@/lib/defaults";
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
  // ?secoes=1 — cores de origem: tudo como LiveFacilities, grupos e fundos como arquivo
  if (p.get("secoes")) {
    const lf = marcarOrigem(relatorioEmBranco(), dados, "lf");
    const semGrupos = { ...lf, financeiro: { ...lf.financeiro, grupos: [], fundos: [] } };
    const marcado = marcarOrigem(semGrupos, lf, "arquivo");
    const props = { dados: marcado, atualizar: () => undefined, somenteLeitura: false };
    return (
      <ContextoOrigem.Provider value={marcado.origemDados ?? null}>
        <div className="mx-auto max-w-5xl space-y-6 p-6">
          <LegendaOrigem />
          <SecaoFinanceiro {...props} competencia="2026-10-01" />
          <SecaoOperacao {...props} />
        </div>
      </ContextoOrigem.Provider>
    );
  }
  if (p.get("importar"))
    return (
      <ImportarArquivos
        dados={dados}
        contexto={{
          competencia: p.get("comp") ?? "2026-10-01",
          competenciaFinanceira: p.get("fin") ?? "2026-09-01",
          cdCondominio: p.get("cd") ?? "1003",
        }}
        nomeEmpreendimento={p.get("nome") ?? "P500"}
        onAplicar={(novos) => {
          (window as unknown as { aplicado: unknown }).aplicado = { arquivos: novos.arquivosImportados.length, pedidos: novos.suprimentos.pedidos.length };
          document.title = "APLICADO";
        }}
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
