import { expect, test } from "vitest";
import { chantierDe } from "./calculs-base";

const lire = (v: string | null) => () => v;
test("chantier d'un projet : « numero · nom » ou chantier de l'Accueil", () => {
  expect(chantierDe("24-118 · Les Tilleuls", lire(null))).toEqual({ numero: "24-118", nom: "Les Tilleuls" });
  expect(chantierDe("Les Tilleuls", lire('{"numero":"24-118","nom":"Les Tilleuls"}'))).toEqual({ numero: "24-118", nom: "Les Tilleuls" });
  expect(chantierDe("Autre", lire('{"numero":"24-118","nom":"Les Tilleuls"}'))).toEqual({ numero: "", nom: "Autre" });
  expect(chantierDe("", lire(null))).toEqual({ numero: "", nom: "" });
});
