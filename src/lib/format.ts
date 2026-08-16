/**
 * Formatação pt-BR. Os valores circulam pelo app como `number`;
 * a máscara só aparece na exibição. Isso elimina o `replace(/\D/g,"")`
 * da versão anterior, que corrompia centavos e perdia sinal negativo.
 */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const brlCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export const formatarMoeda = (valor: number) => brl.format(Number.isFinite(valor) ? valor : 0);

/** Para eixos de gráfico e KPIs: R$ 1,2 mi em vez de R$ 1.200.000,00 */
export const formatarMoedaCompacta = (valor: number) =>
  brlCompacto.format(Number.isFinite(valor) ? valor : 0);

export const formatarNumero = (valor: number, casas = 0) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number.isFinite(valor) ? valor : 0);

export const formatarPercentual = (valor: number, casas = 1) =>
  `${formatarNumero(Number.isFinite(valor) ? valor : 0, casas)}%`;

/** Variação sempre com sinal explícito — o sinal é a informação. */
export const formatarVariacao = (valor: number, casas = 1) => {
  if (!Number.isFinite(valor)) return "—";
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${formatarNumero(valor, casas)}%`;
};

export const formatarQuantidade = (valor: number) => numero.format(Number.isFinite(valor) ? valor : 0);

/* -------------------------------------------------------------------------- */
/* Datas                                                                       */
/* -------------------------------------------------------------------------- */

/** "2026-08-01" -> "agosto de 2026". Evita `new Date(iso)` para não pegar fuso. */
export const formatarCompetencia = (iso: string) => {
  const [ano, mes] = iso.split("-").map(Number);
  return `${MESES[(mes ?? 1) - 1]} de ${ano}`;
};

export const formatarCompetenciaCurta = (iso: string) => {
  const [ano, mes] = iso.split("-").map(Number);
  return `${MESES_CURTOS[(mes ?? 1) - 1]}/${String(ano).slice(2)}`;
};

export const formatarData = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("T")[0].split("-");
  if (!ano || !mes || !dia) return "—";
  return `${dia}/${mes}/${ano}`;
};

export const formatarDataHora = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** "há 3 min" / "agora" — usado no indicador de autosave. */
export const tempoRelativo = (iso: string | null) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora mesmo";
  if (min === 1) return "há 1 minuto";
  if (min < 60) return `há ${min} minutos`;
  const h = Math.floor(min / 60);
  if (h === 1) return "há 1 hora";
  if (h < 24) return `há ${h} horas`;
  return formatarData(iso);
};

/* -------------------------------------------------------------------------- */
/* Competência                                                                 */
/* -------------------------------------------------------------------------- */

/** Primeiro dia do mês, em UTC, no formato YYYY-MM-DD. */
export const competenciaDe = (ano: number, mes: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-01`;

export const competenciaAtual = () => {
  const hoje = new Date();
  return competenciaDe(hoje.getFullYear(), hoje.getMonth() + 1);
};

/** Dias do mês da competência — usado no consumo médio diário de utilidades. */
export const diasNoMes = (iso: string) => {
  const [ano, mes] = iso.split("-").map(Number);
  if (!ano || !mes) return 30;
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
};

export const competenciaAnterior = (iso: string) => {
  const [ano, mes] = iso.split("-").map(Number);
  return mes === 1 ? competenciaDe(ano - 1, 12) : competenciaDe(ano, mes - 1);
};

/** Parser tolerante: aceita "1.234,56", "R$ 1.234,56", "1234.56", "-3,2". */
export const lerNumero = (texto: string): number => {
  if (!texto) return 0;
  const limpo = texto.replace(/[^\d,.-]/g, "").trim();
  if (!limpo) return 0;
  const temVirgula = limpo.includes(",");
  // Com vírgula assumimos padrão pt-BR: ponto é milhar, vírgula é decimal.
  const normalizado = temVirgula ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
};
