import { describe, expect, it } from "vitest";
import { optimize, unifyIdenticalSheets } from "./engine";
import { linearPieces } from "../linear";
import { groupSheets } from "../cutplan";
import type { Linear, Material } from "../types";

// Cas reel : bandes de 361 et 133 mm en fibres-gypse, catalogue de formats, CNC
const formats = [[1250, 1000], [1500, 1000], [2000, 1250], [2500, 1250], [2540, 1250], [2750, 1250], [3000, 1250]]
  .map(([length, width], i) => ({ id: `f${i}`, width: width!, length: length! }));
const mat: Material = { id: "fg", name: "Fibres-Gypse", thickness: 15, kerf: 4, trim: 0, grainLocked: false,
  cutType: "free", supply: { mode: "catalog", formats } };
const bande = (id: string, bandWidth: number): Linear => ({ id, label: id, materialId: "fg", bandWidth, totalLength: 208.736,
  mode: "fixed", segment: 1250, min: 0, max: null, multiple: null });
const contenu = (s: { width: number; length: number; placements: { pieceId: string; w: number; h: number; rotated: boolean }[] }) =>
  `${s.width}x${s.length}|` + s.placements.map((p) => `${p.pieceId}:${p.w}x${p.h}:${p.rotated ? 1 : 0}`).sort().join(";");

describe("panneaux au contenu identique", () => {
  it("memes pieces dans un ordre different : meme disposition, donc un seul dessin", () => {
    const fmt = { width: 1000, length: 1250 };
    const a = { pieceId: "A", label: "A", w: 1250, h: 361, rotated: false };
    const b = { pieceId: "B", label: "B", w: 1250, h: 133, rotated: false };
    const s1 = { fmt, placements: [{ ...a, x: 0, y: 0 }, { ...b, x: 0, y: 365 }] };
    const s2 = { fmt, placements: [{ ...b, x: 0, y: 0 }, { ...a, x: 0, y: 137 }] };
    const [u1, u2] = unifyIdenticalSheets([s1, s2]);
    expect(u2!.placements).toEqual(u1!.placements);
  });
  it("cas reel : autant de dessins que de contenus differents, sans erreur", () => {
    const pieces = linearPieces([bande("L3", 361), bande("L4", 133)], [mat]);
    const r = optimize({ materials: [mat], pieces, options: { objective: "waste", intensive: true } });
    const sheets = r.materials[0]!.sheets;
    expect(r.errors).toEqual([]);
    expect(groupSheets(sheets).length).toBe(new Set(sheets.map(contenu)).size);
  });
});

describe("un seul format sauf si melanger fait vraiment gagner", () => {
  const run = (m: Material) => optimize({ materials: [m], pieces: linearPieces([bande("L3", 361), bande("L4", 133)], [m]),
    options: { objective: "waste", intensive: true } }).materials[0]!;
  it("cas reel : le melange ne gagne que ~0,3 % -> un seul format (1250 x 1000)", () => {
    const r = run(mat);
    expect(r.errors).toEqual([]);
    expect(r.formats).toHaveLength(1);
    expect(r.formatChoice?.kept).toBe("single");
    expect(r.formatChoice!.gainPct).toBeLessThan(3);
  });
  it("seuil a 0 % : le melange le moins cher en matiere est garde", () => {
    const r = run({ ...mat, mixMinGain: 0 });
    expect(r.formats.length).toBeGreaterThan(1);
    expect(r.formatChoice?.kept).toBe("mixed");
  });
});
