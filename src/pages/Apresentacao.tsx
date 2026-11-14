/**
 * Apresentação do RGM mensal.
 *
 *  /relatorio/:id/apresentar        reunião (um slide por vez)
 *  /relatorio/:id/apresentar?pdf=1  todos os slides, um por página — "Salvar como PDF"
 */

import { useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useUrlsAssinadas } from "@/hooks/useFotos";
import { useHistorico, useRelatorio } from "@/hooks/useRelatorios";
import { montarSlides } from "@/components/apresentacao/slides";
import { Visualizador } from "@/components/apresentacao/Visualizador";
import type { Foto } from "@/lib/types";

const Apresentacao = () => {
  const { id } = useParams<{ id: string }>();
  const [busca] = useSearchParams();
  const modoPdf = busca.get("pdf") === "1";
  const navegar = useNavigate();
  const { data: relatorio, isLoading } = useRelatorio(id);
  const { data: historico = [] } = useHistorico(relatorio?.empreendimento_id, 13);

  const fotos = useMemo<Foto[]>(() => {
    const lista = [...(relatorio?.dados.fotos ?? [])];
    const capa = relatorio?.empreendimento?.foto_path;
    if (capa) lista.push({ id: "capa-empreendimento", path: capa, legenda: "", categoria: "geral" });
    return lista;
  }, [relatorio]);
  const urls = useUrlsAssinadas(fotos);

  const slides = useMemo(
    () =>
      relatorio
        ? montarSlides({
            relatorio,
            historico,
            urlsFotos: urls,
            urlFotoEmpreendimento: relatorio.empreendimento?.foto_path ? urls[relatorio.empreendimento.foto_path] : null,
            animar: !modoPdf,
          })
        : [],
    [relatorio, historico, urls, modoPdf],
  );
  const sair = useCallback(() => navegar(`/relatorio/${id}`), [navegar, id]);

  if (isLoading || !relatorio) {
    return (
      <div className="flex h-screen items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Preparando apresentação…
      </div>
    );
  }

  return <Visualizador slides={slides} modoPdf={modoPdf} sair={sair} />;
};

export default Apresentacao;
