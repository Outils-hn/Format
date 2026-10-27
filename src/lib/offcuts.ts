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

/**
 * Reglage par defaut quand le projet n'a rien choisi : si toutes les pieces sont
 * debitees par le fournisseur, les chutes ne restent pas a l'atelier, donc on ne les
 * detaille pas dans le PDF (« sans qualification »). Un choix fait dans les reglages prime.
 */
export function defaultOffcutSettings(orderTypes: string[]): OffcutSettings {
  return orderTypes.length > 0 && orderTypes.every((t) => t === "cut")
    ? { ...DEFAULT_OFFCUT_SETTINGS, mode: "hide" }
    : DEFAULT_OFFCUT_SETTINGS;
}

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

/**
 * Origines compactees pour le PDF : « P1 / C1 · P2 / C1 · … · P96 / C1 » devient
 * « P1 à P96 / C1 ». Les panneaux sont regroupes par repere de chute, puis en plages
 * de numeros consecutifs (« P101 et P102 », « P5 à P9, P12 »).
 */
export function compactOrigins(origins: string[]): string {
  const byMark = new Map<string, number[]>();
  for (const o of origins) {
    const m = o.match(/^P(\d+) \/ (.+)$/);
    if (!m) { byMark.set(o, byMark.get(o) ?? []); continue; }
    const list = byMark.get(m[2]!) ?? [];
    list.push(Number(m[1]));
    byMark.set(m[2]!, list);
  }
  const ranges = (ns: number[]) => {
    const sorted = [...new Set(ns)].sort((a, b) => a - b);
    const parts: string[] = [];
    for (let i = 0; i < sorted.length; ) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
      const a = sorted[i]!, b = sorted[j]!;
      parts.push(a === b ? `P${a}` : b === a + 1 ? `P${a} et P${b}` : `P${a} à P${b}`);
      i = j + 1;
    }
    return parts.join(", ");
  };
  return [...byMark.entries()].map(([mark, ns]) => (ns.length ? `${ranges(ns)} / ${mark}` : mark)).join(" · ");
}
