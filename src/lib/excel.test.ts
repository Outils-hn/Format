import { describe, expect, it } from "vitest";
import { parseNumber } from "./excel";
import { MIN_DIMENSION, validatePiece } from "./validation";
import type { Material, Piece } from "./types";

describe("collage Excel : separateurs de milliers", () => {
  it("apostrophes suisses et espaces", () => {
    for (const s of ["1'250", "1’250", "1‘250", "1 250", "1 250", "1 250"]) expect(parseNumber(s)).toBe(1250);
  });
  it("virgule decimale et unites conservees", () => {
    expect(parseNumber("1250,5")).toBe(1250.5);
    expect(parseNumber("2.45 m")).toBe(2450);
    expect(parseNumber("12'500 mm")).toBe(12500);
  });
});

describe("dimension suspecte", () => {
  const m = { id: "m", name: "M", thickness: 10, kerf: 4, trim: 10, grainLocked: false, cutType: "free",
    supply: { mode: "single", width: 1250, length: 2500 } } as Material;
  const piece = (width: number, height: number): Piece =>
    ({ id: "p", label: "P", materialId: "m", width, height, quantity: 1, canRotate: true });
  it("une cote sous 10 mm est signalee", () => {
    expect(validatePiece(piece(1, 500), [m])).toContain("suspecte");
    expect(validatePiece(piece(500, MIN_DIMENSION - 1), [m])).toContain("suspecte");
  });
  it("une piece normale reste valide", () => {
    expect(validatePiece(piece(MIN_DIMENSION, 500), [m])).toBeNull();
  });
});
