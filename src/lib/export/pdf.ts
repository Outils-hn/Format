// Export "PDF atelier" : dessin vectoriel jsPDF, A4, lisible en noir et blanc.
import { jsPDF } from "jspdf";
import type { Balance, OptimizeResult, SheetResult } from "../optimizer/types";
import type { Material, MaterialStatus, Piece, ProjectInfo } from "../types";
import { indicators, lowerBound, materialLines, pct1, splitLine, statusSuffix, statusTitle } from "../indicators";
import { cutSequence, groupSheets, type Cut, type SheetGroup } from "../cutplan";
import { PLAN_COLORS } from "../palette";
import { cleanName, download, pieceOrder } from "./common";
import { DEFAULT_OFFCUT_SETTINGS, compactOrigins, labeledOffcuts, markResolver, retainedOffcuts, reusableOffcutItems, type MarkOf } from "../offcuts";
import type { OffcutSettings } from "../types";
import { DEFAULT_REUSE_MIN } from "../optimizer/engine";
import { dims, eur, m2, num, panelGroup, panelOrder, positionPair, reuseCaption } from "../format";
import { fitPieceLabel, pieceRowKey } from "../pieceLabels";
import { INTER_BOLD, INTER_REGULAR } from "./interFont";
import type { LinearRecap } from "../linear";

type RGB = [number, number, number];
const INK: RGB = [17, 18, 20];
const GREY: RGB = [112, 115, 121];
const HAIR: RGB = [228, 228, 225]; // filets fins du style Epure
const M = 12; // marge page (mm)
const PT = 2.835; // mm -> pt

/** Convertit une variable CSS (oklch...) en RGB via un canvas. */
function resolveColor(cssVar: string): RGB {
  const name = cssVar.replace(/^var\(|\)$/g, "");
  // Le PDF garde toujours les couleurs claires, meme si l'appli est en mode sombre :
  // on lit la variable une fraction de seconde sans la classe « dark » (rien n'est redessine entre-temps).
  const root = document.documentElement;
  const dark = root.classList.contains("dark");
  if (dark) root.classList.remove("dark");
  const val = getComputedStyle(root).getPropertyValue(name).trim() || "#ddd";
  if (dark) root.classList.add("dark");
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = document.createElement("canvas").getContext("2d"); } catch { /* environnement sans canvas (tests) */ }
  if (!ctx) return [150, 150, 150];
  ctx.fillStyle = val;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0]!, d[1]!, d[2]!];
}

const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

export type TableColumn = { h: string; w: number; right?: boolean; positionPairs?: boolean };

/** X/Y pairs are indivisible, even when jsPDF would split a long word. */
function wrapPositions(doc: jsPDF, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const pair of text.split(" · ")) {
    const next = line ? `${line} · ${pair}` : pair;
    if (line && doc.getTextWidth(next) > width) { lines.push(line); line = pair; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export class Writer {
  doc = (() => {
    const d = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    d.addFileToVFS("Inter-Regular.ttf", INTER_REGULAR); d.addFont("Inter-Regular.ttf", "Inter", "normal");
    d.addFileToVFS("Inter-Bold.ttf", INTER_BOLD); d.addFont("Inter-Bold.ttf", "Inter", "bold");
    d.setFont("Inter", "normal");
    return d;
  })();
  y = M;
  get W() { return this.doc.internal.pageSize.getWidth(); }
  get H() { return this.doc.internal.pageSize.getHeight(); }
  get bottom() { return this.H - M - 8; }
  ensure(h: number) { if (this.y + h > this.bottom) this.newPage(this.W > this.H ? "landscape" : "portrait"); }
  newPage(o: "portrait" | "landscape") { this.doc.addPage("a4", o); this.y = M; }
  /** Couleur imposee pendant le dessin d'un en-tete de tableau (sinon null). */
  headerColor: RGB | null = null;
  font(size: number, bold = false, color: RGB = INK) {
    this.doc.setFont("Inter", bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...(this.headerColor ?? color));
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
      const cells = cols.map((c, j) => c.positionPairs ? wrapPositions(this.doc, r[j] ?? "", c.w * k - 3)
        : this.doc.splitTextToSize(r[j] ?? "", c.w * k - 3) as string[]);
      return { cells, height: heightOf(cells) };
    });
    return { k, header, headerHeight, body, lineHeight, height: headerHeight + body.reduce((sum, r) => sum + r.height, 0) + 3 };
  }
  badge(count: number, x: number, baseline: number) {
    if (count <= 1) return;
    this.font(8, true);
    const label = `×${num(count)}`;
    const width = this.doc.getTextWidth(label) + 4;
    this.doc.setFillColor(...INK);
    this.doc.roundedRect(x, baseline - 3.4, width, 4.8, 0.8, 0.8, "F");
    this.font(8, true, [255, 255, 255]);
    this.doc.text(label, x + 2, baseline);
    this.font(8, true);
  }
  table(cols: TableColumn[], rows: string[][], boldLast = false, title?: string, boldRow?: (i: number) => boolean, badgeCount = 1) {
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
        (cells[j] ?? []).forEach((line, n) => {
          this.font(size * fit, bold);
          if (c.positionPairs) {
            const width = this.doc.getTextWidth(line);
            const available = c.w * layout.k - 3;
            if (width > available) this.font(size * fit * available / width, bold);
          }
          this.doc.text(line, c.right ? x + c.w * layout.k - 1.5 : x + 1.5,
            this.y + (3.6 * size / 8 + n * layout.lineHeight) * fit, { align: c.right ? "right" : "left" });
        });
        x += c.w * layout.k;
      });
      this.y += height * fit;
    };
    if (title) {
      this.font(9, true); this.doc.text(title, M, this.y + 4);
      this.badge(badgeCount, M + this.doc.getTextWidth(title) + 3, this.y + 4);
      this.y += titleHeight;
    }
    // En-tete de tableau : texte gris, filet noir dessous ; lignes separees par des filets clairs
    this.headerColor = GREY;
    drawCells(layout.header, layout.headerHeight, false);
    this.headerColor = null;
    this.doc.setDrawColor(...INK); this.doc.setLineWidth(0.3);
    this.doc.line(M, this.y, this.W - M, this.y);
    layout.body.forEach((r, i) => {
      drawCells(r.cells, r.height, (boldLast && i === rows.length - 1) || !!boldRow?.(i));
      this.doc.setDrawColor(...HAIR); this.doc.setLineWidth(0.2);
      this.doc.line(M, this.y, this.W - M, this.y);
    });
    this.y += 3;
  }
}

/** Logo de l'ecran : panneau decoupe, chute reutilisable en couleur d'accent. */
function logo(w: Writer, x: number, y: number, s = 6) {
  w.doc.setDrawColor(...INK); w.doc.setLineWidth(0.35);
  w.doc.rect(x, y, s, s);
  w.doc.line(x + s * 0.5, y, x + s * 0.5, y + s); w.doc.line(x, y + s * 0.5, x + s * 0.5, y + s * 0.5);
  w.doc.setFillColor(...resolveColor("var(--signal)"));
  w.doc.rect(x + s * 0.5 + 0.35, y + s * 0.5 + 0.35, s * 0.5 - 0.7, s * 0.5 - 0.7, "F");
}

/** En-tete commun aux PDF (style Epure) : logo, titre du document, cartouche du projet. */
export function pageHeader(w: Writer, docTitle: string, info: ProjectInfo, extra?: string) {
  logo(w, M, w.y);
  w.font(13, true); w.doc.text("Format", M + 8.5, w.y + 5);
  w.font(7, false, GREY); w.doc.text(docTitle.toUpperCase(), w.W - M, w.y + 5, { align: "right", charSpace: 0.3 });
  w.y += 14;
  w.font(22, true); w.doc.text(info.site || "Chantier", M, w.y + 6, { maxWidth: w.W - 2 * M });
  w.y += 11;
  const fields: [string, string][] = [["Tâche", info.taskNumber], ["Client", info.client], ["Date", fmtDate(info.date)]];
  if (extra) fields.push(["Matière", extra]);
  const cw = (w.W - 2 * M) / 4;
  fields.forEach(([l, v], i) => {
    const x = M + i * cw;
    w.font(6.5, false, GREY); w.doc.text(l.toUpperCase(), x, w.y + 2.5, { charSpace: 0.25 });
    w.font(9.5, true); w.doc.text(v || "—", x, w.y + 7.5, { maxWidth: cw - 3 });
  });
  w.y += 12;
  w.doc.setDrawColor(...INK); w.doc.setLineWidth(0.4); w.doc.line(M, w.y, w.W - M, w.y);
  w.y += 5;
}

/** Pied de page : filet clair, rappel du projet, numero de page. */
export function pageFooters(w: Writer, info: ProjectInfo) {
  const n = w.doc.getNumberOfPages();
  const foot = ["Format", info.site, info.taskNumber].filter(Boolean).join(" · ");
  for (let i = 1; i <= n; i++) {
    w.doc.setPage(i);
    w.doc.setDrawColor(...HAIR); w.doc.setLineWidth(0.25); w.doc.line(M, w.H - M - 4, w.W - M, w.H - M - 4);
    w.font(7, false, GREY);
    w.doc.text(foot, M, w.H - M);
    w.doc.text(`${i} / ${n}`, w.W - M, w.H - M, { align: "right" });
  }
}

function kpis(w: Writer, b: Balance, sheets: number, mode: OffcutSettings["mode"], mat?: Material, pieces: Piece[] = [], unplaced = 0, compact = false) {
  const i = indicators(b);
  const lb = mat && !unplaced ? lowerBound(mat, pieces) : null;
  const badge = lb == null ? "" : sheets <= lb ? " · Résultat optimal" : ` · Meilleur résultat trouvé (borne minimale théorique : ${lb} panneaux)`;
  w.text(`${sheets} panneau(x) · Rendement ${pct1(i.yieldPct)}${badge}`, 9, true, INK, 1);
  if (compact) return; // un seul materiau : barre et cartes deja dans le bandeau principal
  splitBar(w, b);
  cards(w, i, mode);
}

function splitBar(w: Writer, b: Balance) {
  const i = indicators(b);
  w.ensure(10);
  // Barre fine en trois aplats : pieces (encre), chutes reutilisables (accent), perte (gris)
  const bw = w.W - 2 * M, h = 1.6, gap = 0.5;
  const x1 = M + bw * i.yieldPct / 100, x2 = x1 + bw * i.reusablePct / 100;
  w.doc.setFillColor(...INK); w.doc.rect(M, w.y, Math.max(0, x1 - M - gap), h, "F");
  w.doc.setFillColor(...resolveColor("var(--offcut-reuse)")); w.doc.rect(x1, w.y, Math.max(0, x2 - x1 - gap), h, "F");
  w.doc.setFillColor(...resolveColor("var(--offcut-waste)")); w.doc.rect(x2, w.y, Math.max(0, M + bw - x2), h, "F");
  w.y += h + 2;
  w.text(splitLine(i), 7.5, false, GREY, 1.5);
}

function cards(w: Writer, i: ReturnType<typeof indicators>, mode: OffcutSettings["mode"]) {
  const items: [string, string, string][] = [
    ["Chutes réutilisables", `${m2(i.reusable)} m² · ${pct1(i.reusablePct)}`, reuseCaption(mode)],
    ["Perte définitive", `${m2(i.loss)} m² · ${pct1(i.lossPct)}`, "Matière réellement jetée"],
  ];
  // Deux chiffres cles cote a cote, separes par un simple filet en haut (pas de cadre)
  const gap = 8, h = 17;
  const bw = (w.W - 2 * M - gap) / 2;
  const tones = [resolveColor("var(--offcut-reuse)"), resolveColor("var(--offcut-waste)")];
  w.ensure(h + 2);
  items.forEach(([l, v, sub], k) => {
    const x = M + k * (bw + gap);
    w.doc.setDrawColor(...HAIR); w.doc.setLineWidth(0.3); w.doc.line(x, w.y, x + bw, w.y);
    w.doc.setFillColor(...tones[k]!); w.doc.rect(x, w.y + 3, 2, 2, "F");
    w.font(6.5, false, GREY); w.doc.text(l.toUpperCase(), x + 3.5, w.y + 4.8, { charSpace: 0.25 });
    w.font(13, true); w.doc.text(v, x, w.y + 11.5);
    w.font(6.5, false, GREY); w.doc.text(sub, x, w.y + 15.2);
  });
  w.y += h + 3;
}

/** Formats : ceux reellement utilises ; en catalogue, le nombre de formats proposes en plus. */
function formatsLine(m: Material, used: { width: number; length: number }[]) {
  const s = m.supply;
  if (s.mode !== "catalog" || !used.length) return `Format(s) : ${supplyText(m)}`;
  const list = used.map((f) => `${dims(f.width, f.length)} mm`).join(", ");
  return `Format${used.length > 1 ? "s" : ""} utilisé${used.length > 1 ? "s" : ""} : ${list} (catalogue de ${s.formats.length} formats)`;
}

function supplyText(m: Material) {
  const s = m.supply;
  if (s.mode === "single") return `${dims(s.width, s.length)} mm`;
  if (s.mode === "catalog") return s.formats.map((f) => `${dims(f.width, f.length)}${f.price != null ? ` (${eur(f.price)})` : ""}`).join(", ");
  return `largeur ${num(s.width)} mm, longueur ${num(s.minLength)} à ${num(s.maxLength)} mm par pas de ${num(s.step)} mm`;
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

interface PlanOpts { mode: OffcutSettings["mode"]; mark: MarkOf; lead: number }

function drawPlan(doc: jsPDF, s: SheetResult, mat: Material, cuts: Cut[], color: (id: string) => RGB, ox: number, oy: number, k: number, opts: PlanOpts, refOf: (key: string) => number) {
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
    const kept = opts.mode === "retain" && o.reusable && opts.mark(mat.id, opts.lead, o.label).keep;
    const isReuse = opts.mode === "indicative" ? o.reusable : kept;
    doc.setFillColor(...(isReuse ? reuseBg : wasteBg));
    doc.rect(x, y, w, h, "F");
    hatch(doc, x, y, w, h, hatchSpacing, isReuse ? reuse : waste, isReuse, hatchWidth);
    if (kept) { doc.setDrawColor(...INK); doc.setLineWidth(0.8); doc.rect(x + 0.4, y + 0.4, w - 0.8, h - 0.8); }
    else { doc.setDrawColor(...GREY); doc.setLineWidth(0.15); doc.rect(x, y, w, h); }
    const label = `${o.label} · ${dims(Math.round(o.w), Math.round(o.h))}`;
    doc.setFont("Inter", "normal"); doc.setFontSize(6.5); doc.setTextColor(...INK);
    const tw = doc.getTextWidth(label) + 2;
    const size = Math.min(6.5, 6.5 * (w - 1.5) / tw);
    const extra = kept && h > 9 ? "À CONSERVER" : "";
    if (size >= 4.5 && h > 4.5) {
      doc.setFontSize(size);
      const fw = doc.getTextWidth(label) + 1;
      const cy = y + h / 2 - (extra ? 1.8 : 0);
      doc.setFillColor(255, 255, 255); doc.rect(x + w / 2 - fw / 2, cy - 1.8, fw, 3.6, "F");
      doc.text(label, x + w / 2, cy, { align: "center", baseline: "middle" });
      if (extra) {
        doc.setFont("Inter", "bold"); doc.setFontSize(Math.min(6, size));
        const ew = doc.getTextWidth(extra) + 1;
        if (ew < w - 1) { doc.setFillColor(255, 255, 255); doc.rect(x + w / 2 - ew / 2, cy + 1.9, ew, 3.4, "F"); doc.text(extra, x + w / 2, cy + 3.6, { align: "center", baseline: "middle" }); }
      }
    } else {
      doc.setFont("Inter", "bold");
      const s2 = Math.min(6.5, Math.min(w, h) * PT / 1.5, w * PT / (o.label.length * 0.7));
      if (s2 >= 2) { doc.setFontSize(s2); doc.text(o.label, x + w / 2, y + h / 2, { align: "center", baseline: "middle" }); }
    }
  }
  const measure = (text: string, size: number, bold: boolean) => {
    doc.setFont("Inter", bold ? "bold" : "normal");
    return doc.getStringUnitWidth(text) * size;
  };
  for (const p of s.placements) {
    const x = X(p.x + t), y = Y(p.y + t), w = p.w * k, h = p.h * k;
    doc.setFillColor(...color(p.pieceId)); doc.setDrawColor(...INK); doc.setLineWidth(0.35);
    doc.rect(x, y, w, h, "FD");
    doc.setTextColor(...INK);
    // tailles en pt, dimensions de la pièce converties en pt
    const fit = fitPieceLabel({ label: p.label, dims: dims(p.w, p.h), w: w * PT, h: h * PT, base: 10, min: 6, ref: String(refOf(pieceRowKey(p))), measure });
    const cx = x + w / 2, cy = y + h / 2;
    if (fit?.kind === "text") {
      fit.lines.forEach((line, n) => {
        const lw = line.reduce((a, part) => a + measure(part.text, fit.size, part.bold), 0) / PT;
        let lx = cx - lw / 2;
        const ly = cy + (n - (fit.lines.length - 1) / 2) * fit.size * 1.2 / PT;
        for (const part of line) {
          doc.setFont("Inter", part.bold ? "bold" : "normal"); doc.setFontSize(fit.size);
          doc.text(part.text, lx, ly, { baseline: "middle" });
          lx += measure(part.text, fit.size, part.bold) / PT;
        }
      });
    } else if (fit?.kind === "ref") {
      doc.setFont("Inter", "bold"); doc.setFontSize(fit.size);
      doc.text(fit.text, cx, cy, { align: "center", baseline: "middle" });
    }
    if (p.rotated && Math.min(w, h) > 12) {
      doc.setFont("Inter", "bold"); doc.setFontSize(6.5);
      doc.text("↻", x + w - 1, y + 1, { align: "right", baseline: "top" });
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
    doc.setFont("Inter", "bold"); doc.setFontSize(6.5); doc.setTextColor(...INK);
    doc.text(String(c.n), cx, cy, { align: "center", baseline: "middle" });
  }
  // cotes exterieures
  doc.setDrawColor(...INK); doc.setLineWidth(0.2); doc.setFont("Inter", "normal"); doc.setFontSize(8);
  const a = 4;
  doc.line(X(0), oy - a, X(s.width), oy - a);
  doc.line(X(0), oy - a - 1.5, X(0), oy - 1); doc.line(X(s.width), oy - a - 1.5, X(s.width), oy - 1);
  doc.text(num(s.width), X(s.width / 2), oy - a - 1, { align: "center" });
  doc.line(ox - a, Y(0), ox - a, Y(s.length));
  doc.line(ox - a - 1.5, Y(0), ox - 1, Y(0)); doc.line(ox - a - 1.5, Y(s.length), ox - 1, Y(s.length));
  // Texte vertical : jsPDF centre mal un texte tourne (il le decale loin de la ligne),
  // on le centre donc a la main : il monte depuis le milieu + la moitie de sa longueur.
  const hauteurTexte = num(s.length);
  doc.text(hauteurTexte, ox - a - 1, Y(s.length / 2) + doc.getTextWidth(hauteurTexte) / 2, { angle: 90 });
}

function sheetPage(w: Writer, g: SheetGroup, mat: Material, r: { name: string; thickness: number }, color: (id: string) => RGB, mode: OffcutSettings["mode"], mark: MarkOf) {
  const s = g.sheet;
  const lead = g.indexes[0];
  if (lead === undefined) return;
  w.newPage(s.width > s.length ? "landscape" : "portrait");
  const groupTitle = panelGroup(g.indexes, false);
  w.font(12, true);
  const titleWidth = w.doc.getTextWidth(groupTitle);
  const titleY = w.y + 12 / PT * 1.3 * 0.8;
  w.text(groupTitle, 12, true, INK, 1);
  w.badge(g.count, M + titleWidth + 3, titleY);
  w.text(`${r.name} ${num(r.thickness, 1)} mm · ${dims(s.width, s.length)} mm`, 9, false, GREY, 3);
  const cuts = mat.cutType === "guillotine" ? cutSequence(s.placements, s.usableW, s.usableL, mat.kerf, mat.trim) : [];
  const map = new Map<string, { label: string; w: number; h: number; rot: boolean; qty: number; pos: string[] }>();
  for (const p of s.placements) {
    const key = pieceRowKey(p);
    const e = map.get(key) ?? { label: p.label, w: p.w, h: p.h, rot: p.rotated, qty: 0, pos: [] };
    e.qty++; e.pos.push(positionPair(p.x + mat.trim, p.y + mat.trim)); map.set(key, e);
  }
  const keys = [...map.keys()];
  const refOf = (key: string) => keys.indexOf(key) + 1;
  const pieceCols: TableColumn[] = [{ h: "N°", w: 7, right: true }, { h: "Repère", w: 16 }, { h: "Dimensions (mm)", w: 22 }, { h: "Qté", w: 8, right: true }, { h: "Tournée", w: 12 }, { h: "Position X / Y (mm)", w: 55, positionPairs: true }];
  const pieceRows = [...map.values()].map((e, i) => [String(i + 1), e.label, dims(e.w, e.h), String(e.qty), e.rot ? "oui" : "non", e.pos.join(" · ")]);
  const offcuts = labeledOffcuts(s);
  const offcutCols: TableColumn[] = [{ h: "Repère", w: 14 }, { h: "Dimensions (mm)", w: 30 }, { h: "Surface (m²)", w: 22, right: true }, { h: "Position X / Y (mm)", w: 30, positionPairs: true }];
  if (mode !== "hide") offcutCols.push({ h: mode === "retain" ? "Consigne" : "Destination", w: mode === "retain" ? 50 : 25 });
  const marks = offcuts.map((o) => mode === "retain" && o.reusable ? mark(mat.id, lead, o.label) : null);
  const offcutRows = offcuts.map((o, i) => {
    const row = [o.label, dims(o.w, o.h), m2(o.w * o.h), positionPair(o.x + mat.trim, o.y + mat.trim)];
    const mk = marks[i];
    if (mode === "indicative") row.push(o.reusable ? "Conservable" : "—");
    if (mode === "retain") row.push(mk?.keep ? `À CONSERVER - NE PAS JETER${mk.note.trim() ? ` — ${mk.note.trim()}` : ""}` : "—");
    return row;
  });
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
  drawPlan(w.doc, s, mat, cuts, color, ox, w.y + 4, k, { mode, mark, lead }, refOf);
  w.y += 4 + s.length * k + 3;
  w.font(7.5, false, GREY);
  w.doc.text("Cotes mesurées depuis le coin brut haut gauche", w.W / 2, w.y + 2, { align: "center" });
  w.doc.text("↻ = pièce tournée · numéro seul = renvoi au tableau des pièces", w.W / 2, w.y + 6, { align: "center" });
  w.y += 9;
  // légende chutes avec échantillons
  const swW = 9, swH = 4;
  const entries: [boolean, string, boolean][] = mode === "hide" ? [[false, "chute", false]]
    : mode === "indicative" ? [[true, "chute conservable", false], [false, "perte", false]]
    : [[true, "à conserver (cadre épais)", true], [false, "perte", false]];
  const widths = entries.map(([, l]) => swW + 2 + w.doc.getTextWidth(l));
  const total = widths.reduce((a, b) => a + b, 0) + 8 * (entries.length - 1);
  let lx = w.W / 2 - total / 2;
  entries.forEach(([reusable, label, thick], i) => {
    const stroke = resolveColor(reusable ? "var(--offcut-reuse)" : "var(--offcut-waste)");
    const bg = resolveColor(reusable ? "var(--offcut-reuse-bg)" : "var(--offcut-waste-bg)");
    w.doc.setFillColor(...bg); w.doc.rect(lx, w.y, swW, swH, "F");
    hatch(w.doc, lx, w.y, swW, swH, 2.4, stroke, reusable, 0.2);
    if (thick) { w.doc.setDrawColor(...INK); w.doc.setLineWidth(0.6); } else { w.doc.setDrawColor(...GREY); w.doc.setLineWidth(0.15); }
    w.doc.rect(lx, w.y, swW, swH);
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
  w.table(pieceCols, pieceRows, false, `Pièces — ${groupTitle}`, undefined, g.count);
  if (offcuts.length) w.table(offcutCols, offcutRows, false, `Chutes — ${groupTitle}`, (i) => !!marks[i]?.keep, g.count);
  else {
    w.ensure(13);
    const title = `Chutes — ${groupTitle}`;
    w.font(9, true);
    const width = w.doc.getTextWidth(title);
    const baseline = w.y + 9 / PT * 1.3 * 0.8;
    w.text(title, 9, true);
    w.badge(g.count, M + width + 3, baseline);
    w.text("Aucune chute.", 8, false, GREY);
  }
}

function labelsPage(w: Writer, result: OptimizeResult, mark: MarkOf, info: ProjectInfo) {
  const items = reusableOffcutItems(result, mark);
  if (!items.length) return;
  w.newPage("portrait");
  w.text("Étiquettes des chutes à conserver", 12, true, INK, 3);
  const cols = 2, gap = 4, bw = (w.W - 2 * M - gap) / cols, bh = 42;
  let i = 0;
  for (const o of items) {
    const col = i % cols;
    if (col === 0 && i > 0) w.y += bh + gap;
    if (w.y + bh > w.bottom) { w.newPage("portrait"); }
    const x = M + col * (bw + gap), y = w.y;
    w.doc.setDrawColor(...INK); w.doc.setLineWidth(0.6); w.doc.setLineDashPattern([], 0); w.doc.rect(x, y, bw, bh);
    w.font(8, true); w.doc.text("À CONSERVER - NE PAS JETER", x + 3, y + 5);
    w.font(9, false); w.doc.text(`${o.material} ${num(o.thickness, 1)} mm`, x + 3, y + 11, { maxWidth: bw - 6 });
    w.font(16, true); w.doc.text(`${dims(o.w, o.h)} mm`, x + 3, y + 19);
    w.font(8, false, GREY);
    w.doc.text(`Chantier : ${info.site || "—"} · Tâche : ${info.taskNumber || "—"}`, x + 3, y + 26, { maxWidth: bw - 6 });
    w.doc.text(`Date : ${fmtDate(info.date)}`, x + 3, y + 30.5);
    if (o.note) { w.font(8.5, true); w.doc.text(w.doc.splitTextToSize(`Note : ${o.note}`, bw - 6).slice(0, 2) as string[], x + 3, y + 35); }
    i++;
  }
  w.y += bh + gap;
}

export function exportWorkshopPdf(result: OptimizeResult, materials: Material[], pieces: Piece[], info: ProjectInfo, linears: LinearRecap[] = [], status?: MaterialStatus, offcutSettings?: OffcutSettings) {
  const oc = offcutSettings ?? DEFAULT_OFFCUT_SETTINGS;
  const mark = markResolver(result, oc);
  const w = new Writer();
  const order = pieceOrder(result);
  const palette = PLAN_COLORS.map(resolveColor);
  const color = (id: string) => palette[Math.max(0, order.indexOf(id)) % palette.length]!;

  // Page 1 : en-tete + synthese
  pageHeader(w, "Fiche de débit", info);

  // Bandeau principal : ce qu'il faut commander a gauche, le rendement en grand a droite
  const ti = indicators(result.total.balance);
  const top = w.y;
  w.font(6.5, false, GREY); w.doc.text(`${statusTitle(status)}${statusSuffix(status)}`.toUpperCase(), M, w.y + 2.5, { charSpace: 0.25 });
  w.font(6.5, false, GREY); w.doc.text("RENDEMENT", w.W - M, w.y + 2.5, { align: "right", charSpace: 0.25 });
  w.font(30, true); w.doc.text(pct1(ti.yieldPct), w.W - M, top + 15, { align: "right" });
  w.y += 5;
  for (const l of materialLines(result.materials)) {
    w.font(14, true);
    const lines = w.doc.splitTextToSize(l.text, w.W - 2 * M - 60) as string[];
    for (const line of lines) { w.doc.text(line, M, w.y + 5); w.y += 6.5; }
  }
  w.y = Math.max(w.y, top + 19);
  w.text(`Surface achetée ${m2(ti.purchased)} m² · pièces ${m2(ti.pieces)} m²${result.total.totalPrice != null ? ` · prix ${eur(result.total.totalPrice)}` : ""}`, 7.5, false, GREY, 1.5);
  splitBar(w, result.total.balance);
  cards(w, ti, oc.mode);
  w.y += 2;

  // Un seul materiau : son detail repetait mot pour mot le bandeau principal
  const single = result.materials.length === 1;
  for (const r of result.materials) {
    const mat = materials.find((m) => m.id === r.materialId);
    w.ensure(60);
    w.text(`${r.name} — ${num(r.thickness, 1)} mm`, 12, true, INK, 1);
    if (mat) {
      w.text(formatsLine(mat, r.formats), 8.5, false, INK, 0);
      w.text(`Trait de coupe : ${num(mat.kerf, 1)} mm · Délignage : ${num(mat.trim, 1)} mm par bord · Chute réutilisable à partir de : ${num(mat.reuseMin ?? DEFAULT_REUSE_MIN)} mm · Type de découpe : ${mat.cutType === "guillotine" ? "guillotine (scie à panneaux)" : "libre (CNC)"} · Sens imposé : ${mat.grainLocked ? "oui" : "non"}`, 8.5, false, INK, 2);
    }
    kpis(w, r.balance, r.sheets.length, oc.mode, mat, pieces, r.unplaced.length, single);
    if (r.formats.length && !single)
      w.text(`${statusTitle(status)} : ${r.formats.map((f) => `${panelOrder(f.count, f.width, f.length, r.name, r.thickness)}${f.price != null ? ` (${eur(f.count * f.price)})` : ""}`).join(" · ")}${statusSuffix(status)}`, 8.5, true, INK, 2);
    if (r.unplaced.length) w.text(`Pièces impossibles à placer : ${r.unplaced.map((u) => `${u.label} × ${u.quantity} (${u.reason})`).join(" ; ")}`, 8.5, true, INK, 2);
    const list = pieces.filter((p) => p.materialId === r.materialId);
    const qty = list.reduce((a, p) => a + p.quantity, 0);
    const area = list.reduce((a, p) => a + (p.width ?? 0) * (p.height ?? 0) * p.quantity, 0);
    w.table(
      [{ h: "Repère", w: 30 }, { h: "Dimensions (mm)", w: 35 }, { h: "Quantité", w: 18, right: true }, { h: "Surface (m²)", w: 20, right: true }],
      [...list.map((p) => [p.label, p.width && p.height ? dims(p.width, p.height) : "?", num(p.quantity), m2((p.width ?? 0) * (p.height ?? 0) * p.quantity)]),
        ["Total", "", num(qty), m2(area)]],
      true,
    );
    w.y += 3;
  }

  if (linears.length) {
    w.table(
      [{ h: "Repère", w: 18 }, { h: "Matériau", w: 30 }, { h: "Bande (mm)", w: 18, right: true }, { h: "Demandé (mm)", w: 22, right: true }, { h: "Pièces obtenues (mm)", w: 54 }, { h: "Produit (mm)", w: 22, right: true }],
      linears.map((l) => [l.label, l.material, num(l.band, 1), num(l.requested), l.segments.map((x) => `${x.count} × ${num(x.length)}`).join(" + ") || "—", `${num(l.produced)}${l.ok ? "" : " (!)"}`]),
      false, "Linéaires",
    );
    w.y += 3;
  }

  if (oc.mode !== "hide") {
    const retain = oc.mode === "retain";
    const title = retain ? "Chutes à conserver" : "Chutes conservables";
    const retained = retainedOffcuts(result, retain ? mark : undefined);
    w.ensure(30);
    w.text(title, 12, true, INK, 1);
    if (!retain) {
      const used = result.materials.map((r) => ({ r, m: materials.find((x) => x.id === r.materialId) }));
      const limits = [...new Set(used.map(({ m }) => m?.reuseMin ?? DEFAULT_REUSE_MIN))];
      if (limits.length === 1) w.text(`À titre indicatif : chutes de ${num(limits[0]!)} mm et plus dans les deux dimensions`, 8.5, false, GREY, 1);
      else for (const { r, m } of used) w.text(`À titre indicatif (${r.name}) : chutes de ${num(m?.reuseMin ?? DEFAULT_REUSE_MIN)} mm et plus dans les deux dimensions`, 8.5, false, GREY, 0.5);
    }
    if (retained.length) {
      const cols: TableColumn[] = [{ h: "Matériau", w: 26 }, { h: "Ép. (mm)", w: 13, right: true }, { h: "Dimensions (mm)", w: 26 }, { h: "Qté", w: 9, right: true }, { h: "Surface (m²)", w: 20, right: true }, { h: "Panneau / Repère", w: 36 }];
      if (retain) cols.push({ h: "Note", w: 30 });
      w.table(cols, retained.map((o) => {
        const row = [o.material, num(o.thickness, 1), dims(o.w, o.h), num(o.quantity), m2(o.w * o.h * o.quantity), compactOrigins(o.origins)];
        if (retain) row.push(o.notes.join(" · "));
        return row;
      }));
    } else w.text(retain ? "Aucune chute à conserver." : "Aucune chute conservable.", 8.5, false, GREY);
  }

  for (const r of result.materials) {
    const mat = materials.find((m) => m.id === r.materialId);
    if (!mat) continue;
    for (const g of groupSheets(r.sheets)) sheetPage(w, g, mat, r, color, oc.mode, mark);
  }
  if (oc.mode === "retain" && oc.labelsPage) {
    labelsPage(w, result, mark, info);
  }

  pageFooters(w, info);
  const name = ["Format", cleanName(info.site), cleanName(info.taskNumber), info.date].filter(Boolean).join("_");
  download(w.doc.output("blob"), `${name}.pdf`);
}
