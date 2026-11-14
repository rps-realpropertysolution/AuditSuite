/**
 * Preenche o "Edifício Aurora Corporate [demo]" com 2026 inteiro (jan–out),
 * números FICTÍCIOS e coerentes entre si (fundos encadeados, orçamento,
 * inadimplência, consumo, OS) e outubro completo — o RGM de vitrine.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npx vite-node -c scripts/vite-node.config.ts scripts/rgm/popular-demo.ts -- --fotos <pasta>
 *
 * A pasta de fotos deve ter: p-fachada.jpg, p-recepcao.jpg, p-cobertura.jpg,
 * p-limpeza.jpg, p-elevador.jpg, p-painel.jpg (fotos livres do Unsplash).
 * Pode rodar de novo: reabre os relatórios do demo, regrava e publica jan–set.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { herdarDoMesAnterior, novoId, relatorioEmBranco } from "../../src/lib/defaults";
import { calcularIndiceExecutivo } from "../../src/lib/metrics";
import type { DadosRelatorio, Foto } from "../../src/lib/types";

const args = process.argv.slice(2).filter((a) => a !== "--");
const pastaFotos = args[args.indexOf("--fotos") + 1];
if (!pastaFotos || args.indexOf("--fotos") < 0) throw new Error("informe --fotos <pasta>");

const url = process.env.VITE_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) throw new Error("Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
const sb = createClient(url, chave, { auth: { persistSession: false } });
const BUCKET = "relatorio-fotos";

const { data: emp, error: e0 } = await sb.from("empreendimentos").select("*").ilike("nome", "%Aurora Corporate%").single();
if (e0 || !emp) throw new Error(`demo não encontrado: ${e0?.message}`);

/* ------------------------------------------------------------------ fotos */
const enviar = async (caminho: string, arquivo: string) => {
  const { error } = await sb.storage.from(BUCKET).upload(caminho, readFileSync(join(pastaFotos, arquivo)), { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`${arquivo}: ${error.message}`);
  return caminho;
};
const fotoPredio = await enviar(`empreendimento/${emp.id}/fachada.jpg`, "p-fachada.jpg");

/* ---------------------------------------------------------- empreendimento */
await sb
  .from("empreendimentos")
  .update({
    cidade: "São Paulo/SP",
    endereco: "Av. Brigadeiro Faria Lima, 0000 — Itaim Bibi",
    tipo: "comercial",
    unidades: 44,
    sindico_nome: "Aurora Fundo de Investimento Imobiliário",
    gestor_nome: "Mariana Costa",
    foto_path: fotoPredio,
    ficha: {
      areaConstruida: 38450,
      areaPrivativa: 24300,
      torres: "1 torre",
      pavimentos: "22 tipo + térreo",
      vagas: 520,
      elevadores: 10,
      inicioGestao: "2024-02",
      destaques: ["Certificação LEED Gold", "Energia no Mercado Livre", "Heliponto homologado", "BMS integrado"],
      sindicoDocumento: "00.000.000/0001-00",
    },
  })
  .eq("id", emp.id);

/* ----------------------------------------------------- séries do ano (1..10) */
const MESES = 10;
const ruido = (i: number, amplitude: number, fase = 0) => Math.round(Math.sin(i * 1.7 + fase) * amplitude);
const arred = (n: number) => Math.round(n * 100) / 100;

const ORCADO: [string, number][] = [
  ["Segurança patrimonial e combate a incêndio", 182_000],
  ["Limpeza e sanificação", 148_000],
  ["Manutenção predial", 96_000],
  ["Climatização", 64_000],
  ["Despesas administrativas", 58_000],
  ["Elevadores", 38_000],
  ["Tarifas públicas e concessionárias", 22_000],
  ["Seguros", 14_000],
  ["Jardinagem e paisagismo", 9_000],
  ["Despesas bancárias", 1_200],
];
const energia = [298_400, 305_100, 292_300, 270_800, 248_600, 236_200, 232_900, 240_500, 252_700, 261_300];
const agua = [1_720, 1_765, 1_690, 1_612, 1_544, 1_481, 1_463, 1_502, 1_558, 1_587];
const ocupacao = [86, 86, 87, 88, 89, 90, 91, 92, 93, 94];
const noPrazo = [0.905, 0.91, 0.912, 0.918, 0.925, 0.93, 0.934, 0.94, 0.946, 0.951];
const capexReserva = [0, 0, 0, 0, 62_000, 184_000, 0, 0, 38_000, 95_000];

const montarMes = (i: number, anterior: DadosRelatorio | null): DadosRelatorio => {
  const d: DadosRelatorio = anterior ? herdarDoMesAnterior(anterior) : relatorioEmBranco();
  const emitido = 705_000 + (i >= 6 ? 12_000 : 0);
  const taxaAtraso = 0.032 - i * 0.0018;
  const recebido = arred(emitido * (1 - taxaAtraso));

  // orçamento: realizado oscila em torno do orçado; segurança acima no 1º semestre
  d.financeiro.grupos = ORCADO.map(([grupo, orcado], k) => {
    const existente = d.financeiro.grupos.find((g) => g.grupo === grupo);
    const vies = grupo.startsWith("Segurança") && i < 6 ? 0.06 : grupo.startsWith("Limpeza") && i === 9 ? 0.09 : 0;
    const realizado = Math.max(0, Math.round(orcado * (1 + vies) + ruido(i, orcado * 0.035, k)));
    return { id: existente?.id ?? novoId(), grupo, orcado, realizado, observacao: "" };
  });
  const despesaOrdinaria = d.financeiro.grupos.reduce((s, g) => s + g.realizado, 0);

  // inadimplência por rubrica: atraso do mês entra, recuperação sai
  const rubricas = anterior
    ? d.juridico.inadimplencia.rubricas
    : [
        { id: novoId(), rubrica: "Ordinária", ateAnterior: 96_000, recebido: 0, doMes: 0 },
        { id: novoId(), rubrica: "Fundo de reserva", ateAnterior: 6_400, recebido: 0, doMes: 0 },
        { id: novoId(), rubrica: "Fundo de melhorias", ateAnterior: 3_100, recebido: 0, doMes: 0 },
      ];
  const atrasoMes = emitido - recebido;
  d.juridico.inadimplencia.rubricas = rubricas.map((r, k) => {
    const peso = [0.88, 0.08, 0.04][k] ?? 0;
    const doMes = arred(atrasoMes * peso);
    const recupera = arred((r.ateAnterior + doMes) * (0.32 + (i % 3) * 0.04));
    return { ...r, recebido: recupera, doMes };
  });
  const recuperado = d.juridico.inadimplencia.rubricas.reduce((s, r) => s + r.recebido, 0);

  // fundos encadeados: ordinária, reserva, melhorias
  const rendimento = (saldo: number) => arred(saldo * 0.0085);
  const base = anterior
    ? d.financeiro.fundos
    : [
        { id: novoId(), fundo: "Ordinária", anterior: 1_120_000, creditos: 0, debitos: 0 },
        { id: novoId(), fundo: "Fundo de reserva", anterior: 812_000, creditos: 0, debitos: 0 },
        { id: novoId(), fundo: "Fundo de melhorias", anterior: 236_000, creditos: 0, debitos: 0 },
      ];
  d.financeiro.fundos = [
    { ...base[0], creditos: arred(recebido + recuperado * 0.88 + rendimento(base[0].anterior)), debitos: despesaOrdinaria },
    { ...base[1], creditos: arred(42_000 + rendimento(base[1].anterior)), debitos: capexReserva[i] },
    { ...base[2], creditos: arred(24_000 + rendimento(base[2].anterior)), debitos: 8_000 + Math.abs(ruido(i, 9_000, 2)) },
  ];
  d.financeiro.arrecadacao = { emitido, recebido };

  // operação
  const total = 560 + ruido(i, 40, 1);
  const canceladas = Math.round(total * 0.06);
  const abertas = 18 + Math.abs(ruido(i, 8, 3));
  const concluidas = total - canceladas - abertas;
  const prazo = Math.round(concluidas * noPrazo[i]);
  d.operacao.situacaoOS = {
    concluidasNoPrazo: prazo,
    concluidasComAtraso: concluidas - prazo,
    abertasNoPrazo: abertas - Math.max(3, 9 - i),
    abertasAtrasadas: Math.max(3, 9 - i),
    canceladas,
  };
  d.operacao.resumo = { preventivas: Math.round(total * 0.68), corretivas: Math.round(total * 0.24), acompanhamentos: Math.round(total * 0.05), rondas: 0, naoRealizadas: Math.max(2, 12 - i) };
  d.operacao.disciplinas = [
    ["Elétrica", 0.22],
    ["Hidráulica", 0.16],
    ["Climatização", 0.19],
    ["Civil", 0.14],
    ["Elevadores", 0.08],
    ["Limpeza", 0.13],
    ["CFTV e acesso", 0.08],
  ].map(([disciplina, p]) => ({ id: novoId(), disciplina: disciplina as string, quantidade: Math.round(total * (p as number)) }));
  d.operacao.ocupacao = ocupacao[i];
  d.operacao.acessosFixos = 204_000 + i * 2_600 + ruido(i, 3_000);
  d.operacao.acessosVisitantes = 3_300 + ruido(i, 400, 2);

  // utilidades (o mês anterior vira base pela herança)
  const linhas = d.utilidades.linhas;
  const iAgua = linhas.findIndex((u) => /gua/.test(u.utilidade));
  const iEnergia = linhas.findIndex((u) => /nergia/.test(u.utilidade));
  linhas[iAgua] = { ...linhas[iAgua], unidade: "m³", consumo: agua[i], fatura: Math.round(agua[i] * 22.6), detalhamento: "Sabesp · medição mensal" };
  linhas[iEnergia] = {
    ...linhas[iEnergia],
    unidade: "kWh",
    consumo: energia[i],
    ponta: Math.round(energia[i] * 0.12),
    foraPonta: Math.round(energia[i] * 0.88),
    fatura: Math.round(energia[i] * 0.71),
    detalhamento: "Enel + Mercado Livre (energia incentivada)",
  };

  // volume e SLA dos fornecedores: a herança zera todo mês, então preenche sempre
  const volumes: Record<string, [number, number]> = {
    "Vigilância Sentinela": [1_488, 97],
    "Prime Facilities": [412, 95],
    "Atlas Elevadores": [40 + (i % 4) * 2, 91 + (i % 3)],
    "Clima Engenharia": [102 + (i % 5) * 3, 95 + (i % 2)],
    "Sistemas BMS Brasil": [28 + (i % 4), 86 + (i % 4)],
  };
  d.fornecedores.linhas = d.fornecedores.linhas.map((f) => ({ ...f, realizado: volumes[f.fornecedor]?.[0] ?? 0, sla: volumes[f.fornecedor]?.[1] ?? 0 }));

  d.importacao = {
    fonte: "LiveFacilities (RP Smart)",
    em: new Date(2026, i + 1, 4, 9).toISOString(),
    secoes: ["financeiro", "juridico", "arrecadacao", "os", "operacao", "contratos", "documentos"],
    avisos: [],
  };
  return d;
};

/* --------------------------------------- estrutura fixa (entra em janeiro) */
const estruturaFixa = (d: DadosRelatorio) => {
  d.contratos.linhas = [
    ["Atlas Elevadores", "Manutenção preventiva e corretiva de elevadores", "2027-11-30"],
    ["Prime Facilities", "Limpeza, conservação e jardinagem", "2027-03-31"],
    ["Vigilância Sentinela", "Segurança patrimonial e brigada", "2026-12-31"],
    ["Clima Engenharia", "Operação e manutenção de climatização (chillers)", "2027-06-30"],
    ["Força Geradores", "Manutenção de grupos geradores", "2027-01-15"],
    ["Hidro Serviços", "Bombas, cisternas e reservatórios", "2027-08-31"],
    ["Fachada Limpa Altura", "Limpeza de fachada (trimestral)", "2027-02-28"],
    ["Sistemas BMS Brasil", "Supervisão predial (BMS)", "2026-11-30"],
  ].map(([fornecedor, objeto, vencimento]) => ({ id: novoId(), fornecedor, objeto, situacao: "vigente" as const, vencimento, observacao: "" }));
  d.documentos.linhas = [
    ["AVCB — Auto de Vistoria do Corpo de Bombeiros", "Corpo de Bombeiros", "2027-02-14", false],
    ["Laudo de SPDA (para-raios)", "Engenharia", "2027-05-20", false],
    ["Laudo de estanqueidade de gás", "Engenharia", "2026-12-05", false],
    ["Certificado de limpeza de reservatórios", "Vigilância sanitária", "2027-03-10", false],
    ["PMOC — Plano de Manutenção do Ar-Condicionado", "Engenharia", "2027-07-01", false],
    ["Apólice de seguro predial", "Seguradora", "2027-04-30", false],
    ["Laudo de inspeção predial", "Engenharia", "2026-11-28", false],
    ["Convenção de condomínio", "Cartório", "", true],
    ["Habite-se", "Prefeitura", "", true],
    ["Licença de funcionamento do heliponto", "ANAC", "2027-09-15", false],
  ].map(([documento, orgao, validade, permanente]) => ({
    id: novoId(),
    documento: documento as string,
    orgao: orgao as string,
    validade: validade as string,
    permanente: permanente as boolean,
    observacao: "",
  }));
  d.juridico.certidoes = d.juridico.certidoes.map((c, i) => ({ ...c, validade: ["2027-03-25", "2026-12-18", "2027-04-02", "2027-01-30", "2027-02-11"][i] }));
  d.juridico.escritorio = "Moura & Associados Advogados";
  d.fornecedores.linhas = [
    ["Vigilância Sentinela", "Segurança", 1_488, "postos-dia", 97],
    ["Prime Facilities", "Limpeza", 412, "rotinas", 95],
    ["Atlas Elevadores", "Elevadores", 46, "OS", 92],
    ["Clima Engenharia", "Climatização", 108, "OS", 96],
    ["Sistemas BMS Brasil", "BMS", 31, "OS", 88],
  ].map(([fornecedor, disciplina, realizado, unidade, sla]) => ({
    id: novoId(),
    fornecedor: fornecedor as string,
    disciplina: disciplina as string,
    realizado: realizado as number,
    unidade: unidade as string,
    sla: sla as number,
    criticidade: ((sla as number) >= 95 ? "baixa" : (sla as number) >= 90 ? "media" : "alta") as "baixa" | "media" | "alta",
  }));
};

/* ------------------------------------------------- outubro: RGM de vitrine */
const completarOutubro = (d: DadosRelatorio, fotos: Foto[]) => {
  d.sumario = {
    avaliacaoGeral:
      "Outubro consolida a recuperação do ativo: ocupação de 94%, a maior desde o início da gestão, inadimplência em queda pelo sexto mês seguido e 95% das ordens de serviço concluídas no prazo. O resultado financeiro de setembro foi positivo mesmo com R$ 38 mil da reserva aplicados na modernização dos elevadores.",
    principaisResultados: [
      "R$ 186 mil/ano de economia projetada com a renegociação de vigilância e limpeza (2027)",
      "R$ 41 mil de inadimplência recuperada no mês",
      "Ocupação de 94%: 2 novos locatários no 18º andar",
    ],
    pontosAtencao: ["Contrato de vigilância vence em 31/12 — renovação em negociação", "Laudo de inspeção predial vence em 28/11"],
  };
  d.financeiro.comentario =
    "Resultado positivo: créditos acima dos débitos pelo quarto mês seguido.\nReserva: aplicação de R$ 38 mil na modernização dos elevadores, conforme aprovado em assembleia.\nOrçamento: limpeza 9% acima do previsto pela lavagem extra de fachada pré-evento; demais grupos dentro da meta.";
  d.financeiro.grupos = d.financeiro.grupos.map((g) =>
    g.grupo.startsWith("Limpeza") ? { ...g, observacao: "Lavagem extra de fachada solicitada para o evento de locatário (reembolsável)." } : g,
  );
  d.financeiro.conciliacao = "Saldo contábil conciliado com os extratos bancários de 30/09 — sem divergências.";
  d.operacao.comentario =
    "Climatização: preventiva anual dos chillers concluída sem parada de operação.\nElevadores: modernização do elevador 4 em execução, entrega prevista para dezembro.\nFachada: lavagem trimestral concluída antes do prazo.";
  d.operacao.ocorrencias = [
    { id: novoId(), ocorrencia: "Vazamento na prumada do 12º andar", tipo: "corretiva", acao: "Troca de 3 m de tubulação e teste de estanqueidade", resultado: "Resolvido em 6 h, sem dano a locatários", concluida: true },
    { id: novoId(), ocorrencia: "Preventiva anual dos chillers", tipo: "preventiva", acao: "Limpeza de condensadores e análise de óleo", resultado: "Eficiência 7% maior que no ano anterior", concluida: true },
    { id: novoId(), ocorrencia: "Modernização do elevador 4", tipo: "melhoria", acao: "Troca de máquina de tração e comando", resultado: "60% executado; entrega em dezembro", concluida: false },
    { id: novoId(), ocorrencia: "Falha no controle de acesso da garagem", tipo: "corretiva", acao: "Substituição da controladora", resultado: "Operação normalizada", concluida: true },
  ];
  d.contratos.comentario = "Vigilância: proposta de renovação com redução de 8% em análise final.\nBMS: aditivo de renovação enviado para assinatura.";
  d.documentos.comentario = "Laudo de inspeção predial: vistoria agendada para 21/11, antes do vencimento.";
  d.juridico.processos = [
    { id: novoId(), numero: "1000123-45.2026.8.26.0100", vara: "12ª Vara Cível — SP", tipo: "Cível", objeto: "Cobrança de cotas condominiais (conjunto 1504)", andamento: "Acordo homologado; 3 de 10 parcelas pagas", proximaData: "", criticidade: "baixa", valor: 64_200, prognostico: "remoto" },
    { id: novoId(), numero: "1001876-02.2026.5.02.0011", vara: "11ª Vara do Trabalho — SP", tipo: "Trabalhista", objeto: "Reclamação de ex-colaborador de terceirizada", andamento: "Audiência de instrução designada", proximaData: "2026-12-09", criticidade: "media", valor: 38_000, prognostico: "possivel" },
  ];
  d.juridico.acordos = [
    { id: novoId(), unidade: "Conj. 1504", devedor: "Locatário — conj. 1504", parcelas: 10, parcelasPagas: 3, valor: 64_200, valorPago: 19_260, status: "Em dia" },
  ];
  d.juridico.comentario = "Inadimplência no menor patamar do ano; acordo do conjunto 1504 em dia.";
  d.utilidades.comentario = "Energia: consumo 3,4% acima de setembro com a volta do calor; 36% mais barata que a tarifa cativa graças ao Mercado Livre.\nÁgua: estável; reúso nas torres de resfriamento evitou 210 m³ no mês.";
  d.suprimentos.pedidos = [
    ["2201", "Peças de elevador", "Elevadores", "Finalizado", 18_400, "2026-10-02", "2026-10-20"],
    ["2204", "Filtros de ar (chillers)", "Climatização", "Finalizado", 7_850, "2026-10-03", "2026-10-15"],
    ["2210", "Tubulação e conexões", "Manutenção predial", "Finalizado", 2_980, "2026-10-08", "2026-10-09"],
    ["2215", "Controladora de acesso", "Segurança patrimonial e combate a incêndio", "Finalizado", 6_200, "2026-10-11", "2026-10-18"],
    ["2219", "Lâmpadas LED (garagem)", "Manutenção predial", "Aprovado", 4_350, "2026-10-17", "2026-11-05"],
    ["2223", "Produtos de limpeza", "Limpeza e sanificação", "Aprovado", 3_120, "2026-10-21", "2026-11-04"],
    ["2227", "Revisão do gerador 2", "Manutenção predial", "Em orçamento", 0, "2026-10-28", "2026-11-20"],
  ].map(([pedido, categoria, grupo, status, valor, solicitacao, prazo]) => ({
    id: novoId(),
    pedido: pedido as string,
    categoria: categoria as string,
    grupo: grupo as string,
    status: status as string,
    valor: valor as number,
    solicitacao: solicitacao as string,
    prazo: prazo as string,
  }));
  d.capex.linhas = [
    { id: novoId(), iniciativa: "Modernização do elevador 4", orcado: 420_000, realizado: 252_000, status: "em_andamento", beneficio: "−30% de energia no elevador e fim das paradas recorrentes" },
    { id: novoId(), iniciativa: "Retrofit de iluminação LED da garagem", orcado: 86_000, realizado: 86_000, status: "concluido", beneficio: "R$ 3,1 mil/mês de economia de energia" },
    { id: novoId(), iniciativa: "Recuperação da fachada (vedação)", orcado: 240_000, realizado: 0, status: "planejado", beneficio: "Elimina infiltrações nos andares 19 a 22" },
  ];
  d.capex.comentario = "Elevador 4 dentro do orçamento e do cronograma.";
  d.valorGerado.linhas = [
    { id: novoId(), tipo: "realizado", valor: 41_200, descricao: "inadimplência recuperada em setembro/2026", observacao: "" },
    { id: novoId(), tipo: "realizado", valor: 3_100, periodicidade: "/mês", descricao: "economia de energia com LED na garagem", observacao: "Medido na fatura" },
    { id: novoId(), tipo: "estimado", valor: 61_000, descricao: "economia no Mercado Livre de energia (36%)", observacao: "Informado pela comercializadora" },
    { id: novoId(), tipo: "projetado", valor: 186_000, periodicidade: "/ano", descricao: "renegociação de vigilância e limpeza para 2027", observacao: "Vale após assinatura dos aditivos" },
  ];
  d.riscos.linhas = [
    { id: novoId(), assunto: "Renovação do contrato de vigilância", criticidade: "alta", consequencia: "Risco de descontinuidade da segurança a partir de 01/01", acao: "Fechar proposta com redução de 8% até 30/11", responsavel: "Mariana Costa", prazo: "2026-11-30", status: "em_andamento" },
    { id: novoId(), assunto: "Laudo de inspeção predial", criticidade: "media", consequencia: "Exposição perante seguradora e prefeitura", acao: "Vistoria agendada em 21/11", responsavel: "Engenharia RPS", prazo: "2026-11-21", status: "em_andamento" },
    { id: novoId(), assunto: "Infiltração nos andares 19 a 22", criticidade: "media", consequencia: "Dano a locatários e à imagem do ativo", acao: "Aprovar CAPEX de recuperação da fachada", responsavel: "Proprietário", prazo: "2026-12-15", status: "em_andamento" },
    { id: novoId(), assunto: "Controladora de acesso da garagem", criticidade: "baixa", consequencia: "", acao: "Substituída", responsavel: "Gestão RPS", prazo: "2026-10-18", status: "concluida" },
    { id: novoId(), assunto: "Preventiva anual dos chillers", criticidade: "media", consequencia: "", acao: "Executada", responsavel: "Clima Engenharia", prazo: "2026-10-25", status: "concluida" },
  ];
  d.riscos.comentario = "Nenhum risco crítico sem plano; a renovação da vigilância é a prioridade de novembro.";
  d.proximosPassos.linhas = [
    { id: novoId(), decisao: "Aprovar CAPEX de recuperação da fachada (R$ 240 mil, fundo de reserva)", prazo: "15/12", status: "Aguardando proprietário", dependeDoCliente: true },
    { id: novoId(), decisao: "Validar a renovação da vigilância com redução de 8%", prazo: "30/11", status: "Proposta enviada", dependeDoCliente: true },
    { id: novoId(), decisao: "Concluir a vistoria de inspeção predial", prazo: "21/11", status: "Agendado", dependeDoCliente: false },
    { id: novoId(), decisao: "Entregar a modernização do elevador 4", prazo: "dez/26", status: "Em execução", dependeDoCliente: false },
  ];
  d.fotos = fotos;
  const importadoEm = new Date(2026, 10, 5, 10).toISOString();
  d.arquivosImportados = [
    { nome: "PrevistoRealizado_set2026.pdf", titulo: "Previsto x Realizado", competencia: "2026-09", em: importadoEm, secoes: ["financeiro"] },
    { nome: "PosicaoFinanceira_set2026.pdf", titulo: "Posição Financeira", competencia: "2026-09", em: importadoEm, secoes: ["financeiro"] },
    { nome: "Fatura_Sabesp_out2026.pdf", titulo: "Conta de água", competencia: "2026-10", em: importadoEm, secoes: ["utilidades"] },
    { nome: "Fatura_Enel_out2026.pdf", titulo: "Conta de energia", competencia: "2026-10", em: importadoEm, secoes: ["utilidades"] },
    { nome: "ListaPedidos_out2026.xlsx", titulo: "Lista de Pedidos de Compra", competencia: "2026-10", em: importadoEm, secoes: ["suprimentos"] },
  ];
  d.conclusao =
    "O Aurora Corporate fecha outubro com indicadores operacionais e financeiros em trajetória positiva. As duas decisões pedidas ao proprietário — fachada e vigilância — destravam a economia de 2027 e protegem o valor do ativo.";
};

/* ------------------------------------------------------- gravação no banco */
const { data: existentes } = await sb.from("relatorios").select("id, competencia, status").eq("empreendimento_id", emp.id);
const porComp = new Map((existentes ?? []).map((r) => [r.competencia as string, r]));
// reabre os publicados do demo para poder regravar (trigger de proteção)
for (const r of existentes ?? []) {
  if (r.status === "publicado") await sb.from("relatorios").update({ status: "rascunho" }).eq("id", r.id);
}

let anterior: DadosRelatorio | null = null;
for (let i = 0; i < MESES; i++) {
  const competencia = `2026-${String(i + 1).padStart(2, "0")}-01`;
  const dados = montarMes(i, anterior);
  if (i === 0) estruturaFixa(dados);

  let id = porComp.get(competencia)?.id as string | undefined;
  if (!id) {
    const { data, error } = await sb.from("relatorios").insert({ empreendimento_id: emp.id, competencia, status: "rascunho", dados }).select("id").single();
    if (error) throw new Error(`${competencia}: ${error.message}`);
    id = data.id as string;
  }

  if (i === MESES - 1) {
    const fotos: Foto[] = [];
    for (const [arquivo, legenda, categoria] of [
      ["p-cobertura.jpg", "Preventiva anual dos chillers e torres de resfriamento", "manutencao"],
      ["p-elevador.jpg", "Modernização do elevador 4 — comando novo instalado", "melhoria"],
      ["p-limpeza.jpg", "Lavagem trimestral da fachada concluída antes do prazo", "manutencao"],
      ["p-painel.jpg", "Termografia e reaperto do quadro geral de baixa tensão", "manutencao"],
      ["p-recepcao.jpg", "Recepção após reorganização do fluxo de visitantes", "melhoria"],
      ["p-fachada.jpg", "Fachada — vedação a recuperar nos andares 19 a 22", "ocorrencia"],
    ] as const) {
      fotos.push({ id: novoId(), path: await enviar(`${id}/${arquivo.replace("p-", "")}`, arquivo), legenda, categoria });
    }
    completarOutubro(dados, fotos);
  }

  const status = i < MESES - 1 ? "publicado" : "rascunho";
  const { error } = await sb
    .from("relatorios")
    .update({ dados, indice_executivo: calcularIndiceExecutivo(dados, new Date(2026, i + 1, 8)), status, publicado_em: status === "publicado" ? new Date(2026, i + 1, 8).toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`${competencia}: ${error.message}`);
  console.log(`${competencia} ${status} · índice ${calcularIndiceExecutivo(dados, new Date(2026, i + 1, 8))}`);
  anterior = dados;
}
console.log(`pronto: ${emp.nome}`);
