import type { Material, Supply, SupplyValues } from "./types";
import { uid } from "./ids";

export function switchSupply(material: Material, mode: Supply["mode"]): Material {
  if (mode === material.supply.mode) return material;
  const values: SupplyValues = { ...material.supplyValues, [material.supply.mode]: material.supply };
  const width = values.single?.width ?? values.fixedWidth?.width ?? 2070;
  const supply: Supply = values[mode] ?? (mode === "single"
    ? { mode, width, length: 2800 }
    : mode === "catalog"
      ? { mode, formats: [{ id: uid(), width: values.single?.width ?? width, length: values.single?.length ?? 2800 }] }
      : { mode, width, minLength: 1000, maxLength: 4000, step: 100 });
  return { ...material, supply, supplyValues: { ...values, [mode]: supply } };
}

/** Dimensions identiques même après rotation ; les prix ne changent pas l'identité. */
export function duplicateFormats(supply: Supply | undefined): Set<number> {
  const duplicates = new Set<number>();
  if (supply?.mode !== "catalog") return duplicates;
  const seen = new Map<string, number>();
  supply.formats.forEach((f, i) => {
    if (!(f.width > 0 && f.length > 0)) return;
    const key = `${Math.min(f.width, f.length)}|${Math.max(f.width, f.length)}`;
    const prior = seen.get(key);
    if (prior !== undefined) { duplicates.add(prior); duplicates.add(i); }
    else seen.set(key, i);
  });
  return duplicates;
}