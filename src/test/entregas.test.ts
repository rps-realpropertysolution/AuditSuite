import { describe, expect, it } from "vitest";
import { competenciaDeReferencia, diasParaPrazo, prazoEntrega, situacaoEntrega } from "@/lib/entregas";
import { relatorioEmBranco } from "@/lib/defaults";
import type { Relatorio } from "@/lib/types";

const rel = (status: Relatorio["status"]): Relatorio => ({
  id: "r",
  empreendimento_id: "e",
  competencia: "2026-09-01",
  status,
  dados: relatorioEmBranco(),
  indice_executivo: null,
  publicado_em: null,
  created_at: "",
  updated_at: "",
});

describe("entrega do RGM", () => {
  it("referência é o mês fechado e o prazo é o dia 10 do mês seguinte", () => {
    expect(competenciaDeReferencia(new Date(2026, 10, 13))).toBe("2026-10-01");
    expect(competenciaDeReferencia(new Date(2027, 0, 5))).toBe("2026-12-01");
    expect(prazoEntrega("2026-09-01")).toBe("2026-10-10");
    expect(prazoEntrega("2026-12-01")).toBe("2027-01-10");
  });

  it("classifica a situação pela publicação e pelo prazo", () => {
    const antes = new Date(2026, 9, 5);
    const depois = new Date(2026, 10, 13);
    expect(situacaoEntrega(null, "2026-09-01", antes)).toBe("nao_iniciado");
    expect(situacaoEntrega(rel("rascunho"), "2026-09-01", antes)).toBe("em_elaboracao");
    expect(situacaoEntrega(rel("rascunho"), "2026-09-01", depois)).toBe("atrasado");
    expect(situacaoEntrega(null, "2026-09-01", depois)).toBe("atrasado");
    expect(situacaoEntrega(rel("publicado"), "2026-09-01", depois)).toBe("publicado");
    expect(diasParaPrazo("2026-09-01", new Date(2026, 9, 7))).toBe(3);
  });
});
