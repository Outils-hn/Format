// Export "PDF commande" : document court regroupé par fournisseur, sans plans de découpe.
import type { OptimizeResult } from "../optimizer/types";
import type { Material, MaterialStatus, Piece, Project, ProjectInfo } from "../types";
import { statusSuffix } from "../indicators";
import { supplierSections } from "../order";
import { num } from "../format";
import { cleanName, download } from "./common";
import { Writer, pageFooters, pageHeader } from "./pdf";

const GREY: [number, number, number] = [112, 115, 121];
export const statusLabel = (s?: MaterialStatus) =>
  `${s?.status === "ordered" ? "Commandée" : s?.status === "stock" ? "Matière déjà disponible" : "À commander"}${statusSuffix(s)}`;

export function exportOrderPdf(result: OptimizeResult, materials: Material[], pieces: Piece[], info: ProjectInfo, project: Pick<Project, "orderTypes" | "showEstimate" | "materialStatus" | "supplierRemarks">) {
  const w = new Writer();
  const sections = supplierSections(result, materials, pieces, project);
  sections.forEach((sec, i) => {
    if (i > 0) w.newPage("portrait");
    pageHeader(w, "Bon de commande matière", info, statusLabel(project.materialStatus));
    w.text(`Fournisseur : ${sec.supplier}`, 14, true, undefined, 3);
    if (sec.panels.length) {
      w.table([{ h: "Matériau", w: 40 }, { h: "Épaisseur (mm)", w: 18, right: true }, { h: "Format (mm)", w: 28 }, { h: "Quantité de panneaux", w: 22, right: true }],
        sec.panels.map((p) => [p.material, num(p.thickness, 1), `${num(p.width, 1)} × ${num(p.length, 1)}`, num(p.count)]), false, "Panneaux entiers");
    }
    for (const b of sec.cuts) {
      const rows = b.rows.map((r) => [r.label, num(r.thickness, 1), num(r.width, 1), num(r.height, 1), num(r.quantity), r.grain ? "Hauteur" : "Libre"]);
      rows.push(["Total", "", "", "", num(b.total), ""]);
      w.table([{ h: "Repère", w: 24 }, { h: "Épaisseur (mm)", w: 18, right: true }, { h: "Largeur (mm)", w: 18, right: true },
        { h: "Hauteur (mm)", w: 14, right: true }, { h: "Quantité", w: 12, right: true }, { h: "Sens du décor", w: 16 }],
        rows, true, `Pièces débitées — ${b.material} ${num(b.thickness, 1)} mm`);
      if (b.remarks) w.text(`Remarques pour le fournisseur : ${b.remarks}`, 9, false, undefined, 3);
      if (project.showEstimate) w.text(`Estimation : environ ${b.estimate}`, 8.5, false, GREY, 3);
    }
    if (sections.some((x) => x.cuts.length)) w.text("Sens du décor « Hauteur » : le fil ou le décor suit la hauteur de la pièce ; « Libre » : la pièce peut être tournée.", 7, false, GREY, 1);
  });
  pageFooters(w, info);
  const name = ["Format_Commande", cleanName(info.site), cleanName(info.taskNumber), info.date].filter(Boolean).join("_");
  download(w.doc.output("blob"), `${name}.pdf`);
}
