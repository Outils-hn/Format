// Outils partages par les exports PDF et Excel.
import type { OptimizeResult } from "../optimizer/types";

export const cleanName = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Ordre des couleurs identique a l'ecran (ordre d'apparition des pieces). */
export function pieceOrder(result: OptimizeResult): string[] {
  const ids: string[] = [];
  for (const r of result.materials) for (const s of r.sheets) for (const p of s.placements)
    if (!ids.includes(p.pieceId)) ids.push(p.pieceId);
  return ids;
}
