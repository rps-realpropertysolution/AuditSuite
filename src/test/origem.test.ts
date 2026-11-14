import { describe, expect, it } from "vitest";
import { relatorioEmBranco } from "@/lib/defaults";
import { marcarOrigem } from "@/lib/origem";

describe("origem dos dados (conferência visual)", () => {
  it("marca linhas novas ou alteradas e blocos que mudaram; preserva marcas anteriores", () => {
    const antes = relatorioEmBranco();
    const depoisLF = structuredClone(antes);
    depoisLF.contratos.linhas = [{ id: "c1", fornecedor: "X", objeto: "", situacao: "vigente", vencimento: "2027-01-01", observacao: "" }];
    depoisLF.financeiro.arrecadacao = { emitido: 100, recebido: 90 };
    const lf = marcarOrigem(antes, depoisLF, "lf");
    expect(lf.origemDados?.linhas.c1).toBe("lf");
    expect(lf.origemDados?.blocos["financeiro.arrecadacao"]).toBe("lf");
    expect(lf.origemDados?.blocos["operacao.resumo"]).toBeUndefined();

    const depoisArq = structuredClone(lf);
    depoisArq.financeiro.grupos = [{ id: "g1", grupo: "Limpeza", orcado: 10, realizado: 9, observacao: "" }];
    const arq = marcarOrigem(lf, depoisArq, "arquivo");
    expect(arq.origemDados?.linhas.g1).toBe("arquivo");
    expect(arq.origemDados?.linhas.c1).toBe("lf");
  });
});
