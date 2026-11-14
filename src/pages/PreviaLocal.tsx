/**
 * Prévia local — SÓ EM DESENVOLVIMENTO (rota registrada apenas com import.meta.env.DEV).
 *
 * Lê os relatórios gerados por scripts/rgm/gerar-ano.ts (pasta saida/, fora do
 * Git) e monta os slides sem login nem banco — para revisar o layout com dados
 * reais e gerar PDFs pelo Chrome headless.
 *
 *   /previa?cd=1006&ano=2026               visão anual
 *   /previa?cd=1006&ano=2026&mes=09        RGM mensal
 *   …&slide=<id>                           um slide só (captura de tela)
 */

import { useEffect, useState } from "react";
import { montarSlidesAnuais } from "@/components/apresentacao/anual";
import { montarSlides } from "@/components/apresentacao/slides";
import { ALTURA, LARGURA } from "@/components/apresentacao/moldura";
import { normalizarDados } from "@/lib/defaults";
import type { Empreendimento, Relatorio } from "@/lib/types";

const RAIZ = import.meta.env.DEV ? `/@fs/${(import.meta.env.VITE_RAIZ_SAIDA as string | undefined) ?? ""}` : "";

const PreviaLocal = () => {
  const p = new URLSearchParams(window.location.search);
  const cd = p.get("cd") ?? "";
  const ano = Number(p.get("ano") ?? "2026");
  const mes = p.get("mes");
  const unico = p.get("slide");
  const [estado, setEstado] = useState<{ emp: Empreendimento; rels: Relatorio[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const lista = (await (await fetch(`${RAIZ}/empreendimentos.json`)).json()) as { cdCondominio: string; nome: string; idEmpreendimento: number | null }[];
      const lf = lista.find((e) => e.cdCondominio === cd);
      if (!lf) throw new Error(`código ${cd} não está em empreendimentos.json`);
      const emp = {
        id: cd,
        nome: lf.nome,
        cidade: null,
        tipo: "comercial",
        ativo: true,
        lf_cd_condominio: cd,
        lf_id_empreendimento: lf.idEmpreendimento,
        ficha: {},
        foto_path: null,
      } as unknown as Empreendimento;
      const rels: Relatorio[] = [];
      for (let m = 1; m <= 12; m++) {
        const comp = `${ano}-${String(m).padStart(2, "0")}`;
        const r = await fetch(`${RAIZ}/rgm-${ano}/${cd}-${comp}.json`);
        if (!r.ok) continue;
        const txt = await r.text();
        if (!txt.startsWith("{")) continue;
        const { dados } = JSON.parse(txt);
        rels.push({ id: comp, empreendimento_id: cd, competencia: `${comp}-01`, status: "rascunho", dados: normalizarDados(dados), indice_executivo: null, publicado_em: null, created_at: "", updated_at: "", empreendimento: emp });
      }
      setEstado({ emp, rels });
    })().catch((e) => setErro(String(e)));
  }, [cd, ano]);

  if (erro) return <p style={{ padding: 20 }}>{erro}</p>;
  if (!estado) return <p style={{ padding: 20 }}>carregando…</p>;

  const slides = mes
    ? (() => {
        const atual = estado.rels.find((r) => r.competencia === `${ano}-${mes}-01`);
        return atual ? montarSlides({ relatorio: atual, historico: estado.rels, urlsFotos: {} }) : [];
      })()
    : montarSlidesAnuais({ empreendimento: estado.emp, relatorios: estado.rels, ano });

  if (unico) {
    const s = slides.find((x) => x.id === unico);
    return <div style={{ width: LARGURA, height: ALTURA }}>{s?.node ?? `slide ${unico} não existe (${slides.map((x) => x.id).join(", ")})`}</div>;
  }

  return (
    <div className="slides-impressao flex flex-col items-center gap-6 bg-[#e9eaf0] py-6">
      {slides.map((s) => (
        <div key={s.id} id={`slide-${s.id}`} className="slide-pagina bg-white shadow-lg" style={{ width: LARGURA, height: ALTURA }}>
          {s.node}
        </div>
      ))}
    </div>
  );
};

export default PreviaLocal;
