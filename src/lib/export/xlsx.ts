// Export "Commande Excel" (SheetJS avec styles).
import XLSX from "xlsx-js-style";
import type { OptimizeResult } from "../optimizer/types";
import type { Material, Piece, Project, ProjectInfo } from "../types";
import { supplierSections } from "../order";
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

export function exportOrderXlsx(result: OptimizeResult, materials: Material[], info: ProjectInfo, pieceList: Piece[] = [], project: Pick<Project, "orderTypes" | "showEstimate"> = {}, workshop = false) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const sheetName = (raw: string) => {
    const base = raw.replace(/[[\]:*?/\\]/g, " ").slice(0, 28).trim() || "Fournisseur";
    let n = base, i = 2;
    while (used.has(n.toLowerCase())) n = `${base} ${i++}`;
    used.add(n.toLowerCase());
    return n;
  };
  for (const sec of supplierSections(result, materials, pieceList, project)) {
    const rows: Cell[][] = [];
    const bold: number[] = [];
    if (sec.panels.length) {
      bold.push(rows.length);
      rows.push(["Matériau", "Épaisseur (mm)", "Format (L x H mm)", "Quantité panneaux"]);
      const first = rows.length + 1;
      for (const p of sec.panels) rows.push([p.material, p.thickness, `${p.width} x ${p.length}`, p.count]);
      bold.push(rows.length);
      rows.push(["Total", null, null, { f: `SUM(D${first}:D${rows.length})`, v: sec.panels.reduce((n, p) => n + p.count, 0) }]);
      rows.push([]);
    }
    for (const b of sec.cuts) {
      bold.push(rows.length);
      rows.push(["Repère", "Matériau", "Épaisseur (mm)", "Largeur (mm)", "Hauteur (mm)", "Quantité", "Sens du décor"]);
      const first = rows.length + 1;
      for (const r of b.rows) rows.push([r.label, r.material, r.thickness, r.width, r.height, r.quantity, r.grain ? "↑ hauteur" : "libre"]);
      bold.push(rows.length);
      rows.push(["Total", null, null, null, null, { f: `SUM(F${first}:F${rows.length})`, v: b.total }]);
      if (project.showEstimate) rows.push([`Estimation : environ ${b.estimate}`]);
      rows.push([]);
    }
    const ws = sheet([["Fournisseur", sec.supplier], [], ...rows]);
    ws["A1"].s = undefined;
    for (const r of bold) for (let c = 0; c < 7; c++) {
      const ref = XLSX.utils.encode_cell({ r: r + 2, c });
      if (ws[ref]) ws[ref].s = { font: { bold: true }, fill: rows[r]?.[0] === "Total" ? undefined : { fgColor: { rgb: "E5E7EB" } } };
    }
    ws["A1"].s = { font: { bold: true } };
    XLSX.utils.book_append_sheet(wb, ws, sheetName(sec.supplier));
  }
  if (workshop) {
    const pieces: Cell[][] = [["Panneau n°", "Repère", "Matériau", "Largeur (mm)", "Hauteur (mm)", "Tournée", "Position X (mm)", "Position Y (mm)"]];
    const offcuts: Cell[][] = [["Matériau", "Épaisseur (mm)", "Largeur (mm)", "Hauteur (mm)", "Panneau d'origine"]];
    for (const r of result.materials) {
      const trim = materials.find((m) => m.id === r.materialId)?.trim ?? 0;
      for (const s of r.sheets) {
        for (const p of s.placements) pieces.push([s.index, p.label, r.name, p.w, p.h, p.rotated ? "oui" : "non", p.x + trim, p.y + trim]);
        for (const o of s.offcuts) if (o.reusable) offcuts.push([r.name, r.thickness, Math.round(o.w), Math.round(o.h), s.index]);
      }
    }
    XLSX.utils.book_append_sheet(wb, sheet(pieces), sheetName("Pièces placées"));
    XLSX.utils.book_append_sheet(wb, sheet(offcuts), sheetName("Chutes réutilisables"));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const site = cleanName(info.site);
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Format_Commande_${site ? site + "_" : ""}${info.date}.xlsx`);
}
