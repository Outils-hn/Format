import { describe, expect, it } from "vitest";
import { newMaterial } from "./defaults";
import { duplicateFormats, switchSupply } from "./materialSupply";
import { exportLibrary, parseLibrary } from "./storage";

describe("Material supply drafts", () => {
  it("ignores the active mode and initializes the catalogue from the exact single format", () => {
    const material = { ...newMaterial(), supply: { mode: "single" as const, width: 1234, length: 2345 } };
    expect(switchSupply(material, "single")).toBe(material);
    const catalogue = switchSupply(material, "catalog");
    expect(catalogue.supply.mode === "catalog" && catalogue.supply.formats[0]).toMatchObject({ width: 1234, length: 2345 });
    expect(switchSupply(switchSupply(catalogue, "fixedWidth"), "single").supply).toEqual(material.supply);
  });
  it("preserves prices, format IDs and inactive values through library JSON", () => {
    const catalogue = { mode: "catalog" as const, formats: [{ id: "f", width: 800, length: 1600, price: 55.5 }] };
    const material = { ...newMaterial(), supply: catalogue };
    const switched = switchSupply(material, "fixedWidth");
    const restored = parseLibrary(exportLibrary([switched]))[0];
    expect(restored && switchSupply(restored, "catalog").supply).toEqual(catalogue);
  });
  it("flags every duplicate including reversed dimensions, regardless of price", () => {
    expect([...duplicateFormats({ mode: "catalog", formats: [
      { id: "a", width: 1000, length: 2000 },
      { id: "b", width: 2000, length: 1000, price: 10 },
      { id: "c", width: 1000, length: 2000 },
      { id: "d", width: 1000, length: 2100 },
    ] })].sort()).toEqual([0, 1, 2]);
  });
});