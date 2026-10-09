import { describe, expect, it } from "vitest";
import { linearPieces, linearSegments } from "./linear";
import { optimize } from "./optimizer/engine";
import type { Linear, Material } from "./types";

const mat: Material = { id: "pl", name: "Plâtre", thickness: 13, kerf: 0, trim: 0, grainLocked: false, cutType: "guillotine", supply: { mode: "single", width: 1250, length: 2500 } };
const base: Linear = { id: "a", label: "L1", materialId: "pl", bandWidth: 366, totalLength: 400, mode: "fixed", segment: 2025, min: 500, max: 2500, multiple: null };
const sum = (s: { length: number; count: number }[]) => s.reduce((a, x) => a + x.length * x.count, 0);

describe("linéaires", () => {
  it("mode fixe : 197 × 2025 + 1 × 1075, 66 plaques", () => {
    const s = linearSegments(base, [mat]);
    expect(s).toEqual([{ length: 2025, count: 197 }, { length: 1075, count: 1 }]);
    const r = optimize({ materials: [mat], pieces: linearPieces([base], [mat]), options: { objective: "waste", intensive: false } });
    expect(r.errors).toEqual([]);
    expect(r.materials[0]!.sheets.length).toBe(66);
  });
  it("raboutage : somme exacte, 54 plaques", () => {
    const l = { ...base, mode: "joined" as const };
    const s = linearSegments(l, [mat]) as { length: number; count: number }[];
    expect(sum(s)).toBe(400000);
    const r = optimize({ materials: [mat], pieces: linearPieces([l], [mat]), options: { objective: "waste", intensive: false } });
    expect(r.materials[0]!.sheets.length).toBe(54);
  });
  it("reste trop court rééquilibré avec multiple", () => {
    const s = linearSegments({ ...base, mode: "joined", totalLength: 5.1, multiple: 600 }, [mat]) as { length: number; count: number }[];
    expect(sum(s)).toBe(5100);
    expect(s.every((x) => x.length >= 500 && x.length <= 2500)).toBe(true);
  });
});
