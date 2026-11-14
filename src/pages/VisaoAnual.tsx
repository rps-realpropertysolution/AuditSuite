/**
 * Visão anual de um empreendimento: /empreendimento/:id/ano/:ano (?pdf=1 para PDF).
 * Usa os relatórios mensais já gravados — o que está no RGM é o que aparece.
 */

import { useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useEmpreendimento } from "@/hooks/useEmpreendimentos";
import { useRelatoriosDoAno } from "@/hooks/useRelatorios";
import { montarSlidesAnuais } from "@/components/apresentacao/anual";
import { Visualizador } from "@/components/apresentacao/Visualizador";

const VisaoAnual = () => {
  const { id, ano: anoParam } = useParams<{ id: string; ano: string }>();
  const ano = Number(anoParam) || new Date().getFullYear();
  const [busca] = useSearchParams();
  const navegar = useNavigate();
  const { data: emp, isLoading: carregandoEmp } = useEmpreendimento(id);
  const { data: relatorios = [], isLoading: carregandoRel } = useRelatoriosDoAno(id, ano);

  const slides = useMemo(() => (emp ? montarSlidesAnuais({ empreendimento: emp, relatorios, ano }) : []), [emp, relatorios, ano]);
  const sair = useCallback(() => (window.history.length > 1 ? navegar(-1) : navegar("/")), [navegar]);

  if (carregandoEmp || carregandoRel || !emp) {
    return (
      <div className="flex h-screen items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Montando a visão anual…
      </div>
    );
  }
  return <Visualizador slides={slides} modoPdf={busca.get("pdf") === "1"} sair={sair} />;
};

export default VisaoAnual;
