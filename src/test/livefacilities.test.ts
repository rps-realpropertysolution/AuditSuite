import { describe, expect, it, vi } from "vitest";
import {
  mapearAcordos,
  fundoDaHierarquia,
  mapearFluxoCaixa,
  capitalizar,
  classificarTipoOS,
  mapearArrecadacao,
  mapearContratos,
  mapearDespesas,
  mapearDocumentos,
  mapearInadimplencia,
  mapearOS,
  periodoDaCompetencia,
} from "../../supabase/functions/_shared/livefacilities/mapear.ts";
import { criarClienteLF, extrairToken, type ClienteLF } from "../../supabase/functions/_shared/livefacilities/cliente.ts";
import { importarCompetencia } from "../../supabase/functions/_shared/livefacilities/importar.ts";
import type { BoletoLF, ResultadoImportacaoLF } from "../../supabase/functions/_shared/livefacilities/tipos.ts";
import { aplicarImportacao } from "@/lib/importacao";
import { relatorioEmBranco, novoId } from "@/lib/defaults";
import { inadimplenciaTotal, percentualOSNoPrazo, saldoTotal } from "@/lib/metrics";

/* Dados fictícios, no formato do Swagger — nenhum valor de cliente real. */

const OUT = periodoDaCompetencia("2026-10-01");
const SET = periodoDaCompetencia("2026-09-01");
const HOJE = new Date("2026-11-13T12:00:00");

describe("período da competência", () => {
  it("calcula início, fim e fim do mês anterior", () => {
    expect(OUT).toEqual({ competencia: "2026-10-01", inicio: "2026-10-01", fim: "2026-10-31", fimAnterior: "2026-09-30" });
    expect(periodoDaCompetencia("2026-01-01").fimAnterior).toBe("2025-12-31");
    expect(periodoDaCompetencia("2028-02-01").fim).toBe("2028-02-29");
  });
});

describe("cliente — somente leitura", () => {
  it("recusa rota que grava no sistema antes de fazer qualquer chamada", () => {
    const fetchFalso = vi.fn();
    const c = criarClienteLF({ usuario: "u", senha: "s", fetch: fetchFalso as unknown as typeof fetch });
    expect(() => c.get("/Condomino/alterar")).toThrow(/não liberada/);
    expect(() => c.consultar("/PagamentoFila/InserePagamentoFila", {})).toThrow(/não liberada/);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("entende o token em JSON ou como texto puro", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.assinatura_abc";
    expect(extrairToken(jwt)).toBe(jwt);
    expect(extrairToken(`"${jwt}"`)).toBe(jwt);
    expect(extrairToken(JSON.stringify({ token: jwt }))).toBe(jwt);
    expect(extrairToken(JSON.stringify({ data: { accessToken: `Bearer ${jwt}` } }))).toBe(jwt);
    expect(extrairToken("erro")).toBeNull();
  });

  it("faz login, manda o Bearer e refaz o login uma vez em 401", async () => {
    const chamadas: string[] = [];
    let logins = 0;
    const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
      chamadas.push(`${init?.method} ${url}`);
      if (url.endsWith("/Login")) {
        logins++;
        return new Response(JSON.stringify({ token: `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.token${logins}` }), { status: 200 });
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      if (auth === "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.token1") return new Response("", { status: 401 });
      return new Response(JSON.stringify({ success: true, data: [{ id_contrato: 1 }] }), { status: 200 });
    });
    const c = criarClienteLF({ usuario: "u", senha: "s", baseUrl: "https://x/api", fetch: fetchFalso as unknown as typeof fetch });
    const r = await c.get<{ data: unknown[] }>("/ContratoCompleto", { id_empreendimento: 231, vazio: "" });
    expect(r.data).toHaveLength(1);
    expect(logins).toBe(2);
    expect(chamadas.at(-1)).toBe("GET https://x/api/ContratoCompleto?id_empreendimento=231");
  });

  it("explica o 403 com o caminho da tela de permissões", async () => {
    const fetchFalso = vi.fn(async (url: string) =>
      url.endsWith("/Login")
        ? new Response('"aaa.bbb.ccc"', { status: 200 })
        : new Response(JSON.stringify({ title: "Forbidden", detail: "Falta Boleto.Lista" }), { status: 403 }),
    );
    const c = criarClienteLF({ usuario: "u", senha: "s", fetch: fetchFalso as unknown as typeof fetch });
    await expect(c.get("/Boleto/ListaBoleto")).rejects.toThrow(/GESTÃO DE ACESSOS API\(S\).*Falta Boleto\.Lista/);
  });
});

describe("ordens de serviço", () => {
  it("classifica o tipo pelo processo", () => {
    expect(classificarTipoOS({ nm_atividadetipo: "Preventiva" })).toBe("preventiva");
    expect(classificarTipoOS({ tx_processocaminho: "Manutenção > Corretiva > Elétrica" })).toBe("corretiva");
    expect(classificarTipoOS({ nm_atividadetipo: "Ronda preventiva noturna" })).toBe("ronda");
    expect(classificarTipoOS({ nm_atividadetipo: "Inspeção" })).toBe("acompanhamento");
    expect(classificarTipoOS({ nm_atividadetipo: "Xyz" })).toBeNull();
  });

  it("separa no prazo, com atraso, abertas atrasadas e canceladas", () => {
    const { os, avisos } = mapearOS(
      [
        { nm_atividadetipo: "Preventiva", nm_statusatividade: "Concluída", dt_fimocorrencia: "2026-10-10T00:00:00", dt_conclusao: "2026-10-09T15:00:00", nm_processopai: "Elétrica" },
        { nm_atividadetipo: "Corretiva", nm_statusatividade: "Concluída", dt_fimocorrencia: "2026-10-10T00:00:00", dt_conclusao: "2026-10-12T15:00:00", nm_processopai: "Hidráulica" },
        { nm_atividadetipo: "Preventiva", nm_statusatividade: "Em execução", dt_fimocorrencia: "2026-10-20T00:00:00", nm_processopai: "Elétrica" },
        { nm_atividadetipo: "Preventiva", nm_statusatividade: "Aberta", dt_fimocorrencia: "2026-11-05T00:00:00", nm_processopai: "Elétrica" },
        { nm_atividadetipo: "Corretiva", nm_statusatividade: "Cancelada" },
      ],
      OUT,
      HOJE,
    );
    expect(os.situacao).toEqual({ concluidasNoPrazo: 1, concluidasComAtraso: 1, abertasNoPrazo: 1, abertasAtrasadas: 1, canceladas: 1 });
    expect(os.resumo).toEqual({ preventivas: 1, corretivas: 1, acompanhamentos: 0, rondas: 0, naoRealizadas: 2 });
    expect(os.disciplinas[0]).toEqual({ disciplina: "Elétrica", quantidade: 3 });
    expect(os.total).toBe(5);
    expect(avisos).toEqual([]);
  });
});

describe("inadimplência por rubrica a partir dos boletos", () => {
  const boleto = (b: Partial<BoletoLF>): BoletoLF => ({
    vl_recibo: 1000,
    recibo_detalhe: [
      { nm_contacontabilgrau_1: "RECEITAS", nm_contacontabilgrau_2: "ORDINÁRIA", vl_recibodetalhe: 800 },
      { nm_contacontabilgrau_1: "RECEITAS", nm_contacontabilgrau_2: "FUNDO DE RESERVA", vl_recibodetalhe: 200 },
    ],
    ...b,
  });

  it("monta posição anterior, recebido no mês e atraso novo — fechando com o aberto no fim do mês", () => {
    const boletos = [
      boleto({ id_recibo: 1, dt_vencimento: "2026-08-10" }), // velho, segue aberto
      boleto({ id_recibo: 2, dt_vencimento: "2026-09-10", dt_pagamento: "2026-10-15" }), // velho, pago em outubro
      boleto({ id_recibo: 3, dt_vencimento: "2026-09-10", dt_pagamento: "2026-09-10" }), // pago em dia: não entra
      boleto({ id_recibo: 4, dt_vencimento: "2026-10-10" }), // atraso novo
      boleto({ id_recibo: 5, dt_vencimento: "2026-10-10", dt_pagamento: "2026-10-30" }), // pago no mês: não entra
      boleto({ id_recibo: 6, dt_vencimento: "2026-10-10", dt_pagamento: "2026-11-05" }), // pago depois: aberto em 31/10
      boleto({ id_recibo: 7, dt_vencimento: "2026-08-10", nm_recibostatus: "Cancelado" }),
      boleto({ id_recibo: 8, dt_vencimento: "2026-11-10" }), // ainda não venceu
    ];
    const rubricas = mapearInadimplencia(boletos, OUT);
    // Grau 1 é sempre "RECEITAS": as rubricas saem do grau 2
    expect(rubricas.map((r) => r.rubrica)).toEqual(["Ordinária", "Fundo de reserva"]);
    expect(rubricas[0]).toEqual({ rubrica: "Ordinária", ateAnterior: 1600, recebido: 800, doMes: 1600 });

    const d = relatorioEmBranco();
    d.juridico.inadimplencia.rubricas = rubricas.map((r) => ({ id: novoId(), ...r }));
    // aberto em 31/10: boletos 1, 4 e 6 = 3.000
    expect(inadimplenciaTotal(d)).toBeCloseTo(3000, 2);
  });

  it("sem detalhe contábil, cai na rubrica Geral", () => {
    const r = mapearInadimplencia([{ id_recibo: 1, vl_recibo: 500, dt_vencimento: "2026-10-05" }], OUT);
    expect(r).toEqual([{ rubrica: "Geral", ateAnterior: 0, recebido: 0, doMes: 500 }]);
  });
});

describe("contratos, documentos, despesas e arrecadação", () => {
  it("mantém só a vigência mais recente por fornecedor e descarta rescindidos", () => {
    const c = mapearContratos([
      { nm_contratado: "LIMPEZA EXEMPLO", nm_classificacao: "Limpeza", dt_termino: "2025-01-31" },
      { nm_contratado: "Limpeza Exemplo", nm_classificacao: "Limpeza", dt_termino: "2027-01-31" },
      { nm_contratado: "Elevadores X", nm_classificacao: "Elevadores", dt_termino: null, tx_objeto: "Manutenção de elevadores" },
      { nm_contratado: "Antiga", nm_status: "Rescindido", dt_termino: "2027-01-01" },
    ]);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ fornecedor: "Limpeza Exemplo", vencimento: "2027-01-31" });
    expect(c[1]).toMatchObject({ fornecedor: "Elevadores X", vencimento: "", objeto: "Manutenção de elevadores" });
  });

  it("achata os documentos, fica com a renovação e marca os permanentes", () => {
    const docs = mapearDocumentos([
      {
        empreendimento: [
          {
            empreendimentoId: 231,
            documentoTipo: [
              {
                documentoTipoNome: "CORPO DE BOMBEIROS",
                documento: [
                  { documentoTitulo: "AVCB", dataValidade: "2025-01-05T00:00:00" },
                  { documentoTitulo: "AVCB", dataValidade: "2027-01-05T00:00:00" },
                  { documentoTitulo: "Inativo", dataValidade: "2027-01-05", documentoAtivo: false },
                ],
              },
              { documentoTipoNome: "Jurídico", documento: [{ documentoTitulo: "Convenção do condomínio" }] },
            ],
          },
        ],
      },
    ], 231);
    expect(docs).toEqual([
      { documento: "AVCB", orgao: "Corpo de bombeiros", validade: "2027-01-05", permanente: false },
      { documento: "Convenção do condomínio", orgao: "Jurídico", validade: "", permanente: true },
    ]);
  });

  it("agrupa despesas pelo grupo contábil e usa a conta ordinária na arrecadação", () => {
    expect(
      mapearDespesas([
        { nm_conta1: "DESPESAS", nm_conta2: "LIMPEZA E SANIFICAÇÃO", vl_conta: 100 },
        { nm_conta1: "DESPESAS", nm_conta2: "Limpeza e sanificação", vl_conta: -50 },
        { nm_conta1: "DESPESAS", nm_conta2: "ELEVADORES", vl_conta: 30 },
      ]),
    ).toEqual([
      { grupo: "Limpeza e sanificação", valor: 150 },
      { grupo: "Elevadores", valor: 30 },
    ]);
    const a = mapearArrecadacao([
      { nm_contaprincipal: "ORDINÁRIA", vl_previsto: 600_000, vl_realizado: 576_000 },
      { nm_contaprincipal: "FUNDO DE RESERVA", vl_previsto: 30_000, vl_realizado: 29_000 },
    ]);
    expect(a).toMatchObject({ emitido: 600_000, recebido: 576_000, contaReferencia: "Ordinária" });
  });

  it("capitaliza nomes em caixa alta preservando siglas", () => {
    expect(capitalizar("AVCB - AUTO DE VISTORIA DO CORPO DE BOMBEIROS")).toBe("AVCB - auto de vistoria do corpo de bombeiros");
    expect(capitalizar("Já Formatado")).toBe("Já Formatado");
  });
});

describe("importarCompetencia — uma consulta falhar não derruba as outras", () => {
  it("devolve o que deu certo e transforma a falha em aviso", async () => {
    const cliente = {
      get: vi.fn(async (rota: string) => {
        if (rota === "/ContratoCompleto") throw new Error("Perfil sem permissão para /ContratoCompleto");
        if (rota === "/FluxoCaixa/FluxoCaixa") {
          return { success: true, data: [{ id_empreendimento: 231, vl_saldoanterior: 10, vl_credito: 5, vl_debito: 3, vl_saldoatual: 12 }] };
        }
        if (rota === "/PrestacaoContas/despesas") return { id_erro: 0, data: [] };
        return { success: true, data: [] };
      }),
      consultar: vi.fn(),
      paginar: vi.fn(async () => []),
    } as unknown as ClienteLF;
    const r = await importarCompetencia(cliente, { idEmpreendimento: 231, cdCondominio: "0231", competencia: "2026-10" });
    expect(r.dados.financeiro).toMatchObject({ saldoAnterior: 10, creditos: 5, debitos: 3, saldoAtual: 12 });
    expect(r.consultas.find((c) => c.rota === "/ContratoCompleto")?.ok).toBe(false);
    expect(r.avisos.some((a) => a.includes("Contratos"))).toBe(true);
  });
});

describe("competência financeira — o financeiro é a última prestação fechada", () => {
  it("consulta o financeiro no mês anterior e a operação no mês do relatório", async () => {
    const chamadas: Record<string, Record<string, unknown>> = {};
    const cliente = {
      get: vi.fn(async (rota: string, params: Record<string, unknown>) => {
        chamadas[rota] = params;
        return rota === "/PrestacaoContas/despesas" ? { id_erro: 0, data: [] } : { success: true, data: [] };
      }),
      consultar: vi.fn(),
      paginar: vi.fn(async (_rota: string, params: Record<string, unknown>) => {
        chamadas["/Boleto/ListaBoleto"] = params;
        return [];
      }),
    } as unknown as ClienteLF;

    const r = await importarCompetencia(cliente, { idEmpreendimento: 231, cdCondominio: "0231", competencia: "2026-10" });
    expect(r.dados.periodoFinanceiro.competencia).toBe("2026-09-01");
    expect(chamadas["/OrdemServico/ListaAtividade"]).toMatchObject({ dt_inicio: "2026-10-01", dt_fim: "2026-10-31" });
    expect(chamadas["/FluxoCaixa/FluxoCaixa"]).toMatchObject({ dt_periodoinicial: "2026-09-01", dt_periodofinal: "2026-09-30" });
    expect(chamadas["/PrestacaoContas/despesas"]).toMatchObject({ dt_inicio: "2026-09-01", dt_fim: "2026-09-30" });
    expect(chamadas["/Boleto/ListaBoleto"]).toMatchObject({ dt_vencimentofinal: "2026-09-30" });

    // o gestor pode escolher outro mês financeiro (ex.: outubro já fechado)
    const r2 = await importarCompetencia(cliente, { idEmpreendimento: 231, cdCondominio: "0231", competencia: "2026-10", competenciaFinanceira: "2026-10" });
    expect(r2.dados.periodoFinanceiro.fim).toBe("2026-10-31");
  });

  it("preenche as certidões com a validade dos documentos do sistema", () => {
    const { dados } = aplicarImportacao(relatorioEmBranco(), {
      dados: {
        periodo: OUT,
        periodoFinanceiro: SET,
        documentos: [
          { documento: "Certidão CND Federal - Receita/PGFN", orgao: "Federal", validade: "2027-03-25", permanente: false },
          { documento: "CND Municipal", orgao: "Prefeitura", validade: "2027-01-11", permanente: false },
          { documento: "AVCB", orgao: "Bombeiros", validade: "2027-01-05", permanente: false },
        ],
      },
      consultas: [],
      avisos: [],
    });
    const validade = (nome: RegExp) => dados.juridico.certidoes.find((c) => nome.test(c.certidao))?.validade;
    expect(validade(/Federal/)).toBe("2027-03-25");
    expect(validade(/Municipal/)).toBe("2027-01-11");
    expect(validade(/FGTS/)).toBe("");
  });
});

describe("aplicarImportacao — mescla sem apagar o que é do gestor", () => {
  const resultado = (dados: Partial<ResultadoImportacaoLF["dados"]>): ResultadoImportacaoLF => ({
    dados: { periodo: OUT, periodoFinanceiro: SET, ...dados },
    consultas: [],
    avisos: [],
  });

  it("substitui os fundos em branco por uma linha consolidada", () => {
    const { dados, preenchido } = aplicarImportacao(
      relatorioEmBranco(),
      resultado({ financeiro: { saldoAnterior: 555_100, creditos: 919_400, debitos: 1_046_400, saldoAtual: 428_100 } }),
    );
    expect(dados.financeiro.fundos).toHaveLength(1);
    expect(dados.financeiro.fundos[0]).toMatchObject({ fundo: "Consolidado", anterior: 555_100 });
    expect(preenchido[0].rotulo).toBe("Resultado e saldo (setembro de 2026)");
    expect(dados.importacao?.secoes).toContain("financeiro");
    // o relatório passa a registrar de qual prestação de contas veio o financeiro
    expect(dados.competenciaFinanceira).toBe("2026-09-01");
  });

  it("não mexe em fundos abertos à mão — avisa", () => {
    const base = relatorioEmBranco();
    base.financeiro.fundos = [
      { id: "a", fundo: "Ordinária", anterior: 100, creditos: 0, debitos: 0 },
      { id: "b", fundo: "Fundo de reserva", anterior: 50, creditos: 0, debitos: 0 },
    ];
    const { dados, avisos } = aplicarImportacao(base, resultado({ financeiro: { saldoAnterior: 150, creditos: 10, debitos: 5, saldoAtual: 155 } }));
    expect(dados.financeiro.fundos).toBe(base.financeiro.fundos);
    expect(avisos[0]).toMatch(/abertos à mão/);
  });

  it("preserva orçado e justificativa do grupo ao trazer o realizado", () => {
    const base = relatorioEmBranco();
    base.financeiro.grupos = [
      { id: "g1", grupo: "Limpeza e sanificação", orcado: 162_500, realizado: 0, observacao: "fachada" },
      { id: "g2", grupo: "Grupos geradores", orcado: 4_600, realizado: 0, observacao: "" },
    ];
    const { dados, avisos } = aplicarImportacao(base, resultado({ despesasPorGrupo: [{ grupo: "LIMPEZA E SANIFICACAO", valor: 190_800 }] }));
    expect(dados.financeiro.grupos[0]).toEqual({ id: "g1", grupo: "Limpeza e sanificação", orcado: 162_500, realizado: 190_800, observacao: "fachada" });
    expect(dados.financeiro.grupos[1]).toMatchObject({ grupo: "Grupos geradores", realizado: 0 });
    expect(avisos[0]).toMatch(/Grupos geradores/);
  });

  it("traz a situação das OS e o indicador passa a usar o prazo", () => {
    const situacao = { concluidasNoPrazo: 524, concluidasComAtraso: 35, abertasNoPrazo: 0, abertasAtrasadas: 31, canceladas: 203 };
    const { dados } = aplicarImportacao(
      relatorioEmBranco(),
      resultado({
        os: {
          total: 793,
          situacao,
          resumo: { preventivas: 400, corretivas: 159, acompanhamentos: 0, rondas: 0, naoRealizadas: 31 },
          disciplinas: [{ disciplina: "Elétrica", quantidade: 200 }],
        },
      }),
    );
    expect(dados.operacao.situacaoOS).toEqual(situacao);
    expect(percentualOSNoPrazo(dados)).toBeCloseTo(93.7, 1);
  });

  it("documentos do sistema substituem as linhas-modelo em branco e mantêm a observação", () => {
    const base = relatorioEmBranco();
    base.documentos.linhas.push({ id: "d1", documento: "AVCB do condomínio", orgao: "", validade: "2025-01-01", observacao: "protocolo 123" });
    const { dados } = aplicarImportacao(
      base,
      resultado({ documentos: [{ documento: "AVCB do condomínio", orgao: "Bombeiros", validade: "2027-01-05", permanente: false }] }),
    );
    expect(dados.documentos.linhas).toEqual([
      { id: "d1", documento: "AVCB do condomínio", orgao: "Bombeiros", validade: "2027-01-05", permanente: false, observacao: "protocolo 123" },
    ]);
  });
});

describe("formato real da API (sondado em 13/11/2026, valores fictícios)", () => {
  it("fluxo de caixa: o fundo vem no início da hierarquia contábil", () => {
    expect(fundoDaHierarquia("466. ORDINÁRIA -> 516. GRUPO GERADORES -> 517. MANUTENÇÃO")).toBe("Ordinária");
    expect(fundoDaHierarquia("625. FUNDO PRIVATIVO / REEMBOLSÁVEL -> 635. RECEBIMENTOS")).toBe("Fundo privativo / reembolsável");
    expect(fundoDaHierarquia(null)).toBe("Outros lançamentos");

    const f = mapearFluxoCaixa(
      [
        {
          id_empreendimento: 122,
          cd_empreendimento: "1006 - EXEMPLO",
          vl_saldoanterior: 1000,
          vl_credito: 300,
          vl_debito: 250,
          vl_saldoatual: 1050,
          listaFluxoCaixaDados: [
            { nm_contacontabilhierarquia: "466. ORDINÁRIA -> 477. RECEBIMENTOS", vl_credito: 200, vl_debito: null },
            { nm_contacontabilhierarquia: "466. ORDINÁRIA -> 516. GERADORES", vl_credito: null, vl_debito: 150 },
            { nm_contacontabilhierarquia: "467. FUNDO DE RESERVA -> 490. RECEBIMENTOS", vl_credito: 100, vl_debito: 100 },
          ],
        },
      ],
      null,
      "1006",
    );
    expect(f?.porFundo).toEqual([
      { fundo: "Ordinária", creditos: 200, debitos: 150 },
      { fundo: "Fundo de reserva", creditos: 100, debitos: 100 },
    ]);
  });

  it("mescla por fundo: primeira vez cria 'saldo a distribuir'; depois encadeia por fundo", () => {
    const financeiro = {
      saldoAnterior: 1000,
      creditos: 300,
      debitos: 250,
      saldoAtual: 1050,
      porFundo: [
        { fundo: "Ordinária", creditos: 200, debitos: 150 },
        { fundo: "Fundo de reserva", creditos: 100, debitos: 100 },
      ],
    };
    const res = (dados: ReturnType<typeof relatorioEmBranco>) =>
      aplicarImportacao(dados, { dados: { periodo: OUT, periodoFinanceiro: SET, financeiro }, consultas: [], avisos: [] });

    const primeira = res(relatorioEmBranco());
    const fundos = primeira.dados.financeiro.fundos;
    expect(fundos.map((f) => f.fundo)).toEqual(["Ordinária", "Fundo de reserva", "Saldo anterior a distribuir"]);
    expect(saldoTotal(primeira.dados)).toBeCloseTo(1050, 2);
    expect(primeira.avisos.some((a) => a.includes("Reparta entre os fundos"))).toBe(true);

    // o gestor repartiu: 800 ordinária, 200 reserva — no mês seguinte encadeia sem aviso
    const repartido = relatorioEmBranco();
    repartido.financeiro.fundos = [
      { id: "o", fundo: "Ordinária", anterior: 800, creditos: 0, debitos: 0 },
      { id: "r", fundo: "Fundo de reserva", anterior: 200, creditos: 0, debitos: 0 },
    ];
    const seguinte = res(repartido);
    expect(seguinte.dados.financeiro.fundos).toEqual([
      { id: "o", fundo: "Ordinária", anterior: 800, creditos: 200, debitos: 150 },
      { id: "r", fundo: "Fundo de reserva", anterior: 200, creditos: 100, debitos: 100 },
    ]);
    expect(seguinte.avisos).toEqual([]);
  });

  it("OS: filtra pelo prédio (a API às vezes ignora o filtro) e tira os 'somente registro'", () => {
    const { os, avisos } = mapearOS(
      [
        { cd_condominio: "1006", nm_atividadetipo: "Preventiva", nm_statusatividade: "Concluída", dt_fimocorrencia: "2026-10-05", dt_conclusao: "2026-10-04" },
        { cd_condominio: "1006", nm_atividadetipo: "Somente Registro", nm_statusatividade: "Concluída", dt_conclusao: "2026-10-04" },
        { cd_condominio: "1014", nm_atividadetipo: "Preventiva", nm_statusatividade: "Cancelada" },
        { cd_condominio: "1006", nm_atividadetipo: "Corretiva", nm_statusatividade: "CANCELADA C/ JUSTIFICATIVA" },
      ],
      OUT,
      HOJE,
      "1006",
    );
    expect(os.total).toBe(2);
    expect(os.situacao).toMatchObject({ concluidasNoPrazo: 1, canceladas: 1 });
    expect(avisos.some((a) => a.includes("somente registro"))).toBe(true);
  });

  it("documentos: tira a numeração interna do título", () => {
    const docs = mapearDocumentos([
      { empreendimento: [{ empreendimentoId: 122, documentoTipo: [{ documentoTipoNome: "AVCB", documento: [{ documentoTitulo: "001.2.1-AVCB - Auto de Vistoria do Corpo de Bombeiros", dataValidade: "2027-01-05T00:00:00" }] }] }] },
    ]);
    expect(docs[0].documento).toBe("AVCB - Auto de Vistoria do Corpo de Bombeiros");
  });
});

describe("paginação real da API", () => {
  it("começa no PageIndex 0 e busca as demais em paralelo pelo totalPages", async () => {
    const pedidas: number[] = [];
    const fetchFalso = vi.fn(async (url: string) => {
      if (url.endsWith("/Login")) return new Response('"aaa.bbb.cccccccccccccccccccccccc"', { status: 200 });
      const pagina = Number(new URL(url).searchParams.get("PageIndex"));
      pedidas.push(pagina);
      const itens = pagina < 2 ? 500 : 120; // 3 páginas: 0, 1, 2
      const data = Array.from({ length: itens }, (_, i) => ({ id_recibo: pagina * 1000 + i }));
      return new Response(JSON.stringify({ success: true, data, totalPages: 3, pageIndex: pagina }), { status: 200 });
    });
    const c = criarClienteLF({ usuario: "u", senha: "s", fetch: fetchFalso as unknown as typeof fetch });
    const todos = await c.paginar<{ id_recibo: number }>("/Boleto/ListaBoleto", {}, { chave: (b) => b.id_recibo });
    expect(pedidas.sort()).toEqual([0, 1, 2]);
    expect(todos).toHaveLength(1120);
  });

  it("acordo cancelado não entra", () => {
    const r = mapearAcordos([
      { cdUnidade: "0201", resumoAcordo: { status: "Cancelado", quantidadeParcelas: 1, total: 100 } },
      { cdUnidade: "0202", resumoAcordo: { status: "Ativo", quantidadeParcelas: 6, total: 600 }, detalhesParcelas: [{ pagamento: "2026-09-10", valorRecebido: 100 }] },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ unidade: "0202", parcelas: 6, parcelasPagas: 1 });
  });
});

describe("sincronizar empreendimentos com o LiveFacilities", () => {
  it("casa por código, depois por nome; o resto é novo", async () => {
    const { planejarSincronizacao } = await import("@/lib/sincronizarEmpreendimentos");
    const emp = (nome: string, cd: string | null, id: number | null = null) =>
      ({ id: nome, nome, lf_cd_condominio: cd, lf_id_empreendimento: id }) as never;
    const plano = planejarSincronizacao(
      [emp("Torre Alfa", "2001", 501), emp("Torre Beta", null), emp("Torre Gama", "2003", null)],
      [
        { idEmpreendimento: 501, cdCondominio: "2001", nome: "Torre Alfa" },
        { idEmpreendimento: 502, cdCondominio: "2002", nome: "TORRE BETA" },
        { idEmpreendimento: 503, cdCondominio: "2003", nome: "TORRE GAMA" },
        { idEmpreendimento: null, cdCondominio: "2004", nome: "Torre Delta" },
      ],
    );
    expect(plano.map((a) => a.tipo)).toEqual(["ok", "vincular", "completar_id", "criar"]);
  });
});
