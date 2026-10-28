import { describe, expect, it } from "vitest";
import { estTableur, lignesEnTexte } from "./lire-fichier-tableur";

describe("import d'un fichier Excel", () => {
  it("les lignes deviennent un texte tabule comme un copier-coller", () => {
    expect(lignesEnTexte([["Repère", "Largeur", "Hauteur", "Qté"], ["P1", 2010, 382, 24], ["", "", "", ""], ["P2", 1652.5, 237, 8, "", ""]]))
      .toBe("Repère\tLargeur\tHauteur\tQté\nP1\t2010\t382\t24\nP2\t1652,5\t237\t8");
  });
  it("extensions reconnues", () => {
    expect(estTableur(new File([""], "liste.xlsx"))).toBe(true);
    expect(estTableur(new File([""], "plan.pdf"))).toBe(false);
  });
});
