// Export "PDF commande" : document court regroupé par fournisseur, sans plans de découpe.
import type { OptimizeResult } from "../optimizer/types";
import type { Material, MaterialStatus, Piece, Project, ProjectInfo } from "../types";
import { statusSuffix } from "../indicators";
import { supplierSections } from "../order";
import { num } from "../format";
import { cleanName, download } from "./common";
import { Writer } from "./pdf";

const M = 12;
const GREY: [number, number, number] = [110, 115, 125];
const fmtDate = (iso: string) => iso.split("-").reverse().join("/");
export const statusLabel = (s?: MaterialStatus) =>
  `${s?.status === "ordered" ? "Commandée" : s?.status === "stock" ? "Matière déjà disponible" : "À commander"}${statusSuffix(s)}`;

export function exportOrderPdf(result: OptimizeResult, materials: Material[], pieces: Piece[], info: ProjectInfo, project: Pick<Project, "orderTypes" | "showEstimate" | "materialStatus">) {
  const w = new Writer();
  const sections = supplierSections(result, materials, pieces, project);
  sections.forEach((sec, i) => {
    if (i > 0) w.newPage("portrait");
    w.font(20, true); w.doc.text("FORMAT", M, w.y + 7);
    w.font(8, false, GREY); w.doc.text("BON DE COMMANDE MATIÈRE", M, w.y + 12);
    const fields: [string, string][] = [["Chantier", info.site], ["Numéro de tâche", info.taskNumber], ["Client", info.client], ["Date", fmtDate(info.date)]];
    const cw = (w.W - 2 * M) / 4;
    fields.forEach(([l, v], k) => {
      w.font(7, false, GREY); w.doc.text(l, M + k * cw, w.y + 19);
      w.font(10, true); w.doc.text(v || "—", M + k * cw, w.y + 24, { maxWidth: cw - 3 });
    });
    w.y += 28;
    w.text(`Statut de la matière : ${statusLabel(project.materialStatus)}`, 8.5, false, GREY, 1);
    w.doc.setDrawColor(20, 24, 32); w.doc.setLineWidth(0.5); w.doc.line(M, w.y, w.W - M, w.y);
    w.y += 5;
    w.text(`Fournisseur : ${sec.supplier}`, 14, true, undefined, 3);
    if (sec.panels.length) {
      w.table([{ h: "Matériau", w: 40 }, { h: "Épaisseur (mm)", w: 18, right: true }, { h: "Format (mm)", w: 28 }, { h: "Quantité de panneaux", w: 22, right: true }],
        sec.panels.map((p) => [p.material, num(p.thickness, 1), `${num(p.width, 1)} × ${num(p.length, 1)}`, num(p.count)]), false, "Panneaux entiers");
    }
    for (const b of sec.cuts) {
      const rows = b.rows.map((r) => [r.label, r.material, num(r.thickness, 1), num(r.width, 1), num(r.height, 1), num(r.quantity), r.grain ? "Hauteur" : "Libre"]);
      rows.push(["Total", "", "", "", "", num(b.total), ""]);
      w.table([{ h: "Repère", w: 18 }, { h: "Matériau", w: 30 }, { h: "Épaisseur (mm)", w: 14, right: true }, { h: "Largeur (mm)", w: 14, right: true },
        { h: "Hauteur (mm)", w: 14, right: true }, { h: "Quantité", w: 12, right: true }, { h: "Sens du décor", w: 16 }],
        rows, true, `Pièces débitées — ${b.material} ${num(b.thickness, 1)} mm`);
      if (project.showEstimate) w.text(`Estimation : environ ${b.estimate}`, 8.5, false, GREY, 3);
    }
    if (sections.some((x) => x.cuts.length)) w.text("Sens du décor « Hauteur » : le fil ou le décor suit la hauteur de la pièce ; « Libre » : la pièce peut être tournée.", 7, false, GREY, 1);
  });
  const n = w.doc.getNumberOfPages();
  const foot = ["Format", info.site, info.taskNumber].filter(Boolean).join(" - ");
  for (let i = 1; i <= n; i++) {
    w.doc.setPage(i);
    w.doc.setDrawColor(...GREY); w.doc.setLineWidth(0.2); w.doc.line(M, w.H - M - 4, w.W - M, w.H - M - 4);
    w.font(7.5, false, GREY);
    w.doc.text(foot, M, w.H - M);
    w.doc.text(`Page ${i} / ${n}`, w.W - M, w.H - M, { align: "right" });
  }
  const name = ["Format_Commande", cleanName(info.site), cleanName(info.taskNumber), info.date].filter(Boolean).join("_");
  download(w.doc.output("blob"), `${name}.pdf`);
}
