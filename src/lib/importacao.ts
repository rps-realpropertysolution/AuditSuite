/**
 * Mescla o que veio do LiveFacilities no relatório do mês.
 *
 * Princípio: o sistema traz os NÚMEROS; o que é do gestor (justificativas,
 * observações, orçado, comentários) é preservado. Onde a importação não
 * consegue decidir sozinha — fundos abertos à mão, linhas lançadas que não
 * existem no sistema — ela não apaga nada: avisa.
 */

import type {
  DadosLF,
  ResultadoImportacaoLF,
} from "../../supabase/functions/_shared/livefacilities/tipos.ts";
import { chaveNome } from "../../supabase/functions/_shared/livefacilities/mapear.ts";
import { novoId } from "./defaults";
import { formatarCompetencia, formatarMoeda, formatarNumero } from "./format";
import type {
  DadosRelatorio,
  LinhaCertidao,
  LinhaContrato,
  LinhaDocumento,
  LinhaFundo,
  LinhaGrupoContabil,
} from "./types";

export const FONTE_LF = "LiveFacilities (RP Smart)";

export interface ItemResumoImportacao {
  secao: string;
  rotulo: string;
  detalhe: string;
}

export interface ResultadoMescla {
  dados: DadosRelatorio;
  preenchido: ItemResumoImportacao[];
  avisos: string[];
}

/** O que a API não traz — vira o checklist "fica com você" no editor. */
export const PENDENCIAS_MANUAIS = [
  "Leitura do mês e comentários de cada seção",
  "Ocupação e controle de acesso",
  "Utilidades (consumo e valor das faturas)",
  "Frentes operacionais e ocorrências relevantes",
  "Registro fotográfico",
  "Plano de ação, riscos e decisões para o cliente",
  "Orçado dos grupos contábeis, quando não houver",
];

const fundoVazio = (f: LinhaFundo) => !f.anterior && !f.creditos && !f.debitos;
const CONSOLIDADO = "Consolidado";

const A_DISTRIBUIR = "Saldo anterior a distribuir";

/**
 * Abertura por fundo. A API dá o movimento do mês por fundo, mas não o saldo
 * de cada fundo — só o consolidado. Então:
 *  - fundos já abertos no relatório (herdados do mês passado) recebem os
 *    créditos/débitos do mês e mantêm o saldo anterior encadeado;
 *  - na primeira vez, o saldo anterior consolidado fica numa linha "a
 *    distribuir" — o gestor reparte uma única vez e daí em diante encadeia.
 * Em qualquer caso o total confere com o consolidado do sistema.
 */
const mesclarFundosPorFundo = (
  fundos: LinhaFundo[],
  lf: NonNullable<DadosLF["financeiro"]>,
  porFundo: NonNullable<NonNullable<DadosLF["financeiro"]>["porFundo"]>,
  avisos: string[],
): LinhaFundo[] => {
  const abertos = fundos.filter((f) => chaveNome(f.fundo) !== chaveNome(CONSOLIDADO) && chaveNome(f.fundo) !== chaveNome(A_DISTRIBUIR) && !fundoVazio(f));
  const usados = new Set<string>();

  const linhas: LinhaFundo[] = porFundo.map((m) => {
    const existente = abertos.find((f) => !usados.has(f.id) && chaveNome(f.fundo) === chaveNome(m.fundo));
    if (existente) usados.add(existente.id);
    return { id: existente?.id ?? novoId(), fundo: existente?.fundo ?? m.fundo, anterior: existente?.anterior ?? 0, creditos: m.creditos, debitos: m.debitos };
  });
  // fundos abertos sem movimento no mês continuam, com o saldo
  abertos.filter((f) => !usados.has(f.id)).forEach((f) => linhas.push({ ...f, creditos: 0, debitos: 0 }));

  // o movimento por fundo precisa fechar com o total do sistema
  const difCred = lf.creditos - linhas.reduce((s, l) => s + l.creditos, 0);
  const difDeb = lf.debitos - linhas.reduce((s, l) => s + l.debitos, 0);
  if (Math.abs(difCred) > 1 || Math.abs(difDeb) > 1) {
    linhas.push({ id: novoId(), fundo: "Outros lançamentos", anterior: 0, creditos: Math.max(difCred, 0), debitos: Math.max(difDeb, 0) });
  }

  const difAnterior = lf.saldoAnterior - linhas.reduce((s, l) => s + l.anterior, 0);
  if (Math.abs(difAnterior) > 1) {
    linhas.push({ id: novoId(), fundo: A_DISTRIBUIR, anterior: difAnterior, creditos: 0, debitos: 0 });
    avisos.push(
      abertos.length
        ? `O saldo anterior dos fundos difere do consolidado do LiveFacilities em ${formatarMoeda(difAnterior)} — lançado em "${A_DISTRIBUIR}" para conferência.`
        : `Saldo anterior consolidado de ${formatarMoeda(lf.saldoAnterior)} lançado em "${A_DISTRIBUIR}". Reparta entre os fundos uma vez; nos próximos meses o saldo encadeia sozinho.`,
    );
  }
  return linhas;
};

const mesclarFundos = (fundos: LinhaFundo[], lf: NonNullable<DadosLF["financeiro"]>, avisos: string[]) => {
  if (lf.porFundo && lf.porFundo.length > 1) return mesclarFundosPorFundo(fundos, lf, lf.porFundo, avisos);

  const linhaLF: Omit<LinhaFundo, "id"> = {
    fundo: CONSOLIDADO,
    anterior: lf.saldoAnterior,
    creditos: lf.creditos,
    debitos: lf.debitos,
  };

  const consolidado = fundos.find((f) => chaveNome(f.fundo) === chaveNome(CONSOLIDADO));
  if (consolidado) {
    if (Math.abs(consolidado.anterior - lf.saldoAnterior) > 1) {
      avisos.push(
        `Saldo anterior ajustado para o do LiveFacilities: ${formatarMoeda(lf.saldoAnterior)} (o mês passado fechou em ${formatarMoeda(consolidado.anterior)}).`,
      );
    }
    return fundos.map((f) => (f === consolidado ? { ...f, ...linhaLF } : f));
  }

  if (fundos.every(fundoVazio)) return [{ id: novoId(), ...linhaLF }];

  avisos.push(
    `Os fundos deste relatório foram abertos à mão e não foram alterados. Fluxo de caixa do LiveFacilities: ` +
      `anterior ${formatarMoeda(lf.saldoAnterior)}, créditos ${formatarMoeda(lf.creditos)}, ` +
      `débitos ${formatarMoeda(lf.debitos)}, saldo ${formatarMoeda(lf.saldoAtual)}.`,
  );
  return fundos;
};

const mesclarGrupos = (
  grupos: LinhaGrupoContabil[],
  despesas: NonNullable<DadosLF["despesasPorGrupo"]>,
  avisos: string[],
): LinhaGrupoContabil[] => {
  const usados = new Set<string>();
  const importados = despesas.map((d) => {
    const existente = grupos.find((g) => chaveNome(g.grupo) === chaveNome(d.grupo));
    if (existente) usados.add(existente.id);
    return {
      id: existente?.id ?? novoId(),
      grupo: existente?.grupo || d.grupo,
      orcado: existente?.orcado ?? 0,
      realizado: d.valor,
      observacao: existente?.observacao ?? "",
    };
  });

  // Grupo com orçado que não apareceu nas despesas: fica, zerado, para o gestor ver.
  const semDespesa = grupos
    .filter((g) => !usados.has(g.id) && g.orcado > 0)
    .map((g) => ({ ...g, realizado: 0 }));
  if (semDespesa.length) {
    avisos.push(
      `${semDespesa.length} grupo(s) com orçado não tiveram despesa no LiveFacilities com o mesmo nome: ` +
        `${semDespesa.map((g) => g.grupo).join(", ")}. Confira se o nome do grupo mudou.`,
    );
  }
  return [...importados, ...semDespesa];
};

const mesclarContratos = (
  atuais: LinhaContrato[],
  lf: NonNullable<DadosLF["contratos"]>,
  avisos: string[],
): LinhaContrato[] => {
  const usados = new Set<string>();
  const importados: LinhaContrato[] = lf.map((c) => {
    const existente = atuais.find(
      (a) => !usados.has(a.id) && chaveNome(a.fornecedor) === chaveNome(c.fornecedor),
    );
    if (existente) usados.add(existente.id);
    return {
      id: existente?.id ?? novoId(),
      fornecedor: c.fornecedor,
      objeto: c.objeto || existente?.objeto || "",
      // A situação é derivada da data (metrics.situacaoContrato); sem data, vigente.
      situacao: c.vencimento ? "vigente" : existente?.situacao ?? "vigente",
      vencimento: c.vencimento,
      observacao: existente?.observacao || "",
    };
  });

  const manuais = atuais.filter((a) => !usados.has(a.id) && a.fornecedor.trim());
  if (manuais.length) {
    avisos.push(
      `${manuais.length} contrato(s) lançado(s) à mão não existem no LiveFacilities e foram mantidos: ` +
        `${manuais.map((m) => m.fornecedor).slice(0, 5).join(", ")}. Confira se são duplicados.`,
    );
  }
  return [...importados, ...manuais];
};

const mesclarDocumentos = (
  atuais: LinhaDocumento[],
  lf: NonNullable<DadosLF["documentos"]>,
  avisos: string[],
): LinhaDocumento[] => {
  const usados = new Set<string>();
  const importados: LinhaDocumento[] = lf.map((d) => {
    const existente = atuais.find((a) => !usados.has(a.id) && chaveNome(a.documento) === chaveNome(d.documento));
    if (existente) usados.add(existente.id);
    return {
      id: existente?.id ?? novoId(),
      documento: d.documento,
      orgao: d.orgao || existente?.orgao || "",
      validade: d.validade,
      permanente: d.permanente,
      observacao: existente?.observacao ?? "",
    };
  });

  // Linhas do modelo em branco (sem data, sem observação) somem; o resto fica.
  const manuais = atuais.filter(
    (a) => !usados.has(a.id) && (a.validade || a.permanente || a.observacao.trim()),
  );
  if (manuais.length) {
    avisos.push(
      `${manuais.length} documento(s) lançado(s) à mão não existem no LiveFacilities e foram mantidos: ` +
        `${manuais.map((m) => m.documento).slice(0, 5).join(", ")}.`,
    );
  }
  return [...importados, ...manuais];
};

/**
 * Certidões do condomínio a partir dos documentos do sistema: a CND federal,
 * o CRF do FGTS etc. costumam estar cadastrados como documentos com validade.
 */
const PADROES_CERTIDAO: [RegExp, RegExp][] = [
  [/cnd federal|divida ativa|receita federal|pgfn/, /\bcnd\b.*(federal|uniao)|receita federal|pgfn|divida ativa/],
  [/fgts|crf/, /\bcrf\b|fgts/],
  [/cndt|trabalhist/, /\bcndt\b|debitos trabalhistas|trabalhist/],
  [/estadual/, /\bcnd\b.*estadual|fazenda estadual|sefaz|estadual/],
  [/municipal/, /\bcnd\b.*municipal|prefeitura|municipal/],
];

const mesclarCertidoes = (atuais: LinhaCertidao[], docs: NonNullable<DadosLF["documentos"]>): [LinhaCertidao[], number] => {
  let atualizadas = 0;
  const linhas = atuais.map((c) => {
    const padrao = PADROES_CERTIDAO.find(([daCertidao]) => daCertidao.test(chaveNome(c.certidao)));
    if (!padrao) return c;
    const achado = docs
      .filter((d) => d.validade && /certid|\bcnd|\bcrf|cndt/.test(chaveNome(d.documento)) && padrao[1].test(chaveNome(d.documento)))
      .sort((a, b) => b.validade.localeCompare(a.validade))[0];
    if (!achado || achado.validade === c.validade) return c;
    atualizadas++;
    return { ...c, validade: achado.validade };
  });
  return [linhas, atualizadas];
};

export const aplicarImportacao = (
  dados: DadosRelatorio,
  resultado: ResultadoImportacaoLF,
  agora = new Date(),
): ResultadoMescla => {
  const lf = resultado.dados;
  const avisos = [...resultado.avisos];
  const preenchido: ItemResumoImportacao[] = [];
  const secoes = new Set<string>();
  let d: DadosRelatorio = { ...dados };

  // O financeiro deste relatório é a prestação de contas que foi consultada.
  if (lf.periodoFinanceiro) d = { ...d, competenciaFinanceira: lf.periodoFinanceiro.competencia };
  const mesFin = lf.periodoFinanceiro ? ` (${formatarCompetencia(lf.periodoFinanceiro.competencia)})` : "";

  if (lf.financeiro) {
    d = { ...d, financeiro: { ...d.financeiro, fundos: mesclarFundos(d.financeiro.fundos, lf.financeiro, avisos) } };
    secoes.add("financeiro");
    preenchido.push({
      secao: "financeiro",
      rotulo: `Resultado e saldo${mesFin}`,
      detalhe: `créditos ${formatarMoeda(lf.financeiro.creditos)} · débitos ${formatarMoeda(lf.financeiro.debitos)} · saldo ${formatarMoeda(lf.financeiro.saldoAtual)}`,
    });
  }

  if (lf.despesasPorGrupo?.length) {
    d = { ...d, financeiro: { ...d.financeiro, grupos: mesclarGrupos(d.financeiro.grupos, lf.despesasPorGrupo, avisos) } };
    secoes.add("financeiro");
    preenchido.push({
      secao: "financeiro",
      rotulo: "Despesas por grupo",
      detalhe: `${lf.despesasPorGrupo.length} grupos com realizado do mês`,
    });
  }

  if (lf.arrecadacao) {
    d = {
      ...d,
      financeiro: {
        ...d.financeiro,
        arrecadacao: { emitido: lf.arrecadacao.emitido, recebido: lf.arrecadacao.recebido },
      },
    };
    secoes.add("arrecadacao");
    preenchido.push({
      secao: "financeiro",
      rotulo: "Arrecadação",
      detalhe: `${lf.arrecadacao.contaReferencia}: emitido ${formatarMoeda(lf.arrecadacao.emitido)} · recebido ${formatarMoeda(lf.arrecadacao.recebido)}`,
    });
  }

  if (lf.inadimplencia?.length) {
    d = {
      ...d,
      juridico: {
        ...d.juridico,
        inadimplencia: { rubricas: lf.inadimplencia.map((r) => ({ id: novoId(), ...r })) },
      },
    };
    secoes.add("juridico");
    const total = lf.inadimplencia.reduce((s, r) => s + r.ateAnterior - r.recebido + r.doMes, 0);
    preenchido.push({
      secao: "juridico",
      rotulo: "Inadimplência",
      detalhe: `${formatarMoeda(total)} em aberto · ${lf.inadimplencia.length} rubrica(s)`,
    });
  }

  if (lf.acordos) {
    d = { ...d, juridico: { ...d.juridico, acordos: lf.acordos.map((a) => ({ id: novoId(), ...a })) } };
    if (lf.acordos.length) {
      secoes.add("juridico");
      preenchido.push({ secao: "juridico", rotulo: "Acordos", detalhe: `${lf.acordos.length} acordo(s)` });
    }
  }

  if (lf.os && lf.os.total > 0) {
    d = {
      ...d,
      operacao: {
        ...d.operacao,
        resumo: lf.os.resumo,
        situacaoOS: lf.os.situacao,
        disciplinas: lf.os.disciplinas.map((x) => ({ id: novoId(), ...x })),
      },
    };
    secoes.add("operacao");
    secoes.add("os");
    const s = lf.os.situacao;
    const concluidas = s.concluidasNoPrazo + s.concluidasComAtraso;
    preenchido.push({
      secao: "operacao",
      rotulo: "Ordens de serviço",
      detalhe: `${formatarNumero(lf.os.total)} OS · ${concluidas ? formatarNumero((s.concluidasNoPrazo / concluidas) * 100, 1) : "—"}% no prazo · ${s.abertasAtrasadas} em atraso`,
    });
  }

  if (lf.contratos?.length) {
    d = { ...d, contratos: { ...d.contratos, linhas: mesclarContratos(d.contratos.linhas, lf.contratos, avisos) } };
    secoes.add("contratos");
    preenchido.push({ secao: "contratos", rotulo: "Contratos", detalhe: `${lf.contratos.length} contrato(s) com vigência` });
  }

  if (lf.documentos?.length) {
    d = { ...d, documentos: { ...d.documentos, linhas: mesclarDocumentos(d.documentos.linhas, lf.documentos, avisos) } };
    secoes.add("documentos");
    preenchido.push({ secao: "documentos", rotulo: "Documentos legais", detalhe: `${lf.documentos.length} documento(s) com validade` });

    const [certidoes, atualizadas] = mesclarCertidoes(d.juridico.certidoes, lf.documentos);
    if (atualizadas) {
      d = { ...d, juridico: { ...d.juridico, certidoes } };
      preenchido.push({ secao: "juridico", rotulo: "Certidões", detalhe: `${atualizadas} validade(s) atualizada(s) pelos documentos do sistema` });
    }
  }

  d = {
    ...d,
    importacao: { fonte: FONTE_LF, em: agora.toISOString(), secoes: [...secoes], avisos },
  };

  return { dados: d, preenchido, avisos };
};
