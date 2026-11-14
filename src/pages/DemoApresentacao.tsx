/**
 * Demonstração dos slides com dados FICTÍCIOS — só no modo desenvolvimento
 * (rota registrada apenas quando import.meta.env.DEV). Serve para revisar o
 * layout sem login nem banco: `npm run dev` → /demo/rgm
 */

import { useMemo } from "react";
import { montarSlides } from "@/components/apresentacao/slides";
import { ALTURA, LARGURA } from "@/components/apresentacao/moldura";
import { herdarDoMesAnterior, novoId, relatorioEmBranco } from "@/lib/defaults";
import type { DadosRelatorio, Empreendimento, Relatorio } from "@/lib/types";

const emp: Empreendimento = {
  id: "demo",
  nome: "Edifício Corporativo Exemplo",
  endereco: null,
  cidade: "Curitiba/PR",
  tipo: "comercial",
  unidades: 18,
  area_total: null,
  sindico_nome: "Exemplo Participações S.A.",
  proprietario_nome: null,
  gestor_nome: "Gestora RPS",
  ativo: true,
  lf_id_empreendimento: 999,
  lf_cd_condominio: "0999",
  ficha: {
    areaConstruida: 41250.5,
    areaPrivativa: 26800,
    torres: "2 (A e B)",
    pavimentos: "12 tipo + térreo",
    vagas: 480,
    elevadores: 12,
    inicioGestao: "2025-03",
    destaques: ["Energia no Mercado Livre", "Controle de acesso e BMS", "Certificação LEED"],
    sindicoDocumento: "00.000.000/0001-00",
  },
  foto_path: null,
  created_at: "",
  updated_at: "",
};

const mes = (base: DadosRelatorio, ajuste: (d: DadosRelatorio) => void) => {
  const d = structuredClone(base);
  ajuste(d);
  return d;
};

const agosto = mes(relatorioEmBranco(), (d) => {
  d.financeiro.fundos = [
    { id: novoId(), fundo: "Conta ordinária", anterior: 420_000, creditos: 700_000, debitos: 812_000 },
    { id: novoId(), fundo: "Fundo de reserva", anterior: 95_000, creditos: 32_000, debitos: 60_000 },
    { id: novoId(), fundo: "Fundo de melhorias", anterior: 50_000, creditos: 12_000, debitos: 8_000 },
  ];
  d.utilidades.linhas[0] = { ...d.utilidades.linhas[0], consumo: 1490, fatura: 35_400 };
  d.utilidades.linhas[1] = { ...d.utilidades.linhas[1], consumo: 231_000, fatura: 168_000 };
});

const setembro = mes(herdarDoMesAnterior(agosto), (d) => {
  d.financeiro.fundos = d.financeiro.fundos.map((f, i) => ({ ...f, creditos: [760_000, 31_000, 11_000][i], debitos: [790_000, 145_000, 9_000][i] }));
  d.utilidades.linhas[0] = { ...d.utilidades.linhas[0], consumo: 1520, fatura: 36_100 };
  d.utilidades.linhas[1] = { ...d.utilidades.linhas[1], consumo: 248_000, fatura: 176_500 };
});

const outubro = mes(herdarDoMesAnterior(setembro), (d) => {
  d.sumario.principaisResultados = [
    "R$ 14,8 mil de economia em manutenção predial vs. orçamento",
    "R$ 180 mil/ano de otimização contratual projetada para 2027",
    "R$ 52 mil de inadimplência recuperada",
  ];
  d.financeiro.fundos = d.financeiro.fundos.map((f, i) => ({ ...f, creditos: [770_000, 30_000, 12_000][i], debitos: [781_000, 118_000, 7_500][i] }));
  d.financeiro.grupos = [
    { id: novoId(), grupo: "Limpeza e sanificação", orcado: 160_000, realizado: 186_000, observacao: "Lavagem de fachada pontual." },
    { id: novoId(), grupo: "Segurança patrimonial", orcado: 165_000, realizado: 187_500, observacao: "Brigada acima do orçado; redução prevista para dezembro." },
    { id: novoId(), grupo: "Manutenção predial", orcado: 170_000, realizado: 155_200, observacao: "" },
    { id: novoId(), grupo: "Despesas administrativas", orcado: 62_000, realizado: 64_300, observacao: "" },
    { id: novoId(), grupo: "Grupos geradores", orcado: 5_000, realizado: 11_200, observacao: "" },
    { id: novoId(), grupo: "Elevadores", orcado: 24_000, realizado: 23_800, observacao: "" },
  ];
  d.financeiro.arrecadacao = { emitido: 610_000, recebido: 587_500 };
  d.juridico.inadimplencia.rubricas = [
    { id: novoId(), rubrica: "Ordinária", ateAnterior: 55_000, recebido: 41_000, doMes: 6_200 },
    { id: novoId(), rubrica: "Fundo privativo / reembolsável", ateAnterior: 17_500, recebido: 12_400, doMes: 1_900 },
    { id: novoId(), rubrica: "Fundo de reserva", ateAnterior: 1_600, recebido: 1_100, doMes: 300 },
  ];
  d.juridico.acordos = [{ id: novoId(), unidade: "Garagem G1", devedor: "Exemplo Garagens", parcelas: 6, parcelasPagas: 3, valor: 24_000, valorPago: 12_000, status: "Em andamento" }];
  d.juridico.processos = [
    { id: novoId(), numero: "0000001-00.2026.5.09.0001", vara: "1ª VT", objeto: "Reclamação trabalhista de terceirizado", andamento: "Aguardando audiência", proximaData: "2026-12-03", criticidade: "media" },
  ];
  d.operacao.ocupacao = 94;
  d.operacao.acessosFixos = 218_400;
  d.operacao.acessosVisitantes = 3_640;
  d.operacao.situacaoOS = { concluidasNoPrazo: 498, concluidasComAtraso: 31, abertasNoPrazo: 12, abertasAtrasadas: 27, canceladas: 96 };
  d.operacao.resumo = { preventivas: 402, corretivas: 127, acompanhamentos: 0, rondas: 0, naoRealizadas: 39 };
  d.operacao.ocorrencias = [
    { id: novoId(), ocorrencia: "Elevadores", tipo: "corretiva", acao: "6 chamados técnicos para verificação", resultado: "Em análise de causa", concluida: false },
    { id: novoId(), ocorrencia: "Climatização", tipo: "preventiva", acao: "Preventivas nas torres A e B", resultado: "Concluído", concluida: true },
    { id: novoId(), ocorrencia: "Elétrica", tipo: "preventiva", acao: "Subestações, cisternas e geradores", resultado: "Concluído", concluida: true },
    { id: novoId(), ocorrencia: "Limpeza", tipo: "preventiva", acao: "Lavação de halls, escadas e rampas", resultado: "Concluído", concluida: true },
  ];
  d.contratos.linhas = [
    { id: novoId(), fornecedor: "Elevadores Exemplo", objeto: "Manutenção de elevadores", situacao: "vigente", vencimento: "2027-11-30", observacao: "" },
    { id: novoId(), fornecedor: "Limpeza Exemplo", objeto: "Limpeza e conservação", situacao: "vigente", vencimento: "2026-12-31", observacao: "" },
    { id: novoId(), fornecedor: "Segurança Exemplo", objeto: "Vigilância patrimonial", situacao: "vigente", vencimento: "2026-02-01", observacao: "" },
    { id: novoId(), fornecedor: "Geradores Exemplo", objeto: "Manutenção de grupos geradores", situacao: "vigente", vencimento: "2027-01-15", observacao: "" },
    { id: novoId(), fornecedor: "Jardinagem Exemplo", objeto: "Paisagismo", situacao: "vigente", vencimento: "", observacao: "" },
  ];
  d.documentos.linhas = [
    { id: novoId(), documento: "Plano de atendimento a emergência (PAE)", orgao: "Bombeiros", validade: "2026-06-03", observacao: "Propostas solicitadas" },
    { id: novoId(), documento: "AVCB do condomínio", orgao: "Corpo de Bombeiros", validade: "2027-01-05", observacao: "Iniciar renovação imediatamente" },
    { id: novoId(), documento: "Manual de segurança e plano de abandono", orgao: "Bombeiros", validade: "2026-12-19", observacao: "Revisar junto com o PAE" },
    { id: novoId(), documento: "CND Federal", orgao: "Receita Federal", validade: "2027-04-10", observacao: "" },
    { id: novoId(), documento: "CRF do FGTS", orgao: "Caixa", validade: "2027-03-02", observacao: "" },
    { id: novoId(), documento: "Convenção do condomínio", orgao: "Cartório", validade: "", permanente: true, observacao: "" },
    { id: novoId(), documento: "Laudo SPDA", orgao: "Engenharia", validade: "2027-08-20", observacao: "" },
  ];
  d.riscos.linhas = [
    { id: novoId(), assunto: "Fundo de reserva negativo", criticidade: "alta", acao: "Plano de recomposição a deliberar", responsavel: "Gestão RPS", prazo: "2026-12-15" },
    { id: novoId(), assunto: "Documentos vencidos", criticidade: "alta", acao: "Atualizar PAE e laudos", responsavel: "", prazo: "" },
    { id: novoId(), assunto: "Desvio em limpeza e segurança", criticidade: "media", acao: "Otimização contratual 2027", responsavel: "Gestão RPS", prazo: "2027-01-31" },
  ];
  d.proximosPassos.linhas = [
    { id: novoId(), decisao: "Recomposição do fundo de reserva", prazo: "dez/26", status: "Definir forma e prazo", dependeDoCliente: true },
    { id: novoId(), decisao: "Estratégia de energia 2027", prazo: "dez/26", status: "Cotações em curso", dependeDoCliente: true },
    { id: novoId(), decisao: "Protocolar renovação do AVCB", prazo: "30/11", status: "Em andamento", dependeDoCliente: false },
    { id: novoId(), decisao: "Contratar atualização do PAE", prazo: "", status: "Propostas", dependeDoCliente: false },
  ];
  d.utilidades.linhas[0] = { ...d.utilidades.linhas[0], consumo: 1505, fatura: 35_900, observacao: "Novo hidrômetro instalado sem custo." };
  d.utilidades.linhas[1] = { ...d.utilidades.linhas[1], consumo: 239_500, fatura: 171_200 };
  d.juridico.escritorio = "Escritório Exemplo Advogados";
  d.juridico.processos[0] = { ...d.juridico.processos[0], tipo: "Trabalhista", prognostico: "nao_apurado", valor: 0 };
  d.juridico.processos.push({ id: novoId(), numero: "0000002-00.2026.8.16.0001", vara: "3ª Cível", tipo: "Cível", objeto: "Cobrança de condômino", andamento: "Sentença favorável", proximaData: "", criticidade: "baixa", valor: 18_500, prognostico: "remoto" });
  d.juridico.certidoes = d.juridico.certidoes.map((c, i) => ({ ...c, validade: ["2027-03-25", "", "", "2026-12-30", "2027-01-11"][i] }));
  d.financeiro.conciliacao =
    "Saldo contábil (30/09): fundo de reserva negativo após investimentos em fachada.\nSaldo bancário: R$ 98,4 mil na conta do fundo.\nConciliação pendente: diferença em análise com a contabilidade.";
  d.valorGerado.linhas = [
    { id: novoId(), tipo: "estimado", valor: 58_400, descricao: "economia no Mercado Livre de energia (25,1%)", observacao: "Estimativa da comercializadora; passa a realizado após validação por medição." },
    { id: novoId(), tipo: "projetado", valor: 180_000, periodicidade: "/ano", descricao: "otimização contratual 2027", observacao: "Reportado como realizado somente após os aditivos e o faturamento." },
    { id: novoId(), tipo: "investido", valor: 118_000, descricao: "pagos pelo Fundo de Reserva no mês", observacao: "" },
  ];
  d.riscos.linhas = d.riscos.linhas.map((r, i) => ({ ...r, consequencia: ["Falta de lastro para emergências", "Exposição legal e securitária", "Pressão contínua sobre o orçamento"][i] }));
  d.riscos.linhas.push(
    { id: novoId(), assunto: "Troca de filtros da climatização", criticidade: "baixa", acao: "Executado pela C&C", responsavel: "", prazo: "", status: "concluida" },
    { id: novoId(), assunto: "Revisão do contrato de jardinagem", criticidade: "media", acao: "Aditivo assinado", responsavel: "", prazo: "", status: "concluida" },
  );
  d.importacao = { fonte: "LiveFacilities (RP Smart)", em: new Date().toISOString(), secoes: ["financeiro", "juridico", "arrecadacao", "os", "operacao", "contratos", "documentos"], avisos: [] };
});

const rel = (competencia: string, dados: DadosRelatorio): Relatorio => ({
  id: competencia,
  empreendimento_id: "demo",
  competencia,
  status: "rascunho",
  dados,
  indice_executivo: null,
  publicado_em: null,
  created_at: "",
  updated_at: "",
  empreendimento: emp,
});

const DemoApresentacao = () => {
  const slides = useMemo(() => {
    const historico = [rel("2026-08-01", agosto), rel("2026-09-01", setembro), rel("2026-10-01", outubro)];
    return montarSlides({ relatorio: historico[2], historico, urlsFotos: {}, hoje: new Date(2026, 10, 13) });
  }, []);

  // ?slide=<id> mostra um slide só, sem moldura — usado para capturas de tela.
  const unico = new URLSearchParams(window.location.search).get("slide");
  if (unico) {
    const s = slides.find((x) => x.id === unico);
    return <div style={{ width: LARGURA, height: ALTURA }}>{s?.node ?? `slide ${unico} não existe`}</div>;
  }

  return (
    <div className="slides-impressao flex flex-col items-center gap-6 bg-[#e9eaf0] py-6">
      {slides.map((s) => (
        <div key={s.id} id={`slide-${s.id}`} className="slide-pagina bg-white shadow-lg" style={{ width: LARGURA, height: ALTURA }}>
          {s.node}
        </div>
      ))}
    </div>
  );
};

export default DemoApresentacao;
