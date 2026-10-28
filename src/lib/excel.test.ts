import { describe, expect, it } from "vitest";
import { guessRoles, parseNumber, quantityError, rolesFitContent } from "./excel";
import { MIN_DIMENSION, materialProblems, validatePiece } from "./validation";
import { num } from "./format";
import { normalizeMaterial } from "./storage";
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

describe("collage Excel : quantités", () => {
  it("entier positif accepté", () => {
    expect(quantityError("3")).toBeNull();
    expect(quantityError("12 pces")).toBeNull();
  });
  it("vide, à virgule, nulle ou texte refusés", () => {
    expect(quantityError("")).toBe("quantité vide");
    expect(quantityError("2,5")).toBe("quantité non entière ou nulle");
    expect(quantityError("0")).toBe("quantité non entière ou nulle");
    expect(quantityError("abc")).toBe("quantité non numérique");
  });
});

describe("matériau avec champ vide (enregistré comme null)", () => {
  const mat = (patch: Partial<Material>): Material => ({ id: "m", name: "M", thickness: 10, kerf: 4, trim: 10, grainLocked: false,
    cutType: "free", supply: { mode: "single", width: 1250, length: 2500 }, ...patch } as Material);
  it("l'affichage d'un nombre absent ne plante plus", () => {
    expect(num(null as unknown as number, 1)).toBe("—");
    expect(num(Number.NaN)).toBe("—");
    expect(num(12.5, 1)).toBe("12,5");
  });
  it("épaisseur ou format vides : matériau signalé incomplet", () => {
    expect(materialProblems(mat({ thickness: null as unknown as number }))).toContain("épaisseur");
    expect(materialProblems(mat({ supply: { mode: "single", width: 1250, length: null as unknown as number } }))).toContain("format du panneau");
    expect(materialProblems(mat({}))).toEqual([]);
  });
  it("une pièce sur un matériau incomplet est bloquée avec un message clair", () => {
    const m = mat({ thickness: null as unknown as number });
    const p = { id: "p", label: "P", materialId: "m", width: 500, height: 500, quantity: 1, canRotate: true };
    expect(validatePiece(p, [m])).toContain("incomplet");
  });
  it("au chargement, trait de coupe et délignage vides repassent à 0", () => {
    const n = normalizeMaterial(mat({ kerf: null as unknown as number, trim: null as unknown as number }));
    expect([n.kerf, n.trim]).toEqual([0, 0]);
  });
});

describe("seuil de chute réutilisable", () => {
  const mat = (reuseMin: number): Material => ({ id: "m", name: "M", thickness: 10, kerf: 4, trim: 0, grainLocked: false, reuseMin,
    cutType: "free", supply: { mode: "single", width: 1250, length: 2500 } } as Material);
  it("0 mm est refusé dans la fenêtre matériau", () => {
    expect(materialProblems(mat(0)).join()).toContain("chute réutilisable");
    expect(materialProblems(mat(300))).toEqual([]);
  });
  it("au chargement, un seuil à 0 repasse au défaut (300 mm)", () => {
    expect(normalizeMaterial(mat(0)).reuseMin).toBeUndefined();
    expect(normalizeMaterial(mat(250)).reuseMin).toBe(250);
  });
});

describe("collage sans en-tete : colonnes devinees d'apres le contenu", () => {
  const rows = [["G1", "150", "120", "1"], ["G2", "247", "173", "2"]];
  it("dans l'onglet d'un materiau : Repere, Largeur, Hauteur, Quantite", () => {
    expect(guessRoles(rows, true)).toEqual(["label", "width", "height", "quantity"]);
  });
  it("liste multi-materiaux : la 2e colonne de texte devient le materiau", () => {
    expect(guessRoles([["A1", "MDF", "600", "400", "2"]], false)).toEqual(["label", "material", "width", "height", "quantity"]);
  });
  it("un ancien choix qui met du texte dans une cote est ecarte", () => {
    expect(rolesFitContent(["label", "material", "width", "height"], rows, true)).toBe(false);
    expect(rolesFitContent(["label", "width", "height", "quantity"], rows, true)).toBe(true);
  });
});
