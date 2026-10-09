// Export "PDF atelier" : dessin vectoriel jsPDF, A4, lisible en noir et blanc.
import { jsPDF } from "jspdf";
import type { Balance, OptimizeResult, SheetResult } from "../optimizer/types";
import type { Material, Piece, ProjectInfo } from "../types";
import { cutSequence, groupSheets, type Cut, type SheetGroup } from "../cutplan";
import { PLAN_COLORS } from "../palette";
import { cleanName, download, pieceOrder } from "./common";
import { labeledOffcuts, retainedOffcuts } from "../offcuts";
import type { LinearRecap } from "../linear";

type RGB = [number, number, number];
const INK: RGB = [20, 24, 32];
const GREY: RGB = [110, 115, 125];
const M = 12; // marge page (mm)
const PT = 2.835; // mm -> pt

/** Convertit une variable CSS (oklch...) en RGB via un canvas. */
function resolveColor(cssVar: string): RGB {
  const name = cssVar.replace(/^var\(|\)$/g, "");
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#ddd";
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = val;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0]!, d[1]!, d[2]!];
}

const m2 = (mm2: number) => (mm2 / 1e6).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f|\u00a0/g, " ");
const pct = (r: number) => `${(r * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const eur = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }).replace(/\u202f|\u00a0/g, " ")} €`);
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

type TableColumn = { h: string; w: number; right?: boolean };

export class Writer {
  doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  y = M;
  get W() { return this.doc.internal.pageSize.getWidth(); }
  get H() { return this.doc.internal.pageSize.getHeight(); }
  get bottom() { return this.H - M - 8; }
  ensure(h: number) { if (this.y + h > this.bottom) this.newPage(this.W > this.H ? "landscape" : "portrait"); }
  newPage(o: "portrait" | "landscape") { this.doc.addPage("a4", o); this.y = M; }
  font(size: number, bold = false, color: RGB = INK) {
    this.doc.setFont("helvetica", bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }
  text(s: string, size = 9, bold = false, color: RGB = INK, gap = 1.5) {
    this.font(size, bold, color);
    const lines = this.doc.splitTextToSize(s, this.W - 2 * M) as string[];
    const lh = size / PT * 1.3;
    for (const l of lines) { this.ensure(lh); this.doc.text(l, M, this.y + lh * 0.8); this.y += lh; }
    this.y += gap;
  }
  measureTable(cols: TableColumn[], rows: string[][], size = 8) {
    const total = cols.reduce((a, c) => a + c.w, 0);
    const k = (this.W - 2 * M) / total;
    const scale = size / 8;
    const lineHeight = 3.6 * scale;
    const padding = 1.6 * scale;
    this.font(size, true);
    const header = cols.map((c) => this.doc.splitTextToSize(c.h, c.w * k - 3) as string[]);
    const heightOf = (cells: string[][]) => Math.max(5.2 * scale, Math.max(1, ...cells.map((c) => c.length)) * lineHeight + padding);
    const headerHeight = heightOf(header);
    const body = rows.map((r) => {
      // Bold measurement is conservative, including the optional total row.
      const cells = cols.map((c, j) => this.doc.splitTextToSize(r[j] ?? "", c.w * k - 3) as string[]);
      return { cells, height: heightOf(cells) };
    });
    return { k, header, headerHeight, body, lineHeight, height: headerHeight + body.reduce((sum, r) => sum + r.height, 0) + 3 };
  }
  table(cols: TableColumn[], rows: string[][], boldLast = false, title?: string) {
    let size = 8;
    let layout = this.measureTable(cols, rows, size);
    const titleHeight = title ? 7 : 0;
    // Decide the page before drawing anything, including the block title.
    if (this.y + titleHeight + layout.height > this.bottom && this.y > M) {
      this.newPage(this.W > this.H ? "landscape" : "portrait");
    }
    // An exceptionally long table still stays whole: fit it to a fresh page.
    while (titleHeight + layout.height > this.bottom - this.y && size > 0.5) {
      size *= 0.9;
      layout = this.measureTable(cols, rows, size);
    }
    const fit = Math.min(1, (this.bottom - this.y - titleHeight - 3) / (layout.height - 3));
    const drawCells = (cells: string[][], height: number, bold: boolean) => {
      this.font(size * fit, bold);
      let x = M;
      cols.forEach((c, j) => {
        (cells[j] ?? []).forEach((line, n) => this.doc.text(line, c.right ? x + c.w * layout.k - 1.5 : x + 1.5,
          this.y + (3.6 * size / 8 + n * layout.lineHeight) * fit, { align: c.right ? "right" : "left" }));
        x += c.w * layout.k;
      });
      this.y += height * fit;
    };
    if (title) {
      this.font(9, true); this.doc.text(title, M, this.y + 4);
      this.y += titleHeight;
    }
    this.doc.setFillColor(232, 234, 238);
    this.doc.rect(M, this.y, this.W - 2 * M, layout.headerHeight * fit, "F");
    drawCells(layout.header, layout.headerHeight, true);
    layout.body.forEach((r, i) => {
      drawCells(r.cells, r.height, boldLast && i === rows.length - 1);
      this.doc.setDrawColor(200, 203, 210); this.doc.setLineWidth(0.15);
      this.doc.line(M, this.y, this.W - M, this.y);
    });
    this.y += 3;
  }
}

function kpis(w: Writer, b: Balance, sheets: number, price: number | null) {
  const items: [string, string, string?][] = [
    ["Panneaux", String(sheets), `${m2(b.purchased)} m² achetés`],
    ["Rendement brut", pct(ratio(b.pieces, b.purchased)), `${m2(b.pieces)} m² de pièces`],
    ["Rendement hors chutes réutil.", pct(ratio(b.pieces, b.purchased - b.reusable))],
    ["Chutes réutilisables", `${m2(b.reusable)} m²`],
    ...(price != null ? [["Prix total", eur(price)] as [string, string]] : []),
  ];
  const gap = 2.5, h = 18;
  const bw = (w.W - 2 * M - gap * (items.length - 1)) / items.length;
  w.ensure(h + 2);
  items.forEach(([l, v, sub], i) => {
    const x = M + i * (bw + gap);
    w.doc.setDrawColor(...INK); w.doc.setLineWidth(0.25); w.doc.rect(x, w.y, bw, h);
    w.font(items.length > 4 ? 6 : 7, false, GREY); w.doc.text(w.doc.splitTextToSize(l, bw - 4) as string[], x + 2, w.y + 3.8);
    w.font(12, true); w.doc.text(v, x + 2, w.y + 12.2);
    if (sub) { w.font(6.5, false, GREY); w.doc.text(sub, x + 2, w.y + 15.8); }
  });
  w.y += h + 3;
}

const balanceLine = (b: Balance) =>
  `Surface achetée ${m2(b.purchased)} m² = pièces ${m2(b.pieces)} + délignage ${m2(b.trim)} + chutes réutilisables ${m2(b.reusable)} + pertes ${m2(b.losses)} m² (traits de coupe et petites chutes)`;

function supplyText(m: Material) {
  const s = m.supply;
  if (s.mode === "single") return `${s.width} × ${s.length} mm`;
  if (s.mode === "catalog") return s.formats.map((f) => `${f.width} × ${f.length}${f.price != null ? ` (${eur(f.price)})` : ""}`).join(", ");
  return `largeur ${s.width} mm, longueur ${s.minLength} à ${s.maxLength} mm par pas de ${s.step} mm`;
}

function hatch(doc: jsPDF, x: number, y: number, w: number, h: number, step: number, color: RGB, reusable: boolean, lw: number) {
  doc.saveGraphicsState();
  doc.rect(x, y, w, h, null);
  doc.clip();
  doc.discardPath();
  doc.setDrawColor(...color); doc.setLineWidth(lw);
  for (let k = -h; k < w; k += step) {
    if (reusable) doc.line(x + k, y + h, x + k + h, y);
    else doc.line(x + k, y, x + k + h, y + h);
  }
  doc.restoreGraphicsState();
}

function drawPlan(doc: jsPDF, s: SheetResult, mat: Material, cuts: Cut[], color: (id: string) => RGB, ox: number, oy: number, k: number) {
  const t = mat.trim;
  const X = (v: number) => ox + v * k, Y = (v: number) => oy + v * k;
  const reuse = resolveColor("var(--offcut-reuse)");
  const waste = resolveColor("var(--offcut-waste)");
  const reuseBg = resolveColor("var(--offcut-reuse-bg)");
  const wasteBg = resolveColor("var(--offcut-waste-bg)");
  const tokens = getComputedStyle(document.documentElement);
  const hatchWidth = parseFloat(tokens.getPropertyValue("--hatch-width")) * 25.4 / 96;
  const hatchSpacing = parseFloat(tokens.getPropertyValue("--hatch-spacing")) * 25.4 / 96;
  doc.setLineDashPattern([], 0);
  doc.setFillColor(225, 227, 231); doc.setDrawColor(...INK); doc.setLineWidth(0.5);
  doc.rect(X(0), Y(0), s.width * k, s.length * k, "FD");
  doc.setFillColor(255, 255, 255); doc.setLineWidth(0.15); doc.setLineDashPattern([1, 0.8], 0);
  doc.rect(X(t), Y(t), s.usableW * k, s.usableL * k, "FD");
  doc.setLineDashPattern([], 0);
  for (const o of labeledOffcuts(s)) {
    const x = X(o.x + t), y = Y(o.y + t), w = o.w * k, h = o.h * k;
    doc.setFillColor(...(o.reusable ? reuseBg : wasteBg));
    doc.rect(x, y, w, h, "F");
    hatch(doc, x, y, w, h, hatchSpacing, o.reusable ? reuse : waste, o.reusable, hatchWidth);
    doc.setDrawColor(...GREY); doc.setLineWidth(0.15); doc.rect(x, y, w, h);
    if (Math.min(w, h) > 7 && w > 22) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...INK);
      const label = `${o.label} · ${Math.round(o.w)} × ${Math.round(o.h)}`;
      const tw = doc.getTextWidth(label) + 2;
      doc.setFontSize(Math.min(6.5, 6.5 * (w - 1) / tw));
      const fittedWidth = doc.getTextWidth(label) + 1;
      doc.setFillColor(255, 255, 255); doc.rect(x + w / 2 - fittedWidth / 2, y + h / 2 - 1.8, fittedWidth, 3.6, "F");
      doc.text(label, x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
    } else {
      doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
      const size = Math.min(6.5, Math.min(w, h) * PT / 1.5, w * PT / (o.label.length * 0.65));
      if (size >= 2) {
        doc.setFontSize(size);
        doc.text(o.label, x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
      }
    }
  }
  for (const p of s.placements) {
    const x = X(p.x + t), y = Y(p.y + t), w = p.w * k, h = p.h * k;
    doc.setFillColor(...color(p.pieceId)); doc.setDrawColor(...INK); doc.setLineWidth(0.35);
    doc.rect(x, y, w, h, "FD");
    doc.setTextColor(...INK);
    const f = Math.min(3.6, h / 3.2, w / 7); // hauteur texte mm
    if (f >= 1.2) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(f * 1.15 * PT);
      doc.text(p.label, x + w / 2, y + h / 2 - f * 0.6, { align: "center", baseline: "middle" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(f * PT);
      doc.text(`${p.w} × ${p.h}`, x + w / 2, y + h / 2 + f * 0.75, { align: "center", baseline: "middle" });
    } else {
      const fl = Math.min(3.6, h / 1.6, w / Math.max(2, p.label.length * 0.75));
      if (fl >= 0.9) { doc.setFont("helvetica", "bold"); doc.setFontSize(fl * PT); doc.text(p.label, x + w / 2, y + h / 2, { align: "center", baseline: "middle" }); }
    }
    if (p.rotated && Math.min(w, h) > 6) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      doc.text("T", x + w - 1, y + 1, { align: "right", baseline: "top" });
    }
  }
  for (const c of cuts) {
    const kk = mat.kerf / 2;
    const [x1, y1, x2, y2] = c.dir === "h"
      ? [X(c.from + t), Y(c.pos + kk + t), X(c.to + t), Y(c.pos + kk + t)]
      : [X(c.pos + kk + t), Y(c.from + t), X(c.pos + kk + t), Y(c.to + t)];
    doc.setDrawColor(...INK); doc.setLineWidth(0.3); doc.setLineDashPattern([1.6, 1], 0);
    doc.line(x1, y1, x2, y2);
    doc.setLineDashPattern([], 0);
    const r = 2.1;
    const cx = c.dir === "h" ? x1 + r * 1.2 : x1, cy = c.dir === "h" ? y1 : y1 + r * 1.2;
    doc.setFillColor(255, 255, 255); doc.setLineWidth(0.25); doc.circle(cx, cy, r, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(...INK);
    doc.text(String(c.n), cx, cy, { align: "center", baseline: "middle" });
  }
  // cotes exterieures
  doc.setDrawColor(...INK); doc.setLineWidth(0.2); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const a = 4;
  doc.line(X(0), oy - a, X(s.width), oy - a);
  doc.line(X(0), oy - a - 1.5, X(0), oy - 1); doc.line(X(s.width), oy - a - 1.5, X(s.width), oy - 1);
  doc.text(String(s.width), X(s.width / 2), oy - a - 1, { align: "center" });
  doc.line(ox - a, Y(0), ox - a, Y(s.length));
  doc.line(ox - a - 1.5, Y(0), ox - 1, Y(0)); doc.line(ox - a - 1.5, Y(s.length), ox - 1, Y(s.length));
  doc.text(String(s.length), ox - a - 1, Y(s.length / 2), { align: "center", angle: 90 });
}

function sheetPage(w: Writer, g: SheetGroup, mat: Material, r: { name: string; thickness: number }, color: (id: string) => RGB) {
  const s = g.sheet;
  w.newPage(s.width > s.length ? "landscape" : "portrait");
  w.font(12, true);
  w.doc.text(`Panneau ${g.indexes.join(", ")}`, M, w.y + 5);
  const tx = M + w.doc.getTextWidth(`Panneau ${g.indexes.join(", ")}`) + 4;
  w.font(9, false, GREY);
  w.doc.text(`${r.name} ${r.thickness} mm · ${s.width} × ${s.length} mm`, tx, w.y + 5);
  if (g.count > 1) {
    const bx = w.W - M - 14;
    w.doc.setFillColor(...INK); w.doc.rect(bx, w.y, 14, 7, "F");
    w.font(11, true, [255, 255, 255]); w.doc.text(`× ${g.count}`, bx + 7, w.y + 3.5, { align: "center", baseline: "middle" });
  }
  w.y += 12;
  const cuts = mat.cutType === "guillotine" ? cutSequence(s.placements, s.usableW, s.usableL, mat.kerf, mat.trim) : [];
  const map = new Map<string, { label: string; w: number; h: number; rot: boolean; qty: number; pos: string[] }>();
  for (const p of s.placements) {
    const key = `${p.pieceId}|${p.w}|${p.h}|${p.rotated}`;
    const e = map.get(key) ?? { label: p.label, w: p.w, h: p.h, rot: p.rotated, qty: 0, pos: [] };
    e.qty++; e.pos.push(`${p.x + mat.trim}/${p.y + mat.trim}`); map.set(key, e);
  }
  const pieceCols: TableColumn[] = [{ h: "Repère", w: 18 }, { h: "Dimensions (mm)", w: 22 }, { h: "Qté", w: 8, right: true }, { h: "Tournée", w: 12 }, { h: "Position X / Y (mm)", w: 60 }];
  const pieceRows = [...map.values()].map((e) => [e.label, `${e.w} × ${e.h}`, String(e.qty), e.rot ? "oui" : "non", e.pos.join(" · ")]);
  const offcuts = labeledOffcuts(s);
  const offcutCols: TableColumn[] = [{ h: "Repère", w: 14 }, { h: "Dimensions (mm)", w: 30 }, { h: "Surface (m²)", w: 25, right: true }, { h: "Position X / Y (mm)", w: 35 }, { h: "Destination", w: 25 }];
  const offcutRows = offcuts.map((o) => [o.label, `${o.w} × ${o.h}`, m2(o.w * o.h), `${o.x + mat.trim} / ${o.y + mat.trim}`, o.reusable ? "À conserver" : "Perte"]);
  w.font(8);
  const cutHeight = cuts.length ? 7 + cuts.reduce((sum, c) => sum + (w.doc.splitTextToSize(`${c.n}. ${c.text}`, w.W - 2 * M) as string[]).length * 8 / PT * 1.3, 0) : 0;
  const reserved = 32 + cutHeight + w.measureTable(pieceCols, pieceRows).height + 7 + (offcuts.length ? w.measureTable(offcutCols, offcutRows).height : 6);
  const availW = w.W - 2 * M - 8;
  const defaultH = Math.min((w.bottom - w.y) * 0.62, availW / s.width * s.length);
  const fittingH = w.bottom - w.y - reserved;
  // Only a slight reduction; otherwise move an entire table to the next page.
  const availH = fittingH >= defaultH * 0.75 ? Math.min(defaultH, fittingH) : defaultH;
  const k = Math.min(availW / s.width, availH / s.length);
  const ox = M + 8 + (availW - s.width * k) / 2;
  drawPlan(w.doc, s, mat, cuts, color, ox, w.y + 4, k);
  w.y += 4 + s.length * k + 3;
  w.font(7.5, false, GREY);
  w.doc.text("Cotes mesurées depuis le coin brut haut gauche", w.W / 2, w.y + 2, { align: "center" });
  w.doc.text("T = pièce tournée", w.W / 2, w.y + 6, { align: "center" });
  w.y += 9;
  // légende chutes avec échantillons
  const swW = 9, swH = 4;
  const entries: [boolean, string][] = [[true, "chute réutilisable"], [false, "perte"]];
  const widths = entries.map(([, l]) => swW + 2 + w.doc.getTextWidth(l));
  const total = widths.reduce((a, b) => a + b, 0) + 8;
  let lx = w.W / 2 - total / 2;
  entries.forEach(([reusable, label], i) => {
    const stroke = resolveColor(reusable ? "var(--offcut-reuse)" : "var(--offcut-waste)");
    const bg = resolveColor(reusable ? "var(--offcut-reuse-bg)" : "var(--offcut-waste-bg)");
    w.doc.setFillColor(...bg); w.doc.rect(lx, w.y, swW, swH, "F");
    hatch(w.doc, lx, w.y, swW, swH, 2.4, stroke, reusable, 0.2);
    w.doc.setDrawColor(...GREY); w.doc.setLineWidth(0.15); w.doc.rect(lx, w.y, swW, swH);
    w.font(7.5, false, GREY);
    w.doc.text(label, lx + swW + 2, w.y + swH / 2, { baseline: "middle" });
    lx += widths[i]! + 8;
  });
  w.y += swH + 5;
  if (cuts.length) {
    w.text("Séquence de coupe", 9, true, INK, 0.5);
    for (const c of cuts) w.text(`${c.n}. ${c.text}`, 8, false, INK, 0);
    w.y += 2;
  }
  w.table(pieceCols, pieceRows, false, `Pièces — Panneau ${g.indexes.join(", ")}`);
  if (offcuts.length) w.table(offcutCols, offcutRows, false, `Chutes — Panneau ${g.indexes.join(", ")}`);
  else { w.ensure(13); w.text(`Chutes — Panneau ${g.indexes.join(", ")}`, 9, true); w.text("Aucune chute.", 8, false, GREY); }
}

export function exportWorkshopPdf(result: OptimizeResult, materials: Material[], pieces: Piece[], info: ProjectInfo, linears: LinearRecap[] = []) {
  const w = new Writer();
  const order = pieceOrder(result);
  const palette = PLAN_COLORS.map(resolveColor);
  const color = (id: string) => palette[Math.max(0, order.indexOf(id)) % palette.length]!;

  // Page 1 : en-tete + synthese
  w.font(20, true); w.doc.text("FORMAT", M, w.y + 7);
  w.font(8, false, GREY); w.doc.text("FICHE DE DÉBIT — OPTIMISATION DE DÉCOUPE 2D", M, w.y + 12);
  const fields: [string, string][] = [["Chantier", info.site], ["Numéro de tâche", info.taskNumber], ["Client", info.client], ["Date", fmtDate(info.date)]];
  const cw = (w.W - 2 * M) / 4;
  fields.forEach(([l, v], i) => {
    const x = M + i * cw;
    w.font(7, false, GREY); w.doc.text(l, x, w.y + 19);
    w.font(10, true); w.doc.text(v || "—", x, w.y + 24, { maxWidth: cw - 3 });
  });
  w.y += 28;
  w.doc.setDrawColor(...INK); w.doc.setLineWidth(0.5); w.doc.line(M, w.y, w.W - M, w.y);
  w.y += 5;

  for (const r of result.materials) {
    const mat = materials.find((m) => m.id === r.materialId);
    w.ensure(60);
    w.text(`${r.name} — ${r.thickness} mm`, 12, true, INK, 1);
    if (mat) {
      w.text(`Format(s) : ${supplyText(mat)}`, 8.5, false, INK, 0);
      w.text(`Trait de coupe : ${mat.kerf} mm · Délignage : ${mat.trim} mm par bord · Type de découpe : ${mat.cutType === "guillotine" ? "guillotine (scie à panneaux)" : "libre (CNC)"} · Sens imposé : ${mat.grainLocked ? "oui" : "non"}`, 8.5, false, INK, 2);
    }
    kpis(w, r.balance, r.sheets.length, r.totalPrice);
    w.text(balanceLine(r.balance), 7.5, false, GREY, 1);
    if (r.formats.length)
      w.text(`À commander : ${r.formats.map((f) => `${f.count} × ${f.width} × ${f.length} mm${f.price != null ? ` (${eur(f.count * f.price)})` : ""}`).join(" · ")}`, 8.5, true, INK, 2);
    if (r.unplaced.length) w.text(`Pièces impossibles à placer : ${r.unplaced.map((u) => `${u.label} × ${u.quantity} (${u.reason})`).join(" ; ")}`, 8.5, true, INK, 2);
    const list = pieces.filter((p) => p.materialId === r.materialId);
    const qty = list.reduce((a, p) => a + p.quantity, 0);
    const area = list.reduce((a, p) => a + (p.width ?? 0) * (p.height ?? 0) * p.quantity, 0);
    w.table(
      [{ h: "Repère", w: 30 }, { h: "Dimensions L × H (mm)", w: 35 }, { h: "Quantité", w: 18, right: true }, { h: "Surface (m²)", w: 20, right: true }],
      [...list.map((p) => [p.label, `${p.width ?? "?"} × ${p.height ?? "?"}`, String(p.quantity), m2((p.width ?? 0) * (p.height ?? 0) * p.quantity)]),
        ["Total", "", String(qty), m2(area)]],
      true,
    );
    w.y += 3;
  }

  if (linears.length) {
    w.table(
      [{ h: "Repère", w: 18 }, { h: "Matériau", w: 30 }, { h: "Bande (mm)", w: 18, right: true }, { h: "Demandé (mm)", w: 22, right: true }, { h: "Tronçons obtenus (mm)", w: 54 }, { h: "Produit (mm)", w: 22, right: true }],
      linears.map((l) => [l.label, l.material, String(l.band), String(l.requested), l.segments.map((x) => `${x.count} × ${x.length}`).join(" + ") || "—", `${l.produced}${l.ok ? "" : " (!)"}`]),
      false, "Linéaires",
    );
    w.y += 3;
  }

  const retained = retainedOffcuts(result);
  if (retained.length) w.table(
    [{ h: "Matériau", w: 28 }, { h: "Ép. (mm)", w: 15, right: true }, { h: "Dimensions (mm)", w: 28 }, { h: "Qté", w: 10, right: true }, { h: "Surface (m²)", w: 23, right: true }, { h: "Panneau / Repère", w: 40 }],
    retained.map((o) => [o.material, String(o.thickness), `${o.w} × ${o.h}`, String(o.quantity), m2(o.w * o.h * o.quantity), o.origins.join(" · ")]),
    false, "Chutes à conserver",
  );
  else { w.ensure(20); w.text("Chutes à conserver", 12, true); w.text("Aucune chute réutilisable à conserver.", 8.5, false, GREY); }

  for (const r of result.materials) {
    const mat = materials.find((m) => m.id === r.materialId);
    if (!mat) continue;
    for (const g of groupSheets(r.sheets)) sheetPage(w, g, mat, r, color);
  }

  const n = w.doc.getNumberOfPages();
  const foot = ["Format", info.site, info.taskNumber].filter(Boolean).join(" - ");
  for (let i = 1; i <= n; i++) {
    w.doc.setPage(i);
    w.doc.setDrawColor(...GREY); w.doc.setLineWidth(0.2); w.doc.line(M, w.H - M - 4, w.W - M, w.H - M - 4);
    w.font(7.5, false, GREY);
    w.doc.text(foot, M, w.H - M);
    w.doc.text(`Page ${i} / ${n}`, w.W - M, w.H - M, { align: "right" });
  }
  const name = ["Format", cleanName(info.site), cleanName(info.taskNumber), info.date].filter(Boolean).join("_");
  download(w.doc.output("blob"), `${name}.pdf`);
}
