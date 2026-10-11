import { describe, expect, it } from "vitest";
import { lowerBound } from "./indicators";
import { panelGroup, panelOrder, positionPair, reuseCaption } from "./format";
import { optimize } from "./optimizer/engine";
import type { Material, Piece } from "./types";

const mat: Material = { id: "m", name: "MDF", thickness: 19, trim: 10, kerf: 4, grainLocked: false,
  cutType: "guillotine", supply: { mode: "single", width: 2070, length: 2800 } };
const piece: Piece = { id: "p", label: "A", materialId: "m", width: 300, height: 2500, quantity: 160, canRotate: true };

describe("borne minimale à orientation unique", () => {
  it("160 pièces MDF → borne 27, 27 panneaux, vérification intacte", () => {
    expect(lowerBound(mat, [piece])).toBe(27);
    const result = optimize({ materials: [mat], pieces: [piece], options: { objective: "waste", intensive: false } });
    expect(result.errors).toEqual([]);
    expect(result.total.sheets).toBe(27);
  });
  it("ne force pas la grille si les deux orientations sont possibles", () => {
    expect(lowerBound(mat, [{ ...piece, height: 500 }])).toBe(5);
    expect(lowerBound(mat, [{ ...piece, height: 500, canRotate: false }])).toBe(6);
  });
  it("accepte une orientation tournée seule et additionne les lignes identiques", () => {
    expect(lowerBound(mat, [{ ...piece, width: 2500, height: 300, quantity: 80 },
      { ...piece, id: "p2", width: 2500, height: 300, quantity: 80 }])).toBe(27);
  });
});

describe("libellés partagés", () => {
  it("commande et groupes lisibles", () => {
    expect(panelOrder(27, 2070, 2800, "MDF", 19)).toBe("27 panneaux de 2 070 × 2 800 mm - MDF 19 mm");
    expect(panelGroup(Array.from({ length: 26 }, (_, i) => i + 1))).toBe("Panneaux 1 à 26 - × 26");
    expect(panelGroup([7, 1, 3], false)).toBe("Panneaux 1, 3 et 7");
    expect(panelGroup([27])).toBe("Panneau 27");
    expect(positionPair(1530, 10)).toBe("1 530\u00a0/\u00a010");
    expect(["hide", "indicative", "retain"].map((m) => reuseCaption(m as "hide" | "indicative" | "retain")))
      .toEqual(["", "Réutilisables si besoin", "À conserver"]);
  });
});