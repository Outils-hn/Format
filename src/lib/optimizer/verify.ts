import type { Material, Piece } from "../types";
import type { Placement, SheetResult } from "./types";

/** Les pieces (elargies du trait) peuvent-elles etre separees par des coupes traversantes ? */
function guillotineOk(rs: { x: number; y: number; w: number; h: number }[], x0: number, y0: number, x1: number, y1: number): boolean {
  if (rs.length <= 1) return true;
  for (const axis of ["x", "y"] as const) {
    const cuts = [...new Set(rs.map((r) => (axis === "x" ? r.x + r.w : r.y + r.h)))];
    for (const c of cuts) {
      if (c >= (axis === "x" ? x1 : y1)) continue;
      const crosses = rs.some((r) => (axis === "x" ? r.x < c && r.x + r.w > c : r.y < c && r.y + r.h > c));
      if (crosses) continue;
      const a = rs.filter((r) => (axis === "x" ? r.x + r.w <= c : r.y + r.h <= c));
      const b = rs.filter((r) => !a.includes(r));
      if (!a.length || !b.length) continue;
      return axis === "x"
        ? guillotineOk(a, x0, y0, c, y1) && guillotineOk(b, c, y0, x1, y1)
        : guillotineOk(a, x0, y0, x1, c) && guillotineOk(b, x0, c, x1, y1);
    }
  }
  return false;
}

export function verifyMaterial(m: Material, pieces: Piece[], sheets: SheetResult[], unplacedIds: Map<string, number>): string[] {
  const errs: string[] = [];
  const k = m.kerf;
  const count = new Map<string, number>();
  for (const s of sheets) {
    const ps: Placement[] = s.placements;
    ps.forEach((p, i) => {
      count.set(p.pieceId, (count.get(p.pieceId) ?? 0) + 1);
      if (p.x < 0 || p.y < 0 || p.x + p.w > s.usableW + 1e-6 || p.y + p.h > s.usableL + 1e-6)
        errs.push(`${m.name} panneau ${s.index} : ${p.label} hors zone utile`);
      const piece = pieces.find((x) => x.id === p.pieceId);
      if (p.rotated && piece && (!piece.canRotate || m.grainLocked))
        errs.push(`${m.name} panneau ${s.index} : ${p.label} tournée sans autorisation`);
      for (let j = i + 1; j < ps.length; j++) {
        const q = ps[j]!;
        if (p.x < q.x + q.w + k && q.x < p.x + p.w + k && p.y < q.y + q.h + k && q.y < p.y + p.h + k)
          errs.push(`${m.name} panneau ${s.index} : ${p.label} et ${q.label} se chevauchent`);
      }
    });
    if (m.cutType === "guillotine") {
      const rs = ps.map((p) => ({ x: p.x, y: p.y, w: p.w + k, h: p.h + k }));
      if (!guillotineOk(rs, 0, 0, s.usableW + k, s.usableL + k))
        errs.push(`${m.name} panneau ${s.index} : coupes non traversantes`);
    }
  }
  for (const p of pieces.filter((x) => x.materialId === m.id)) {
    const expected = p.quantity - (unplacedIds.get(p.id) ?? 0);
    const got = count.get(p.id) ?? 0;
    if (got !== expected) errs.push(`${m.name} : ${p.label} placée ${got} fois au lieu de ${expected}`);
  }
  return errs;
}
