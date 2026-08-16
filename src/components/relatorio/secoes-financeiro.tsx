import { Banknote, ClipboardCheck, HardHat, Sparkles } from "lucide-react";
import {
  BadgeSemaforo,
  Campo,
  CampoMoeda,
  CampoSelecao,
  CampoTexto,
  CampoTextoLongo,
  CampoListaBullets,
} from "@/components/campos";
import { ComentarioGestor, Secao, TabelaEditavel, type Coluna } from "./blocos";
import { novoId } from "@/lib/defaults";
import { formatarMoeda, formatarVariacao } from "@/lib/format";
import {
  desvioCapex,
  despesaSobreReceita,
  despesaTotal,
  indicadores360,
  receitaTotal,
  resultadoFinanceiro,
  saldoAnteriorTotal,
  saldoFundo,
  saldoTotal,
  variacao,
} from "@/lib/metrics";
import type {
  DadosRelatorio,
  LinhaCapex,
  LinhaFundo,
  LinhaGrupoContabil,
  Semaforo,
} from "@/lib/types";

export interface PropsSecao {
  dados: DadosRelatorio;
  atualizar: <K extends keyof DadosRelatorio>(chave: K, valor: DadosRelatorio[K]) => void;
  somenteLeitura?: boolean;
}

/* ========================================================================== */
/* Sumário Executivo 360°                                                     */
/* ========================================================================== */

export const SecaoSumario = ({ dados, atualizar, somenteLeitura }: PropsSecao) => {
  const indicadores = indicadores360(dados);

  return (
    <Secao
      id="sumario"
      titulo="Sumário executivo 360°"
      icone={<Sparkles className="h-5 w-5" />}
      descricao="A primeira página que o síndico lê. A tabela de semáforos abaixo é calculada automaticamente a partir das outras seções — você escreve apenas a leitura do mês."
    >
      <Campo label="Avaliação geral do mês">
        <CampoTextoLongo
          valor={dados.sumario.avaliacaoGeral}
          desabilitado={somenteLeitura}
          onChange={(v) => atualizar("sumario", { ...dados.sumario, avaliacaoGeral: v })}
          linhas={4}
          placeholder="Em um parágrafo: como o mês fechou e por quê."
          exemplo="Junho fechou com equilíbrio financeiro (receita R$ 301.450 / despesa R$ 324.773, 8% acima), puxada pela aquisição de ar-condicionado da recepção. Auditoria aprovou a prestação de contas. 98% de ocupação, 4 manutenções concluídas, sem interrupção de água ou energia."
        />
      </Campo>

      <div className="grid gap-5 lg:grid-cols-2">
        <Campo label="Principais resultados" dica="o que deu certo">
          <CampoListaBullets
            itens={dados.sumario.principaisResultados}
            desabilitado={somenteLeitura}
            onChange={(v) => atualizar("sumario", { ...dados.sumario, principaisResultados: v })}
            placeholder="Ex.: Taxa de ocupação de 98% — 5.988 acessos no mês"
          />
        </Campo>
        <Campo label="Pontos de atenção" dica="o que precisa de decisão">
          <CampoListaBullets
            itens={dados.sumario.pontosAtencao}
            desabilitado={somenteLeitura}
            onChange={(v) => atualizar("sumario", { ...dados.sumario, pontosAtencao: v })}
            placeholder="Ex.: 1 contrato vencido (lavanderia)"
          />
        </Campo>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold text-foreground">Painel de indicadores</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Gerado a partir dos dados que você lançar. Não precisa preencher — e nunca fica
          inconsistente com o detalhe das outras seções.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-soft">
                <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Indicador
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Valor
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Status
                </th>
                <th className="hidden px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground lg:table-cell">
                  Critério
                </th>
              </tr>
            </thead>
            <tbody>
              {indicadores.map((ind) => (
                <tr key={ind.id} className="border-t border-border">
                  <td className="px-3 py-2.5 font-semibold">{ind.rotulo}</td>
                  <td className="px-3 py-2.5 tabular-nums">{ind.valor}</td>
                  <td className="px-3 py-2.5">
                    <BadgeSemaforo semaforo={ind.semaforo} />
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs leading-relaxed text-muted-foreground lg:table-cell">
                    {ind.criterio}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Secao>
  );
};

/* ========================================================================== */
/* Financeiro                                                                 */
/* ========================================================================== */

const semaforoDesvio = (desvio: number | null): Semaforo =>
  desvio === null ? "amarelo" : Math.abs(desvio) <= 5 ? "verde" : Math.abs(desvio) <= 20 ? "amarelo" : "vermelho";

export const SecaoFinanceiro = ({ dados, atualizar, somenteLeitura }: PropsSecao) => {
  const fin = dados.financeiro;
  const set = (patch: Partial<DadosRelatorio["financeiro"]>) =>
    atualizar("financeiro", { ...fin, ...patch });

  const resultado = resultadoFinanceiro(dados);
  const dsr = despesaSobreReceita(dados);
  const receita = receitaTotal(dados);
  const despesa = despesaTotal(dados);
  const saldo = saldoTotal(dados);
  const totalOrcado = fin.grupos.reduce((s, g) => s + g.orcado, 0);
  const totalRealizado = fin.grupos.reduce((s, g) => s + g.realizado, 0);

  const colunasFundo: Coluna<LinhaFundo>[] = [
    {
      chave: "fundo",
      titulo: "Fundo",
      largura: "min-w-[200px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.fundo}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ fundo: v })}
          placeholder="Ex.: Fundo de reserva"
        />
      ),
    },
    {
      chave: "anterior",
      titulo: "Anterior",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.anterior} desabilitado={somenteLeitura} onChange={(v) => up({ anterior: v })} />
      ),
    },
    {
      chave: "creditos",
      titulo: "Créditos",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.creditos} desabilitado={somenteLeitura} onChange={(v) => up({ creditos: v })} />
      ),
    },
    {
      chave: "debitos",
      titulo: "Débitos",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.debitos} desabilitado={somenteLeitura} onChange={(v) => up({ debitos: v })} />
      ),
    },
    {
      chave: "saldo",
      titulo: "Saldo",
      largura: "w-40",
      alinhar: "direita",
      render: (l) => (
        <span
          className={`block px-3 py-2 text-sm font-bold tabular-nums ${
            saldoFundo(l) < 0 ? "text-semaforo-vermelho" : "text-foreground"
          }`}
        >
          {formatarMoeda(saldoFundo(l))}
        </span>
      ),
    },
  ];

  const colunas: Coluna<LinhaGrupoContabil>[] = [
    {
      chave: "grupo",
      titulo: "Grupo contábil",
      largura: "min-w-[220px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.grupo}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ grupo: v })}
          placeholder="Ex.: Limpeza e sanificação"
        />
      ),
    },
    {
      chave: "orcado",
      titulo: "Orçado",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.orcado} desabilitado={somenteLeitura} onChange={(v) => up({ orcado: v })} />
      ),
    },
    {
      chave: "realizado",
      titulo: "Realizado",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.realizado} desabilitado={somenteLeitura} onChange={(v) => up({ realizado: v })} />
      ),
    },
    {
      chave: "status",
      titulo: "Desvio",
      largura: "w-32",
      alinhar: "centro",
      render: (l) => {
        const d = variacao(l.realizado, l.orcado);
        return (
          <div className="flex flex-col items-center gap-1 pt-1.5">
            <BadgeSemaforo
              semaforo={semaforoDesvio(d)}
              rotulo={d === null ? "—" : formatarVariacao(d, 0)}
            />
          </div>
        );
      },
    },
    {
      chave: "observacao",
      titulo: "Justificativa do desvio",
      largura: "min-w-[200px]",
      render: (l, up) => {
        const d = variacao(l.realizado, l.orcado);
        const exige = d !== null && Math.abs(d) > 15 && !l.observacao.trim();
        return (
          <div className="space-y-1">
            <CampoTexto
              valor={l.observacao}
              desabilitado={somenteLeitura}
              onChange={(v) => up({ observacao: v })}
              placeholder={exige ? "Obrigatório: explique o desvio" : "Opcional"}
              className={exige ? "border-semaforo-amarelo bg-semaforo-amarelo/5" : undefined}
            />
            {exige ? (
              <p className="text-[11px] font-medium text-semaforo-amarelo">
                Desvio acima de 15% sem justificativa vira "Pendente" no relatório.
              </p>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <Secao
      id="financeiro"
      titulo="Financeiro"
      icone={<Banknote className="h-5 w-5" />}
      descricao="Resultado do mês e comparativo entre orçado e realizado por grupo contábil."
    >
      <div>
        <h3 className="mb-1 text-sm font-bold">Resumo financeiro contábil</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Lance por fundo, como vem do sistema contábil. Receita, despesa e saldo do mês são a soma
          destas linhas — não precisam ser digitados e nunca divergem do detalhe.
        </p>
        <TabelaEditavel
          linhas={fin.fundos}
          colunas={colunasFundo}
          somenteLeitura={somenteLeitura}
          onChange={(fundos) => set({ fundos })}
          novaLinha={() => ({ id: novoId(), fundo: "", anterior: 0, creditos: 0, debitos: 0 })}
          rotuloAdicionar="Adicionar fundo"
          vazio={{
            titulo: "Nenhum fundo lançado",
            descricao:
              "Cadastre Ordinária, Fundo de Reserva e demais rubricas. Nos meses seguintes o saldo de fechamento já abre o mês sozinho.",
          }}
          rodape={
            <tr className="font-bold">
              <td className="px-3 py-2.5">Total</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatarMoeda(saldoAnteriorTotal(dados))}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatarMoeda(receita)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatarMoeda(despesa)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatarMoeda(saldo)}</td>
              {!somenteLeitura ? <td /> : null}
            </tr>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { r: "Receita do mês", v: formatarMoeda(receita), s: "total de créditos" },
          { r: "Despesa do mês", v: formatarMoeda(despesa), s: dsr === null ? "—" : `${formatarVariacao(dsr)} vs. receita` },
          { r: "Saldo em conta", v: formatarMoeda(saldo), s: "fecha o mês" },
          {
            r: "Resultado do mês",
            v: formatarMoeda(resultado),
            s: resultado >= 0 ? "positivo" : "negativo",
            cor: resultado >= 0 ? "text-semaforo-verde" : "text-semaforo-vermelho",
          },
        ].map((k) => (
          <div key={k.r} className="rounded-lg border border-border bg-surface-soft p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {k.r}
            </span>
            <strong className={`mt-1 block text-xl tabular-nums ${k.cor ?? "text-foreground"}`}>
              {k.v}
            </strong>
            <span className="text-xs text-muted-foreground">{k.s}</span>
          </div>
        ))}
      </div>

      <TabelaEditavel
        linhas={fin.grupos}
        colunas={colunas}
        somenteLeitura={somenteLeitura}
        onChange={(grupos) => set({ grupos })}
        novaLinha={() => ({ id: novoId(), grupo: "", orcado: 0, realizado: 0, observacao: "" })}
        rotuloAdicionar="Adicionar grupo contábil"
        vazio={{
          titulo: "Nenhum grupo contábil lançado",
          descricao: "Adicione os grupos do orçamento para comparar previsto e realizado.",
        }}
        rodape={
          <tr className="font-bold">
            <td className="px-3 py-2.5">Total</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatarMoeda(totalOrcado)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatarMoeda(totalRealizado)}</td>
            <td className="px-3 py-2.5 text-center">
              <BadgeSemaforo
                semaforo={semaforoDesvio(variacao(totalRealizado, totalOrcado))}
                rotulo={
                  variacao(totalRealizado, totalOrcado) === null
                    ? "—"
                    : formatarVariacao(variacao(totalRealizado, totalOrcado)!, 1)
                }
              />
            </td>
            <td />
            {!somenteLeitura ? <td /> : null}
          </tr>
        }
      />

      <ComentarioGestor
        valor={fin.comentario}
        somenteLeitura={somenteLeitura}
        onChange={(v) => set({ comentario: v })}
        exemplo="A despesa superou a receita em 8% por conta da aquisição pontual de ar-condicionado e equipamento de academia (CAPEX). Sem o investimento, o mês fecharia positivo."
      />
    </Secao>
  );
};

/* ========================================================================== */
/* CAPEX e melhorias                                                          */
/* ========================================================================== */

const STATUS_CAPEX = [
  { valor: "planejado" as const, rotulo: "Planejado" },
  { valor: "em_andamento" as const, rotulo: "Em andamento" },
  { valor: "concluido" as const, rotulo: "Concluído" },
];

export const SecaoCapex = ({ dados, atualizar, somenteLeitura }: PropsSecao) => {
  const set = (patch: Partial<DadosRelatorio["capex"]>) =>
    atualizar("capex", { ...dados.capex, ...patch });

  const colunas: Coluna<LinhaCapex>[] = [
    {
      chave: "iniciativa",
      titulo: "Iniciativa",
      largura: "min-w-[240px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.iniciativa}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ iniciativa: v })}
          placeholder="Ex.: Ar-condicionado da recepção"
        />
      ),
    },
    {
      chave: "orcado",
      titulo: "Orçado",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.orcado} desabilitado={somenteLeitura} onChange={(v) => up({ orcado: v })} />
      ),
    },
    {
      chave: "realizado",
      titulo: "Realizado",
      largura: "w-40",
      alinhar: "direita",
      render: (l, up) => (
        <CampoMoeda valor={l.realizado} desabilitado={somenteLeitura} onChange={(v) => up({ realizado: v })} />
      ),
    },
    {
      chave: "desvio",
      titulo: "Desvio",
      largura: "w-28",
      alinhar: "centro",
      render: (l) => {
        const d = desvioCapex(l);
        return (
          <div className="pt-1.5">
            <BadgeSemaforo
              semaforo={semaforoDesvio(d)}
              rotulo={d === null ? "—" : formatarVariacao(d, 1)}
            />
          </div>
        );
      },
    },
    {
      chave: "status",
      titulo: "Status",
      largura: "w-40",
      render: (l, up) => (
        <CampoSelecao
          valor={l.status}
          desabilitado={somenteLeitura}
          opcoes={STATUS_CAPEX}
          onChange={(v) => up({ status: v })}
        />
      ),
    },
    {
      chave: "beneficio",
      titulo: "Benefício esperado",
      largura: "min-w-[200px]",
      render: (l, up) => (
        <CampoTexto
          valor={l.beneficio}
          desabilitado={somenteLeitura}
          onChange={(v) => up({ beneficio: v })}
          placeholder="Ex.: melhoria da experiência na recepção"
        />
      ),
    },
  ];

  return (
    <Secao
      id="capex"
      titulo="CAPEX e melhorias"
      icone={<HardHat className="h-5 w-5" />}
      descricao="Investimentos do fundo de reserva e obras de melhoria, com desvio sobre o orçado."
    >
      <TabelaEditavel
        linhas={dados.capex.linhas}
        colunas={colunas}
        somenteLeitura={somenteLeitura}
        onChange={(linhas) => set({ linhas })}
        novaLinha={() => ({
          id: novoId(),
          iniciativa: "",
          orcado: 0,
          realizado: 0,
          status: "planejado" as const,
          beneficio: "",
        })}
        rotuloAdicionar="Adicionar investimento"
        vazio={{
          titulo: "Nenhum investimento no mês",
          descricao:
            "Se não houve CAPEX nesta competência, deixe vazio — o relatório informa isso explicitamente em vez de mostrar uma tabela em branco.",
        }}
      />
      <ComentarioGestor
        valor={dados.capex.comentario}
        somenteLeitura={somenteLeitura}
        onChange={(v) => set({ comentario: v })}
        exemplo="Desvio de +24,5% sobre o orçado. A aquisição foi a principal causa de a despesa do mês superar a receita em 8%."
      />
    </Secao>
  );
};

/* ========================================================================== */
/* Conclusão                                                                  */
/* ========================================================================== */

export const SecaoConclusao = ({ dados, atualizar, somenteLeitura }: PropsSecao) => (
  <Secao
    id="conclusao"
    titulo="Conclusão"
    icone={<ClipboardCheck className="h-5 w-5" />}
    descricao="Fechamento do relatório e recomendação da gestão."
  >
    <CampoTextoLongo
      valor={dados.conclusao}
      desabilitado={somenteLeitura}
      onChange={(v) => atualizar("conclusao", v)}
      linhas={6}
      placeholder="Recomendação final da gestão para o período."
      exemplo="O empreendimento permanece sob acompanhamento gerencial contínuo. Recomenda-se priorizar a renovação do contrato de lavanderia e o acompanhamento da audiência de 22/07."
    />
  </Secao>
);
