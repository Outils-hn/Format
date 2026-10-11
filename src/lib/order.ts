// Mode commande : regroupement par fournisseur et lignes de commande (présentation uniquement).
import type { MaterialResult, OptimizeResult } from "./optimizer/types";
import type { Material, OrderType, Piece, Project } from "./types";
import { dims, num, panelOrder } from "./format";

export const orderTypeOf = (mat: Material | undefined, project: Pick<Project, "orderTypes">): OrderType =>
  (mat && project.orderTypes?.[mat.id]) ?? mat?.orderType ?? "panels";

export const orderTypeLabel = (t: OrderType) => (t === "cut" ? "Pièces débitées par le fournisseur" : "Panneaux entiers");

export const placedCount = (r: MaterialResult) => r.sheets.reduce((n, s) => n + s.placements.length, 0);

export const estimateText = (r: MaterialResult) =>
  r.formats.map((f) => `${num(f.count)} panneau${f.count === 1 ? "" : "x"} de ${dims(f.width, f.length)} mm`).join(" + ");

/** Ligne du bandeau pour un matériau, selon son type de commande. */
export const orderLines = (results: MaterialResult[], typeOf: (id: string) => OrderType) =>
  results.flatMap((r) => typeOf(r.materialId) === "cut"
    ? [`Pièces à faire débiter : ${num(placedCount(r))} pièce${placedCount(r) === 1 ? "" : "s"} · estimation : environ ${estimateText(r)} - ${r.name} ${num(r.thickness, 1)} mm`]
    : r.formats.map((f) => panelOrder(f.count, f.width, f.length, r.name, r.thickness)));

export interface PanelRow { material: string; thickness: number; width: number; length: number; count: number }
export interface CutRow { label: string; material: string; thickness: number; width: number; height: number; quantity: number; grain: boolean }
export interface CutBlock { material: string; thickness: number; rows: CutRow[]; total: number; estimate: string }
export interface SupplierSection { supplier: string; panels: PanelRow[]; cuts: CutBlock[] }

export function supplierSections(result: OptimizeResult, materials: Material[], pieces: Piece[], project: Pick<Project, "orderTypes">): SupplierSection[] {
  const map = new Map<string, SupplierSection>();
  for (const r of result.materials) {
    const mat = materials.find((m) => m.id === r.materialId);
    const supplier = mat?.supplier?.trim() || "Fournisseur non renseigné";
    const sec = map.get(supplier) ?? { supplier, panels: [], cuts: [] };
    map.set(supplier, sec);
    if (orderTypeOf(mat, project) === "cut") {
      const merged = new Map<string, CutRow>();
      for (const p of pieces.filter((x) => x.materialId === r.materialId && x.width && x.height && x.quantity)) {
        const grain = !!mat?.grainLocked || !p.canRotate;
        const k = [p.label, p.width, p.height, grain].join("|");
        const row = merged.get(k) ?? { label: p.label, material: r.name, thickness: r.thickness, width: p.width!, height: p.height!, quantity: 0, grain };
        row.quantity += p.quantity;
        merged.set(k, row);
      }
      const rows = [...merged.values()];
      sec.cuts.push({ material: r.name, thickness: r.thickness, rows, total: rows.reduce((n, x) => n + x.quantity, 0), estimate: estimateText(r) });
    } else {
      for (const f of r.formats) sec.panels.push({ material: r.name, thickness: r.thickness, width: f.width, length: f.length, count: f.count });
    }
  }
  return [...map.values()];
}
