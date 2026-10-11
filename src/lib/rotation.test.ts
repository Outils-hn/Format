import { describe, expect, it } from "vitest";
import { newPiece } from "./defaults";
import { sampleMaterials } from "@/test/fixtures";
import { mergeDuplicates, rowsToPieces } from "./excel";
import { allowRotation, rotationCandidates, rotationSavings } from "./rotation";
import { optimize } from "./optimizer/engine";
import type { Material, Piece } from "./types";

const material: Material = {
  id: "m1", name: "Test", thickness: 19, kerf: 0, trim: 0,
  grainLocked: false, cutType: "free", supply: { mode: "single", width: 1000, length: 600 },
};
const piece: Piece = { id: "p1", label: "Étagère", materialId: "m1", width: 600, height: 400, quantity: 2, canRotate: false };

describe("Rotation corrections", () => {
  it("defaults manual and pasted pieces to rotation unless grain locked", () => {
    expect(newPiece("m1", 1).canRotate).toBe(true);
    expect(newPiece("m1", 1, true).canRotate).toBe(false);
    const materials = sampleMaterials();
    const pieces = rowsToPieces([["A", "MDF", "600", "400", "2"], ["B", "Mélamine chêne", "600", "400", "2"]],
      ["label", "material", "width", "height", "quantity"], materials, materials[0]?.id ?? "", {});
    expect(pieces.map((p) => p.canRotate)).toEqual([true, false]);
  });

  it("does not lose the rotation default when pasted pieces match restricted pieces", () => {
    expect(mergeDuplicates([piece, { ...piece, id: "p2", canRotate: true }])).toHaveLength(2);
  });

  it("only relaxes restrictions for known materials without imposed grain", () => {
    const pieces = [piece, { ...piece, id: "locked", materialId: "locked" }, { ...piece, id: "unknown", materialId: "missing" }];
    const materials = [material, { ...material, id: "locked", grainLocked: true }];
    const ids = rotationCandidates(pieces, materials).map((p) => p.id);
    expect(ids).toEqual(["p1"]);
    expect(allowRotation(pieces, ids).map((p) => p.canRotate)).toEqual([true, false, false]);
    expect(piece.canRotate).toBe(false);
  });

  it("finds one panel saved using the unchanged engine", () => {
    const options = { objective: "waste" as const, intensive: false };
    const baseline = optimize({ materials: [material], pieces: [piece], options });
    const alternative = optimize({ materials: [material], pieces: allowRotation([piece], [piece.id]), options });
    expect(baseline.total.sheets).toBe(2);
    expect(alternative.total.sheets).toBe(1);
    expect(rotationSavings(baseline, alternative)).toBe(1);
    expect(rotationSavings(baseline, { ...alternative, errors: ["Invalid"] })).toBe(0);
    const incomplete = { ...alternative, materials: alternative.materials.map((m) => ({ ...m, unplaced: [{ pieceId: piece.id, label: piece.label, quantity: 1, reason: "Missing" }] })) };
    expect(rotationSavings(baseline, incomplete)).toBe(0);
  });
});