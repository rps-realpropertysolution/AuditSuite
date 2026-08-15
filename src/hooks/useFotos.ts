import { useCallback, useEffect, useState } from "react";
import { BUCKET_FOTOS, supabase } from "@/integrations/supabase/client";
import { novoId } from "@/lib/defaults";
import type { Foto } from "@/lib/types";

const TAMANHO_MAX = 10 * 1024 * 1024; // 10 MB, igual ao limite do bucket
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/**
 * Resolve os caminhos do Storage em URLs assinadas.
 *
 * A versão anterior usava `URL.createObjectURL` sem nunca revogar: as fotos
 * viviam só na memória da aba, vazavam em sessões longas, sumiam no refresh e
 * chegavam quebradas no export. Agora ficam no bucket privado e as URLs são
 * assinadas por 2 horas, renovando sozinhas.
 */
export const useUrlsAssinadas = (fotos: Foto[]) => {
  const [urls, setUrls] = useState<Record<string, string>>({});

  const caminhos = fotos.map((f) => f.path).join("|");

  useEffect(() => {
    let ativo = true;
    const paths = caminhos ? caminhos.split("|") : [];
    if (paths.length === 0) {
      setUrls({});
      return;
    }

    supabase.storage
      .from(BUCKET_FOTOS)
      .createSignedUrls(paths, 7200)
      .then(({ data }) => {
        if (!ativo || !data) return;
        const mapa: Record<string, string> = {};
        data.forEach((item) => {
          if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl;
        });
        setUrls(mapa);
      });

    return () => {
      ativo = false;
    };
  }, [caminhos]);

  return urls;
};

interface ResultadoUpload {
  fotos: Foto[];
  erros: string[];
}

export const useUploadFotos = (relatorioId: string) => {
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });

  const enviar = useCallback(
    async (arquivos: File[]): Promise<ResultadoUpload> => {
      const validos: File[] = [];
      const erros: string[] = [];

      arquivos.forEach((a) => {
        if (!TIPOS.includes(a.type)) erros.push(`${a.name}: formato não suportado.`);
        else if (a.size > TAMANHO_MAX) erros.push(`${a.name}: acima de 10 MB.`);
        else validos.push(a);
      });

      if (validos.length === 0) return { fotos: [], erros };

      setEnviando(true);
      setProgresso({ feitos: 0, total: validos.length });
      const fotos: Foto[] = [];

      for (const arquivo of validos) {
        const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${relatorioId}/${novoId()}.${extensao}`;

        const { error } = await supabase.storage
          .from(BUCKET_FOTOS)
          .upload(path, arquivo, { contentType: arquivo.type, upsert: false });

        if (error) erros.push(`${arquivo.name}: ${error.message}`);
        else fotos.push({ id: novoId(), path, legenda: "", categoria: "geral" });

        setProgresso((p) => ({ ...p, feitos: p.feitos + 1 }));
      }

      setEnviando(false);
      return { fotos, erros };
    },
    [relatorioId],
  );

  const remover = useCallback(async (path: string) => {
    await supabase.storage.from(BUCKET_FOTOS).remove([path]);
  }, []);

  return { enviar, remover, enviando, progresso };
};
