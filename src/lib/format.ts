// Nombres au format français : virgule décimale, espace fine insécable pour les milliers.
const THIN = "\u202f";
// Valeur absente ou invalide (champ vide enregistre) : tiret au lieu d'un plantage de toute la page.
const fmt = (n: number | null | undefined, min: number, max: number) =>
  n == null || !Number.isFinite(n) ? "—"
    : n.toLocaleString("fr-FR", { minimumFractionDigits: min, maximumFractionDigits: max }).replace(/[\s\u00a0\u202f]/g, THIN);

/** Nombre avec au plus `d` décimales. */
export const num = (n: number | null | undefined, d = 0) => fmt(n, 0, d);
/** Nombre avec exactement `d` décimales. */
export const dec = (n: number | null | undefined, d: number) => fmt(n, d, d);
export const dims = (w: number, h: number) => `${num(w, 1)} × ${num(h, 1)}`;
export const m2 = (mm2: number) => dec(mm2 / 1e6, 2);
export const pct1 = (n: number) => `${dec(n, 1)} %`;
// Prix en francs suisses (meme unite que la saisie dans la Bibliotheque)
export const chf = (n: number | null | undefined) => (n == null ? "—" : `${num(n, 2)} CHF`);

/** Une paire X/Y reste indivisible ; les listes se séparent par « · ». */
export const positionPair = (x: number, y: number) => `${num(x, 1)}\u00a0/\u00a0${num(y, 1)}`;

export const panelOrder = (count: number, width: number, length: number, name: string, thickness: number) =>
  `${num(count)} panneau${count === 1 ? "" : "x"} de ${dims(width, length)} mm - ${name} ${num(thickness, 1)} mm`;

/** Libellé compact et traçable des panneaux d'un même dessin. */
export function panelGroup(indexes: number[], withCount = true): string {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b);
  const first = sorted[0];
  if (first === undefined) return "Panneaux";
  if (sorted.length === 1) return `Panneau ${num(first)}`;
  const last = sorted[sorted.length - 1];
  const consecutive = sorted.every((n, i) => n === first + i);
  const list = consecutive ? `${num(first)} à ${num(last ?? first)}`
    : `${sorted.slice(0, -1).map((n) => num(n)).join(", ")} et ${num(last ?? first)}`;
  return `Panneaux ${list}${withCount ? ` - × ${num(sorted.length)}` : ""}`;
}

export const reuseCaption = (mode: "hide" | "indicative" | "retain") =>
  mode === "indicative" ? "Réutilisables si besoin" : mode === "retain" ? "À conserver" : "";
