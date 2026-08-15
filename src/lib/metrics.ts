/**
 * Tudo que é derivado do dado bruto. Nada aqui é digitado pelo gestor.
 *
 * O ganho principal está em `indicadores360()`: a tabela de semáforos do
 * slide "Sumário Executivo 360°" — hoje montada à mão no PPTX — passa a ser
 * calculada a partir das outras seções. O gestor lança os números uma vez e
 * o resumo executivo se escreve sozinho, sempre coerente com o detalhe.
 *
 * O "Índice Executivo" da versão anterior era `82 + nº de linhas da tabela`:
 * adicionar uma linha vazia aumentava a nota do prédio. Aqui vira média
 * ponderada de pilares reais, cada um auditável e exibido separadamente.
 */

import type {
  Criticidade,
  DadosRelatorio,
  LinhaCapex,
  LinhaDocumento,
  LinhaUtilidade,
  Semaforo,
} from "./types";
import { formatarMoeda, formatarNumero, formatarPercentual, formatarVariacao } from "./format";

/** Divisão que nunca estoura: sem denominador, o indicador é "não aplicável". */
const razao = (numerador: number, denominador: number): number | null =>
  denominador > 0 ? (numerador / denominador) * 100 : null;

const media = (valores: number[]): number | null =>
  valores.length > 0 ? valores.reduce((s, v) => s + v, 0) / valores.length : null;

const limitar = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max);

const pior = (a: Semaforo, b: Semaforo): Semaforo => {
  const ordem: Record<Semaforo, number> = { vermelho: 0, amarelo: 1, verde: 2 };
  return ordem[a] <= ordem[b] ? a : b;
};

export const notaDoSemaforo = (s: Semaforo) => (s === "verde" ? 100 : s === "amarelo" ? 60 : 0);

/* -------------------------------------------------------------------------- */
/* Derivações por linha                                                        */
/* -------------------------------------------------------------------------- */

/** Variação percentual preservando o sinal (o parser antigo comia o "-"). */
export const variacao = (atual: number, anterior: number): number | null =>
  anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;

export const variacaoConsumo = (l: LinhaUtilidade) => variacao(l.consumo, l.consumoAnterior);
export const variacaoFatura = (l: LinhaUtilidade) => variacao(l.fatura, l.faturaAnterior);

export const desvioCapex = (l: LinhaCapex) => variacao(l.realizado, l.orcado);

export const resultadoFinanceiro = (d: DadosRelatorio) => d.financeiro.receita - d.financeiro.despesa;

/** "despesa 8% acima da receita" — o número que abre o sumário no template. */
export const despesaSobreReceita = (d: DadosRelatorio) =>
  variacao(d.financeiro.despesa, d.financeiro.receita);

export const inadimplenciaTotal = (d: DadosRelatorio) =>
  d.juridico.inadimplencia.posicaoAnterior -
  d.juridico.inadimplencia.recebidoNoMes +
  d.juridico.inadimplencia.emAtrasoNoMes;

export const vacancia = (d: DadosRelatorio) => limitar(100 - d.operacao.ocupacao);

export const totalAcessos = (d: DadosRelatorio) =>
  d.operacao.acessosFixos + d.operacao.acessosVisitantes;

export type SituacaoDocumento = {
  rotulo: "Vigente" | "A vencer" | "Vencido" | "Sem data";
  semaforo: Semaforo;
  diasRestantes: number | null;
};

/**
 * Status do documento vem da DATA, não de um campo de texto.
 * Antes o gestor digitava "Vigente" e o texto podia contradizer a validade.
 */
export const situacaoDocumento = (doc: LinhaDocumento, hoje = new Date()): SituacaoDocumento => {
  if (!doc.validade) return { rotulo: "Sem data", semaforo: "amarelo", diasRestantes: null };

  const [ano, mes, dia] = doc.validade.split("-").map(Number);
  if (!ano || !mes || !dia) return { rotulo: "Sem data", semaforo: "amarelo", diasRestantes: null };

  const venc = Date.UTC(ano, mes - 1, dia);
  const ref = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((venc - ref) / 86_400_000);

  if (dias < 0) return { rotulo: "Vencido", semaforo: "vermelho", diasRestantes: dias };
  if (dias <= 60) return { rotulo: "A vencer", semaforo: "amarelo", diasRestantes: dias };
  return { rotulo: "Vigente", semaforo: "verde", diasRestantes: dias };
};

export const contarContratos = (d: DadosRelatorio) => ({
  vigentes: d.contratos.linhas.filter((c) => c.situacao === "vigente").length,
  vencidos: d.contratos.linhas.filter((c) => c.situacao === "vencido").length,
  emRenovacao: d.contratos.linhas.filter((c) => c.situacao === "em_renovacao").length,
});

export const contarDocumentos = (d: DadosRelatorio, hoje = new Date()) => {
  const s = d.documentos.linhas.map((doc) => situacaoDocumento(doc, hoje));
  return {
    vigentes: s.filter((x) => x.semaforo === "verde").length,
    aVencer: s.filter((x) => x.rotulo === "A vencer").length,
    vencidos: s.filter((x) => x.rotulo === "Vencido").length,
    total: s.length,
  };
};

/* -------------------------------------------------------------------------- */
/* Sumário Executivo 360° — a tabela de semáforos que se monta sozinha         */
/* -------------------------------------------------------------------------- */

export interface Indicador360 {
  id: string;
  rotulo: string;
  valor: string;
  semaforo: Semaforo;
  /** Por que este semáforo — o síndico consegue auditar a régua. */
  criterio: string;
  secao: string;
}

/** Indicador sem dado lançado fica cinza-amarelo com "não informado". */
const semDado = (id: string, rotulo: string, secao: string): Indicador360 => ({
  id,
  rotulo,
  valor: "não informado",
  semaforo: "amarelo",
  criterio: "Sem dado lançado nesta competência.",
  secao,
});

export const indicadores360 = (d: DadosRelatorio, hoje = new Date()): Indicador360[] => {
  const lista: Indicador360[] = [];

  // 1. Resultado financeiro — despesa vs. receita
  const dsr = despesaSobreReceita(d);
  if (dsr === null) {
    lista.push(semDado("resultado", "Resultado financeiro", "Financeiro"));
  } else {
    lista.push({
      id: "resultado",
      rotulo: "Resultado financeiro",
      valor: `Despesa ${formatarVariacao(dsr)} vs. receita`,
      semaforo: dsr <= 0 ? "verde" : dsr <= 10 ? "amarelo" : "vermelho",
      criterio: "Verde: despesa ≤ receita. Amarelo: até 10% acima. Vermelho: acima de 10%.",
      secao: "Financeiro",
    });
  }

  // 2. Saldo de caixa
  lista.push({
    id: "saldo",
    rotulo: "Saldo de caixa",
    valor: formatarMoeda(d.financeiro.saldoConta),
    semaforo:
      d.financeiro.saldoConta <= 0
        ? "vermelho"
        : d.financeiro.despesa > 0 && d.financeiro.saldoConta < d.financeiro.despesa * 0.5
          ? "amarelo"
          : "verde",
    criterio: "Vermelho: saldo zerado ou negativo. Amarelo: abaixo de meio mês de despesa.",
    secao: "Financeiro",
  });

  // 3. Inadimplência
  const inad = inadimplenciaTotal(d);
  const inadPctReceita = d.financeiro.receita > 0 ? (inad / d.financeiro.receita) * 100 : null;
  lista.push({
    id: "inadimplencia",
    rotulo: "Inadimplência",
    valor: `${formatarMoeda(inad)} acumulado`,
    semaforo:
      inad <= 0 ? "verde" : inadPctReceita !== null && inadPctReceita > 20 ? "vermelho" : "amarelo",
    criterio: "Verde: sem inadimplência. Vermelho: acima de 20% da receita mensal.",
    secao: "Jurídico",
  });

  // 4. Desempenho operacional
  const concluidas = d.operacao.ocorrencias.filter((o) => o.concluida).length;
  const totalOc = d.operacao.ocorrencias.length;
  if (totalOc === 0) {
    lista.push(semDado("operacao", "Desempenho operacional", "Operação"));
  } else {
    lista.push({
      id: "operacao",
      rotulo: "Desempenho operacional",
      valor: `${concluidas} de ${totalOc} manutenções concluídas`,
      semaforo: concluidas === totalOc ? "verde" : concluidas / totalOc >= 0.7 ? "amarelo" : "vermelho",
      criterio: "Verde: todas concluídas. Amarelo: ao menos 70%. Vermelho: abaixo disso.",
      secao: "Operação",
    });
  }

  // 5. Documentos legais
  const doc = contarDocumentos(d, hoje);
  if (doc.total === 0) {
    lista.push(semDado("documentos", "Documentos legais", "Documentos"));
  } else {
    lista.push({
      id: "documentos",
      rotulo: "Documentos legais",
      valor: `${doc.vencidos} vencidos / ${doc.aVencer} a vencer`,
      semaforo: doc.vencidos > 0 ? "vermelho" : doc.aVencer > 0 ? "amarelo" : "verde",
      criterio: "Vermelho: qualquer documento vencido. Amarelo: algum vence em até 60 dias.",
      secao: "Documentos",
    });
  }

  // 6. Contratos
  const ctr = contarContratos(d);
  if (d.contratos.linhas.length === 0) {
    lista.push(semDado("contratos", "Contratos", "Contratos"));
  } else {
    lista.push({
      id: "contratos",
      rotulo: "Contratos",
      valor: `${ctr.vigentes} vigentes / ${ctr.vencidos} vencido${ctr.vencidos === 1 ? "" : "s"}`,
      semaforo: ctr.vencidos > 0 ? "vermelho" : ctr.emRenovacao > 0 ? "amarelo" : "verde",
      criterio: "Vermelho: contrato vencido em vigor. Amarelo: renovação pendente.",
      secao: "Contratos",
    });
  }

  // 7. Jurídico
  const proc = d.juridico.processos.length;
  lista.push({
    id: "juridico",
    rotulo: "Jurídico",
    valor: proc === 0 ? "Sem processos" : `${proc} processo${proc === 1 ? "" : "s"} em andamento`,
    semaforo: proc === 0
      ? "verde"
      : d.juridico.processos.some((p) => p.criticidade === "alta")
        ? "vermelho"
        : "amarelo",
    criterio: "Verde: nenhum processo. Vermelho: há processo de criticidade alta.",
    secao: "Jurídico",
  });

  // 8. Utilidades
  if (d.utilidades.linhas.length === 0) {
    lista.push(semDado("utilidades", "Utilidades", "Utilidades"));
  } else {
    const variacoes = d.utilidades.linhas
      .map(variacaoConsumo)
      .filter((v): v is number => v !== null);
    const maiorAlta = variacoes.length > 0 ? Math.max(...variacoes) : null;
    lista.push({
      id: "utilidades",
      rotulo: "Utilidades",
      valor: d.utilidades.linhas
        .map((u) => `${u.utilidade} ${formatarNumero(u.consumo)}${u.unidade}`)
        .join(" / "),
      semaforo: maiorAlta === null ? "amarelo" : maiorAlta > 25 ? "vermelho" : maiorAlta > 10 ? "amarelo" : "verde",
      criterio: "Amarelo: consumo subiu mais de 10%. Vermelho: mais de 25%.",
      secao: "Utilidades",
    });
  }

  // 9. Investimentos (CAPEX)
  if (d.capex.linhas.length === 0) {
    lista.push(semDado("capex", "Investimentos", "CAPEX"));
  } else {
    const orcado = d.capex.linhas.reduce((s, l) => s + l.orcado, 0);
    const realizado = d.capex.linhas.reduce((s, l) => s + l.realizado, 0);
    const desvio = variacao(realizado, orcado);
    lista.push({
      id: "capex",
      rotulo: "Investimentos",
      valor: `${formatarMoeda(realizado)} realizado${desvio !== null ? ` (${formatarVariacao(desvio)})` : ""}`,
      semaforo: desvio === null ? "amarelo" : desvio <= 5 ? "verde" : desvio <= 20 ? "amarelo" : "vermelho",
      criterio: "Verde: até 5% do orçado. Amarelo: até 20%. Vermelho: acima de 20%.",
      secao: "CAPEX",
    });
  }

  // 10. Planos de ação
  const riscos = d.riscos.linhas.length;
  lista.push({
    id: "riscos",
    rotulo: "Planos de ação",
    valor: riscos === 0 ? "Nenhum risco aberto" : `${riscos} em acompanhamento`,
    semaforo: riscos === 0
      ? "verde"
      : d.riscos.linhas.some((r) => r.criticidade === "alta")
        ? "vermelho"
        : "amarelo",
    criterio: "Verde: matriz de riscos limpa. Vermelho: risco de criticidade alta aberto.",
    secao: "Riscos",
  });

  return lista;
};

/* -------------------------------------------------------------------------- */
/* Índice executivo — média ponderada dos indicadores 360°                     */
/* -------------------------------------------------------------------------- */

export interface Pilar {
  id: string;
  nome: string;
  nota: number | null;
  peso: number;
  detalhe: string;
}

const PESOS: Record<string, number> = {
  resultado: 0.15,
  saldo: 0.1,
  inadimplencia: 0.1,
  operacao: 0.15,
  documentos: 0.15,
  contratos: 0.08,
  juridico: 0.07,
  utilidades: 0.05,
  capex: 0.08,
  riscos: 0.07,
};

export const calcularPilares = (dados: DadosRelatorio, hoje = new Date()): Pilar[] =>
  indicadores360(dados, hoje).map((ind) => ({
    id: ind.id,
    nome: ind.rotulo,
    // "não informado" não vira zero: sai do cálculo em vez de punir o relatório
    nota: ind.valor === "não informado" ? null : notaDoSemaforo(ind.semaforo),
    peso: PESOS[ind.id] ?? 0.05,
    detalhe: ind.valor,
  }));

/**
 * Média ponderada apenas dos pilares COM dados — os pesos são renormalizados.
 * Um relatório em preenchimento não é punido por seções ainda vazias.
 */
export const calcularIndiceExecutivo = (dados: DadosRelatorio, hoje = new Date()): number | null => {
  const validos = calcularPilares(dados, hoje).filter(
    (p): p is Pilar & { nota: number } => p.nota !== null,
  );
  if (validos.length === 0) return null;

  const pesoTotal = validos.reduce((s, p) => s + p.peso, 0);
  const soma = validos.reduce((s, p) => s + p.nota * p.peso, 0);
  return Math.round(soma / pesoTotal);
};

export const semaforoDaNota = (nota: number | null): Semaforo => {
  if (nota === null) return "amarelo";
  if (nota >= 85) return "verde";
  if (nota >= 60) return "amarelo";
  return "vermelho";
};

/* -------------------------------------------------------------------------- */
/* KPIs de topo                                                                */
/* -------------------------------------------------------------------------- */

export interface Kpi {
  id: string;
  label: string;
  valor: string;
  apoio: string;
  semaforo: Semaforo;
}

export const calcularKpis = (d: DadosRelatorio): Kpi[] => {
  const resultado = resultadoFinanceiro(d);
  const dsr = despesaSobreReceita(d);
  const acessos = totalAcessos(d);

  return [
    {
      id: "receita",
      label: "Receita do mês",
      valor: formatarMoeda(d.financeiro.receita),
      apoio: "entradas do período",
      semaforo: d.financeiro.receita > 0 ? "verde" : "amarelo",
    },
    {
      id: "despesa",
      label: "Despesa do mês",
      valor: formatarMoeda(d.financeiro.despesa),
      apoio: dsr === null ? "sem receita lançada" : `${formatarVariacao(dsr)} vs. receita`,
      semaforo: dsr === null ? "amarelo" : dsr <= 0 ? "verde" : dsr <= 10 ? "amarelo" : "vermelho",
    },
    {
      id: "saldo",
      label: "Saldo em conta",
      valor: formatarMoeda(d.financeiro.saldoConta),
      apoio: resultado >= 0 ? "resultado positivo" : "resultado negativo no mês",
      semaforo: d.financeiro.saldoConta > 0 ? "verde" : "vermelho",
    },
    {
      id: "inadimplencia",
      label: "Inadimplência total",
      valor: formatarMoeda(inadimplenciaTotal(d)),
      apoio: "acumulado até o fechamento",
      semaforo: inadimplenciaTotal(d) <= 0 ? "verde" : "amarelo",
    },
    {
      id: "ocupacao",
      label: "Taxa de ocupação",
      valor: formatarPercentual(d.operacao.ocupacao, 0),
      apoio: `vacância de ${formatarPercentual(vacancia(d), 0)}`,
      semaforo: d.operacao.ocupacao >= 90 ? "verde" : d.operacao.ocupacao >= 70 ? "amarelo" : "vermelho",
    },
    {
      id: "acessos",
      label: "Fluxo de pessoas",
      valor: formatarNumero(acessos),
      apoio: `${formatarNumero(d.operacao.acessosFixos)} fixos + ${formatarNumero(d.operacao.acessosVisitantes)} visitantes`,
      semaforo: "verde",
    },
  ];
};

/* -------------------------------------------------------------------------- */
/* Alertas — vira a matriz de riscos sugerida                                  */
/* -------------------------------------------------------------------------- */

export interface Alerta {
  id: string;
  severidade: Semaforo;
  titulo: string;
  detalhe: string;
  secao: string;
}

const criticidadeParaSemaforo = (c: Criticidade): Semaforo =>
  c === "alta" ? "vermelho" : c === "media" ? "amarelo" : "verde";

export const calcularAlertas = (d: DadosRelatorio, hoje = new Date()): Alerta[] => {
  const alertas: Alerta[] = [];

  d.documentos.linhas.forEach((doc) => {
    const s = situacaoDocumento(doc, hoje);
    if (s.rotulo === "Vencido") {
      alertas.push({
        id: `doc-${doc.id}`,
        severidade: "vermelho",
        titulo: `${doc.documento} vencido`,
        detalhe: `Venceu há ${Math.abs(s.diasRestantes ?? 0)} dias. Órgão: ${doc.orgao || "não informado"}.`,
        secao: "Documentos",
      });
    } else if (s.rotulo === "A vencer") {
      alertas.push({
        id: `doc-${doc.id}`,
        severidade: "amarelo",
        titulo: `${doc.documento} vence em ${s.diasRestantes} dias`,
        detalhe: `Validade ${doc.validade}. Órgão: ${doc.orgao || "não informado"}.`,
        secao: "Documentos",
      });
    }
  });

  d.contratos.linhas.forEach((c) => {
    if (c.situacao === "vencido") {
      alertas.push({
        id: `ctr-${c.id}`,
        severidade: "vermelho",
        titulo: `Contrato vencido: ${c.fornecedor}`,
        detalhe: c.observacao || `Objeto: ${c.objeto || "não informado"}.`,
        secao: "Contratos",
      });
    }
  });

  d.financeiro.grupos.forEach((g) => {
    const desvio = variacao(g.realizado, g.orcado);
    if (desvio !== null && desvio > 15) {
      alertas.push({
        id: `fin-${g.id}`,
        severidade: desvio > 30 ? "vermelho" : "amarelo",
        titulo: `${g.grupo} estourou o orçado em ${desvio.toFixed(0)}%`,
        detalhe: g.observacao || "Sem justificativa registrada — classificar a natureza do desvio.",
        secao: "Financeiro",
      });
    }
  });

  d.utilidades.linhas.forEach((u) => {
    const v = variacaoConsumo(u);
    if (v !== null && v > 10) {
      alertas.push({
        id: `uti-${u.id}`,
        severidade: v > 25 ? "vermelho" : "amarelo",
        titulo: `Consumo de ${u.utilidade} subiu ${v.toFixed(1)}%`,
        detalhe: u.observacao || "Sem plano de ação registrado.",
        secao: "Utilidades",
      });
    }
  });

  d.capex.linhas.forEach((c) => {
    const desvio = desvioCapex(c);
    if (desvio !== null && desvio > 20) {
      alertas.push({
        id: `cpx-${c.id}`,
        severidade: "vermelho",
        titulo: `${c.iniciativa} com desvio de ${desvio.toFixed(1)}%`,
        detalhe: c.beneficio || "Sem benefício esperado registrado.",
        secao: "CAPEX",
      });
    }
  });

  d.juridico.processos.forEach((p) => {
    alertas.push({
      id: `jur-${p.id}`,
      severidade: criticidadeParaSemaforo(p.criticidade),
      titulo: `Processo ${p.numero || "sem número"}`,
      detalhe: `${p.objeto || "Objeto não informado"}. ${p.andamento || ""}`.trim(),
      secao: "Jurídico",
    });
  });

  d.fornecedores.linhas.forEach((f) => {
    if (f.sla > 0 && f.sla < 85) {
      alertas.push({
        id: `for-${f.id}`,
        severidade: f.sla < 70 ? "vermelho" : "amarelo",
        titulo: `${f.fornecedor} com SLA de ${f.sla}%`,
        detalhe: `Disciplina ${f.disciplina || "não informada"} · criticidade ${f.criticidade}.`,
        secao: "Fornecedores",
      });
    }
  });

  const ordem: Record<Semaforo, number> = { vermelho: 0, amarelo: 1, verde: 2 };
  return alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
};

/** Semáforo geral do mês — o "farol" único que abre a apresentação. */
export const semaforoGeral = (d: DadosRelatorio, hoje = new Date()): Semaforo =>
  indicadores360(d, hoje).reduce<Semaforo>((acc, i) => pior(acc, i.semaforo), "verde");

/* -------------------------------------------------------------------------- */
/* Progresso de preenchimento — orienta o gestor sobre o que falta             */
/* -------------------------------------------------------------------------- */

const preenchido = (t: string) => t.trim().length >= 15;

export const progressoSecoes = (d: DadosRelatorio): Record<string, boolean> => ({
  sumario: preenchido(d.sumario.avaliacaoGeral),
  financeiro: d.financeiro.receita > 0 || d.financeiro.despesa > 0,
  operacao: d.operacao.ocorrencias.length > 0 || d.operacao.ocupacao > 0,
  fornecedores: d.fornecedores.linhas.length > 0,
  contratos: d.contratos.linhas.length > 0,
  documentos: d.documentos.linhas.some((l) => Boolean(l.validade)),
  juridico: d.juridico.processos.length > 0 || inadimplenciaTotal(d) !== 0,
  utilidades: d.utilidades.linhas.some((l) => l.consumo > 0),
  capex: d.capex.linhas.length > 0,
  riscos: d.riscos.linhas.length > 0,
  proximosPassos: d.proximosPassos.linhas.length > 0,
  fotos: d.fotos.length > 0,
  conclusao: preenchido(d.conclusao),
});

export const percentualPreenchido = (d: DadosRelatorio) => {
  const secoes = Object.values(progressoSecoes(d));
  return Math.round((secoes.filter(Boolean).length / secoes.length) * 100);
};
