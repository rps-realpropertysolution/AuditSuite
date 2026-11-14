import { describe, expect, it } from "vitest";
import { interpretarArquivo, numeroBR, rotuloEValores } from "@/lib/relatoriosSistema/interpretar";
import { aplicarArquivos } from "@/lib/relatoriosSistema/aplicar";
import { linhasDoPdf } from "@/lib/relatoriosSistema/linhas";
import { herdarDoMesAnterior, relatorioEmBranco } from "@/lib/defaults";
import { saldoTotal } from "@/lib/metrics";
import type { RelatorioSistema } from "@/lib/relatoriosSistema/tipos";

// Linhas no formato que o pdf.js devolve (já remontadas). Valores fictícios.
const PREVISTO_REALIZADO = [
  "RELATÓRIO DE PREVISTO X REALIZADO",
  "9001 - EDIFÍCIO EXEMPLO",
  "PERÍODO 09/2026",
  "PROCESSADO POR FULANO EM 10/10/2026 10:00:00",
  "09/2026",
  "RECEITA PREVISTO REALIZADO DIFERENÇA %VARIAÇÃO",
  "ORDINÁRIA 100.000,00 101.500,00 1.500,00 1,50",
  "477 - RECEBIMENTOS DO PERÍODO 100.000,00 100.000,10 0,10 0,00",
  "623 - RENDIMENTO 0,00 1.499,90 1.499,90 100,00",
  "FUNDO DE RESERVA 10.000,00 10.000,00 0,00 0,00",
  "490 - RECEBIMENTOS DO PERÍODO 10.000,00 10.000,00 0,00 0,00",
  "09/2026",
  "DESPESAS PREVISTO REALIZADO DIFERENÇA %VARIAÇÃO",
  "ORDINÁRIA 95.000,00 90.000,00 5.000,00 -5,26",
  "MANUTENÇÃO PREDIAL 30.000,00 32.000,00 -2.000,00 6,67",
  "SEGURANÇA PATRIMONIAL E COMBATE A 50.000,00 48.000,00 2.000,00 -4,00",
  "INCÊNDIO",
  "LIMPEZA E SANIFICAÇÃO 15.000,00 10.000,00 5.000,00 -33,33",
  "CMMQ 10,00 9,00 1,00",
  "FUNDO DE RESERVA 20.000,00 20.000,00 0,00 0,00",
  "DESPESAS F. RESERVA 20.000,00 20.000,00 0,00 0,00",
  "TOTAL RECEITA X DESPESA",
  "PERÍODO RECEITA DESPESA RESULTADO",
  "09/2026 111500,00 110000,00 1500,00",
];

const POSICAO = [
  "POSIÇÃO FINANCEIRA",
  "9001 - EDIFÍCIO EXEMPLO",
  "PERIODO: 01/09/2026 A 30/09/2026",
  "POSIÇÃO FINANCEIRA SALDO CRÉDITO DÉBITO SALDO",
  "ANTERIOR ATUAL",
  "ORDINÁRIA 50.000,00 101.500,00 90.000,00 61.500,00",
  "FUNDO DE RESERVA 200.000,00 10.000,00 20.000,00 190.000,00",
  "TOTAL 250.000,00 111.500,00 110.000,00 251.500,00",
];

const pdf = (nome: string, linhas: string[]) => ({ nome, tipo: "pdf" as const, paginas: [linhas], totalPaginas: 1 });
const relatorio = (r: ReturnType<typeof interpretarArquivo>): RelatorioSistema => {
  if ("erro" in r) throw new Error(r.erro);
  return r.relatorio;
};

describe("relatórios do sistema — leitura", () => {
  it("números no formato brasileiro e rótulo separado dos valores", () => {
    expect(numeroBR("1.234,56")).toBe(1234.56);
    expect(numeroBR("327701,11")).toBe(327701.11);
    expect(numeroBR("-1.039,76")).toBe(-1039.76);
    expect(numeroBR("INCÊNDIO")).toBeNull();
    expect(rotuloEValores("TAXAS, LICENÇAS E SERVIÇOS 4.295,53 4.276,16 19,37 -0,45")).toEqual({
      rotulo: "TAXAS, LICENÇAS E SERVIÇOS",
      valores: [4295.53, 4276.16, 19.37, -0.45],
    });
  });

  it("remonta as linhas do PDF pela altura e pela posição horizontal", () => {
    const t = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });
    expect(linhasDoPdf([t("10,00", 400, 700), t("ELEVADORES", 50, 700.8), t("TOTAL", 50, 650), t(" ", 60, 650)])).toEqual([
      "ELEVADORES 10,00",
      "TOTAL",
    ]);
  });

  it("previsto x realizado: grupos da ordinária, rótulo quebrado em duas linhas, CMMQ fora", () => {
    const r = relatorio(interpretarArquivo(pdf("prev.pdf", PREVISTO_REALIZADO)));
    expect(r.tipo).toBe("previsto_realizado");
    if (r.tipo !== "previsto_realizado") return;
    expect(r.cdCondominio).toBe("9001");
    expect(r.competencia).toBe("2026-09");
    expect(r.despesas.filter((x) => x.fundo === "Ordinária").map((x) => x.grupo)).toEqual([
      "Manutenção predial",
      "Segurança patrimonial e combate a incêndio",
      "Limpeza e sanificação",
    ]);
    expect(r.despesas.find((x) => x.fundo === "Fundo de reserva")?.realizado).toBe(20000);
    expect(r.receitas[0]).toEqual({ fundo: "Ordinária", conta: "Recebimentos do período", previsto: 100000, realizado: 100000.1 });
    expect(r.total).toEqual({ receita: 111500, despesa: 110000 });
  });

  it("posição financeira: um fundo por linha e o saldo de cada um precisa fechar", () => {
    const r = relatorio(interpretarArquivo(pdf("pos.pdf", POSICAO)));
    if (r.tipo !== "posicao_financeira") throw new Error(r.tipo);
    expect(r.fundos).toHaveLength(2);
    expect(r.total?.atual).toBe(251500);

    const quebrado = POSICAO.map((l) => l.replace("61.500,00", "61.000,00"));
    const erro = interpretarArquivo(pdf("pos.pdf", quebrado));
    expect(erro.ok).toBe(false);
  });

  it("boletos pagos (Excel): separa boletos de rendimentos e ignora os totais do dia", () => {
    const cab = ["Pagamento", "Vencimento", "Bloco", "Unidade", "Recibo", "Vl. Original", "Multa", "Juros", "Correção", "Desconto", "Vl. Pago"];
    const r = relatorio(
      interpretarArquivo({
        nome: "boletos.xlsx",
        tipo: "planilha",
        linhas: [
          cab,
          ["01/09/2026", "05/09/2026", "0", "0011", "100", 1000, null, null, null, null, 1000],
          ["01/09/2026", "05/09/2026", "0", "0012", "101", 500, null, null, null, null, 500],
          ["Total do dia [01/09/2026]", null, null, null, null, 1500, 0, 0, 0, 0, 1500],
          ["30/09/2026", "RENDIMENTO APLICAÇÃO", null, null, null, 80, null, null, null, null, 80],
          ["TOTAL GERAL", null, null, null, null, 1580, 0, 0, 0, 0, 1580],
        ],
      }),
    );
    expect(r).toEqual({ tipo: "boletos_pagos", competencia: "2026-09", boletos: { quantidade: 2, valor: 1500 }, outrosCreditos: 80, totalGeral: 1580 });
  });

  it("conta da Enel: consumo de ponta e fora de ponta pelo histórico", () => {
    const r = relatorio(
      interpretarArquivo(
        pdf("enel.pdf", [
          "EDIFICIO EXEMPLO",
          "Eletropaulo Metropolitana Eletricidade de São Paulo S.A",
          "TOTAL 10.500,00 300,00 9.000,00 1.600,00",
          "OUT/26 500,000 1.000,000 9.000,000 31",
          "SET/26 500,000 900,000 8.000,000 30",
        ]),
      ),
    );
    expect(r).toMatchObject({ tipo: "fatura_energia", competencia: "2026-10", consumo: 10000, consumoAnterior: 8900, ponta: 1000, foraPonta: 9000, valor: 10500 });
  });

  it("arquivo que não é do LiveFacilities é recusado com motivo", () => {
    const r = interpretarArquivo(pdf("x.pdf", ["Qualquer coisa"]));
    expect(r.ok).toBe(false);
  });
});

describe("relatórios do sistema — aplicação no RGM", () => {
  const ctx = { competencia: "2026-10-01", competenciaFinanceira: "2026-09-01", cdCondominio: "9001", agora: new Date("2026-10-12T12:00:00Z") };
  const arquivos = [
    { nome: "prev.pdf", relatorio: relatorio(interpretarArquivo(pdf("prev.pdf", PREVISTO_REALIZADO))) },
    { nome: "pos.pdf", relatorio: relatorio(interpretarArquivo(pdf("pos.pdf", POSICAO))) },
  ];

  it("preenche orçado e realizado, preserva a justificativa e abre o saldo por fundo", () => {
    const base = relatorioEmBranco();
    base.financeiro.grupos = [{ id: "g1", grupo: "Manutenção Predial", orcado: 0, realizado: 31000, observacao: "troca de bomba" }];
    base.financeiro.fundos = [{ id: "c", fundo: "Consolidado", anterior: 250000, creditos: 111500, debitos: 110000 }];

    const { dados, recusados } = aplicarArquivos(base, arquivos, ctx);
    expect(recusados).toEqual([]);
    const manut = dados.financeiro.grupos.find((g) => g.id === "g1");
    expect(manut).toMatchObject({ orcado: 30000, realizado: 32000, observacao: "troca de bomba" });
    expect(dados.financeiro.grupos).toHaveLength(3);
    expect(dados.financeiro.fundos.map((f) => f.fundo)).toEqual(["Ordinária", "Fundo de reserva"]);
    expect(saldoTotal(dados)).toBeCloseTo(251500, 2);
    expect(dados.arquivosImportados.map((a) => a.titulo).sort()).toEqual(["Posição Financeira", "Previsto x Realizado"]);

    // o mês seguinte herda o saldo por fundo — o encadeamento passa a ser exato
    const novembro = herdarDoMesAnterior(dados);
    expect(novembro.financeiro.fundos.map((f) => f.anterior)).toEqual([61500, 190000]);
  });

  it("recusa arquivo de outro prédio ou de outro mês, com o motivo", () => {
    const { recusados, dados } = aplicarArquivos(relatorioEmBranco(), arquivos, { ...ctx, cdCondominio: "9002" });
    expect(recusados).toHaveLength(2);
    expect(recusados[0].motivo).toMatch(/9001/);
    expect(dados.arquivosImportados).toEqual([]);

    const outroMes = aplicarArquivos(relatorioEmBranco(), arquivos, { ...ctx, competencia: "2026-11-01", competenciaFinanceira: "2026-10-01" });
    expect(outroMes.recusados.every((r) => /prestação de outubro/i.test(r.motivo))).toBe(true);
  });

  it("pedidos de compra: substitui pelos do arquivo e mantém os do mês passado ainda em curso", () => {
    const base = relatorioEmBranco();
    base.suprimentos.pedidos = [
      { id: "a", pedido: "10", categoria: "Elétrica", grupo: "Manutenção predial", status: "Aprovado", valor: 100, solicitacao: "2026-09-20", prazo: "2026-10-30" },
      { id: "b", pedido: "11", categoria: "Limpeza", grupo: "Limpeza", status: "Finalizado", valor: 50, solicitacao: "2026-09-21", prazo: "2026-09-30" },
    ];
    const pedidos = relatorio(
      interpretarArquivo({
        nome: "pedidos.xlsx",
        tipo: "planilha",
        linhas: [
          ["Administradora", "Empreendimento", "Pedido", "Status", "Vl. Aprovado", "Categoria", "Dt. Solicitação", "Prazo Estimado", "Conta Contábil"],
          ["RPS", "9001 - EDIFÍCIO EXEMPLO", 20, "EM ORÇAMENTO", 0, "ELETRICA", "05/10/2026", "20/10/2026", "466. ORDINÁRIA -> 501. MANUTENÇÃO PREDIAL -> 617. MATERIAIS"],
        ],
      }),
    );
    const { dados } = aplicarArquivos(base, [{ nome: "pedidos.xlsx", relatorio: pedidos }], ctx);
    expect(dados.suprimentos.pedidos.map((p) => p.pedido)).toEqual(["20", "10"]);
    expect(dados.suprimentos.pedidos[0]).toMatchObject({ status: "Em orçamento", grupo: "Manutenção predial", prazo: "2026-10-20" });
  });
});
