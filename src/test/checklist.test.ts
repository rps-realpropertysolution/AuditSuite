import { describe, expect, it } from "vitest";
import { desviosSemJustificativa, pendenciasDoMes } from "@/lib/checklist";
import { relatorioEmBranco } from "@/lib/defaults";

describe("Para fechar o RGM — pendências do mês", () => {
  it("relatório novo: tudo pendente; integrado começa pela importação", () => {
    const itens = pendenciasDoMes(relatorioEmBranco(), { integrado: true, hoje: new Date(2026, 10, 5) });
    expect(itens[0].id).toBe("lf");
    expect(itens.filter((i) => !i.feito).map((i) => i.id)).toContain("leitura");
    expect(itens.find((i) => i.id === "desvios")?.feito).toBe(true); // sem orçado, nada a justificar
  });

  it("desvio acima de 10% sem justificativa vira pendência; com justificativa, sai", () => {
    const d = relatorioEmBranco();
    d.financeiro.grupos = [
      { id: "a", grupo: "Limpeza", orcado: 100, realizado: 125, observacao: "" },
      { id: "b", grupo: "Segurança", orcado: 100, realizado: 105, observacao: "" },
    ];
    expect(desviosSemJustificativa(d).map((g) => g.id)).toEqual(["a"]);
    d.financeiro.grupos[0].observacao = "lavagem extra de fachada";
    expect(desviosSemJustificativa(d)).toEqual([]);
  });

  it("sugere a leitura do mês a partir dos números", () => {
    const d = relatorioEmBranco();
    d.financeiro.fundos = [{ id: "c", fundo: "Consolidado", anterior: 1000, creditos: 500, debitos: 300 }];
    const leitura = pendenciasDoMes(d, { integrado: false }).find((i) => i.id === "leitura");
    expect(leitura?.sugestao).toMatch(/Superávit/);
    expect(leitura?.feito).toBe(false);
  });
});
