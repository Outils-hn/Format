// Moteur d'optimisation 2D — materiau par materiau. Code pur, execute dans un Web Worker.
import type { Material, Piece } from "../types";
import { validatePiece } from "../validation";
import { freeRects, guillotinePacker, maxRectsPacker, workMeter, type GuillotineFit, type GuillotineSplit, type MaxRectsFit } from "./packers";
import type {
  Balance, FormatCount, Item, MaterialResult, OptimizeOptions, OptimizeRequest, OptimizeResult,
  Objective, Placement, Rect, SheetResult, SolutionSummary, Unplaced,
} from "./types";
import { verifyMaterial } from "./verify";
import { lowerBound } from "../indicators";

export const DEFAULT_REUSE_MIN = 300;
const INTENSIVE_MS = 2000;
/** Budget de travail du mode intensif (evaluations de placement), calibre pour environ 2 s. */
export const INTENSIVE_WORK = 120_000_000;
/** Plafond d'essais : borne aussi les petits cas, ou le travail compte peu. */
const INTENSIVE_MAX_TRIES = 15_000;

export interface Fmt { width: number; length: number; price?: number | undefined }
export interface RawSheet { fmt: Fmt; placements: Placement[] }

const area = (f: { width: number; length: number }) => f.width * f.length;

function formatsOf(m: Material): Fmt[] {
  const s = m.supply;
  if (s.mode === "single") return [{ width: s.width, length: s.length }];
  if (s.mode === "catalog") return s.formats.map((f) => ({ width: f.width, length: f.length, price: f.price }));
  return [{ width: s.width, length: s.maxLength }];
}

type Cfg =
  | { kind: "guillotine"; fit: GuillotineFit; split: GuillotineSplit; blocks: boolean }
  | { kind: "free"; fit: MaxRectsFit; blocks: boolean };

const FIT_LABEL: Record<string, string> = { bssf: "Best Short Side Fit", baf: "Best Area Fit", bl: "Bottom-Left", cp: "Contact Point" };
const cfgLabel = (c: Cfg) =>
  (c.kind === "guillotine"
    ? `Guillotine · ${FIT_LABEL[c.fit]} · ${c.split === "short" ? "Shorter" : "Longer"} Leftover Axis`
    : `MaxRects · ${FIT_LABEL[c.fit]}`) + (c.blocks ? " + blocs en grille" : "");

interface Block { x: number; y: number; cols: number; rows: number; w: number; h: number; rotated: boolean }
interface Pattern { count: number; blocks: Block[]; free: Rect[] }

/**
 * Meilleur motif en grille pour des pieces identiques dans un bac BW x BH (trait inclus) :
 * grille simple dans chaque sens, ou deux blocs (un bloc + un bloc tourne dans la bande restante).
 * La premiere coupe separe les deux blocs de bord a bord : compatible guillotine.
 */
function bestPattern(it: Item, BW: number, BH: number, k: number): Pattern | null {
  const f = !!it.flip;
  const os: [number, number, boolean][] = [[it.w, it.h, f]];
  if (it.canRotate && it.w !== it.h) os.push([it.h, it.w, !f]);
  let best: Pattern | null = null;
  const consider = (p: Pattern) => { if (p.count > 0 && (!best || p.count > best.count)) best = p; };
  for (let i = 0; i < os.length; i++) {
    const A = os[i]!, B = os[(i + 1) % os.length]!;
    const aw = A[0] + k, ah = A[1] + k, bw = B[0] + k, bh = B[1] + k;
    // bande verticale : bloc A a gauche, bloc B a droite
    const colsA = Math.floor(BW / aw), rowsA = Math.floor(BH / ah);
    for (let c1 = 1; c1 <= colsA && rowsA > 0; c1++) {
      const w1 = c1 * aw, h1 = rowsA * ah;
      const c2 = os.length > 1 ? Math.floor((BW - w1) / bw) : 0, r2 = c2 ? Math.floor(BH / bh) : 0;
      const w2 = r2 ? c2 * bw : 0, h2 = r2 * bh;
      const blocks: Block[] = [{ x: 0, y: 0, cols: c1, rows: rowsA, w: A[0], h: A[1], rotated: A[2] }];
      if (r2) blocks.push({ x: w1, y: 0, cols: c2, rows: r2, w: B[0], h: B[1], rotated: B[2] });
      const free = [
        { x: 0, y: h1, w: w1, h: BH - h1 },
        { x: w1, y: h2, w: w2, h: BH - h2 },
        { x: w1 + w2, y: 0, w: BW - w1 - w2, h: BH },
      ].filter((r) => r.w > 0 && r.h > 0);
      consider({ count: c1 * rowsA + c2 * r2, blocks, free });
    }
    // bande horizontale : bloc A en haut, bloc B en dessous
    for (let r1 = 1; r1 <= rowsA && colsA > 0; r1++) {
      const h1 = r1 * ah, w1 = colsA * aw;
      const r2 = os.length > 1 ? Math.floor((BH - h1) / bh) : 0, c2 = r2 ? Math.floor(BW / bw) : 0;
      const h2 = c2 ? r2 * bh : 0, w2 = c2 * bw;
      const blocks: Block[] = [{ x: 0, y: 0, cols: colsA, rows: r1, w: A[0], h: A[1], rotated: A[2] }];
      if (c2) blocks.push({ x: 0, y: h1, cols: c2, rows: r2, w: B[0], h: B[1], rotated: B[2] });
      const free = [
        { x: w1, y: 0, w: BW - w1, h: h1 },
        { x: w2, y: h1, w: BW - w2, h: h2 },
        { x: 0, y: h1 + h2, w: BW, h: BH - h1 - h2 },
      ].filter((r) => r.w > 0 && r.h > 0);
      consider({ count: colsA * r1 + c2 * r2, blocks, free });
    }
  }
  return best;
}

/** Remplit un panneau avec les items dans l'ordre donne ; renvoie placements et items restants. */
function fillSheet(m: Material, f: Fmt, items: Item[], cfg: Cfg) {
  const W = f.width - 2 * m.trim, L = f.length - 2 * m.trim, k = m.kerf;
  workMeter.units += 30 * items.length; // regroupement et preparation du panneau
  const placements: Placement[] = [];
  let todo = items;
  let initFree: Rect[] | undefined;
  const used: Rect[] = [];
  if (cfg.blocks) {
    // groupe de pieces identiques remplissant le plus de surface avec un motif complet
    const groups = new Map<string, Item[]>();
    for (const it of items) {
      const key = `${it.w}x${it.h}|${it.canRotate}|${!!it.flip}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
    }
    let pick: { g: Item[]; p: Pattern; score: number } | null = null;
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const p = bestPattern(g[0]!, W + k, L + k, k);
      if (!p || p.count < 2 || p.count > g.length) continue;
      const score = p.count * g[0]!.w * g[0]!.h;
      if (!pick || score > pick.score) pick = { g, p, score };
    }
    if (pick) {
      const take = new Set(pick.g.slice(0, pick.p.count));
      const queue = [...take];
      for (const b of pick.p.blocks)
        for (let r = 0; r < b.rows; r++)
          for (let c = 0; c < b.cols; c++) {
            const it = queue.shift()!;
            placements.push({ x: b.x + c * (b.w + k), y: b.y + r * (b.h + k), w: b.w, h: b.h, pieceId: it.pieceId, label: it.label, rotated: b.rotated });
          }
      for (const b of pick.p.blocks) used.push({ x: b.x, y: b.y, w: b.cols * (b.w + k), h: b.rows * (b.h + k) });
      initFree = pick.p.free;
      todo = items.filter((it) => !take.has(it));
    }
  }
  const packer = cfg.kind === "free"
    ? maxRectsPacker(W, L, k, cfg.fit, initFree, used)
    : guillotinePacker(W, L, k, cfg.fit, cfg.split, initFree);
  const rest: Item[] = [];
  for (const it of todo) {
    const p = packer.insert(it);
    if (p) placements.push(p); else rest.push(it);
  }
  return { placements, rest };
}

const placedArea = (ps: Placement[]) => ps.reduce((s, p) => s + p.w * p.h, 0);

/** Format reellement achete (longueur raccourcie en mode longueur a la demande). */
function boughtFmt(m: Material, r: RawSheet): Fmt {
  const s = m.supply;
  if (s.mode !== "fixedWidth") return r.fmt;
  const used = Math.max(0, ...r.placements.map((p) => p.y + p.h));
  const len = Math.min(s.maxLength, Math.max(s.minLength, Math.ceil((used + 2 * m.trim) / s.step) * s.step));
  return { width: s.width, length: len };
}

function packAll(m: Material, fmts: Fmt[], items: Item[], byPrice: boolean, cfg: Cfg): RawSheet[] | null {
  const sheets: RawSheet[] = [];
  let rest = items;
  while (rest.length) {
    let best: { fmt: Fmt; placements: Placement[]; rest: Item[]; score: number } | null = null;
    for (const f of fmts) {
      const r = fillSheet(m, f, rest, cfg);
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
    // Retrouve les exemplaires reellement places sur ce panneau, sans reutiliser deux fois le meme :
    // des doublons du meme objet faussaient le placement en grille (plantage).
    const pool = [...items];
    const lastItems = last.placements.map((p) => {
      const i = pool.findIndex((it) => it.pieceId === p.pieceId && it.label === p.label);
      return pool.splice(i, 1)[0]!;
    });
    const cost = (f: Fmt) => (byPrice ? f.price! : area(f));
    for (const f of [...fmts].sort((a, b) => cost(a) - cost(b))) {
      if (cost(f) >= cost(last.fmt)) break;
      const r = fillSheet(m, f, lastItems, cfg);
      if (!r.rest.length) { sheets[sheets.length - 1] = { fmt: f, placements: r.placements }; break; }
    }
  }
  return sheets;
}

function solutionScore(m: Material, sheets: RawSheet[], objective: Objective, byPrice: boolean): number[] {
  const bought = sheets.map((x) => boughtFmt(m, x));
  const surface = bought.reduce((s, f) => s + area(f), 0);
  const price = byPrice ? bought.reduce((s, f) => s + (f.price ?? 0), 0) : surface;
  // a cout egal, preferer des panneaux tres remplis et un dernier panneau peu rempli
  const fill = sheets.reduce((s, x, i) => s + (placedArea(x.placements) / area(bought[i]!)) ** 2, 0);
  if (objective === "sheets") return [sheets.length, surface, -fill];
  if (objective === "price" && byPrice) return [price, sheets.length, -fill];
  return [surface, sheets.length, -fill];
}
const better = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! < b[i]! - 1e-9) return true;
    if (a[i]! > b[i]! + 1e-9) return false;
  }
  return false;
};

const SORTS: ((a: Item, b: Item) => number)[] = [
  (a, b) => b.w * b.h - a.w * a.h,
  (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h),
  (a, b) => b.w - a.w,
  (a, b) => b.h - a.h,
];

/** Variantes d'orientation : libre, pivotables forcees tournees, aucune rotation. */
function orientationVariants(items: Item[]): Item[][] {
  if (!items.some((i) => i.canRotate)) return [items];
  return [
    items,
    items.map((i) => (i.canRotate ? { ...i, w: i.h, h: i.w, canRotate: false, flip: true } : i)),
    items.map((i) => ({ ...i, canRotate: false })),
  ];
}

function shuffle<T>(a: T[], rnd: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j]!, r[i]!]; }
  return r;
}

/** Generateur pseudo-aleatoire a graine fixe (mulberry32) : memes donnees => meme resultat. */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graine derivee des pieces et des reglages du materiau. */
function seedOf(m: Material, items: Item[]): number {
  let h = 2166136261;
  const mix = (n: number) => { h = Math.imul(h ^ (Math.round(n) | 0), 16777619); };
  for (const it of items) { mix(it.w); mix(it.h); mix(it.canRotate ? 1 : 0); }
  mix(m.kerf); mix(m.trim);
  return h >>> 0;
}


/**
 * Panneaux au contenu identique (meme format, memes pieces dans la meme orientation) mais
 * places dans un ordre different : on leur donne a tous la disposition du premier.
 * Le nombre de panneaux et les pieces ne changent pas ; ils deviennent seulement
 * regroupables a l'ecran et dans le PDF (« Panneaux 1 a 75 ») au lieu d'apparaitre en
 * plusieurs dessins differents pour le meme debit.
 */
export function unifyIdenticalSheets(raw: RawSheet[]): RawSheet[] {
  const firstByContent = new Map<string, RawSheet>();
  return raw.map((r) => {
    const key = `${r.fmt.width}x${r.fmt.length}|` + r.placements
      .map((p) => `${p.pieceId}:${p.w}x${p.h}:${p.rotated ? 1 : 0}`).sort().join(";");
    const first = firstByContent.get(key);
    if (!first) { firstByContent.set(key, r); return r; }
    return { fmt: r.fmt, placements: first.placements.map((p) => ({ ...p })) };
  });
}

function finalizeSheets(m: Material, raw: RawSheet[]): SheetResult[] {
  const reuseMin = m.reuseMin ?? DEFAULT_REUSE_MIN;
  return unifyIdenticalSheets(raw).map((r, i) => {
    const fmt = boughtFmt(m, r);
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

function countFormats(sheets: { width: number; length: number; price?: number | undefined }[]): FormatCount[] {
  const formats: FormatCount[] = [];
  for (const s of sheets) {
    const f = formats.find((x) => x.width === s.width && x.length === s.length);
    if (f) f.count++; else formats.push({ width: s.width, length: s.length, count: 1, price: s.price });
  }
  return formats;
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

function optimizeMaterial(m: Material, pieces: Piece[], opt: OptimizeOptions, budgetMs: number, budgetWork: number): MaterialResult {
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

  // strategies de formats : panneau par panneau, puis "uniquement ce format" pour chaque format
  const strategies: { label: string; fmts: Fmt[] }[] = [];
  if (m.supply.mode === "catalog" && fmts.length > 1) {
    strategies.push({ label: "Panneau par panneau (formats mixtes)", fmts });
    for (const f of fmts) strategies.push({ label: `Uniquement ${f.width} × ${f.length}`, fmts: [f] });
  } else if (fmts.length) strategies.push({ label: "", fmts });

  const hasGroups = (() => {
    const seen = new Set<string>();
    for (const it of items) { const key = `${it.w}x${it.h}`; if (seen.has(key)) return true; seen.add(key); }
    return false;
  })();
  const cfgs: Cfg[] = [];
  for (const blocks of hasGroups ? [false, true] : [false]) {
    if (m.cutType === "free") for (const fit of ["bssf", "baf", "bl", "cp"] as const) cfgs.push({ kind: "free", fit, blocks });
    else for (const fit of ["bssf", "baf"] as const) for (const split of ["short", "long"] as const) cfgs.push({ kind: "guillotine", fit, split, blocks });
  }

  let best: RawSheet[] | null = null;
  let bestScore: number[] = [];
  const perKey = new Map<string, { sol: RawSheet[]; score: number[] }>();
  const consider = (key: string, sf: Fmt[], order: Item[], cfg: Cfg) => {
    workMeter.units += 60 * order.length; // cout fixe d'un essai (tri, score, blocs)
    const sol = packAll(m, sf, order, byPrice, cfg);
    if (!sol) return;
    const sc = solutionScore(m, sol, opt.objective, byPrice);
    const prev = perKey.get(key);
    if (!prev || better(sc, prev.score)) perKey.set(key, { sol, score: sc });
    if (!best || better(sc, bestScore)) { best = sol; bestScore = sc; }
  };
  const keyOf = (s: { label: string }, cfg: Cfg) => s.label || cfgLabel(cfg);
  const variants = orientationVariants(items);
  if (items.length) {
    for (const s of strategies)
      for (const cfg of cfgs)
        for (const v of variants)
          for (const sort of SORTS) consider(keyOf(s, cfg), s.fmts, [...v].sort(sort), cfg);
    // Recherche approfondie automatique, sauf si le resultat atteint deja la borne theorique
    // (impossible de faire moins de panneaux en format unique).
    const lb = lowerBound(m, own);
    const alreadyOptimal = lb != null && best != null && (best as RawSheet[]).length <= lb;
    if (opt.intensive && strategies.length && !alreadyOptimal) {
      // Budget de travail fixe + graine fixe : le meme projet donne toujours le meme resultat.
      // Le delai ne sert que de garde-fou sur une machine tres lente.
      const rnd = seededRandom(seedOf(m, items));
      const end = Date.now() + 3 * budgetMs;
      const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
      const start = workMeter.units;
      for (let t = 0; t < INTENSIVE_MAX_TRIES && workMeter.units - start < budgetWork && Date.now() < end; t++) {
        const s = pick(strategies), cfg = pick(cfgs);
        consider(keyOf(s, cfg), s.fmts, shuffle(pick(variants), rnd), cfg);
      }
    }
  }
  const raw: RawSheet[] = best ?? [];
  if (items.length && !best) unplaced.push(...own.map((p) => ({ pieceId: p.id, label: p.label, quantity: p.quantity, reason: "Aucun format utilisable" })));

  const solutions: SolutionSummary[] = [...perKey.entries()].map(([label, { sol }]) => {
    const bought = sol.map((r) => boughtFmt(m, r));
    return {
      label, formats: countFormats(bought), sheets: sol.length,
      purchased: bought.reduce((s, f) => s + area(f), 0),
      price: bought.every((f) => f.price != null) ? bought.reduce((s, f) => s + f.price!, 0) : null,
      unplaced: 0, chosen: sol === best,
    };
  });

  const sheets = finalizeSheets(m, raw);
  const formats = countFormats(sheets);
  const totalPrice = sheets.length && sheets.every((s) => s.price != null) ? sheets.reduce((a, s) => a + s.price!, 0) : sheets.length ? null : 0;
  const unplacedMap = new Map(unplaced.map((u) => [u.pieceId, u.quantity]));
  return {
    materialId: m.id, name: m.name, thickness: m.thickness, sheets, formats, totalPrice,
    balance: balanceOf(sheets), unplaced, errors: verifyMaterial(m, pieces, sheets, unplacedMap), solutions,
  };
}

export function optimize({ materials, pieces, options }: OptimizeRequest): OptimizeResult {
  const t0 = Date.now();
  const used = materials.filter((m) => pieces.some((p) => p.materialId === m.id));
  const budget = INTENSIVE_MS / Math.max(1, used.length);
  const work = INTENSIVE_WORK / Math.max(1, used.length);
  const results = used.map((m) => optimizeMaterial(m, pieces, options, budget, work));
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
