import { describe, expect, it } from "vitest";
import { relatorioEmBranco, herdarDoMesAnterior, normalizarDados, novoId } from "@/lib/defaults";
import {
  calcularIndiceExecutivo,
  contarContratos,
  despesaTotal,
  inadimplenciaTotal,
  indicadores360,
  percentualPreventiva,
  percentualRealizado,
  receitaTotal,
  saldoFundo,
  saldoTotal,
  situacaoDocumento,
  totalManutencoes,
  totalRubrica,
  variacao,
} from "@/lib/metrics";
import { lerNumero, formatarVariacao, competenciaAnterior } from "@/lib/format";
import type { DadosRelatorio } from "@/lib/types";

const HOJE = new Date("2026-08-15T12:00:00Z");

describe("lerNumero — parsing de valores colados do Excel", () => {
  it("entende o formato pt-BR com milhar e centavos", () => {
    expect(lerNumero("R$ 1.234,56")).toBe(1234.56);
    expect(lerNumero("301.450,49")).toBe(301450.49);
  });

  it("preserva o sinal negativo", () => {
    // O parser antigo (replace(/\D/g,"")) devolvia 32 aqui.
    expect(lerNumero("-3,2%")).toBe(-3.2);
  });

  it("não perde os centavos", () => {
    // O parser antigo transformava "R$ 1.234,56" em 123456.
    expect(lerNumero("R$ 1.234,56")).not.toBe(123456);
  });

  it("aceita ponto decimal e campo vazio", () => {
    expect(lerNumero("1234.56")).toBe(1234.56);
    expect(lerNumero("")).toBe(0);
    expect(lerNumero("abc")).toBe(0);
  });
});

describe("variacao", () => {
  it("calcula a variação percentual com sinal", () => {
    expect(variacao(110, 100)).toBe(10);
    expect(variacao(90, 100)).toBeCloseTo(-10);
  });

  it("devolve null sem base de comparação em vez de dividir por zero", () => {
    expect(variacao(100, 0)).toBeNull();
  });

  it("formata a variação sempre com sinal explícito", () => {
    expect(formatarVariacao(8)).toBe("+8,0%");
    expect(formatarVariacao(-3.2)).toBe("-3,2%");
  });
});

describe("situacaoDocumento — status derivado da data", () => {
  const doc = (validade: string) => ({
    id: novoId(),
    documento: "CRF do FGTS",
    orgao: "Caixa",
    validade,
    observacao: "",
  });

  it("marca como vencido o que já passou", () => {
    const s = situacaoDocumento(doc("2026-07-01"), HOJE);
    expect(s.rotulo).toBe("Vencido");
    expect(s.semaforo).toBe("vermelho");
  });

  it("marca como a vencer o que expira em até 60 dias", () => {
    const s = situacaoDocumento(doc("2026-09-10"), HOJE);
    expect(s.rotulo).toBe("A vencer");
    expect(s.semaforo).toBe("amarelo");
  });

  it("marca como vigente o que está longe do vencimento", () => {
    expect(situacaoDocumento(doc("2027-01-19"), HOJE).rotulo).toBe("Vigente");
  });

  it("não quebra com data ausente", () => {
    expect(situacaoDocumento(doc(""), HOJE).rotulo).toBe("Sem data");
  });
});

/** Monta os fundos de forma que os totais batam com os valores desejados. */
const comFinanceiro = (creditos: number, debitos: number, anterior = 0) => {
  const d = relatorioEmBranco();
  d.financeiro.fundos = [{ id: novoId(), fundo: "Ordinária", anterior, creditos, debitos }];
  return d;
};

describe("financeiro — totais derivados da tabela por fundo", () => {
  it("soma créditos, débitos e saldo das linhas", () => {
    const d = relatorioEmBranco();
    // Valores reais do relatório de junho, abertos por fundo
    d.financeiro.fundos = [
      { id: novoId(), fundo: "Ordinária", anterior: 15_148.6, creditos: 169_759.73, debitos: 194_576.35 },
      { id: novoId(), fundo: "Fundo de reserva", anterior: 193_169.92, creditos: 8_390.44, debitos: 8_290.0 },
      { id: novoId(), fundo: "Fundo privativo", anterior: -6_419.31, creditos: 116_632.19, debitos: 120_756.94 },
      { id: novoId(), fundo: "Lavanderia", anterior: 30_219.22, creditos: 5_518.04, debitos: 0 },
      { id: novoId(), fundo: "Locação de área comum", anterior: 13_511.63, creditos: 1_150.0, debitos: 1_150.0 },
    ];

    expect(receitaTotal(d)).toBeCloseTo(301_450.4, 2);
    expect(despesaTotal(d)).toBeCloseTo(324_773.29, 2);
    expect(saldoTotal(d)).toBeCloseTo(222_307.17, 2);
  });

  it("saldo por linha é anterior + créditos - débitos", () => {
    expect(saldoFundo({ id: "x", fundo: "Ordinária", anterior: 15_148.6, creditos: 169_759.73, debitos: 194_576.35 }))
      .toBeCloseTo(-9_668.02, 2);
  });
});

describe("indicadores360 — o sumário executivo que se monta sozinho", () => {
  it("acusa vermelho quando a despesa supera muito a receita", () => {
    const d = comFinanceiro(100_000, 130_000);
    const resultado = indicadores360(d, HOJE).find((i) => i.id === "resultado");
    expect(resultado?.semaforo).toBe("vermelho");
  });

  it("aceita despesa levemente acima da receita como amarelo", () => {
    // +7,7% — o caso do relatório de junho
    const d = comFinanceiro(301_450.49, 324_773.29);
    expect(indicadores360(d, HOJE).find((i) => i.id === "resultado")?.semaforo).toBe("amarelo");
  });

  it("reporta 'não informado' em vez de fingir que está tudo bem", () => {
    const vazio = relatorioEmBranco();
    const operacao = indicadores360(vazio, HOJE).find((i) => i.id === "operacao");
    expect(operacao?.valor).toBe("não informado");
  });

  it("um contrato vencido derruba o indicador de contratos para vermelho", () => {
    const d = relatorioEmBranco();
    d.contratos.linhas = [
      { id: novoId(), fornecedor: "Lavanderia", objeto: "Lavanderia", situacao: "vencido", vencimento: "", observacao: "" },
      { id: novoId(), fornecedor: "Limpeza", objeto: "Limpeza", situacao: "vigente", vencimento: "", observacao: "" },
    ];
    expect(indicadores360(d, HOJE).find((i) => i.id === "contratos")?.semaforo).toBe("vermelho");
    expect(contarContratos(d)).toEqual({ vigentes: 1, vencidos: 1, emRenovacao: 0 });
  });
});

describe("calcularIndiceExecutivo", () => {
  it("não premia o relatório por linhas vazias", () => {
    // Regressão do bug antigo: `82 + nº de linhas` fazia a nota subir
    // só por adicionar uma linha em branco na tabela.
    const vazio = relatorioEmBranco();
    const antes = calcularIndiceExecutivo(vazio, HOJE);

    vazio.financeiro.grupos.push({ id: novoId(), grupo: "", orcado: 0, realizado: 0, observacao: "" });
    vazio.documentos.linhas.push({ id: novoId(), documento: "", orgao: "", validade: "", observacao: "" });

    expect(calcularIndiceExecutivo(vazio, HOJE)).toBe(antes);
  });

  it("fica entre 0 e 100", () => {
    const d = comFinanceiro(100_000, 90_000, 50_000);
    const nota = calcularIndiceExecutivo(d, HOJE);
    expect(nota).not.toBeNull();
    expect(nota!).toBeGreaterThanOrEqual(0);
    expect(nota!).toBeLessThanOrEqual(100);
  });
});

describe("inadimplencia por rubrica", () => {
  it("consolida a posição do período somando as rubricas", () => {
    const d = relatorioEmBranco();
    // Abertura real do relatório de junho — total consolidado R$ 64.815,15
    d.juridico.inadimplencia.rubricas = [
      { id: novoId(), rubrica: "Ordinária", ateAnterior: 36_227.09, recebido: 1_742.06, doMes: 5_619.63 },
      { id: novoId(), rubrica: "Fundo de reserva", ateAnterior: 1_475.76, recebido: 87.1, doMes: 280.97 },
      { id: novoId(), rubrica: "Fundo privativo", ateAnterior: 20_123.04, recebido: 1_295.25, doMes: 3_997.59 },
      { id: novoId(), rubrica: "Arrecadação extra", ateAnterior: 215.48, recebido: 0, doMes: 0 },
    ];
    expect(inadimplenciaTotal(d)).toBeCloseTo(64_815.15, 2);
  });

  it("total de uma rubrica é ateAnterior - recebido + doMes", () => {
    expect(
      totalRubrica({ id: "x", rubrica: "Ordinária", ateAnterior: 36_227.09, recebido: 1_742.06, doMes: 5_619.63 }),
    ).toBeCloseTo(40_104.66, 2);
  });
});

describe("agregado de manutenção", () => {
  const comResumo = (p: number, c: number, a: number, r: number, nr: number) => {
    const d = relatorioEmBranco();
    d.operacao.resumo = { preventivas: p, corretivas: c, acompanhamentos: a, rondas: r, naoRealizadas: nr };
    return d;
  };

  it("soma o total executado", () => {
    // Números do dashboard real: 33 preventivas, 18 corretivas, 38 acomp., 166 rondas
    expect(totalManutencoes(comResumo(33, 18, 38, 166, 0))).toBe(255);
  });

  it("calcula a proporção de preventiva sobre preventiva + corretiva", () => {
    // 33 / (33+18) = 64,7%
    expect(percentualPreventiva(comResumo(33, 18, 38, 166, 0))).toBeCloseTo(64.7, 1);
  });

  it("100% executado quando não há ordens em aberto", () => {
    expect(percentualRealizado(comResumo(33, 18, 38, 166, 0))).toBe(100);
  });

  it("desconta as não realizadas do percentual de execução", () => {
    // 255 executadas de 255+45 programadas = 85%
    expect(percentualRealizado(comResumo(33, 18, 38, 166, 45))).toBeCloseTo(85, 1);
  });

  it("sem lançamento nenhum, devolve null em vez de zero", () => {
    expect(percentualPreventiva(relatorioEmBranco())).toBeNull();
    expect(percentualRealizado(relatorioEmBranco())).toBeNull();
  });
});

describe("herdarDoMesAnterior — o que corta a redigitação", () => {
  const montarMesFechado = (): DadosRelatorio => {
    const d = relatorioEmBranco();
    d.financeiro.fundos = [
      { id: novoId(), fundo: "Ordinária", anterior: 15_148.6, creditos: 169_759.73, debitos: 194_576.35 },
      { id: novoId(), fundo: "Fundo de reserva", anterior: 193_169.92, creditos: 8_390.44, debitos: 8_290.0 },
    ];
    d.financeiro.grupos = [
      { id: novoId(), grupo: "Limpeza", orcado: 34_673.34, realizado: 34_004.09, observacao: "ok" },
    ];
    d.utilidades.linhas = [
      {
        id: novoId(),
        utilidade: "Água",
        unidade: "m³",
        consumo: 4_080,
        consumoAnterior: 3_900,
        ponta: 0,
        foraPonta: 0,
        faltas: 0,
        detalhamento: "136 m³/dia",
        fatura: 59_357,
        faturaAnterior: 55_000,
        observacao: "",
      },
    ];
    d.juridico.inadimplencia.rubricas = [
      { id: novoId(), rubrica: "Ordinária", ateAnterior: 58_041.37, recebido: 3_124.41, doMes: 9_898.19 },
    ];
    d.contratos.linhas = [
      { id: novoId(), fornecedor: "Lavanderia", objeto: "Lavanderia", situacao: "vencido", vencimento: "", observacao: "" },
    ];
    d.capex.linhas = [
      { id: novoId(), iniciativa: "Ar-condicionado", orcado: 252_774.39, realizado: 314_804.71, status: "concluido", beneficio: "" },
      { id: novoId(), iniciativa: "Fachada", orcado: 50_000, realizado: 10_000, status: "em_andamento", beneficio: "" },
    ];
    return d;
  };

  it("encadeia o saldo de cada fundo e zera o movimento", () => {
    const anterior = montarMesFechado();
    const novo = herdarDoMesAnterior(anterior);

    // saldo de fechamento de cada fundo vira o "anterior" do mês seguinte
    expect(novo.financeiro.fundos[0].anterior).toBeCloseTo(-9_668.02, 2);
    expect(novo.financeiro.fundos[1].anterior).toBeCloseTo(193_270.36, 2);
    expect(saldoTotal(novo)).toBeCloseTo(saldoTotal(anterior), 2);
    expect(receitaTotal(novo)).toBe(0);
    expect(despesaTotal(novo)).toBe(0);
  });

  it("encadeia a inadimplência por rubrica", () => {
    const novo = herdarDoMesAnterior(montarMesFechado());
    expect(novo.juridico.inadimplencia.rubricas[0].ateAnterior).toBeCloseTo(64_815.15, 2);
    expect(novo.juridico.inadimplencia.rubricas[0].doMes).toBe(0);
    expect(novo.juridico.inadimplencia.rubricas[0].recebido).toBe(0);
  });

  it("mantém as disciplinas acompanhadas e zera a contagem", () => {
    const anterior = montarMesFechado();
    anterior.operacao.disciplinas = [{ id: novoId(), disciplina: "Elétrica", quantidade: 154 }];
    anterior.operacao.resumo = { preventivas: 33, corretivas: 18, acompanhamentos: 38, rondas: 166, naoRealizadas: 0 };

    const novo = herdarDoMesAnterior(anterior);
    expect(novo.operacao.disciplinas[0].disciplina).toBe("Elétrica");
    expect(novo.operacao.disciplinas[0].quantidade).toBe(0);
    expect(totalManutencoes(novo)).toBe(0);
  });

  it("transforma o consumo do mês na base de comparação do mês seguinte", () => {
    const novo = herdarDoMesAnterior(montarMesFechado());
    expect(novo.utilidades.linhas[0].consumoAnterior).toBe(4_080);
    expect(novo.utilidades.linhas[0].consumo).toBe(0);
    expect(novo.utilidades.linhas[0].faturaAnterior).toBe(59_357);
  });

  it("mantém o orçado e zera o realizado", () => {
    const novo = herdarDoMesAnterior(montarMesFechado());
    expect(novo.financeiro.grupos[0].orcado).toBeCloseTo(34_673.34, 2);
    expect(novo.financeiro.grupos[0].realizado).toBe(0);
    expect(novo.financeiro.grupos[0].observacao).toBe("");
  });

  it("carrega contratos adiante e descarta CAPEX já concluído", () => {
    const novo = herdarDoMesAnterior(montarMesFechado());
    expect(novo.contratos.linhas).toHaveLength(1);
    expect(novo.capex.linhas).toHaveLength(1);
    expect(novo.capex.linhas[0].iniciativa).toBe("Fachada");
  });

  it("gera ids novos para não colidir com o relatório anterior", () => {
    const anterior = montarMesFechado();
    const novo = herdarDoMesAnterior(anterior);
    expect(novo.contratos.linhas[0].id).not.toBe(anterior.contratos.linhas[0].id);
  });
});

describe("normalizarDados — tolerância a dados antigos ou corrompidos", () => {
  it("devolve o relatório em branco quando o JSON é lixo", () => {
    expect(normalizarDados(null).versao).toBe(3);
    expect(normalizarDados("texto solto").versao).toBe(3);
    expect(normalizarDados(42).versao).toBe(3);
  });

  it("preserva o que reconhece e ignora o resto", () => {
    const d = normalizarDados({
      financeiro: { fundos: [{ id: "a", fundo: "Ordinária", creditos: 1000 }], campoInventado: true },
    });
    expect(receitaTotal(d)).toBe(1000);
    expect(d.utilidades.linhas.length).toBeGreaterThan(0);
  });

  it("migra relatório gravado na versão anterior sem perder valores", () => {
    // v2 guardava receita/despesa/saldo soltos e a inadimplência em 3 números
    const d = normalizarDados({
      versao: 2,
      financeiro: { receita: 301_450.4, despesa: 324_773.29, saldoConta: 222_307.17 },
      juridico: { inadimplencia: { posicaoAnterior: 58_041.37, recebidoNoMes: 3_124.41, emAtrasoNoMes: 9_898.19 } },
    });

    expect(d.versao).toBe(3);
    expect(receitaTotal(d)).toBeCloseTo(301_450.4, 2);
    expect(despesaTotal(d)).toBeCloseTo(324_773.29, 2);
    expect(saldoTotal(d)).toBeCloseTo(222_307.17, 2);
    expect(inadimplenciaTotal(d)).toBeCloseTo(64_815.15, 2);
  });

  it("descarta valores de enum inválidos em vez de propagá-los", () => {
    const d = normalizarDados({
      contratos: { linhas: [{ id: "x", fornecedor: "A", objeto: "B", situacao: "explodido" }] },
    });
    expect(d.contratos.linhas[0].situacao).toBe("vigente");
  });
});

describe("competenciaAnterior", () => {
  it("volta um mês", () => {
    expect(competenciaAnterior("2026-08-01")).toBe("2026-07-01");
  });

  it("vira o ano corretamente", () => {
    expect(competenciaAnterior("2026-01-01")).toBe("2025-12-01");
  });
});
