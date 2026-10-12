import { describe, expect, it } from "vitest";
import { optimize } from "./engine";
import { verifyMaterial } from "./verify";
import type { Material, Piece } from "../types";

const material: Material = {
  id: "m", name: "MDF", thickness: 19, kerf: 4, trim: 10, grainLocked: false, cutType: "free", reuseMin: 300,
  supply: { mode: "catalog", formats: [{ id: "a", width: 1250, length: 2500 }, { id: "b", width: 2070, length: 2800 }] },
};
const pieces: Piece[] = [
  { id: "a", label: "A", materialId: "m", width: 333, height: 777, quantity: 23, canRotate: true },
  { id: "b", label: "B", materialId: "m", width: 512, height: 401, quantity: 17, canRotate: true },
];

describe("optimisation intensive", () => {
  it("donne exactement le meme resultat a chaque calcul", () => {
    const run = () => optimize({ materials: [material], pieces, options: { objective: "waste", intensive: true } });
    const a = run(), b = run();
    expect(a.errors).toEqual([]);
    expect(JSON.stringify(b.materials[0]!.sheets)).toBe(JSON.stringify(a.materials[0]!.sheets));
  });
});

describe("verification", () => {
  it("signale une piece posee a de mauvaises dimensions", () => {
    const r = optimize({ materials: [material], pieces, options: { objective: "waste", intensive: false } });
    const sheets = structuredClone(r.materials[0]!.sheets);
    sheets[0]!.placements[0]!.w += 10;
    const errs = verifyMaterial(material, pieces, sheets, new Map());
    expect(errs.some((e) => e.includes("posée en"))).toBe(true);
  });
});
