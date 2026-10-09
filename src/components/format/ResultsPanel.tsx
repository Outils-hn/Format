import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { Balance, OptimizeResult, SolutionSummary } from "@/lib/optimizer";
import type { Material } from "@/lib/types";
import { planColor } from "@/lib/palette";
import { groupSheets } from "@/lib/cutplan";
import { SheetPlan } from "./SheetPlan";
import type { LinearRecap } from "@/lib/linear";

const m2 = (mm2: number) => (mm2 / 1e6).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (r: number) => `${(r * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const eur = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`);
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-sm border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mono mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="mono text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function BalanceLine({ b }: { b: Balance }) {
  return (
    <p className="mono text-xs text-muted-foreground">
      Surface achetée {m2(b.purchased)} m² = pièces {m2(b.pieces)} + délignage {m2(b.trim)} + chutes réutilisables {m2(b.reusable)} + pertes {m2(b.losses)} m²
      <span className="font-sans"> (traits de coupe et petites chutes)</span>
    </p>
  );
}

function Kpis({ b, sheets, price }: { b: Balance; sheets: number; price: number | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Kpi label="Panneaux" value={String(sheets)} sub={`${m2(b.purchased)} m² achetés`} />
      <Kpi label="Rendement brut" value={pct(ratio(b.pieces, b.purchased))} sub={`${m2(b.pieces)} m² de pièces`} />
      <Kpi label="Rendement hors chutes réutil." value={pct(ratio(b.pieces, b.purchased - b.reusable))} />
      <Kpi label="Chutes réutilisables" value={`${m2(b.reusable)} m²`} />
      <Kpi label="Prix total" value={eur(price)} />
    </div>
  );
}

function Legend({ entries }: { entries: { id: string; label: string; color: string }[] }) {
  const sw = "inline-block h-3.5 w-5 rounded-[1px] border border-foreground align-middle";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-sm border border-border p-3 text-xs">
      <span className="font-semibold uppercase tracking-[0.14em]">Légende</span>
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
    <details className="rounded-sm border border-border text-xs">
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
              <td className="mono px-3 py-1.5">{s.formats.map((f) => `${f.count} × ${f.width} × ${f.length}`).join(" · ")}</td>
              <td className="mono px-3 py-1.5 text-right">{s.sheets}</td>
              <td className="mono px-3 py-1.5 text-right">{m2(s.purchased)}</td>
              <td className="mono px-3 py-1.5 text-right">{eur(s.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function ResultsPanel({ result, materials, linears = [] }: { result: OptimizeResult; materials: Material[]; linears?: LinearRecap[] }) {
  const ok = result.errors.length === 0;
  const ids: { id: string; label: string; color: string }[] = [];
  for (const r of result.materials) for (const s of r.sheets) for (const p of s.placements)
    if (!ids.some((e) => e.id === p.pieceId)) ids.push({ id: p.pieceId, label: p.label, color: planColor(ids.length)! });
  const mat = (id: string) => materials.find((m) => m.id === id);
  const colorOf = (id: string) => ids.find((e) => e.id === id)?.color ?? "var(--card)";
  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {ok ? (
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"><CheckCircle2 size={14} /> Vérification OK</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-destructive-soft px-2 py-1 text-xs font-medium text-destructive"><AlertTriangle size={14} /> {result.errors.length} erreur(s) de vérification</span>
        )}
        <span className="mono text-xs text-muted-foreground">Calcul en {result.durationMs} ms</span>
      </div>
      {!ok && <ul className="list-disc pl-5 text-xs text-destructive">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em]">Total</h3>
        <Kpis b={result.total.balance} sheets={result.total.sheets} price={result.total.totalPrice} />
        <BalanceLine b={result.total.balance} />
      </div>

      {linears.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em]">Linéaires</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 pr-2 font-medium">Repère</th><th className="px-2 py-1.5 font-medium">Matériau</th>
                <th className="px-2 py-1.5 text-right font-medium">Bande (mm)</th><th className="px-2 py-1.5 text-right font-medium">Demandé (mm)</th>
                <th className="px-2 py-1.5 font-medium">Tronçons obtenus (mm)</th><th className="px-2 py-1.5 text-right font-medium">Produit (mm)</th>
              </tr>
            </thead>
            <tbody className="mono">
              {linears.map((l) => (
                <tr key={l.id} className={`border-b border-border ${l.ok ? "" : "bg-destructive-soft text-destructive"}`}>
                  <td className="py-1.5 pr-2 font-sans">{l.label}</td><td className="px-2 py-1.5 font-sans">{l.material}</td>
                  <td className="px-2 py-1.5 text-right">{l.band}</td><td className="px-2 py-1.5 text-right">{l.requested}</td>
                  <td className="px-2 py-1.5">{l.segments.map((x) => `${x.count} × ${x.length}`).join(" + ") || "—"}</td>
                  <td className="px-2 py-1.5 text-right">{l.produced} {l.ok ? "✓" : "≠"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.materials.map((r) => (
        <div key={r.materialId} className="space-y-3 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">{r.name} <span className="mono font-normal text-muted-foreground">{r.thickness} mm</span></h3>
          <Kpis b={r.balance} sheets={r.sheets.length} price={r.totalPrice} />
          <BalanceLine b={r.balance} />
          <p className="mono text-xs">
            {r.formats.map((f) => `${f.count} × ${f.width} × ${f.length}${f.price != null ? ` (${eur(f.count * f.price)})` : ""}`).join(" · ") || "Aucun panneau"}
          </p>
          <Solutions list={r.solutions ?? []} />
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
              <tbody className="mono">
                {r.sheets.map((s) => (
                  <tr key={s.index} className="border-b border-border">
                    <td className="py-1.5 pr-2">{s.index}</td>
                    <td className="px-2 py-1.5">{s.width} × {s.length}</td>
                    <td className="px-2 py-1.5 text-right">{s.placements.length}</td>
                    <td className="px-2 py-1.5 text-right">{m2(s.offcuts.filter((o) => o.reusable).reduce((a, o) => a + o.w * o.h, 0))}</td>
                    <td className="px-2 py-1.5 text-right">{pct(s.efficiency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {mat(r.materialId) && r.sheets.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em]">Plans de découpe</h4>
              <Legend entries={ids.filter((e) => r.sheets.some((s) => s.placements.some((p) => p.pieceId === e.id)))} />
              <div className="grid gap-4 xl:grid-cols-2">
                {groupSheets(r.sheets).map((g) => <SheetPlan key={g.sheet.index} group={g} material={mat(r.materialId)!} colorOf={colorOf} />)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
