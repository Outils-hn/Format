// Moteur d'optimisation 2D — materiau par materiau. Code pur, execute dans un Web Worker.
import type { Material, Piece } from "../types";
import { validatePiece } from "../validation";
import { freeRects, guillotinePacker, maxRectsPacker } from "./packers";
import type {
  Balance, FormatCount, Item, MaterialResult, OptimizeOptions, OptimizeRequest, OptimizeResult,
  Placement, SheetResult, Unplaced,
} from "./types";
import { verifyMaterial } from "./verify";

export const DEFAULT_REUSE_MIN = 300;
const INTENSIVE_MS = 2000;

interface Fmt { width: number; length: number; price?: number | undefined }
interface RawSheet { fmt: Fmt; placements: Placement[] }

const area = (f: { width: number; length: number }) => f.width * f.length;

function formatsOf(m: Material): Fmt[] {
  const s = m.supply;
  if (s.mode === "single") return [{ width: s.width, length: s.length }];
  if (s.mode === "catalog") return s.formats.map((f) => ({ width: f.width, length: f.length, price: f.price }));
  return [{ width: s.width, length: s.maxLength }];
}

/** Remplit un panneau avec les items dans l'ordre donne ; renvoie placements et items restants. */
function fillSheet(m: Material, f: Fmt, items: Item[]) {
  const W = f.width - 2 * m.trim, L = f.length - 2 * m.trim;
  const packer = m.cutType === "free" ? maxRectsPacker(W, L, m.kerf) : guillotinePacker(W, L, m.kerf);
  const placements: Placement[] = [];
  const rest: Item[] = [];
  for (const it of items) {
    const p = packer.insert(it);
    if (p) placements.push(p); else rest.push(it);
  }
  return { placements, rest };
}

const placedArea = (ps: Placement[]) => ps.reduce((s, p) => s + p.w * p.h, 0);

function packAll(m: Material, fmts: Fmt[], items: Item[], opt: OptimizeOptions): RawSheet[] | null {
  const byPrice = opt.objective === "price" && fmts.every((f) => f.price != null);
  const sheets: RawSheet[] = [];
  let rest = items;
  while (rest.length) {
    let best: { fmt: Fmt; placements: Placement[]; rest: Item[]; score: number } | null = null;
    for (const f of fmts) {
      const r = fillSheet(m, f, rest);
      if (!r.placements.length) continue;
      const a = placedArea(r.placements);
      const score = byPrice ? f.price! / a : area(f) / a; // cout par mm² de piece
      if (!best || score < best.score) best = { fmt: f, ...r, score };
    }
    if (!best) return null;
    sheets.push({ fmt: best.fmt, placements: best.placements });
    rest = best.rest;
  }
  // essaie un format plus petit / moins cher pour le dernier panneau
  if (fmts.length > 1 && sheets.length) {
    const last = sheets.at(-1)!;
    const lastItems = last.placements.map((p) => items.find((i) => i.pieceId === p.pieceId && i.label === p.label)!);
    const cost = (f: Fmt) => (byPrice ? f.price! : area(f));
    for (const f of [...fmts].sort((a, b) => cost(a) - cost(b))) {
      if (cost(f) >= cost(last.fmt)) break;
      const r = fillSheet(m, f, lastItems);
      if (!r.rest.length) { sheets[sheets.length - 1] = { fmt: f, placements: r.placements }; break; }
    }
  }
  return sheets;
}

function solutionScore(sheets: RawSheet[], byPrice: boolean): number[] {
  const cost = sheets.reduce((s, x) => s + (byPrice ? x.fmt.price! : area(x.fmt)), 0);
  // a cout egal, preferer des panneaux tres remplis et un dernier panneau peu rempli
  const fill = sheets.reduce((s, x) => s + (placedArea(x.placements) / area(x.fmt)) ** 2, 0);
  return [cost, -fill];
}
const better = (a: number[], b: number[]) => a[0]! < b[0]! - 1e-9 || (Math.abs(a[0]! - b[0]!) <= 1e-9 && a[1]! < b[1]!);

const SORTS: ((a: Item, b: Item) => number)[] = [
  (a, b) => b.w * b.h - a.w * a.h,
  (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h),
  (a, b) => b.w - a.w,
  (a, b) => b.h - a.h,
];

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j]!, r[i]!]; }
  return r;
}

function finalizeSheets(m: Material, raw: RawSheet[]): SheetResult[] {
  const s = m.supply;
  const reuseMin = m.reuseMin ?? DEFAULT_REUSE_MIN;
  return raw.map((r, i) => {
    let fmt = r.fmt;
    if (s.mode === "fixedWidth") {
      const used = Math.max(0, ...r.placements.map((p) => p.y + p.h));
      const len = Math.min(s.maxLength, Math.max(s.minLength, Math.ceil((used + 2 * m.trim) / s.step) * s.step));
      fmt = { width: s.width, length: len };
    }
    const W = fmt.width - 2 * m.trim, L = fmt.length - 2 * m.trim;
    const occupied = r.placements.map((p) => ({ x: p.x, y: p.y, w: p.w + m.kerf, h: p.h + m.kerf }));
    const offcuts = freeRects(W, L, occupied).map((o) => ({ ...o, reusable: o.w >= reuseMin && o.h >= reuseMin }));
    const piecesArea = placedArea(r.placements);
    return {
      index: i + 1, width: fmt.width, length: fmt.length, usableW: W, usableL: L, price: fmt.price,
      placements: r.placements, offcuts, piecesArea, efficiency: piecesArea / area(fmt),
    };
  });
}

export function balanceOf(sheets: SheetResult[]): Balance {
  const b: Balance = { purchased: 0, pieces: 0, trim: 0, reusable: 0, losses: 0 };
  for (const s of sheets) {
    const purchased = s.width * s.length, usable = s.usableW * s.usableL;
    const reusable = s.offcuts.filter((o) => o.reusable).reduce((a, o) => a + o.w * o.h, 0);
    b.purchased += purchased;
    b.pieces += s.piecesArea;
    b.trim += purchased - usable;
    b.reusable += reusable;
    b.losses += usable - s.piecesArea - reusable;
  }
  return b;
}

export const addBalance = (a: Balance, b: Balance): Balance => ({
  purchased: a.purchased + b.purchased, pieces: a.pieces + b.pieces, trim: a.trim + b.trim,
  reusable: a.reusable + b.reusable, losses: a.losses + b.losses,
});

function optimizeMaterial(m: Material, pieces: Piece[], opt: OptimizeOptions, budgetMs: number): MaterialResult {
  const own = pieces.filter((p) => p.materialId === m.id);
  const unplaced: Unplaced[] = [];
  const items: Item[] = [];
  for (const p of own) {
    const err = validatePiece(p, [m]);
    if (err) { if (p.quantity > 0) unplaced.push({ pieceId: p.id, label: p.label, quantity: p.quantity, reason: err }); continue; }
    for (let i = 0; i < p.quantity; i++)
      items.push({ pieceId: p.id, label: p.label, w: p.width!, h: p.height!, canRotate: p.canRotate && !m.grainLocked });
  }
  // dans le mode catalogue, on ne garde que les formats valides
  const fmts = formatsOf(m).filter((f) => f.width > 2 * m.trim && f.length > 2 * m.trim);
  const byPrice = opt.objective === "price" && fmts.every((f) => f.price != null);

  let best: RawSheet[] | null = null;
  let bestScore: number[] = [];
  const consider = (order: Item[]) => {
    const sol = packAll(m, fmts, order, opt);
    if (!sol) return;
    const sc = solutionScore(sol, byPrice);
    if (!best || better(sc, bestScore)) { best = sol; bestScore = sc; }
  };
  if (items.length) {
    for (const s of SORTS) consider([...items].sort(s));
    if (opt.intensive) {
      const end = Date.now() + budgetMs;
      while (Date.now() < end) consider(shuffle(items));
    }
  }
  const raw: RawSheet[] = best ?? [];
  if (items.length && !best) unplaced.push(...own.map((p) => ({ pieceId: p.id, label: p.label, quantity: p.quantity, reason: "Aucun format utilisable" })));

  const sheets = finalizeSheets(m, raw);
  const formats: FormatCount[] = [];
  for (const s of sheets) {
    const f = formats.find((x) => x.width === s.width && x.length === s.length);
    if (f) f.count++; else formats.push({ width: s.width, length: s.length, count: 1, price: s.price });
  }
  const totalPrice = sheets.length && sheets.every((s) => s.price != null) ? sheets.reduce((a, s) => a + s.price!, 0) : sheets.length ? null : 0;
  const unplacedMap = new Map(unplaced.map((u) => [u.pieceId, u.quantity]));
  return {
    materialId: m.id, name: m.name, thickness: m.thickness, sheets, formats, totalPrice,
    balance: balanceOf(sheets), unplaced, errors: verifyMaterial(m, pieces, sheets, unplacedMap),
  };
}

export function optimize({ materials, pieces, options }: OptimizeRequest): OptimizeResult {
  const t0 = Date.now();
  const used = materials.filter((m) => pieces.some((p) => p.materialId === m.id));
  const budget = INTENSIVE_MS / Math.max(1, used.length);
  const results = used.map((m) => optimizeMaterial(m, pieces, options, budget));
  const orphan = pieces.filter((p) => !materials.some((m) => m.id === p.materialId));
  const zero: Balance = { purchased: 0, pieces: 0, trim: 0, reusable: 0, losses: 0 };
  return {
    materials: results,
    total: {
      sheets: results.reduce((a, r) => a + r.sheets.length, 0),
      totalPrice: results.some((r) => r.totalPrice === null) ? null : results.reduce((a, r) => a + (r.totalPrice ?? 0), 0),
      balance: results.reduce((a, r) => addBalance(a, r.balance), zero),
    },
    errors: [...results.flatMap((r) => r.errors), ...orphan.map((p) => `${p.label} : matériau inconnu`)],
    durationMs: Date.now() - t0,
  };
}
