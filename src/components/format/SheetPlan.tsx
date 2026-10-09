import { useId, useMemo, useState, type MouseEvent } from "react";
import { Maximize2, Minus, Plus, X } from "lucide-react";
import type { Material } from "@/lib/types";
import type { Placement } from "@/lib/optimizer/types";
import { cutSequence, type Cut, type SheetGroup } from "@/lib/cutplan";

const INK = "var(--foreground)";

interface Props { group: SheetGroup; material: Material; colorOf: (pieceId: string) => string }

function PlanSvg({ group, material, colorOf, cuts, onHover, hovered }: Props & {
  cuts: Cut[]; hovered: Placement | null; onHover: (p: Placement | null, e?: MouseEvent) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const s = group.sheet, t = material.trim;
  const big = Math.max(s.width, s.length);
  const m = big * 0.07; // marge pour les cotes
  const fs = big / 55; // taille de texte de reference
  const sw = big / 900;
  return (
    <svg viewBox={`${-m} ${-m} ${s.width + 1.6 * m} ${s.length + 1.6 * m}`} className="h-auto w-full" style={{ fontFamily: "var(--font-mono)" }}>
      <defs>
        <pattern id={`w${uid}`} patternUnits="userSpaceOnUse" width={fs * 1.4} height={fs * 1.4} patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2={fs * 1.4} stroke="var(--offcut-waste)" strokeWidth="var(--hatch-width)" vectorEffect="non-scaling-stroke" />
        </pattern>
        <pattern id={`r${uid}`} patternUnits="userSpaceOnUse" width={fs * 1.4} height={fs * 1.4} patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={fs * 1.4} stroke="var(--offcut-reuse)" strokeWidth="var(--hatch-width)" vectorEffect="non-scaling-stroke" />
        </pattern>
      </defs>
      {/* panneau brut + delignage */}
      <rect x={0} y={0} width={s.width} height={s.length} fill="var(--muted)" stroke={INK} strokeWidth={sw * 2} />
      <rect x={t} y={t} width={s.usableW} height={s.usableL} fill="var(--card)" stroke={INK} strokeWidth={sw * 0.6} strokeDasharray={`${fs / 3} ${fs / 4}`} />
      {/* chutes */}
      {s.offcuts.map((o, i) => {
        const showDim = Math.min(o.w, o.h) > fs * 1.6 && o.w > fs * 6;
        return (
          <g key={i}>
            <rect x={o.x + t} y={o.y + t} width={o.w} height={o.h} fill={`url(#${o.reusable ? "r" : "w"}${uid})`} stroke="var(--muted-foreground)" strokeWidth={sw * 0.5} />
            {showDim && (
              <text x={o.x + t + o.w / 2} y={o.y + t + o.h / 2} fontSize={fs * 0.75} textAnchor="middle" dominantBaseline="middle" fill={INK} paintOrder="stroke" stroke="var(--card)" strokeWidth={fs * 0.25}>
                {Math.round(o.w)} × {Math.round(o.h)}
              </text>
            )}
          </g>
        );
      })}
      {/* pieces */}
      {s.placements.map((p, i) => {
        const x = p.x + t, y = p.y + t;
        const f = Math.min(fs, p.h / 3.2, p.w / 7);
        const tiny = f < fs * 0.35;
        const fl = Math.min(fs, p.h / 1.6, p.w / Math.max(2, p.label.length * 0.75));
        const hl = hovered === p;
        return (
          <g key={i} onMouseMove={(e) => onHover(p, e)} onMouseLeave={() => onHover(null)} style={{ cursor: "default" }}>
            <rect x={x} y={y} width={p.w} height={p.h} fill={colorOf(p.pieceId)} stroke={INK} strokeWidth={hl ? sw * 5 : sw * 1.8} opacity={hovered && !hl ? 0.55 : 1} />
            {tiny ? (
              fl > fs * 0.2 && <text x={x + p.w / 2} y={y + p.h / 2} fontSize={fl} fontWeight={600} textAnchor="middle" dominantBaseline="middle" fill={INK}>{p.label}</text>
            ) : (
              <>
                <text x={x + p.w / 2} y={y + p.h / 2 - f * 0.6} fontSize={f * 1.15} fontWeight={600} textAnchor="middle" dominantBaseline="middle" fill={INK}>{p.label}</text>
                <text x={x + p.w / 2} y={y + p.h / 2 + f * 0.75} fontSize={f} textAnchor="middle" dominantBaseline="middle" fill={INK}>{p.w} × {p.h}</text>
              </>
            )}
            {p.rotated && Math.min(p.w, p.h) > fs * 1.4 && (
              <text x={x + p.w - fs * 0.25} y={y + fs * 0.25} fontSize={fs * 0.9} textAnchor="end" dominantBaseline="hanging" fill={INK}>↻</text>
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
        <text x={s.width / 2} y={-m * 0.6} textAnchor="middle" stroke="none">{s.width}</text>
        <line x1={-m * 0.45} y1={0} x2={-m * 0.45} y2={s.length} />
        <line x1={-m * 0.65} y1={0} x2={-m * 0.2} y2={0} /><line x1={-m * 0.65} y1={s.length} x2={-m * 0.2} y2={s.length} />
        <text x={-m * 0.6} y={s.length / 2} textAnchor="middle" stroke="none" transform={`rotate(-90 ${-m * 0.6} ${s.length / 2})`}>{s.length}</text>
      </g>
    </svg>
  );
}

export function SheetPlan(props: Props) {
  const { group, material } = props;
  const s = group.sheet;
  const [hover, setHover] = useState<{ p: Placement; x: number; y: number } | null>(null);
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState(1);
  const cuts = useMemo(
    () => (material.cutType === "guillotine" ? cutSequence(s.placements, s.usableW, s.usableL, material.kerf, material.trim) : []),
    [s, material],
  );
  const onHover = (p: Placement | null, e?: MouseEvent) => setHover(p && e ? { p, x: e.clientX, y: e.clientY } : null);
  const rows = useMemo(() => {
    const map = new Map<string, { p: Placement; qty: number; pos: string[] }>();
    for (const p of s.placements) {
      const k = `${p.pieceId}|${p.w}|${p.h}|${p.rotated}`;
      const r = map.get(k) ?? { p, qty: 0, pos: [] };
      r.qty++; r.pos.push(`${p.x + material.trim} / ${p.y + material.trim}`);
      map.set(k, r);
    }
    return [...map.values()];
  }, [s, material]);
  const svg = <PlanSvg {...props} cuts={cuts} hovered={hover?.p ?? null} onHover={onHover} />;

  return (
    <div className="space-y-3 rounded-sm border border-border p-3 break-inside-avoid">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold">Panneau {group.indexes.join(", ")}</span>
        <span className="mono text-muted-foreground">{s.width} × {s.length} mm</span>
        {group.count > 1 && <span className="mono rounded-sm bg-foreground px-1.5 py-0.5 text-xs font-semibold text-background">×{group.count}</span>}
        <button className="btn-ghost ml-auto h-7 px-2 text-xs print:hidden" onClick={() => setFull(true)}><Maximize2 size={13} /> Agrandir</button>
      </div>
      <div className="mx-auto max-w-[720px] cursor-zoom-in" onClick={() => setFull(true)}>{svg}</div>
      <p className="text-center text-xs text-muted-foreground">Cotes mesurées depuis le coin brut haut gauche</p>

      {cuts.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]">Séquence de coupe</h4>
          <ol className="space-y-0.5 text-xs">
            {cuts.map((c) => <li key={c.n}><span className="mono font-semibold">{c.n}.</span> {c.text}</li>)}
          </ol>
        </div>
      )}

      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-1 pr-2 font-medium">Repère</th>
            <th className="px-2 py-1 font-medium">Dimensions (mm)</th>
            <th className="px-2 py-1 text-right font-medium">Qté</th>
            <th className="px-2 py-1 font-medium">Tournée</th>
            <th className="px-2 py-1 font-medium">Position X / Y</th>
          </tr>
        </thead>
        <tbody className="mono">
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border align-top">
              <td className="py-1 pr-2 font-sans"><span className="mr-1.5 inline-block h-2.5 w-2.5 border border-foreground align-middle" style={{ background: props.colorOf(r.p.pieceId) }} />{r.p.label}</td>
              <td className="px-2 py-1">{r.p.w} × {r.p.h}</td>
              <td className="px-2 py-1 text-right">{r.qty}</td>
              <td className="px-2 py-1 font-sans">{r.p.rotated ? "oui" : "non"}</td>
              <td className="px-2 py-1">{r.pos.join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hover && (
        <div className="pointer-events-none fixed z-[60] rounded-sm border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <div className="font-semibold">{hover.p.label}{hover.p.rotated ? " ↻ tournée" : ""}</div>
          <div className="mono">{hover.p.w} × {hover.p.h} mm</div>
          <div className="mono text-muted-foreground">X {hover.p.x + material.trim} / Y {hover.p.y + material.trim}</div>
        </div>
      )}

      {full && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm">
            <span className="font-semibold">{material.name} — Panneau {group.indexes.join(", ")}</span>
            <span className="mono text-muted-foreground">{s.width} × {s.length} mm</span>
            <div className="ml-auto flex items-center gap-1">
              <button className="btn-ghost h-8 px-2" onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} aria-label="Dézoomer"><Minus size={15} /></button>
              <span className="mono w-14 text-center text-xs">{Math.round(zoom * 100)} %</span>
              <button className="btn-ghost h-8 px-2" onClick={() => setZoom((z) => Math.min(8, z * 1.25))} aria-label="Zoomer"><Plus size={15} /></button>
              <button className="btn-ghost h-8 px-2" onClick={() => { setFull(false); setZoom(1); }} aria-label="Fermer"><X size={16} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6"
            onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom((z) => Math.min(8, Math.max(0.5, z * (e.deltaY < 0 ? 1.1 : 0.9)))); } }}>
            <div className="mx-auto" style={{ width: `min(${90 * zoom}vw, ${85 * zoom}vh * ${(s.width / s.length).toFixed(4)})` }}>{svg}</div>
          </div>
        </div>
      )}
    </div>
  );
}
