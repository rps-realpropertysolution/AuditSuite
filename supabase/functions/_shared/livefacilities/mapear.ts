/**
 * Conversão das respostas do LiveFacilities para o formato neutro `DadosLF`.
 *
 * Funções puras: recebem o JSON da API, devolvem números prontos para o RGM.
 * Toda regra de negócio da integração está aqui — e coberta por teste em
 * src/test/livefacilities.test.ts.
 *
 * Onde o Swagger não deixa claro o significado de um campo, a escolha está
 * comentada e a importação gera um aviso para o gestor conferir. Depois do
 * primeiro teste com dados reais (`npm run lf:testar`), ajuste aqui.
 */

import type {
  AcordoLF,
  AtividadeLF,
  BoletoLF,
  ContratoLF,
  DadosLF,
  DespesaLF,
  DocumentoListaLF,
  FechamentoLF,
  FluxoCaixaLF,
  PeriodoLF,
  ResumoEmissaoLF,
} from "./tipos.ts";

/* -------------------------------------------------------------------------- */
/* Datas                                                                       */
/* -------------------------------------------------------------------------- */

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** "2026-10-01" → período do mês, com o fim do mês anterior. */
export const periodoDaCompetencia = (competencia: string): PeriodoLF => {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const fimAnt = new Date(Date.UTC(ano, mes - 1, 0));
  return {
    competencia: `${ano}-${doisDigitos(mes)}-01`,
    inicio: `${ano}-${doisDigitos(mes)}-01`,
    fim: `${ano}-${doisDigitos(mes)}-${doisDigitos(ultimoDia)}`,
    fimAnterior: `${fimAnt.getUTCFullYear()}-${doisDigitos(fimAnt.getUTCMonth() + 1)}-${doisDigitos(fimAnt.getUTCDate())}`,
  };
};

/** Recorta "2026-10-05T13:20:00" para "2026-10-05". Datas vazias ou 0001-01-01 viram null. */
export const dia = (valor: string | null | undefined): string | null => {
  if (!valor) return null;
  const d = valor.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d.startsWith("0001") || d.startsWith("1900")) return null;
  return d;
};

export const hojeISO = (hoje: Date) =>
  `${hoje.getFullYear()}-${doisDigitos(hoje.getMonth() + 1)}-${doisDigitos(hoje.getDate())}`;

const menor = (a: string, b: string) => (a < b ? a : b);

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const arredondar = (v: number) => Math.round(v * 100) / 100;

/** Normaliza nome para comparar ("LIMPEZA E SANIFICAÇÃO " == "Limpeza e sanificação"). */
export const chaveNome = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** "LIMPEZA E SANIFICAÇÃO" → "Limpeza e sanificação". Preserva siglas curtas. */
export const capitalizar = (s: string) => {
  const limpo = s.trim().replace(/\s+/g, " ");
  if (!limpo) return limpo;
  if (limpo !== limpo.toUpperCase()) return limpo;
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em", "para", "com"]);
  return limpo
    .toLowerCase()
    .split(" ")
    .map((p, i) => {
      if (i > 0 && minusculas.has(p)) return p;
      if (/^(cnd|crf|cndt|avcb|art|pae|spda|nr|cftv|bms|tst|pmsp|os)$/i.test(p)) return p.toUpperCase();
      return i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p;
    })
    .join(" ");
};

/* -------------------------------------------------------------------------- */
/* Ordens de serviço                                                           */
/* -------------------------------------------------------------------------- */

export type TipoOS = "preventiva" | "corretiva" | "ronda" | "acompanhamento";

/** Classifica pelo tipo/processo. Ordem importa: "ronda preventiva" é ronda. */
export const classificarTipoOS = (a: AtividadeLF): TipoOS | null => {
  const texto = chaveNome(
    [a.nm_atividadetipo, a.nm_processopai, a.tx_processocaminho, a.nm_atividade].map(txt).join(" "),
  );
  if (/\bronda/.test(texto)) return "ronda";
  if (/prevent|programad|rotina|plano de manutencao|pmoc/.test(texto)) return "preventiva";
  if (/corret|chamado|emergenc|reparo|solicitac/.test(texto)) return "corretiva";
  if (/acompanh|inspec|vistori|checklist|check list|monitor/.test(texto)) return "acompanhamento";
  return null;
};

export type StatusOS = "concluida" | "cancelada" | "aberta";

export const statusOS = (a: AtividadeLF): StatusOS => {
  const s = chaveNome(`${txt(a.nm_statusatividade)} ${txt(a.tx_statusatividade)}`);
  if (/cancel|anulad|descartad/.test(s)) return "cancelada";
  if (dia(a.dt_conclusao) || dia(a.dt_fechamento) || /conclu|finaliz|encerr|fechad|realizad|executad/.test(s)) {
    return "concluida";
  }
  return "aberta";
};

/** Disciplina = processo pai ou primeiro nível do caminho ("Manutenção > Elétrica" → "Manutenção"). */
export const disciplinaOS = (a: AtividadeLF) => {
  const caminho = txt(a.tx_processocaminho)
    .split(/\s*(?:>|\/|\\|»|\|)\s*/)
    .filter(Boolean);
  // O último nível costuma ser a disciplina ("Manutenção > Predial > Elétrica").
  const candidato = txt(a.nm_processopai) || caminho[caminho.length - 1] || txt(a.nm_servico) || "Outros";
  return capitalizar(candidato);
};

/** Lançamentos automáticos (2ª via de boleto etc.) — não são manutenção. */
const ehSomenteRegistro = (a: AtividadeLF) => /somente registro/.test(chaveNome(txt(a.nm_atividadetipo)));

export const mapearOS = (todos: AtividadeLF[], periodo: PeriodoLF, hoje: Date, cdCondominio?: string) => {
  const limite = menor(periodo.fim, hojeISO(hoje));
  // A API às vezes ignora o filtro do prédio: garante aqui.
  const doPredio = cdCondominio ? todos.filter((a) => !a.cd_condominio || a.cd_condominio === cdCondominio) : todos;
  const registros = doPredio.filter(ehSomenteRegistro).length;
  const itens = doPredio.filter((a) => !ehSomenteRegistro(a));
  const resumo = { preventivas: 0, corretivas: 0, acompanhamentos: 0, rondas: 0, naoRealizadas: 0 };
  const situacao = { concluidasNoPrazo: 0, concluidasComAtraso: 0, abertasNoPrazo: 0, abertasAtrasadas: 0, canceladas: 0 };
  const porDisciplina = new Map<string, number>();
  const naoClassificados = new Set<string>();
  let semPrazo = 0;

  for (const a of itens) {
    const status = statusOS(a);
    if (status === "cancelada") {
      situacao.canceladas++;
      continue;
    }

    const prazo = dia(a.dt_fimocorrencia) ?? dia(a.dt_agendamento);
    if (!prazo) semPrazo++;

    if (status === "concluida") {
      const conclusao = dia(a.dt_conclusao) ?? dia(a.dt_fechamento);
      if (prazo && conclusao && conclusao > prazo) situacao.concluidasComAtraso++;
      else situacao.concluidasNoPrazo++;

      const tipo = classificarTipoOS(a);
      if (tipo === "preventiva") resumo.preventivas++;
      else if (tipo === "corretiva") resumo.corretivas++;
      else if (tipo === "ronda") resumo.rondas++;
      else {
        resumo.acompanhamentos++;
        if (!tipo) naoClassificados.add(txt(a.nm_atividadetipo) || txt(a.nm_processopai) || "(sem tipo)");
      }
    } else {
      if (prazo && prazo < limite) situacao.abertasAtrasadas++;
      else situacao.abertasNoPrazo++;
    }

    const d = disciplinaOS(a);
    porDisciplina.set(d, (porDisciplina.get(d) ?? 0) + 1);
  }

  resumo.naoRealizadas = situacao.abertasAtrasadas + situacao.abertasNoPrazo;

  const ordenadas = [...porDisciplina.entries()].sort((a, b) => b[1] - a[1]);
  const principais = ordenadas.slice(0, 7).map(([disciplina, quantidade]) => ({ disciplina, quantidade }));
  const resto = ordenadas.slice(7).reduce((s, [, q]) => s + q, 0);
  if (resto > 0) principais.push({ disciplina: "Demais disciplinas", quantidade: resto });

  const avisos: string[] = [];
  if (naoClassificados.size > 0) {
    avisos.push(
      `OS sem tipo reconhecido contadas como acompanhamento: ${[...naoClassificados].slice(0, 6).join(", ")}.`,
    );
  }
  if (semPrazo > 0) avisos.push(`${semPrazo} OS sem data-limite: contadas como dentro do prazo.`);
  if (registros > 0) avisos.push(`${registros} lançamento(s) "somente registro" (ex.: 2ª via de boleto) fora da contagem de OS.`);
  if (cdCondominio && todos.length && !doPredio.length) {
    avisos.push(`Nenhuma OS do código ${cdCondominio} no período — confira o código do condomínio.`);
  }

  return {
    os: { total: itens.length, resumo, situacao, disciplinas: principais } satisfies DadosLF["os"],
    avisos,
  };
};

/* -------------------------------------------------------------------------- */
/* Contratos                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Um mesmo fornecedor costuma ter várias vigências (renovações). Fica a mais
 * recente por fornecedor + classificação — o mesmo critério do RGM corporativo.
 */
export const mapearContratos = (itens: ContratoLF[]): NonNullable<DadosLF["contratos"]> => {
  const porChave = new Map<string, ContratoLF>();
  for (const c of itens) {
    if (/cancel|rescind|encerr|inativ|distrat/i.test(txt(c.nm_status))) continue;
    const fornecedor = txt(c.nm_contratado);
    if (!fornecedor) continue;
    const chave = `${chaveNome(fornecedor)}|${chaveNome(txt(c.nm_classificacao))}`;
    const atual = porChave.get(chave);
    // sem término = prazo indeterminado: vence qualquer data
    const termino = dia(c.dt_termino) ?? "9999-12-31";
    const terminoAtual = atual ? dia(atual.dt_termino) ?? "9999-12-31" : "";
    if (!atual || termino > terminoAtual) porChave.set(chave, c);
  }

  return [...porChave.values()]
    .map((c) => ({
      fornecedor: capitalizar(txt(c.nm_contratado)),
      objeto: (txt(c.tx_objeto) || txt(c.nm_classificacao) || txt(c.nm_tipocontrato)).slice(0, 160),
      vencimento: dia(c.dt_termino) ?? "",
      status: txt(c.nm_status),
      tipo: txt(c.tipoClassificacao),
    }))
    .sort((a, b) => (a.vencimento || "9999").localeCompare(b.vencimento || "9999"));
};

/* -------------------------------------------------------------------------- */
/* Documentos                                                                  */
/* -------------------------------------------------------------------------- */

export const mapearDocumentos = (lista: DocumentoListaLF[], idEmpreendimento?: number) => {
  const porTitulo = new Map<string, { documento: string; orgao: string; validade: string; permanente: boolean }>();

  for (const bloco of lista) {
    for (const emp of bloco.empreendimento ?? []) {
      if (idEmpreendimento && emp.empreendimentoId && emp.empreendimentoId !== idEmpreendimento) continue;
      for (const tipo of emp.documentoTipo ?? []) {
        for (const doc of tipo.documento ?? []) {
          if (doc.documentoAtivo === false) continue;
          const titulo = txt(doc.documentoTitulo).replace(/^[\d.]+\s*-\s*/, "");
          if (!titulo) continue;
          // Só dataValidade vale. 01/01/1900 = sem validade (Habite-se, convenção…).
          // dataFinal é o fim do registro no sistema, não validade — usar levava
          // documentos permanentes a aparecer como vencidos.
          const validade = dia(doc.dataValidade) ?? "";
          const chave = chaveNome(titulo);
          const atual = porTitulo.get(chave);
          // renovação gera documento novo: fica o de validade mais longa
          if (atual && (atual.permanente || (validade && atual.validade >= validade) || !validade)) continue;
          porTitulo.set(chave, {
            documento: titulo,
            orgao: capitalizar(txt(tipo.documentoTipoNome)),
            validade,
            permanente: !validade,
          });
        }
      }
    }
  }

  return [...porTitulo.values()].sort((a, b) => {
    if (a.permanente !== b.permanente) return a.permanente ? 1 : -1;
    return a.validade.localeCompare(b.validade);
  });
};

/* -------------------------------------------------------------------------- */
/* Inadimplência (boletos)                                                     */
/* -------------------------------------------------------------------------- */

const boletoCancelado = (b: BoletoLF) => /cancel|estorn|substitu|anulad|baixad.*sem/i.test(txt(b.nm_recibostatus));

/** Aberto em `data`: não pago até aquela data (inclusive). */
const abertoEm = (b: BoletoLF, data: string) => {
  const pagamento = dia(b.dt_pagamento);
  return !pagamento || pagamento > data;
};

/**
 * Nível do plano de contas que separa as rubricas. Se o grau 1 é sempre o
 * mesmo ("RECEITAS"), as rubricas estão no grau 2 ("Ordinária", "Fundo de reserva").
 */
const nivelRubrica = (boletos: BoletoLF[]): 1 | 2 => {
  const grau1 = new Set<string>();
  for (const b of boletos) for (const d of b.recibo_detalhe ?? []) if (txt(d.nm_contacontabilgrau_1)) grau1.add(chaveNome(txt(d.nm_contacontabilgrau_1)));
  return grau1.size > 1 ? 1 : 2;
};

/** Divide o valor do boleto entre as rubricas, na proporção do detalhe. */
const repartir = (b: BoletoLF, nivel: 1 | 2): [string, number][] => {
  const valor = num(b.vl_recibo);
  const detalhes = (b.recibo_detalhe ?? []).filter((d) => num(d.vl_recibodetalhe) > 0);
  const soma = detalhes.reduce((s, d) => s + num(d.vl_recibodetalhe), 0);
  if (!detalhes.length || soma <= 0) return [["Geral", valor]];

  const partes = new Map<string, number>();
  for (const d of detalhes) {
    const nome =
      (nivel === 1 ? txt(d.nm_contacontabilgrau_1) : txt(d.nm_contacontabilgrau_2) || txt(d.nm_contacontabilgrau_1)) ||
      "Geral";
    partes.set(nome, (partes.get(nome) ?? 0) + (valor * num(d.vl_recibodetalhe)) / soma);
  }
  return [...partes.entries()];
};

/**
 * Posição de inadimplência por rubrica, no mesmo modelo do RGM:
 *   ateAnterior = vencido até o fim do mês anterior e ainda aberto naquela data
 *   recebido    = desses, o que foi pago dentro do mês
 *   doMes       = vencido no mês e ainda aberto no fim do mês
 * Assim total (ateAnterior − recebido + doMes) = aberto no fim do mês.
 */
export const mapearInadimplencia = (boletos: BoletoLF[], periodo: PeriodoLF) => {
  const validos = boletos.filter((b) => !boletoCancelado(b) && dia(b.dt_vencimento));
  const nivel = nivelRubrica(validos);
  const rubricas = new Map<string, { ateAnterior: number; recebido: number; doMes: number }>();
  const conta = (nome: string) => {
    const nomeBonito = capitalizar(nome);
    const chave = chaveNome(nomeBonito);
    const existente = [...rubricas.keys()].find((k) => chaveNome(k) === chave);
    if (existente) return rubricas.get(existente)!;
    const novo = { ateAnterior: 0, recebido: 0, doMes: 0 };
    rubricas.set(nomeBonito, novo);
    return novo;
  };

  for (const b of validos) {
    const venc = dia(b.dt_vencimento)!;
    if (venc > periodo.fim) continue;
    const pagamento = dia(b.dt_pagamento);

    for (const [rubrica, valor] of repartir(b, nivel)) {
      const r = conta(rubrica);
      if (venc <= periodo.fimAnterior) {
        if (!abertoEm(b, periodo.fimAnterior)) continue;
        r.ateAnterior += valor;
        if (pagamento && pagamento >= periodo.inicio && pagamento <= periodo.fim) r.recebido += valor;
      } else if (abertoEm(b, periodo.fim)) {
        r.doMes += valor;
      }
    }
  }

  return [...rubricas.entries()]
    .map(([rubrica, v]) => ({
      rubrica,
      ateAnterior: arredondar(v.ateAnterior),
      recebido: arredondar(v.recebido),
      doMes: arredondar(v.doMes),
    }))
    .filter((r) => r.ateAnterior || r.recebido || r.doMes)
    .sort((a, b) => b.ateAnterior + b.doMes - (a.ateAnterior + a.doMes));
};

/* -------------------------------------------------------------------------- */
/* Arrecadação (resumo de emissões)                                            */
/* -------------------------------------------------------------------------- */

export const mapearArrecadacao = (itens: ResumoEmissaoLF[]): DadosLF["arrecadacao"] | undefined => {
  const porConta = itens
    .map((i) => ({
      conta: capitalizar(txt(i.nm_contaprincipal) || "Geral"),
      previsto: arredondar(num(i.vl_previsto)),
      realizado: arredondar(num(i.vl_realizado)),
    }))
    .filter((i) => i.previsto || i.realizado);
  if (!porConta.length) return undefined;

  const ordinaria = porConta.find((c) => /ordinari/.test(chaveNome(c.conta)));
  const base = ordinaria ? [ordinaria] : porConta;
  return {
    emitido: arredondar(base.reduce((s, c) => s + c.previsto, 0)),
    recebido: arredondar(base.reduce((s, c) => s + c.realizado, 0)),
    contaReferencia: ordinaria ? ordinaria.conta : "Todas as contas",
    porConta,
  };
};

/* -------------------------------------------------------------------------- */
/* Despesas por grupo                                                          */
/* -------------------------------------------------------------------------- */

/** Agrupa pela conta de nível 2 (grupo) — o "Grupo contábil" do slide Previsto x Realizado. */
export const mapearDespesas = (todas: DespesaLF[]) => {
  const grupos = new Map<string, number>();
  // O previsto x realizado é do orçamento ORDINÁRIO; despesas de fundos (reserva, melhorias) ficam fora.
  const temOrdinaria = todas.some((d) => /ordinari/.test(chaveNome(txt(d.nm_conta1))));
  const itens = temOrdinaria ? todas.filter((d) => /ordinari/.test(chaveNome(txt(d.nm_conta1)))) : todas;
  for (const d of itens) {
    const nome = capitalizar(txt(d.nm_conta2) || txt(d.nm_conta1) || "Outras despesas");
    const chave = [...grupos.keys()].find((k) => chaveNome(k) === chaveNome(nome)) ?? nome;
    grupos.set(chave, (grupos.get(chave) ?? 0) + Math.abs(num(d.vl_conta)));
  }
  return [...grupos.entries()]
    .map(([grupo, valor]) => ({ grupo, valor: arredondar(valor) }))
    .filter((g) => g.valor > 0)
    .sort((a, b) => b.valor - a.valor);
};

/* -------------------------------------------------------------------------- */
/* Fluxo de caixa, acordos, fechamento                                         */
/* -------------------------------------------------------------------------- */

/** "466. ORDINÁRIA -> 516. GRUPO GERADORES -> 517. MANUTENÇÃO" → "Ordinária" */
export const fundoDaHierarquia = (h: string | null | undefined) => {
  const primeiro = txt(h).split("->")[0].replace(/^\s*\d+\.\s*/, "").trim();
  return primeiro ? capitalizar(primeiro) : "Outros lançamentos";
};

export const mapearFluxoCaixa = (
  itens: FluxoCaixaLF[],
  idEmpreendimento?: number | null,
  cdCondominio?: string,
): DadosLF["financeiro"] | undefined => {
  const f =
    itens.find((i) => idEmpreendimento && i.id_empreendimento === idEmpreendimento) ??
    itens.find((i) => cdCondominio && txt(i.cd_empreendimento).startsWith(cdCondominio)) ??
    (itens.length === 1 ? itens[0] : undefined);
  if (!f) return undefined;

  const porFundo = new Map<string, { creditos: number; debitos: number }>();
  for (const l of f.listaFluxoCaixaDados ?? []) {
    const fundo = fundoDaHierarquia(l.nm_contacontabilhierarquia);
    const atual = porFundo.get(fundo) ?? { creditos: 0, debitos: 0 };
    atual.creditos += num(l.vl_credito);
    atual.debitos += num(l.vl_debito);
    porFundo.set(fundo, atual);
  }

  return {
    saldoAnterior: arredondar(num(f.vl_saldoanterior)),
    creditos: arredondar(num(f.vl_credito)),
    debitos: arredondar(num(f.vl_debito)),
    saldoAtual: arredondar(num(f.vl_saldoatual)),
    porFundo: [...porFundo.entries()]
      .map(([fundo, v]) => ({ fundo, creditos: arredondar(v.creditos), debitos: arredondar(v.debitos) }))
      .sort((a, b) => b.creditos + b.debitos - (a.creditos + a.debitos)),
  };
};

export const mapearAcordos = (itens: AcordoLF[]): NonNullable<DadosLF["acordos"]> =>
  itens
    // acordos cancelados não são acompanhados no RGM
    .filter((a) => !/cancel/.test(chaveNome(txt(a.resumoAcordo?.status))))
    .map((a) => {
      const parcelas = a.detalhesParcelas ?? [];
      const pagas = parcelas.filter((p) => dia(p.pagamento) || num(p.valorRecebido) > 0).length;
      const valor = num(a.resumoAcordo?.total) || parcelas.reduce((s, p) => s + num(p.valor), 0);
      const pago = num(a.resumoAcordo?.totalPago) || parcelas.reduce((s, p) => s + num(p.valorRecebido), 0);
      return {
        unidade: [txt(a.nmBloco), txt(a.cdUnidade)].filter(Boolean).join(" · "),
        devedor: capitalizar(txt(a.nmProprietario)),
        parcelas: num(a.resumoAcordo?.quantidadeParcelas) || parcelas.length,
        parcelasPagas: pagas,
        valor: arredondar(valor),
        valorPago: arredondar(pago),
        status: capitalizar(txt(a.resumoAcordo?.status)) || "Em andamento",
      };
    })
    .filter((a) => a.valor > 0 || a.parcelas > 0);

export const mapearFechamento = (itens: FechamentoLF[], periodo: PeriodoLF): DadosLF["fechamento"] => {
  const doMes = itens.find((f) => {
    const ini = dia(f.dt_periodoinicio);
    const fim = dia(f.dt_periodofinal);
    return ini && fim && ini <= periodo.inicio && fim >= periodo.inicio;
  });
  if (!doMes) return null;
  return { fechado: Boolean(doMes.sn_fechado), status: txt(doMes.nm_controlefechamentostatus) };
};
