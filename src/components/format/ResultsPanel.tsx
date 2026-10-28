import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { Balance, OptimizeResult, SolutionSummary } from "@/lib/optimizer";
import type { Material, MaterialStatus, Piece } from "@/lib/types";
import type { MaterialResult } from "@/lib/optimizer";
import { indicators, lowerBound, pct1, splitLine, statusSuffix, statusTitle } from "@/lib/indicators";
import { planColor } from "@/lib/palette";
import { groupSheets } from "@/lib/cutplan";
import { SheetPlan } from "./SheetPlan";
import { PanelGroupLabel } from "./PanelGroupLabel";
import type { LinearRecap } from "@/lib/linear";
import { orderEntries } from "@/lib/order";
import type { OrderType } from "@/lib/types";

import { dec, dims, eur, m2, num, panelOrder, reuseCaption } from "@/lib/format";
import type { OffcutSettings } from "@/lib/types";
import { DEFAULT_OFFCUT_SETTINGS, offcutKey } from "@/lib/offcuts";
const pct = (r: number) => `${num(r * 100, 1)} %`;

/** Chiffre cle : petite etiquette en capitales, grand nombre, ligne d'explication. */
function Card({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"><span className={`inline-block h-2.5 w-2.5 rounded-[2px] ${tone}`} />{label}</div>
      <div className="tabular-nums mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em]">{value}</div>
      <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Split({ b }: { b: Balance }) {
  const i = indicators(b);
  return (
    <div className="space-y-1.5">
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden">
        <div className="rounded-l-full bg-foreground" style={{ width: `${i.yieldPct}%` }} />
        <div className="bg-signal" style={{ width: `${i.reusablePct}%` }} />
        <div className="rounded-r-full bg-offcut-waste" style={{ width: `${i.lossPct}%` }} />
      </div>
      <p className="tabular-nums text-xs text-muted-foreground">{splitLine(i)}</p>
    </div>
  );
}

function Kpis({ b, mode }: { b: Balance; mode: OffcutSettings["mode"] }) {
  const i = indicators(b);
  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      <Card label="Chutes réutilisables" value={`${m2(i.reusable)} m² · ${pct1(i.reusablePct)}`} sub={reuseCaption(mode)} tone="bg-signal" />
      <Card label="Perte définitive" value={`${m2(i.loss)} m² · ${pct1(i.lossPct)}`} sub="Matière réellement jetée" tone="bg-offcut-waste" />
    </div>
  );
}

function Badge({ r, mat, pieces }: { r: MaterialResult; mat?: Material | undefined; pieces: Piece[] }) {
  const lb = mat ? lowerBound(mat, pieces) : null;
  if (lb == null || r.unplaced.length) return null;
  const opt = r.sheets.length <= lb;
  return (
    <span title={opt ? undefined : `Borne minimale théorique : ${lb} panneaux`}
      className={`ml-2 rounded-sm border px-1.5 py-0.5 align-middle text-[11px] font-medium ${opt ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
      {opt ? "Résultat optimal" : "Meilleur résultat trouvé"}
    </span>
  );
}

function Banner({ result, status, simple = false, typeOf }: { result: OptimizeResult; status?: MaterialStatus | undefined; simple?: boolean; typeOf: (id: string) => OrderType }) {
  const i = indicators(result.total.balance);
  const s = status ?? { status: "toOrder" as const };
  const title = s.status === "toOrder" ? "À commander" : s.status === "ordered" ? "Commandés" : "À prendre en stock";
  // Bandeau principal : ce qu'il faut commander, en grand, et le rendement a cote
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{simple ? title : statusTitle(s)}{statusSuffix(s)}</p>
        {orderEntries(result.materials, typeOf).map((entry, k) => <div key={k} className="mt-2.5">
          <p className="text-xl font-semibold leading-tight tracking-[-0.02em] tabular-nums md:text-[26px]">{entry.title}</p>
          {entry.estimate && <p className="mt-1 text-xs text-muted-foreground tabular-nums">{entry.estimate}</p>}
        </div>)}
      </div>
      <div className="sm:text-right"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Rendement</p><p className="mt-1 tabular-nums text-[56px] font-semibold leading-none tracking-[-0.04em]">{pct1(i.yieldPct).replace(/\s*%$/, "")}<span className="text-2xl text-muted-foreground"> %</span></p></div>
    </div>
    {!simple && <><p className="tabular-nums text-xs text-muted-foreground">Surface achetée {m2(i.purchased)} m² · pièces {m2(i.pieces)} m²{result.total.totalPrice != null ? ` · prix ${eur(result.total.totalPrice)}` : ""}</p><Split b={result.total.balance} /></>}
  </div>;
}

function Legend({ entries }: { entries: { id: string; label: string; color: string }[] }) {
  const sw = "inline-block h-3.5 w-5 rounded-[1px] border border-foreground align-middle";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-muted/60 px-3 py-2.5 text-xs">
      <span className="font-medium uppercase tracking-[0.08em] text-muted-foreground">Légende</span>
      {entries.map((e) => <span key={e.id} className="flex items-center gap-1.5"><span className={sw} style={{ background: e.color }} />{e.label}</span>)}
      <span className="flex items-center gap-1.5"><span className={`${sw} hatch-reuse`} />Chute réutilisable</span>
      <span className="flex items-center gap-1.5"><span className={`${sw} hatch-waste`} />Perte</span>
      <span className="flex items-center gap-1.5"><span className={`${sw} bg-muted`} />Délignage</span>
      <span className="flex items-center gap-1.5">↻ Pièce tournée</span>
    </div>
  );
}

function Solutions({ list }: { list: SolutionSummary[] }) {
  if (list.length < 2) return null;
  return (
    <details className="rounded-lg border border-border text-xs">
      <summary className="cursor-pointer select-none px-3 py-2 font-medium">Solutions comparées ({list.length})</summary>
      <table className="w-full">
        <thead className="text-left text-muted-foreground">
          <tr className="border-y border-border">
            <th className="px-3 py-1.5 font-normal">Solution</th><th className="px-3 py-1.5 font-normal">Formats utilisés</th>
            <th className="px-3 py-1.5 text-right font-normal">Panneaux</th><th className="px-3 py-1.5 text-right font-normal">Surface achetée (m²)</th>
            <th className="px-3 py-1.5 text-right font-normal">Prix</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.label} className={s.chosen ? "bg-primary/10 font-semibold" : "border-b border-border last:border-0"}>
              <td className="px-3 py-1.5">{s.label}{s.chosen && <span className="ml-2 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">Retenue</span>}</td>
              <td className="tabular-nums px-3 py-1.5">{s.formats.map((f) => `${f.count} × ${dims(f.width, f.length)}`).join(" · ")}</td>
              <td className="tabular-nums px-3 py-1.5 text-right">{s.sheets}</td>
              <td className="tabular-nums px-3 py-1.5 text-right">{m2(s.purchased)}</td>
              <td className="tabular-nums px-3 py-1.5 text-right">{eur(s.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function ResultsPanel({ result, materials, linears = [], pieces = [], status, onStatus = () => {}, offcuts, onOffcuts = () => {}, materialId, summaryOnly = false, workshop = true, orderTypeOf = () => "panels" }: {
  materialId?: string | undefined; summaryOnly?: boolean; workshop?: boolean; orderTypeOf?: (id: string) => OrderType;
  result: OptimizeResult; materials: Material[]; linears?: LinearRecap[]; pieces?: Piece[]; status?: MaterialStatus | undefined; onStatus?: (s: MaterialStatus) => void;
  offcuts?: OffcutSettings | undefined; onOffcuts?: (o: OffcutSettings) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(result.errors.length > 0);
  useEffect(() => { setDetailsOpen(result.errors.length > 0); }, [result, materialId, summaryOnly]);
  const visibleMaterials = result.materials.filter((r) => !materialId || r.materialId === materialId);
  const scoped = visibleMaterials[0];
  const displayResult = materialId && scoped ? { ...result, materials: visibleMaterials, total: { sheets: scoped.sheets.length, totalPrice: scoped.totalPrice, balance: scoped.balance } } : result;
  const oc = offcuts ?? DEFAULT_OFFCUT_SETTINGS;
  const ok = result.errors.length === 0;
  const ids: { id: string; label: string; color: string; materialId: string; width: number; height: number }[] = [];
  for (const r of result.materials) for (const s of r.sheets) for (const p of s.placements)
    if (!ids.some((e) => e.id === p.pieceId)) ids.push({ id: p.pieceId, label: p.label, color: planColor(ids.length) ?? "var(--card)", materialId: r.materialId, width: p.rotated ? p.h : p.w, height: p.rotated ? p.w : p.h });
  const legendEntries = ids.map((e) => {
    const siblings = ids.filter((other) => other.materialId === e.materialId && other.label === e.label);
    const multipleSizes = siblings.some((other) => other.width !== e.width || other.height !== e.height);
    const sameWidth = siblings.every((other) => other.width === e.width);
    return { ...e, label: multipleSizes ? `${e.label} · ${sameWidth ? num(e.height) : dims(e.width, e.height)}` : e.label };
  });
  const mat = (id: string) => materials.find((m) => m.id === id);
  const colorOf = (id: string) => ids.find((e) => e.id === id)?.color ?? "var(--card)";
  const renderSheets = (r: MaterialResult, presentation: "plan" | "tables" | "thumb") => {
    const material = mat(r.materialId);
    if (!material || !r.sheets.length) return null;
    return <div className={presentation === "thumb" ? "grid grid-cols-2 gap-3 md:grid-cols-4" : "grid gap-4 xl:grid-cols-2"}>{groupSheets(r.sheets).map((g) => {
      const sheetIndex = g.indexes[0];
      if (sheetIndex == null) return null;
      const key = (label: string) => offcutKey(r.materialId, sheetIndex, label);
      return <SheetPlan key={g.sheet.index} group={g} material={material} colorOf={colorOf} mode={presentation === "thumb" ? "hide" : oc.mode} presentation={presentation}
        markOf={(label) => ({ keep: oc.marks[key(label)]?.keep ?? true, note: oc.marks[key(label)]?.note ?? "" })}
        onMark={(label, patch) => onOffcuts({ ...oc, marks: { ...oc.marks, [key(label)]: { ...oc.marks[key(label)], ...patch } } })} />;
    })}</div>;
  };
  return (
    <div className="space-y-8 p-5 md:p-6">
      {!ok && <div role="alert" className="flex items-center gap-2 rounded-sm border border-destructive bg-destructive-soft p-3 text-sm font-semibold text-destructive"><AlertTriangle size={18} />La vérification a échoué : consultez les détails avant de découper.</div>}
      <Banner result={displayResult} status={status} simple={!summaryOnly} typeOf={orderTypeOf} />
      {summaryOnly && <Kpis b={result.total.balance} mode={oc.mode} />}
      {!workshop && !ok && <ul className="list-disc pl-5 text-xs text-destructive">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      {workshop && <details open={detailsOpen} onToggle={(e) => setDetailsOpen(e.currentTarget.open)} className="border-y border-border">
        <summary className="cursor-pointer py-3 text-sm font-semibold">Détails</summary>
        <div className="space-y-5 pb-4">
      <div className="flex flex-wrap items-center gap-3">
        {ok ? (
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"><CheckCircle2 size={14} /> Vérification OK</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-destructive-soft px-2 py-1 text-xs font-medium text-destructive"><AlertTriangle size={14} /> {result.errors.length} erreur(s) de vérification</span>
        )}
        <span className="tabular-nums text-xs text-muted-foreground">Calcul en {num(result.durationMs)} ms</span>
      </div>
      {!ok && <ul className="list-disc pl-5 text-xs text-destructive">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}

      {!summaryOnly && linears.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Linéaires</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 pr-2 font-medium">Repère</th><th className="px-2 py-1.5 font-medium">Matériau</th>
                <th className="px-2 py-1.5 text-right font-medium">Bande (mm)</th><th className="px-2 py-1.5 text-right font-medium">Demandé (mm)</th>
                <th className="px-2 py-1.5 font-medium">Pièces obtenues (mm)</th><th className="px-2 py-1.5 text-right font-medium">Produit (mm)</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {linears.map((l) => (
                <tr key={l.id} className={`border-b border-border ${l.ok ? "" : "bg-destructive-soft text-destructive"}`}>
                  <td className="py-1.5 pr-2 font-sans">{l.label}</td><td className="px-2 py-1.5 font-sans">{l.material}</td>
                  <td className="px-2 py-1.5 text-right">{num(l.band, 1)}</td><td className="px-2 py-1.5 text-right">{num(l.requested)}</td>
                  <td className="px-2 py-1.5">{l.segments.map((x) => `${x.count} × ${num(x.length)}`).join(" + ") || "—"}</td>
                  <td className="px-2 py-1.5 text-right">{num(l.produced)} {l.ok ? "✓" : "≠"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!summaryOnly && result.materials.filter((r) => !materialId || r.materialId === materialId).map((r) => (
        <div key={r.materialId} className="space-y-3 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">{r.name} <span className="tabular-nums font-normal text-muted-foreground">{num(r.thickness, 1)} mm</span><Badge r={r} mat={mat(r.materialId)} pieces={pieces} />
            <span className="tabular-nums ml-3 text-xs font-normal text-muted-foreground">{r.sheets.length} panneau(x) · rendement {pct1(indicators(r.balance).yieldPct)}</span></h3>
          <Split b={r.balance} />
          <p className="tabular-nums text-xs text-muted-foreground">Surface achetée {m2(r.balance.purchased)} m² · pièces {m2(r.balance.pieces)} m²</p>
          <Kpis b={r.balance} mode={oc.mode} />
          <p className="tabular-nums text-xs">
            {r.formats.map((f) => `${panelOrder(f.count, f.width, f.length, r.name, r.thickness)}${f.price != null ? ` (${eur(f.count * f.price)})` : ""}`).join(" · ") || "Aucun panneau"}
          </p>
          {r.formatChoice && (
            <p className="text-xs text-muted-foreground">
              {r.formatChoice.kept === "single"
                ? `Un seul format retenu : mélanger les formats ne faisait gagner que ${dec(r.formatChoice.gainPct, 1)} % (seuil ${num(r.formatChoice.thresholdPct, 1)} %, réglable dans le matériau).`
                : `Formats mélangés : ${dec(r.formatChoice.gainPct, 1)} % gagnés par rapport au meilleur format unique (seuil ${num(r.formatChoice.thresholdPct, 1)} %).`}
            </p>
          )}
          <Solutions list={r.solutions ?? []} />
           <Legend entries={legendEntries.filter((e) => e.materialId === r.materialId)} />
          {r.unplaced.length > 0 && (
            <div className="rounded-sm bg-destructive-soft p-3 text-xs text-destructive">
              <div className="mb-1 font-medium">Pièces impossibles à placer</div>
              <ul className="list-disc pl-5">{r.unplaced.map((u) => <li key={u.pieceId}>{u.label} × {u.quantity} — {u.reason}</li>)}</ul>
            </div>
          )}
          {r.sheets.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-1.5 pr-2 font-medium">N°</th>
                  <th className="px-2 py-1.5 font-medium">Format (mm)</th>
                  <th className="px-2 py-1.5 text-right font-medium">Pièces</th>
                  <th className="px-2 py-1.5 text-right font-medium">Chutes réutil. (m²)</th>
                  <th className="px-2 py-1.5 text-right font-medium">Rendement</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {groupSheets(r.sheets).map((g) => (
                  <tr key={g.sheet.index} className="border-b border-border">
                    <td className="py-1.5 pr-2"><PanelGroupLabel indexes={g.indexes} /></td>
                    <td className="px-2 py-1.5">{dims(g.sheet.width, g.sheet.length)}</td>
                    <td className="px-2 py-1.5 text-right">{num(g.sheet.placements.length * g.count)}</td>
                    <td className="px-2 py-1.5 text-right">{m2(g.sheet.offcuts.filter((o) => o.reusable).reduce((a, o) => a + o.w * o.h, 0) * g.count)}</td>
                    <td className="px-2 py-1.5 text-right">{pct(g.sheet.efficiency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {renderSheets(r, "tables")}

        </div>
      ))}
        </div>
      </details>}
      {!summaryOnly && visibleMaterials.map((r) => <div key={r.materialId} className="space-y-3">
        <h4 className="text-lg font-semibold tracking-[-0.01em]">Plans de découpe</h4>
        {renderSheets(r, workshop ? "plan" : "thumb")}
      </div>)}
    </div>
  );
}
