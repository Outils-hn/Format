import { describe, expect, it } from "vitest";
import { compactOrigins, defaultOffcutSettings, labeledOffcuts, retainedOffcuts } from "./offcuts";
import type { OptimizeResult, SheetResult } from "./optimizer/types";

const sheet: SheetResult = {
  index: 1, width: 1200, length: 600, usableW: 1180, usableL: 580,
  placements: [], piecesArea: 0, efficiency: 0,
  offcuts: [
    { x: 500, y: 100, w: 400, h: 350, reusable: true },
    { x: 0, y: 0, w: 10, h: 580, reusable: false },
  ],
};
describe("offcut presentation", () => {
  it("numbers every positive offcut in drawing order without mutating results", () => {
    expect(labeledOffcuts(sheet).map((o) => [o.label, o.reusable])).toEqual([["C1", false], ["C2", true]]);
    expect(sheet.offcuts[0]?.x).toBe(500);
  });
  it("counts identical real panels and preserves material and label origins", () => {
    const balance = { purchased: 0, pieces: 0, trim: 0, reusable: 0, losses: 0 };
    const result: OptimizeResult = {
      durationMs: 0, errors: [], total: { sheets: 2, totalPrice: null, balance },
      materials: [{ materialId: "m", name: "MDF", thickness: 19,
        sheets: [sheet, { ...sheet, index: 2 }], formats: [], totalPrice: null,
        balance, unplaced: [], errors: [], solutions: [] }],
    };
    expect(retainedOffcuts(result)).toEqual([{
      materialId: "m", material: "MDF", thickness: 19, w: 400, h: 350,
      quantity: 2, origins: ["P1 / C2", "P2 / C2"], notes: [],
    }]);
  });
});
describe("origines des chutes compactées (PDF)", () => {
  it("96 panneaux à la suite : une seule plage", () => {
    expect(compactOrigins(Array.from({ length: 96 }, (_, i) => `P${i + 1} / C1`))).toBe("P1 à P96 / C1");
  });
  it("repères différents, paires et trous", () => {
    expect(compactOrigins(["P101 / C1", "P102 / C1", "P103 / C2", "P104 / C2", "P5 / C1"])).toBe("P5, P101 et P102 / C1 · P103 et P104 / C2");
    expect(compactOrigins(["P3 / C1"])).toBe("P3 / C1");
  });
});

describe("chutes dans le PDF : réglage par défaut", () => {
  it("tout débité par le fournisseur : chutes masquées", () => {
    expect(defaultOffcutSettings(["cut"]).mode).toBe("hide");
    expect(defaultOffcutSettings(["cut", "cut"]).mode).toBe("hide");
  });
  it("panneaux entiers (même un seul matériau) ou projet vide : indicatif comme avant", () => {
    expect(defaultOffcutSettings(["cut", "panels"]).mode).toBe("indicative");
    expect(defaultOffcutSettings(["panels"]).mode).toBe("indicative");
    expect(defaultOffcutSettings([]).mode).toBe("indicative");
  });
});
