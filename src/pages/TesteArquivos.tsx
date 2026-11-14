/**
 * SÓ EM DESENVOLVIMENTO: roda a leitura de arquivos do navegador (pdf.js e
 * Excel) sobre arquivos locais, sem login — para conferir no Chrome headless.
 *
 *   /teste-arquivos?pasta=<caminho absoluto>&arquivos=a.pdf,b.xlsx[&fotos=c.pdf]
 */

import { useEffect, useState } from "react";
import { interpretarArquivo } from "@/lib/relatoriosSistema/interpretar";
import { extrairFotosPrestacao, lerArquivo, type FotoExtraida } from "@/lib/relatoriosSistema/ler";

const TesteArquivos = () => {
  const p = new URLSearchParams(window.location.search);
  const pasta = p.get("pasta") ?? "";
  const nomes = (p.get("arquivos") ?? "").split(",").filter(Boolean);
  const pdfFotos = p.get("fotos");
  const [saida, setSaida] = useState<unknown[]>([]);
  const [fotos, setFotos] = useState<FotoExtraida[]>([]);
  const [fim, setFim] = useState(false);

  useEffect(() => {
    (async () => {
      const baixar = async (nome: string) => {
        const r = await fetch(`/@fs/${pasta}/${nome}`);
        return new File([await r.blob()], nome);
      };
      const resultados: unknown[] = [];
      for (const nome of nomes) {
        try {
          resultados.push(interpretarArquivo(await lerArquivo(await baixar(nome))));
        } catch (e) {
          resultados.push({ nome, excecao: String(e) });
        }
      }
      setSaida(resultados);
      if (pdfFotos) {
        const t0 = performance.now();
        const extraidas = await extrairFotosPrestacao(await baixar(pdfFotos));
        resultados.push({ fotos: extraidas.length, segundos: Math.round((performance.now() - t0) / 1000), primeiras: extraidas.slice(0, 12).map((f) => ({ os: f.os, legenda: f.legenda, categoria: f.categoria, kb: Math.round(f.blob.size / 1024), pagina: f.pagina })) });
        setSaida([...resultados]);
        setFotos(extraidas.filter((_, i) => i % Math.max(1, Math.floor(extraidas.length / 12)) === 0).slice(0, 12));
      }
      setFim(true);
    })().catch((e) => {
      setSaida([{ erro: String(e) }]);
      setFim(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ padding: 16, fontFamily: "monospace", fontSize: 11 }}>
      <p id="status">{fim ? "FIM" : "lendo…"}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {fotos.map((f) => (
          <figure key={f.id} style={{ width: 230 }}>
            <img src={f.url} style={{ width: 230, height: 170, objectFit: "cover" }} />
            <figcaption>OS {f.os} · {f.legenda}</figcaption>
          </figure>
        ))}
      </div>
      <pre id="saida">{JSON.stringify(saida, null, 1)}</pre>
    </div>
  );
};

export default TesteArquivos;
