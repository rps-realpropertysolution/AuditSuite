/**
 * Descoberta dos empreendimentos no LiveFacilities.
 *
 * A API não tem rota que liste os empreendimentos. Mas os códigos da RPS são
 * sequenciais (1001, 1002, …) e o controle de fechamento devolve o
 * `id_empreendimento` e o nome a partir do código ("1006 - NOME"). Percorremos a
 * faixa e paramos depois de uma sequência de códigos inexistentes.
 * Somente leitura.
 */

import type { ClienteLF } from "./cliente.ts";
import type { AtividadeLF, FechamentoLF, FluxoCaixaLF, RetornoLF } from "./tipos.ts";

export interface EmpreendimentoLF {
  /** null = só operação no LiveFacilities (sem fechamento nem fluxo de caixa). */
  idEmpreendimento: number | null;
  cdCondominio: string;
  nome: string;
}

const nomeDoRotulo = (rotulo: string) => (rotulo.includes(" - ") ? rotulo.split(" - ").slice(1).join(" - ").trim() : rotulo);

const mesesAtras = (n: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

const identificarSemFechamento = async (cliente: ClienteLF, cd: string): Promise<EmpreendimentoLF | null> => {
  try {
    const fluxo = await cliente.get<RetornoLF<FluxoCaixaLF>>("/FluxoCaixa/FluxoCaixa", {
      cd_empreendimento: cd,
      dt_periodoinicial: mesesAtras(3),
      dt_periodofinal: mesesAtras(0),
    });
    const f = (fluxo.data ?? [])[0];
    if (f?.id_empreendimento) return { idEmpreendimento: f.id_empreendimento, cdCondominio: cd, nome: nomeDoRotulo(f.cd_empreendimento ?? cd) };
  } catch {
    /* segue para as OS */
  }
  try {
    const os = await cliente.get<RetornoLF<AtividadeLF & { nm_empreendimento?: string }>>("/OrdemServico/ListaAtividade", {
      cd_condominio: cd,
      dt_inicio: mesesAtras(2),
      dt_fim: mesesAtras(0),
    });
    const doCd = (os.data ?? []).find((o) => o.cd_condominio === cd);
    if (doCd) return { idEmpreendimento: null, cdCondominio: cd, nome: (doCd.nm_empreendimento ?? cd).trim() };
  } catch {
    /* sem rastro do código */
  }
  return null;
};

/** Códigos que não são prédios reais (ambiente de testes do próprio LiveFacilities). */
const IGNORAR = new Set(["9999"]);

export const descobrirEmpreendimentos = async (
  cliente: ClienteLF,
  opcoes: { inicio?: number; fim?: number; parada?: number; paralelo?: number } = {},
): Promise<EmpreendimentoLF[]> => {
  const inicio = opcoes.inicio ?? 1001;
  const fim = opcoes.fim ?? 1199;
  const parada = opcoes.parada ?? 15; // códigos seguidos sem empreendimento → fim da faixa
  const paralelo = opcoes.paralelo ?? 6;
  const achados: EmpreendimentoLF[] = [];
  let vaziosSeguidos = 0;

  for (let base = inicio; base <= fim && vaziosSeguidos < parada; base += paralelo) {
    const codigos = Array.from({ length: Math.min(paralelo, fim - base + 1) }, (_, i) => String(base + i));
    const respostas = await Promise.all(
      codigos.map((cd) =>
        cliente
          .get<RetornoLF<FechamentoLF & { id_empreendimento?: number; cd_empreendimento?: string }>>(
            "/ControleFechamento/ListaControleFechamento",
            { cd_empreendimento: cd },
          )
          .then((r) => ({ cd, item: (r.data ?? [])[0] }))
          .catch(() => ({ cd, item: undefined })),
      ),
    );
    for (const { cd, item } of respostas) {
      if (IGNORAR.has(cd)) continue;
      if (item?.id_empreendimento) {
        vaziosSeguidos = 0;
        achados.push({ idEmpreendimento: item.id_empreendimento, cdCondominio: cd, nome: nomeDoRotulo(item.cd_empreendimento ?? cd) });
        continue;
      }
      // Sem fechamento: tenta o fluxo de caixa (dá o id) e, por fim, as OS (só o nome).
      const extra = await identificarSemFechamento(cliente, cd);
      if (extra) {
        vaziosSeguidos = 0;
        achados.push(extra);
      } else {
        vaziosSeguidos++;
      }
    }
  }
  return achados.sort((a, b) => a.cdCondominio.localeCompare(b.cdCondominio));
};
