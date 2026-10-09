import { describe, expect, it } from "vitest";
import { optimize } from "./engine";
import type { Material, Piece } from "../types";

describe("moteur amélioré", () => {
  it("300 pièces 75 × 100 sur 1200 × 600 CNC → 4 panneaux", () => {
    const m = { id: "c", name: "CNC", thickness: 3, kerf: 4, trim: 10, grainLocked: false, cutType: "free",
      supply: { mode: "single", width: 1200, length: 600 } } as unknown as Material;
    const p = { id: "p", label: "A", materialId: "c", width: 75, height: 100, quantity: 300, canRotate: true } as Piece;
    const r = optimize({ materials: [m], pieces: [p], options: { objective: "waste", intensive: false } });
    expect(r.errors).toEqual([]);
    expect(r.total.sheets).toBe(4);
    expect(Math.max(...r.materials[0]!.sheets.map((s) => s.placements.length))).toBeGreaterThanOrEqual(77);
    expect(r.materials[0]!.solutions.filter((s) => s.chosen)).toHaveLength(1);
  });
});
