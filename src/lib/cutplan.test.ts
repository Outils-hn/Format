import { describe, expect, it } from "vitest";
import { cutSequence } from "./cutplan";

// Les nombres utilisent des espaces insecables (milliers) : on les remplace pour comparer
const txt = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
const P = (y: number, x = 0, w = 2010, h = 382) => ({ x, y, w, h, pieceId: "a", label: "P1", rotated: false });

describe("sequence de coupe : distances depuis le bord coupe", () => {
  it("3 bandes de 382 (trait 4) : on regle 382 a chaque fois, pas 768 puis 1 154", () => {
    const cuts = cutSequence([P(0), P(386), P(772)], 2500, 1250, 4, 0);
    const h = cuts.filter((c) => c.dir === "h").map((c) => txt(c.text));
    expect(h[0]).toBe("Coupe horizontale à 382 mm du bord haut");
    expect(h[1]).toBe("Sur le morceau de 2'500 × 864 mm : coupe horizontale à 382 mm du bord coupé (haut)");
    expect(h[2]).toBe("Sur le morceau de 2'500 × 478 mm : coupe horizontale à 382 mm du bord coupé (haut)");
    expect(txt(cuts.find((c) => c.dir === "v")!.text)).toBe("Sur le morceau de 2'500 × 382 mm : coupe verticale à 2'010 mm du bord gauche");
  });
  it("delignage : la premiere coupe compte depuis le bord brut, les suivantes depuis le bord coupe", () => {
    const cuts = cutSequence([P(0), P(386)], 2480, 1230, 4, 10).filter((c) => c.dir === "h");
    expect(txt(cuts[0]!.text)).toBe("Coupe horizontale à 392 mm du bord haut");
    expect(txt(cuts[1]!.text)).toMatch(/à 382 mm du bord coupé/);
  });
});
