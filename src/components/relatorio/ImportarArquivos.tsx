/**
 * "Importar arquivos do sistema": o gestor arrasta os relatórios exportados do
 * LiveFacilities (PDF/Excel) e as contas de água e luz; o RGM se preenche.
 *
 * Tudo é lido no navegador. Antes de aplicar, mostra o que cada arquivo vai
 * preencher e o que foi recusado (outro prédio, outro mês, formato errado).
 */

import { useState } from "react";
import { CheckCircle2, CircleAlert, FileSpreadsheet, FileText, FileUp, Loader2, X, XCircle } from "lucide-react";
import { interpretarArquivo } from "@/lib/relatoriosSistema/interpretar";
import { aplicarArquivos, TITULO_RELATORIO, type ContextoAplicacao, type ResultadoArquivos } from "@/lib/relatoriosSistema/aplicar";
import type { ResultadoLeitura } from "@/lib/relatoriosSistema/tipos";
import { formatarCompetencia } from "@/lib/format";
import type { DadosRelatorio } from "@/lib/types";

interface Props {
  dados: DadosRelatorio;
  contexto: ContextoAplicacao;
  onAplicar: (dados: DadosRelatorio) => void;
  onFechar: () => void;
}

const COMO_GERAR: { item: string; caminho: string }[] = [
  { item: "Previsto x Realizado (PDF)", caminho: "Relatórios › Financeiro › Previsto x Realizado — período do mês, botão Sintético" },
  { item: "Posição Financeira (PDF)", caminho: "Relatórios › Financeiro › Posição Financeira — do dia 1 ao último dia do mês" },
  { item: "Boletos pagos (Excel)", caminho: "Relatórios › Financeiro › Lista de Boletos Pagos — marque Excel (serve de conferência)" },
  { item: "Contas de água e energia (PDF)", caminho: "Lista Geral de Contas › pagamento › aba Documento (Sabesp e Enel)" },
  { item: "Pedidos de compra (Excel)", caminho: "Geral › Administrativo › Compras › Lista de Pedidos › Excel" },
];

export const ImportarArquivos = ({ dados, contexto, onAplicar, onFechar }: Props) => {
  const [lendo, setLendo] = useState(false);
  const [leituras, setLeituras] = useState<ResultadoLeitura[]>([]);
  const [previa, setPrevia] = useState<ResultadoArquivos | null>(null);

  const ler = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setLendo(true);
    const { lerArquivo } = await import("@/lib/relatoriosSistema/ler");
    const novas: ResultadoLeitura[] = [];
    for (const arquivo of Array.from(lista)) {
      try {
        novas.push(interpretarArquivo(await lerArquivo(arquivo)));
      } catch (e) {
        novas.push({ ok: false, nome: arquivo.name, erro: e instanceof Error ? e.message : "não foi possível ler o arquivo" });
      }
    }
    // o mesmo arquivo de novo substitui o anterior
    const todas = [...leituras.filter((l) => !novas.some((n) => n.nome === l.nome)), ...novas];
    setLeituras(todas);
    const validas = todas.flatMap((l) => ("relatorio" in l ? [{ nome: l.nome, relatorio: l.relatorio }] : []));
    setPrevia(validas.length ? aplicarArquivos(dados, validas, contexto) : null);
    setLendo(false);
  };

  const erros = leituras.filter((l): l is Extract<ResultadoLeitura, { ok: false }> => "erro" in l);
  const recusados = previa?.recusados ?? [];
  const aplicaveis = previa?.preenchido.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-executive/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Importar arquivos do sistema" onClick={onFechar}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Importar arquivos do sistema</h2>
            <p className="text-xs text-muted-foreground">
              RGM de {formatarCompetencia(contexto.competencia)} · financeiro de {formatarCompetencia(contexto.competenciaFinanceira)}. Os
              arquivos são lidos aqui no navegador.
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded p-1.5 text-muted-foreground transition hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void ler(e.dataTransfer.files);
            }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-surface-soft/60 px-6 py-8 text-center transition hover:border-primary hover:bg-surface-soft"
          >
            {lendo ? <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" /> : <FileUp className="mb-2 h-8 w-8 text-primary" />}
            <strong className="text-sm">{lendo ? "Lendo os arquivos…" : "Arraste os relatórios aqui ou clique para selecionar"}</strong>
            <span className="mt-1 text-xs text-muted-foreground">PDF ou Excel (.xlsx) · pode mandar vários de uma vez · prefira Excel quando o sistema oferecer</span>
            <input
              type="file"
              accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              multiple
              className="sr-only"
              disabled={lendo}
              onChange={(e) => {
                void ler(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {!leituras.length ? (
            <section className="rounded-lg bg-surface-soft p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">Onde gerar cada um no LiveFacilities</h3>
              <ul className="space-y-1.5 text-sm">
                {COMO_GERAR.map((c) => (
                  <li key={c.item}>
                    <strong>{c.item}:</strong> <span className="text-muted-foreground">{c.caminho}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {leituras.length ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Arquivos</h3>
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {leituras.map((l) => {
                  const recusa = recusados.find((r) => r.nome === l.nome);
                  const titulo = "relatorio" in l ? (l.relatorio.tipo === "informativo" ? l.relatorio.titulo : TITULO_RELATORIO[l.relatorio.tipo]) : null;
                  const Icone = /\.xlsx$/i.test(l.nome) ? FileSpreadsheet : FileText;
                  return (
                    <li key={l.nome} className="flex items-start gap-3 px-3 py-2.5">
                      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{l.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {"erro" in l ? l.erro : recusa ? `${titulo}: ${recusa.motivo}` : `${titulo} — reconhecido`}
                        </p>
                      </div>
                      {"erro" in l || recusa ? (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-semaforo-amarelo" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-semaforo-verde" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {previa?.preenchido.length ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-semaforo-verde">Vai preencher</h3>
              <ul className="space-y-1.5">
                {previa.preenchido.map((p) => (
                  <li key={p.rotulo} className="flex gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-semaforo-verde" />
                    <span>
                      <strong>{p.rotulo}:</strong> {p.detalhe}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {previa?.avisos.length ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-semaforo-amarelo">Conferir</h3>
              <ul className="space-y-1.5">
                {previa.avisos.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-semaforo-amarelo" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {erros.length + recusados.length ? (
              <span className="mr-auto text-xs text-muted-foreground">
                {erros.length + recusados.length} arquivo(s) não entram — veja o motivo acima.
              </span>
            ) : null}
            <button type="button" onClick={onFechar} className="rounded-md border border-input px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!aplicaveis || lendo}
              onClick={() => previa && onAplicar(previa.dados)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              Aplicar ao RGM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
