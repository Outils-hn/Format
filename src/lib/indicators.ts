// Indicateurs de présentation dérivés des résultats (aucun impact sur le moteur).
import type { Balance, FormatCount, MaterialResult } from "./optimizer/types";
import type { Material, MaterialStatus, Piece } from "./types";
import { dims, num, panelOrder, pct1 } from "./format";

export interface Indicators {
  purchased: number; pieces: number; reusable: number; loss: number;
  yieldPct: number; reusablePct: number; lossPct: number;
}

/** Parts arrondies à 0,1 % dont la somme fait toujours 100 %. */
export function indicators(b: Balance): Indicators {
  const loss = b.trim + b.losses;
  const p = b.purchased > 0 ? b.purchased : 1;
  const yieldPct = Math.round((b.pieces / p) * 1000) / 10;
  const reusablePct = Math.round((b.reusable / p) * 1000) / 10;
  const lossPct = b.purchased > 0 ? Math.round((100 - yieldPct - reusablePct) * 10) / 10 : 0;
  return { purchased: b.purchased, pieces: b.pieces, reusable: b.reusable, loss, yieldPct, reusablePct, lossPct };
}

export { pct1, m2 } from "./format";

export const splitLine = (i: Indicators) =>
  `${pct1(i.yieldPct)} pièces + ${pct1(i.reusablePct)} chutes réutilisables + ${pct1(i.lossPct)} perte définitive = 100 %`;

/** Borne minimale théorique du nombre de panneaux (format unique seulement). */
export function lowerBound(mat: Material, pieces: Piece[]): number | null {
  if (mat.supply.mode !== "single") return null;
  const uw = mat.supply.width - 2 * mat.trim, ul = mat.supply.length - 2 * mat.trim;
  if (uw <= 0 || ul <= 0) return null;
  let area = 0, big = 0;
  for (const p of pieces) {
    if (p.materialId !== mat.id || !p.width || !p.height) continue;
    area += (p.width + mat.kerf) * (p.height + mat.kerf) * p.quantity;
    const isBig = (w: number, h: number) => w > uw / 2 && h > ul / 2;
    if (isBig(p.width, p.height) && (!p.canRotate || mat.grainLocked || isBig(p.height, p.width))) big += p.quantity;
  }
  let bound = Math.max(Math.ceil(area / (uw * ul) - 1e-9), big);
  const rows = pieces.filter((p) => p.materialId === mat.id && p.width && p.height && p.quantity > 0);
  const first = rows[0];
  if (first?.width && first.height && rows.every((p) => p.width === first.width && p.height === first.height)) {
    const w = first.width + mat.kerf, h = first.height + mat.kerf;
    const normalFits = w <= uw && h <= ul;
    const turnedFits = h <= uw && w <= ul;
    // Apply only when every piece has exactly the same single feasible orientation.
    const orientations = rows.map((p) => ({ normal: normalFits, turned: p.canRotate && !mat.grainLocked && turnedFits }));
    const onlyNormal = orientations.every((o) => o.normal && !o.turned);
    const onlyTurned = orientations.every((o) => !o.normal && o.turned);
    if (onlyNormal || onlyTurned) {
      const capacity = Math.floor(uw / (onlyNormal ? w : h)) * Math.floor(ul / (onlyNormal ? h : w));
      if (capacity > 0) bound = Math.max(bound, Math.ceil(rows.reduce((sum, p) => sum + p.quantity, 0) / capacity));
    }
  }
  return bound;
}

export const formatsText = (f: FormatCount[]) => f.map((x) => `${x.count} × ${dims(x.width, x.length)} mm`).join(" · ");

export function statusTitle(s?: MaterialStatus): string {
  if (s?.status === "ordered") return "Panneaux commandés";
  if (s?.status === "stock") return "Panneaux à prendre en stock";
  return "Panneaux à commander";
}

export function statusSuffix(s?: MaterialStatus): string {
  if (s?.status !== "ordered") return "";
  const d = s.orderDate ? new Date(s.orderDate + "T00:00").toLocaleDateString("fr-FR") : "";
  const parts = [d && `commande du ${d}`, s.supplier, s.orderNumber && `n° ${s.orderNumber}`].filter(Boolean);
  return parts.length ? ` - ${parts.join(", ")}` : "";
}

export const materialLines = (r: MaterialResult[]) =>
  r.flatMap((m) => m.formats.map((f) => ({ name: `${m.name} ${num(m.thickness, 1)} mm`, text: panelOrder(f.count, f.width, f.length, m.name, m.thickness) })));
