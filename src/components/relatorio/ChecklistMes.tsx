/**
 * Painel "Para fechar o RGM" — topo do editor.
 *
 * O gestor não precisa percorrer 14 seções: aqui aparece só o que falta,
 * com o campo ali mesmo e uma sugestão de texto pronta para revisar.
 */

import { useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, CloudDownload, FileUp, Loader2, Sparkles } from "lucide-react";
import { CampoNumero } from "@/components/campos";
import { desviosSemJustificativa, pendenciasDoMes, type Pendencia } from "@/lib/checklist";
import { calcularAlertas, variacao } from "@/lib/metrics";
import { novoId } from "@/lib/defaults";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { DadosRelatorio } from "@/lib/types";

interface Props {
  dados: DadosRelatorio;
  atualizar: <K extends keyof DadosRelatorio>(chave: K, valor: DadosRelatorio[K]) => void;
  integrado: boolean;
  importandoLF: boolean;
  onImportarLF: () => void;
  onImportarArquivos: () => void;
}

const irPara = (id?: string) => id && document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export const ChecklistMes = ({ dados, atualizar, integrado, importandoLF, onImportarLF, onImportarArquivos }: Props) => {
  const itens = useMemo(() => pendenciasDoMes(dados, { integrado }), [dados, integrado]);
  const feitos = itens.filter((i) => i.feito).length;
  const proximo = itens.find((i) => !i.feito);
  const [aberto, setAberto] = useState<string | null>(null);
  const [recolhido, setRecolhido] = useState(false);
  const atual = aberto ?? proximo?.id ?? null;
  const pct = Math.round((feitos / itens.length) * 100);

  const lerTexto = (p: Pendencia) =>
    p.campo === "avaliacaoGeral" ? dados.sumario.avaliacaoGeral : p.campo === "conclusao" ? dados.conclusao : dados.financeiro.comentario;
  const gravarTexto = (p: Pendencia, v: string) => {
    if (p.campo === "avaliacaoGeral") atualizar("sumario", { ...dados.sumario, avaliacaoGeral: v });
    else if (p.campo === "conclusao") atualizar("conclusao", v);
    else atualizar("financeiro", { ...dados.financeiro, comentario: v });
  };

  const corpo = (p: Pendencia) => {
    switch (p.tipo) {
      case "importar_lf":
        return (
          <button type="button" onClick={onImportarLF} disabled={importandoLF} className="botao-primario">
            {importandoLF ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
            {p.feito ? "Atualizar do LiveFacilities" : "Importar agora"}
          </button>
        );
      case "importar_arquivos":
        return (
          <button type="button" onClick={onImportarArquivos} className="botao-primario">
            <FileUp className="h-4 w-4" /> Arrastar os arquivos
          </button>
        );
      case "texto":
        return (
          <div className="space-y-2">
            <textarea
              value={lerTexto(p)}
              onChange={(e) => gravarTexto(p, e.target.value)}
              rows={p.campo === "comentarioFinanceiro" ? 4 : 3}
              placeholder={p.sugestao ? "Escreva aqui — ou use a sugestão abaixo e ajuste." : "Escreva aqui."}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
            />
            {p.sugestao && lerTexto(p).trim() !== p.sugestao.trim() ? (
              <div className="rounded-md bg-primary/5 p-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Sugestão a partir dos números
                </p>
                <p className="whitespace-pre-line text-muted-foreground">{p.sugestao}</p>
                <button type="button" onClick={() => gravarTexto(p, p.sugestao!)} className="mt-2 text-sm font-bold text-primary hover:underline">
                  Usar sugestão
                </button>
              </div>
            ) : null}
          </div>
        );
      case "desvios": {
        const desvios = desviosSemJustificativa(dados);
        if (!desvios.length) return <p className="text-sm text-muted-foreground">Nenhum grupo acima do limite — nada a justificar.</p>;
        return (
          <div className="space-y-2">
            {desvios.map((g) => (
              <label key={g.id} className="block text-sm">
                <span className="font-semibold">{g.grupo}</span>{" "}
                <span className="text-semaforo-vermelho">+{formatarNumero(variacao(g.realizado, g.orcado) ?? 0, 1)}%</span>{" "}
                <span className="text-muted-foreground">
                  ({formatarMoeda(g.realizado)} para {formatarMoeda(g.orcado)} orçados)
                </span>
                <input
                  defaultValue={g.observacao}
                  onBlur={(e) =>
                    e.target.value.trim() &&
                    atualizar("financeiro", {
                      ...dados.financeiro,
                      grupos: dados.financeiro.grupos.map((x) => (x.id === g.id ? { ...x, observacao: e.target.value.trim() } : x)),
                    })
                  }
                  placeholder="Por que ficou acima? Ex.: lavagem extra de fachada, reembolsável."
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>
        );
      }
      case "ocupacao":
        return (
          <div className="flex items-center gap-2">
            <div className="w-32">
              <CampoNumero valor={dados.operacao.ocupacao} onChange={(v) => atualizar("operacao", { ...dados.operacao, ocupacao: Math.min(100, Math.max(0, v)) })} />
            </div>
            <span className="text-sm text-muted-foreground">% ocupado</span>
          </div>
        );
      case "riscos": {
        const alertas = calcularAlertas(dados).filter((a) => a.severidade !== "verde");
        return (
          <div className="flex flex-wrap gap-2">
            {alertas.length && !dados.riscos.linhas.length ? (
              <button
                type="button"
                className="botao-primario"
                onClick={() =>
                  atualizar("riscos", {
                    ...dados.riscos,
                    linhas: alertas.slice(0, 8).map((a) => ({
                      id: novoId(),
                      assunto: a.titulo,
                      criticidade: a.severidade === "vermelho" ? "alta" : "media",
                      acao: a.detalhe,
                      responsavel: "",
                      prazo: "",
                      status: "em_andamento" as const,
                    })),
                  })
                }
              >
                <Sparkles className="h-4 w-4" /> Criar {Math.min(alertas.length, 8)} ações a partir dos alertas
              </button>
            ) : null}
            <button type="button" onClick={() => irPara(p.secao)} className="botao-secundario">
              Abrir o plano de ação <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        );
      }
      default:
        return (
          <button type="button" onClick={() => irPara(p.secao)} className="botao-secundario">
            Ir para a seção <ArrowRight className="h-4 w-4" />
          </button>
        );
    }
  };

  return (
    <section className="rounded-xl border border-primary/30 bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-base font-bold">{feitos === itens.length ? "RGM pronto para publicar" : "Para fechar o RGM"}</h2>
          <p className="text-sm text-muted-foreground">
            {feitos} de {itens.length} passos · {itens.length - feitos ? `faltam ${itens.length - feitos}` : "tudo feito — revise e publique"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-semaforo-verde transition-all" style={{ width: `${pct}%` }} />
          </div>
          <button type="button" onClick={() => setRecolhido((r) => !r)} className="rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label={recolhido ? "Mostrar passos" : "Recolher passos"}>
            {recolhido ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {!recolhido ? (
        <ol className="border-t border-border">
          {itens.map((p, n) => {
            const expandido = atual === p.id;
            return (
              <li key={p.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? "__nenhum" : p.id)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-surface-soft/60"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      p.feito ? "bg-semaforo-verde text-white" : expandido ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.feito ? <Check className="h-3.5 w-3.5" /> : n + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${p.feito ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}`}>{p.titulo}</span>
                    {expandido ? <span className="block text-xs text-muted-foreground">{p.explicacao}</span> : null}
                  </span>
                </button>
                {expandido ? <div className="px-5 pb-4 pl-14">{corpo(p)}</div> : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
};
