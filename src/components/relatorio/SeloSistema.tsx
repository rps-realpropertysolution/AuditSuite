/**
 * Selo "R" — marca os módulos do RGM que dá para tirar do sistema (RPSmart /
 * LiveFacilities). É o R da logo do RPSmart (src/assets/logo-rps.svg), em azul.
 * Passe o mouse para ver de onde o dado vem.
 */

import type { SecaoId } from "@/lib/types";
import { cn } from "@/lib/utils";

/** De onde cada módulo sai do sistema. Módulo fora da lista é preenchido pelo gestor. */
export const ORIGEM_SISTEMA: Partial<Record<SecaoId, string>> = {
  financeiro:
    "resultado, despesas e arrecadação pela importação automática; orçado e saldo por fundo pelos arquivos Previsto x Realizado e Posição Financeira",
  operacao: "ordens de serviço pela importação automática",
  contratos: "contratos e vigências pela importação automática",
  documentos: "documentos e validades pela importação automática",
  juridico: "inadimplência, acordos e certidões pela importação automática (processos ficam com o gestor)",
  utilidades: "contas da Sabesp e da Enel anexadas ao pagamento (Importar arquivos)",
  suprimentos: "Lista de Pedidos de Compra em Excel (Importar arquivos)",
  fotos: "fotos das OS na Prestação de Contas Operacional (PDF com fotos)",
};

export const SeloSistema = ({ secao, className }: { secao: SecaoId; className?: string }) => {
  const origem = ORIGEM_SISTEMA[secao];
  if (!origem) return null;
  const texto = `Dá para tirar do sistema (RPSmart): ${origem}`;
  return (
    <span title={texto} aria-label={texto} role="img" className={cn("inline-flex shrink-0 items-center", className)}>
      {/* O "R" da logo do RPSmart: haste + bojo/perna, recortados do logo-rps.svg */}
      <svg viewBox="14 17 67 67" className="h-3.5 w-3.5" fill="#0077B6" aria-hidden="true">
        <polygon points="16.61 44.73 16.61 57.18 16.61 69.64 16.61 82.09 29.07 82.09 29.07 69.64 29.07 57.18 29.07 44.73 29.07 32.27 16.61 32.27 16.61 44.73" />
        <path d="m66.44,44.73v24.91c-4.08,0-7.7-1.97-9.97-5.01,6.04-4.55,9.97-11.75,9.97-19.9,0-13.76-11.15-24.91-24.91-24.91h0s-12.46,0-12.46,0v12.46h12.46c6.88,0,12.46,5.58,12.46,12.46s-5.58,12.46-12.46,12.46c0,4.45,1.18,8.61,3.22,12.22,4.28,7.57,12.38,12.69,21.69,12.69h12.46v-49.82h-12.46v12.46Z" />
      </svg>
    </span>
  );
};
