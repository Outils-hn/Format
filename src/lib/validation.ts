import type { Material, Piece } from "./types";

/** Formats utilisables (apres delignage) d'un materiau. */
export function usableSizes(m: Material): { w: number; l: number }[] {
  const t = 2 * m.trim;
  const s = m.supply;
  const raw =
    s.mode === "single"
      ? [{ w: s.width, l: s.length }]
      : s.mode === "catalog"
        ? s.formats.map((f) => ({ w: f.width, l: f.length }))
        : [{ w: s.width, l: s.maxLength }];
  return raw.map((r) => ({ w: r.w - t, l: r.l - t }));
}

const pos = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0;
const posOrZero = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;

/**
 * Champs du materiau vides ou impossibles (un champ vide est enregistre comme null).
 * Renvoie la liste des champs a corriger, vide si le materiau est utilisable.
 */
export function materialProblems(m: Material): string[] {
  const out: string[] = [];
  if (!pos(m.thickness)) out.push("épaisseur");
  if (!posOrZero(m.kerf)) out.push("trait de coupe");
  if (!posOrZero(m.trim)) out.push("délignage");
  if (m.reuseMin != null && !pos(m.reuseMin)) out.push("chute réutilisable mini (plus de 0 mm)");
  const s = m.supply;
  if (s.mode === "single" && !(pos(s.width) && pos(s.length))) out.push("format du panneau");
  if (s.mode === "catalog" && (s.formats.length === 0 || !s.formats.every((f) => pos(f.width) && pos(f.length)))) out.push("formats du catalogue");
  if (s.mode === "fixedWidth" && !(pos(s.width) && pos(s.minLength) && pos(s.maxLength) && pos(s.step) && s.minLength <= s.maxLength)) out.push("largeur / longueurs à la demande");
  return out;
}

/** Retourne un message d'erreur, ou null si la piece est faisable. */
/** Cote minimale credible d'une piece (mm). */
export const MIN_DIMENSION = 10;

export function validatePiece(p: Piece, materials: Material[]): string | null {
  const m = materials.find((x) => x.id === p.materialId);
  if (!m) return "Matériau inconnu";
  const problems = materialProblems(m);
  if (problems.length) return `Matériau « ${m.name} » incomplet (${problems.join(", ")}) : corrigez-le dans la bibliothèque`;
  if (!p.width || !p.height || p.width <= 0 || p.height <= 0) return "Dimensions manquantes";
  if (!p.quantity || p.quantity <= 0) return "Quantité nulle";
  // Garde-fou : une cote sous 10 mm vient presque toujours d'un separateur ou d'une unite mal lus.
  if (p.width < MIN_DIMENSION || p.height < MIN_DIMENSION) return `Dimension suspecte (moins de ${MIN_DIMENSION} mm)`;
  const rotate = p.canRotate && !m.grainLocked;
  const fits = usableSizes(m).some(
    ({ w, l }) =>
      (p.width! <= w && p.height! <= l) || (rotate && p.width! <= l && p.height! <= w),
  );
  return fits ? null : "Plus grande que le plus grand format";
}
