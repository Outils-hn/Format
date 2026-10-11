import { Fragment, useEffect, useRef, useState } from "react";
import { ClipboardCopy, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Linear, Material, Piece } from "@/lib/types";
import { linearSegments, newLinear, segmentsText } from "@/lib/linear";
import { newPiece } from "@/lib/defaults";
import { mergeDuplicates, piecesToTsv } from "@/lib/excel";
import { validatePiece } from "@/lib/validation";
import { planColor } from "@/lib/palette";
import { Button } from "@/components/ui/button";
import { PasteDialog } from "./PasteDialog";
import { NumInput } from "./NumInput";

export function PiecesCard({
  pieces, materials, onChange, linears = [], onLinearsChange, highlightEmpty = false, materialId,
}: {
  highlightEmpty?: boolean;
  materialId?: string;
  pieces: Piece[];
  materials: Material[];
  onChange: (p: Piece[]) => void;
  linears?: Linear[];
  onLinearsChange?: (l: Linear[]) => void;
}) {
  const visiblePieces = materialId ? pieces.filter((p) => p.materialId === materialId) : pieces;
  const visibleLinears = materialId ? linears.filter((l) => l.materialId === materialId) : linears;
  const updL = (id: string, patch: Partial<Linear>) => onLinearsChange?.(linears.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const [pasting, setPasting] = useState(false);
  const upd = (id: string, patch: Partial<Piece>) => onChange(pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const bad = (v: number | null | undefined) => highlightEmpty && !v;
  const mobileAll = useRef<HTMLInputElement>(null);
  const toggleAll = (checked: boolean) => {
    const selected = new Set(eligible.map((p) => p.id));
    onChange(pieces.map((p) => selected.has(p.id) ? { ...p, canRotate: checked } : p));
  };
  const eligible = visiblePieces.filter((p) => materials.some((m) => m.id === p.materialId && !m.grainLocked));
  const checkedCount = eligible.filter((p) => p.canRotate).length;
  const allChecked = eligible.length > 0 && checkedCount === eligible.length;
  const headerCheckbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    for (const r of [headerCheckbox, mobileAll]) if (r.current) r.current.indeterminate = checkedCount > 0 && !allChecked;
  }, [checkedCount, allChecked]);
  const add = () => {
    const material = materials.find((m) => m.id === (materialId ?? pieces.at(-1)?.materialId)) ?? materials[0];
    if (!material) return;
    onChange([...pieces, newPiece(material.id, pieces.length + 1, material.grainLocked)]);
  };

  const addLinear = () => {
    const material = materials.find((m) => m.id === (materialId ?? linears.at(-1)?.materialId)) ?? materials[0];
    if (material) onLinearsChange?.([...linears, newLinear(material.id, linears.length + 1)]);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(piecesToTsv(visiblePieces, materials));
    toast.success("Liste copiée — collez-la dans Excel");
  };

  return (
    <section className="card-tech">
      <div className="card-tech-head">
        <h2 className="card-title">Pièces à découper</h2>
      </div>
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
          <Button variant="outline" size="sm" className="btn-outline" onClick={() => setPasting(true)}><ClipboardPaste size={14} /> Coller depuis Excel</Button>
          <Button variant="outline" size="sm" className="btn-outline" onClick={copy} disabled={!visiblePieces.length}><ClipboardCopy size={14} /> Copier pour Excel</Button>
          <Button size="sm" className="btn-primary" disabled={!materials.length}
            onClick={add}>
            <Plus size={14} /> Ajouter
          </Button>
          {onLinearsChange && (
            <Button variant="outline" size="sm" className="btn-outline" disabled={!materials.length}
              onClick={addLinear}>
              <Plus size={14} /> Ajouter un linéaire
            </Button>
          )}
        </div>
      <div className="overflow-x-auto">
        {visiblePieces.length > 0 && (<div>
        <h3 className="px-4 pb-2 pt-4 text-sm font-semibold">Pièces</h3>
        <label className="flex items-center gap-2 px-4 pb-1 text-sm sm:hidden">
          <input ref={mobileAll} type="checkbox" className="accent-primary disabled:opacity-40" checked={allChecked} disabled={!eligible.length}
            onChange={(e) => toggleAll(e.target.checked)} />
          Toutes les pièces peuvent tourner
        </label>
        <table aria-label="Pièces" className="entry-table w-full text-sm max-sm:block sm:min-w-[780px] sm:table-fixed">
          <colgroup className="max-sm:hidden"><col className="w-[15%]" />{!materialId && <col className="w-[30%]" />}<col className="w-[15%]" /><col className="w-[15%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[5%]" /></colgroup>
          <thead className="text-left font-sans text-xs font-semibold text-foreground max-sm:hidden">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-semibold">Repère</th>
              {!materialId && <th className="px-3 py-2 font-semibold">Matériau</th>}
              <th className="px-3 py-2 text-right font-semibold">Largeur (mm)</th>
              <th className="px-3 py-2 text-right font-semibold">Hauteur (mm)</th>
              <th className="px-3 py-2 text-right font-semibold">Qté</th>
              <th className="px-3 py-2 text-center font-semibold">
                <label className="inline-flex flex-col items-center gap-1">
                  <input ref={headerCheckbox} type="checkbox" className="accent-primary disabled:opacity-40"
                    aria-label="Autoriser la rotation de toutes les pièces" checked={allChecked} disabled={!eligible.length}
                    onChange={(e) => toggleAll(e.target.checked)} />
                  Peut tourner
                </label>
              </th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {visiblePieces.map((p) => {
              const i = pieces.findIndex((row) => row.id === p.id);
              const mat = materials.find((m) => m.id === p.materialId);
              const locked = !!mat?.grainLocked;
              const err = validatePiece(p, materials);
              return (
                <tr key={p.id} className={`border-b border-border max-sm:mx-3 max-sm:my-2 max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-3 max-sm:rounded-sm max-sm:border max-sm:p-3 ${err ? "bg-destructive-soft" : ""}`} title={err ?? undefined}>
                  <td className="py-1.5 max-sm:col-span-2 max-sm:block"><span className="field-label sm:hidden">Repère</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute right-3 top-2.5 h-3 w-3 rounded-[2px] border border-foreground/20" style={{ background: planColor(i) }} />
                      <input aria-label="Repère de pièce" className="input-tech w-full px-3 pr-8" value={p.label} onChange={(e) => upd(p.id, { label: e.target.value })} />
                    </div>
                  </td>
                  {!materialId && <td className="py-1.5 max-sm:col-span-2 max-sm:block"><span className="field-label sm:hidden">Matériau</span>
                    <select className="input-tech w-full px-3" value={p.materialId}
                      onChange={(e) => { const m = materials.find((x) => x.id === e.target.value); upd(p.id, { materialId: e.target.value, canRotate: m?.grainLocked ? false : p.canRotate }); }}>
                      {!mat && <option value={p.materialId}>— choisir —</option>}
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.name} {m.thickness}</option>)}
                    </select>
                  </td>}
                  <td className="py-1.5 max-sm:block"><span className="field-label sm:hidden">Largeur (mm)</span><NumInput aria-label={`Largeur de ${p.label}`} invalid={bad(p.width)} className={`input-num w-full px-3 ${err ? "border-destructive" : ""}`} value={p.width} onChange={(n) => upd(p.id, { width: n })} /></td>
                  <td className="py-1.5 max-sm:block"><span className="field-label sm:hidden">Hauteur (mm)</span><NumInput aria-label={`Hauteur de ${p.label}`} invalid={bad(p.height)} className={`input-num w-full px-3 ${err ? "border-destructive" : ""}`} value={p.height} onChange={(n) => upd(p.id, { height: n })} /></td>
                  <td className="py-1.5 max-sm:block"><span className="field-label sm:hidden">Qté</span><NumInput aria-label={`Quantité de ${p.label}`} zeroIsEmpty invalid={bad(p.quantity)} className="input-num w-full px-3" value={p.quantity} onChange={(n) => upd(p.id, { quantity: n == null ? 0 : Math.max(0, Math.round(n)) })} /></td>
                  <td className="px-2 py-1.5 text-center max-sm:block max-sm:px-0 max-sm:text-left"><span className="field-label sm:hidden">Peut tourner</span>
                    <input type="checkbox" aria-label={`Autoriser la rotation de ${p.label}`} className="accent-primary disabled:opacity-40" disabled={locked} checked={!locked && p.canRotate}
                      title={locked ? "Sens imposé par le matériau" : undefined} onChange={(e) => upd(p.id, { canRotate: e.target.checked })} />
                  </td>
                  <td className="text-center max-sm:col-span-2 max-sm:block max-sm:text-right">
                    <Button variant="ghost" size="sm" className="btn-danger h-7 w-7 justify-center px-0" aria-label="Supprimer" onClick={() => onChange(pieces.filter((x) => x.id !== p.id))}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>)}
        {visibleLinears.length > 0 && (
          <div className={visiblePieces.length ? "border-t border-border" : ""}>
          <h3 className="px-4 pb-2 pt-4 text-sm font-semibold">Linéaires</h3>
          <table aria-label="Linéaires" className="entry-table w-full min-w-[780px] table-fixed text-sm">
            <colgroup><col className="w-[15%]" />{!materialId && <col className="w-[30%]" />}<col className="w-[20%]" />{!materialId && <col className="w-[30%]" />}<col className="w-[5%]" /></colgroup>
            <thead className="text-left font-sans text-xs font-semibold text-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-semibold">Repère</th>
                {!materialId && <th className="px-3 py-2 font-semibold">Matériau</th>}
                <th className="px-3 py-2 text-right font-semibold">Bande (mm)</th>
                <th className="px-3 py-2 text-right font-semibold">Longueur (m)</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visibleLinears.map((l) => {
                const seg = linearSegments(l, materials);
                const err = typeof seg === "string" ? seg : null;
                const mat = materials.find((m) => m.id === l.materialId);
                return (
                  <Fragment key={l.id}>
                  <tr>
                    <td className="py-1.5"><input aria-label="Repère de linéaire" className="input-tech w-full px-3" value={l.label} onChange={(e) => updL(l.id, { label: e.target.value })} /></td>
                    {!materialId && <td className="py-1.5">
                      <select aria-label="Matériau du linéaire" className="input-tech w-full px-3" value={l.materialId} onChange={(e) => updL(l.id, { materialId: e.target.value })}>
                        {!mat && <option value={l.materialId}>— choisir —</option>}
                        {materials.map((m) => <option key={m.id} value={m.id}>{m.name} {m.thickness}</option>)}
                      </select>
                    </td>}
                    <td className="py-1.5"><NumInput aria-label="Largeur de bande" invalid={bad(l.bandWidth)} className="input-num w-full px-3" value={l.bandWidth} onChange={(n) => updL(l.id, { bandWidth: n })} /></td>
                    <td className="py-1.5"><NumInput aria-label="Longueur totale" invalid={bad(l.totalLength)} className="input-num w-full px-3" value={l.totalLength} onChange={(n) => updL(l.id, { totalLength: n })} /></td>
                    <td className="text-center">
                      <Button variant="ghost" size="sm" className="btn-danger h-7 w-7 justify-center px-0" aria-label="Supprimer le linéaire" onClick={() => onLinearsChange?.(linears.filter((x) => x.id !== l.id))}><Trash2 size={14} /></Button>
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td colSpan={materialId ? 4 : 5} className="pb-4 pl-6 pr-3 pt-1">
                      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                        <label className="block">
                          <span className="field-label">Mode de tronçons</span>
                          <select className="input-tech w-64" value={l.mode} onChange={(e) => updL(l.id, { mode: e.target.value as Linear["mode"] })}>
                            <option value="fixed">Tronçons de longueur fixe</option>
                            <option value="joined">Raboutage autorisé</option>
                          </select>
                        </label>
                        {l.mode === "fixed" ? (
                          <label className="block"><span className="field-label">Tronçon (mm)</span><NumInput className="input-num w-24 px-3" invalid={bad(l.segment)} value={l.segment} onChange={(n) => updL(l.id, { segment: n })} /></label>
                        ) : (<>
                          <label className="block"><span className="field-label">Mini (mm)</span><NumInput className="input-num w-20 px-3" invalid={bad(l.min)} value={l.min} onChange={(n) => updL(l.id, { min: n })} /></label>
                          <label className="block"><span className="field-label">Maxi (mm)</span><NumInput className="input-num w-20 px-3" placeholder="panneau" value={l.max} onChange={(n) => updL(l.id, { max: n })} /></label>
                          <label className="block"><span className="field-label">Multiple de (mm)</span><NumInput className="input-num w-24 px-3" value={l.multiple} onChange={(n) => updL(l.id, { multiple: n })} /></label>
                        </>)}
                        <p className={`tabular-nums ml-auto max-w-full py-2 text-right text-xs ${err ? "text-destructive" : "text-muted-foreground"}`}>{err ?? segmentsText(l, seg as Exclude<typeof seg, string>)}</p>
                      </div>
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
        {visiblePieces.length === 0 && visibleLinears.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Ajoutez des pièces ou un linéaire</p>}
      </div>
      {visiblePieces.some((p) => validatePiece(p, materials)) && (
        <p className="px-4 py-2 text-xs text-destructive">
          {visiblePieces.filter((p) => validatePiece(p, materials)).length} pièce(s) impossible(s) — survolez une ligne pour le détail.
        </p>
      )}
      {pasting && (
        <PasteDialog materials={materials} defaultMaterialId={materialId} onClose={() => setPasting(false)}
          onApply={(np, mode) => { const untouched = materialId ? pieces.filter((p) => p.materialId !== materialId && !np.some((n) => n.materialId === p.materialId)) : []; onChange(mergeDuplicates(mode === "replace" ? [...untouched, ...np] : [...pieces, ...np])); setPasting(false); }} />
      )}
    </section>
  );
}
