// Metre lineaire : conversion de bandes en troncons rectangulaires avant optimisation.
import type { Linear, Material, Piece } from "./types";
import type { OptimizeResult } from "./optimizer";
import { usableSizes } from "./validation";
import { uid } from "./ids";
import { num } from "./format";

export interface Segment { length: number; count: number }

export const newLinear = (materialId: string, n: number): Linear => ({
  id: uid(), label: `L${n}`, materialId, bandWidth: null, totalLength: null,
  mode: "fixed", segment: null, min: 500, max: null, multiple: null,
});

const PREFIX = "lin:";
export const linearOf = (pieceId: string) => pieceId.startsWith(PREFIX) ? pieceId.slice(PREFIX.length).split(":")[0]! : null;

/** Plus grande longueur de troncon logeable dans la zone utile d'un format. */
function maxFit(band: number, m: Material): number {
  let best = 0;
  for (const { w, l } of usableSizes(m)) {
    if (band <= w) best = Math.max(best, l);
    if (!m.grainLocked && band <= l) best = Math.max(best, w);
  }
  return best;
}

/** Troncons d'un lineaire, ou message d'erreur. Somme des troncons = longueur demandee exactement. */
export function linearSegments(l: Linear, materials: Material[]): Segment[] | string {
  const m = materials.find((x) => x.id === l.materialId);
  if (!m) return "Matériau inconnu";
  if (!l.bandWidth || l.bandWidth <= 0 || !l.totalLength || l.totalLength <= 0) return "Dimensions manquantes";
  const total = Math.round(l.totalLength * 1000);
  const fit = maxFit(l.bandWidth, m);
  if (!fit) return "Bande plus large que le panneau";
  const out: Segment[] = [];
  const push = (length: number, count = 1) => {
    if (count <= 0 || length <= 0) return;
    const s = out.find((x) => x.length === length);
    if (s) s.count += count; else out.push({ length, count });
  };
  if (l.mode === "fixed") {
    if (!l.segment || l.segment <= 0) return "Longueur de tronçon manquante";
    if (l.segment > fit) return "Tronçon plus long que le panneau";
    const n = Math.floor(total / l.segment);
    push(l.segment, n); push(total - n * l.segment);
    return out;
  }
  const min = Math.max(1, l.min ?? 1);
  const mult = l.multiple && l.multiple > 0 ? l.multiple : 1;
  let target = Math.min(l.max && l.max > 0 ? l.max : fit, fit);
  target = Math.floor(target / mult) * mult;
  if (target < min) return "Aucune longueur possible entre mini, maxi et multiple";
  if (total <= target) { if (total < min) return "Longueur totale inférieure au mini"; push(total); return out; }
  const n = Math.floor(total / target);
  const rem = total - n * target;
  if (rem === 0) { push(target, n); return out; }
  if (rem >= min) { push(target, n); push(rem); return out; }
  // Reste trop court : on rééquilibre le dernier tronçon plein avec le reste.
  const c = target + rem;
  const a = Math.floor((c - min) / mult) * mult;
  if (a < min || c - a > target) return "Impossible de respecter le mini avec ce multiple";
  push(target, n - 1); push(a); push(c - a);
  return out;
}

export const segmentsText = (l: Linear, s: Segment[]) =>
  `${num(l.totalLength ?? 0, 3)} ml → ${s.map((x) => `${x.count} × ${num(x.length)}`).join(" + ")}`;

/** Pieces rectangulaires issues des lineaires valides. */
export function linearPieces(linears: Linear[], materials: Material[]): Piece[] {
  const out: Piece[] = [];
  for (const l of linears) {
    const s = linearSegments(l, materials);
    if (typeof s === "string") continue;
    const locked = !!materials.find((m) => m.id === l.materialId)?.grainLocked;
    s.forEach((x, i) => out.push({
      id: `${PREFIX}${l.id}:${i}`, label: l.label, materialId: l.materialId,
      width: l.bandWidth, height: x.length, quantity: x.count, canRotate: !locked,
    }));
  }
  return out;
}

export interface LinearRecap { id: string; label: string; material: string; band: number; requested: number; segments: Segment[]; produced: number; ok: boolean }

/** Recapitulatif base sur les troncons reellement places. */
export function linearRecap(linears: Linear[], materials: Material[], pieces: Piece[], result: OptimizeResult): LinearRecap[] {
  const len = new Map(pieces.map((p) => [p.id, p.height ?? 0]));
  return linears.filter((l) => typeof linearSegments(l, materials) !== "string").map((l) => {
    const counts = new Map<number, number>();
    for (const r of result.materials) for (const sh of r.sheets) for (const p of sh.placements)
      if (linearOf(p.pieceId) === l.id) { const k = len.get(p.pieceId) ?? 0; counts.set(k, (counts.get(k) ?? 0) + 1); }
    const segments = [...counts].map(([length, count]) => ({ length, count })).sort((a, b) => b.length - a.length);
    const produced = segments.reduce((a, s) => a + s.length * s.count, 0);
    const requested = Math.round((l.totalLength ?? 0) * 1000);
    const m = materials.find((x) => x.id === l.materialId);
    return { id: l.id, label: l.label, material: m ? `${m.name} ${m.thickness}` : "?", band: l.bandWidth ?? 0, requested, segments, produced, ok: produced === requested };
  });
}

export const linearErrors = (recap: LinearRecap[]) =>
  recap.filter((r) => !r.ok).map((r) => `Linéaire ${r.label} : longueur produite ${r.produced} mm ≠ demandée ${r.requested} mm`);
