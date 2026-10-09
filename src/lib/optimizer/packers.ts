// Packers sur un seul panneau. Le bac fait (W + trait) x (L + trait) et chaque piece
// occupe (w + trait) x (h + trait) : le trait est ainsi gere sans perte sur les bords.
import type { Item, Placement, Rect } from "./types";

export interface Packer {
  /** Tente de placer l'item ; renvoie le placement (dimensions reelles) ou null. */
  insert(item: Item): Placement | null;
}

export type GuillotineFit = "bssf" | "baf";
export type GuillotineSplit = "short" | "long";
export type MaxRectsFit = "bssf" | "baf" | "bl" | "cp";

interface Choice { rect: number; w: number; h: number; rotated: boolean; score: number; score2: number }

/** Orientations possibles ; `flip` signifie que l'item est deja fourni tourne. */
function tries(item: Item): [number, number, boolean][] {
  const f = !!item.flip;
  const t: [number, number, boolean][] = [[item.w, item.h, f]];
  if (item.canRotate && item.w !== item.h) t.push([item.h, item.w, !f]);
  return t;
}

const overlap1 = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

function choose(free: Rect[], item: Item, k: number, fit: MaxRectsFit, used: Rect[], binW: number, binH: number): Choice | null {
  let best: Choice | null = null;
  const ts = tries(item);
  free.forEach((r, i) => {
    for (const [w, h, rotated] of ts) {
      const ow = w + k, oh = h + k;
      if (ow > r.w || oh > r.h) continue;
      const a = r.w - ow, b = r.h - oh;
      let score: number, score2: number;
      if (fit === "bssf") { score = Math.min(a, b); score2 = Math.max(a, b); }
      else if (fit === "baf") { score = r.w * r.h - ow * oh; score2 = Math.min(a, b); }
      else if (fit === "bl") { score = r.y + oh; score2 = r.x; }
      else {
        // Contact Point : maximise le perimetre en contact (bords et pieces) -> score negatif
        let c = 0;
        if (r.x === 0 || r.x + ow === binW) c += oh;
        if (r.y === 0 || r.y + oh === binH) c += ow;
        for (const u of used) {
          if (u.x === r.x + ow || u.x + u.w === r.x) c += overlap1(u.y, u.y + u.h, r.y, r.y + oh);
          if (u.y === r.y + oh || u.y + u.h === r.y) c += overlap1(u.x, u.x + u.w, r.x, r.x + ow);
        }
        score = -c; score2 = Math.min(a, b);
      }
      if (!best || score < best.score || (score === best.score && score2 < best.score2))
        best = { rect: i, w, h, rotated, score, score2 };
    }
  });
  return best;
}

/** Guillotine : Best Short Side Fit ou Best Area Fit, decoupe Shorter ou Longer Leftover Axis. */
export function guillotinePacker(W: number, L: number, k: number, fit: GuillotineFit = "bssf", split: GuillotineSplit = "short", initFree?: Rect[]): Packer {
  const free: Rect[] = initFree ? initFree.map((r) => ({ ...r })) : [{ x: 0, y: 0, w: W + k, h: L + k }];
  return {
    insert(item) {
      const c = choose(free, item, k, fit, [], W + k, L + k);
      if (!c) return null;
      const r = free[c.rect]!;
      const ow = c.w + k, oh = c.h + k;
      const lw = r.w - ow, lh = r.h - oh;
      free.splice(c.rect, 1);
      let right: Rect, bottom: Rect;
      if ((lw < lh) === (split === "short")) {
        right = { x: r.x + ow, y: r.y, w: lw, h: oh };
        bottom = { x: r.x, y: r.y + oh, w: r.w, h: lh };
      } else {
        right = { x: r.x + ow, y: r.y, w: lw, h: r.h };
        bottom = { x: r.x, y: r.y + oh, w: ow, h: lh };
      }
      if (right.w > 0 && right.h > 0) free.push(right);
      if (bottom.w > 0 && bottom.h > 0) free.push(bottom);
      return { x: r.x, y: r.y, w: c.w, h: c.h, pieceId: item.pieceId, label: item.label, rotated: c.rotated };
    },
  };
}

/** MaxRects : Best Short Side Fit, Best Area Fit, Bottom-Left ou Contact Point. */
export function maxRectsPacker(W: number, L: number, k: number, fit: MaxRectsFit = "bssf", initFree?: Rect[], initUsed: Rect[] = []): Packer {
  let free: Rect[] = initFree ? initFree.map((r) => ({ ...r })) : [{ x: 0, y: 0, w: W + k, h: L + k }];
  const used: Rect[] = [...initUsed];
  return {
    insert(item) {
      const c = choose(free, item, k, fit, used, W + k, L + k);
      if (!c) return null;
      const r = free[c.rect]!;
      const u: Rect = { x: r.x, y: r.y, w: c.w + k, h: c.h + k };
      used.push(u);
      const next: Rect[] = [];
      for (const f of free) {
        if (u.x >= f.x + f.w || u.x + u.w <= f.x || u.y >= f.y + f.h || u.y + u.h <= f.y) { next.push(f); continue; }
        if (u.x > f.x) next.push({ x: f.x, y: f.y, w: u.x - f.x, h: f.h });
        if (u.x + u.w < f.x + f.w) next.push({ x: u.x + u.w, y: f.y, w: f.x + f.w - u.x - u.w, h: f.h });
        if (u.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: u.y - f.y });
        if (u.y + u.h < f.y + f.h) next.push({ x: f.x, y: u.y + u.h, w: f.w, h: f.y + f.h - u.y - u.h });
      }
      // supprime les rectangles contenus dans un autre
      free = next.filter((a, i) => !next.some((b, j) => j !== i &&
        a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h &&
        (j < i || a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h)));
      return { x: r.x, y: r.y, w: c.w, h: c.h, pieceId: item.pieceId, label: item.label, rotated: c.rotated };
    },
  };
}

/**
 * Decompose la surface libre de la zone utile W x L en rectangles disjoints,
 * puis fusionne les bandes adjacentes de meme hauteur pour former de vraies chutes.
 */
export function freeRects(W: number, L: number, placed: Rect[]): Rect[] {
  const xs = [...new Set([0, W, ...placed.flatMap((p) => [p.x, p.x + p.w])])]
    .filter((x) => x >= 0 && x <= W).sort((a, b) => a - b);
  const strips: Rect[][] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i]!, x1 = xs[i + 1]!;
    if (x1 <= x0) continue;
    const occ = placed.filter((p) => p.x < x1 && p.x + p.w > x0)
      .map((p) => [Math.max(0, p.y), Math.min(L, p.y + p.h)] as const).sort((a, b) => a[0] - b[0]);
    const out: Rect[] = [];
    let y = 0;
    for (const [a, b] of occ) { if (a > y) out.push({ x: x0, y, w: x1 - x0, h: a - y }); y = Math.max(y, b); }
    if (y < L) out.push({ x: x0, y, w: x1 - x0, h: L - y });
    strips.push(out);
  }
  // fusion horizontale des bandes voisines ayant le meme intervalle vertical
  const done: Rect[] = [];
  let open: Rect[] = [];
  for (const s of strips) {
    const next: Rect[] = [];
    for (const r of s) {
      const m = open.find((o) => o.y === r.y && o.h === r.h && o.x + o.w === r.x);
      if (m) { m.w += r.w; next.push(m); open = open.filter((o) => o !== m); } else next.push({ ...r });
    }
    done.push(...open);
    open = next;
  }
  done.push(...open);
  // fusion verticale des rectangles de meme largeur empiles
  let merged = true;
  while (merged) {
    merged = false;
    for (const a of done) {
      const b = done.find((o) => o !== a && o.x === a.x && o.w === a.w && o.y === a.y + a.h);
      if (b) { a.h += b.h; done.splice(done.indexOf(b), 1); merged = true; break; }
    }
  }
  return done.filter((r) => r.w > 0 && r.h > 0);
}
