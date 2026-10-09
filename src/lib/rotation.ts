import type { Material, Piece } from "./types";
import type { OptimizeResult } from "./optimizer/types";

/** Only explicit, unlocked rotation restrictions can be relaxed. */
export function rotationCandidates(pieces: Piece[], materials: Material[]): Piece[] {
  return pieces.filter((p) => !p.canRotate && materials.some((m) => m.id === p.materialId && !m.grainLocked));
}

export function allowRotation(pieces: Piece[], ids: string[]): Piece[] {
  const selected = new Set(ids);
  return pieces.map((p) => selected.has(p.id) ? { ...p, canRotate: true } : p);
}

/** Never suggest fewer panels obtained by leaving more pieces unplaced. */
export function rotationSavings(before: OptimizeResult, after: OptimizeResult): number {
  if (before.errors.length || after.errors.length) return 0;
  for (const material of before.materials) {
    const candidate = after.materials.find((m) => m.materialId === material.materialId);
    if (!candidate || candidate.errors.length || material.errors.length) return 0;
    for (const missing of candidate.unplaced) {
      const previous = material.unplaced.filter((p) => p.pieceId === missing.pieceId)
        .reduce((sum, p) => sum + p.quantity, 0);
      if (missing.quantity > previous) return 0;
    }
  }
  return Math.max(0, before.total.sheets - after.total.sheets);
}