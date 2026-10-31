import { describe, it, expect } from "vitest";
import { chercherFiches, lienFiche } from "./index-fiches";

const F = [
  { id: "1", name: "Sikaflex-11 FC+", supplier: "Sika", category: "Colles & Mastics" },
  { id: "2", name: "Cheville HFT 8x140", supplier: "HFT", category: "Fixations & Chevilles" },
  { id: "3", name: "Membrane EPDM", supplier: "Würth", category: "Membranes & Étanchéité" },
];

describe("liens vers Index", () => {
  it("cherche mot par mot, sans accents, nom + fournisseur + categorie", () => {
    expect(chercherFiches(F, "hft 140").map((f) => f.id)).toEqual(["2"]);
    expect(chercherFiches(F, "etancheite").map((f) => f.id)).toEqual(["3"]);
    expect(chercherFiches(F, "").length).toBe(3);
  });
  it("lien direct vers la fiche", () => expect(lienFiche("a b")).toBe("https://outils-hn.github.io/Index/?fiche=a%20b"));
});
