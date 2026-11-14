/**
 * Moldura dos slides do RGM — linguagem "executiva cinematográfica".
 *
 * Feita para conselho de investidor institucional: sóbria, com respiro, uma
 * ideia por slide. O "cinema" está no ritmo, não no enfeite:
 *  - capa e aberturas de capítulo em tela cheia, escuras, com a foto do ativo;
 *  - slides de conteúdo claros, com uma MANCHETE (a conclusão) sob o título;
 *  - na apresentação, entrada suave dos blocos e zoom lento nas fotos
 *    (nada disso vai para o PDF nem roda com "reduzir movimento").
 *
 * Todo slide é desenhado num palco FIXO de 1280×720 (16:9). Na tela, o
 * <Palco> escala o slide; na impressão, cada slide vira uma página do mesmo
 * tamanho. Por isso as medidas são em pixels absolutos.
 */

import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ListChecks as IconeSumario, type LucideIcon } from "lucide-react";
import capa from "@/assets/rgm/capa-foto.jpg";
// arte do template corporativo: logo RPS, slogan, filete e o desenho de linhas nos cantos
import fundoSlide from "@/assets/rgm/fundo-slide.jpg";
import encerramento from "@/assets/rgm/encerramento.jpg";
import type { Semaforo } from "@/lib/types";
import type { Topico } from "@/lib/leitura";

export const LARGURA = 1280;
export const ALTURA = 720;

/** Paleta da marca (RGM corporativo). */
export const COR = {
  navy: "#201E5A",
  azul: "#0077B6",
  ciano: "#02B4D7",
  /** 2ª série dos gráficos — validada contra o azul (CVD ΔE 14,3). */
  indigo: "#3B3990",
  /** Fundo das telas escuras (capa, aberturas, encerramento). */
  noite: "#0C0E2B",
  cartao: "#F4F5F9",
  linha: "#E3E5EE",
  texto: "#201E5A",
  apoio: "#5B5E77",
  fraco: "#8A8DA3",
  verde: "#2E9E5B",
  amarelo: "#E0A12B",
  vermelho: "#CC3B3B",
} as const;

/* -------------------------------------------------------------------------- */
/* Marca RPS — vetorial, para fundo claro e escuro                             */
/* -------------------------------------------------------------------------- */

/** Logo RPS Real Property Solution, redesenhada em SVG a partir da marca. */
export const MarcaRPS = ({ escura = false, altura = 30 }: { escura?: boolean; altura?: number }) => {
  const letras = escura ? "#FFFFFF" : COR.navy;
  const texto = escura ? "#FFFFFF" : COR.navy;
  return (
    <svg height={altura} viewBox="14 17 290 68" role="img" aria-label="RPS Real Property Solution" style={{ display: "block" }}>
      <polygon fill={letras} points="16.61 44.73 16.61 57.18 16.61 69.64 16.61 82.09 29.07 82.09 29.07 69.64 29.07 57.18 29.07 44.73 29.07 32.27 16.61 32.27 16.61 44.73" />
      <path fill={letras} d="m66.44,44.73v24.91c-4.08,0-7.7-1.97-9.97-5.01,6.04-4.55,9.97-11.75,9.97-19.9,0-13.76-11.15-24.91-24.91-24.91h0s-12.46,0-12.46,0v12.46h12.46c6.88,0,12.46,5.58,12.46,12.46s-5.58,12.46-12.46,12.46c0,4.45,1.18,8.61,3.22,12.22,4.28,7.57,12.38,12.69,21.69,12.69h12.46v-49.82h-12.46v12.46Z" />
      <path fill={letras} d="m91.35,19.81h0s-12.46,0-12.46,0v12.46h12.46c6.88,0,12.46,5.58,12.46,12.46s-5.58,12.46-12.46,12.46v12.46c13.76,0,24.91-11.15,24.91-24.91s-11.15-24.91-24.91-24.91Z" />
      <path fill={COR.ciano} d="m141.17,19.81h0c-13.76,0-24.91,11.15-24.91,24.91,0,4.54,1.22,8.79,3.34,12.46h18.52c.11,0,.2-.09.2-.2,0-.15-.2-.2-.21-.2-5.4-1.37-9.39-6.24-9.39-12.06,0-6.88,5.58-12.46,12.46-12.46h12.55c6.83,0,12.36-5.63,12.36-12.46h-24.91Z" />
      <path fill={COR.azul} d="m141.17,82.09h0c13.76,0,24.91-11.15,24.91-24.91,0-4.54-1.22-8.79-3.34-12.46h-18.52c-.11,0-.2.09-.2.2,0,.15.2.2.21.2,5.4,1.37,9.39,6.24,9.39,12.06,0,6.88-5.58,12.46-12.46,12.46h-12.55c-6.83,0-12.36,5.63-12.36,12.46h24.91Z" />
      <text x="182" y="40" fill={texto} style={{ font: "700 19px Poppins, sans-serif" }}>Real</text>
      <text x="182" y="61" fill={texto} style={{ font: "700 19px Poppins, sans-serif" }}>Property</text>
      <text x="182" y="82" fill={escura ? COR.ciano : COR.azul} style={{ font: "700 19px Poppins, sans-serif" }}>Solution</text>
    </svg>
  );
};

/** Rótulo pequeno em caixa alta e espaçado — a "assinatura" tipográfica do RGM. */
const sobrancelha: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" };

/* -------------------------------------------------------------------------- */
/* Capítulos e paginação (template corporativo RPS 360°)                       */
/* -------------------------------------------------------------------------- */

export type CapituloId = "01" | "02" | "03" | "04" | "05" | "06" | "07";

export const CAPITULOS: { id: CapituloId; nome: string; resumo: string }[] = [
  { id: "01", nome: "O empreendimento", resumo: "Perfil do ativo, ocupação e fluxo de acessos." },
  { id: "02", nome: "Gestão financeira", resumo: "Resultado, fundos, orçamento, custos e inadimplência da última prestação fechada." },
  { id: "03", nome: "Governança e compliance", resumo: "Contratos, documentos legais, jurídico e certidões." },
  { id: "04", nome: "Performance operacional", resumo: "Manutenção, ordens de serviço, fornecedores e evidências." },
  { id: "05", nome: "Sustentabilidade e eficiência", resumo: "Utilidades e consumo." },
  { id: "06", nome: "Investimentos e valor gerado", resumo: "CAPEX em execução e ganhos do período." },
  { id: "07", nome: "Gestão de riscos e decisões", resumo: "Plano de ação, matriz de riscos e deliberações ao cliente." },
];

export interface InfoPagina {
  pagina: number;
  capitulo: CapituloId | null;
  /** Texto do rodapé: empreendimento · competência · financeiro · cidade. */
  rodape: string;
  /** Primeiro slide de cada capítulo, para os links de navegação. */
  inicioCapitulo: Partial<Record<CapituloId, string>>;
  /** id do slide de sumário (link "Sumário"). */
  sumario?: string;
}

/** Cada slide recebe sua página e capítulo por contexto — os slides não precisam saber a ordem. */
export const ContextoPagina = createContext<InfoPagina | null>(null);

/** Link interno: funciona no PDF (âncora) e na apresentação (interceptado pela página). */
export const linkSlide = (id: string) => `#slide-${id}`;

export const COR_SEMAFORO: Record<Semaforo, string> = {
  verde: COR.verde,
  amarelo: COR.amarelo,
  vermelho: COR.vermelho,
};

/* -------------------------------------------------------------------------- */
/* Palco                                                                       */
/* -------------------------------------------------------------------------- */

/** Escala o slide 1280×720 para caber no espaço disponível, centralizado. */
export const Palco = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const { width, height } = el.getBoundingClientRect();
      setEscala(Math.min(width / LARGURA, height / ALTURA));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 shadow-2xl"
        style={{
          width: LARGURA,
          height: ALTURA,
          transform: `translate(-50%, -50%) scale(${escala})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Tipos de slide                                                              */
/* -------------------------------------------------------------------------- */

const base: CSSProperties = { position: "relative", width: LARGURA, height: ALTURA, overflow: "hidden" };

/** Foto em tela cheia com véu escuro da esquerda — base das telas "de cinema". */
const FotoDeFundo = ({ foto, veu = 0.94, intensidade = 1 }: { foto: string; veu?: number; intensidade?: number }) => (
  <>
    <img
      src={foto}
      alt=""
      className="rgm-zoom"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: intensidade }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(90deg, rgba(12,14,43,${veu}) 0%, rgba(12,14,43,${veu * 0.82}) 42%, rgba(12,14,43,${veu * 0.25}) 100%)`,
      }}
    />
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(12,14,43,0.55) 0%, rgba(12,14,43,0) 35%)" }} />
  </>
);

export const SlideCapa = ({
  empreendimento,
  competencia,
  financeiro,
  cidade,
  foto,
  gestor,
  rotulo = "Relatório gerencial mensal",
  rotuloCompetencia = "Competência",
}: {
  empreendimento: string;
  competencia: string;
  financeiro?: string;
  cidade?: string | null;
  /** Foto do ativo; sem ela, a imagem institucional. */
  foto?: string | null;
  gestor?: string | null;
  rotulo?: string;
  rotuloCompetencia?: string;
}) => (
  <div className="slide-rgm" style={{ ...base, background: COR.noite }}>
    <FotoDeFundo foto={foto || capa} veu={0.9} />
    <div style={{ position: "absolute", left: 72, top: 64 }} className="rgm-anim">
      <MarcaRPS escura altura={34} />
    </div>
    <div style={{ position: "absolute", left: 72, top: 250, width: 700 }}>
      <p className="rgm-anim" style={{ ...sobrancelha, color: COR.ciano }}>{rotulo}</p>
      <h1
        className="rgm-anim"
        style={{ color: "#fff", fontSize: empreendimento.length > 26 ? 48 : 62, fontWeight: 600, lineHeight: 1.05, marginTop: 18, letterSpacing: "-0.01em" }}
      >
        {empreendimento}
      </h1>
      <div className="rgm-anim" style={{ width: 56, height: 3, background: COR.ciano, marginTop: 28 }} />
      <p className="rgm-anim" style={{ color: "#fff", fontSize: 30, fontWeight: 300, marginTop: 22 }}>
        {competencia}
      </p>
      {financeiro ? (
        <p className="rgm-anim" style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 10 }}>
          {rotuloCompetencia === "Competência" ? "Operação do mês · " : ""}financeiro da última prestação fechada: {financeiro}
        </p>
      ) : null}
    </div>
    <div style={{ position: "absolute", left: 72, right: 72, bottom: 52, display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
      <span>{[cidade, gestor ? `Gestão RPS: ${gestor}` : null].filter(Boolean).join("   ·   ")}</span>
      <span style={{ ...sobrancelha, fontSize: 10 }}>Confidencial · uso do proprietário</span>
    </div>
  </div>
);

/**
 * Abertura de capítulo (e do "mês em uma leitura"): tela escura, número
 * grande, uma frase e até 4 números que resumem o capítulo.
 */
export const SlideAbertura = ({
  numero,
  sobretitulo,
  titulo,
  texto,
  destaques = [],
  foto,
}: {
  numero?: string;
  sobretitulo?: string;
  titulo: string;
  texto?: string;
  destaques?: { rotulo: string; valor: string; apoio?: string; semaforo?: Semaforo }[];
  foto?: string | null;
}) => {
  const info = useContext(ContextoPagina);
  return (
    <div className="slide-rgm" style={{ ...base, background: COR.noite }}>
      {foto ? <FotoDeFundo foto={foto} veu={0.95} intensidade={0.55} /> : null}
      <div style={{ position: "absolute", left: 72, top: 56 }}>
        <MarcaRPS escura altura={24} />
      </div>
      <div style={{ position: "absolute", left: 72, top: 150, width: 860 }}>
        {numero ? (
          <p className="rgm-anim num" style={{ fontSize: 120, fontWeight: 200, color: COR.ciano, lineHeight: 0.9, letterSpacing: "-0.03em" }}>
            {numero}
          </p>
        ) : null}
        {sobretitulo ? (
          <p className="rgm-anim" style={{ ...sobrancelha, color: COR.ciano, marginTop: numero ? 18 : 0 }}>
            {sobretitulo}
          </p>
        ) : null}
        <h2 className="rgm-anim" style={{ fontSize: 46, fontWeight: 600, color: "#fff", lineHeight: 1.1, marginTop: 12, letterSpacing: "-0.01em" }}>
          {titulo}
        </h2>
        {texto ? (
          <p className="rgm-anim" style={{ fontSize: numero ? 17 : 22, fontWeight: 300, color: "rgba(255,255,255,0.82)", lineHeight: 1.45, marginTop: 18, maxWidth: 820 }}>
            {texto}
          </p>
        ) : null}
      </div>
      {destaques.length ? (
        <div
          className="rgm-anim"
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            bottom: 74,
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(destaques.length, 4)}, 1fr)`,
            borderTop: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          {destaques.slice(0, 4).map((d, i) => (
            <div key={d.rotulo} style={{ padding: "20px 24px 0 0", paddingLeft: i ? 24 : 0, borderLeft: i ? "1px solid rgba(255,255,255,0.12)" : "none" }}>
              <p style={{ ...sobrancelha, fontSize: 10, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 8 }}>
                {d.semaforo ? <Ponto semaforo={d.semaforo} tamanho={8} /> : null}
                {d.rotulo}
              </p>
              <p className="num" style={{ fontSize: 34, fontWeight: 600, color: "#fff", marginTop: 8, whiteSpace: "nowrap" }}>
                {d.valor}
              </p>
              {d.apoio ? <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{d.apoio}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {info ? (
        <p style={{ position: "absolute", right: 72, top: 60, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          {info.rodape.split(" · ").slice(0, 2).join(" · ")}
          <span style={{ marginLeft: 18, color: "rgba(255,255,255,0.8)" }}>{String(info.pagina).padStart(2, "0")}</span>
        </p>
      ) : null}
    </div>
  );
};

export const SlideEncerramento = ({
  texto = "Obrigado.",
  linhas = [],
}: {
  texto?: string;
  /** Lembretes finais: decisões pendentes, próximo RGM, contato do gestor (até 2 cabem). */
  linhas?: string[];
  foto?: string | null;
}) => (
  // arte original do template: desenho geométrico, filete ciano e logo RPS
  <div className="slide-rgm" style={{ ...base, backgroundImage: `url(${encerramento})`, backgroundSize: "cover" }}>
    <p className="rgm-anim" style={{ position: "absolute", left: 40, top: 588, color: "#fff", fontSize: 46, fontWeight: 300 }}>
      {texto}
    </p>
    {linhas.length ? (
      <div className="rgm-anim" style={{ position: "absolute", left: 40, top: 652, display: "flex", flexDirection: "column", gap: 3 }}>
        {linhas.slice(0, 2).map((l) => (
          <p key={l} style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
            {l}
          </p>
        ))}
      </div>
    ) : null}
  </div>
);

/** Progresso por capítulo no topo: 7 traços finos, o atual em destaque. Clicáveis. */
const NavCapitulos = ({ info }: { info: InfoPagina }) => (
  <div style={{ position: "absolute", right: 38, top: 20, display: "flex", alignItems: "center", gap: 5 }}>
    {CAPITULOS.map((c) => {
      const ativo = info.capitulo === c.id;
      const destino = info.inicioCapitulo[c.id];
      const traco: CSSProperties = {
        display: "flex",
        flexDirection: "column",
        gap: 5,
        width: 46,
        textDecoration: "none",
        opacity: destino ? 1 : 0.35,
      };
      const conteudo = (
        <>
          <span style={{ height: 3, borderRadius: 2, background: ativo ? COR.navy : "#D9DCE7" }} />
          <span style={{ fontSize: 9, fontWeight: ativo ? 700 : 500, color: ativo ? COR.navy : COR.fraco, letterSpacing: "0.08em" }}>{c.id}</span>
        </>
      );
      return destino ? (
        <a key={c.id} href={linkSlide(destino)} style={traco} title={c.nome}>
          {conteudo}
        </a>
      ) : (
        <span key={c.id} style={traco}>
          {conteudo}
        </span>
      );
    })}
  </div>
);

/** Rodapé discreto: marca · contexto do relatório · sumário · página. */
const Rodape = ({ info }: { info: InfoPagina }) => (
  <div
    style={{
      position: "absolute",
      left: 37,
      right: 38,
      bottom: 20,
      display: "flex",
      alignItems: "center",
      gap: 16,
      fontSize: 10,
      color: COR.fraco,
    }}
  >
    <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{info.rodape}</span>
    {info.sumario ? (
      <a href={linkSlide(info.sumario)} style={{ fontWeight: 600, color: COR.azul, textDecoration: "none" }}>
        Sumário
      </a>
    ) : null}
    <span className="num" style={{ fontWeight: 600, color: COR.navy, minWidth: 22, textAlign: "right" }}>
      {String(info.pagina).padStart(2, "0")}
    </span>
  </div>
);

/**
 * Slide de conteúdo: capítulo em sobrancelha, título, MANCHETE (a conclusão
 * do slide em uma frase), corpo, fontes e rodapé. Capítulo e página chegam
 * pelo ContextoPagina.
 */
export const SlidePadrao = ({
  secao,
  sobretitulo,
  manchete,
  icone: _icone,
  fontes,
  children,
}: {
  secao: string;
  /** Sobrancelha. Padrão: "02 · Gestão financeira". */
  sobretitulo?: string;
  /** A conclusão do slide, em uma frase — o que o proprietário deve levar. */
  manchete?: string;
  /** Mantido por compatibilidade; o novo cabeçalho não usa ícone. */
  icone?: LucideIcon;
  fontes?: string;
  children: ReactNode;
}) => {
  const info = useContext(ContextoPagina);
  const cap = info?.capitulo ? CAPITULOS.find((c) => c.id === info.capitulo) : undefined;
  const linha1 = sobretitulo ?? (cap ? `${cap.id} · ${cap.nome}` : "Relatório gerencial mensal");
  // o topo (até ~105px) é da arte: logo, slogan e filete
  const topo = manchete ? 204 : 176;
  return (
    <div className="slide-rgm" style={{ ...base, background: "#fff", backgroundImage: `url(${fundoSlide})`, backgroundSize: "cover" }}>
      {info && Object.keys(info.inicioCapitulo).length ? <NavCapitulos info={info} /> : null}
      <div style={{ position: "absolute", left: 37, top: 112, right: 38 }}>
        <p className="rgm-anim" style={{ ...sobrancelha, color: COR.azul }}>{linha1}</p>
        <h2 className="rgm-anim" style={{ fontSize: 28, fontWeight: 600, color: COR.navy, lineHeight: 1.15, marginTop: 6, letterSpacing: "-0.01em" }}>
          {secao}
        </h2>
      </div>
      {manchete ? (
        <p
          className="rgm-anim"
          style={{
            position: "absolute",
            left: 37,
            right: 38,
            top: 168,
            fontSize: 16,
            fontWeight: 400,
            color: COR.apoio,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {manchete}
        </p>
      ) : null}
      <div className="rgm-conteudo" style={{ position: "absolute", left: 37, right: 38, top: topo, bottom: fontes ? 70 : 52 }}>
        {children}
      </div>
      {fontes ? (
        <p style={{ position: "absolute", left: 37, right: 38, bottom: 48, fontSize: 9, color: COR.fraco, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Fontes: {fontes}
        </p>
      ) : null}
      <div style={{ position: "absolute", left: 37, right: 38, bottom: 42, height: 1, background: COR.linha }} />
      {info ? <Rodape info={info} /> : null}
    </div>
  );
};

/** Sumário navegável — capítulos, páginas e a legenda dos semáforos. */
export const SlideSumario = ({
  painel,
  capitulos,
}: {
  painel?: { pagina: number; id: string };
  capitulos: { id: CapituloId; nome: string; resumo: string; itens: { titulo: string; pagina: number; id: string }[] }[];
}) => {
  const colunas: (typeof capitulos)[] = [[], [], []];
  // distribui os capítulos em 3 colunas equilibrando o número de linhas
  const peso = [0, 0, 0];
  capitulos.forEach((c) => {
    const i = peso.indexOf(Math.min(...peso));
    colunas[i].push(c);
    peso[i] += c.itens.length + 2;
  });
  return (
    <SlidePadrao secao="Sumário executivo" sobretitulo="Navegação" icone={IconeSumario}>
      <div style={{ display: "flex", gap: 20 }}>
        {painel ? (
          <a
            href={linkSlide(painel.id)}
            style={{ flex: 1, background: COR.navy, color: "#fff", borderRadius: 8, padding: "16px 22px", display: "flex", alignItems: "center", gap: 28, textDecoration: "none" }}
          >
            <span style={{ fontSize: 30, color: COR.ciano, fontWeight: 300 }}>360°</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 17, fontWeight: 700 }}>Dashboard 360° — Visão executiva</span>
              <span style={{ display: "block", fontSize: 11.5, opacity: 0.85 }}>Leitura do mês em uma página: semáforos, resultado, conformidade e plano de ação.</span>
            </span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{String(painel.pagina).padStart(2, "0")}</span>
          </a>
        ) : null}
        <div style={{ width: 364, background: COR.cartao, borderRadius: 8, padding: "12px 20px" }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: COR.apoio, marginBottom: 10 }}>COMO LER OS SEMÁFOROS</p>
          <LegendaSemaforo />
          <p style={{ fontSize: 9, color: COR.apoio, marginTop: 6 }}>Parâmetros corporativos RPS.</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, marginTop: 22 }}>
        {colunas.map((col, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {col.map((c) => (
              <div key={c.id}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", borderBottom: `1px solid ${COR.navy}`, paddingBottom: 8 }}>
                  <span style={{ fontSize: 26, fontWeight: 300, color: COR.azul, lineHeight: 1 }}>{c.id}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: COR.navy, lineHeight: 1.1 }}>{c.nome}</p>
                    <p style={{ fontSize: 9, color: COR.apoio }}>{c.resumo}</p>
                  </div>
                </div>
                {c.itens.map((it) => (
                  <a
                    key={it.id}
                    href={linkSlide(it.id)}
                    style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${COR.linha}`, fontSize: 11.5, color: "#2B2D45", textDecoration: "none" }}
                  >
                    <span>{it.titulo}</span>
                    <strong style={{ color: COR.azul }}>{String(it.pagina).padStart(2, "0")}</strong>
                  </a>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </SlidePadrao>
  );
};

/* -------------------------------------------------------------------------- */
/* Peças                                                                       */
/* -------------------------------------------------------------------------- */

export const Ponto = ({ semaforo, tamanho = 12 }: { semaforo: Semaforo; tamanho?: number }) => (
  <span
    aria-label={semaforo === "verde" ? "Adequado" : semaforo === "amarelo" ? "Atenção" : "Prioritário"}
    style={{ display: "inline-block", width: tamanho, height: tamanho, borderRadius: "50%", background: COR_SEMAFORO[semaforo], flexShrink: 0 }}
  />
);

export const RotuloBloco = ({ children, cor = COR.azul, style }: { children: ReactNode; cor?: string; style?: CSSProperties }) => (
  <p style={{ fontSize: 11, fontWeight: 700, color: cor, letterSpacing: 0.2, textTransform: "uppercase", marginBottom: 8, ...style }}>
    {children}
  </p>
);

/** Cartão de indicador — cinza claro, rótulo em caixa alta, número grande, apoio. */
export const CartaoKpi = ({
  rotulo,
  valor,
  apoio,
  icone: Icone,
  semaforo,
  corValor,
  altura = 116,
  tamanhoValor = 27,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
  icone?: LucideIcon;
  semaforo?: Semaforo;
  corValor?: string;
  altura?: number;
  tamanhoValor?: number;
}) => (
  // minHeight: o cartão cresce se o texto de apoio quebrar linha (a grade iguala a altura da fileira)
  <div style={{ background: COR.cartao, padding: "14px 18px", minHeight: altura, display: "flex", flexDirection: "column", borderTop: `2px solid ${COR.navy}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {Icone ? <Icone size={15} color={COR.azul} strokeWidth={2} /> : null}
      <span style={{ fontSize: 10, fontWeight: 600, color: COR.apoio, flex: 1, textTransform: "uppercase", letterSpacing: "0.08em" }}>{rotulo}</span>
      {semaforo ? <Ponto semaforo={semaforo} /> : null}
    </div>
    <p
      className="num"
      style={{
        fontSize: tamanhoValor,
        fontWeight: 700,
        lineHeight: 1.1,
        marginTop: 10,
        color: corValor ?? (semaforo === "vermelho" ? COR.vermelho : semaforo === "amarelo" ? COR.amarelo : COR.azul),
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {valor}
    </p>
    {apoio ? (
      <p style={{ fontSize: 10.5, color: COR.apoio, marginTop: "auto", paddingTop: 6, lineHeight: 1.35 }}>{apoio}</p>
    ) : null}
  </div>
);

/** Caixa navy "LEITURA GERENCIAL". */
export const CaixaLeitura = ({
  titulo = "Leitura gerencial",
  topicos,
  automatica,
  style,
  tamanho = 13,
}: {
  titulo?: string;
  topicos: Topico[];
  automatica?: boolean;
  style?: CSSProperties;
  tamanho?: number;
}) => (
  <div style={{ background: COR.noite, color: "#fff", padding: "18px 22px", borderLeft: `3px solid ${COR.ciano}`, ...style }}>
    <RotuloBloco cor={COR.ciano} style={{ marginBottom: 14, letterSpacing: "0.14em", fontWeight: 600 }}>
      {titulo}
    </RotuloBloco>
    {topicos.length ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {topicos.map((t, i) => (
          <p key={i} style={{ fontSize: tamanho, lineHeight: 1.4 }}>
            {t.destaque ? <strong style={{ fontWeight: 700 }}>{t.destaque} </strong> : null}
            {t.texto}
          </p>
        ))}
      </div>
    ) : (
      <p style={{ fontSize: 12, opacity: 0.7 }}>Sem observações nesta competência.</p>
    )}
    {automatica && topicos.length ? (
      <p style={{ fontSize: 9, opacity: 0.55, marginTop: 14 }}>Leitura gerada a partir dos dados do mês.</p>
    ) : null}
  </div>
);

export interface ColunaSlide<T> {
  titulo: string;
  largura?: number | string;
  alinhar?: "left" | "right" | "center";
  render: (linha: T) => ReactNode;
}

/** Tabela no padrão do relatório: cabeçalho navy, linhas finas. */
export const TabelaSlide = <T,>({
  colunas,
  linhas,
  tamanho = 11,
  alturaLinha = 34,
  maxLinhas,
  rodape,
}: {
  colunas: ColunaSlide<T>[];
  linhas: T[];
  tamanho?: number;
  alturaLinha?: number;
  maxLinhas?: number;
  rodape?: string;
}) => {
  const visiveis = maxLinhas ? linhas.slice(0, maxLinhas) : linhas;
  const ocultas = linhas.length - visiveis.length;
  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: tamanho, tableLayout: "fixed" }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${COR.navy}` }}>
            {colunas.map((c) => (
              <th
                key={c.titulo}
                style={{
                  textAlign: c.alinhar ?? "left",
                  padding: "8px 8px 9px",
                  fontWeight: 600,
                  width: c.largura,
                  fontSize: tamanho - 1.5,
                  color: COR.apoio,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visiveis.map((l, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COR.linha}`, height: alturaLinha }}>
              {colunas.map((c, j) => (
                <td
                  key={c.titulo}
                  className="num"
                  style={{
                    textAlign: c.alinhar ?? "left",
                    padding: "5px 8px",
                    color: j === 0 ? COR.navy : "#2B2D45",
                    fontWeight: j === 0 ? 600 : 400,
                    lineHeight: 1.3,
                    verticalAlign: "middle",
                    overflow: "hidden",
                  }}
                >
                  {c.render(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {ocultas > 0 || rodape ? (
        <p style={{ fontSize: 9.5, color: COR.apoio, marginTop: 6 }}>
          {ocultas > 0 ? `+ ${ocultas} item(ns) no relatório completo do sistema. ` : ""}
          {rodape ?? ""}
        </p>
      ) : null}
    </div>
  );
};

/** Legenda de semáforo usada no painel executivo. */
export const LegendaSemaforo = () => (
  <div style={{ display: "flex", gap: 26, fontSize: 11, color: COR.apoio, alignItems: "center" }}>
    {(["verde", "amarelo", "vermelho"] as Semaforo[]).map((s) => (
      <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <Ponto semaforo={s} tamanho={10} />
        {s === "verde" ? "Adequado" : s === "amarelo" ? "Atenção" : "Prioritário"}
      </span>
    ))}
  </div>
);

/** Item de legenda com valor à direita (ao lado de rosca). */
export const ItemLegenda = ({ cor, rotulo, valor, apoio }: { cor: string; rotulo: string; valor: string; apoio?: string }) => (
  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
    <span style={{ width: 13, height: 13, background: cor, marginTop: 3, flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: 12, color: "#2B2D45" }}>{rotulo}</p>
      {apoio ? <p style={{ fontSize: 9.5, color: COR.apoio }}>{apoio}</p> : null}
    </div>
    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: COR.azul }}>
      {valor}
    </span>
  </div>
);

export const Vazio = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      height: "100%",
      border: `1px dashed ${COR.linha}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: COR.apoio,
      fontSize: 13,
      textAlign: "center",
      padding: 24,
    }}
  >
    {children}
  </div>
);
