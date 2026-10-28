import { describe, expect, it } from "vitest";
import { fusionner, remettrePrix, sansPrix, type RemoteRow } from "./shared-library";
import type { Material } from "./types";

const mat = (id: string, name: string, prix?: number): Material => ({
  id, name, thickness: 15, kerf: 4, trim: 0, grainLocked: false, cutType: "guillotine",
  supply: { mode: "catalog", formats: [{ id: "f1", width: 2500, length: 1250, price: prix }, { id: "f2", width: 3000, length: 1250 }] },
});
const row = (m: Material, deleted = false): RemoteRow => ({ id: m.id, data: sansPrix(m), updated_at: "2026-10-28T10:00:00Z", deleted_at: deleted ? "2026-10-28T11:00:00Z" : null });
const prixDe = (m: Material | undefined) => (m?.supply.mode === "catalog" ? m.supply.formats.map((f) => f.price ?? null) : []);

describe("bibliotheque commune : les prix ne quittent pas le poste", () => {
  it("sansPrix retire tous les prix, y compris ceux gardes pour un autre mode", () => {
    const m = { ...mat("a", "FG", 42), supplyValues: { catalog: { mode: "catalog" as const, formats: [{ id: "f9", width: 1, length: 1, price: 9 }] } } };
    expect(JSON.stringify(sansPrix(m))).not.toMatch(/price/);
  });
  it("les prix locaux sont remis sur la version de l'equipe", () => {
    expect(prixDe(remettrePrix(sansPrix(mat("a", "FG")), mat("a", "FG", 42)))).toEqual([42, null]);
  });
});

describe("bibliotheque commune : fusion avec la copie locale", () => {
  it("un materiau modifie par l'equipe remplace la copie locale, avec les prix du poste", () => {
    const distant = { ...mat("a", "Fibres-gypse"), kerf: 5 };
    const f = fusionner([mat("a", "FG", 42)], [row(distant)], new Set());
    expect(f.materials[0]!.name).toBe("Fibres-gypse");
    expect(f.materials[0]!.kerf).toBe(5);
    expect(prixDe(f.materials[0])).toEqual([42, null]);
  });
  it("un materiau ajoute par un collegue arrive sur ce poste", () => {
    const f = fusionner([], [row(mat("b", "MDF"))], new Set());
    expect(f.materials.map((m) => m.name)).toEqual(["MDF"]);
  });
  it("un materiau jamais envoye reste, signale « seulement sur ce poste »", () => {
    const f = fusionner([mat("c", "Local")], [], new Set());
    expect(f.materials).toHaveLength(1);
    expect(f.localOnly.map((m) => m.id)).toEqual(["c"]);
  });
  it("supprime par l'equipe : retire, sauf s'il sert au projet ouvert", () => {
    const local = [mat("a", "FG"), mat("b", "MDF")];
    const remote = [row(local[0]!, true), row(local[1]!, true)];
    expect(fusionner(local, remote, new Set(["b"])).materials.map((m) => m.id)).toEqual(["b"]);
  });
});
