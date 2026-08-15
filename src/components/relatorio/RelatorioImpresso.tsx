/**
 * Versão para impressão / PDF — espelha os slides do PPTX em páginas A4.
 *
 * Diferenças em relação à versão anterior:
 *  - as evidências fotográficas ENTRAM no documento (antes ficavam só na tela);
 *  - os números vêm dos dados reais, não de constantes fixas no arquivo;
 *  - seções vazias são declaradas como "não informado nesta competência" em vez
 *    de imprimir uma tabela em branco.
 */

import { useUrlsAssinadas } from "@/hooks/useFotos";
import {
  contarContratos,
  contarDocumentos,
  desvioCapex,
  despesaSobreReceita,
  indicadores360,
  inadimplenciaTotal,
  resultadoFinanceiro,
  situacaoDocumento,
  totalAcessos,
  vacancia,
  variacao,
  variacaoConsumo,
} from "@/lib/metrics";
import { formatarCompetencia, formatarData, formatarMoeda, formatarNumero, formatarVariacao } from "@/lib/format";
import type { Relatorio, Semaforo } from "@/lib/types";
import logoRps from "@/assets/logo-rps.svg";
import headerBg from "@/assets/header-sp-2.jpg";

const COR: Record<Semaforo, string> = {
  verde: "#1a7a4f",
  amarelo: "#c47f0a",
  vermelho: "#c62828",
};

const Pill = ({ semaforo, texto }: { semaforo: Semaforo; texto: string }) => (
  <span
    style={{ color: COR[semaforo], borderColor: COR[semaforo] }}
    className="inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold"
  >
    {texto}
  </span>
);

const Pagina = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <article className="print-page flex flex-col p-[14mm]">
    <header className="mb-5 flex items-center justify-between border-b-2 border-primary pb-3">
      <img src={logoRps} alt="RPS" className="h-9 w-auto" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
        Relatório Gerencial Mensal · {titulo}
      </span>
    </header>
    <div className="flex-1">{children}</div>
    <footer className="mt-4 border-t border-border pt-2 text-[9px] text-muted-foreground">
      RPS Real Property Solution · Qualidade e confiança para seu patrimônio.
    </footer>
  </article>
);

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-3 text-2xl font-bold text-primary">{children}</h2>
);

const SubTitulo = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-foreground">{children}</h3>
);

const Vazio = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded border border-dashed border-border px-3 py-4 text-center text-[11px] italic text-muted-foreground">
    {children}
  </p>
);

const Tabela = ({ cabecalho, children }: { cabecalho: string[]; children: React.ReactNode }) => (
  <table className="w-full border-collapse text-[10px]">
    <thead>
      <tr>
        {cabecalho.map((c) => (
          <th
            key={c}
            className="border border-border bg-surface-soft px-2 py-1.5 text-left font-bold uppercase tracking-wide text-muted-foreground"
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
);

const Td = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <td className={`border border-border px-2 py-1.5 align-top ${className}`}>{children}</td>
);

const Comentario = ({ texto }: { texto: string }) =>
  texto.trim() ? (
    <div className="mt-3 break-inside-avoid rounded border-l-4 border-l-primary bg-primary/5 p-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wide text-primary">Análise do gestor</h4>
      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed">{texto}</p>
    </div>
  ) : null;

export const RelatorioImpresso = ({ relatorio }: { relatorio: Relatorio }) => {
  const d = relatorio.dados;
  const emp = relatorio.empreendimento;
  const urls = useUrlsAssinadas(d.fotos);

  const indicadores = indicadores360(d);
  const contratos = contarContratos(d);
  const documentos = contarDocumentos(d);
  const dsr = despesaSobreReceita(d);

  return (
    <div className="print-report">
      {/* ---------------------------------------------------------------- capa */}
      <article
        className="print-page relative flex flex-col justify-between p-[16mm] text-white"
        style={{
          backgroundImage: `linear-gradient(135deg, hsl(var(--executive) / 0.95), hsl(var(--primary) / 0.88) 55%, hsl(var(--secondary) / 0.8)), url(${headerBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <img src={logoRps} alt="RPS" className="h-14 w-auto brightness-0 invert" />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] opacity-80">
            Relatório Gerencial Mensal
          </p>
          <h1 className="mt-3 text-5xl font-bold leading-tight">{emp?.nome ?? "Empreendimento"}</h1>
          <p className="mt-4 text-xl">Competência: {formatarCompetencia(relatorio.competencia)}</p>
          <div className="mt-6 space-y-1 text-sm opacity-90">
            {emp?.cidade ? <p>· {emp.cidade}</p> : null}
            {emp?.proprietario_nome ? <p>· Cliente: {emp.proprietario_nome}</p> : null}
            {emp?.gestor_nome ? <p>· Gestor responsável: {emp.gestor_nome}</p> : null}
          </div>
        </div>
        <p className="text-lg font-semibold">Qualidade e confiança para seu patrimônio.</p>
      </article>

      {/* ------------------------------------------------------- sumário 360° */}
      <Pagina titulo="Sumário executivo 360°">
        <Titulo>Sumário executivo 360°</Titulo>

        {d.sumario.avaliacaoGeral.trim() ? (
          <div className="rounded border border-primary/25 bg-primary/5 p-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-primary">
              Avaliação geral do mês
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed">{d.sumario.avaliacaoGeral}</p>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <SubTitulo>Principais resultados</SubTitulo>
            {d.sumario.principaisResultados.length ? (
              <ul className="space-y-1">
                {d.sumario.principaisResultados.map((r, i) => (
                  <li key={i} className="flex gap-1.5 text-[10px] leading-relaxed">
                    <span style={{ color: COR.verde }}>•</span>
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Não informado nesta competência.</Vazio>
            )}
          </div>
          <div>
            <SubTitulo>Pontos de atenção</SubTitulo>
            {d.sumario.pontosAtencao.length ? (
              <ul className="space-y-1">
                {d.sumario.pontosAtencao.map((r, i) => (
                  <li key={i} className="flex gap-1.5 text-[10px] leading-relaxed">
                    <span style={{ color: COR.amarelo }}>•</span>
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhum ponto de atenção registrado.</Vazio>
            )}
          </div>
        </div>

        <SubTitulo>Painel de indicadores</SubTitulo>
        <Tabela cabecalho={["Indicador", "Valor", "Status"]}>
          {indicadores.map((i) => (
            <tr key={i.id}>
              <Td className="font-semibold">{i.rotulo}</Td>
              <Td>{i.valor}</Td>
              <Td>
                <Pill
                  semaforo={i.semaforo}
                  texto={i.semaforo === "verde" ? "Verde" : i.semaforo === "amarelo" ? "Amarelo" : "Vermelho"}
                />
              </Td>
            </tr>
          ))}
        </Tabela>
      </Pagina>

      {/* ---------------------------------------------------------- financeiro */}
      <Pagina titulo="Financeiro">
        <Titulo>Financeiro</Titulo>

        <div className="grid grid-cols-4 gap-2">
          {[
            { r: "Receita do mês", v: formatarMoeda(d.financeiro.receita) },
            { r: "Despesa do mês", v: formatarMoeda(d.financeiro.despesa) },
            { r: "Saldo em conta", v: formatarMoeda(d.financeiro.saldoConta) },
            { r: "Inadimplência total", v: formatarMoeda(inadimplenciaTotal(d)) },
          ].map((k) => (
            <div key={k.r} className="rounded border border-border bg-surface-soft p-2.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                {k.r}
              </span>
              <strong className="mt-0.5 block text-sm tabular-nums text-foreground">{k.v}</strong>
            </div>
          ))}
        </div>

        <p className="mt-2 text-[10px] text-muted-foreground">
          Resultado do mês: <strong>{formatarMoeda(resultadoFinanceiro(d))}</strong>
          {dsr !== null ? ` · despesa ${formatarVariacao(dsr)} em relação à receita` : ""}
        </p>

        <SubTitulo>Orçado x realizado por grupo contábil</SubTitulo>
        {d.financeiro.grupos.length ? (
          <Tabela cabecalho={["Grupo contábil", "Orçado", "Realizado", "Desvio", "Justificativa"]}>
            {d.financeiro.grupos.map((g) => {
              const dv = variacao(g.realizado, g.orcado);
              const sem: Semaforo =
                dv === null ? "amarelo" : Math.abs(dv) <= 5 ? "verde" : Math.abs(dv) <= 20 ? "amarelo" : "vermelho";
              return (
                <tr key={g.id}>
                  <Td className="font-semibold">{g.grupo || "—"}</Td>
                  <Td className="text-right tabular-nums">{formatarMoeda(g.orcado)}</Td>
                  <Td className="text-right tabular-nums">{formatarMoeda(g.realizado)}</Td>
                  <Td>
                    <Pill semaforo={sem} texto={dv === null ? "—" : formatarVariacao(dv, 0)} />
                  </Td>
                  <Td>{g.observacao || <em className="text-muted-foreground">Pendente de classificação</em>}</Td>
                </tr>
              );
            })}
          </Tabela>
        ) : (
          <Vazio>Nenhum grupo contábil lançado nesta competência.</Vazio>
        )}

        <Comentario texto={d.financeiro.comentario} />
      </Pagina>

      {/* ------------------------------------------------------------ operação */}
      <Pagina titulo="Operação e manutenção">
        <Titulo>Operação e manutenção</Titulo>

        <div className="grid grid-cols-3 gap-2">
          {[
            { r: "Taxa de ocupação", v: `${formatarNumero(d.operacao.ocupacao, 0)}%`, s: `vacância ${formatarNumero(vacancia(d), 0)}%` },
            { r: "Fluxo de pessoas", v: formatarNumero(totalAcessos(d)), s: `${formatarNumero(d.operacao.acessosFixos)} fixos + ${formatarNumero(d.operacao.acessosVisitantes)} visitantes` },
            {
              r: "Manutenções",
              v: `${d.operacao.ocorrencias.filter((o) => o.concluida).length}/${d.operacao.ocorrencias.length}`,
              s: "concluídas no mês",
            },
          ].map((k) => (
            <div key={k.r} className="rounded border border-border bg-surface-soft p-2.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{k.r}</span>
              <strong className="mt-0.5 block text-sm tabular-nums">{k.v}</strong>
              <span className="text-[9px] text-muted-foreground">{k.s}</span>
            </div>
          ))}
        </div>

        <SubTitulo>Ocorrências do período</SubTitulo>
        {d.operacao.ocorrencias.length ? (
          <Tabela cabecalho={["Ocorrência", "Tipo", "Ação executada", "Resultado", ""]}>
            {d.operacao.ocorrencias.map((o) => (
              <tr key={o.id}>
                <Td className="font-semibold">{o.ocorrencia || "—"}</Td>
                <Td className="capitalize">{o.tipo}</Td>
                <Td>{o.acao || "—"}</Td>
                <Td>{o.resultado || "—"}</Td>
                <Td>
                  <Pill semaforo={o.concluida ? "verde" : "amarelo"} texto={o.concluida ? "Concluída" : "Em curso"} />
                </Td>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Vazio>Nenhuma manutenção registrada nesta competência.</Vazio>
        )}

        <Comentario texto={d.operacao.comentario} />
      </Pagina>

      {/* ------------------------------------------- fornecedores e contratos */}
      <Pagina titulo="Fornecedores e contratos">
        <Titulo>Fornecedores e SLA</Titulo>
        {d.fornecedores.linhas.length ? (
          <Tabela cabecalho={["Fornecedor", "Disciplina", "Volume", "SLA", "Criticidade"]}>
            {d.fornecedores.linhas.map((f) => (
              <tr key={f.id}>
                <Td className="font-semibold">{f.fornecedor || "—"}</Td>
                <Td>{f.disciplina || "—"}</Td>
                <Td className="text-right tabular-nums">
                  {formatarNumero(f.realizado)} {f.unidade}
                </Td>
                <Td>
                  <Pill
                    semaforo={f.sla === 0 ? "amarelo" : f.sla >= 95 ? "verde" : f.sla >= 85 ? "amarelo" : "vermelho"}
                    texto={f.sla === 0 ? "não informado" : `${f.sla}%`}
                  />
                </Td>
                <Td className="capitalize">{f.criticidade}</Td>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Vazio>Indicadores de SLA não informados nesta competência.</Vazio>
        )}
        <Comentario texto={d.fornecedores.comentario} />

        <Titulo>
          <span className="mt-6 block">Contratos</span>
        </Titulo>
        <div className="mb-2 grid grid-cols-3 gap-2">
          {[
            { r: "Vigentes", v: contratos.vigentes, c: COR.verde },
            { r: "Vencidos", v: contratos.vencidos, c: COR.vermelho },
            { r: "Em renovação", v: contratos.emRenovacao, c: COR.amarelo },
          ].map((k) => (
            <div key={k.r} className="rounded border border-border bg-surface-soft p-2 text-center">
              <strong className="block text-lg tabular-nums" style={{ color: k.c }}>
                {k.v}
              </strong>
              <span className="text-[9px] font-bold uppercase text-muted-foreground">{k.r}</span>
            </div>
          ))}
        </div>
        {d.contratos.linhas.length ? (
          <Tabela cabecalho={["Fornecedor", "Objeto", "Situação", "Vencimento", "Observação"]}>
            {d.contratos.linhas.map((c) => (
              <tr key={c.id}>
                <Td className="font-semibold">{c.fornecedor || "—"}</Td>
                <Td>{c.objeto || "—"}</Td>
                <Td>
                  <Pill
                    semaforo={c.situacao === "vigente" ? "verde" : c.situacao === "vencido" ? "vermelho" : "amarelo"}
                    texto={c.situacao === "em_renovacao" ? "Em renovação" : c.situacao === "vigente" ? "Vigente" : "Vencido"}
                  />
                </Td>
                <Td>{c.vencimento ? formatarData(c.vencimento) : "—"}</Td>
                <Td>{c.observacao || "—"}</Td>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Vazio>Nenhum contrato cadastrado.</Vazio>
        )}
        <Comentario texto={d.contratos.comentario} />
      </Pagina>

      {/* ------------------------------------------ documentos e compliance */}
      <Pagina titulo="Documentos e compliance">
        <Titulo>Documentos e compliance</Titulo>
        <p className="mb-2 text-[10px] text-muted-foreground">
          {documentos.vigentes} vigentes · {documentos.aVencer} a vencer em até 60 dias ·{" "}
          {documentos.vencidos} vencidos
        </p>
        {d.documentos.linhas.length ? (
          <Tabela cabecalho={["Documento", "Órgão emissor", "Validade", "Status", "Observação"]}>
            {d.documentos.linhas.map((doc) => {
              const s = situacaoDocumento(doc);
              return (
                <tr key={doc.id}>
                  <Td className="font-semibold">{doc.documento || "—"}</Td>
                  <Td>{doc.orgao || "—"}</Td>
                  <Td>{doc.validade ? formatarData(doc.validade) : "—"}</Td>
                  <Td>
                    <Pill semaforo={s.semaforo} texto={s.rotulo} />
                  </Td>
                  <Td>{doc.observacao || "—"}</Td>
                </tr>
              );
            })}
          </Tabela>
        ) : (
          <Vazio>Nenhum documento cadastrado.</Vazio>
        )}
        <Comentario texto={d.documentos.comentario} />

        <Titulo>
          <span className="mt-6 block">Jurídico e inadimplência</span>
        </Titulo>
        <Tabela cabecalho={["Posição de inadimplência", "Valor"]}>
          <tr>
            <Td>Posição do mês anterior</Td>
            <Td className="text-right tabular-nums">{formatarMoeda(d.juridico.inadimplencia.posicaoAnterior)}</Td>
          </tr>
          <tr>
            <Td>Recebido no mês</Td>
            <Td className="text-right tabular-nums">{formatarMoeda(d.juridico.inadimplencia.recebidoNoMes)}</Td>
          </tr>
          <tr>
            <Td>Novo atraso no mês</Td>
            <Td className="text-right tabular-nums">{formatarMoeda(d.juridico.inadimplencia.emAtrasoNoMes)}</Td>
          </tr>
          <tr className="font-bold">
            <Td>Total consolidado</Td>
            <Td className="text-right tabular-nums">{formatarMoeda(inadimplenciaTotal(d))}</Td>
          </tr>
        </Tabela>

        <SubTitulo>Processos em andamento</SubTitulo>
        {d.juridico.processos.length ? (
          <Tabela cabecalho={["Processo", "Vara / foro", "Objeto", "Andamento", "Próxima data"]}>
            {d.juridico.processos.map((p) => (
              <tr key={p.id}>
                <Td className="font-semibold">{p.numero || "—"}</Td>
                <Td>{p.vara || "—"}</Td>
                <Td>{p.objeto || "—"}</Td>
                <Td>{p.andamento || "—"}</Td>
                <Td>{p.proximaData ? formatarData(p.proximaData) : "—"}</Td>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Vazio>Nenhum processo em andamento nesta competência.</Vazio>
        )}
        <Comentario texto={d.juridico.comentario} />
      </Pagina>

      {/* --------------------------------------------- utilidades e CAPEX */}
      <Pagina titulo="Utilidades e investimentos">
        <Titulo>Utilidades e sustentabilidade</Titulo>
        {d.utilidades.linhas.length ? (
          <Tabela cabecalho={["Utilidade", "Consumo", "Mês anterior", "Variação", "Fatura", "Detalhamento"]}>
            {d.utilidades.linhas.map((u) => {
              const v = variacaoConsumo(u);
              return (
                <tr key={u.id}>
                  <Td className="font-semibold">{u.utilidade || "—"}</Td>
                  <Td className="text-right tabular-nums">
                    {formatarNumero(u.consumo)} {u.unidade}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {formatarNumero(u.consumoAnterior)} {u.unidade}
                  </Td>
                  <Td>
                    <Pill
                      semaforo={v === null ? "amarelo" : v > 25 ? "vermelho" : v > 10 ? "amarelo" : "verde"}
                      texto={v === null ? "—" : formatarVariacao(v)}
                    />
                  </Td>
                  <Td className="text-right tabular-nums">{formatarMoeda(u.fatura)}</Td>
                  <Td>{u.detalhamento || "—"}</Td>
                </tr>
              );
            })}
          </Tabela>
        ) : (
          <Vazio>Nenhuma utilidade cadastrada.</Vazio>
        )}
        <Comentario texto={d.utilidades.comentario} />

        <Titulo>
          <span className="mt-6 block">CAPEX e melhorias</span>
        </Titulo>
        {d.capex.linhas.length ? (
          <Tabela cabecalho={["Iniciativa", "Orçado", "Realizado", "Desvio", "Status", "Benefício"]}>
            {d.capex.linhas.map((c) => {
              const dv = desvioCapex(c);
              return (
                <tr key={c.id}>
                  <Td className="font-semibold">{c.iniciativa || "—"}</Td>
                  <Td className="text-right tabular-nums">{formatarMoeda(c.orcado)}</Td>
                  <Td className="text-right tabular-nums">{formatarMoeda(c.realizado)}</Td>
                  <Td>
                    <Pill
                      semaforo={dv === null ? "amarelo" : dv <= 5 ? "verde" : dv <= 20 ? "amarelo" : "vermelho"}
                      texto={dv === null ? "—" : formatarVariacao(dv, 1)}
                    />
                  </Td>
                  <Td className="capitalize">{c.status.replace("_", " ")}</Td>
                  <Td>{c.beneficio || "—"}</Td>
                </tr>
              );
            })}
          </Tabela>
        ) : (
          <Vazio>Nenhum investimento realizado nesta competência.</Vazio>
        )}
        <Comentario texto={d.capex.comentario} />
      </Pagina>

      {/* ------------------------------------- riscos e próximos passos */}
      <Pagina titulo="Riscos e próximos passos">
        <Titulo>Matriz de riscos e plano de ação</Titulo>
        {d.riscos.linhas.length ? (
          <Tabela cabecalho={["Risco / assunto", "Criticidade", "Ação", "Responsável", "Prazo"]}>
            {d.riscos.linhas.map((r) => (
              <tr key={r.id}>
                <Td className="font-semibold">{r.assunto || "—"}</Td>
                <Td>
                  <Pill
                    semaforo={r.criticidade === "alta" ? "vermelho" : r.criticidade === "media" ? "amarelo" : "verde"}
                    texto={r.criticidade === "media" ? "Média" : r.criticidade === "alta" ? "Alta" : "Baixa"}
                  />
                </Td>
                <Td>{r.acao || "—"}</Td>
                <Td>{r.responsavel || "—"}</Td>
                <Td>{r.prazo ? formatarData(r.prazo) : "—"}</Td>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Vazio>Matriz de riscos sem itens abertos nesta competência.</Vazio>
        )}

        <SubTitulo>Próximos passos e decisões</SubTitulo>
        {d.proximosPassos.linhas.length ? (
          <Tabela cabecalho={["Decisão / pendência", "Prazo limite", "Status", "Decisão do síndico"]}>
            {d.proximosPassos.linhas.map((p) => (
              <tr key={p.id}>
                <Td className="font-semibold">{p.decisao || "—"}</Td>
                <Td>{p.prazo || "não informado"}</Td>
                <Td>{p.status || "—"}</Td>
                <Td>{p.dependeDoCliente ? "Sim" : "—"}</Td>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Vazio>Nenhuma pendência aberta para o próximo período.</Vazio>
        )}
      </Pagina>

      {/* ------------------------------------------------------- evidências */}
      {d.fotos.length > 0 ? (
        <Pagina titulo="Evidências fotográficas">
          <Titulo>Evidências fotográficas</Titulo>
          <div className="grid grid-cols-2 gap-3">
            {d.fotos.map((f, i) => (
              <figure key={f.id} className="break-inside-avoid overflow-hidden rounded border border-border">
                {urls[f.path] ? (
                  <img src={urls[f.path]} alt={f.legenda || `Evidência ${i + 1}`} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-surface-soft text-[10px] text-muted-foreground">
                    imagem indisponível
                  </div>
                )}
                <figcaption className="p-2">
                  <strong className="text-[10px] text-primary">
                    {String(i + 1).padStart(2, "0")} · {f.categoria}
                  </strong>
                  <p className="mt-0.5 text-[10px] leading-relaxed">{f.legenda || "Sem descrição."}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </Pagina>
      ) : null}

      {/* -------------------------------------------------------- conclusão */}
      <Pagina titulo="Conclusão">
        <Titulo>Conclusão</Titulo>
        {d.conclusao.trim() ? (
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed">{d.conclusao}</p>
        ) : (
          <Vazio>Conclusão não redigida.</Vazio>
        )}

        <div className="mt-16 grid grid-cols-2 gap-10">
          <div className="border-t border-foreground pt-2 text-center text-[10px] font-semibold">
            {emp?.gestor_nome || "Gestor Property Management"}
            <span className="mt-0.5 block font-normal text-muted-foreground">RPS Real Property Solution</span>
          </div>
          <div className="border-t border-foreground pt-2 text-center text-[10px] font-semibold">
            {emp?.sindico_nome || "Síndico"}
            <span className="mt-0.5 block font-normal text-muted-foreground">
              {emp?.nome ?? "Empreendimento"}
            </span>
          </div>
        </div>

        <p className="mt-10 text-center text-[9px] text-muted-foreground">
          Documento gerado em {formatarData(new Date().toISOString())} · RPS Real Property Solution
        </p>
      </Pagina>
    </div>
  );
};
