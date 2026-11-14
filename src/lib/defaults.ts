/**
 * Modelo do relatório novo e a regra de "puxar do mês anterior".
 *
 * O maior ganho de tempo do gestor está aqui: contratos, documentos, sistemas,
 * fornecedores e grupos contábeis praticamente não mudam de um mês para o
 * outro. Ao herdar a estrutura e zerar apenas os valores do período, o
 * trabalho mensal deixa de ser "montar o relatório" e vira "atualizar números".
 */

import type { DadosRelatorio, Foto, LinhaCertidao } from "./types";


export const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** As cinco certidões do condomínio que o RGM corporativo acompanha. */
export const certidoesPadrao = (): LinhaCertidao[] => [
  { id: novoId(), certidao: "CND Federal e Dívida Ativa da União", orgao: "Receita Federal / PGFN", validade: "" },
  { id: novoId(), certidao: "CRF — Regularidade do FGTS", orgao: "Caixa Econômica Federal", validade: "" },
  { id: novoId(), certidao: "CNDT — Débitos Trabalhistas", orgao: "Tribunal Superior do Trabalho", validade: "" },
  { id: novoId(), certidao: "CND Estadual", orgao: "Secretaria da Fazenda do Estado", validade: "" },
  { id: novoId(), certidao: "CND Municipal", orgao: "Prefeitura Municipal", validade: "" },
];

/** Relatório em branco com o esqueleto típico de um ativo administrado. */
const situacaoOSZerada = () => ({
  concluidasNoPrazo: 0,
  concluidasComAtraso: 0,
  abertasNoPrazo: 0,
  abertasAtrasadas: 0,
  canceladas: 0,
});

export const relatorioEmBranco = (): DadosRelatorio => ({
  versao: 5,
  competenciaFinanceira: "",
  sumario: { avaliacaoGeral: "", principaisResultados: [], pontosAtencao: [] },
  financeiro: {
    fundos: [
      { id: novoId(), fundo: "Ordinária", anterior: 0, creditos: 0, debitos: 0 },
      { id: novoId(), fundo: "Fundo de reserva", anterior: 0, creditos: 0, debitos: 0 },
      { id: novoId(), fundo: "Fundo privativo / reembolsável", anterior: 0, creditos: 0, debitos: 0 },
    ],
    grupos: [
      { id: novoId(), grupo: "Tarifas públicas e concessionárias", orcado: 0, realizado: 0, observacao: "" },
      { id: novoId(), grupo: "Contratos de manutenção", orcado: 0, realizado: 0, observacao: "" },
      { id: novoId(), grupo: "Segurança patrimonial e incêndio", orcado: 0, realizado: 0, observacao: "" },
      { id: novoId(), grupo: "Limpeza e sanificação", orcado: 0, realizado: 0, observacao: "" },
      { id: novoId(), grupo: "Despesas administrativas", orcado: 0, realizado: 0, observacao: "" },
    ],
    arrecadacao: { emitido: 0, recebido: 0 },
    conciliacao: "",
    comentario: "",
  },
  operacao: {
    ocorrencias: [],
    resumo: { preventivas: 0, corretivas: 0, acompanhamentos: 0, rondas: 0, naoRealizadas: 0 },
    situacaoOS: situacaoOSZerada(),
    disciplinas: [
      { id: novoId(), disciplina: "Elétrica", quantidade: 0 },
      { id: novoId(), disciplina: "Hidráulica", quantidade: 0 },
      { id: novoId(), disciplina: "Civil", quantidade: 0 },
      { id: novoId(), disciplina: "CFTV", quantidade: 0 },
    ],
    acessosFixos: 0,
    acessosVisitantes: 0,
    ocupacao: 0,
    comentario: "",
  },
  fornecedores: { linhas: [], comentario: "" },
  contratos: { linhas: [], comentario: "" },
  documentos: {
    linhas: [
      { id: novoId(), documento: "CND — Receita Federal", orgao: "Receita Federal", validade: "", observacao: "" },
      { id: novoId(), documento: "CRF do FGTS", orgao: "Caixa Econômica Federal", validade: "", observacao: "" },
      { id: novoId(), documento: "CNDT — Débitos Trabalhistas", orgao: "TST", validade: "", observacao: "" },
      { id: novoId(), documento: "AVCB", orgao: "Corpo de Bombeiros", validade: "", observacao: "" },
    ],
    comentario: "",
  },
  juridico: {
    processos: [],
    inadimplencia: {
      rubricas: [
        { id: novoId(), rubrica: "Ordinária", ateAnterior: 0, recebido: 0, doMes: 0 },
        { id: novoId(), rubrica: "Fundo de reserva", ateAnterior: 0, recebido: 0, doMes: 0 },
        { id: novoId(), rubrica: "Fundo privativo / reembolsável", ateAnterior: 0, recebido: 0, doMes: 0 },
      ],
    },
    acordos: [],
    certidoes: certidoesPadrao(),
    escritorio: "",
    comentario: "",
  },
  utilidades: {
    linhas: [
      { id: novoId(), utilidade: "Água", unidade: "m³", consumo: 0, consumoAnterior: 0, ponta: 0, foraPonta: 0, faltas: 0, detalhamento: "", fatura: 0, faturaAnterior: 0, observacao: "" },
      { id: novoId(), utilidade: "Energia", unidade: "kWh", consumo: 0, consumoAnterior: 0, ponta: 0, foraPonta: 0, faltas: 0, detalhamento: "", fatura: 0, faturaAnterior: 0, observacao: "" },
    ],
    comentario: "",
  },
  suprimentos: { pedidos: [], comentario: "" },
  capex: { linhas: [], comentario: "" },
  valorGerado: { linhas: [] },
  riscos: { linhas: [], comentario: "" },
  proximosPassos: { linhas: [], comentario: "" },
  fotos: [],
  conclusao: "",
  importacao: null,
  arquivosImportados: [],
});

/** Pedido que ainda corre: continua no relatório seguinte até finalizar. */
export const pedidoEmAberto = (status: string) => !/finaliz|cancel|recus|reprov|entreg|conclu/i.test(status);

/**
 * Herda a ESTRUTURA do mês anterior e zera o que é do período.
 *
 * Continua: grupos contábeis e seu orçado, contratos, documentos e validades,
 * fornecedores, utilidades cadastradas, CAPEX e riscos ainda abertos.
 * Reinicia: valores realizados, ocorrências, comentários, fotos, conclusão.
 * Encadeia: inadimplência do mês passado vira posição inicial; consumo e
 * fatura do mês viram a base de comparação — a variação se monta sozinha.
 */
export const herdarDoMesAnterior = (ant: DadosRelatorio): DadosRelatorio => ({
  versao: 5,
  competenciaFinanceira: "",
  sumario: { avaliacaoGeral: "", principaisResultados: [], pontosAtencao: [] },
  financeiro: {
    // Encadeamento contábil por fundo: o saldo de fechamento abre o mês seguinte
    fundos: ant.financeiro.fundos.map((f) => ({
      id: novoId(),
      fundo: f.fundo,
      anterior: f.anterior + f.creditos - f.debitos,
      creditos: 0,
      debitos: 0,
    })),
    grupos: ant.financeiro.grupos.map((g) => ({
      ...g,
      id: novoId(),
      orcado: g.orcado, // orçamento anual se repete
      realizado: 0,
      observacao: "",
    })),
    arrecadacao: { emitido: 0, recebido: 0 },
    conciliacao: "",
    comentario: "",
  },
  operacao: {
    ocorrencias: [], // ocorrências são sempre do mês
    resumo: { preventivas: 0, corretivas: 0, acompanhamentos: 0, rondas: 0, naoRealizadas: 0 },
    situacaoOS: situacaoOSZerada(),
    // as disciplinas acompanhadas continuam; só a contagem zera
    disciplinas: ant.operacao.disciplinas.map((d) => ({ ...d, id: novoId(), quantidade: 0 })),
    acessosFixos: 0,
    acessosVisitantes: 0,
    ocupacao: ant.operacao.ocupacao, // muda pouco; parte de onde parou
    comentario: "",
  },
  fornecedores: {
    linhas: ant.fornecedores.linhas.map((f) => ({ ...f, id: novoId(), realizado: 0, sla: 0 })),
    comentario: "",
  },
  contratos: {
    // contratos seguem valendo — nada a redigitar
    linhas: ant.contratos.linhas.map((c) => ({ ...c, id: novoId() })),
    comentario: "",
  },
  documentos: {
    // documentos e validades seguem valendo; o status se recalcula pela data
    linhas: ant.documentos.linhas.map((d) => ({ ...d, id: novoId(), observacao: "" })),
    comentario: "",
  },
  juridico: {
    processos: ant.juridico.processos.map((p) => ({ ...p, id: novoId(), andamento: "" })),
    inadimplencia: {
      // encadeamento por rubrica: o total consolidado vira a posição de abertura
      rubricas: ant.juridico.inadimplencia.rubricas.map((r) => ({
        id: novoId(),
        rubrica: r.rubrica,
        ateAnterior: r.ateAnterior - r.recebido + r.doMes,
        recebido: 0,
        doMes: 0,
      })),
    },
    // acordos em curso continuam sendo acompanhados até a quitação
    acordos: ant.juridico.acordos
      .filter((a) => !/quitad|cancel|encerrad/i.test(a.status))
      .map((a) => ({ ...a, id: novoId() })),
    // certidões e escritório seguem; a validade se recalcula pela data
    certidoes: ant.juridico.certidoes.map((c) => ({ ...c, id: novoId() })),
    escritorio: ant.juridico.escritorio,
    comentario: "",
  },
  utilidades: {
    linhas: ant.utilidades.linhas.map((u) => ({
      ...u,
      id: novoId(),
      consumoAnterior: u.consumo, // a base de comparação se monta sozinha
      faturaAnterior: u.fatura,
      consumo: 0,
      fatura: 0,
      ponta: 0,
      foraPonta: 0,
      faltas: 0,
      detalhamento: "",
      observacao: "",
    })),
    comentario: "",
  },
  suprimentos: {
    // pedidos ainda em curso continuam; os finalizados ficam no mês em que fecharam
    pedidos: ant.suprimentos.pedidos.filter((p) => pedidoEmAberto(p.status)).map((p) => ({ ...p, id: novoId() })),
    comentario: "",
  },
  capex: {
    // concluídos saem de cena; os em andamento continuam sendo acompanhados
    linhas: ant.capex.linhas
      .filter((c) => c.status !== "concluido")
      .map((c) => ({ ...c, id: novoId() })),
    comentario: "",
  },
  // valor gerado é do período; projeções ainda não realizadas continuam no radar
  valorGerado: {
    linhas: ant.valorGerado.linhas.filter((v) => v.tipo === "projetado").map((v) => ({ ...v, id: novoId() })),
  },
  riscos: {
    // o action log continua; o que foi concluído no mês passado sai
    linhas: ant.riscos.linhas.filter((r) => r.status !== "concluida").map((r) => ({ ...r, id: novoId() })),
    comentario: "",
  },
  proximosPassos: {
    // pendências não resolvidas atravessam o mês
    linhas: ant.proximosPassos.linhas
      .filter((p) => !/conclu|resolvid|encerrad/i.test(p.status))
      .map((p) => ({ ...p, id: novoId() })),
    comentario: "",
  },
  fotos: [],
  conclusao: "",
  importacao: null,
  arquivosImportados: [],
});

/* -------------------------------------------------------------------------- */
/* Normalização defensiva do JSONB vindo do banco                              */
/* -------------------------------------------------------------------------- */

const num = (v: unknown, padrao = 0) => (typeof v === "number" && Number.isFinite(v) ? v : padrao);
const txt = (v: unknown, padrao = "") => (typeof v === "string" ? v : padrao);
const bool = (v: unknown, padrao = false) => (typeof v === "boolean" ? v : padrao);
const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const umDe = <T extends string>(v: unknown, opcoes: readonly T[], padrao: T): T =>
  opcoes.includes(v as T) ? (v as T) : padrao;

const CRITICIDADES = ["baixa", "media", "alta"] as const;

/**
 * Protege contra relatórios gravados por versões anteriores do app e contra
 * campos removidos manualmente. Nunca lança — no pior caso devolve o branco.
 */
export const normalizarDados = (bruto: unknown): DadosRelatorio => {
  const base = relatorioEmBranco();
  if (!bruto || typeof bruto !== "object") return base;

  const d = bruto as Partial<DadosRelatorio>;

  // Migração v2 -> v3: antes receita/despesa/saldo eram campos avulsos e a
  // inadimplência eram três números. Vira uma linha "Geral" para nada se perder.
  const v2 = bruto as {
    financeiro?: { receita?: unknown; despesa?: unknown; saldoConta?: unknown };
    juridico?: { inadimplencia?: { posicaoAnterior?: unknown; recebidoNoMes?: unknown; emAtrasoNoMes?: unknown } };
  };
  const temFundos = Array.isArray(d.financeiro?.fundos) && d.financeiro.fundos.length > 0;
  const fundosMigrados: DadosRelatorio["financeiro"]["fundos"] =
    !temFundos && (num(v2.financeiro?.receita) || num(v2.financeiro?.despesa) || num(v2.financeiro?.saldoConta))
      ? [
          {
            id: novoId(),
            fundo: "Geral",
            anterior:
              num(v2.financeiro?.saldoConta) - num(v2.financeiro?.receita) + num(v2.financeiro?.despesa),
            creditos: num(v2.financeiro?.receita),
            debitos: num(v2.financeiro?.despesa),
          },
        ]
      : [];

  const temRubricas = Array.isArray(d.juridico?.inadimplencia?.rubricas);
  const rubricasMigradas: DadosRelatorio["juridico"]["inadimplencia"]["rubricas"] =
    !temRubricas && v2.juridico?.inadimplencia
      ? [
          {
            id: novoId(),
            rubrica: "Geral",
            ateAnterior: num(v2.juridico.inadimplencia.posicaoAnterior),
            recebido: num(v2.juridico.inadimplencia.recebidoNoMes),
            doMes: num(v2.juridico.inadimplencia.emAtrasoNoMes),
          },
        ]
      : [];

  return {
    versao: 5,
    competenciaFinanceira: /^\d{4}-\d{2}-01$/.test(txt(d.competenciaFinanceira)) ? txt(d.competenciaFinanceira) : "",
    sumario: {
      avaliacaoGeral: txt(d.sumario?.avaliacaoGeral),
      principaisResultados: lista<string>(d.sumario?.principaisResultados).filter(
        (x) => typeof x === "string",
      ),
      pontosAtencao: lista<string>(d.sumario?.pontosAtencao).filter((x) => typeof x === "string"),
    },
    financeiro: {
      fundos: temFundos
        ? lista<Record<string, unknown>>(d.financeiro!.fundos).map((f) => ({
            id: txt(f?.id, novoId()),
            fundo: txt(f?.fundo),
            anterior: num(f?.anterior),
            creditos: num(f?.creditos),
            debitos: num(f?.debitos),
          }))
        : fundosMigrados.length > 0
          ? fundosMigrados
          : base.financeiro.fundos,
      grupos: d.financeiro?.grupos
        ? lista<Record<string, unknown>>(d.financeiro.grupos).map((g) => ({
            id: txt(g?.id, novoId()),
            grupo: txt(g?.grupo),
            orcado: num(g?.orcado),
            realizado: num(g?.realizado),
            observacao: txt(g?.observacao),
          }))
        : base.financeiro.grupos,
      arrecadacao: {
        emitido: num(d.financeiro?.arrecadacao?.emitido),
        recebido: num(d.financeiro?.arrecadacao?.recebido),
      },
      conciliacao: txt(d.financeiro?.conciliacao),
      comentario: txt(d.financeiro?.comentario),
    },
    operacao: {
      ocorrencias: lista<Record<string, unknown>>(d.operacao?.ocorrencias).map((o) => ({
        id: txt(o?.id, novoId()),
        ocorrencia: txt(o?.ocorrencia),
        tipo: umDe(o?.tipo, ["preventiva", "corretiva", "melhoria"] as const, "preventiva"),
        acao: txt(o?.acao),
        resultado: txt(o?.resultado),
        concluida: bool(o?.concluida, true),
      })),
      resumo: {
        preventivas: num(d.operacao?.resumo?.preventivas),
        corretivas: num(d.operacao?.resumo?.corretivas),
        acompanhamentos: num(d.operacao?.resumo?.acompanhamentos),
        rondas: num(d.operacao?.resumo?.rondas),
        naoRealizadas: num(d.operacao?.resumo?.naoRealizadas),
      },
      situacaoOS: {
        concluidasNoPrazo: num(d.operacao?.situacaoOS?.concluidasNoPrazo),
        concluidasComAtraso: num(d.operacao?.situacaoOS?.concluidasComAtraso),
        abertasNoPrazo: num(d.operacao?.situacaoOS?.abertasNoPrazo),
        abertasAtrasadas: num(d.operacao?.situacaoOS?.abertasAtrasadas),
        canceladas: num(d.operacao?.situacaoOS?.canceladas),
      },
      disciplinas: Array.isArray(d.operacao?.disciplinas)
        ? lista<Record<string, unknown>>(d.operacao.disciplinas).map((x) => ({
            id: txt(x?.id, novoId()),
            disciplina: txt(x?.disciplina),
            quantidade: num(x?.quantidade),
          }))
        : base.operacao.disciplinas,
      acessosFixos: num(d.operacao?.acessosFixos),
      acessosVisitantes: num(d.operacao?.acessosVisitantes),
      ocupacao: num(d.operacao?.ocupacao),
      comentario: txt(d.operacao?.comentario),
    },
    fornecedores: {
      linhas: lista<Record<string, unknown>>(d.fornecedores?.linhas).map((f) => ({
        id: txt(f?.id, novoId()),
        fornecedor: txt(f?.fornecedor),
        disciplina: txt(f?.disciplina),
        realizado: num(f?.realizado),
        unidade: txt(f?.unidade, "OS"),
        sla: num(f?.sla),
        criticidade: umDe(f?.criticidade, CRITICIDADES, "media"),
      })),
      comentario: txt(d.fornecedores?.comentario),
    },
    contratos: {
      linhas: lista<Record<string, unknown>>(d.contratos?.linhas).map((c) => ({
        id: txt(c?.id, novoId()),
        fornecedor: txt(c?.fornecedor),
        objeto: txt(c?.objeto),
        situacao: umDe(c?.situacao, ["vigente", "vencido", "em_renovacao"] as const, "vigente"),
        vencimento: txt(c?.vencimento),
        observacao: txt(c?.observacao),
      })),
      comentario: txt(d.contratos?.comentario),
    },
    documentos: {
      linhas: d.documentos?.linhas
        ? lista<Record<string, unknown>>(d.documentos.linhas).map((l) => ({
            id: txt(l?.id, novoId()),
            documento: txt(l?.documento),
            orgao: txt(l?.orgao),
            validade: txt(l?.validade),
            permanente: bool(l?.permanente),
            observacao: txt(l?.observacao),
          }))
        : base.documentos.linhas,
      comentario: txt(d.documentos?.comentario),
    },
    juridico: {
      processos: lista<Record<string, unknown>>(d.juridico?.processos).map((p) => ({
        id: txt(p?.id, novoId()),
        numero: txt(p?.numero),
        vara: txt(p?.vara),
        tipo: txt(p?.tipo),
        objeto: txt(p?.objeto),
        andamento: txt(p?.andamento),
        proximaData: txt(p?.proximaData),
        criticidade: umDe(p?.criticidade, CRITICIDADES, "media"),
        valor: num(p?.valor),
        prognostico: umDe(p?.prognostico, ["provavel", "possivel", "remoto", "nao_apurado"] as const, "nao_apurado"),
      })),
      inadimplencia: {
        rubricas: temRubricas
          ? lista<Record<string, unknown>>(d.juridico!.inadimplencia!.rubricas).map((r) => ({
              id: txt(r?.id, novoId()),
              rubrica: txt(r?.rubrica),
              ateAnterior: num(r?.ateAnterior),
              recebido: num(r?.recebido),
              doMes: num(r?.doMes),
            }))
          : rubricasMigradas.length > 0
            ? rubricasMigradas
            : base.juridico.inadimplencia.rubricas,
      },
      acordos: lista<Record<string, unknown>>(d.juridico?.acordos).map((a) => ({
        id: txt(a?.id, novoId()),
        unidade: txt(a?.unidade),
        devedor: txt(a?.devedor),
        parcelas: num(a?.parcelas),
        parcelasPagas: num(a?.parcelasPagas),
        valor: num(a?.valor),
        valorPago: num(a?.valorPago),
        status: txt(a?.status),
      })),
      certidoes: Array.isArray(d.juridico?.certidoes)
        ? lista<Record<string, unknown>>(d.juridico!.certidoes).map((c) => ({
            id: txt(c?.id, novoId()),
            certidao: txt(c?.certidao),
            orgao: txt(c?.orgao),
            validade: txt(c?.validade),
            positiva: bool(c?.positiva),
          }))
        : base.juridico.certidoes,
      escritorio: txt(d.juridico?.escritorio),
      comentario: txt(d.juridico?.comentario),
    },
    utilidades: {
      linhas: d.utilidades?.linhas
        ? lista<Record<string, unknown>>(d.utilidades.linhas).map((u) => ({
            id: txt(u?.id, novoId()),
            utilidade: txt(u?.utilidade),
            unidade: txt(u?.unidade),
            consumo: num(u?.consumo),
            consumoAnterior: num(u?.consumoAnterior),
            ponta: num(u?.ponta),
            foraPonta: num(u?.foraPonta),
            faltas: num(u?.faltas),
            detalhamento: txt(u?.detalhamento),
            fatura: num(u?.fatura),
            faturaAnterior: num(u?.faturaAnterior),
            observacao: txt(u?.observacao),
          }))
        : base.utilidades.linhas,
      comentario: txt(d.utilidades?.comentario),
    },
    suprimentos: {
      pedidos: lista<Record<string, unknown>>(d.suprimentos?.pedidos).map((p) => ({
        id: txt(p?.id, novoId()),
        pedido: txt(p?.pedido),
        categoria: txt(p?.categoria),
        grupo: txt(p?.grupo),
        status: txt(p?.status),
        valor: num(p?.valor),
        solicitacao: txt(p?.solicitacao),
        prazo: txt(p?.prazo),
      })),
      comentario: txt(d.suprimentos?.comentario),
    },
    capex: {
      linhas: lista<Record<string, unknown>>(d.capex?.linhas).map((c) => ({
        id: txt(c?.id, novoId()),
        iniciativa: txt(c?.iniciativa),
        orcado: num(c?.orcado),
        realizado: num(c?.realizado),
        status: umDe(c?.status, ["planejado", "em_andamento", "concluido"] as const, "planejado"),
        beneficio: txt(c?.beneficio),
      })),
      comentario: txt(d.capex?.comentario),
    },
    valorGerado: {
      linhas: lista<Record<string, unknown>>(d.valorGerado?.linhas).map((v) => ({
        id: txt(v?.id, novoId()),
        tipo: umDe(v?.tipo, ["realizado", "estimado", "projetado", "investido"] as const, "realizado"),
        valor: num(v?.valor),
        descricao: txt(v?.descricao),
        periodicidade: txt(v?.periodicidade),
        observacao: txt(v?.observacao),
      })),
    },
    riscos: {
      linhas: lista<Record<string, unknown>>(d.riscos?.linhas).map((r) => ({
        id: txt(r?.id, novoId()),
        assunto: txt(r?.assunto),
        criticidade: umDe(r?.criticidade, CRITICIDADES, "media"),
        consequencia: txt(r?.consequencia),
        acao: txt(r?.acao),
        responsavel: txt(r?.responsavel),
        prazo: txt(r?.prazo),
        status: umDe(r?.status, ["em_andamento", "concluida", "outra"] as const, "em_andamento"),
      })),
      comentario: txt(d.riscos?.comentario),
    },
    proximosPassos: {
      linhas: lista<Record<string, unknown>>(d.proximosPassos?.linhas).map((p) => ({
        id: txt(p?.id, novoId()),
        decisao: txt(p?.decisao),
        prazo: txt(p?.prazo),
        status: txt(p?.status),
        dependeDoCliente: bool(p?.dependeDoCliente),
      })),
      comentario: txt(d.proximosPassos?.comentario),
    },
    fotos: lista<Foto>(d.fotos)
      .filter((f) => f && typeof f.path === "string")
      .map((f) => ({
        id: txt(f?.id, novoId()),
        path: f.path,
        legenda: txt(f?.legenda),
        categoria: umDe(
          f?.categoria,
          ["melhoria", "ocorrencia", "manutencao", "geral"] as const,
          "geral",
        ),
      })),
    conclusao: txt(d.conclusao),
    importacao: normalizarImportacao(d.importacao),
    origemDados:
      d.origemDados && typeof d.origemDados === "object"
        ? { linhas: { ...(d.origemDados.linhas ?? {}) }, blocos: { ...(d.origemDados.blocos ?? {}) } }
        : undefined,
    arquivosImportados: lista<Record<string, unknown>>(d.arquivosImportados)
      .filter((a) => a && typeof a.titulo === "string")
      .map((a) => ({
        nome: txt(a.nome),
        titulo: txt(a.titulo),
        competencia: txt(a.competencia),
        em: txt(a.em),
        secoes: lista<string>(a.secoes).filter((x) => typeof x === "string"),
      })),
  };
};

const normalizarImportacao = (v: unknown): DadosRelatorio["importacao"] => {
  if (!v || typeof v !== "object") return null;
  const i = v as Record<string, unknown>;
  if (typeof i.em !== "string") return null;
  return {
    fonte: txt(i.fonte, "LiveFacilities"),
    em: i.em,
    secoes: lista<string>(i.secoes).filter((x) => typeof x === "string"),
    avisos: lista<string>(i.avisos).filter((x) => typeof x === "string"),
  };
};
