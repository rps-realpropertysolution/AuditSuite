/**
 * Visão anual do empreendimento — o ano inteiro, mês a mês, no mesmo padrão
 * visual do RGM. Monta a partir dos relatórios já existentes (não consulta o
 * LiveFacilities de novo): o que está no RGM de cada mês é o que aparece aqui.
 *
 * Slides: capa · o ano em números · financeiro mês a mês · resultado ·
 * despesas do ano · inadimplência · operação · governança · evolução (tabela) ·
 * encerramento. Meses sem relatório ficam em branco no gráfico, nunca zerados.
 */

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarRange, ClipboardList, FileText, PieChart as IconePizza, Receipt, Table2, TrendingUp } from "lucide-react";
import {
  calcularIndiceExecutivo,
  competenciaFinanceira,
  contarContratos,
  contarDocumentos,
  despesaTotal,
  inadimplenciaRecebida,
  inadimplenciaTotal,
  percentualOSNoPrazo,
  receitaTotal,
  resultadoFinanceiro,
  saldoTotal,
  semaforoDaNota,
  taxaInadimplenciaMes,
  totalOS,
} from "@/lib/metrics";
import { formatarCompetenciaCurta, formatarMoedaMil, formatarNumero } from "@/lib/format";
import type { Empreendimento, Relatorio } from "@/lib/types";
import {
  CaixaLeitura,
  CartaoKpi,
  COR,
  ContextoPagina,
  RotuloBloco,
  SlideCapa,
  SlideEncerramento,
  SlidePadrao,
  TabelaSlide,
  Vazio,
} from "./moldura";
import type { Topico } from "@/lib/leitura";

const EIXO = { fontSize: 11, fill: COR.apoio, fontFamily: "Poppins" };
const ROTULO = { fontSize: 10, fill: COR.navy, fontWeight: 600, fontFamily: "Poppins" };
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const mil = (v: number) => formatarNumero(v / 1000, 1);
const mesCurto = (iso: string) => {
  const c = formatarCompetenciaCurta(iso);
  return c.charAt(0).toUpperCase() + c.slice(1);
};

export interface SlideAnual {
  id: string;
  titulo: string;
  node: ReactNode;
}

export const montarSlidesAnuais = ({
  empreendimento: emp,
  relatorios,
  ano,
  hoje = new Date(),
}: {
  empreendimento: Empreendimento;
  relatorios: Relatorio[];
  ano: number;
  hoje?: Date;
}): SlideAnual[] => {
  const doAno = relatorios
    .filter((r) => r.competencia.startsWith(String(ano)))
    .sort((a, b) => a.competencia.localeCompare(b.competencia));

  // Uma posição por mês do ano; meses sem relatório ficam null (lacuna no gráfico).
  const porMes = MESES.map((rotulo, i) => {
    const comp = `${ano}-${String(i + 1).padStart(2, "0")}-01`;
    return { rotulo, comp, r: doAno.find((x) => x.competencia === comp) ?? null };
  });
  const ultimoMes = porMes.reduce((u, m, i) => (m.r ? i : u), -1);
  const meses = porMes.slice(0, Math.max(ultimoMes + 1, 1));
  const comFinanceiro = doAno.filter((r) => receitaTotal(r.dados) + despesaTotal(r.dados) > 0);

  const slides: SlideAnual[] = [];
  const add = (id: string, titulo: string, node: ReactNode) => slides.push({ id, titulo, node });
  const fontes = `relatórios gerenciais mensais de ${ano} (${doAno.length} ${doAno.length === 1 ? "mês" : "meses"}); o financeiro de cada mês é a última prestação de contas fechada.`;

  /* ----------------------------------------------------------- capa */
  const periodo = doAno.length ? `${mesCurto(doAno[0].competencia)} a ${mesCurto(doAno[doAno.length - 1].competencia)}` : "sem relatórios";
  add("capa", "Capa", <SlideCapa empreendimento={emp.nome} competencia={`${ano} · ${periodo}`} rotulo="Relatório gerencial · visão anual" rotuloCompetencia="Período" cidade={emp.cidade} />);

  if (!doAno.length) {
    add(
      "vazio",
      "Sem relatórios",
      <SlidePadrao secao={`O ano de ${ano}`} sobretitulo="Visão anual" icone={CalendarRange}>
        <Vazio>Nenhum relatório de {ano} para este empreendimento.</Vazio>
      </SlidePadrao>,
    );
    return numerar(slides, emp, ano);
  }

  /* ------------------------------------------------- o ano em números */
  const creditos = comFinanceiro.reduce((s, r) => s + receitaTotal(r.dados), 0);
  const debitos = comFinanceiro.reduce((s, r) => s + despesaTotal(r.dados), 0);
  const primeiro = comFinanceiro[0];
  const ultimo = comFinanceiro[comFinanceiro.length - 1];
  const saldoInicial = primeiro ? primeiro.dados.financeiro.fundos.reduce((s, f) => s + f.anterior, 0) : 0;
  const saldoFinal = ultimo ? saldoTotal(ultimo.dados) : 0;
  const comInad = doAno.filter((r) => r.dados.juridico.inadimplencia.rubricas.some((x) => x.ateAnterior || x.doMes));
  const inadInicio = comInad[0] ? comInad[0].dados.juridico.inadimplencia.rubricas.reduce((s, x) => s + x.ateAnterior, 0) : null;
  const inadFim = comInad.length ? inadimplenciaTotal(comInad[comInad.length - 1].dados) : null;
  const recuperado = doAno.reduce((s, r) => s + inadimplenciaRecebida(r.dados), 0);
  const osAno = doAno.reduce((s, r) => s + totalOS(r.dados), 0);
  const noPrazoAno = (() => {
    const np = doAno.reduce((s, r) => s + r.dados.operacao.situacaoOS.concluidasNoPrazo, 0);
    const ca = doAno.reduce((s, r) => s + r.dados.operacao.situacaoOS.concluidasComAtraso, 0);
    return np + ca ? (np / (np + ca)) * 100 : null;
  })();
  const indices = doAno.map((r) => calcularIndiceExecutivo(r.dados, hoje)).filter((x): x is number => x !== null);
  const indiceMedio = indices.length ? Math.round(indices.reduce((s, x) => s + x, 0) / indices.length) : null;
  const publicados = doAno.filter((r) => r.status === "publicado").length;

  const leituraAno: Topico[] = [];
  if (comFinanceiro.length) {
    leituraAno.push({
      destaque: `Resultado acumulado de ${formatarMoedaMil(creditos - debitos)}:`,
      texto: `${formatarMoedaMil(creditos)} de créditos contra ${formatarMoedaMil(debitos)} de débitos em ${comFinanceiro.length} prestações de contas.`,
    });
    leituraAno.push({
      destaque: `Saldo consolidado ${saldoFinal >= saldoInicial ? "cresceu" : "recuou"}:`,
      texto: `de ${formatarMoedaMil(saldoInicial)} para ${formatarMoedaMil(saldoFinal)} (${mesCurto(competenciaFinanceira(ultimo!))}).`,
    });
  }
  if (inadInicio !== null && inadFim !== null) {
    leituraAno.push({
      destaque: `Inadimplência ${inadFim <= inadInicio ? "caiu" : "subiu"}:`,
      texto: `de ${formatarMoedaMil(inadInicio)} para ${formatarMoedaMil(inadFim)}, com ${formatarMoedaMil(recuperado)} recuperados no ano.`,
    });
  }
  if (noPrazoAno !== null) {
    leituraAno.push({ destaque: `${formatarNumero(noPrazoAno, 1)}% das OS no prazo`, texto: `em ${formatarNumero(osAno)} ordens de serviço no ano.` });
  }

  add(
    "numeros",
    "O ano em números",
    <SlidePadrao secao={`O ano de ${ano} em números`} sobretitulo="Visão anual" icone={CalendarRange} fontes={fontes}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
        <CartaoKpi rotulo="Créditos no ano" valor={formatarMoedaMil(creditos)} apoio={`${comFinanceiro.length} prestações de contas`} corValor={COR.azul} />
        <CartaoKpi rotulo="Débitos no ano" valor={formatarMoedaMil(debitos)} apoio={comFinanceiro.length ? `média de ${formatarMoedaMil(debitos / comFinanceiro.length)}/mês` : undefined} corValor={COR.navy} />
        <CartaoKpi rotulo="Resultado acumulado" valor={formatarMoedaMil(creditos - debitos)} apoio="créditos menos débitos" corValor={creditos - debitos < 0 ? COR.vermelho : COR.verde} />
        <CartaoKpi rotulo="Saldo consolidado" valor={formatarMoedaMil(saldoFinal)} apoio={`início do ano: ${formatarMoedaMil(saldoInicial)}`} corValor={saldoFinal < 0 ? COR.vermelho : COR.azul} />
        <CartaoKpi rotulo="Inadimplência" valor={inadFim === null ? "—" : formatarMoedaMil(inadFim)} apoio={inadInicio === null ? "sem posição lançada" : `início do ano: ${formatarMoedaMil(inadInicio)}`} corValor={inadFim !== null && inadInicio !== null && inadFim > inadInicio ? COR.vermelho : COR.azul} />
        <CartaoKpi rotulo="Recuperado no ano" valor={formatarMoedaMil(recuperado)} apoio="débitos antigos pagos" corValor={COR.verde} />
        <CartaoKpi rotulo="OS no prazo" valor={noPrazoAno === null ? "—" : `${formatarNumero(noPrazoAno, 1)}%`} apoio={`${formatarNumero(osAno)} OS no ano`} corValor={COR.azul} />
        <CartaoKpi
          rotulo="Índice executivo médio"
          valor={indiceMedio === null ? "—" : String(indiceMedio)}
          apoio={`${publicados} de ${doAno.length} relatórios publicados`}
          semaforo={indiceMedio === null ? undefined : semaforoDaNota(indiceMedio)}
        />
      </div>
      {leituraAno.length ? <CaixaLeitura titulo="O ano em uma leitura" topicos={leituraAno} automatica style={{ marginTop: 18 }} tamanho={12.5} /> : null}
    </SlidePadrao>,
  );

  /* ---------------------------------------------- financeiro mês a mês */
  if (comFinanceiro.length) {
    const dadosFin = meses.map((m) => ({
      mes: m.r ? mesCurto(competenciaFinanceira(m.r)) : m.rotulo,
      Créditos: m.r && receitaTotal(m.r.dados) ? receitaTotal(m.r.dados) / 1000 : null,
      Débitos: m.r && despesaTotal(m.r.dados) ? despesaTotal(m.r.dados) / 1000 : null,
      saldo: m.r && receitaTotal(m.r.dados) + despesaTotal(m.r.dados) ? saldoTotal(m.r.dados) / 1000 : null,
      resultado: m.r && receitaTotal(m.r.dados) + despesaTotal(m.r.dados) ? resultadoFinanceiro(m.r.dados) / 1000 : null,
    }));
    add(
      "financeiro",
      "Financeiro mês a mês",
      <SlidePadrao secao="Financeiro mês a mês" sobretitulo={`Visão anual ${ano}`} icone={TrendingUp} fontes={fontes}>
        <RotuloBloco>Créditos x débitos por prestação de contas (R$ mil)</RotuloBloco>
        <BarChart width={1205} height={250} data={dadosFin} margin={{ top: 22, right: 8, left: 8, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={COR.linha} />
          <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: COR.linha }} tickLine={false} />
          <YAxis hide />
          <Tooltip formatter={(v: number) => `R$ ${formatarNumero(v, 1)} mil`} />
          <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ fontSize: 11, top: -6 }} />
          <Bar dataKey="Créditos" fill={COR.azul} radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false}>
            <LabelList dataKey="Créditos" position="top" style={ROTULO} formatter={(v: number) => (v ? formatarNumero(v, 0) : "")} />
          </Bar>
          <Bar dataKey="Débitos" fill={COR.indigo} radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false}>
            <LabelList dataKey="Débitos" position="top" style={ROTULO} formatter={(v: number) => (v ? formatarNumero(v, 0) : "")} />
          </Bar>
        </BarChart>
        <RotuloBloco style={{ marginTop: 12 }}>Saldo consolidado no fim de cada prestação (R$ mil)</RotuloBloco>
        <LineChart width={1205} height={150} data={dadosFin} margin={{ top: 22, right: 30, left: 30, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={COR.linha} />
          <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: COR.linha }} tickLine={false} />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip formatter={(v: number) => `R$ ${formatarNumero(v, 1)} mil`} />
          <Line dataKey="saldo" stroke={COR.navy} strokeWidth={2} dot={{ r: 5, fill: COR.navy }} connectNulls isAnimationActive={false}>
            <LabelList dataKey="saldo" position="top" offset={10} style={ROTULO} formatter={(v: number) => (v === null ? "" : formatarNumero(v, 0))} />
          </Line>
        </LineChart>
      </SlidePadrao>,
    );

    /* --------------------------------------------------- resultado */
    add(
      "resultado",
      "Resultado mensal",
      <SlidePadrao secao="Resultado de cada mês" sobretitulo={`Visão anual ${ano}`} icone={TrendingUp} fontes={fontes}>
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ flex: 1 }}>
            <RotuloBloco>Resultado mensal: créditos − débitos (R$ mil)</RotuloBloco>
            <BarChart width={850} height={400} data={dadosFin} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="mes" tick={EIXO} axisLine={false} tickLine={false} />
              <YAxis hide domain={["auto", "auto"]} />
              <ReferenceLine y={0} stroke={COR.linha} />
              <Tooltip formatter={(v: number) => `R$ ${formatarNumero(v, 1)} mil`} />
              <Bar dataKey="resultado" radius={3} maxBarSize={46} isAnimationActive={false}>
                {dadosFin.map((x) => (
                  <Cell key={x.mes} fill={(x.resultado ?? 0) < 0 ? COR.vermelho : COR.verde} />
                ))}
                <LabelList
                  dataKey="resultado"
                  content={(p) => {
                    const { x = 0, y = 0, width = 0, height = 0, value } = p as { x?: number; y?: number; width?: number; height?: number; value?: number | null };
                    if (value === null || value === undefined) return null;
                    const neg = Number(value) < 0;
                    const topo = Math.min(Number(y), Number(y) + Number(height));
                    const base = Math.max(Number(y), Number(y) + Number(height));
                    return (
                      <text x={Number(x) + Number(width) / 2} y={neg ? base + 13 : topo - 6} textAnchor="middle" style={ROTULO}>
                        {formatarNumero(Number(value), 1)}
                      </text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </div>
          <div style={{ width: 330, display: "flex", flexDirection: "column", gap: 16 }}>
            <CartaoKpi rotulo="Meses positivos" valor={`${comFinanceiro.filter((r) => resultadoFinanceiro(r.dados) >= 0).length} de ${comFinanceiro.length}`} corValor={COR.verde} altura={100} />
            <CartaoKpi
              rotulo="Melhor mês"
              valor={formatarMoedaMil(Math.max(...comFinanceiro.map((r) => resultadoFinanceiro(r.dados))))}
              apoio={mesCurto(competenciaFinanceira(comFinanceiro.reduce((a, b) => (resultadoFinanceiro(b.dados) > resultadoFinanceiro(a.dados) ? b : a))))}
              corValor={COR.azul}
              altura={100}
            />
            <CartaoKpi
              rotulo="Pior mês"
              valor={formatarMoedaMil(Math.min(...comFinanceiro.map((r) => resultadoFinanceiro(r.dados))))}
              apoio={mesCurto(competenciaFinanceira(comFinanceiro.reduce((a, b) => (resultadoFinanceiro(b.dados) < resultadoFinanceiro(a.dados) ? b : a))))}
              corValor={COR.vermelho}
              altura={100}
            />
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* --------------------------------------------------- despesas do ano */
  const grupos = new Map<string, number>();
  doAno.forEach((r) => r.dados.financeiro.grupos.forEach((g) => g.realizado > 0 && grupos.set(g.grupo, (grupos.get(g.grupo) ?? 0) + g.realizado)));
  if (grupos.size >= 3) {
    const total = [...grupos.values()].reduce((s, v) => s + v, 0);
    const ordenados = [...grupos.entries()].sort((a, b) => b[1] - a[1]);
    const linhas = [...ordenados.slice(0, 8), ...(ordenados.length > 8 ? [["Demais grupos", ordenados.slice(8).reduce((s, [, v]) => s + v, 0)] as [string, number]] : [])].map(([grupo, valor]) => ({
      grupo,
      valor,
      pct: (valor / total) * 100,
    }));
    add(
      "despesas",
      "Despesas do ano",
      <SlidePadrao secao="Despesas do ano por grupo" sobretitulo={`Visão anual ${ano}`} icone={IconePizza} fontes={fontes}>
        <div style={{ display: "flex", gap: 30 }}>
          <div style={{ width: 800 }}>
            <RotuloBloco>Despesas ordinárias acumuladas (R$ mil · % do total)</RotuloBloco>
            <BarChart width={800} height={Math.min(40 + linhas.length * 44, 430)} data={linhas} layout="vertical" margin={{ top: 4, right: 140, left: 8, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="grupo" width={260} tick={{ ...EIXO, fill: COR.navy }} axisLine={false} tickLine={false} />
              <Bar dataKey="valor" fill={COR.azul} radius={4} barSize={22} isAnimationActive={false}>
                <LabelList
                  dataKey="valor"
                  content={(p) => {
                    const { x = 0, y = 0, width = 0, height = 0, index = 0 } = p as { x?: number; y?: number; width?: number; height?: number; index?: number };
                    const l = linhas[index];
                    return (
                      <text x={Number(x) + Number(width) + 8} y={Number(y) + Number(height) / 2 + 4} style={{ ...ROTULO, fontSize: 11 }}>
                        {mil(l.valor)} · {formatarNumero(l.pct, 1)}%
                      </text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ background: COR.cartao, padding: 20 }}>
              <p className="num" style={{ fontSize: 30, fontWeight: 700, color: COR.navy }}>{formatarMoedaMil(total)}</p>
              <p style={{ fontSize: 12, color: COR.apoio }}>despesa ordinária no ano</p>
            </div>
            <CaixaLeitura
              titulo="Concentração"
              style={{ marginTop: 16 }}
              topicos={[
                {
                  destaque: `3 grupos concentram ${formatarNumero(linhas.slice(0, 3).reduce((s, l) => s + l.pct, 0), 1)}%:`,
                  texto: `${linhas.slice(0, 3).map((l) => l.grupo.toLowerCase()).join(", ")}.`,
                },
              ]}
            />
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ------------------------------------------------------ inadimplência */
  if (comInad.length) {
    const dadosInad = meses.map((m) => ({
      mes: m.r ? mesCurto(competenciaFinanceira(m.r)) : m.rotulo,
      total: m.r && comInad.includes(m.r) ? inadimplenciaTotal(m.r.dados) / 1000 : null,
      taxa: m.r ? taxaInadimplenciaMes(m.r.dados) : null,
      recebido: m.r ? inadimplenciaRecebida(m.r.dados) / 1000 : null,
    }));
    const temTaxa = dadosInad.some((x) => x.taxa !== null);
    add(
      "inadimplencia",
      "Inadimplência no ano",
      <SlidePadrao secao="Inadimplência no ano" sobretitulo={`Visão anual ${ano}`} icone={Receipt} fontes={fontes}>
        <RotuloBloco>Saldo devedor no fim de cada mês (R$ mil)</RotuloBloco>
        <LineChart width={1205} height={temTaxa ? 200 : 400} data={dadosInad} margin={{ top: 22, right: 30, left: 30, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={COR.linha} />
          <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: COR.linha }} tickLine={false} />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip formatter={(v: number) => `R$ ${formatarNumero(v, 1)} mil`} />
          <Line dataKey="total" stroke={COR.vermelho} strokeWidth={2} dot={{ r: 5, fill: COR.vermelho }} connectNulls isAnimationActive={false}>
            <LabelList dataKey="total" position="top" offset={10} style={ROTULO} formatter={(v: number) => (v === null ? "" : formatarNumero(v, 1))} />
          </Line>
        </LineChart>
        {temTaxa ? (
          <>
            <RotuloBloco style={{ marginTop: 14 }}>Inadimplência do mês: em aberto sobre o emitido na ordinária (%)</RotuloBloco>
            <BarChart width={1205} height={190} data={dadosInad} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: COR.linha }} tickLine={false} />
              <YAxis hide />
              <Bar dataKey="taxa" fill={COR.azul} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                <LabelList dataKey="taxa" position="top" style={ROTULO} formatter={(v: number) => (v === null ? "" : `${formatarNumero(v, 1)}%`)} />
              </Bar>
            </BarChart>
          </>
        ) : null}
      </SlidePadrao>,
    );
  }

  /* ----------------------------------------------------------- operação */
  const comOS = doAno.filter((r) => totalOS(r.dados) > 0);
  if (comOS.length) {
    const dadosOS = meses.map((m) => ({
      mes: m.rotulo,
      noPrazo: m.r ? percentualOSNoPrazo(m.r.dados) : null,
      atrasadas: m.r && totalOS(m.r.dados) ? m.r.dados.operacao.situacaoOS.abertasAtrasadas : null,
      total: m.r && totalOS(m.r.dados) ? totalOS(m.r.dados) : null,
    }));
    add(
      "operacao",
      "Operação no ano",
      <SlidePadrao secao="Ordens de serviço no ano" sobretitulo={`Visão anual ${ano}`} icone={ClipboardList} fontes={fontes}>
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ width: 590 }}>
            <RotuloBloco>OS concluídas no prazo (%)</RotuloBloco>
            <BarChart width={590} height={420} data={dadosOS} margin={{ top: 22, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: COR.linha }} tickLine={false} />
              <YAxis hide domain={[0, 110]} />
              <Bar dataKey="noPrazo" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                {dadosOS.map((x) => (
                  <Cell key={x.mes} fill={(x.noPrazo ?? 0) >= 90 ? COR.verde : (x.noPrazo ?? 0) >= 75 ? COR.amarelo : COR.vermelho} />
                ))}
                <LabelList dataKey="noPrazo" position="top" style={ROTULO} formatter={(v: number) => (v === null ? "" : formatarNumero(v, 0))} />
              </Bar>
            </BarChart>
          </div>
          <div style={{ flex: 1 }}>
            <RotuloBloco>Backlog: OS abertas fora do prazo no fim do mês</RotuloBloco>
            <BarChart width={590} height={420} data={dadosOS} margin={{ top: 22, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: COR.linha }} tickLine={false} />
              <YAxis hide />
              <Bar dataKey="atrasadas" fill={COR.indigo} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                <LabelList dataKey="atrasadas" position="top" style={ROTULO} formatter={(v: number) => (v === null ? "" : formatarNumero(v))} />
              </Bar>
            </BarChart>
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ---------------------------------------------------------- governança */
  const comGov = doAno.filter((r) => r.dados.documentos.linhas.length || r.dados.contratos.linhas.length);
  if (comGov.length) {
    const ultimoGov = comGov[comGov.length - 1];
    const docs = contarDocumentos(ultimoGov.dados, hoje);
    const ctr = contarContratos(ultimoGov.dados, hoje);
    add(
      "governanca",
      "Governança no ano",
      <SlidePadrao secao="Documentos e contratos" sobretitulo={`Visão anual ${ano}`} icone={FileText} fontes={`${fontes} Situação calculada na data de hoje.`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          <CartaoKpi rotulo="Documentos em dia" valor={docs.percentualEmDia === null ? "—" : `${formatarNumero(docs.percentualEmDia, 0)}%`} apoio={`${docs.total} documentos no cadastro`} corValor={COR.azul} altura={100} />
          <CartaoKpi rotulo="Documentos vencidos" valor={String(docs.vencidos)} apoio={`${docs.aVencer} vencem em até 90 dias`} semaforo={docs.vencidos ? "vermelho" : "verde"} altura={100} />
          <CartaoKpi rotulo="Contratos vigentes" valor={String(ctr.vigentes)} apoio={`${ctr.emRenovacao} a renovar em até 120 dias`} corValor={COR.azul} altura={100} />
          <CartaoKpi rotulo="Contratos vencidos" valor={String(ctr.vencidos)} apoio="data de término no sistema" semaforo={ctr.vencidos ? "vermelho" : "verde"} altura={100} />
        </div>
        <RotuloBloco style={{ marginTop: 20 }}>Pendências ao longo do ano (posição de cada relatório)</RotuloBloco>
        <TabelaSlide
          linhas={comGov}
          maxLinhas={8}
          alturaLinha={30}
          tamanho={10.5}
          colunas={[
            { titulo: "Mês", render: (r) => mesCurto(r.competencia) },
            { titulo: "Documentos vencidos", alinhar: "center", render: (r) => String(contarDocumentos(r.dados, hoje).vencidos) },
            { titulo: "A vencer (90 dias)", alinhar: "center", render: (r) => String(contarDocumentos(r.dados, hoje).aVencer) },
            { titulo: "Contratos vencidos", alinhar: "center", render: (r) => String(contarContratos(r.dados, hoje).vencidos) },
            { titulo: "Riscos de criticidade alta", alinhar: "center", render: (r) => String(r.dados.riscos.linhas.filter((x) => x.criticidade === "alta").length) },
          ]}
        />
      </SlidePadrao>,
    );
  }

  /* --------------------------------------------------- tabela de evolução */
  add(
    "evolucao",
    "Evolução mês a mês",
    <SlidePadrao secao="Evolução mês a mês" sobretitulo={`Visão anual ${ano}`} icone={Table2} fontes={fontes}>
      <TabelaSlide
        linhas={doAno}
        alturaLinha={36}
        tamanho={10.5}
        colunas={[
          { titulo: "Competência", render: (r) => mesCurto(r.competencia) },
          { titulo: "Financeiro", render: (r) => mesCurto(competenciaFinanceira(r)) },
          { titulo: "Créditos", alinhar: "right", render: (r) => (receitaTotal(r.dados) ? formatarMoedaMil(receitaTotal(r.dados)) : "—") },
          { titulo: "Débitos", alinhar: "right", render: (r) => (despesaTotal(r.dados) ? formatarMoedaMil(despesaTotal(r.dados)) : "—") },
          {
            titulo: "Resultado",
            alinhar: "right",
            render: (r) =>
              receitaTotal(r.dados) + despesaTotal(r.dados) ? (
                <strong style={{ color: resultadoFinanceiro(r.dados) < 0 ? COR.vermelho : COR.verde }}>{formatarMoedaMil(resultadoFinanceiro(r.dados))}</strong>
              ) : (
                "—"
              ),
          },
          { titulo: "Saldo", alinhar: "right", render: (r) => (receitaTotal(r.dados) + despesaTotal(r.dados) ? formatarMoedaMil(saldoTotal(r.dados)) : "—") },
          { titulo: "Inadimplência", alinhar: "right", render: (r) => (comInad.includes(r) ? formatarMoedaMil(inadimplenciaTotal(r.dados)) : "—") },
          { titulo: "OS no prazo", alinhar: "right", render: (r) => (percentualOSNoPrazo(r.dados) === null ? "—" : `${formatarNumero(percentualOSNoPrazo(r.dados)!, 1)}%`) },
          {
            titulo: "Índice",
            alinhar: "center",
            render: (r) => {
              const n = calcularIndiceExecutivo(r.dados, hoje);
              return n === null ? "—" : <strong style={{ color: n >= 85 ? COR.verde : n >= 60 ? COR.amarelo : COR.vermelho }}>{n}</strong>;
            },
          },
          { titulo: "Status", render: (r) => (r.status === "publicado" ? "Publicado" : r.status === "revisao" ? "Em revisão" : "Rascunho") },
        ]}
      />
    </SlidePadrao>,
  );

  return numerar(slides, emp, ano);
};

/** Rodapé e página (mesmo padrão do RGM mensal, sem capítulos). */
const numerar = (slides: SlideAnual[], emp: Empreendimento, ano: number): SlideAnual[] => {
  const todos = [...slides, { id: "fim", titulo: "Encerramento", node: <SlideEncerramento /> }];
  const rodape = [emp.nome, `Visão anual ${ano}`, emp.cidade].filter(Boolean).join(" · ");
  return todos.map((s, i) => ({
    ...s,
    node: (
      <ContextoPagina.Provider value={{ pagina: i + 1, capitulo: null, rodape, inicioCapitulo: {} }}>{s.node}</ContextoPagina.Provider>
    ),
  }));
};

