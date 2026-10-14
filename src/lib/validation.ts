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

/** Retourne un message d'erreur, ou null si la piece est faisable. */
/** Cote minimale credible d'une piece (mm). */
export const MIN_DIMENSION = 10;

export function validatePiece(p: Piece, materials: Material[]): string | null {
  const m = materials.find((x) => x.id === p.materialId);
  if (!m) return "Matériau inconnu";
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
