// Export "Commande Excel" (SheetJS avec styles).
import XLSX from "xlsx-js-style";
import type { OptimizeResult } from "../optimizer/types";
import type { Material, ProjectInfo } from "../types";
import { cleanName, download } from "./common";

type Cell = string | number | null | { f: string; v?: number };

function sheet(rows: Cell[][]) {
  const ws: XLSX.WorkSheet = {};
  rows.forEach((row, r) => row.forEach((c, col) => {
    if (c == null || c === "") return;
    const ref = XLSX.utils.encode_cell({ r, c: col });
    ws[ref] = typeof c === "object" ? { t: "n", f: c.f, v: c.v ?? 0 } : { t: typeof c === "number" ? "n" : "s", v: c };
    if (r === 0) ws[ref].s = { font: { bold: true }, fill: { fgColor: { rgb: "E5E7EB" } } };
  }));
  const nc = Math.max(...rows.map((r) => r.length));
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: nc - 1 } });
  ws["!cols"] = Array.from({ length: nc }, (_, c) => ({
    wch: Math.min(40, Math.max(8, ...rows.map((r) => { const v = r[c]; return v == null ? 0 : typeof v === "object" ? 10 : String(v).length; })) + 2),
  }));
  return ws;
}

export function exportOrderXlsx(result: OptimizeResult, materials: Material[], info: ProjectInfo) {
  const order: Cell[][] = [["Matériau", "Épaisseur (mm)", "Format (L x H mm)", "Quantité panneaux", "Prix unitaire (€)", "Prix total (€)"]];
  const pieces: Cell[][] = [["Panneau n°", "Repère", "Matériau", "Largeur (mm)", "Hauteur (mm)", "Tournée", "Position X (mm)", "Position Y (mm)"]];
  const offcuts: Cell[][] = [["Matériau", "Épaisseur (mm)", "Largeur (mm)", "Hauteur (mm)", "Panneau d'origine"]];
  let hasPrice = false;
  for (const r of result.materials) {
    const trim = materials.find((m) => m.id === r.materialId)?.trim ?? 0;
    for (const f of r.formats) {
      const row = order.length + 1;
      const priced = f.price != null;
      if (priced) hasPrice = true;
      order.push([r.name, r.thickness, `${f.width} x ${f.length}`, f.count, priced ? f.price! : null, priced ? { f: `D${row}*E${row}`, v: f.count * f.price! } : null]);
    }
    for (const s of r.sheets) {
      for (const p of s.placements)
        pieces.push([s.index, p.label, r.name, p.w, p.h, p.rotated ? "oui" : "non", p.x + trim, p.y + trim]);
      for (const o of s.offcuts) if (o.reusable) offcuts.push([r.name, r.thickness, Math.round(o.w), Math.round(o.h), s.index]);
    }
  }
  const n = order.length;
  order.push(["Total", null, null, { f: `SUM(D2:D${n})`, v: result.total.sheets }, null,
    hasPrice ? { f: `SUM(F2:F${n})`, v: result.total.totalPrice ?? 0 } : null]);
  const wb = XLSX.utils.book_new();
  const wsO = sheet(order);
  const last = XLSX.utils.encode_cell({ r: n, c: 0 });
  wsO[last].s = { font: { bold: true } };
  XLSX.utils.book_append_sheet(wb, wsO, "Commande");
  XLSX.utils.book_append_sheet(wb, sheet(pieces), "Pièces");
  XLSX.utils.book_append_sheet(wb, sheet(offcuts), "Chutes réutilisables");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const site = cleanName(info.site);
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Format_Commande_${site ? site + "_" : ""}${info.date}.xlsx`);
}
