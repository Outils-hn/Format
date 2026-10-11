// Nombres au format français : virgule décimale, espace fine insécable pour les milliers.
const THIN = "\u202f";
const fmt = (n: number, min: number, max: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: min, maximumFractionDigits: max }).replace(/[\s\u00a0\u202f]/g, THIN);

/** Nombre avec au plus `d` décimales. */
export const num = (n: number, d = 0) => fmt(n, 0, d);
/** Nombre avec exactement `d` décimales. */
export const dec = (n: number, d: number) => fmt(n, d, d);
export const dims = (w: number, h: number) => `${num(w, 1)} × ${num(h, 1)}`;
export const m2 = (mm2: number) => dec(mm2 / 1e6, 2);
export const pct1 = (n: number) => `${dec(n, 1)} %`;
export const eur = (n: number | null | undefined) => (n == null ? "—" : `${num(n, 2)} €`);
