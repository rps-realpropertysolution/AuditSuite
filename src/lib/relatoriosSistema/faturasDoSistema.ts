/**
 * Contas de água e energia que a importação busca sozinha no LiveFacilities.
 *
 * A Edge Function devolve os anexos dos pagamentos (base64) e o custo total por
 * conta contábil; aqui, no navegador, cada anexo passa pelo mesmo leitor do
 * "Importar arquivos" — o que não for fatura (comprovante, conta escaneada)
 * fica de fora com o motivo.
 */

import type { FaturasDoMes } from "../../../supabase/functions/_shared/livefacilities/faturas.ts";
import type { DadosRelatorio } from "../types";
import type { ItemResumoImportacao } from "../importacao";
import { aplicarArquivos, aplicarCustos, type ArquivoParaAplicar, type ContextoAplicacao } from "./aplicar";
import { interpretarArquivo } from "./interpretar";

export const completarComFaturas = async (
  dados: DadosRelatorio,
  faturas: FaturasDoMes,
  ctx: ContextoAplicacao,
): Promise<{ dados: DadosRelatorio; preenchido: ItemResumoImportacao[]; avisos: string[] }> => {
  const { lerArquivo } = await import("./ler");
  const avisos = [...faturas.avisos];
  const lidas: ArquivoParaAplicar[] = [];

  for (const a of faturas.anexos) {
    try {
      const bytes = Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0));
      const r = interpretarArquivo(await lerArquivo(new File([bytes], a.nome, { type: "application/pdf" })));
      if ("relatorio" in r && (r.relatorio.tipo === "fatura_agua" || r.relatorio.tipo === "fatura_energia")) {
        lidas.push({ nome: `${a.fornecedor} (${a.nome})`, relatorio: r.relatorio });
      } else if ("erro" in r && /escaneada/.test(r.erro)) {
        avisos.push(`Conta de ${a.fornecedor} veio escaneada (sem texto) — confira o consumo à mão.`);
      }
    } catch {
      /* anexo que não é PDF legível: ignora */
    }
  }

  let d = dados;
  const preenchido: ItemResumoImportacao[] = [];
  if (lidas.length) {
    const r = aplicarArquivos(d, lidas, ctx);
    d = r.dados;
    preenchido.push(...r.preenchido);
    avisos.push(...r.avisos);
  }
  const custos = aplicarCustos(d, faturas.custos);
  d = custos.dados;
  preenchido.push(...custos.preenchido);
  return { dados: d, preenchido, avisos };
};
