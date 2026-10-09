// Analyse d'un panneau calcule pour l'affichage : panneaux identiques et sequence de coupe.
// Ne modifie pas le moteur : tout est deduit des placements.
import type { Placement, SheetResult } from "./optimizer/types";

export interface SheetGroup { sheet: SheetResult; count: number; indexes: number[] }

export function groupSheets(sheets: SheetResult[]): SheetGroup[] {
  const map = new Map<string, SheetGroup>();
  for (const s of sheets) {
    const key = `${s.width}x${s.length}|` + s.placements
      .map((p) => `${p.pieceId}:${p.x},${p.y},${p.w},${p.h}`).sort().join(";");
    const g = map.get(key);
    if (g) { g.count++; g.indexes.push(s.index); } else map.set(key, { sheet: s, count: 1, indexes: [s.index] });
  }
  return [...map.values()];
}

export interface Cut {
  n: number;
  dir: "h" | "v";
  /** position du trait dans la zone utile (debut du trait de scie) */
  pos: number;
  /** segment couvert, coordonnees zone utile */
  from: number;
  to: number;
  text: string;
}

interface Region { x0: number; y0: number; x1: number; y1: number; label: string | null }

/**
 * Sequence de coupes traversantes (guillotine) : a chaque niveau on cherche une coupe
 * de bord a bord qui ne traverse aucune piece. Distances donnees depuis le bord brut.
 */
export function cutSequence(placements: Placement[], W: number, L: number, kerf: number, trim: number): Cut[] {
  const cuts: Cut[] = [];
  const walk = (r: Region, ps: Placement[]) => {
    if (!ps.length) return;
    const find = (dir: "h" | "v") => {
      const ends = [...new Set(ps.map((p) => (dir === "h" ? p.y + p.h : p.x + p.w)))].sort((a, b) => a - b);
      const lim = dir === "h" ? r.y1 : r.x1;
      return ends.find((c) => c < lim - 0.01 && ps.every((p) =>
        dir === "h" ? p.y + p.h <= c || p.y >= c : p.x + p.w <= c || p.x >= c));
    };
    let dir: "h" | "v" = "h";
    let c = find("h");
    if (c === undefined) { dir = "v"; c = find("v"); }
    if (c === undefined) return; // une seule piece aux dimensions de la region, ou disposition non guillotine
    const where = dir === "h" ? `Coupe horizontale à ${Math.round(c + trim)} mm du bord haut` : `Coupe verticale à ${Math.round(c + trim)} mm du bord gauche`;
    cuts.push({
      n: cuts.length + 1, dir, pos: c,
      from: dir === "h" ? r.x0 : r.y0, to: dir === "h" ? r.x1 : r.y1,
      text: r.label ? `${r.label} : ${where.charAt(0).toLowerCase()}${where.slice(1)}` : where,
    });
    const a = ps.filter((p) => (dir === "h" ? p.y + p.h <= c! : p.x + p.w <= c!));
    const b = ps.filter((p) => !a.includes(p));
    const t = (v: number) => Math.round(v + trim);
    if (dir === "h") {
      walk({ ...r, y1: c, label: `Sur la bande ${t(r.y0)}–${t(c)} mm (depuis le haut)` }, a);
      walk({ ...r, y0: c + kerf, label: `Sur la bande ${t(c + kerf)}–${t(Math.min(r.y1, L))} mm (depuis le haut)` }, b);
    } else {
      walk({ ...r, x1: c, label: `Sur la bande ${t(r.x0)}–${t(c)} mm (depuis la gauche)` }, a);
      walk({ ...r, x0: c + kerf, label: `Sur la bande ${t(c + kerf)}–${t(Math.min(r.x1, W))} mm (depuis la gauche)` }, b);
    }
  };
  walk({ x0: 0, y0: 0, x1: W, y1: L, label: null }, placements);
  return cuts;
}
