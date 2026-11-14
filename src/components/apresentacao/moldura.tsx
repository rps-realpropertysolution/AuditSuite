/**
 * Moldura dos slides do RGM — o padrão visual do relatório corporativo RPS.
 *
 * Todo slide é desenhado num palco FIXO de 1280×720 (16:9, igual ao PPTX).
 * Na tela, o <Palco> escala o slide inteiro para caber; na impressão, cada
 * slide vira uma página do mesmo tamanho. Por isso as medidas aqui são em
 * pixels absolutos: o slide nunca "quebra" em telas diferentes.
 */

import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ListChecks as IconeSumario, type LucideIcon } from "lucide-react";
import fundoSlide from "@/assets/rgm/fundo-slide.jpg";
import capa from "@/assets/rgm/capa.jpg";
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
  cartao: "#F2F3F7",
  linha: "#E3E5EE",
  texto: "#201E5A",
  apoio: "#5B5E77",
  fraco: "#8A8DA3",
  verde: "#2E9E5B",
  amarelo: "#E0A12B",
  vermelho: "#CC3B3B",
} as const;

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

export const SlideCapa = ({
  empreendimento,
  competencia,
  financeiro,
  cidade,
  rotulo = "Relatório gerencial mensal · visão 360°",
  rotuloCompetencia = "Competência",
}: {
  empreendimento: string;
  competencia: string;
  financeiro?: string;
  cidade?: string | null;
  rotulo?: string;
  rotuloCompetencia?: string;
}) => (
  <div className="slide-rgm" style={{ ...base, backgroundImage: `url(${capa})`, backgroundSize: "cover" }}>
    <div style={{ position: "absolute", left: 46, top: 422, right: 340 }}>
      <p style={{ color: "#F4E11B", fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}>
        {rotulo.toUpperCase()}
      </p>
      <h1 style={{ color: "#fff", fontSize: empreendimento.length > 28 ? 30 : 36, fontWeight: 700, lineHeight: 1.15, marginTop: 6 }}>
        {empreendimento}
      </h1>
      <p style={{ color: "#fff", fontSize: 13.5, fontWeight: 600, marginTop: 12, whiteSpace: "nowrap" }}>
        {rotuloCompetencia}: {competencia}
        {financeiro ? <>&nbsp;&nbsp;·&nbsp;&nbsp;Financeiro: {financeiro} (última prestação fechada)</> : null}
        {cidade ? <>&nbsp;&nbsp;·&nbsp;&nbsp;{cidade}</> : null}
      </p>
    </div>
  </div>
);

export const SlideEncerramento = ({ texto = "Obrigado" }: { texto?: string }) => (
  <div className="slide-rgm" style={{ ...base, backgroundImage: `url(${encerramento})`, backgroundSize: "cover" }}>
    <div style={{ position: "absolute", left: 40, top: 576, width: 60, height: 4, borderRadius: 2, background: COR.ciano }} />
    <p style={{ position: "absolute", left: 40, top: 590, color: "#fff", fontSize: 48, fontWeight: 300 }}>{texto}</p>
  </div>
);

/** Botões de capítulo no topo — o capítulo atual fica preenchido. */
const NavCapitulos = ({ info }: { info: InfoPagina }) => (
  <div style={{ position: "absolute", right: 38, top: 28, display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ fontSize: 8.5, fontWeight: 700, color: COR.apoio, marginRight: 8, letterSpacing: 0.3 }}>CAPÍTULOS</span>
    {CAPITULOS.map((c) => {
      const ativo = info.capitulo === c.id;
      const destino = info.inicioCapitulo[c.id];
      const estilo: CSSProperties = {
        width: 40,
        height: 24,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10.5,
        fontWeight: ativo ? 700 : 400,
        borderRadius: 4,
        border: `1px solid ${ativo ? COR.navy : "#D3D6E2"}`,
        background: ativo ? COR.navy : "#fff",
        color: ativo ? "#fff" : destino ? COR.apoio : "#C4C6D2",
        textDecoration: "none",
      };
      return destino ? (
        <a key={c.id} href={linkSlide(destino)} style={estilo} title={c.nome}>
          {c.id}
        </a>
      ) : (
        <span key={c.id} style={estilo}>
          {c.id}
        </span>
      );
    })}
  </div>
);

/** Rodapé: capítulo · contexto do relatório · link do sumário · página. */
const Rodape = ({ info, rotulo }: { info: InfoPagina; rotulo: string }) => (
  <div
    style={{
      position: "absolute",
      left: 37,
      right: 38,
      top: 691,
      borderTop: `1px solid ${COR.linha}`,
      paddingTop: 7,
      display: "flex",
      alignItems: "center",
      gap: 16,
      fontSize: 10,
    }}
  >
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, color: COR.navy, minWidth: 240 }}>
      <span style={{ width: 9, height: 9, background: COR.ciano }} />
      {rotulo}
    </span>
    <span style={{ flex: 1, textAlign: "center", color: COR.apoio, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {info.rodape}
    </span>
    {info.sumario ? (
      <a href={linkSlide(info.sumario)} style={{ fontWeight: 700, color: COR.azul, textDecoration: "none", width: 90, textAlign: "right" }}>
        Sumário
      </a>
    ) : null}
    <span style={{ color: COR.apoio, width: 70, textAlign: "right" }}>
      Página <strong style={{ color: COR.navy }}>{info.pagina}</strong>
    </span>
  </div>
);

/**
 * Slide padrão: cabeçalho da marca, capítulos, título em duas linhas, ícone,
 * fontes e rodapé paginado. Capítulo e página chegam pelo ContextoPagina.
 */
export const SlidePadrao = ({
  secao,
  sobretitulo,
  icone: Icone,
  fontes,
  children,
}: {
  secao: string;
  /** Primeira linha do título. Padrão: "CAPÍTULO 02 · GESTÃO FINANCEIRA". */
  sobretitulo?: string;
  icone: LucideIcon;
  fontes?: string;
  children: ReactNode;
}) => {
  const info = useContext(ContextoPagina);
  const cap = info?.capitulo ? CAPITULOS.find((c) => c.id === info.capitulo) : undefined;
  const linha1 = sobretitulo ?? (cap ? `Capítulo ${cap.id} · ${cap.nome}` : "Relatório gerencial mensal");
  const rotuloRodape = cap ? `Cap. ${cap.id} · ${cap.nome}` : sobretitulo ? sobretitulo.split("·").pop()!.trim() : "Relatório gerencial mensal";
  return (
  <div className="slide-rgm" style={{ ...base, backgroundImage: `url(${fundoSlide})`, backgroundSize: "cover" }}>
    {info && Object.keys(info.inicioCapitulo).length ? <NavCapitulos info={info} /> : null}
    <div style={{ position: "absolute", left: 40, top: 113, lineHeight: 1.15 }}>
      <p style={{ fontSize: 23, fontWeight: 300, color: COR.navy }}>{linha1.toUpperCase()}</p>
      <p style={{ fontSize: 23, fontWeight: 700, color: COR.navy }}>{secao.toUpperCase()}</p>
    </div>
    <div
      style={{
        position: "absolute",
        right: 38,
        top: 117,
        width: 53,
        height: 53,
        background: COR.navy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icone size={26} color="#fff" strokeWidth={2} />
    </div>
    <div style={{ position: "absolute", left: 37, right: 38, top: 187, bottom: 66 }}>{children}</div>
    {fontes ? (
      <p style={{ position: "absolute", left: 37, right: 38, bottom: 37, fontSize: 9.5, color: COR.apoio, lineHeight: 1.3 }}>
        Fontes: {fontes}
      </p>
    ) : null}
    {info ? <Rodape info={info} rotulo={rotuloRodape} /> : null}
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
  <div style={{ background: COR.cartao, padding: "14px 16px", minHeight: altura, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {Icone ? <Icone size={17} color={COR.azul} strokeWidth={2} /> : null}
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#3D3F5A", flex: 1, textTransform: "uppercase" }}>{rotulo}</span>
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
  <div style={{ background: COR.navy, color: "#fff", padding: "18px 20px", ...style }}>
    <RotuloBloco cor={COR.ciano} style={{ marginBottom: 14 }}>
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
          <tr style={{ background: COR.navy, color: "#fff" }}>
            {colunas.map((c) => (
              <th
                key={c.titulo}
                style={{ textAlign: c.alinhar ?? "left", padding: "10px 8px", fontWeight: 700, width: c.largura, fontSize: tamanho }}
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
