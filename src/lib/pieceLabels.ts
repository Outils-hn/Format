// Étiquettes des pièces dans les dessins : le texte ne déborde jamais de sa pièce.
export type Measure = (text: string, size: number, bold: boolean) => number;
export interface LabelPart { text: string; bold: boolean }
export type FittedLabel =
  | { kind: "text"; size: number; lines: LabelPart[][] }
  | { kind: "ref"; size: number; text: string }
  | null;

const LINE = 1.2;

/**
 * Cascade : « Repère · L × H » sur une ligne → deux lignes → dimensions seules,
 * puis police réduite jusqu'au minimum, sinon un numéro de renvoi vers le tableau.
 * Toutes les longueurs dans la même unité que `size`.
 */
export function fitPieceLabel(o: {
  label: string; dims: string; w: number; h: number; base: number; min: number; ref: string; measure: Measure;
  /** Taille sous laquelle on n'ecrit plus rien (le renvoi seul descend sinon jusqu'a min / 2). */
  floor?: number;
}): FittedLabel {
  const pad = o.base * 0.25;
  const aw = o.w - 2 * pad, ah = o.h - 2 * pad;
  const width = (line: LabelPart[], size: number) => line.reduce((a, p) => a + o.measure(p.text, size, p.bold), 0);
  const fits = (lines: LabelPart[][], size: number) =>
    lines.length * size * LINE <= ah && lines.every((l) => width(l, size) <= aw);
  const variants: LabelPart[][][] = [
    [[{ text: o.label, bold: true }, { text: ` · ${o.dims}`, bold: false }]],
    [[{ text: o.label, bold: true }], [{ text: o.dims, bold: false }]],
    [[{ text: o.dims, bold: false }]],
  ];
  const sizes: number[] = [];
  for (let s = o.base; s > o.min; s *= 0.9) sizes.push(s);
  sizes.push(o.min);
  for (const size of sizes) for (const lines of variants) if (fits(lines, size)) return { kind: "text", size, lines };
  for (let s = o.min; s >= (o.floor ?? o.min * 0.5); s *= 0.9) {
    if (s * LINE <= ah && o.measure(o.ref, s, true) <= aw) return { kind: "ref", size: s, text: o.ref };
  }
  return null;
}

/** Clé de regroupement des pièces dans le tableau d'un panneau (numéro de renvoi). */
export const pieceRowKey = (p: { pieceId: string; w: number; h: number; rotated: boolean }) => `${p.pieceId}|${p.w}|${p.h}|${p.rotated}`;
