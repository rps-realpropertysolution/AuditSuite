/**
 * Os slides do RGM, na ordem do relatório corporativo RPS:
 *
 *   capa · o empreendimento · ocupação e acesso · painel executivo 360° ·
 *   financeiro (resultado, fundos, previsto x realizado, estrutura de custos) ·
 *   arrecadação e inadimplência · utilidades · contratos · documentos ·
 *   operação · ordens de serviço · fornecedores · registro fotográfico ·
 *   jurídico · CAPEX · plano de ação e riscos · decisões e próximos passos ·
 *   conclusão · encerramento
 *
 * Regra: slide sem dado não entra. Um relatório em preenchimento gera uma
 * apresentação mais curta — nunca uma apresentação com buracos.
 */

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ReferenceLine,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  Calculator,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  Hammer,
  Handshake,
  Landmark,
  LayoutGrid,
  ListChecks,
  MessageSquareText,
  PiggyBank,
  PieChart as IconePizza,
  Receipt,
  Scale,
  ShieldAlert,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  Zap,
  BarChart3,
  Wallet,
  AlertTriangle,
  CalendarClock,
  DoorOpen,
  ParkingSquare,
  Layers,
  Ruler,
  MapPin,
  CircleDollarSign,
  BadgeCheck,
  Ban,
  Gavel,
  Gem,
  ShoppingCart,
} from "lucide-react";
import {
  competenciaFinanceira,
  contarCertidoes,
  fundoDeReserva,
  resumoPlanoAcao,
  riscoJuridico,
  situacaoCertidao,
  calcularIndiceExecutivo,
  contarContratos,
  contarDocumentos,
  despesaTotal,
  inadimplenciaRecebida,
  inadimplenciaTotal,
  indicadores360,
  percentualOSCanceladas,
  percentualOSNoPrazo,
  receitaTotal,
  resultadoFinanceiro,
  saldoFundo,
  saldoTotal,
  semaforoDaNota,
  situacaoContrato,
  situacaoDocumento,
  taxaInadimplenciaMes,
  totalAcessos,
  totalManutencoes,
  totalOS,
  totalRubrica,
  vacancia,
  variacao,
  variacaoConsumo,
  DIAS_ALERTA_DOCUMENTO,
} from "@/lib/metrics";
import {
  leituraContratos,
  leituraDocumentos,
  leituraFinanceiro,
  leituraInadimplencia,
  leituraOS,
  leituraOuAutomatica,
  resumoDoMes,
  comentarioParaTopicos,
  type Topico,
} from "@/lib/leitura";
import {
  competenciaAnterior,
  formatarCompetencia,
  formatarCompetenciaCurta,
  formatarData,
  formatarMoeda,
  formatarMoedaMil,
  formatarNumero,
  formatarVariacao,
} from "@/lib/format";
import type { DadosRelatorio, Relatorio, Semaforo } from "@/lib/types";
import { prazoEntrega } from "@/lib/entregas";
import {
  CaixaLeitura,
  CartaoKpi,
  COR,
  COR_SEMAFORO,
  ItemLegenda,
  LegendaSemaforo,
  Ponto,
  RotuloBloco,
  SlideAbertura,
  SlideCapa,
  SlideEncerramento,
  SlidePadrao,
  SlideSumario,
  TabelaSlide,
  Vazio,
  CAPITULOS,
  ContextoPagina,
  type CapituloId,
} from "./moldura";

export interface SlideMontado {
  id: string;
  titulo: string;
  capitulo: CapituloId | null;
  pagina: number;
  node: ReactNode;
}

/** Ordem do template corporativo RPS 360° e capítulo de cada slide. */
const ORDEM: { id: string; capitulo: CapituloId | null }[] = [
  { id: "capa", capitulo: null },
  { id: "panorama", capitulo: null },
  { id: "sumario", capitulo: null },
  { id: "painel", capitulo: null },
  { id: "empreendimento", capitulo: "01" },
  { id: "ocupacao", capitulo: "01" },
  { id: "financeiro", capitulo: "02" },
  { id: "fundos", capitulo: "02" },
  { id: "orcamento", capitulo: "02" },
  { id: "custos", capitulo: "02" },
  { id: "inadimplencia", capitulo: "02" },
  { id: "contratos", capitulo: "03" },
  { id: "documentos", capitulo: "03" },
  { id: "juridico", capitulo: "03" },
  { id: "operacao", capitulo: "04" },
  { id: "os", capitulo: "04" },
  { id: "fornecedores", capitulo: "04" },
  { id: "suprimentos", capitulo: "04" },
  { id: "fotos", capitulo: "04" },
  { id: "utilidades", capitulo: "05" },
  { id: "capex", capitulo: "06" },
  { id: "valor", capitulo: "06" },
  { id: "riscos", capitulo: "07" },
  { id: "proximos", capitulo: "07" },
  { id: "conclusao", capitulo: "07" },
  { id: "fim", capitulo: null },
];

export interface ContextoSlides {
  relatorio: Relatorio;
  /** Relatórios do mesmo ativo em ordem cronológica (inclui o atual). */
  historico: Relatorio[];
  urlsFotos: Record<string, string>;
  urlFotoEmpreendimento?: string | null;
  hoje?: Date;
}

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                  */
/* -------------------------------------------------------------------------- */

const mesTitulo = (iso: string) => {
  const t = formatarCompetencia(iso); // "outubro de 2026"
  const [mes, , ano] = t.split(" ");
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)}/${ano}`;
};

const mesCurto = (iso: string) => {
  const c = formatarCompetenciaCurta(iso); // "out/26"
  return c.charAt(0).toUpperCase() + c.slice(1);
};

const mil = (v: number) => formatarNumero(v / 1000, 1);

const corSemaforo = (s: Semaforo) => COR_SEMAFORO[s];

const EIXO = { fontSize: 11, fill: COR.apoio, fontFamily: "Poppins" };
const ROTULO_BARRA = { fontSize: 11, fill: COR.navy, fontWeight: 600, fontFamily: "Poppins" };

const vsAnterior = (atual: number, anterior: number | undefined, compAnt: string | undefined) => {
  if (anterior === undefined || !compAnt) return undefined;
  const v = variacao(atual, Math.abs(anterior));
  if (v === null) return undefined;
  return `${formatarVariacao(v)} vs. ${mesCurto(compAnt)}`;
};

/* -------------------------------------------------------------------------- */
/* Montagem                                                                    */
/* -------------------------------------------------------------------------- */

/** Primeiro tópico da leitura vira a manchete do slide: "Destaque — texto". */
const manchete = (topicos: Topico[]) => {
  const t = topicos[0];
  if (!t) return undefined;
  const destaque = t.destaque.trim();
  if (!destaque) return t.texto;
  return destaque.endsWith(":") ? `${destaque.slice(0, -1)} — ${t.texto}` : `${destaque} ${t.texto}`;
};

const mancheteOrcamento = (dv: number | null, orc: number, real: number) =>
  dv === null
    ? undefined
    : Math.abs(dv) < 1
      ? `Despesa ordinária em linha com o orçamento: ${formatarMoedaMil(real)} realizados para ${formatarMoedaMil(orc)} previstos.`
      : `Despesa ordinária ${formatarNumero(Math.abs(dv), 1)}% ${dv > 0 ? "acima" : "abaixo"} do orçamento: ${formatarMoedaMil(real)} realizados para ${formatarMoedaMil(orc)} previstos.`;

/** Prazo do RGM seguinte (para o encerramento). */
const prazoProximo = (competencia: string) => {
  const [a, m] = competencia.split("-").map(Number);
  return prazoEntrega(`${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`);
};

export const montarSlides = (ctx: ContextoSlides): SlideMontado[] => {
  const { relatorio } = ctx;
  const hoje = ctx.hoje ?? new Date();
  const d = relatorio.dados;
  const emp = relatorio.empreendimento;
  const competencia = relatorio.competencia;
  const mes = mesTitulo(competencia);
  /** Financeiro = última prestação fechada (normalmente o mês anterior). */
  const compFin = competenciaFinanceira(relatorio);
  const mesFin = mesTitulo(compFin);
  const mesFinCurto = mesCurto(compFin).toUpperCase();
  const mesFinExtenso = formatarCompetencia(compFin).split(" ")[0];

  const historico = ctx.historico
    .filter((r) => r.competencia <= competencia)
    .sort((a, b) => a.competencia.localeCompare(b.competencia));
  const anteriorRel = historico.find((r) => r.competencia === competenciaAnterior(competencia));
  // "anterior" no financeiro = prestação de contas anterior (a do relatório do mês passado)
  const anterior = anteriorRel ? { competencia: competenciaFinanceira(anteriorRel), dados: anteriorRel.dados } : undefined;
  const serie = [...historico.filter((r) => r.competencia < competencia), { ...relatorio }].slice(-6);

  const importado = new Set(d.importacao?.secoes ?? []);
  const dataImport = d.importacao ? formatarData(d.importacao.em) : "";
  /** Linha "Fontes:" honesta: diz o que veio do sistema e o que foi lançado. */
  const fontes = (secoes: string[], extra?: string) => {
    const doSistema = secoes.some((s) => importado.has(s));
    const arquivos = d.arquivosImportados.filter((a) => a.secoes.some((s) => secoes.includes(s))).map((a) => a.titulo);
    const partes = [
      doSistema ? `LiveFacilities (RP Smart), dados importados em ${dataImport}` : null,
      arquivos.length ? `relatórios do sistema: ${arquivos.join(", ")}` : null,
      !doSistema && !arquivos.length ? "lançamentos do gestor no RGM" : null,
      extra,
    ].filter(Boolean);
    return `${partes.join("; ")}.`;
  };

  const ind = Object.fromEntries(indicadores360(d, hoje).map((i) => [i.id, i]));

  const reserva = fundoDeReserva(d);
  const mancheteFundos = saldoTotal(d)
    ? `Saldo consolidado de ${formatarMoedaMil(saldoTotal(d))}${reserva ? `; fundo de reserva com ${formatarMoedaMil(saldoFundo(reserva))}` : ""}.`
    : undefined;

  /** Os números que abrem cada capítulo (tela escura). Só o que existe entra. */
  const destaquesDoCapitulo = (id: CapituloId): { rotulo: string; valor: string; apoio?: string; semaforo?: Semaforo }[] => {
    type D = { rotulo: string; valor: string; apoio?: string; semaforo?: Semaforo } | null;
    const lista: D[] = (() => {
      switch (id) {
        case "01":
          return [
            d.operacao.ocupacao > 0 ? { rotulo: "Ocupação", valor: `${formatarNumero(d.operacao.ocupacao, 0)}%` } : null,
            emp?.ficha?.areaConstruida ? { rotulo: "Área construída", valor: `${formatarNumero(emp.ficha.areaConstruida, 0)} m²` } : null,
            totalAcessos(d) > 0 ? { rotulo: "Acessos no mês", valor: formatarNumero(totalAcessos(d)) } : null,
          ];
        case "02":
          return [
            receitaTotal(d) || despesaTotal(d) ? { rotulo: `Resultado · ${mesFinCurto}`, valor: formatarMoedaMil(resultadoFinanceiro(d)), semaforo: ind.resultado?.semaforo } : null,
            saldoTotal(d) ? { rotulo: "Saldo consolidado", valor: formatarMoedaMil(saldoTotal(d)), semaforo: ind.saldo?.semaforo } : null,
            inadimplenciaTotal(d) ? { rotulo: "Inadimplência total", valor: formatarMoedaMil(inadimplenciaTotal(d)), semaforo: ind.inadimplencia?.semaforo } : null,
          ];
        case "03": {
          const c = contarContratos(d, hoje);
          const doc = contarDocumentos(d, hoje);
          const cert = contarCertidoes(d, hoje);
          return [
            d.contratos.linhas.length ? { rotulo: "Contratos vigentes", valor: `${c.vigentes + c.emRenovacao} de ${d.contratos.linhas.length}`, semaforo: ind.contratos?.semaforo } : null,
            doc.percentualEmDia !== null ? { rotulo: "Documentos em dia", valor: `${formatarNumero(doc.percentualEmDia, 0)}%`, semaforo: ind.documentos?.semaforo } : null,
            cert.total ? { rotulo: "Certidões regulares", valor: `${cert.regulares} de ${cert.total}`, semaforo: ind.juridico?.semaforo } : null,
          ];
        }
        case "04":
          return [
            totalOS(d) ? { rotulo: "Ordens de serviço", valor: formatarNumero(totalOS(d)) } : null,
            percentualOSNoPrazo(d) !== null ? { rotulo: "Concluídas no prazo", valor: `${formatarNumero(percentualOSNoPrazo(d)!, 0)}%`, semaforo: ind.operacao?.semaforo } : null,
            d.suprimentos.pedidos.length ? { rotulo: "Pedidos de compra", valor: formatarNumero(d.suprimentos.pedidos.length) } : null,
          ];
        case "05": {
          const energia = d.utilidades.linhas.find((u) => /energ/i.test(u.utilidade) && u.consumo > 0);
          const agua = d.utilidades.linhas.find((u) => /agua|água/i.test(u.utilidade) && u.consumo > 0);
          const custo = d.utilidades.linhas.reduce((s, u) => s + u.fatura, 0);
          return [
            energia ? { rotulo: "Energia", valor: `${formatarNumero(energia.consumo)} kWh` } : null,
            agua ? { rotulo: "Água", valor: `${formatarNumero(agua.consumo)} m³` } : null,
            custo ? { rotulo: "Custo das faturas", valor: formatarMoedaMil(custo) } : null,
          ];
        }
        case "06": {
          const realizado = d.valorGerado.linhas.filter((v) => v.tipo === "realizado").reduce((s, v) => s + v.valor, 0) || inadimplenciaRecebida(d);
          const capex = d.capex.linhas.reduce((s, c) => s + c.orcado, 0);
          return [
            realizado ? { rotulo: "Valor gerado (realizado)", valor: formatarMoedaMil(realizado) } : null,
            capex ? { rotulo: "CAPEX em carteira", valor: formatarMoedaMil(capex) } : null,
          ];
        }
        case "07": {
          const plano = resumoPlanoAcao(d);
          const decisoes = d.proximosPassos.linhas.filter((p) => p.dependeDoCliente).length;
          return [
            plano.total ? { rotulo: "Ações no plano", valor: formatarNumero(plano.total) } : null,
            plano.percentual !== null ? { rotulo: "Concluídas", valor: `${formatarNumero(plano.percentual, 0)}%` } : null,
            decisoes ? { rotulo: "Decisões do proprietário", valor: formatarNumero(decisoes) } : null,
          ];
        }
      }
    })();
    return lista.filter((x): x is NonNullable<D> => Boolean(x));
  };
  const slides: SlideMontado[] = [];
  const add = (id: string, titulo: string, node: ReactNode) => slides.push({ id, titulo, node, capitulo: null, pagina: 0 });

  /* ----------------------------------------------------------- 1. capa */
  add(
    "capa",
    "Capa",
    <SlideCapa
      empreendimento={emp?.nome ?? "Empreendimento"}
      competencia={mes}
      financeiro={mesFin}
      cidade={emp?.cidade}
      foto={ctx.urlFotoEmpreendimento}
      gestor={emp?.gestor_nome}
    />,
  );

  /* ------------------------------------------- o mês em uma leitura (tela cheia) */
  {
    const destaques = [
      receitaTotal(d) || despesaTotal(d)
        ? { rotulo: `Resultado · ${mesFinCurto}`, valor: formatarMoedaMil(resultadoFinanceiro(d)), semaforo: (resultadoFinanceiro(d) >= 0 ? "verde" : "amarelo") as Semaforo }
        : null,
      saldoTotal(d) ? { rotulo: "Saldo consolidado", valor: formatarMoedaMil(saldoTotal(d)) } : null,
      inadimplenciaTotal(d) ? { rotulo: "Inadimplência em aberto", valor: formatarMoedaMil(inadimplenciaTotal(d)), semaforo: ind.inadimplencia?.semaforo } : null,
      percentualOSNoPrazo(d) !== null
        ? { rotulo: "OS no prazo", valor: `${formatarNumero(percentualOSNoPrazo(d)!, 0)}%`, semaforo: ind.operacao?.semaforo }
        : null,
    ].filter(Boolean) as { rotulo: string; valor: string; semaforo?: Semaforo }[];
    const frase = resumoDoMes(d, anterior, hoje);
    if (frase || destaques.length) {
      add(
        "panorama",
        `${mes} em uma leitura`,
        <SlideAbertura sobretitulo={`${mes} em uma leitura`} titulo={emp?.nome ?? "O mês"} texto={frase || undefined} destaques={destaques} foto={ctx.urlFotoEmpreendimento} />,
      );
    }
  }

  /* ---------------------------------------------- 2. o empreendimento */
  const ficha = emp?.ficha ?? {};
  const itensFicha = [
    { icone: Ruler, valor: ficha.areaConstruida ? `${formatarNumero(ficha.areaConstruida, 2)} m²` : null, rotulo: "Área construída" },
    { icone: Building2, valor: ficha.areaPrivativa ? `${formatarNumero(ficha.areaPrivativa, 2)} m²` : null, rotulo: "Área privativa / locável" },
    { icone: LayoutGrid, valor: ficha.torres || null, rotulo: "Torres / blocos" },
    { icone: Layers, valor: ficha.pavimentos || null, rotulo: "Pavimentos" },
    { icone: Users, valor: emp?.unidades ? formatarNumero(emp.unidades) : null, rotulo: "Unidades / conjuntos" },
    { icone: ParkingSquare, valor: ficha.vagas ? formatarNumero(ficha.vagas) : null, rotulo: "Vagas de estacionamento" },
    { icone: DoorOpen, valor: ficha.elevadores ? formatarNumero(ficha.elevadores) : null, rotulo: "Elevadores" },
    { icone: CalendarClock, valor: ficha.inicioGestao ? mesTitulo(`${ficha.inicioGestao}-01`) : null, rotulo: "Início da gestão RPS" },
  ].filter((i) => i.valor);

  if (itensFicha.length >= 2 || ctx.urlFotoEmpreendimento) {
    const rodape = [
      emp?.sindico_nome ? `Síndico: ${emp.sindico_nome}` : null,
      ficha.sindicoDocumento ? `CNPJ ${ficha.sindicoDocumento}` : null,
      emp?.gestor_nome ? `Gestão RPS: ${emp.gestor_nome}` : null,
    ].filter(Boolean);
    add(
      "empreendimento",
      "O empreendimento",
      <SlidePadrao secao="O empreendimento" icone={Building2}>
        <div style={{ display: "flex", gap: 28, height: "100%" }}>
          <div style={{ width: 606, height: 456, background: COR.cartao, position: "relative", overflow: "hidden", flexShrink: 0 }}>
            {ctx.urlFotoEmpreendimento ? (
              <>
                <img src={ctx.urlFotoEmpreendimento} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.35)" }} />
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,90,170,0.28)", mixBlendMode: "multiply" }} />
              </>
            ) : (
              <Vazio>Foto do empreendimento: cadastre em Empreendimentos.</Vazio>
            )}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: COR.navy, lineHeight: 1.15 }}>{emp?.nome}</p>
            <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COR.apoio, marginTop: 12 }}>
              <MapPin size={16} color={COR.azul} />
              {[emp?.cidade, emp?.tipo ? emp.tipo.charAt(0).toUpperCase() + emp.tipo.slice(1) : null].filter(Boolean).join("   |   ")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 22, columnGap: 20, marginTop: 26 }}>
              {itensFicha.map((i) => (
                <div key={i.rotulo} style={{ display: "flex", gap: 12 }}>
                  <i.icone size={24} color={COR.azul} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p className="num" style={{ fontSize: 17, fontWeight: 700, color: COR.azul }}>{i.valor}</p>
                    <p style={{ fontSize: 10.5, color: COR.apoio }}>{i.rotulo}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "auto" }}>
              {ficha.destaques?.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, borderTop: `1px solid ${COR.linha}`, paddingTop: 12 }}>
                  {ficha.destaques.slice(0, 4).map((x) => (
                    <span key={x} style={{ background: COR.cartao, padding: "7px 14px", fontSize: 11, fontWeight: 600 }}>
                      {x}
                    </span>
                  ))}
                </div>
              ) : null}
              {rodape.length ? <p style={{ fontSize: 10.5, color: COR.apoio, marginTop: 10 }}>{rodape.join("   ·   ")}</p> : null}
            </div>
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* --------------------------------------- 3. ocupação e controle de acesso */
  if (d.operacao.ocupacao > 0 || totalAcessos(d) > 0) {
    const sOcup: Semaforo = d.operacao.ocupacao >= 90 ? "verde" : d.operacao.ocupacao >= 70 ? "amarelo" : "vermelho";
    add(
      "ocupacao",
      "Ocupação e acesso",
      <SlidePadrao secao="Controle de acesso e ocupação" icone={Users} fontes={fontes([], "controle de acesso e cadastro de condôminos")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          <CartaoKpi icone={Building2} rotulo="Ocupação do edifício" valor={`${formatarNumero(d.operacao.ocupacao, 0)}%`} apoio={`vacância de ${formatarNumero(vacancia(d), 0)}%`} semaforo={sOcup} altura={130} />
          <CartaoKpi icone={Users} rotulo="Acessos no mês" valor={formatarNumero(totalAcessos(d))} apoio={`entradas e saídas · ${mes.toLowerCase()}`} altura={130} />
          <CartaoKpi icone={BadgeCheck} rotulo="População fixa" valor={formatarNumero(d.operacao.acessosFixos)} apoio="acessos de usuários cadastrados" altura={130} />
          <CartaoKpi icone={DoorOpen} rotulo="Visitantes" valor={formatarNumero(d.operacao.acessosVisitantes)} apoio="acessos de visitantes no mês" altura={130} />
        </div>
        {d.operacao.comentario.trim() ? (
          <CaixaLeitura topicos={comentarioParaTopicos(d.operacao.comentario)} style={{ marginTop: 22 }} />
        ) : null}
      </SlidePadrao>,
    );
  }

  /* -------------------------------------------- 4. painel executivo 360° */
  {
    const totalOrcado = d.financeiro.grupos.reduce((s, g) => s + g.orcado, 0);
    const totalRealizadoOrc = d.financeiro.grupos.filter((g) => g.orcado > 0).reduce((s, g) => s + g.realizado, 0);
    const desvio = variacao(totalRealizadoOrc, totalOrcado);
    const sDesvio: Semaforo = desvio === null ? "amarelo" : desvio <= 0 ? "verde" : desvio <= 10 ? "amarelo" : "vermelho";
    const resultado = resultadoFinanceiro(d);
    const resultadoAnt = anterior ? resultadoFinanceiro(anterior.dados) : undefined;
    const ctr = contarContratos(d, hoje);
    const docs = contarDocumentos(d, hoje);
    const riscosAltos = d.riscos.linhas.filter((r) => r.criticidade === "alta").length;
    const noPrazo = percentualOSNoPrazo(d);
    const indice = calcularIndiceExecutivo(d, hoje);
    const reserva = fundoDeReserva(d);
    const reservaAnt = anterior ? fundoDeReserva(anterior.dados) : undefined;
    const plano = resumoPlanoAcao(d);

    const cartoes: { rotulo: string; valor: string; apoio: string; icone: typeof TrendingUp; semaforo: Semaforo }[] = [
      {
        rotulo: `Resultado do mês · ${mesFinCurto}`,
        valor: receitaTotal(d) || despesaTotal(d) ? formatarMoedaMil(resultado) : "—",
        apoio:
          resultadoAnt !== undefined && anterior
            ? `${formatarMoedaMil(resultadoAnt)} em ${mesCurto(anterior.competencia)}`
            : "créditos menos débitos do mês",
        icone: TrendingUp,
        semaforo: ind.resultado?.semaforo ?? "amarelo",
      },
      {
        rotulo: `Saldo consolidado · ${mesFinCurto}`,
        valor: d.financeiro.fundos.length ? formatarMoedaMil(saldoTotal(d)) : "—",
        apoio: anterior ? `${formatarMoedaMil(saldoTotal(anterior.dados))} em ${mesCurto(anterior.competencia)}` : "soma dos fundos",
        icone: Landmark,
        semaforo: ind.saldo?.semaforo ?? "amarelo",
      },
      {
        rotulo: `Desvio orçamentário · ${mesFinCurto}`,
        valor: desvio === null ? "—" : formatarVariacao(desvio),
        apoio: desvio === null ? "orçado não informado" : `${formatarMoedaMil(totalRealizadoOrc - totalOrcado)} · previsto ${formatarMoedaMil(totalOrcado)}`,
        icone: Calculator,
        semaforo: sDesvio,
      },
      reserva
        ? {
            rotulo: `Fundo de reserva · ${mesFinCurto}`,
            valor: formatarMoedaMil(saldoFundo(reserva)),
            apoio: reservaAnt
              ? `${formatarMoedaMil(saldoFundo(reservaAnt))} na prestação anterior`
              : saldoFundo(reserva) < 0
                ? "saldo negativo: recompor"
                : "saldo do fundo",
            icone: PiggyBank,
            semaforo: saldoFundo(reserva) < 0 ? "vermelho" : reservaAnt && saldoFundo(reserva) < saldoFundo(reservaAnt) ? "amarelo" : "verde",
          }
        : {
            rotulo: "Inadimplência",
            valor: formatarMoedaMil(inadimplenciaTotal(d)),
            apoio: taxaInadimplenciaMes(d) !== null ? `taxa do mês: ${formatarNumero(taxaInadimplenciaMes(d)!, 1)}%` : "em aberto no fim do mês",
            icone: Receipt,
            semaforo: ind.inadimplencia?.semaforo ?? "amarelo",
          },
      {
        rotulo: "Contratos",
        valor: d.contratos.linhas.length ? `${ctr.vigentes} vigentes` : "—",
        apoio: `${ctr.vencidos} ${ctr.vencidos === 1 ? "vencido" : "vencidos"} · ${ctr.emRenovacao} ${ctr.emRenovacao === 1 ? "renovação" : "renovações"} em até 120 dias`,
        icone: Handshake,
        semaforo: ind.contratos?.semaforo ?? "amarelo",
      },
      {
        rotulo: "Documentos legais",
        valor: docs.total
          ? docs.vencidos
            ? `${docs.vencidos} ${docs.vencidos === 1 ? "vencido" : "vencidos"}`
            : `${docs.vigentes + docs.permanentes} em dia`
          : "—",
        apoio: `${docs.aVencer} vencem em até ${DIAS_ALERTA_DOCUMENTO} dias · ${docs.total} no cadastro`,
        icone: FileText,
        semaforo: ind.documentos?.semaforo ?? "amarelo",
      },
      {
        rotulo: "Operação e manutenção",
        valor:
          noPrazo !== null
            ? `${formatarNumero(noPrazo, 1)}%`
            : d.operacao.ocorrencias.length
              ? `${d.operacao.ocorrencias.filter((o) => o.concluida).length} de ${d.operacao.ocorrencias.length}`
              : "—",
        apoio: noPrazo !== null ? "das OS concluídas no prazo" : "frentes com rotinas concluídas",
        icone: Wrench,
        semaforo: ind.operacao?.semaforo ?? "amarelo",
      },
      {
        rotulo: "Plano de ação",
        valor: plano.total ? (plano.concluidas ? `${formatarNumero(plano.percentual ?? 0, 0)}%` : `${plano.total} ações`) : "Sem riscos",
        apoio: plano.concluidas
          ? `${plano.concluidas} de ${plano.total} ações concluídas`
          : riscosAltos
            ? `${riscosAltos} de criticidade alta`
            : "nenhum risco de criticidade alta",
        icone: ListChecks,
        semaforo: ind.riscos?.semaforo ?? "verde",
      },
    ];

    // Ganhos do período: o valor gerado (realizado e projetado) tem prioridade sobre o texto livre.
    const recuperadoMes = inadimplenciaRecebida(d);
    const ganhosValor = [
      ...(!d.valorGerado.linhas.some((v) => v.tipo === "realizado") && recuperadoMes > 0
        ? [{ valor: recuperadoMes, periodicidade: "", descricao: `de inadimplência recuperada em ${mesFinExtenso}`, tipo: "realizado" as const }]
        : []),
      ...d.valorGerado.linhas,
    ]
      .filter((v) => v.valor > 0 && (v.tipo === "realizado" || v.tipo === "projetado"))
      .map((v) => `${formatarMoedaMil(v.valor)}${v.periodicidade ?? ""} ${v.descricao}${v.tipo === "projetado" ? " (projetado)" : ""}`);
    const ganhos = ganhosValor.length ? ganhosValor : d.sumario.principaisResultados.filter(Boolean);
    add(
      "painel",
      "Painel executivo 360°",
      <SlidePadrao
        secao="Painel executivo 360°"
        sobretitulo="Visão executiva · Dashboard 360°"
        icone={LayoutGrid}
        fontes={fontes(
          ["financeiro", "juridico", "contratos", "documentos", "operacao"],
          `prestação de contas de ${mesFinExtenso} (última competência fechada) para os indicadores financeiros; semáforos calculados com os parâmetros corporativos RPS`,
        )}
      >
        <div style={{ background: COR.navy, color: "#fff", padding: "14px 22px", minHeight: 88 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <RotuloBloco cor={COR.ciano} style={{ marginBottom: 6 }}>
              {mes} em uma leitura · financeiro: {mesFinCurto}
            </RotuloBloco>
            {indice !== null ? (
              <span style={{ fontSize: 11, fontWeight: 600, display: "inline-flex", gap: 8, alignItems: "center" }}>
                Índice executivo <strong style={{ fontSize: 15 }}>{indice}</strong>
                <Ponto semaforo={semaforoDaNota(indice)} tamanho={10} />
              </span>
            ) : null}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.45 }}>{resumoDoMes(d, anterior, hoje) || "Relatório em preenchimento."}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginTop: 18 }}>
          {cartoes.map((c) => (
            <CartaoKpi key={c.rotulo} {...c} altura={117} tamanhoValor={26} corValor={c.semaforo === "verde" ? COR.azul : undefined} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16, gap: 24 }}>
          <div style={{ flex: 1 }}>
            {ganhos.length ? (
              <>
                <RotuloBloco style={{ marginBottom: 4 }}>Ganhos do período</RotuloBloco>
                <p style={{ fontSize: 12, lineHeight: 1.45, color: "#2B2D45" }}>{ganhos.slice(0, 3).join("   ·   ")}</p>
              </>
            ) : null}
          </div>
          <LegendaSemaforo />
        </div>
      </SlidePadrao>,
    );
  }

  /* ------------------------------------------ 5. financeiro: resultado */
  if (receitaTotal(d) || despesaTotal(d)) {
    const resultado = resultadoFinanceiro(d);
    const ant = anterior?.dados;
    const dadosBarras = serie.map((r) => ({
      mes: mesCurto(competenciaFinanceira(r)),
      Créditos: receitaTotal(r.dados) / 1000,
      Débitos: despesaTotal(r.dados) / 1000,
    }));
    const dadosSaldo = serie.map((r) => ({ mes: mesCurto(competenciaFinanceira(r)), saldo: saldoTotal(r.dados) / 1000 }));
    const leitura = leituraOuAutomatica(d.financeiro.comentario, () => leituraFinanceiro(d, anterior));
    add(
      "financeiro",
      "Financeiro · resultado",
      <SlidePadrao secao={`Resultado e tendência · ${mesFin}`} manchete={manchete(leitura.topicos)} icone={TrendingUp} fontes={fontes(["financeiro"], `prestação de contas de ${mesFinExtenso} (última competência fechada)`)}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          <CartaoKpi rotulo={`Créditos do mês · ${mesFinCurto}`} valor={formatarMoedaMil(receitaTotal(d))} apoio={vsAnterior(receitaTotal(d), ant && receitaTotal(ant), anterior?.competencia)} altura={100} corValor={COR.azul} />
          <CartaoKpi rotulo={`Débitos do mês · ${mesFinCurto}`} valor={formatarMoedaMil(despesaTotal(d))} apoio={vsAnterior(despesaTotal(d), ant && despesaTotal(ant), anterior?.competencia)} altura={100} corValor={COR.navy} />
          <CartaoKpi
            rotulo={`Resultado do mês · ${mesFinCurto}`}
            valor={formatarMoedaMil(resultado)}
            apoio={ant ? `${resultado - resultadoFinanceiro(ant) >= 0 ? "+" : ""}${formatarMoedaMil(resultado - resultadoFinanceiro(ant))} vs. ${mesCurto(anterior!.competencia)}` : undefined}
            altura={100}
            corValor={resultado < 0 ? COR.vermelho : COR.verde}
          />
          <CartaoKpi rotulo={`Saldo consolidado · ${mesFinCurto}`} valor={formatarMoedaMil(saldoTotal(d))} apoio={vsAnterior(saldoTotal(d), ant && saldoTotal(ant), anterior?.competencia)} altura={100} corValor={saldoTotal(d) < 0 ? COR.vermelho : COR.azul} />
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 20 }}>
          <div style={{ width: 410 }}>
            <RotuloBloco>Créditos x débitos (R$ mil)</RotuloBloco>
            <BarChart width={410} height={318} data={dadosBarras} margin={{ top: 22, right: 4, left: 4, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={COR.linha} />
              <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: COR.linha }} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => `R$ ${formatarNumero(v, 1)} mil`} />
              <Legend verticalAlign="top" align="center" iconType="square" wrapperStyle={{ fontSize: 11, top: -4 }} />
              <Bar dataKey="Créditos" fill={COR.azul} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="Créditos" position="top" style={ROTULO_BARRA} formatter={(v: number) => formatarNumero(v, 1)} />
              </Bar>
              <Bar dataKey="Débitos" fill={COR.indigo} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="Débitos" position="top" style={ROTULO_BARRA} formatter={(v: number) => formatarNumero(v, 1)} />
              </Bar>
            </BarChart>
          </div>
          <div style={{ width: 410 }}>
            <RotuloBloco>Saldo consolidado (R$ mil)</RotuloBloco>
            <LineChart width={410} height={318} data={dadosSaldo} margin={{ top: 28, right: 24, left: 24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={COR.linha} />
              <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: COR.linha }} tickLine={false} />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip formatter={(v: number) => `R$ ${formatarNumero(v, 1)} mil`} />
              <Line type="linear" dataKey="saldo" name="Saldo" stroke={COR.navy} strokeWidth={2} dot={{ r: 5, fill: COR.navy }} isAnimationActive={false}>
                <LabelList dataKey="saldo" position="top" offset={12} style={ROTULO_BARRA} formatter={(v: number) => formatarNumero(v, 0)} />
              </Line>
            </LineChart>
          </div>
          <CaixaLeitura topicos={leitura.topicos} automatica={leitura.automatica} style={{ flex: 1, height: 346 }} tamanho={12.5} />
        </div>
      </SlidePadrao>,
    );
  }

  /* --------------------------------------------- 6. financeiro: fundos */
  if (d.financeiro.fundos.length >= 2) {
    const fundos = [...d.financeiro.fundos].sort((a, b) => saldoFundo(b) - saldoFundo(a));
    const dadosFundos = fundos.map((f) => ({ fundo: f.fundo, saldo: saldoFundo(f) / 1000 }));
    // Domínio com folga dos dois lados: o rótulo do saldo negativo fica à
    // esquerda da barra sem encostar no nome do fundo.
    const minF = Math.min(0, ...dadosFundos.map((f) => f.saldo));
    const maxF = Math.max(0, ...dadosFundos.map((f) => f.saldo));
    const faixa = maxF - minF || 1;
    const dominioFundos: [number, number] = [minF < 0 ? minF - faixa * 0.3 : 0, maxF + faixa * 0.2];
    const reservaSerie = serie
      .map((r) => ({ mes: mesCurto(competenciaFinanceira(r)), f: fundoDeReserva(r.dados) }))
      .filter((x) => x.f)
      .map((x) => ({ mes: x.mes, saldo: saldoFundo(x.f!) / 1000 }));
    // folga embaixo para o rótulo da barra negativa não encostar no eixo
    const minR = Math.min(0, ...reservaSerie.map((x) => x.saldo));
    const maxR = Math.max(0, ...reservaSerie.map((x) => x.saldo));
    const faixaR = maxR - minR || 1;
    const dominioReserva: [number, number] = [minR - faixaR * 0.25, maxR + faixaR * 0.15];
    add(
      "fundos",
      "Financeiro · fundos",
      <SlidePadrao secao={`Fundos e reserva · ${mesFin}`} manchete={mancheteFundos} icone={PiggyBank} fontes={fontes(["financeiro"], `posição financeira por fundo · prestação de contas de ${mesFinExtenso}`)}>
        <div style={{ display: "flex", gap: 28 }}>
          <div style={{ width: 520 }}>
            <RotuloBloco>Composição do saldo na competência (R$ mil)</RotuloBloco>
            <BarChart width={520} height={Math.min(60 + fundos.length * 44, 400)} data={dadosFundos} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <XAxis type="number" hide domain={dominioFundos} />
              <YAxis type="category" dataKey="fundo" width={190} tick={{ ...EIXO, fill: COR.navy }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => `R$ ${formatarNumero(v, 1)} mil`} />
              <Bar dataKey="saldo" radius={4} barSize={22} isAnimationActive={false}>
                {dadosFundos.map((f) => (
                  <Cell key={f.fundo} fill={f.saldo < 0 ? COR.vermelho : COR.azul} />
                ))}
                <LabelList
                  dataKey="saldo"
                  content={(p) => {
                    const { x = 0, y = 0, width = 0, height = 0, value = 0 } = p as { x?: number; y?: number; width?: number; height?: number; value?: number };
                    const negativo = Number(value) < 0;
                    // Em barra negativa o recharts entrega x no zero e width negativo.
                    const inicio = Math.min(Number(x), Number(x) + Number(width));
                    const fim = Math.max(Number(x), Number(x) + Number(width));
                    return (
                      <text
                        x={negativo ? inicio - 6 : fim + 6}
                        y={Number(y) + Number(height) / 2 + 4}
                        textAnchor={negativo ? "end" : "start"}
                        style={{ ...ROTULO_BARRA, fill: negativo ? COR.vermelho : COR.navy }}
                      >
                        {formatarNumero(Number(value), 1)}
                      </text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
            <p style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Total consolidado: {formatarMoeda(saldoTotal(d))}</p>
          </div>
          <div style={{ flex: 1 }}>
            {reservaSerie.length >= 2 || d.financeiro.conciliacao.trim() ? (
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                {reservaSerie.length >= 2 ? (
                  <div style={{ width: 300 }}>
                    <RotuloBloco>Fundo de reserva — evolução (R$ mil)</RotuloBloco>
                    <BarChart width={300} height={170} data={reservaSerie} margin={{ top: 20, right: 4, left: 4, bottom: 0 }}>
                      <XAxis dataKey="mes" tick={EIXO} axisLine={false} tickLine={false} />
                      <YAxis hide domain={dominioReserva} />
                      <ReferenceLine y={0} stroke={COR.linha} />
                      <Bar dataKey="saldo" radius={3} isAnimationActive={false}>
                        {reservaSerie.map((x) => (
                          <Cell key={x.mes} fill={x.saldo < 0 ? COR.vermelho : COR.azul} />
                        ))}
                        <LabelList
                          dataKey="saldo"
                          content={(p) => {
                            const { x = 0, y = 0, width = 0, height = 0, value = 0 } = p as { x?: number; y?: number; width?: number; height?: number; value?: number };
                            const negativo = Number(value) < 0;
                            const topo = Math.min(Number(y), Number(y) + Number(height));
                            const base = Math.max(Number(y), Number(y) + Number(height));
                            return (
                              <text x={Number(x) + Number(width) / 2} y={negativo ? base + 13 : topo - 6} textAnchor="middle" style={ROTULO_BARRA}>
                                {formatarNumero(Number(value), 1)}
                              </text>
                            );
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </div>
                ) : null}
                {d.financeiro.conciliacao.trim() ? (
                  <div style={{ flex: 1, background: COR.cartao, padding: "14px 16px" }}>
                    <RotuloBloco cor={COR.apoio}>Saldo contábil x saldo bancário</RotuloBloco>
                    {comentarioParaTopicos(d.financeiro.conciliacao).map((t, i) => (
                      <p key={i} style={{ fontSize: 11.5, lineHeight: 1.4, marginTop: i ? 6 : 0 }}>
                        {t.destaque ? <strong>{t.destaque} </strong> : null}
                        {t.texto}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <RotuloBloco>Movimento do mês por fundo</RotuloBloco>
            <TabelaSlide
              linhas={fundos}
              maxLinhas={reservaSerie.length >= 2 || d.financeiro.conciliacao.trim() ? 5 : 9}
              colunas={[
                { titulo: "Fundo", largura: "34%", render: (f) => f.fundo },
                { titulo: "Anterior", alinhar: "right", render: (f) => formatarMoedaMil(f.anterior) },
                { titulo: "Créditos", alinhar: "right", render: (f) => formatarMoedaMil(f.creditos) },
                { titulo: "Débitos", alinhar: "right", render: (f) => formatarMoedaMil(f.debitos) },
                {
                  titulo: "Saldo",
                  alinhar: "right",
                  render: (f) => <strong style={{ color: saldoFundo(f) < 0 ? COR.vermelho : COR.navy }}>{formatarMoedaMil(saldoFundo(f))}</strong>,
                },
              ]}
            />
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ---------------------------------- 7. financeiro: previsto x realizado */
  const gruposComOrcado = d.financeiro.grupos.filter((g) => g.orcado > 0);
  if (gruposComOrcado.length) {
    const orc = gruposComOrcado.reduce((s, g) => s + g.orcado, 0);
    const real = gruposComOrcado.reduce((s, g) => s + g.realizado, 0);
    const dv = variacao(real, orc);
    const gruposAnt = anterior?.dados.financeiro.grupos ?? [];
    const orcAnt = gruposAnt.filter((g) => g.orcado > 0).reduce((s, g) => s + g.orcado, 0);
    const realAnt = gruposAnt.filter((g) => g.orcado > 0).reduce((s, g) => s + g.realizado, 0);
    const dvAnt = variacao(realAnt, orcAnt);
    const top = [...gruposComOrcado].sort((a, b) => b.realizado - a.realizado).slice(0, 5);
    const corDesvio = (x: number | null) => (x === null ? COR.apoio : x > 10 ? COR.vermelho : x > 0 ? COR.amarelo : COR.verde);
    add(
      "orcamento",
      "Previsto x realizado",
      <SlidePadrao secao={`Previsto x realizado · ${mesFin}`} manchete={mancheteOrcamento(dv, orc, real)} icone={Calculator} fontes={fontes(["financeiro"], "desvio = (realizado − previsto) / previsto")}>
        <div style={{ display: "flex", gap: 26 }}>
          <div style={{ width: 230, display: "flex", flexDirection: "column", gap: 18 }}>
            {dvAnt !== null && anterior ? (
              <div>
                <p className="num" style={{ fontSize: 30, fontWeight: 700, color: corDesvio(dvAnt) }}>{formatarVariacao(dvAnt)}</p>
                <p style={{ fontSize: 11, color: COR.apoio }}>Desvio do orçamento — {mesCurto(anterior.competencia)}</p>
              </div>
            ) : null}
            <div>
              <p className="num" style={{ fontSize: 38, fontWeight: 700, color: corDesvio(dv) }}>{dv === null ? "—" : formatarVariacao(dv)}</p>
              <p style={{ fontSize: 11, color: COR.apoio }}>Desvio do orçamento — {mesFin}</p>
            </div>
            <div>
              <p className="num" style={{ fontSize: 26, fontWeight: 700, color: real > orc ? COR.vermelho : COR.verde }}>
                {real - orc >= 0 ? "+" : ""}
                {formatarMoedaMil(real - orc)}
              </p>
              <p style={{ fontSize: 11, color: COR.apoio }}>Realizado acima (+) ou abaixo (−) do previsto no mês</p>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <RotuloBloco>Previsto x realizado por grupo — {mesFin} (R$ mil)</RotuloBloco>
            <BarChart
              width={930}
              height={190}
              data={top.map((g) => ({ grupo: g.grupo.length > 26 ? `${g.grupo.slice(0, 24)}…` : g.grupo, Previsto: g.orcado / 1000, Realizado: g.realizado / 1000 }))}
              margin={{ top: 20, right: 4, left: 4, bottom: 0 }}
              barGap={2}
            >
              <CartesianGrid vertical={false} stroke={COR.linha} />
              <XAxis dataKey="grupo" tick={{ ...EIXO, fontSize: 10 }} interval={0} axisLine={{ stroke: COR.linha }} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => `R$ ${formatarNumero(v, 1)} mil`} />
              <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ fontSize: 11, top: -6 }} />
              <Bar dataKey="Previsto" fill={COR.azul} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                <LabelList dataKey="Previsto" position="top" style={{ ...ROTULO_BARRA, fontSize: 10 }} formatter={(v: number) => mil(v * 1000)} />
              </Bar>
              <Bar dataKey="Realizado" fill={COR.indigo} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                <LabelList dataKey="Realizado" position="top" style={{ ...ROTULO_BARRA, fontSize: 10 }} formatter={(v: number) => mil(v * 1000)} />
              </Bar>
            </BarChart>
            <RotuloBloco style={{ marginTop: 10 }}>Desvio por grupo e justificativa</RotuloBloco>
            <TabelaSlide
              linhas={[...gruposComOrcado].sort((a, b) => b.realizado - b.orcado - (a.realizado - a.orcado))}
              maxLinhas={5}
              alturaLinha={30}
              tamanho={10.5}
              colunas={[
                { titulo: "Grupo", largura: "26%", render: (g) => g.grupo },
                { titulo: "Previsto", largura: "12%", alinhar: "right", render: (g) => formatarMoedaMil(g.orcado) },
                { titulo: "Realizado", largura: "12%", alinhar: "right", render: (g) => formatarMoedaMil(g.realizado) },
                {
                  titulo: "Desvio",
                  largura: "10%",
                  alinhar: "right",
                  render: (g) => {
                    const x = variacao(g.realizado, g.orcado);
                    return <strong style={{ color: corDesvio(x) }}>{x === null ? "—" : formatarVariacao(x)}</strong>;
                  },
                },
                {
                  titulo: "Justificativa",
                  render: (g) =>
                    g.observacao ? g.observacao : (variacao(g.realizado, g.orcado) ?? 0) > 5 ? <span style={{ color: COR.vermelho }}>Pendente</span> : "—",
                },
              ]}
            />
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ----------------------------------- 8. financeiro: estrutura de custos */
  const gruposRealizados = d.financeiro.grupos.filter((g) => g.realizado > 0).sort((a, b) => b.realizado - a.realizado);
  if (gruposRealizados.length >= 3) {
    const total = gruposRealizados.reduce((s, g) => s + g.realizado, 0);
    const principais = gruposRealizados.slice(0, 7);
    const demais = gruposRealizados.slice(7).reduce((s, g) => s + g.realizado, 0);
    const linhas = [...principais.map((g) => ({ grupo: g.grupo, valor: g.realizado })), ...(demais ? [{ grupo: "Demais grupos", valor: demais }] : [])].map((l) => ({
      ...l,
      pct: (l.valor / total) * 100,
    }));
    const top3 = linhas.slice(0, 3).reduce((s, l) => s + l.pct, 0);
    add(
      "custos",
      "Estrutura de custos",
      <SlidePadrao secao={`Estrutura de custos · ${mesFin}`} manchete={`${linhas[0].grupo} responde por ${formatarNumero(linhas[0].pct, 0)}% da despesa; os três maiores grupos somam ${formatarNumero(top3, 0)}%.`} icone={IconePizza} fontes={fontes(["financeiro"], "despesas pagas no mês por grupo contábil")}>
        <div style={{ display: "flex", gap: 30 }}>
          <div style={{ width: 760 }}>
            <RotuloBloco>Composição das despesas — {mesFin} (R$ mil · % do total)</RotuloBloco>
            <BarChart width={760} height={Math.min(40 + linhas.length * 46, 420)} data={linhas} layout="vertical" margin={{ top: 4, right: 130, left: 8, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="grupo" width={250} tick={{ ...EIXO, fill: COR.navy }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" fill={COR.azul} radius={4} barSize={24} isAnimationActive={false}>
                <LabelList
                  dataKey="valor"
                  position="right"
                  style={ROTULO_BARRA}
                  content={(p) => {
                    const { x = 0, y = 0, width = 0, height = 0, index = 0 } = p as { x?: number; y?: number; width?: number; height?: number; index?: number };
                    const l = linhas[index];
                    return (
                      <text x={Number(x) + Number(width) + 8} y={Number(y) + Number(height) / 2 + 4} style={ROTULO_BARRA}>
                        {mil(l.valor)} · {formatarNumero(l.pct, 1)}%
                      </text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: COR.cartao, padding: 20 }}>
              <p className="num" style={{ fontSize: 32, fontWeight: 700, color: COR.navy }}>{formatarMoedaMil(total)}</p>
              <p style={{ fontSize: 12, color: COR.apoio }}>despesa total do mês</p>
            </div>
            <CaixaLeitura
              titulo="Concentração"
              topicos={[
                {
                  destaque: `3 grupos concentram ${formatarNumero(top3, 1)}%:`,
                  texto: `${linhas.slice(0, 3).map((l) => l.grupo.toLowerCase()).join(", ")} — foco natural das renegociações.`,
                },
              ]}
            />
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ------------------------------------- 9. arrecadação e inadimplência */
  const rubricas = d.juridico.inadimplencia.rubricas.filter((r) => totalRubrica(r) || r.ateAnterior || r.recebido);
  if (rubricas.length || d.financeiro.arrecadacao.emitido > 0 || d.juridico.acordos.length) {
    const total = inadimplenciaTotal(d);
    const anteriorInad = d.juridico.inadimplencia.rubricas.reduce((s, r) => s + r.ateAnterior, 0);
    const recebido = inadimplenciaRecebida(d);
    const taxa = taxaInadimplenciaMes(d);
    const acordosAtivos = d.juridico.acordos.filter((a) => a.parcelasPagas < a.parcelas);
    const leitura = leituraOuAutomatica(d.juridico.comentario, () => leituraInadimplencia(d));
    const inadimplenciaDoMesTotal = d.juridico.inadimplencia.rubricas.reduce((s, r) => s + r.doMes, 0);
    const taxaAnterior = anterior ? taxaInadimplenciaMes(anterior.dados) : null;
    const linhasArrecadacao = [
      ...(anterior && anterior.dados.financeiro.arrecadacao.emitido > 0 ? [{ comp: anterior.competencia, ...anterior.dados.financeiro.arrecadacao }] : []),
      { comp: compFin, ...d.financeiro.arrecadacao },
    ];
    const dadosRub = rubricas.map((r) => ({ rubrica: r.rubrica, total: totalRubrica(r) / 1000 })).sort((a, b) => b.total - a.total);
    add(
      "inadimplencia",
      "Arrecadação e inadimplência",
      <SlidePadrao
        manchete={manchete(leitura.topicos)}
        secao={`Arrecadação e inadimplência · ${mesFin}`}
        icone={Receipt}
        fontes={fontes(["juridico", "arrecadacao"], `taxa = em aberto do mês / emitido no mês; posição de inadimplência de ${mesFinExtenso}`)}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          <CartaoKpi rotulo="Inadimplência total" valor={formatarMoedaMil(total)} apoio={anteriorInad ? `anterior: ${formatarMoedaMil(anteriorInad)}` : "em aberto no fim do mês"} semaforo={ind.inadimplencia?.semaforo} altura={100} />
          <CartaoKpi
            rotulo={`Recuperado em ${mesFinExtenso}`}
            valor={formatarMoedaMil(recebido)}
            apoio={
              anteriorInad
                ? `conciliação: ${mil(anteriorInad)} − ${mil(recebido)} recuperado + ${mil(inadimplenciaDoMesTotal)} novos = ${formatarMoedaMil(total)}`
                : "pago de débitos antigos"
            }
            corValor={COR.verde}
            altura={100}
          />
          <CartaoKpi
            rotulo="Inadimplência do mês"
            valor={taxa === null ? "—" : `${formatarNumero(taxa, 1)}%`}
            apoio={
              taxa === null
                ? "arrecadação não informada"
                : `ordinária · ${mesCurto(compFin)}${taxaAnterior !== null ? ` · anterior: ${formatarNumero(taxaAnterior, 1)}%` : ""}`
            }
            semaforo={taxa === null ? undefined : taxa <= 3 ? "verde" : taxa <= 8 ? "amarelo" : "vermelho"}
            altura={100}
          />
          <CartaoKpi
            rotulo="Acordos em curso"
            valor={String(acordosAtivos.length)}
            apoio={acordosAtivos.length ? `${formatarMoedaMil(acordosAtivos.reduce((s, a) => s + a.valor - a.valorPago, 0))} a receber` : "nenhum acordo ativo"}
            corValor={COR.navy}
            altura={100}
          />
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 18 }}>
          <div style={{ width: 430 }}>
            <RotuloBloco>Saldo devedor por rubrica (R$ mil)</RotuloBloco>
            {dadosRub.length ? (
              <BarChart width={430} height={Math.min(30 + dadosRub.length * 46, 300)} data={dadosRub} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="rubrica" width={170} tick={{ ...EIXO, fill: COR.navy }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => `R$ ${formatarNumero(v, 1)} mil`} />
                <Bar dataKey="total" fill={COR.azul} radius={4} barSize={22} isAnimationActive={false}>
                  <LabelList dataKey="total" position="right" style={ROTULO_BARRA} formatter={(v: number) => formatarNumero(v, 1)} />
                </Bar>
              </BarChart>
            ) : (
              <Vazio>Sem inadimplência por rubrica.</Vazio>
            )}
          </div>
          <div style={{ flex: 1 }}>
            {acordosAtivos.length ? (
              <>
                <RotuloBloco>Acordos</RotuloBloco>
                <TabelaSlide
                  linhas={acordosAtivos}
                  maxLinhas={5}
                  alturaLinha={30}
                  tamanho={10.5}
                  colunas={[
                    { titulo: "Unidade", largura: "26%", render: (a) => a.unidade || a.devedor },
                    { titulo: "Parcelas", alinhar: "center", render: (a) => `${a.parcelasPagas} de ${a.parcelas}` },
                    { titulo: "Valor", alinhar: "right", render: (a) => formatarMoedaMil(a.valor) },
                    { titulo: "Pago", alinhar: "right", render: (a) => formatarMoedaMil(a.valorPago) },
                  ]}
                />
              </>
            ) : d.financeiro.arrecadacao.emitido > 0 ? (
              <>
                <RotuloBloco>Arrecadação da conta ordinária</RotuloBloco>
                <TabelaSlide
                  linhas={linhasArrecadacao}
                  colunas={[
                    { titulo: "Competência", render: (a) => mesTitulo(a.comp) },
                    { titulo: "Emitido", alinhar: "right", render: (a) => formatarMoeda(a.emitido) },
                    { titulo: "Recebido", alinhar: "right", render: (a) => formatarMoeda(a.recebido) },
                    { titulo: "Em aberto", alinhar: "right", render: (a) => formatarMoeda(Math.max(a.emitido - a.recebido, 0)) },
                    {
                      titulo: "Taxa",
                      alinhar: "right",
                      render: (a) => (a.emitido > 0 ? `${formatarNumero((Math.max(a.emitido - a.recebido, 0) / a.emitido) * 100, 1)}%` : "—"),
                    },
                  ]}
                />
              </>
            ) : null}
            <CaixaLeitura topicos={leitura.topicos} automatica={leitura.automatica} style={{ marginTop: 14 }} tamanho={12} />
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ------------------------------------------------------ 10. utilidades */
  const utilidades = d.utilidades.linhas.filter((u) => u.consumo > 0 || u.fatura > 0);
  if (utilidades.length) {
    const nomes = utilidades.slice(0, 2).map((u) => u.utilidade);
    const dadosFatura = serie.map((r) => {
      const linha: Record<string, string | number> = { mes: mesCurto(r.competencia) };
      nomes.forEach((n) => {
        const u = r.dados.utilidades.linhas.find((x) => x.utilidade === n);
        linha[n] = (u?.fatura ?? 0) / 1000;
      });
      return linha;
    });
    add(
      "utilidades",
      "Utilidades",
      <SlidePadrao secao="Gestão de utilidades" icone={Zap} fontes={fontes(["utilidades"], "faturas das concessionárias")}>
        <div style={{ display: "flex", gap: 22 }}>
          <div style={{ width: 560, display: "flex", flexDirection: "column", gap: 16 }}>
            {utilidades.slice(0, 3).map((u) => {
              const v = variacaoConsumo(u);
              const s: Semaforo = v === null ? "amarelo" : v > 25 ? "vermelho" : v > 10 ? "amarelo" : "verde";
              return (
                <div key={u.id} style={{ background: COR.cartao, padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <RotuloBloco style={{ marginBottom: 6 }}>{u.utilidade}</RotuloBloco>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: corSemaforo(s), fontWeight: 600 }}>
                      <Ponto semaforo={s} tamanho={9} />
                      {v === null ? "sem base de comparação" : `${formatarVariacao(v)} vs. mês anterior`}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 40 }}>
                    <div>
                      <p className="num" style={{ fontSize: 24, fontWeight: 700, color: COR.azul }}>
                        {formatarNumero(u.consumo)} {u.unidade}
                      </p>
                      <p style={{ fontSize: 10.5, color: COR.apoio }}>consumo · {mesCurto(competencia)}</p>
                    </div>
                    <div>
                      <p className="num" style={{ fontSize: 24, fontWeight: 700, color: COR.navy }}>{formatarMoedaMil(u.fatura)}</p>
                      <p style={{ fontSize: 10.5, color: COR.apoio }}>valor da fatura</p>
                    </div>
                    {u.consumo > 0 && u.fatura > 0 ? (
                      <div>
                        <p className="num" style={{ fontSize: 16, fontWeight: 700, color: COR.navy, marginTop: 6 }}>
                          R$ {formatarNumero(u.fatura / u.consumo, 2)}/{u.unidade}
                        </p>
                        <p style={{ fontSize: 10.5, color: COR.apoio }}>custo unitário</p>
                      </div>
                    ) : null}
                  </div>
                  {u.observacao ? <p style={{ fontSize: 10.5, color: COR.apoio, marginTop: 6 }}>{u.observacao}</p> : null}
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1 }}>
            <RotuloBloco>Valor mensal por utilidade (R$ mil)</RotuloBloco>
            {serie.length >= 2 ? (
              <BarChart width={620} height={360} data={dadosFatura} margin={{ top: 22, right: 4, left: 4, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={COR.linha} />
                <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: COR.linha }} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => `R$ ${formatarNumero(v, 1)} mil`} />
                <Legend verticalAlign="top" iconType="square" wrapperStyle={{ fontSize: 11, top: -4 }} />
                {nomes.map((n, i) => (
                  <Bar key={n} dataKey={n} fill={i === 0 ? COR.azul : COR.indigo} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey={n} position="top" style={ROTULO_BARRA} formatter={(v: number) => (v ? formatarNumero(v, 1) : "")} />
                  </Bar>
                ))}
              </BarChart>
            ) : (
              <Vazio>A tendência aparece a partir do segundo mês com relatório no sistema.</Vazio>
            )}
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ------------------------------------------------------- 11. contratos */
  if (d.contratos.linhas.length) {
    const ctr = contarContratos(d, hoje);
    const linhas = d.contratos.linhas
      .map((c) => ({ c, s: situacaoContrato(c, hoje) }))
      .sort((a, b) => {
        const ordem = { vencido: 0, em_renovacao: 1, vigente: 2 } as const;
        return ordem[a.s.situacao] - ordem[b.s.situacao] || (a.s.diasRestantes ?? 99_999) - (b.s.diasRestantes ?? 99_999);
      });
    const renovar = linhas.filter((l) => l.s.situacao === "em_renovacao");
    const leitura = leituraOuAutomatica(d.contratos.comentario, () => leituraContratos(d, hoje));
    add(
      "contratos",
      "Contratos",
      <SlidePadrao secao="Contratos" manchete={manchete(leitura.topicos)} icone={Handshake} fontes={fontes(["contratos"], "vigência mais recente por fornecedor")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          <CartaoKpi rotulo="Contratos analisados" valor={String(d.contratos.linhas.length)} apoio="cadastro do empreendimento" corValor={COR.navy} altura={96} />
          <CartaoKpi rotulo="Vencidos no cadastro" valor={String(ctr.vencidos)} apoio="data de término no sistema · situação a validar" semaforo={ctr.vencidos ? "vermelho" : "verde"} altura={96} />
          <CartaoKpi rotulo="Renovação em até 120 dias" valor={String(ctr.emRenovacao)} apoio={renovar.slice(0, 3).map((r) => r.c.fornecedor).join(", ") || "nenhuma no período"} semaforo={ctr.emRenovacao ? "amarelo" : "verde"} altura={96} />
          <CartaoKpi rotulo="Vigentes" valor={String(ctr.vigentes)} apoio="com mais de 120 dias de prazo" semaforo="verde" corValor={COR.azul} altura={96} />
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 18 }}>
          <div style={{ flex: 1 }}>
            <TabelaSlide
              linhas={linhas}
              maxLinhas={leitura.topicos.length ? 7 : 8}
              alturaLinha={30}
              tamanho={10.5}
              colunas={[
                { titulo: "Fornecedor", largura: "26%", render: (l) => l.c.fornecedor },
                { titulo: "Objeto", largura: "34%", render: (l) => l.c.objeto || "—" },
                { titulo: "Término", largura: "12%", render: (l) => (l.c.vencimento ? formatarData(l.c.vencimento) : "Indeterminado") },
                {
                  titulo: "Situação",
                  render: (l) => (
                    <strong style={{ color: l.s.situacao === "vencido" ? COR.vermelho : l.s.situacao === "em_renovacao" ? COR.amarelo : COR.verde }}>
                      {l.s.situacao === "vencido" ? "Vencido" : l.s.situacao === "em_renovacao" ? `Renovar (${l.s.diasRestantes} dias)` : "Vigente"}
                    </strong>
                  ),
                },
              ]}
            />
          </div>
          {leitura.topicos.length ? <CaixaLeitura topicos={leitura.topicos} automatica={leitura.automatica} style={{ width: 330 }} tamanho={12} /> : null}
        </div>
      </SlidePadrao>,
    );
  }

  /* ------------------------------------------------------- 12. documentos */
  if (d.documentos.linhas.some((l) => l.validade || l.permanente)) {
    const c = contarDocumentos(d, hoje);
    const fatias = [
      { nome: "Vigentes", valor: c.vigentes, cor: COR.verde, apoio: `mais de ${DIAS_ALERTA_DOCUMENTO} dias` },
      { nome: "Permanentes", valor: c.permanentes, cor: COR.navy, apoio: "sem vencimento" },
      { nome: "A vencer", valor: c.aVencer, cor: COR.amarelo, apoio: `em até ${DIAS_ALERTA_DOCUMENTO} dias` },
      { nome: "Vencidos", valor: c.vencidos, cor: COR.vermelho, apoio: "regularizar" },
      { nome: "Sem data", valor: c.semData, cor: "#B9BCCB", apoio: "cadastrar validade" },
    ].filter((f) => f.valor > 0);
    const agenda = d.documentos.linhas
      .map((l) => ({ l, s: situacaoDocumento(l, hoje) }))
      .filter((x) => x.s.rotulo === "Vencido" || x.s.rotulo === "A vencer")
      .sort((a, b) => (a.s.diasRestantes ?? 0) - (b.s.diasRestantes ?? 0));
    add(
      "documentos",
      "Documentos legais",
      <SlidePadrao secao="Documentos legais e compliance" manchete={manchete(leituraDocumentos(d, hoje))} icone={FileText} fontes={fontes(["documentos"], `prazo contado a partir de ${formatarData(hoje.toISOString())}; "em dia" = vigentes + permanentes`)}>
        <div style={{ display: "flex", gap: 30 }}>
          <div style={{ width: 300 }}>
            <RotuloBloco>Situação dos {c.total} documentos cadastrados</RotuloBloco>
            <div style={{ position: "relative", width: 260, height: 240, margin: "0 auto" }}>
              <PieChart width={260} height={240}>
                <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius={78} outerRadius={118} startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                  {fatias.map((f) => (
                    <Cell key={f.nome} fill={f.cor} />
                  ))}
                </Pie>
              </PieChart>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <p className="num" style={{ fontSize: 30, fontWeight: 700, color: COR.navy }}>
                  {c.percentualEmDia === null ? "—" : `${formatarNumero(c.percentualEmDia, 0)}%`}
                </p>
                <p style={{ fontSize: 11, color: COR.apoio }}>em dia</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14 }}>
              {fatias.map((f) => (
                <ItemLegenda key={f.nome} cor={f.cor} rotulo={f.nome} apoio={f.apoio} valor={String(f.valor)} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <RotuloBloco>Agenda de regularização e renovação</RotuloBloco>
            {agenda.length ? (
              <TabelaSlide
                linhas={agenda}
                maxLinhas={9}
                alturaLinha={40}
                tamanho={10.5}
                colunas={[
                  { titulo: "Documento", largura: "36%", render: (x) => x.l.documento },
                  { titulo: "Validade", largura: "12%", render: (x) => formatarData(x.l.validade) },
                  { titulo: "Prazo", largura: "10%", render: (x) => (x.s.rotulo === "Vencido" ? "Vencido" : `${x.s.diasRestantes} dias`) },
                  {
                    titulo: "Status",
                    largura: "10%",
                    render: (x) => <strong style={{ color: x.s.rotulo === "Vencido" ? COR.vermelho : COR.amarelo }}>{x.s.rotulo === "Vencido" ? "Vencido" : "Renovar"}</strong>,
                  },
                  { titulo: "Providência", render: (x) => x.l.observacao || <span style={{ color: COR.fraco }}>definir</span> },
                ]}
              />
            ) : (
              <Vazio>Nenhum documento vencido ou vencendo nos próximos {DIAS_ALERTA_DOCUMENTO} dias.</Vazio>
            )}
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ---------------------------------------------- 13. operação (frentes) */
  if (d.operacao.ocorrencias.length) {
    const concluidas = d.operacao.ocorrencias.filter((o) => o.concluida).length;
    const pendentes = d.operacao.ocorrencias.filter((o) => !o.concluida);
    add(
      "operacao",
      "Operação e manutenção",
      <SlidePadrao secao="Operação e manutenção" icone={Wrench} fontes={fontes([], "relatórios dos fornecedores e evolução das tratativas do mês")}>
        <div style={{ display: "flex", gap: 22 }}>
          <div style={{ flex: 1 }}>
            <RotuloBloco>Frentes operacionais — {mes}</RotuloBloco>
            <TabelaSlide
              linhas={d.operacao.ocorrencias}
              maxLinhas={9}
              alturaLinha={40}
              tamanho={10.5}
              colunas={[
                { titulo: "Frente", largura: "20%", render: (o) => o.ocorrencia },
                { titulo: "Ação executada", largura: "40%", render: (o) => o.acao },
                { titulo: "Resultado", render: (o) => o.resultado || "—" },
                {
                  titulo: "Status",
                  largura: "13%",
                  render: (o) => <strong style={{ color: o.concluida ? COR.verde : COR.amarelo }}>{o.concluida ? "Concluído" : "Acompanhamento"}</strong>,
                },
              ]}
            />
          </div>
          <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: COR.cartao, padding: 18 }}>
              <RotuloBloco style={{ marginBottom: 4 }}>Frentes concluídas</RotuloBloco>
              <p className="num" style={{ fontSize: 36, fontWeight: 700, color: COR.azul }}>
                {concluidas}/{d.operacao.ocorrencias.length}
              </p>
              {pendentes.length ? <p style={{ fontSize: 11, color: COR.apoio }}>{pendentes.map((p) => p.ocorrencia).slice(0, 2).join(", ")} em acompanhamento</p> : null}
            </div>
            {d.operacao.comentario.trim() ? <CaixaLeitura titulo="Entregas e tratativas" topicos={comentarioParaTopicos(d.operacao.comentario)} tamanho={12} style={{ flex: 1 }} /> : null}
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* -------------------------------------------- 14. ordens de serviço */
  if (totalOS(d) > 0 || totalManutencoes(d) > 0) {
    const s = d.operacao.situacaoOS;
    const total = totalOS(d);
    const noPrazo = percentualOSNoPrazo(d);
    const canc = percentualOSCanceladas(d);
    const fatias = [
      { nome: "Concluída no prazo", valor: s.concluidasNoPrazo, cor: COR.verde },
      { nome: "Concluída com atraso", valor: s.concluidasComAtraso, cor: COR.amarelo },
      { nome: "Aberta atrasada", valor: s.abertasAtrasadas, cor: COR.vermelho },
      { nome: "Aberta no prazo", valor: s.abertasNoPrazo, cor: COR.azul },
      { nome: "Cancelada", valor: s.canceladas, cor: "#9A9DB0" },
    ].filter((f) => f.valor > 0);
    const r = d.operacao.resumo;
    const leitura = leituraOS(d);
    const disciplinas = d.operacao.disciplinas.filter((x) => x.quantidade > 0).sort((a, b) => b.quantidade - a.quantidade).slice(0, 7);
    add(
      "os",
      "Ordens de serviço",
      <SlidePadrao secao="Ordens de serviço" manchete={manchete(leitura)} icone={ClipboardList} fontes={fontes(["os", "operacao"], "painel de OS do sistema")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          {total > 0 ? (
            <>
              <CartaoKpi icone={ClipboardList} rotulo="OS no período" valor={formatarNumero(total)} apoio={`${formatarNumero(r.preventivas)} preventivas · ${formatarNumero(r.corretivas)} corretivas`} corValor={COR.azul} altura={100} />
              <CartaoKpi icone={CheckCircle2} rotulo="Concluídas no prazo" valor={noPrazo === null ? "—" : `${formatarNumero(noPrazo, 1)}%`} apoio={`${formatarNumero(s.concluidasNoPrazo)} de ${formatarNumero(s.concluidasNoPrazo + s.concluidasComAtraso)} concluídas`} semaforo={ind.operacao?.semaforo} altura={100} />
              <CartaoKpi icone={AlertTriangle} rotulo="Backlog atrasado" valor={formatarNumero(s.abertasAtrasadas)} apoio="OS abertas fora do prazo" semaforo={s.abertasAtrasadas === 0 ? "verde" : s.abertasAtrasadas <= total * 0.05 ? "amarelo" : "vermelho"} altura={100} />
              <CartaoKpi icone={Ban} rotulo="Canceladas" valor={canc === null ? "—" : `${formatarNumero(canc, 1)}%`} apoio={`${formatarNumero(s.canceladas)} OS`} semaforo={canc === null ? undefined : canc < 10 ? "verde" : canc < 20 ? "amarelo" : "vermelho"} altura={100} />
            </>
          ) : (
            <>
              <CartaoKpi rotulo="Preventivas" valor={formatarNumero(r.preventivas)} corValor={COR.azul} altura={100} />
              <CartaoKpi rotulo="Corretivas" valor={formatarNumero(r.corretivas)} corValor={COR.navy} altura={100} />
              <CartaoKpi rotulo="Acompanhamentos e rondas" valor={formatarNumero(r.acompanhamentos + r.rondas)} corValor={COR.navy} altura={100} />
              <CartaoKpi rotulo="Não realizadas" valor={formatarNumero(r.naoRealizadas)} semaforo={r.naoRealizadas ? "amarelo" : "verde"} altura={100} />
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 18 }}>
          {fatias.length ? (
            <div style={{ width: 560, display: "flex", gap: 20 }}>
              <div style={{ position: "relative", width: 250, height: 250 }}>
                <PieChart width={250} height={250}>
                  <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius={78} outerRadius={120} startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                    {fatias.map((f) => (
                      <Cell key={f.nome} fill={f.cor} />
                    ))}
                  </Pie>
                </PieChart>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <p className="num" style={{ fontSize: 26, fontWeight: 700, color: COR.navy }}>{formatarNumero(total)}</p>
                  <p style={{ fontSize: 11, color: COR.apoio }}>OS</p>
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
                <RotuloBloco style={{ marginBottom: 0 }}>Distribuição por situação</RotuloBloco>
                {fatias.map((f) => (
                  <ItemLegenda key={f.nome} cor={f.cor} rotulo={f.nome} apoio={`${formatarNumero((f.valor / total) * 100, 1)}% do total`} valor={formatarNumero(f.valor)} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{ width: 560 }}>
              <RotuloBloco>Manutenções por disciplina</RotuloBloco>
              <BarChart width={560} height={Math.min(30 + disciplinas.length * 40, 300)} data={disciplinas} layout="vertical" margin={{ top: 4, right: 50, left: 8, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="disciplina" width={150} tick={{ ...EIXO, fill: COR.navy }} axisLine={false} tickLine={false} />
                <Bar dataKey="quantidade" fill={COR.azul} radius={4} barSize={20} isAnimationActive={false}>
                  <LabelList dataKey="quantidade" position="right" style={ROTULO_BARRA} />
                </Bar>
              </BarChart>
            </div>
          )}
          <CaixaLeitura topicos={leitura} automatica style={{ flex: 1, minHeight: 250 }} tamanho={12.5} />
        </div>
      </SlidePadrao>,
    );
  }

  /* ---------------------------------------------------- 15. fornecedores */
  if (d.fornecedores.linhas.length) {
    add(
      "fornecedores",
      "Fornecedores e SLA",
      <SlidePadrao secao="Fornecedores e SLA" icone={Truck} fontes={fontes([], "relatórios mensais dos fornecedores")}>
        <TabelaSlide
          linhas={d.fornecedores.linhas}
          maxLinhas={10}
          colunas={[
            { titulo: "Fornecedor", largura: "26%", render: (f) => f.fornecedor },
            { titulo: "Disciplina", largura: "22%", render: (f) => f.disciplina },
            { titulo: "Entregue no mês", alinhar: "right", render: (f) => `${formatarNumero(f.realizado)} ${f.unidade}` },
            {
              titulo: "SLA",
              alinhar: "right",
              render: (f) => <strong style={{ color: f.sla >= 95 ? COR.verde : f.sla >= 85 ? COR.amarelo : COR.vermelho }}>{f.sla ? `${formatarNumero(f.sla, 0)}%` : "—"}</strong>,
            },
            { titulo: "Criticidade", alinhar: "center", render: (f) => (f.criticidade === "media" ? "Média" : f.criticidade === "alta" ? "Alta" : "Baixa") },
          ]}
        />
        {d.fornecedores.comentario.trim() ? <CaixaLeitura topicos={comentarioParaTopicos(d.fornecedores.comentario)} style={{ marginTop: 16 }} tamanho={12} /> : null}
      </SlidePadrao>,
    );
  }

  /* ------------------------------------------------ 15b. suprimentos */
  if (d.suprimentos.pedidos.length) {
    const pedidos = d.suprimentos.pedidos;
    const total = pedidos.reduce((s, p) => s + p.valor, 0);
    const finalizados = pedidos.filter((p) => /finaliz|entreg|conclu/i.test(p.status)).length;
    const emOrcamento = pedidos.filter((p) => /or[cç]amento|cota/i.test(p.status)).length;
    // pedido em curso com prazo vencido no fim do mês do RGM
    const fimMes = new Date(Number(competencia.slice(0, 4)), Number(competencia.slice(5, 7)), 0).toISOString().slice(0, 10);
    const atrasados = pedidos.filter((p) => p.prazo && p.prazo < fimMes && !/finaliz|entreg|conclu|cancel/i.test(p.status)).length;
    const ordenados = [...pedidos].sort((a, b) => b.valor - a.valor);
    add(
      "suprimentos",
      "Suprimentos e compras",
      <SlidePadrao secao={`Suprimentos e compras · ${mes}`} icone={ShoppingCart} fontes={fontes(["suprimentos"], "lista de pedidos de compra do mês")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <CartaoKpi icone={ShoppingCart} rotulo="Pedidos no mês" valor={formatarNumero(pedidos.length)} corValor={COR.navy} altura={88} />
          <CartaoKpi icone={CircleDollarSign} rotulo="Valor aprovado" valor={formatarMoedaMil(total)} corValor={COR.azul} altura={88} />
          <CartaoKpi icone={BadgeCheck} rotulo="Finalizados" valor={formatarNumero(finalizados)} corValor={COR.navy} altura={88} />
          <CartaoKpi
            icone={AlertTriangle}
            rotulo="Em curso com prazo vencido"
            valor={formatarNumero(atrasados)}
            apoio={emOrcamento ? `${emOrcamento} ainda em orçamento` : undefined}
            semaforo={atrasados ? "amarelo" : "verde"}
            altura={88}
          />
        </div>
        <div style={{ marginTop: 18 }}>
          <TabelaSlide
            linhas={ordenados}
            maxLinhas={8}
            colunas={[
              { titulo: "Pedido", largura: "9%", render: (p) => p.pedido },
              { titulo: "Categoria", largura: "22%", render: (p) => p.categoria || "—" },
              { titulo: "Grupo contábil", largura: "24%", render: (p) => p.grupo || "—" },
              { titulo: "Status", render: (p) => p.status || "—" },
              { titulo: "Prazo", alinhar: "center", render: (p) => (p.prazo ? formatarData(p.prazo) : "—") },
              { titulo: "Valor aprovado", alinhar: "right", render: (p) => (p.valor ? formatarMoeda(p.valor) : "—") },
            ]}
          />
        </div>
        {d.suprimentos.comentario.trim() ? <CaixaLeitura topicos={comentarioParaTopicos(d.suprimentos.comentario)} style={{ marginTop: 14 }} tamanho={12} /> : null}
      </SlidePadrao>,
    );
  }

  /* ------------------------------------------- 16. registro fotográfico */
  if (d.fotos.length) {
    const fotos = d.fotos.slice(0, 6);
    add(
      "fotos",
      "Registro fotográfico",
      <SlidePadrao secao="Registro fotográfico" icone={Camera} fontes={fontes([], "relatórios fotográficos dos fornecedores e vistorias da gestão")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(2, 1fr)", gap: 16, height: "100%" }}>
          {fotos.map((f, i) => (
            <figure key={f.id} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0, background: COR.cartao, overflow: "hidden" }}>
                {ctx.urlsFotos[f.path] ? (
                  <img src={ctx.urlsFotos[f.path]} alt={f.legenda || `Registro ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
              </div>
              <figcaption style={{ fontSize: 11, fontWeight: 600, color: COR.navy, marginTop: 6, lineHeight: 1.3 }}>{f.legenda || "Registro do mês"}</figcaption>
            </figure>
          ))}
        </div>
      </SlidePadrao>,
    );
  }

  /* ------------------------------------------- 17. jurídico e certidões */
  const certidoesInformadas = d.juridico.certidoes.some((c) => c.validade || c.positiva);
  if (d.juridico.processos.length || certidoesInformadas) {
    const risco = riscoJuridico(d);
    const cert = contarCertidoes(d, hoje);
    const tipos = Object.entries(
      d.juridico.processos.reduce<Record<string, number>>((acc, p) => {
        const t = (p.tipo || "não classificado").toLowerCase();
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([t, n]) => `${n} ${t}${n > 1 && !t.endsWith("s") ? "s" : ""}`)
      .join(" · ");
    const PROG: Record<string, { rotulo: string; cor: string }> = {
      provavel: { rotulo: "Provável", cor: COR.vermelho },
      possivel: { rotulo: "Possível", cor: COR.amarelo },
      remoto: { rotulo: "Remoto", cor: COR.verde },
      nao_apurado: { rotulo: "Não apurado", cor: COR.amarelo },
    };
    const corCert = { regular: COR.verde, vencida: COR.vermelho, positiva: COR.vermelho, nao_informada: "#9A9DB0" } as const;
    add(
      "juridico",
      "Jurídico e certidões",
      <SlidePadrao
        secao="Jurídico · diligência e certidões"
        icone={Gavel}
        fontes={fontes([], "posição jurídica informada pelo escritório responsável; certidões emitidas nos portais oficiais")}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          <CartaoKpi rotulo="Processos ativos" valor={String(d.juridico.processos.length)} apoio={tipos || "nenhum processo em acompanhamento"} corValor={COR.azul} altura={100} />
          <CartaoKpi
            rotulo="Risco provável"
            valor={risco.provavel === null ? "Não apurado" : formatarMoedaMil(risco.provavel)}
            apoio={risco.semApuracao ? `${risco.semApuracao} processo(s) sem valor ou prognóstico do escritório` : "soma do valor da causa"}
            semaforo={risco.provavel === null ? (d.juridico.processos.length ? "amarelo" : undefined) : risco.provavel > 0 ? "vermelho" : "verde"}
            corValor={risco.provavel === null ? COR.fraco : undefined}
            altura={100}
          />
          <CartaoKpi
            rotulo="Risco possível"
            valor={risco.possivel === null ? "Não apurado" : formatarMoedaMil(risco.possivel)}
            apoio={risco.possivel === null ? "aguarda valor da causa e prognóstico" : "soma do valor da causa"}
            corValor={risco.possivel === null ? COR.fraco : COR.navy}
            altura={100}
          />
          <CartaoKpi
            rotulo="Certidões regulares"
            valor={`${cert.regulares} de ${cert.total}`}
            apoio={cert.pendentes.length ? `${cert.pendentes.map((p) => p.split(" ")[0]).join(", ")} pendente(s)` : "todas regulares e válidas"}
            semaforo={cert.regulares === cert.total ? "verde" : cert.regulares === 0 ? "vermelho" : "amarelo"}
            altura={100}
          />
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 18 }}>
          <div style={{ flex: 1 }}>
            <RotuloBloco>Processos em acompanhamento{d.juridico.escritorio ? ` · ${d.juridico.escritorio}` : ""}</RotuloBloco>
            {d.juridico.processos.length ? (
              <TabelaSlide
                linhas={d.juridico.processos}
                maxLinhas={5}
                alturaLinha={38}
                tamanho={10.5}
                colunas={[
                  { titulo: "Processo", largura: "20%", render: (p) => p.numero || <span style={{ color: COR.fraco }}>a validar</span> },
                  { titulo: "Tipo", largura: "13%", render: (p) => p.tipo || "—" },
                  { titulo: "Parte / objeto", largura: "26%", render: (p) => p.objeto },
                  { titulo: "Valor", largura: "12%", render: (p) => ((p.valor ?? 0) > 0 ? formatarMoedaMil(p.valor!) : "Não apurado") },
                  {
                    titulo: "Prognóstico",
                    largura: "13%",
                    render: (p) => {
                      const g = PROG[p.prognostico ?? "nao_apurado"];
                      return <strong style={{ color: g.cor }}>{g.rotulo}</strong>;
                    },
                  },
                  { titulo: "Situação", render: (p) => p.andamento || <span style={{ color: COR.fraco }}>a validar</span> },
                ]}
              />
            ) : (
              <Vazio>Nenhum processo em andamento nesta competência.</Vazio>
            )}
            {d.juridico.comentario.trim() ? (
              <div style={{ marginTop: 10 }}>
                {comentarioParaTopicos(d.juridico.comentario).map((t, i) => (
                  <p key={i} style={{ fontSize: 11, lineHeight: 1.4, color: "#2B2D45" }}>
                    {t.destaque ? <strong style={{ color: COR.navy }}>{t.destaque} </strong> : null}
                    {t.texto}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ width: 436, background: COR.navy, color: "#fff", padding: "16px 20px" }}>
            <RotuloBloco cor={COR.ciano} style={{ marginBottom: 12 }}>
              Certidões do condomínio
            </RotuloBloco>
            {d.juridico.certidoes.map((c) => {
              const st = situacaoCertidao(c, hoje);
              return (
                <div key={c.id} style={{ display: "flex", gap: 12, padding: "8px 0" }}>
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: corCert[st], marginTop: 3, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 700 }}>{c.certidao}</p>
                    <p style={{ fontSize: 10.5, opacity: 0.75 }}>{c.orgao}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {st === "nao_informada" ? "Não informada" : st === "positiva" ? "Positiva" : st === "vencida" ? `Vencida ${formatarData(c.validade)}` : `Até ${formatarData(c.validade)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ---------------------------------------------------------- 18. CAPEX */
  if (d.capex.linhas.length) {
    const orc = d.capex.linhas.reduce((s, c) => s + c.orcado, 0);
    const real = d.capex.linhas.reduce((s, c) => s + c.realizado, 0);
    add(
      "capex",
      "Investimentos",
      <SlidePadrao secao="CAPEX e melhorias" icone={Hammer} fontes={fontes([], "propostas aprovadas e medições dos fornecedores")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          <CartaoKpi icone={Wallet} rotulo="Orçado" valor={formatarMoedaMil(orc)} corValor={COR.navy} altura={90} />
          <CartaoKpi icone={CircleDollarSign} rotulo="Realizado" valor={formatarMoedaMil(real)} corValor={COR.azul} altura={90} />
          <CartaoKpi icone={BarChart3} rotulo="Desvio" valor={variacao(real, orc) === null ? "—" : formatarVariacao(variacao(real, orc)!)} semaforo={ind.capex?.semaforo} altura={90} />
        </div>
        <div style={{ marginTop: 18 }}>
          <TabelaSlide
            linhas={d.capex.linhas}
            maxLinhas={8}
            colunas={[
              { titulo: "Iniciativa", largura: "28%", render: (c) => c.iniciativa },
              { titulo: "Orçado", alinhar: "right", render: (c) => formatarMoeda(c.orcado) },
              { titulo: "Realizado", alinhar: "right", render: (c) => formatarMoeda(c.realizado) },
              { titulo: "Status", render: (c) => (c.status === "em_andamento" ? "Em andamento" : c.status === "concluido" ? "Concluído" : "Planejado") },
              { titulo: "Benefício esperado", largura: "30%", render: (c) => c.beneficio || "—" },
            ]}
          />
        </div>
      </SlidePadrao>,
    );
  }

  /* ------------------------------------------------- 18b. valor gerado */
  {
    const recuperado = inadimplenciaRecebida(d);
    const linhas = [...d.valorGerado.linhas.filter((v) => v.valor > 0)];
    // Sem lançamento manual, a inadimplência recuperada já é valor realizado comprovado em caixa.
    if (!linhas.some((v) => v.tipo === "realizado") && recuperado > 0) {
      linhas.unshift({ id: "auto-inad", tipo: "realizado", valor: recuperado, descricao: `inadimplência recuperada em ${mesFinExtenso}/${compFin.slice(0, 4)}`, observacao: "" });
    }
    if (linhas.length) {
      const doTipo = (t: string) => linhas.filter((v) => v.tipo === t);
      const Cartao = ({ tipo, titulo, legenda, estilo }: { tipo: string; titulo: string; legenda: string; estilo: React.CSSProperties }) => {
        const itens = doTipo(tipo);
        const escuro = estilo.background === COR.navy;
        return (
          <div style={{ flex: 1, borderRadius: 12, padding: "16px 22px", display: "flex", flexDirection: "column", ...estilo }}>
            <p style={{ fontSize: 10.5 }}>
              <strong style={{ color: escuro ? COR.ciano : tipo === "projetado" ? COR.apoio : COR.azul }}>{titulo.toUpperCase()}</strong>
              <span style={{ marginLeft: 8, opacity: 0.8 }}>{legenda}</span>
            </p>
            {itens.length ? (
              <>
                <p className="num" style={{ fontSize: 34, fontWeight: 700, marginTop: 18, color: escuro ? "#fff" : COR.navy }}>
                  {formatarMoedaMil(itens[0].valor)}
                  {itens[0].periodicidade ?? ""}
                </p>
                <p style={{ fontSize: 12.5, opacity: 0.9 }}>{itens[0].descricao}</p>
                <div style={{ borderTop: `1px solid ${escuro ? "rgba(255,255,255,0.2)" : COR.linha}`, marginTop: 24, paddingTop: 14, fontSize: 11.5, lineHeight: 1.45 }}>
                  {itens[0].observacao ? <p>{itens[0].observacao}</p> : null}
                  {itens.slice(1, 4).map((v) => (
                    <p key={v.id} style={{ marginTop: 4 }}>
                      <strong>
                        {formatarMoedaMil(v.valor)}
                        {v.periodicidade ?? ""}
                      </strong>{" "}
                      {v.descricao}
                    </p>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, opacity: 0.6, marginTop: 18 }}>Nada a reportar nesta competência.</p>
            )}
          </div>
        );
      };
      const investidos = doTipo("investido");
      add(
        "valor",
        "Valor gerado no período",
        <SlidePadrao secao="Valor gerado no período" icone={Gem} fontes={fontes(["juridico"], "classificação realizado / estimado / projetado conforme critério RPS")}>
          <div style={{ display: "flex", gap: 28, height: investidos.length ? 360 : 440 }}>
            <Cartao tipo="realizado" titulo="Realizado" legenda="comprovado em caixa / campo" estilo={{ background: COR.navy, color: "#fff" }} />
            <Cartao tipo="estimado" titulo="Estimado" legenda="informado por terceiro, não auditado" estilo={{ background: COR.cartao, color: "#2B2D45" }} />
            <Cartao tipo="projetado" titulo="Projetado" legenda="depende de aprovação" estilo={{ border: "1.5px dashed #A9ACBF", color: "#2B2D45" }} />
          </div>
          {investidos.length ? (
            <div style={{ marginTop: 20, border: `1px solid ${COR.linha}`, borderRadius: 10, padding: "14px 22px", display: "flex", alignItems: "center", gap: 40 }}>
              <RotuloBloco style={{ marginBottom: 0, width: 150 }}>Investido no ativo</RotuloBloco>
              {investidos.slice(0, 3).map((v) => (
                <p key={v.id} style={{ fontSize: 12.5, color: COR.apoio }}>
                  <strong className="num" style={{ fontSize: 20, color: COR.navy }}>
                    {formatarMoedaMil(v.valor)}
                  </strong>{" "}
                  {v.descricao}
                </p>
              ))}
            </div>
          ) : null}
        </SlidePadrao>,
      );
    }
  }

  /* ------------------------------------- 19. plano de ação e matriz de riscos */
  if (d.riscos.linhas.length) {
    const ordem = { alta: 0, media: 1, baixa: 2 } as const;
    const plano = resumoPlanoAcao(d);
    const fatias = [
      { nome: "Concluídas", valor: plano.concluidas, cor: COR.verde },
      { nome: "Em andamento", valor: plano.emAndamento, cor: COR.amarelo },
      { nome: "Outras situações", valor: plano.outras, cor: "#D5D7E0" },
    ].filter((f) => f.valor > 0);
    const abertas = d.riscos.linhas.filter((r) => r.status !== "concluida").sort((a, b) => ordem[a.criticidade] - ordem[b.criticidade]);
    const altasEmCurso = abertas.filter((r) => r.criticidade === "alta");
    add(
      "riscos",
      "Plano de ação e riscos",
      <SlidePadrao secao="Plano de ação e matriz de riscos" manchete={`${plano.total} ações no plano: ${plano.concluidas} concluídas, ${plano.emAndamento} em andamento${altasEmCurso.length ? ` — ${altasEmCurso.length} de prioridade alta em curso` : ""}.`} icone={ShieldAlert} fontes={fontes([], "action log do empreendimento; análise RPS sobre os dados deste relatório")}>
        <div style={{ display: "flex", gap: 30 }}>
          <div style={{ width: 250 }}>
            <RotuloBloco>Action log — {plano.total} ações</RotuloBloco>
            <div style={{ position: "relative", width: 230, height: 220 }}>
              <PieChart width={230} height={220}>
                <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius={70} outerRadius={108} startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                  {fatias.map((f) => (
                    <Cell key={f.nome} fill={f.cor} />
                  ))}
                </Pie>
              </PieChart>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <p className="num" style={{ fontSize: 26, fontWeight: 700, color: COR.navy }}>{formatarNumero(plano.percentual ?? 0, 0)}%</p>
                <p style={{ fontSize: 11, color: COR.apoio }}>concluídas</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14 }}>
              {fatias.map((f) => (
                <ItemLegenda key={f.nome} cor={f.cor} rotulo={f.nome} valor={String(f.valor)} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <RotuloBloco>Principais riscos e tratamento</RotuloBloco>
            <TabelaSlide
              linhas={abertas}
              maxLinhas={7}
              alturaLinha={44}
              tamanho={10.5}
              colunas={[
                { titulo: "Risco", largura: "24%", render: (r) => r.assunto },
                {
                  titulo: "Criticidade",
                  largura: "11%",
                  render: (r) => (
                    <strong style={{ color: r.criticidade === "alta" ? COR.vermelho : r.criticidade === "media" ? COR.amarelo : COR.verde }}>
                      {r.criticidade === "media" ? "Média" : r.criticidade === "alta" ? "Alta" : "Baixa"}
                    </strong>
                  ),
                },
                { titulo: "Consequência", largura: "26%", render: (r) => r.consequencia || "—" },
                {
                  titulo: "Tratamento em curso / proposto",
                  render: (r) => (
                    <>
                      {r.acao}
                      {r.responsavel || r.prazo ? (
                        <span style={{ display: "block", fontSize: 9.5, color: COR.apoio }}>
                          {[r.responsavel, r.prazo ? `até ${formatarData(r.prazo)}` : ""].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </>
                  ),
                },
              ]}
            />
            {altasEmCurso.length ? (
              <p style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.45 }}>
                <strong>Ações de prioridade alta em andamento:</strong> {altasEmCurso.map((r) => r.assunto.toLowerCase()).join(" · ")}.
              </p>
            ) : null}
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ------------------------------------- 20. decisões e próximos passos */
  if (d.proximosPassos.linhas.length || d.sumario.pontosAtencao.length) {
    const decisoes = d.proximosPassos.linhas.filter((p) => p.dependeDoCliente).slice(0, 4);
    const passos = d.proximosPassos.linhas.filter((p) => !p.dependeDoCliente);
    add(
      "proximos",
      "Decisões e próximos passos",
      <SlidePadrao secao="Decisões e próximos passos" manchete={decisoes.length ? `${decisoes.length} ${decisoes.length === 1 ? "decisão depende" : "decisões dependem"} do proprietário neste mês.` : undefined} icone={CheckCircle2} fontes={fontes([], "decisões apresentadas como proposta da RPS para deliberação do cliente")}>
        <div style={{ display: "flex", gap: 28, height: "100%" }}>
          <div style={{ width: 596, background: COR.navy, color: "#fff", padding: "18px 22px" }}>
            <RotuloBloco cor={COR.ciano} style={{ marginBottom: 14 }}>
              Decisões solicitadas ao cliente
            </RotuloBloco>
            {decisoes.length ? (
              decisoes.map((p, i) => (
                <div key={p.id} style={{ display: "flex", gap: 22, padding: "14px 0", borderTop: i ? "1px solid rgba(255,255,255,0.18)" : "none" }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: COR.ciano, width: 50 }}>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700 }}>{p.decisao}</p>
                    <p style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{[p.status, p.prazo ? `prazo: ${p.prazo}` : null].filter(Boolean).join(" · ") || "aguardando deliberação"}</p>
                  </div>
                </div>
              ))
            ) : d.sumario.pontosAtencao.length ? (
              d.sumario.pontosAtencao.slice(0, 4).map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 22, padding: "14px 0", borderTop: i ? "1px solid rgba(255,255,255,0.18)" : "none" }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: COR.ciano, width: 50 }}>{String(i + 1).padStart(2, "0")}</span>
                  <p style={{ fontSize: 14, fontWeight: 600, alignSelf: "center" }}>{p}</p>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, opacity: 0.8 }}>Nenhuma decisão pendente do cliente nesta competência.</p>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <RotuloBloco>Próximos passos</RotuloBloco>
            {passos.length ? (
              <TabelaSlide
                linhas={passos}
                maxLinhas={8}
                alturaLinha={40}
                colunas={[
                  { titulo: "Ação", largura: "58%", render: (p) => p.decisao },
                  { titulo: "Status", render: (p) => p.status || "—" },
                  { titulo: "Prazo", render: (p) => p.prazo || <span style={{ color: COR.fraco }}>definir</span> },
                ]}
              />
            ) : (
              <Vazio>Sem próximos passos registrados.</Vazio>
            )}
          </div>
        </div>
      </SlidePadrao>,
    );
  }

  /* ------------------------------------------------------- 21. conclusão */
  if (d.conclusao.trim()) {
    add(
      "conclusao",
      "Conclusão",
      // fecha o relatório em tela cheia: a mensagem do gestor ao proprietário
      <SlideAbertura sobretitulo={`Conclusão · ${mes}`} titulo="Em síntese" texto={d.conclusao.trim()} foto={ctx.urlFotoEmpreendimento} />,
    );
  }

  {
    const decisoesCliente = d.proximosPassos.linhas.filter((p) => p.dependeDoCliente && !/conclu|resolvid|encerrad/i.test(p.status)).length;
    const linhasFim = [
      decisoesCliente ? `${decisoesCliente} ${decisoesCliente === 1 ? "decisão aguarda" : "decisões aguardam"} sua deliberação.` : null,
      `Próximo relatório: até ${formatarData(prazoProximo(competencia))}.`,
      emp?.gestor_nome ? `Gestão RPS: ${emp.gestor_nome}` : null,
    ].filter(Boolean) as string[];
    add("fim", "Encerramento", <SlideEncerramento linhas={linhasFim} foto={ctx.urlFotoEmpreendimento} />);
  }

  /* ---------------------------------------- ordem, sumário e paginação */
  const posicao = (id: string) => ORDEM.findIndex((o) => o.id === id);
  const ordenados = slides.sort((a, b) => posicao(a.id) - posicao(b.id));
  const depoisDaAbertura = ordenados[1]?.id === "panorama" ? 2 : 1;
  ordenados.splice(depoisDaAbertura, 0, { id: "sumario", titulo: "Sumário", capitulo: null, pagina: 0, node: null });
  ordenados.forEach((sl) => {
    sl.capitulo = ORDEM.find((o) => o.id === sl.id)?.capitulo ?? null;
  });
  // Abertura de capítulo em tela cheia antes do primeiro slide de cada capítulo.
  for (const c of CAPITULOS) {
    const i = ordenados.findIndex((sl) => sl.capitulo === c.id);
    if (i < 0) continue;
    ordenados.splice(i, 0, {
      id: `abertura-${c.id}`,
      titulo: c.nome,
      capitulo: c.id,
      pagina: 0,
      node: (
        <SlideAbertura
          numero={c.id}
          titulo={c.nome}
          texto={c.resumo}
          destaques={destaquesDoCapitulo(c.id)}
          foto={ctx.urlFotoEmpreendimento}
        />
      ),
    });
  }
  ordenados.forEach((sl, i) => {
    sl.pagina = i + 1;
  });

  const inicioCapitulo: Partial<Record<CapituloId, string>> = {};
  ordenados.forEach((sl) => {
    if (sl.capitulo && !inicioCapitulo[sl.capitulo]) inicioCapitulo[sl.capitulo] = sl.id; // a abertura do capítulo
  });

  const painel = ordenados.find((sl) => sl.id === "painel");
  ordenados.find((sl) => sl.id === "sumario")!.node = (
    <SlideSumario
      painel={painel ? { pagina: painel.pagina, id: painel.id } : undefined}
      capitulos={CAPITULOS.map((c) => ({
        ...c,
        itens: ordenados.filter((sl) => sl.capitulo === c.id && !sl.id.startsWith("abertura-")).map((sl) => ({ titulo: sl.titulo, pagina: sl.pagina, id: sl.id })),
      })).filter((c) => c.itens.length)}
    />
  );

  const rodape = [emp?.nome, `Competência ${mes}`, `Financeiro ${mesFin}`, emp?.cidade].filter(Boolean).join(" · ");
  return ordenados.map((sl) => ({
    ...sl,
    node: (
      <ContextoPagina.Provider value={{ pagina: sl.pagina, capitulo: sl.capitulo, rodape, inicioCapitulo, sumario: "sumario" }}>
        {sl.node}
      </ContextoPagina.Provider>
    ),
  }));
};
