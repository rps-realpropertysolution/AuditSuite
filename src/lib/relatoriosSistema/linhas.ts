/**
 * Remonta as linhas de uma página de PDF a partir dos trechos de texto do
 * pdf.js. O PDF não tem "linhas" — só pedaços posicionados. Agrupamos pela
 * altura (y) e ordenamos da esquerda para a direita (x), o que devolve as
 * linhas das tabelas como aparecem na tela: rótulo seguido dos valores.
 */

export interface TrechoPdf {
  str: string;
  transform: number[];
  width?: number;
}

const TOLERANCIA_Y = 2.5;

export const linhasDoPdf = (trechos: TrechoPdf[]): string[] => {
  const validos = trechos
    .filter((t) => typeof t.str === "string" && t.str.trim() !== "")
    .map((t) => ({ texto: t.str.trim(), x: t.transform[4], y: t.transform[5] }));

  // do topo para baixo
  validos.sort((a, b) => b.y - a.y || a.x - b.x);

  const grupos: { y: number; itens: { texto: string; x: number }[] }[] = [];
  for (const t of validos) {
    const grupo = grupos.find((g) => Math.abs(g.y - t.y) <= TOLERANCIA_Y);
    if (grupo) grupo.itens.push(t);
    else grupos.push({ y: t.y, itens: [t] });
  }

  return grupos
    .sort((a, b) => b.y - a.y)
    .map((g) =>
      g.itens
        .sort((a, b) => a.x - b.x)
        .map((i) => i.texto)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
};
