import { useId, useMemo, useState, type MouseEvent } from "react";
import { Maximize2, Minus, Plus, X } from "lucide-react";
import type { Material, OffcutSettings } from "@/lib/types";
import type { Placement } from "@/lib/optimizer/types";
import { cutSequence, type Cut, type SheetGroup } from "@/lib/cutplan";
import { labeledOffcuts, type Mark } from "@/lib/offcuts";
import { dims, m2, num, positionPair } from "@/lib/format";
import { PanelGroupLabel } from "./PanelGroupLabel";
import { fitPieceLabel, pieceRowKey, type Measure } from "@/lib/pieceLabels";

const INK = "var(--foreground)";

let ctx: CanvasRenderingContext2D | null | undefined;
/** Largeur réelle du texte en Geist (approximation si le canvas est indisponible). */
const measure: Measure = (text, size, bold) => {
  if (ctx === undefined) ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!ctx) return text.length * size * 0.6;
  ctx.font = `${bold ? 600 : 400} 100px Geist, Inter, ui-sans-serif, system-ui, sans-serif`;
  return (ctx.measureText(text).width / 100) * size * 1.04;
};

interface Props {
  group: SheetGroup; material: Material; colorOf: (pieceId: string) => string;
  mode?: OffcutSettings["mode"];
  presentation?: "all" | "plan" | "tables" | "thumb";
  markOf?: (label: string) => Mark;
  onMark?: (label: string, patch: Partial<Mark>) => void;
}

function PlanSvg({ group, material, colorOf, cuts, onHover, hovered, refOf, mode = "indicative", markOf }: Props & {
  cuts: Cut[]; hovered: Placement | null; onHover: (p: Placement | null, e?: MouseEvent) => void; refOf: (p: Placement) => number;
}) {
  const uid = useId().replace(/:/g, "");
  const s = group.sheet, t = material.trim;
  const big = Math.max(s.width, s.length);
  const m = big * 0.07; // marge pour les cotes
  const fs = big / 55; // taille de texte de reference
  const minFs = fs * 0.59; // équivalent de 6 pt pour une base d'environ 10 pt
  const sw = big / 900;
  return (
    <svg viewBox={`${-m} ${-m} ${s.width + 1.6 * m} ${s.length + 1.6 * m}`} className="h-auto w-full" style={{ fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums" }}>
      <defs>
        <pattern id={`w${uid}`} patternUnits="userSpaceOnUse" width={fs * 1.4} height={fs * 1.4} patternTransform="rotate(-45)">
          <rect width={fs * 1.4} height={fs * 1.4} fill="var(--offcut-waste-bg)" />
          <line x1="0" y1="0" x2="0" y2={fs * 1.4} stroke="var(--offcut-waste)" strokeWidth="var(--hatch-width)" vectorEffect="non-scaling-stroke" />
        </pattern>
        <pattern id={`r${uid}`} patternUnits="userSpaceOnUse" width={fs * 1.4} height={fs * 1.4} patternTransform="rotate(45)">
          <rect width={fs * 1.4} height={fs * 1.4} fill="var(--offcut-reuse-bg)" />
          <line x1="0" y1="0" x2="0" y2={fs * 1.4} stroke="var(--offcut-reuse)" strokeWidth="var(--hatch-width)" vectorEffect="non-scaling-stroke" />
        </pattern>
      </defs>
      {/* panneau brut + delignage */}
      <rect x={0} y={0} width={s.width} height={s.length} fill="var(--muted)" stroke={INK} strokeWidth={sw * 2} />
      <rect x={t} y={t} width={s.usableW} height={s.usableL} fill="var(--card)" stroke={INK} strokeWidth={sw * 0.6} strokeDasharray={`${fs / 3} ${fs / 4}`} />
      {/* chutes */}
      {labeledOffcuts(s).map((o) => {
        const kept = mode === "retain" && o.reusable && (markOf?.(o.label).keep ?? true);
        const reuse = mode === "retain" ? kept : o.reusable;
        const showDim = Math.min(o.w, o.h) > fs * 1.6 && o.w > fs * 6;
        const labelSize = Math.min(fs * 0.9, o.h / 2.5, o.w / (o.label.length * 0.8));
        return (
          <g key={o.label}>
            <title>{o.label} — {dims(o.w, o.h)} mm{reuse ? (mode === "retain" ? " — À conserver" : " — Conservable") : ""}</title>
            <rect x={o.x + t} y={o.y + t} width={o.w} height={o.h} fill={`url(#${reuse ? "r" : "w"}${uid})`} stroke={kept ? INK : "var(--muted-foreground)"} strokeWidth={kept ? sw * 4 : sw * 0.5} />
            {labelSize > fs * 0.15 && <text x={o.x + t + o.w / 2} y={o.y + t + o.h / 2 - (showDim ? fs * 0.55 : 0)} fontSize={labelSize} fontWeight={600} textAnchor="middle" dominantBaseline="middle" fill={INK} paintOrder="stroke" stroke="var(--card)" strokeWidth={labelSize * 0.25}>{o.label}</text>}
            {showDim && (
              <text x={o.x + t + o.w / 2} y={o.y + t + o.h / 2 + fs * 0.55} fontSize={fs * 0.75} textAnchor="middle" dominantBaseline="middle" fill={INK} paintOrder="stroke" stroke="var(--card)" strokeWidth={fs * 0.25}>
                {dims(Math.round(o.w), Math.round(o.h))}
              </text>
            )}
          </g>
        );
      })}
      {/* pieces */}
      {s.placements.map((p, i) => {
        const x = p.x + t, y = p.y + t;
        const hl = hovered === p;
        const fit = fitPieceLabel({ label: p.label, dims: dims(p.w, p.h), w: p.w, h: p.h, base: fs, min: minFs, ref: String(refOf(p)), measure });
        const cx = x + p.w / 2, cy = y + p.h / 2;
        return (
          <g key={i} onMouseMove={(e) => onHover(p, e)} onMouseLeave={() => onHover(null)} style={{ cursor: "default" }}>
            <rect x={x} y={y} width={p.w} height={p.h} fill={colorOf(p.pieceId)} stroke={INK} strokeWidth={hl ? sw * 5 : sw * 1.8} opacity={hovered && !hl ? 0.55 : 1} />
            {fit?.kind === "text" && fit.lines.map((line, n) => (
              <text key={n} x={cx} y={cy + (n - (fit.lines.length - 1) / 2) * fit.size * 1.2} fontSize={fit.size} textAnchor="middle" dominantBaseline="central" fill={INK}>
                {line.map((part, j) => <tspan key={j} fontWeight={part.bold ? 600 : 400}>{part.text}</tspan>)}
              </text>
            ))}
            {fit?.kind === "ref" && (
              <text x={cx} y={cy} fontSize={fit.size} fontWeight={600} textAnchor="middle" dominantBaseline="central" fill={INK}>{fit.text}</text>
            )}
            {p.rotated && Math.min(p.w, p.h) > fs * 3 && (
              <text x={x + p.w - fs * 0.25} y={y + fs * 0.25} fontSize={fs * 0.8} textAnchor="end" dominantBaseline="hanging" fill={INK}>↻</text>
            )}
          </g>
        );
      })}
      {/* coupes numerotees */}
      {cuts.map((c) => {
        const k = material.kerf / 2;
        const [x1, y1, x2, y2] = c.dir === "h"
          ? [c.from + t, c.pos + k + t, c.to + t, c.pos + k + t]
          : [c.pos + k + t, c.from + t, c.pos + k + t, c.to + t];
        const r = fs * 0.55;
        const cx = c.dir === "h" ? x1 + r * 1.2 : x1, cy = c.dir === "h" ? y1 : y1 + r * 1.2;
        return (
          <g key={c.n} pointerEvents="none">
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={sw * 1.2} strokeDasharray={`${fs / 2.5} ${fs / 3.5}`} />
            <circle cx={cx} cy={cy} r={r} fill="var(--card)" stroke={INK} strokeWidth={sw} />
            <text x={cx} y={cy} fontSize={fs * 0.6} textAnchor="middle" dominantBaseline="central" fill={INK} fontWeight={600}>{c.n}</text>
          </g>
        );
      })}
      {/* cotes exterieures */}
      <g stroke={INK} strokeWidth={sw} fill={INK} fontSize={fs}>
        <line x1={0} y1={-m * 0.45} x2={s.width} y2={-m * 0.45} />
        <line x1={0} y1={-m * 0.65} x2={0} y2={-m * 0.2} /><line x1={s.width} y1={-m * 0.65} x2={s.width} y2={-m * 0.2} />
        <text x={s.width / 2} y={-m * 0.6} textAnchor="middle" stroke="none">{num(s.width)}</text>
        <line x1={-m * 0.45} y1={0} x2={-m * 0.45} y2={s.length} />
        <line x1={-m * 0.65} y1={0} x2={-m * 0.2} y2={0} /><line x1={-m * 0.65} y1={s.length} x2={-m * 0.2} y2={s.length} />
        <text x={-m * 0.6} y={s.length / 2} textAnchor="middle" stroke="none" transform={`rotate(-90 ${-m * 0.6} ${s.length / 2})`}>{num(s.length)}</text>
      </g>
    </svg>
  );
}

export function SheetPlan(props: Props) {
  const { group, material, mode = "indicative", markOf, onMark, presentation = "all" } = props;
  const s = group.sheet;
  const [hover, setHover] = useState<{ p: Placement; x: number; y: number } | null>(null);
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState(1);
  const cuts = useMemo(
    () => (material.cutType === "guillotine" && presentation !== "thumb" ? cutSequence(s.placements, s.usableW, s.usableL, material.kerf, material.trim) : []),
    [s, material],
  );
  const onHover = (p: Placement | null, e?: MouseEvent) => setHover(p && e ? { p, x: e.clientX, y: e.clientY } : null);
  const rows = useMemo(() => {
    const map = new Map<string, { p: Placement; qty: number; pos: string[] }>();
    for (const p of s.placements) {
      const k = pieceRowKey(p);
      const r = map.get(k) ?? { p, qty: 0, pos: [] };
      r.qty++; r.pos.push(positionPair(p.x + material.trim, p.y + material.trim));
      map.set(k, r);
    }
    return [...map.entries()];
  }, [s, material]);
  const refOf = (p: Placement) => rows.findIndex(([k]) => k === pieceRowKey(p)) + 1;
  const svg = <PlanSvg {...props} cuts={cuts} hovered={hover?.p ?? null} onHover={onHover} refOf={refOf} />;
  const th = "px-2 py-1 font-medium";
  const fullView = (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm">
            <span className="font-semibold">{material.name} — <PanelGroupLabel indexes={group.indexes} /></span>
            <span className="tabular-nums text-muted-foreground">{dims(s.width, s.length)} mm</span>
            <div className="ml-auto flex items-center gap-1">
              <button className="btn-ghost h-8 px-2" onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} aria-label="Dézoomer"><Minus size={15} /></button>
              <span className="tabular-nums w-14 text-center text-xs">{Math.round(zoom * 100)} %</span>
              <button className="btn-ghost h-8 px-2" onClick={() => setZoom((z) => Math.min(8, z * 1.25))} aria-label="Zoomer"><Plus size={15} /></button>
              <button className="btn-ghost h-8 px-2" onClick={() => { setFull(false); setZoom(1); }} aria-label="Fermer"><X size={16} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6"
            onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom((z) => Math.min(8, Math.max(0.5, z * (e.deltaY < 0 ? 1.1 : 0.9)))); } }}>
            <div className="mx-auto" style={{ width: `min(${90 * zoom}vw, ${85 * zoom}vh * ${(s.width / s.length).toFixed(4)})` }}>{svg}</div>
          </div>
        </div>
);

  if (presentation === "thumb") return (
    <div className="space-y-2 rounded-xl border border-border p-3 transition-colors hover:border-foreground/30">
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <span className="font-semibold"><PanelGroupLabel indexes={group.indexes} /></span>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">{dims(s.width, s.length)}</span>
      </div>
      <button type="button" aria-label="Agrandir le plan" className="block w-full cursor-zoom-in" onClick={() => setFull(true)}>{svg}</button>
      {full && fullView}
    </div>
  );

  return (
    <div className="space-y-3 rounded-xl border border-border p-4 break-inside-avoid">
      {presentation !== "tables" && <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold"><PanelGroupLabel indexes={group.indexes} /></span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{dims(s.width, s.length)} mm</span>
        <button className="btn-ghost ml-auto h-7 px-2 text-xs print:hidden" onClick={() => setFull(true)}><Maximize2 size={13} /> Agrandir</button>
      </div>
      <div className="mx-auto max-w-[720px] cursor-zoom-in" onClick={() => setFull(true)}>{svg}</div>
      <p className="text-center text-xs text-muted-foreground">Cotes mesurées depuis le coin brut haut gauche</p>

      {cuts.length > 0 && (
        <div>
          <h4 className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Séquence de coupe</h4>
          <ol className="space-y-0.5 text-xs tabular-nums">
            {cuts.map((c) => <li key={c.n}><span className="font-semibold">{c.n}.</span> {c.text}</li>)}
          </ol>
        </div>
      )}

      </>}
      {presentation !== "plan" && <>
      <h4 className="flex flex-wrap items-center gap-2 text-xs font-semibold">Pièces — <PanelGroupLabel indexes={group.indexes} /></h4>
      <table className="w-full text-xs tabular-nums">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className={`${th} text-right`}>N°</th>
            <th className={`${th} text-left`}>Repère</th>
            <th className={`${th} text-left`}>Dimensions (mm)</th>
            <th className={`${th} text-right`}>Qté</th>
            <th className={`${th} text-left`}>Tournée</th>
            <th className={`${th} text-left`}>Position X / Y (mm)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, r], i) => (
            <tr key={k} className="border-b border-border align-top">
              <td className="px-2 py-1 text-right">{i + 1}</td>
              <td className="px-2 py-1"><span className="mr-1.5 inline-block h-2.5 w-2.5 border border-foreground align-middle" style={{ background: props.colorOf(r.p.pieceId) }} />{r.p.label}</td>
              <td className="whitespace-nowrap px-2 py-1">{dims(r.p.w, r.p.h)}</td>
              <td className="px-2 py-1 text-right">{r.qty}</td>
              <td className="px-2 py-1">{r.p.rotated ? "oui" : "non"}</td>
              <td className="px-2 py-1">{r.pos.map((pos, j) => <span key={j}>{j > 0 && " · "}<span className="whitespace-nowrap">{pos}</span></span>)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <h4 className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold">Chutes — <PanelGroupLabel indexes={group.indexes} /></h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted-foreground"><tr className="border-b border-border">
              <th className={`${th} text-left`}>Repère</th><th className={`${th} text-left`}>Dimensions (mm)</th>
              <th className={`${th} text-right`}>Surface (m²)</th><th className={`${th} text-left`}>Position X / Y (mm)</th>
              <th className={`${th} text-left`}>{mode === "retain" ? "Consigne" : "Destination"}</th>
            </tr></thead>
            <tbody>{labeledOffcuts(s).map((o) => {
              const mk = markOf?.(o.label) ?? { keep: true, note: "" };
              return (
                <tr key={o.label} className="border-b border-border align-middle">
                  <td className="px-2 py-1 font-semibold">{o.label}</td><td className="whitespace-nowrap px-2 py-1">{dims(o.w, o.h)}</td>
                  <td className="px-2 py-1 text-right">{m2(o.w * o.h)}</td>
                  <td className="whitespace-nowrap px-2 py-1">{positionPair(o.x + material.trim, o.y + material.trim)}</td>
                  <td className="px-2 py-1">
                    {mode === "retain" && o.reusable ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <input type="checkbox" className="accent-primary" checked={mk.keep} aria-label={`À conserver ${o.label}`}
                            onChange={(e) => onMark?.(o.label, { keep: e.target.checked })} />
                          À conserver
                        </label>
                        <input className="input-tech h-7 min-w-28 flex-1 text-xs" placeholder="Note" aria-label={`Note ${o.label}`}
                          value={mk.note} disabled={!mk.keep} onChange={(e) => onMark?.(o.label, { note: e.target.value })} />
                      </div>
                    ) : (
                      <><span className={`mr-1.5 inline-block h-3 w-4 border border-border align-middle ${o.reusable ? "hatch-reuse" : "hatch-waste"}`} />{o.reusable ? "Conservable" : "Perte"}</>
                    )}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        {s.offcuts.length === 0 && <p className="text-xs text-muted-foreground">Aucune chute.</p>}
      </div>

      </>}
      {hover && (
        <div className="pointer-events-none fixed z-[60] rounded-lg border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <div className="font-semibold">N° {refOf(hover.p)} · {hover.p.label}{hover.p.rotated ? " ↻ tournée" : ""}</div>
          <div className="tabular-nums">{dims(hover.p.w, hover.p.h)} mm</div>
          <div className="tabular-nums text-muted-foreground">X {num(hover.p.x + material.trim, 1)} / Y {num(hover.p.y + material.trim, 1)}</div>
        </div>
      )}

      {full && fullView}
    </div>
  );
}
