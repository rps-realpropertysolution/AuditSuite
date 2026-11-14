/**
 * Casa os empreendimentos do LiveFacilities com os já cadastrados no RGM.
 *
 * Ordem: pelo código do condomínio; senão pelo nome. Nada é apagado — o
 * plano só cria o que falta e preenche códigos ausentes; o gestor revisa
 * antes de aplicar.
 */

import { chaveNome } from "../../supabase/functions/_shared/livefacilities/mapear.ts";
import type { Empreendimento } from "./types";

export interface EmpreendimentoLFResumo {
  idEmpreendimento: number | null;
  cdCondominio: string;
  nome: string;
}

export type AcaoSincronizacao =
  | { tipo: "criar"; lf: EmpreendimentoLFResumo }
  | { tipo: "vincular"; lf: EmpreendimentoLFResumo; emp: Empreendimento }
  | { tipo: "completar_id"; lf: EmpreendimentoLFResumo; emp: Empreendimento }
  | { tipo: "ok"; lf: EmpreendimentoLFResumo; emp: Empreendimento };

export const planejarSincronizacao = (existentes: Empreendimento[], lf: EmpreendimentoLFResumo[]): AcaoSincronizacao[] =>
  lf.map((item) => {
    const porCodigo = existentes.find((e) => e.lf_cd_condominio === item.cdCondominio);
    if (porCodigo) {
      if (!porCodigo.lf_id_empreendimento && item.idEmpreendimento) return { tipo: "completar_id", lf: item, emp: porCodigo };
      return { tipo: "ok", lf: item, emp: porCodigo };
    }
    const nome = chaveNome(item.nome);
    const porNome = existentes.find((e) => !e.lf_cd_condominio && chaveNome(e.nome) === nome);
    if (porNome) return { tipo: "vincular", lf: item, emp: porNome };
    return { tipo: "criar", lf: item };
  });
