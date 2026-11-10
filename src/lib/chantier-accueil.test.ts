import { describe, expect, it } from "vitest";
import { chantierAccueil } from "./chantier-accueil";

const lire = (v: string | null) => () => v;
describe("chantier de l'Accueil", () => {
  it("numero et nom, ou l'un des deux, ou rien", () => {
    expect(chantierAccueil(lire('{"numero":"24-118","nom":"Résidence Les Tilleuls"}'))).toBe("24-118 · Résidence Les Tilleuls");
    expect(chantierAccueil(lire('{"nom":"Hôtel"}'))).toBe("Hôtel");
    expect(chantierAccueil(lire(null))).toBe("");
    expect(chantierAccueil(lire("pas du json"))).toBe("");
  });
});
