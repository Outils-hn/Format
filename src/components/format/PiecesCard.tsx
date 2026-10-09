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

export function PiecesCard({
  pieces, materials, onChange, linears = [], onLinearsChange,
}: {
  pieces: Piece[];
  materials: Material[];
  onChange: (p: Piece[]) => void;
  linears?: Linear[];
  onLinearsChange?: (l: Linear[]) => void;
}) {
  const updL = (id: string, patch: Partial<Linear>) => onLinearsChange?.(linears.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const [pasting, setPasting] = useState(false);
  const upd = (id: string, patch: Partial<Piece>) => onChange(pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const num = (v: string) => (v === "" ? null : parseFloat(v.replace(",", ".")));
  const eligible = pieces.filter((p) => materials.some((m) => m.id === p.materialId && !m.grainLocked));
  const checkedCount = eligible.filter((p) => p.canRotate).length;
  const allChecked = eligible.length > 0 && checkedCount === eligible.length;
  const headerCheckbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckbox.current) headerCheckbox.current.indeterminate = checkedCount > 0 && !allChecked;
  }, [checkedCount, allChecked]);
  const add = () => {
    const material = materials.find((m) => m.id === pieces.at(-1)?.materialId) ?? materials[0];
    if (!material) return;
    onChange([...pieces, newPiece(material.id, pieces.length + 1, material.grainLocked)]);
  };

  const addLinear = () => {
    const material = materials.find((m) => m.id === linears.at(-1)?.materialId) ?? materials[0];
    if (material) onLinearsChange?.([...linears, newLinear(material.id, linears.length + 1)]);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(piecesToTsv(pieces, materials));
    toast.success("Liste copiée — collez-la dans Excel");
  };

  return (
    <section className="card-tech">
      <div className="card-tech-head">
        <h2 className="card-title">Pièces à découper</h2>
      </div>
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
          <Button variant="outline" size="sm" className="btn-outline" onClick={() => setPasting(true)}><ClipboardPaste size={14} /> Coller depuis Excel</Button>
          <Button variant="outline" size="sm" className="btn-outline" onClick={copy} disabled={!pieces.length}><ClipboardCopy size={14} /> Copier pour Excel</Button>
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
        {pieces.length > 0 && (<div>
        <h3 className="px-4 pb-2 pt-4 text-sm font-semibold">Pièces</h3>
        <table aria-label="Pièces" className="entry-table w-full min-w-[780px] table-fixed text-sm">
          <colgroup><col className="w-[15%]" /><col className="w-[30%]" /><col className="w-[15%]" /><col className="w-[15%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[5%]" /></colgroup>
          <thead className="text-left font-sans text-xs font-semibold text-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-semibold">Repère</th>
              <th className="px-3 py-2 font-semibold">Matériau</th>
              <th className="px-3 py-2 text-right font-semibold">Largeur (mm)</th>
              <th className="px-3 py-2 text-right font-semibold">Hauteur (mm)</th>
              <th className="px-3 py-2 text-right font-semibold">Qté</th>
              <th className="px-3 py-2 text-center font-semibold">
                <label className="inline-flex flex-col items-center gap-1">
                  <input ref={headerCheckbox} type="checkbox" className="accent-primary disabled:opacity-40"
                    aria-label="Autoriser la rotation de toutes les pièces" checked={allChecked} disabled={!eligible.length}
                    onChange={(e) => {
                      const selected = new Set(eligible.map((p) => p.id));
                      onChange(pieces.map((p) => selected.has(p.id) ? { ...p, canRotate: e.target.checked } : p));
                    }} />
                  Peut tourner
                </label>
              </th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {pieces.map((p, i) => {
              const mat = materials.find((m) => m.id === p.materialId);
              const locked = !!mat?.grainLocked;
              const err = validatePiece(p, materials);
              return (
                <tr key={p.id} className={`border-b border-border ${err ? "bg-destructive-soft" : ""}`} title={err ?? undefined}>
                  <td className="py-1.5">
                    <div className="relative">
                      <span className="pointer-events-none absolute right-3 top-2.5 h-3 w-3 rounded-[2px] border border-foreground/20" style={{ background: planColor(i) }} />
                      <input aria-label="Repère de pièce" className="input-tech w-full px-3 pr-8" value={p.label} onChange={(e) => upd(p.id, { label: e.target.value })} />
                    </div>
                  </td>
                  <td className="py-1.5">
                    <select className="input-tech w-full px-3" value={p.materialId}
                      onChange={(e) => { const m = materials.find((x) => x.id === e.target.value); upd(p.id, { materialId: e.target.value, canRotate: m?.grainLocked ? false : p.canRotate }); }}>
                      {!mat && <option value={p.materialId}>— choisir —</option>}
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.name} {m.thickness}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5"><input inputMode="decimal" className={`input-num w-full px-3 ${err ? "border-destructive" : ""}`} value={p.width ?? ""} onChange={(e) => upd(p.id, { width: num(e.target.value) })} /></td>
                  <td className="py-1.5"><input inputMode="decimal" className={`input-num w-full px-3 ${err ? "border-destructive" : ""}`} value={p.height ?? ""} onChange={(e) => upd(p.id, { height: num(e.target.value) })} /></td>
                  <td className="py-1.5"><input inputMode="numeric" className="input-num w-full px-3" value={p.quantity} onChange={(e) => upd(p.id, { quantity: Math.max(0, parseInt(e.target.value) || 0) })} /></td>
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" aria-label={`Autoriser la rotation de ${p.label}`} className="accent-primary disabled:opacity-40" disabled={locked} checked={!locked && p.canRotate}
                      title={locked ? "Sens imposé par le matériau" : undefined} onChange={(e) => upd(p.id, { canRotate: e.target.checked })} />
                  </td>
                  <td className="text-center">
                    <Button variant="ghost" size="sm" className="btn-danger h-7 w-7 justify-center px-0" aria-label="Supprimer" onClick={() => onChange(pieces.filter((x) => x.id !== p.id))}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>)}
        {linears.length > 0 && (
          <div className={pieces.length ? "border-t border-border" : ""}>
          <h3 className="px-4 pb-2 pt-4 text-sm font-semibold">Linéaires</h3>
          <table aria-label="Linéaires" className="entry-table w-full min-w-[780px] table-fixed text-sm">
            <colgroup><col className="w-[15%]" /><col className="w-[30%]" /><col className="w-[20%]" /><col className="w-[30%]" /><col className="w-[5%]" /></colgroup>
            <thead className="text-left font-sans text-xs font-semibold text-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-semibold">Repère</th>
                <th className="px-3 py-2 font-semibold">Matériau</th>
                <th className="px-3 py-2 text-right font-semibold">Bande (mm)</th>
                <th className="px-3 py-2 text-right font-semibold">Longueur (m)</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {linears.map((l) => {
                const seg = linearSegments(l, materials);
                const err = typeof seg === "string" ? seg : null;
                const mat = materials.find((m) => m.id === l.materialId);
                return (
                  <Fragment key={l.id}>
                  <tr>
                    <td className="py-1.5"><input aria-label="Repère de linéaire" className="input-tech w-full px-3" value={l.label} onChange={(e) => updL(l.id, { label: e.target.value })} /></td>
                    <td className="py-1.5">
                      <select aria-label="Matériau du linéaire" className="input-tech w-full px-3" value={l.materialId} onChange={(e) => updL(l.id, { materialId: e.target.value })}>
                        {!mat && <option value={l.materialId}>— choisir —</option>}
                        {materials.map((m) => <option key={m.id} value={m.id}>{m.name} {m.thickness}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5"><input inputMode="decimal" aria-label="Largeur de bande" className="input-num w-full px-3" value={l.bandWidth ?? ""} onChange={(e) => updL(l.id, { bandWidth: num(e.target.value) })} /></td>
                    <td className="py-1.5"><input inputMode="decimal" aria-label="Longueur totale" className="input-num w-full px-3" value={l.totalLength ?? ""} onChange={(e) => updL(l.id, { totalLength: num(e.target.value) })} /></td>
                    <td className="text-center">
                      <Button variant="ghost" size="sm" className="btn-danger h-7 w-7 justify-center px-0" aria-label="Supprimer le linéaire" onClick={() => onLinearsChange?.(linears.filter((x) => x.id !== l.id))}><Trash2 size={14} /></Button>
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td colSpan={5} className="pb-4 pl-6 pr-3 pt-1">
                      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                        <label className="block">
                          <span className="field-label">Mode de tronçons</span>
                          <select className="input-tech w-64" value={l.mode} onChange={(e) => updL(l.id, { mode: e.target.value as Linear["mode"] })}>
                            <option value="fixed">Tronçons de longueur fixe</option>
                            <option value="joined">Raboutage autorisé</option>
                          </select>
                        </label>
                        {l.mode === "fixed" ? (
                          <label className="block"><span className="field-label">Tronçon (mm)</span><input inputMode="decimal" className="input-num w-24 px-3" value={l.segment ?? ""} onChange={(e) => updL(l.id, { segment: num(e.target.value) })} /></label>
                        ) : (<>
                          <label className="block"><span className="field-label">Mini (mm)</span><input inputMode="decimal" className="input-num w-20 px-3" value={l.min ?? ""} onChange={(e) => updL(l.id, { min: num(e.target.value) })} /></label>
                          <label className="block"><span className="field-label">Maxi (mm)</span><input inputMode="decimal" className="input-num w-20 px-3" placeholder="panneau" value={l.max ?? ""} onChange={(e) => updL(l.id, { max: num(e.target.value) })} /></label>
                          <label className="block"><span className="field-label">Multiple de (mm)</span><input inputMode="decimal" className="input-num w-24 px-3" value={l.multiple ?? ""} onChange={(e) => updL(l.id, { multiple: num(e.target.value) })} /></label>
                        </>)}
                        <p className={`mono ml-auto max-w-full py-2 text-right text-xs ${err ? "text-destructive" : "text-muted-foreground"}`}>{err ?? segmentsText(l, seg as Exclude<typeof seg, string>)}</p>
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
        {pieces.length === 0 && linears.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Ajoutez des pièces ou un linéaire</p>}
      </div>
      {pieces.some((p) => validatePiece(p, materials)) && (
        <p className="px-4 py-2 text-xs text-destructive">
          {pieces.filter((p) => validatePiece(p, materials)).length} pièce(s) impossible(s) — survolez une ligne pour le détail.
        </p>
      )}
      {pasting && (
        <PasteDialog materials={materials} onClose={() => setPasting(false)}
          onApply={(np, mode) => { onChange(mergeDuplicates(mode === "replace" ? np : [...pieces, ...np])); setPasting(false); }} />
      )}
    </section>
  );
}
