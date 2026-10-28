// Analyse d'un panneau calcule pour l'affichage : panneaux identiques et sequence de coupe.
import { dims, num } from "./format";
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
    // Distance mesuree depuis le bord sur lequel on recale le morceau : le bord du panneau
    // pour la premiere coupe, sinon le bord coupe juste avant (le bord d'origine n'y est plus).
    const depuisPanneau = dir === "h" ? r.y0 === 0 : r.x0 === 0;
    const d = (dir === "h" ? c - r.y0 : c - r.x0) + (depuisPanneau ? trim : 0);
    const bord = dir === "h" ? (depuisPanneau ? "du bord haut" : "du bord coupé (haut)") : (depuisPanneau ? "du bord gauche" : "du bord coupé (gauche)");
    const where = `Coupe ${dir === "h" ? "horizontale" : "verticale"} à ${num(Math.round(d * 10) / 10, 1)} mm ${bord}`;
    cuts.push({
      n: cuts.length + 1, dir, pos: c,
      from: dir === "h" ? r.x0 : r.y0, to: dir === "h" ? r.x1 : r.y1,
      text: r.label ? `${r.label} : ${where.charAt(0).toLowerCase()}${where.slice(1)}` : where,
    });
    const a = ps.filter((p) => (dir === "h" ? p.y + p.h <= c! : p.x + p.w <= c!));
    const b = ps.filter((p) => !a.includes(p));
    // Taille reelle du morceau (delignage compris sur les bords du panneau)
    const taille = (q: Omit<Region, "label">) => dims(
      Math.round((q.x1 - q.x0 + (q.x0 === 0 ? trim : 0) + (q.x1 >= W ? trim : 0)) * 10) / 10,
      Math.round((q.y1 - q.y0 + (q.y0 === 0 ? trim : 0) + (q.y1 >= L ? trim : 0)) * 10) / 10,
    );
    const sur = (q: Omit<Region, "label">) => ({ ...q, label: `Sur le morceau de ${taille(q)} mm` });
    if (dir === "h") {
      walk(sur({ x0: r.x0, x1: r.x1, y0: r.y0, y1: c }), a);
      walk(sur({ x0: r.x0, x1: r.x1, y0: c + kerf, y1: r.y1 }), b);
    } else {
      walk(sur({ x0: r.x0, x1: c, y0: r.y0, y1: r.y1 }), a);
      walk(sur({ x0: c + kerf, x1: r.x1, y0: r.y0, y1: r.y1 }), b);
    }
  };
  walk({ x0: 0, y0: 0, x1: W, y1: L, label: null }, placements);
  return cuts;
}
