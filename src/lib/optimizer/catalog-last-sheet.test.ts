import { describe, expect, it } from "vitest";
import { optimize } from "./engine";
import type { Material, Piece } from "../types";

// Avant : en mode catalogue, l'essai d'un format plus petit pour le dernier panneau
// reutilisait plusieurs fois le meme exemplaire de piece et faisait planter le moteur.
describe("catalogue : dernier panneau", () => {
  it("ne plante pas avec des pieces identiques placees en grille", () => {
    const material: Material = {
      id: "m", name: "KomaCel", thickness: 18, kerf: 4, trim: 10, grainLocked: false, cutType: "free", reuseMin: 300,
      supply: { mode: "catalog", formats: [{ id: "a", width: 1250, length: 2500 }, { id: "b", width: 2070, length: 2800 }] },
    };
    const dims = [[343, 1236, 7], [486, 698, 18], [266, 374, 18]] as const;
    const pieces: Piece[] = dims.map(([width, height, quantity], i) => ({
      id: `p${i}`, label: `P${i}`, materialId: "m", width, height, quantity, canRotate: true,
    }));
    const r = optimize({ materials: [material], pieces, options: { objective: "waste", intensive: false } });
    expect(r.errors).toEqual([]);
    const placed = r.materials[0]!.sheets.reduce((s, sh) => s + sh.placements.length, 0);
    expect(placed).toBe(7 + 18 + 18);
  });
});
