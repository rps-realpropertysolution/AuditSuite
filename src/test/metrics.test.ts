import { describe, expect, it } from "vitest";
import { relatorioEmBranco, herdarDoMesAnterior, normalizarDados, novoId } from "@/lib/defaults";
import {
  calcularIndiceExecutivo,
  contarContratos,
  inadimplenciaTotal,
  indicadores360,
  situacaoDocumento,
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

describe("indicadores360 — o sumário executivo que se monta sozinho", () => {
  it("acusa vermelho quando a despesa supera muito a receita", () => {
    const d = relatorioEmBranco();
    d.financeiro.receita = 100_000;
    d.financeiro.despesa = 130_000;

    const resultado = indicadores360(d, HOJE).find((i) => i.id === "resultado");
    expect(resultado?.semaforo).toBe("vermelho");
  });

  it("aceita despesa levemente acima da receita como amarelo", () => {
    const d = relatorioEmBranco();
    d.financeiro.receita = 301_450.49;
    d.financeiro.despesa = 324_773.29; // +7,7% — o caso do relatório de junho
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
    const d = relatorioEmBranco();
    d.financeiro.receita = 100_000;
    d.financeiro.despesa = 90_000;
    const nota = calcularIndiceExecutivo(d, HOJE);
    expect(nota).not.toBeNull();
    expect(nota!).toBeGreaterThanOrEqual(0);
    expect(nota!).toBeLessThanOrEqual(100);
  });
});

describe("inadimplencia", () => {
  it("consolida a posição do período", () => {
    const d = relatorioEmBranco();
    d.juridico.inadimplencia = {
      posicaoAnterior: 58_041.37,
      recebidoNoMes: 3_124.41,
      emAtrasoNoMes: 9_898.19,
    };
    // Valores reais do relatório de junho: total consolidado R$ 64.815,15
    expect(inadimplenciaTotal(d)).toBeCloseTo(64_815.15, 2);
  });
});

describe("herdarDoMesAnterior — o que corta a redigitação", () => {
  const montarMesFechado = (): DadosRelatorio => {
    const d = relatorioEmBranco();
    d.financeiro.saldoConta = 222_307.17;
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
        detalhamento: "136 m³/dia",
        fatura: 59_357,
        faturaAnterior: 55_000,
        observacao: "",
      },
    ];
    d.juridico.inadimplencia = { posicaoAnterior: 58_041.37, recebidoNoMes: 3_124.41, emAtrasoNoMes: 9_898.19 };
    d.contratos.linhas = [
      { id: novoId(), fornecedor: "Lavanderia", objeto: "Lavanderia", situacao: "vencido", vencimento: "", observacao: "" },
    ];
    d.capex.linhas = [
      { id: novoId(), iniciativa: "Ar-condicionado", orcado: 252_774.39, realizado: 314_804.71, status: "concluido", beneficio: "" },
      { id: novoId(), iniciativa: "Fachada", orcado: 50_000, realizado: 10_000, status: "em_andamento", beneficio: "" },
    ];
    return d;
  };

  it("encadeia o saldo e a inadimplência", () => {
    const novo = herdarDoMesAnterior(montarMesFechado());
    expect(novo.financeiro.saldoConta).toBeCloseTo(222_307.17, 2);
    expect(novo.juridico.inadimplencia.posicaoAnterior).toBeCloseTo(64_815.15, 2);
    expect(novo.juridico.inadimplencia.emAtrasoNoMes).toBe(0);
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
    expect(normalizarDados(null).versao).toBe(2);
    expect(normalizarDados("texto solto").versao).toBe(2);
    expect(normalizarDados(42).versao).toBe(2);
  });

  it("preserva o que reconhece e ignora o resto", () => {
    const d = normalizarDados({ financeiro: { receita: 1000, campoInventado: true } });
    expect(d.financeiro.receita).toBe(1000);
    expect(d.utilidades.linhas.length).toBeGreaterThan(0);
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
