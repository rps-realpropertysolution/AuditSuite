/**
 * Cliente HTTP do LiveFacilities — SOMENTE LEITURA.
 *
 * A API mistura consultas e rotas que gravam no sistema (alterar condômino,
 * enviar documento, inserir pagamento…). Para não depender de disciplina,
 * o cliente só aceita as rotas listadas abaixo; qualquer outra lança erro
 * antes de sair da máquina. `/Login` é o único POST que não é consulta.
 *
 * Autenticação: POST /Login {nm_usuario, nm_senha} → JWT; demais chamadas com
 * `Authorization: Bearer <token>`. Em 401 o cliente refaz o login uma vez.
 */

import type { RetornoLF } from "./tipos.ts";

export const URL_PADRAO = "https://rps.livefacilities.com.br/api";

/** GET de consulta usados (ou úteis) para o RGM. */
export const ROTAS_GET = new Set([
  "/OrdemServico/ListaAtividade",
  "/AreaComum/Lista",
  "/AreaComum/Solicitacoes",
  "/Boleto/ListaBoleto",
  "/Boleto/ListaBoletoPagos",
  "/Acordo/ListaAcordo",
  "/FluxoCaixa/FluxoCaixa",
  "/ContasPagar/ListaImposto",
  "/PrestacaoContas/ListaResumoEmissao",
  "/PrestacaoContas/despesas",
  "/ControleFechamento/ListaControleFechamento",
  "/ContaBancaria/ListaContaBancariaEmpreendimento",
  "/PlanoContas/ListaPlanoContas",
  "/PlanoContas/ListaContaContabil",
  "/ContratoCompleto",
  "/Documento/ListaDocumentoEmpreendimento",
  "/SisproFuncionario/Lista",
  "/SisproFerias/Agenda",
]);

/** POST que são consultas (corpo = filtro). Nenhum grava. */
export const ROTAS_POST_CONSULTA = new Set([
  "/MedicaoEmpreendimento/ListaMedicaoEmpreendimento",
  "/ContasPagar/ConsultaPagamento",
  "/LancamentoAvulso/ListaLancamentoAvulso",
  "/FornecedorFiltro/FiltroFornecedor",
]);

export class ErroLF extends Error {
  status: number;
  rota: string;
  constructor(mensagem: string, status: number, rota: string) {
    super(mensagem);
    this.name = "ErroLF";
    this.status = status;
    this.rota = rota;
  }
}

export interface ConfigClienteLF {
  usuario: string;
  senha: string;
  baseUrl?: string;
  /** Injetável para testes e para o script que grava as respostas. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export type Parametros = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export interface ClienteLF {
  get<T>(rota: string, parametros?: Parametros): Promise<T>;
  consultar<T>(rota: string, corpo: unknown): Promise<T>;
  /** Percorre PageIndex/PageSize até acabar. Junta `data` de todas as páginas. */
  paginar<T>(
    rota: string,
    parametros: Parametros,
    opcoes?: { tamanho?: number; maxPaginas?: number; chave?: (item: T) => unknown; paralelo?: number },
  ): Promise<T[]>;
}

/** O Swagger não documenta o corpo da resposta do login. Aceita os formatos comuns. */
export const extrairToken = (corpo: string): string | null => {
  const texto = corpo.trim().replace(/^"|"$/g, "");
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(texto)) return texto;

  try {
    const json = JSON.parse(corpo) as Record<string, unknown>;
    const candidatos = [
      json.token,
      json.accessToken,
      json.access_token,
      json.jwt,
      (json.data as Record<string, unknown> | undefined)?.token,
      (json.data as Record<string, unknown> | undefined)?.accessToken,
      typeof json.data === "string" ? json.data : undefined,
    ];
    const achado = candidatos.find((c) => typeof c === "string" && c.length > 20);
    return (achado as string | undefined)?.replace(/^Bearer\s+/i, "") ?? null;
  } catch {
    return null;
  }
};

const montarQuery = (parametros: Parametros = {}) => {
  const qs = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === null || valor === "") continue;
    if (Array.isArray(valor)) valor.forEach((v) => qs.append(chave, String(v)));
    else qs.append(chave, String(valor));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
};

/** Mensagem legível a partir do corpo de erro (ProblemDetails ou envelope próprio). */
const mensagemDeErro = (status: number, rota: string, corpo: string) => {
  let detalhe = corpo.slice(0, 300);
  try {
    const j = JSON.parse(corpo) as Record<string, unknown>;
    const erros = j.errors as Record<string, unknown> | undefined;
    detalhe = String(j.detail ?? j.title ?? erros?.detail ?? erros?.errorMessage ?? j.errorMessage ?? j.ds_mensagemErro ?? detalhe);
  } catch {
    /* corpo não é JSON */
  }
  if (status === 401) return `Login recusado ou token vencido (${rota}).`;
  if (status === 403) {
    return `Perfil sem permissão para ${rota}. Libere em GERAL > CONFIGURAÇÕES > SISTEMA > GESTÃO DE ACESSOS API(S). ${detalhe}`.trim();
  }
  return `Erro ${status} em ${rota}: ${detalhe}`;
};

export const criarClienteLF = (cfg: ConfigClienteLF): ClienteLF => {
  const base = (cfg.baseUrl || URL_PADRAO).replace(/\/+$/, "");
  const doFetch = cfg.fetch ?? fetch;
  const timeoutMs = cfg.timeoutMs ?? 60_000;
  let token: string | null = null;
  let loginEmAndamento: Promise<string> | null = null;

  const chamar = async (url: string, init: RequestInit) => {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), timeoutMs);
    try {
      return await doFetch(url, { ...init, signal: controle.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const login = async (): Promise<string> => {
    const resp = await chamar(`${base}/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ nm_usuario: cfg.usuario, nm_senha: cfg.senha }),
    });
    const corpo = await resp.text();
    if (!resp.ok) throw new ErroLF(mensagemDeErro(resp.status, "/Login", corpo), resp.status, "/Login");
    const t = extrairToken(corpo);
    if (!t) throw new ErroLF("Login aceito, mas a resposta não trouxe um token reconhecível.", resp.status, "/Login");
    return t;
  };

  const garantirToken = async (forcar = false) => {
    if (token && !forcar) return token;
    if (!loginEmAndamento) {
      loginEmAndamento = login().finally(() => {
        loginEmAndamento = null;
      });
    }
    token = await loginEmAndamento;
    return token;
  };

  const requisitar = async <T>(metodo: "GET" | "POST", rota: string, url: string, corpo?: unknown): Promise<T> => {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const t = await garantirToken(tentativa > 0);
      const resp = await chamar(url, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${t}`,
          Accept: "application/json",
          ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      });
      if (resp.status === 401 && tentativa === 0) continue;
      const texto = await resp.text();
      if (!resp.ok) throw new ErroLF(mensagemDeErro(resp.status, rota, texto), resp.status, rota);
      if (!texto) return {} as T;
      try {
        return JSON.parse(texto) as T;
      } catch {
        throw new ErroLF(`Resposta de ${rota} não é JSON.`, resp.status, rota);
      }
    }
    throw new ErroLF(mensagemDeErro(401, rota, ""), 401, rota);
  };

  const get = <T>(rota: string, parametros?: Parametros) => {
    if (!ROTAS_GET.has(rota)) throw new ErroLF(`Rota não liberada para o RGM (somente leitura): GET ${rota}`, 0, rota);
    return requisitar<T>("GET", rota, `${base}${rota}${montarQuery(parametros)}`);
  };

  const consultar = <T>(rota: string, corpo: unknown) => {
    if (!ROTAS_POST_CONSULTA.has(rota)) {
      throw new ErroLF(`Rota não liberada para o RGM (somente leitura): POST ${rota}`, 0, rota);
    }
    return requisitar<T>("POST", rota, `${base}${rota}`, corpo);
  };

  /**
   * PageIndex começa em 0 (a página 1 já é a SEGUNDA — confirmado contra a
   * API real) e a API aceita no máximo 500 itens por página. Com `totalPages`
   * na primeira resposta, as demais vêm em paralelo.
   */
  const paginar: ClienteLF["paginar"] = async (rota, parametros, opcoes = {}) => {
    const tamanho = Math.min(opcoes.tamanho ?? 500, 500);
    const maxPaginas = opcoes.maxPaginas ?? 80;
    const paralelo = opcoes.paralelo ?? 6;
    const vistos = new Set<unknown>();
    const todos: unknown[] = [];
    const juntar = (itens: unknown[]) => {
      let novos = 0;
      for (const item of itens) {
        const chave = opcoes.chave ? opcoes.chave(item as never) : undefined;
        if (chave !== undefined && chave !== null) {
          if (vistos.has(chave)) continue;
          vistos.add(chave);
        }
        todos.push(item);
        novos++;
      }
      return novos;
    };
    const pagina = (n: number) => get<RetornoLF<unknown>>(rota, { ...parametros, PageIndex: n, PageSize: tamanho });

    const primeira = await pagina(0);
    const itens1 = primeira.data ?? [];
    juntar(itens1);
    if (itens1.length < tamanho) return todos as never[];

    const totalPaginas = typeof primeira.totalPages === "number" && primeira.totalPages > 0 ? primeira.totalPages : 0;
    if (totalPaginas) {
      // total conhecido: busca o resto (1 … totalPages−1) em lotes paralelos
      const restantes = Array.from({ length: Math.min(totalPaginas, maxPaginas) - 1 }, (_, i) => i + 1);
      for (let i = 0; i < restantes.length; i += paralelo) {
        const lote = await Promise.all(restantes.slice(i, i + paralelo).map(pagina));
        lote.forEach((r) => juntar(r.data ?? []));
      }
      return todos as never[];
    }

    // total desconhecido: segue página a página até vir incompleta ou repetida
    for (let n = 1; n < maxPaginas; n++) {
      const itens = (await pagina(n)).data ?? [];
      if (juntar(itens) === 0 || itens.length < tamanho) break;
    }
    return todos as never[];
  };

  return { get, consultar, paginar };
};
