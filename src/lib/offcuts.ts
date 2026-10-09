// Présentation des chutes calculées : aucun changement au moteur ni à ses résultats.
import type { Offcut, OptimizeResult, SheetResult } from "./optimizer/types";

export interface LabeledOffcut extends Offcut { label: string }

/** Repères locaux au panneau, dans l'ordre de lecture du dessin. */
export function labeledOffcuts(sheet: SheetResult): LabeledOffcut[] {
  return [...sheet.offcuts]
    .filter((o) => o.w > 0 && o.h > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.h - b.h || a.w - b.w)
    .map((o, i) => ({ ...o, label: `C${i + 1}` }));
}

export interface RetainedOffcut {
  materialId: string; material: string; thickness: number;
  w: number; h: number; quantity: number; origins: string[];
}

/** Compter les panneaux réels, même si leurs dessins sont regroupés. */
export function retainedOffcuts(result: OptimizeResult): RetainedOffcut[] {
  const rows = new Map<string, RetainedOffcut>();
  for (const m of result.materials) for (const s of m.sheets) {
    for (const o of labeledOffcuts(s).filter((o) => o.reusable)) {
      const key = JSON.stringify([m.materialId, o.w, o.h]);
      const row = rows.get(key) ?? {
        materialId: m.materialId, material: m.name, thickness: m.thickness,
        w: o.w, h: o.h, quantity: 0, origins: [],
      };
      row.quantity++;
      row.origins.push(`P${s.index} / ${o.label}`);
      rows.set(key, row);
    }
  }
  return [...rows.values()];
}