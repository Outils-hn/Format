import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { Balance, OptimizeResult, SolutionSummary } from "@/lib/optimizer";
import type { Material, MaterialStatus, Piece } from "@/lib/types";
import type { MaterialResult } from "@/lib/optimizer";
import { indicators, lowerBound, materialLines, pct1, splitLine, statusSuffix, statusTitle } from "@/lib/indicators";
import { planColor } from "@/lib/palette";
import { groupSheets } from "@/lib/cutplan";
import { SheetPlan } from "./SheetPlan";
import type { LinearRecap } from "@/lib/linear";

import { dims, eur, m2, num } from "@/lib/format";
import type { OffcutSettings } from "@/lib/types";
import { DEFAULT_OFFCUT_SETTINGS, offcutKey } from "@/lib/offcuts";
const pct = (r: number) => `${num(r * 100, 1)} %`;

function Card({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="rounded-sm border border-border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`inline-block h-3 w-4 rounded-[1px] border border-foreground ${tone}`} />{label}</div>
      <div className="tabular-nums mt-1 text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Split({ b }: { b: Balance }) {
  const i = indicators(b);
  return (
    <div className="space-y-1.5">
      <div className="flex h-3 w-full overflow-hidden rounded-sm border border-foreground">
        <div className="bg-primary" style={{ width: `${i.yieldPct}%` }} />
        <div className="hatch-reuse" style={{ width: `${i.reusablePct}%` }} />
        <div className="hatch-waste" style={{ width: `${i.lossPct}%` }} />
      </div>
      <p className="tabular-nums text-xs text-muted-foreground">{splitLine(i)}</p>
    </div>
  );
}

function Kpis({ b }: { b: Balance }) {
  const i = indicators(b);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card label="Chutes réutilisables" value={`${m2(i.reusable)} m² · ${pct1(i.reusablePct)}`} sub="À conserver pour d'autres travaux" tone="hatch-reuse" />
      <Card label="Perte définitive" value={`${m2(i.loss)} m² · ${pct1(i.lossPct)}`} sub="Matière réellement jetée" tone="hatch-waste" />
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

function Banner({ result, status, onStatus }: { result: OptimizeResult; status?: MaterialStatus | undefined; onStatus: (s: MaterialStatus) => void }) {
  const i = indicators(result.total.balance);
  const s = status ?? { status: "toOrder" as const };
  return (
    <div className="space-y-3 rounded-sm border border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{statusTitle(s)}{statusSuffix(s)}</div>
          {materialLines(result.materials).map((l, k) => (
            <div key={k} className="mt-1 text-2xl font-semibold"><span className="tabular-nums">{l.text}</span> <span className="text-sm font-normal text-muted-foreground">{l.name}</span></div>
          ))}
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rendement</div>
          <div className="tabular-nums text-3xl font-semibold text-primary">{pct1(i.yieldPct)}</div>
        </div>
      </div>
      <p className="tabular-nums text-xs text-muted-foreground">Surface achetée {m2(i.purchased)} m² · pièces {m2(i.pieces)} m²{result.total.totalPrice != null ? ` · prix ${eur(result.total.totalPrice)}` : ""}</p>
      <Split b={result.total.balance} />
      <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3 text-sm">
        <label className="block"><span className="field-label">Statut de la matière</span>
          <select className="input-tech w-56" value={s.status} onChange={(e) => onStatus({ ...s, status: e.target.value as MaterialStatus["status"] })}>
            <option value="toOrder">À commander</option><option value="ordered">Commandée</option><option value="stock">Matière déjà disponible</option>
          </select>
        </label>
        {s.status === "ordered" && (<>
          <label className="block"><span className="field-label">Date de commande</span><input type="date" className="input-tech mono" value={s.orderDate ?? ""} onChange={(e) => onStatus({ ...s, orderDate: e.target.value })} /></label>
          <label className="block"><span className="field-label">Fournisseur</span><input className="input-tech" value={s.supplier ?? ""} onChange={(e) => onStatus({ ...s, supplier: e.target.value })} /></label>
          <label className="block"><span className="field-label">N° de commande</span><input className="input-tech" value={s.orderNumber ?? ""} onChange={(e) => onStatus({ ...s, orderNumber: e.target.value })} /></label>
        </>)}
      </div>
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

export function ResultsPanel({ result, materials, linears = [], pieces = [], status, onStatus = () => {}, offcuts, onOffcuts = () => {} }: {
  result: OptimizeResult; materials: Material[]; linears?: LinearRecap[]; pieces?: Piece[]; status?: MaterialStatus | undefined; onStatus?: (s: MaterialStatus) => void;
  offcuts?: OffcutSettings | undefined; onOffcuts?: (o: OffcutSettings) => void;
}) {
  const oc = offcuts ?? DEFAULT_OFFCUT_SETTINGS;
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
        <span className="tabular-nums text-xs text-muted-foreground">Calcul en {num(result.durationMs)} ms</span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Chutes dans le PDF atelier</span>
          <select className="input-tech w-64" value={oc.mode} onChange={(e) => onOffcuts({ ...oc, mode: e.target.value as OffcutSettings["mode"] })}>
            <option value="hide">Ne pas afficher</option>
            <option value="indicative">Chutes conservables (indicatif)</option>
            <option value="retain">Chutes à conserver (consigne)</option>
          </select>
        </label>
        {oc.mode === "retain" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary" checked={oc.labelsPage} onChange={(e) => onOffcuts({ ...oc, labelsPage: e.target.checked })} />
            Ajouter une page d'étiquettes
          </label>
        )}
      </div>
      {!ok && <ul className="list-disc pl-5 text-xs text-destructive">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}

      <Banner result={result} status={status} onStatus={onStatus} />
      <Kpis b={result.total.balance} />

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

      {result.materials.map((r) => (
        <div key={r.materialId} className="space-y-3 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">{r.name} <span className="tabular-nums font-normal text-muted-foreground">{num(r.thickness, 1)} mm</span><Badge r={r} mat={mat(r.materialId)} pieces={pieces} />
            <span className="tabular-nums ml-3 text-xs font-normal text-muted-foreground">{r.sheets.length} panneau(x) · rendement {pct1(indicators(r.balance).yieldPct)}</span></h3>
          <Split b={r.balance} />
          <Kpis b={r.balance} />
          <p className="tabular-nums text-xs">
            {r.formats.map((f) => `${f.count} × ${dims(f.width, f.length)}${f.price != null ? ` (${eur(f.count * f.price)})` : ""}`).join(" · ") || "Aucun panneau"}
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
              <tbody className="tabular-nums">
                {r.sheets.map((s) => (
                  <tr key={s.index} className="border-b border-border">
                    <td className="py-1.5 pr-2">{s.index}</td>
                    <td className="px-2 py-1.5">{dims(s.width, s.length)}</td>
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
                {groupSheets(r.sheets).map((g) => {
                  const key = (label: string) => offcutKey(r.materialId, g.indexes[0]!, label);
                  return <SheetPlan key={g.sheet.index} group={g} material={mat(r.materialId)!} colorOf={colorOf} mode={oc.mode}
                    markOf={(label) => ({ keep: oc.marks[key(label)]?.keep ?? true, note: oc.marks[key(label)]?.note ?? "" })}
                    onMark={(label, patch) => onOffcuts({ ...oc, marks: { ...oc.marks, [key(label)]: { ...oc.marks[key(label)], ...patch } } })} />;
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
