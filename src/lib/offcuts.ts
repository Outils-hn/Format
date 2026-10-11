// Présentation des chutes calculées : aucun changement au moteur ni à ses résultats.
import type { Offcut, OptimizeResult, SheetResult } from "./optimizer/types";
import type { OffcutSettings } from "./types";
import { groupSheets } from "./cutplan";

export interface LabeledOffcut extends Offcut { label: string }

/** Repères locaux au panneau, dans l'ordre de lecture du dessin. */
export function labeledOffcuts(sheet: SheetResult): LabeledOffcut[] {
  return [...sheet.offcuts]
    .filter((o) => o.w > 0 && o.h > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.h - b.h || a.w - b.w)
    .map((o, i) => ({ ...o, label: `C${i + 1}` }));
}

export const DEFAULT_OFFCUT_SETTINGS: OffcutSettings = { mode: "indicative", labelsPage: false, marks: {} };

/** Clé d'une chute dessinée : matériau, premier panneau du dessin, repère. */
export const offcutKey = (materialId: string, drawingIndex: number, label: string) => `${materialId}|${drawingIndex}|${label}`;

export type Mark = { keep: boolean; note: string };
export type MarkOf = (materialId: string, sheetIndex: number, label: string) => Mark;

/** Consigne « à conserver » d'une chute réelle (cochée par défaut), partagée par les panneaux identiques. */
export function markResolver(result: OptimizeResult, settings?: OffcutSettings): MarkOf {
  const lead = new Map<string, number>();
  for (const m of result.materials) for (const g of groupSheets(m.sheets))
    for (const i of g.indexes) lead.set(`${m.materialId}|${i}`, g.indexes[0]!);
  return (materialId, sheetIndex, label) => {
    const k = offcutKey(materialId, lead.get(`${materialId}|${sheetIndex}`) ?? sheetIndex, label);
    const m = settings?.marks?.[k];
    return { keep: m?.keep ?? true, note: m?.note ?? "" };
  };
}

export interface OffcutItem {
  materialId: string; material: string; thickness: number;
  w: number; h: number; origin: string; note: string;
}

/** Chutes réutilisables des panneaux réels ; avec `mark`, seulement celles à conserver. */
export function reusableOffcutItems(result: OptimizeResult, mark?: MarkOf): OffcutItem[] {
  const out: OffcutItem[] = [];
  for (const m of result.materials) for (const s of m.sheets) {
    for (const o of labeledOffcuts(s).filter((o) => o.reusable)) {
      const mk = mark?.(m.materialId, s.index, o.label);
      if (mk && !mk.keep) continue;
      out.push({ materialId: m.materialId, material: m.name, thickness: m.thickness, w: o.w, h: o.h, origin: `P${s.index} / ${o.label}`, note: mk?.note.trim() ?? "" });
    }
  }
  return out;
}

export interface RetainedOffcut {
  materialId: string; material: string; thickness: number;
  w: number; h: number; quantity: number; origins: string[]; notes: string[];
}

/** Compter les panneaux réels, même si leurs dessins sont regroupés. */
export function retainedOffcuts(result: OptimizeResult, mark?: MarkOf): RetainedOffcut[] {
  const rows = new Map<string, RetainedOffcut>();
  for (const o of reusableOffcutItems(result, mark)) {
    const key = JSON.stringify([o.materialId, o.w, o.h]);
    const row = rows.get(key) ?? {
      materialId: o.materialId, material: o.material, thickness: o.thickness,
      w: o.w, h: o.h, quantity: 0, origins: [], notes: [],
    };
    row.quantity++;
    row.origins.push(o.origin);
    if (o.note && !row.notes.includes(o.note)) row.notes.push(o.note);
    rows.set(key, row);
  }
  return [...rows.values()];
}
