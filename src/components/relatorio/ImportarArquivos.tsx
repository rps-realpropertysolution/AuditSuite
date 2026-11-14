/**
 * "Importar arquivos do sistema": o gestor arrasta os relatórios exportados do
 * LiveFacilities (PDF/Excel) e as contas de água e luz; o RGM se preenche.
 *
 * Tudo é lido no navegador. Antes de aplicar, mostra o que cada arquivo vai
 * preencher e o que foi recusado (outro prédio, outro mês, formato errado).
 */

import { useState } from "react";
import { CheckCircle2, CircleAlert, ExternalLink, FileSpreadsheet, FileText, FileUp, Loader2, Trash2, X, XCircle } from "lucide-react";
import { interpretarArquivo } from "@/lib/relatoriosSistema/interpretar";
import { aplicarArquivos, TITULO_RELATORIO, type ContextoAplicacao, type ResultadoArquivos } from "@/lib/relatoriosSistema/aplicar";
import type { ResultadoLeitura } from "@/lib/relatoriosSistema/tipos";
import { formatarCompetencia } from "@/lib/format";
import type { DadosRelatorio } from "@/lib/types";

interface Props {
  dados: DadosRelatorio;
  contexto: ContextoAplicacao;
  /** Nome do prédio — o gestor precisa selecioná-lo no topo do Live antes de abrir a tela. */
  nomeEmpreendimento?: string;
  onAplicar: (dados: DadosRelatorio) => void;
  onFechar: () => void;
}

/**
 * Telas do LiveFacilities de onde sai cada arquivo. O Live não aceita prédio
 * nem período na URL (formulário WebForms): o link abre a tela e o RGM mostra
 * exatamente o que preencher. Rotas de API para isso não existem (confirmado
 * na Gestão de Acessos API) — por isso o arquivo ainda passa pelo gestor.
 */
const LIVE = "https://rps.livefacilities.com.br/Operacional/";
const periodoDoMes = (comp: string) => {
  const [a, m] = comp.split("-").map(Number);
  const fim = new Date(a, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return { inicio: `01/${mm}/${a}`, fim: `${fim}/${mm}/${a}`, mes: `${mm}/${a}` };
};

const telasDoLive = (ctx: ContextoAplicacao) => {
  const fin = periodoDoMes(ctx.competenciaFinanceira);
  const op = periodoDoMes(ctx.competencia);
  // a conta do consumo de outubro vence em novembro
  const [ao, mo] = ctx.competencia.split("-").map(Number);
  const vencimento = periodoDoMes(`${mo === 12 ? ao + 1 : ao}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}-01`);
  return [
    { item: "Previsto x Realizado", formato: "Excel (.xls) — de preferência", url: `${LIVE}empreendimento/Emp_Previsaorealizadorelatorio.aspx`, preencher: `período ${fin.mes} a ${fin.mes}; exporte em Excel (o PDF impresso da tela vira imagem e não é lido)` },
    { item: "Posição Financeira", formato: "PDF", url: `${LIVE}Empreendimento/Emp_PosicaoFinanceira.aspx`, preencher: `de ${fin.inicio} a ${fin.fim}` },
    { item: "Lista de Boletos Pagos", formato: "Excel", url: `${LIVE}Empreendimento/Emp_BoletosPagos.aspx`, preencher: `de ${fin.inicio} a ${fin.fim}, incluir avulsos, marcar Excel (conferência)` },
    { item: "Contas de água e energia", formato: "PDF", url: `${LIVE}PagamentoLista.aspx`, preencher: `filtre o prédio e o vencimento em ${vencimento.mes} (conta de ${op.mes}); abra o pagamento › aba Documento` },
    { item: "Lista de Pedidos de Compra", formato: "Excel", url: `${LIVE}PedidoGestao.aspx`, preencher: `filtre o prédio e a solicitação de ${op.inicio} a ${op.fim}; exportar Excel` },
    { item: "Prestação de Contas – Operacional", formato: "PDF, com fotos", url: `${LIVE}Empreendimento/Emp_PrestacaoContasOperacional.aspx`, preencher: `de ${op.inicio} a ${op.fim}, marcar fotos — vai na seção Evidências` },
  ];
};

export const ImportarArquivos = ({ dados, contexto, nomeEmpreendimento, onAplicar, onFechar }: Props) => {
  const [lendo, setLendo] = useState(false);
  const [leituras, setLeituras] = useState<ResultadoLeitura[]>([]);
  const [previa, setPrevia] = useState<ResultadoArquivos | null>(null);
  // PDF da Prestação de Contas Operacional: as fotos vão para o seletor da seção Evidências
  const [prestacoes, setPrestacoes] = useState<Record<string, File>>({});

  const ler = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setLendo(true);
    const { lerArquivo } = await import("@/lib/relatoriosSistema/ler");
    const novas: ResultadoLeitura[] = [];
    for (const arquivo of Array.from(lista)) {
      try {
        const lido = interpretarArquivo(await lerArquivo(arquivo));
        if ("relatorio" in lido && lido.relatorio.tipo === "informativo" && /presta/i.test(lido.relatorio.titulo)) {
          setPrestacoes((atual) => ({ ...atual, [arquivo.name]: arquivo }));
        }
        novas.push(lido);
      } catch (e) {
        novas.push({ ok: false, nome: arquivo.name, erro: e instanceof Error ? e.message : "não foi possível ler o arquivo" });
      }
    }
    // o mesmo arquivo de novo substitui o anterior
    atualizarLista([...leituras.filter((l) => !novas.some((n) => n.nome === l.nome)), ...novas]);
    setLendo(false);
  };

  const atualizarLista = (todas: ResultadoLeitura[]) => {
    setLeituras(todas);
    const validas = todas.flatMap((l) => ("relatorio" in l ? [{ nome: l.nome, relatorio: l.relatorio }] : []));
    setPrevia(validas.length ? aplicarArquivos(dados, validas, contexto) : null);
  };
  const remover = (nome: string) => atualizarLista(leituras.filter((l) => l.nome !== nome));

  const erros = leituras.filter((l): l is Extract<ResultadoLeitura, { ok: false }> => "erro" in l);
  // o PDF da prestação operacional não é recusa: ele vai para o seletor de fotos
  const recusados = (previa?.recusados ?? []).filter((r) => !prestacoes[r.nome]);
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
            <span className="mt-1 text-xs text-muted-foreground">PDF ou Excel (.xlsx ou o .xls do Live) · pode mandar vários de uma vez · prefira Excel quando o sistema oferecer</span>
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              multiple
              className="sr-only"
              disabled={lendo}
              onChange={(e) => {
                void ler(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          <section className="rounded-lg bg-surface-soft p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-primary">Pegar no LiveFacilities</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Antes de abrir, selecione no topo do Live o prédio{" "}
              <strong className="text-foreground">
                {contexto.cdCondominio ? `${contexto.cdCondominio}${nomeEmpreendimento ? ` – ${nomeEmpreendimento}` : ""}` : nomeEmpreendimento ?? "deste RGM"}
              </strong>
              . O Live não deixa abrir a tela já no prédio e no mês — preencha o período indicado e clique em Abrir.
            </p>
            <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-card text-sm">
              {telasDoLive(contexto).map((t) => (
                <li key={t.item} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <strong>{t.item}</strong> <span className="text-xs text-muted-foreground">({t.formato})</span>
                    <span className="block text-xs text-muted-foreground">{t.preencher}</span>
                  </span>
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                    Abrir no Live <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {leituras.length ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Arquivos</h3>
                <button type="button" onClick={() => atualizarLista([])} className="text-xs font-semibold text-muted-foreground hover:text-destructive">
                  Limpar todos
                </button>
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {leituras.map((l) => {
                  const recusa = recusados.find((r) => r.nome === l.nome);
                  const titulo = "relatorio" in l ? (l.relatorio.tipo === "informativo" ? l.relatorio.titulo : TITULO_RELATORIO[l.relatorio.tipo]) : null;
                  const Icone = /\.xlsx?$/i.test(l.nome) ? FileSpreadsheet : FileText;
                  return (
                    <li key={l.nome} className="flex items-start gap-3 px-3 py-2.5">
                      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{l.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {prestacoes[l.nome] ? "Prestação de contas operacional: daqui saem as fotos do mês." : "erro" in l ? l.erro : recusa ? `${titulo}: ${recusa.motivo}` : `${titulo} — reconhecido`}
                        </p>
                        {prestacoes[l.nome] ? (
                          <button
                            type="button"
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent("rgm:fotos-prestacao", { detail: prestacoes[l.nome] }));
                              onFechar();
                            }}
                            className="mt-1 text-sm font-bold text-primary hover:underline"
                          >
                            Escolher as fotos deste PDF →
                          </button>
                        ) : null}
                      </div>
                      {("erro" in l || recusa) && !prestacoes[l.nome] ? (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-semaforo-amarelo" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-semaforo-verde" />
                      )}
                      <button
                        type="button"
                        onClick={() => remover(l.nome)}
                        title="Tirar este arquivo"
                        aria-label={`Tirar ${l.nome}`}
                        className="-mr-1 rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
