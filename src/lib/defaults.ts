/**
 * Modelo do relatório novo e a regra de "puxar do mês anterior".
 *
 * O maior ganho de tempo do gestor está aqui: contratos, documentos, sistemas,
 * fornecedores e grupos contábeis praticamente não mudam de um mês para o
 * outro. Ao herdar a estrutura e zerar apenas os valores do período, o
 * trabalho mensal deixa de ser "montar o relatório" e vira "atualizar números".
 */

import type { DadosRelatorio, Foto } from "./types";

export const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Relatório em branco com o esqueleto típico de um ativo administrado. */
export const relatorioEmBranco = (): DadosRelatorio => ({
  versao: 2,
  sumario: { avaliacaoGeral: "", principaisResultados: [], pontosAtencao: [] },
  financeiro: {
    receita: 0,
    despesa: 0,
    saldoConta: 0,
    grupos: [
      { id: novoId(), grupo: "Tarifas públicas e concessionárias", orcado: 0, realizado: 0, observacao: "" },
      { id: novoId(), grupo: "Contratos de manutenção", orcado: 0, realizado: 0, observacao: "" },
      { id: novoId(), grupo: "Segurança patrimonial e incêndio", orcado: 0, realizado: 0, observacao: "" },
      { id: novoId(), grupo: "Limpeza e sanificação", orcado: 0, realizado: 0, observacao: "" },
      { id: novoId(), grupo: "Despesas administrativas", orcado: 0, realizado: 0, observacao: "" },
    ],
    comentario: "",
  },
  operacao: { ocorrencias: [], acessosFixos: 0, acessosVisitantes: 0, ocupacao: 0, comentario: "" },
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
    inadimplencia: { posicaoAnterior: 0, recebidoNoMes: 0, emAtrasoNoMes: 0 },
    comentario: "",
  },
  utilidades: {
    linhas: [
      { id: novoId(), utilidade: "Água", unidade: "m³", consumo: 0, consumoAnterior: 0, detalhamento: "", fatura: 0, faturaAnterior: 0, observacao: "" },
      { id: novoId(), utilidade: "Energia", unidade: "kWh", consumo: 0, consumoAnterior: 0, detalhamento: "", fatura: 0, faturaAnterior: 0, observacao: "" },
    ],
    comentario: "",
  },
  capex: { linhas: [], comentario: "" },
  riscos: { linhas: [], comentario: "" },
  proximosPassos: { linhas: [], comentario: "" },
  fotos: [],
  conclusao: "",
});

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
  versao: 2,
  sumario: { avaliacaoGeral: "", principaisResultados: [], pontosAtencao: [] },
  financeiro: {
    receita: 0,
    despesa: 0,
    saldoConta: ant.financeiro.saldoConta, // saldo final abre o mês seguinte
    grupos: ant.financeiro.grupos.map((g) => ({
      ...g,
      id: novoId(),
      orcado: g.orcado, // orçamento anual se repete
      realizado: 0,
      observacao: "",
    })),
    comentario: "",
  },
  operacao: {
    ocorrencias: [], // ocorrências são sempre do mês
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
      // encadeamento: o total consolidado vira a posição de abertura
      posicaoAnterior:
        ant.juridico.inadimplencia.posicaoAnterior -
        ant.juridico.inadimplencia.recebidoNoMes +
        ant.juridico.inadimplencia.emAtrasoNoMes,
      recebidoNoMes: 0,
      emAtrasoNoMes: 0,
    },
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
      detalhamento: "",
      observacao: "",
    })),
    comentario: "",
  },
  capex: {
    // concluídos saem de cena; os em andamento continuam sendo acompanhados
    linhas: ant.capex.linhas
      .filter((c) => c.status !== "concluido")
      .map((c) => ({ ...c, id: novoId() })),
    comentario: "",
  },
  riscos: {
    linhas: ant.riscos.linhas.map((r) => ({ ...r, id: novoId() })),
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

  return {
    versao: 2,
    sumario: {
      avaliacaoGeral: txt(d.sumario?.avaliacaoGeral),
      principaisResultados: lista<string>(d.sumario?.principaisResultados).filter(
        (x) => typeof x === "string",
      ),
      pontosAtencao: lista<string>(d.sumario?.pontosAtencao).filter((x) => typeof x === "string"),
    },
    financeiro: {
      receita: num(d.financeiro?.receita),
      despesa: num(d.financeiro?.despesa),
      saldoConta: num(d.financeiro?.saldoConta),
      grupos: d.financeiro?.grupos
        ? lista<Record<string, unknown>>(d.financeiro.grupos).map((g) => ({
            id: txt(g?.id, novoId()),
            grupo: txt(g?.grupo),
            orcado: num(g?.orcado),
            realizado: num(g?.realizado),
            observacao: txt(g?.observacao),
          }))
        : base.financeiro.grupos,
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
        objeto: txt(p?.objeto),
        andamento: txt(p?.andamento),
        proximaData: txt(p?.proximaData),
        criticidade: umDe(p?.criticidade, CRITICIDADES, "media"),
      })),
      inadimplencia: {
        posicaoAnterior: num(d.juridico?.inadimplencia?.posicaoAnterior),
        recebidoNoMes: num(d.juridico?.inadimplencia?.recebidoNoMes),
        emAtrasoNoMes: num(d.juridico?.inadimplencia?.emAtrasoNoMes),
      },
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
            detalhamento: txt(u?.detalhamento),
            fatura: num(u?.fatura),
            faturaAnterior: num(u?.faturaAnterior),
            observacao: txt(u?.observacao),
          }))
        : base.utilidades.linhas,
      comentario: txt(d.utilidades?.comentario),
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
    riscos: {
      linhas: lista<Record<string, unknown>>(d.riscos?.linhas).map((r) => ({
        id: txt(r?.id, novoId()),
        assunto: txt(r?.assunto),
        criticidade: umDe(r?.criticidade, CRITICIDADES, "media"),
        acao: txt(r?.acao),
        responsavel: txt(r?.responsavel),
        prazo: txt(r?.prazo),
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
  };
};
