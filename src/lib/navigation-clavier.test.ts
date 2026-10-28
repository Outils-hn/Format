import { describe, expect, it } from "vitest";
import { positionCurseur } from "./navigation-clavier";

describe("navigation clavier : position du curseur", () => {
  it("texte tout selectionne (apres Tab) : on peut sortir des deux cotes", () => {
    expect(positionCurseur("2010", 0, 4)).toEqual({ auDebut: true, aLaFin: true });
  });
  it("curseur au milieu : les fleches restent dans le texte", () => {
    expect(positionCurseur("2010", 2, 2)).toEqual({ auDebut: false, aLaFin: false });
  });
  it("curseur au debut ou a la fin", () => {
    expect(positionCurseur("2010", 0, 0)).toEqual({ auDebut: true, aLaFin: false });
    expect(positionCurseur("2010", 4, 4)).toEqual({ auDebut: false, aLaFin: true });
  });
  it("champ vide ou sans curseur lisible", () => {
    expect(positionCurseur("", 0, 0)).toEqual({ auDebut: true, aLaFin: true });
    expect(positionCurseur("12", null, null)).toEqual({ auDebut: true, aLaFin: true });
  });
});
