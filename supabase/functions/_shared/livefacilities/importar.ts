/**
 * Importa uma competência inteira do LiveFacilities para o formato `DadosLF`.
 *
 * Cada consulta roda isolada: se uma falhar (rota sem permissão, timeout),
 * as outras seguem e a falha vira aviso — o gestor recebe o que deu para
 * puxar e preenche o resto. Nada aqui grava no LiveFacilities.
 */

import type { ClienteLF } from "./cliente.ts";
import { ErroLF } from "./cliente.ts";
import {
  mapearAcordos,
  mapearArrecadacao,
  mapearContratos,
  mapearDespesas,
  mapearDocumentos,
  mapearFechamento,
  mapearFluxoCaixa,
  mapearInadimplencia,
  mapearOS,
  periodoDaCompetencia,
} from "./mapear.ts";
import type {
  AcordoLF,
  AtividadeLF,
  BoletoLF,
  ConsultaLF,
  ContratoLF,
  DadosLF,
  DespesasSaidaLF,
  DocumentoListaLF,
  FechamentoLF,
  FluxoCaixaLF,
  ResultadoImportacaoLF,
  ResumoEmissaoLF,
  RetornoLF,
} from "./tipos.ts";

export interface AlvoImportacao {
  /** null = prédio só com operação no LiveFacilities (sem financeiro/documentos). */
  idEmpreendimento: number | null;
  cdCondominio: string;
  /** YYYY-MM-01 (ou YYYY-MM) — mês operacional do relatório. */
  competencia: string;
  /**
   * Mês da prestação de contas usada no financeiro. O RGM de outubro mostra o
   * financeiro de setembro (última prestação fechada). Padrão: mês anterior.
   */
  competenciaFinanceira?: string;
}

const normalizarCompetencia = (c: string) => (c.length === 7 ? `${c}-01` : c);

const mesAnterior = (c: string) => {
  const [a, m] = c.split("-").map(Number);
  return m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, "0")}-01`;
};

/**
 * Anos de vencimento considerados na inadimplência. A consulta só traz boletos
 * em aberto e os pagos depois do mês anterior, então pode ir longe: há prédios
 * com dívida aberta há muitos anos.
 */
const ANOS_HISTORICO_BOLETOS = 15;
/** Período amplo para as rotas que exigem datas mas onde queremos "tudo vigente". */
const PERIODO_AMPLO = { inicio: "2000-01-01", fim: "2040-12-31" };

const dados = <T>(r: RetornoLF<T> | null | undefined): T[] => (Array.isArray(r?.data) ? (r!.data as T[]) : []);

/** O envelope às vezes vem com success=false e status 200. "Nenhum resultado" = lista vazia. */
const verificar = <T>(r: RetornoLF<T>, rota: string): RetornoLF<T> => {
  if (r && r.success === false) {
    const msg = r.errors?.detail || r.errors?.errorMessage || r.errors?.title || "resposta com success=false";
    if (/nenhum resultado/i.test(msg)) return { ...r, success: true, data: [] };
    throw new ErroLF(`${rota}: ${msg}`, r.statusCode ?? 200, rota);
  }
  return r;
};

const somarDia = (iso: string, dias: number) => {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
};

/** Janelas mensais [início, fim] entre duas datas. */
const janelasMensais = (inicio: string, fim: string) => {
  const janelas: [string, string][] = [];
  let atual = inicio;
  while (atual <= fim) {
    const [a, m] = atual.split("-").map(Number);
    const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
    janelas.push([atual, ultimo < fim ? ultimo : fim]);
    atual = somarDia(ultimo, 1);
  }
  return janelas;
};

/**
 * Só os boletos que importam para a posição de inadimplência:
 *  - os ainda em aberto (status 1 "Gerado"), vencidos até o fim do mês;
 *  - os pagos DEPOIS do fim do mês anterior (estavam em aberto naquela data),
 *    consultados mês a mês de pagamento.
 *
 * Por que não "todos os boletos": em consultas de muitas páginas a API repete
 * e perde itens entre páginas (sem ordenação estável). Janelas pequenas, de
 * uma ou duas páginas, vêm completas — confirmado contra a API real.
 */
const buscarBoletosRelevantes = async (
  cliente: ClienteLF,
  a: { id: number | null; cd: string; inicioHistorico: string; fimAnterior: string; fim: string; hoje: Date },
): Promise<BoletoLF[]> => {
  const base = {
    id_empreendimento: a.id ?? undefined,
    cd_condominio: a.cd,
    dt_vencimentoinicio: a.inicioHistorico,
    dt_vencimentofinal: a.fim,
    sn_linhadigitavel: false,
  };
  const hojeIso = a.hoje.toISOString().slice(0, 10);
  const consultas = [
    cliente.paginar<BoletoLF>("/Boleto/ListaBoleto", { ...base, ls_boletostatus: 1 }, { chave: (b) => b.id_recibo }),
    ...janelasMensais(somarDia(a.fimAnterior, 1), hojeIso).map(([ini, fim]) =>
      cliente.paginar<BoletoLF>(
        "/Boleto/ListaBoleto",
        { ...base, dt_pagamentoinicio: ini, dt_pagamentofinal: fim },
        { chave: (b) => b.id_recibo },
      ),
    ),
  ];
  const vistos = new Map<number | string, BoletoLF>();
  (await Promise.all(consultas)).flat().forEach((b, i) => vistos.set(b.id_recibo ?? `sem-id-${i}`, b));
  return [...vistos.values()];
};

export const importarCompetencia = async (
  cliente: ClienteLF,
  alvo: AlvoImportacao,
  hoje = new Date(),
): Promise<ResultadoImportacaoLF> => {
  const competencia = normalizarCompetencia(alvo.competencia);
  const periodo = periodoDaCompetencia(competencia);
  const periodoFin = periodoDaCompetencia(
    alvo.competenciaFinanceira ? normalizarCompetencia(alvo.competenciaFinanceira) : mesAnterior(competencia),
  );
  const id = alvo.idEmpreendimento;
  const cd = alvo.cdCondominio;
  const [ano] = competencia.split("-").map(Number);
  const inicioHistorico = `${ano - ANOS_HISTORICO_BOLETOS}-01-01`;

  const resultado: DadosLF = { periodo, periodoFinanceiro: periodoFin };
  const consultas: ConsultaLF[] = [];
  const avisos: string[] = [];

  /** Roda uma consulta, registra o resultado e nunca propaga erro. */
  const etapa = async <T>(nome: string, rota: string, executar: () => Promise<T>, aplicar: (v: T) => number, exigeId = false) => {
    if (exigeId && !id) {
      consultas.push({ nome, rota, ok: false, erro: "empreendimento sem id_empreendimento" });
      return;
    }
    try {
      const valor = await executar();
      const registros = aplicar(valor);
      consultas.push({ nome, rota, ok: true, registros });
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      consultas.push({ nome, rota, ok: false, erro });
      avisos.push(`${nome}: não foi possível consultar — ${erro}`);
    }
  };

  await Promise.all([
    etapa(
      "Ordens de serviço",
      "/OrdemServico/ListaAtividade",
      () =>
        cliente.get<RetornoLF<AtividadeLF>>("/OrdemServico/ListaAtividade", {
          cd_condominio: cd,
          dt_inicio: periodo.inicio,
          dt_fim: periodo.fim,
        }),
      (r) => {
        const itens = dados(verificar(r, "/OrdemServico/ListaAtividade"));
        const { os, avisos: av } = mapearOS(itens, periodo, hoje, cd);
        resultado.os = os;
        avisos.push(...av);
        return itens.length;
      },
    ),

    etapa(
      "Fluxo de caixa",
      "/FluxoCaixa/FluxoCaixa",
      () =>
        cliente.get<RetornoLF<FluxoCaixaLF>>("/FluxoCaixa/FluxoCaixa", {
          id_empreendimento: id ?? undefined,
          cd_empreendimento: cd,
          dt_periodoinicial: periodoFin.inicio,
          dt_periodofinal: periodoFin.fim,
          sn_compromissospagar: false,
          sn_recibodetalheexibe: false,
          sn_anexoexibe: false,
        }),
      (r) => {
        const itens = dados(verificar(r, "/FluxoCaixa/FluxoCaixa"));
        resultado.financeiro = mapearFluxoCaixa(itens, id, cd);
        return itens.length;
      },
    ),

    etapa(
      "Despesas da prestação de contas",
      "/PrestacaoContas/despesas",
      () =>
        cliente.get<DespesasSaidaLF>("/PrestacaoContas/despesas", {
          cd_condominio: cd,
          dt_inicio: periodoFin.inicio,
          dt_fim: periodoFin.fim,
          sn_competencia: true,
        }),
      (r) => {
        if (r?.id_erro) throw new ErroLF(r.ds_mensagemErro || `erro ${r.id_erro}`, 200, "/PrestacaoContas/despesas");
        const itens = Array.isArray(r?.data) ? r.data : [];
        resultado.despesasPorGrupo = mapearDespesas(itens);
        return itens.length;
      },
    ),

    etapa(
      "Resumo de emissões",
      "/PrestacaoContas/ListaResumoEmissao",
      () =>
        cliente.get<RetornoLF<ResumoEmissaoLF>>("/PrestacaoContas/ListaResumoEmissao", {
          id_empreendimento: id ?? undefined,
          cd_condominio: cd,
          dt_periodoinicio: periodoFin.inicio,
          dt_periodofinal: periodoFin.fim,
        }),
      (r) => {
        const itens = dados(verificar(r, "/PrestacaoContas/ListaResumoEmissao"));
        resultado.arrecadacao = mapearArrecadacao(itens);
        return itens.length;
      },
    ),

    etapa(
      "Boletos (inadimplência)",
      "/Boleto/ListaBoleto",
      () => buscarBoletosRelevantes(cliente, { id, cd, inicioHistorico, fimAnterior: periodoFin.fimAnterior, fim: periodoFin.fim, hoje }),
      (boletos) => {
        resultado.inadimplencia = mapearInadimplencia(boletos, periodoFin);
        return boletos.length;
      },
      true,
    ),

    etapa(
      "Acordos",
      "/Acordo/ListaAcordo",
      () =>
        cliente.get<RetornoLF<AcordoLF>>("/Acordo/ListaAcordo", {
          idEmpreendimento: id ?? undefined,
          cdCondominio: cd,
          dtVencimentoInicio: `${ano - 3}-01-01`,
          dtVencimentoFim: `${ano + 3}-12-31`,
          snExibirDetalhesAcordo: false,
          snExibirDetalhesServico: false,
          snExibirResumoAcordo: true,
          snExibirResumoUnidade: false,
          snExibirAcordosUnidade: true,
          snExibirAcordosContrato: false,
        }),
      (r) => {
        const itens = dados(verificar(r, "/Acordo/ListaAcordo"));
        resultado.acordos = mapearAcordos(itens);
        return itens.length;
      },
      true,
    ),

    etapa(
      "Contratos",
      "/ContratoCompleto",
      () =>
        cliente.get<RetornoLF<ContratoLF>>("/ContratoCompleto", {
          id_empreendimento: id ?? undefined,
          cd_empreendimento: cd,
          // sem período a API responde 500
          dt_inicio: PERIODO_AMPLO.inicio,
          dt_termino: PERIODO_AMPLO.fim,
          sn_exibelog: false,
        }),
      (r) => {
        const itens = dados(verificar(r, "/ContratoCompleto"));
        resultado.contratos = mapearContratos(itens);
        return itens.length;
      },
      true,
    ),

    etapa(
      "Documentos",
      "/Documento/ListaDocumentoEmpreendimento",
      () =>
        cliente.get<RetornoLF<DocumentoListaLF>>("/Documento/ListaDocumentoEmpreendimento", {
          EmprendimentoId: id ?? undefined, // sic: grafia do Swagger
          EmprendimentoCodigo: cd,
          // obrigatórios ("Período inicial e período final são obrigatórios")
          DataInicio: PERIODO_AMPLO.inicio,
          DataFinal: PERIODO_AMPLO.fim,
          DocumentoAtivo: true,
        }),
      (r) => {
        const itens = dados(verificar(r, "/Documento/ListaDocumentoEmpreendimento"));
        resultado.documentos = mapearDocumentos(itens, id ?? undefined);
        return resultado.documentos.length;
      },
      true,
    ),

    etapa(
      "Fechamento do mês",
      "/ControleFechamento/ListaControleFechamento",
      () =>
        cliente.get<RetornoLF<FechamentoLF>>("/ControleFechamento/ListaControleFechamento", {
          id_empreendimento: id ?? undefined,
          cd_empreendimento: cd,
        }),
      (r) => {
        const itens = dados(verificar(r, "/ControleFechamento/ListaControleFechamento"));
        resultado.fechamento = mapearFechamento(itens, periodoFin);
        return itens.length;
      },
    ),
  ]);

  if (!id) {
    avisos.unshift(
      "Empreendimento sem id_empreendimento no LiveFacilities: só a operação (OS) e o financeiro por código foram consultados.",
    );
  }
  if (resultado.fechamento && !resultado.fechamento.fechado) {
    avisos.unshift(
      `A prestação de contas de ${periodoFin.competencia.slice(5, 7)}/${periodoFin.competencia.slice(0, 4)} (financeiro deste relatório) ainda não está fechada no LiveFacilities (${resultado.fechamento.status || "em aberto"}). Os valores podem mudar.`,
    );
  }

  // Ordem estável para exibição
  consultas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { dados: resultado, consultas, avisos };
};
