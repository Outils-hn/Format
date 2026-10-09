import { useEffect, useRef, useState } from "react";
import { ClipboardCopy, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Material, Piece } from "@/lib/types";
import { newPiece } from "@/lib/defaults";
import { mergeDuplicates, piecesToTsv } from "@/lib/excel";
import { validatePiece } from "@/lib/validation";
import { planColor } from "@/lib/palette";
import { PasteDialog } from "./PasteDialog";

export function PiecesCard({
  pieces, materials, onChange,
}: {
  pieces: Piece[];
  materials: Material[];
  onChange: (p: Piece[]) => void;
}) {
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

  const copy = async () => {
    await navigator.clipboard.writeText(piecesToTsv(pieces, materials));
    toast.success("Liste copiée — collez-la dans Excel");
  };

  return (
    <section className="card-tech">
      <div className="card-tech-head flex-wrap">
        <h2 className="card-title">Pièces à découper</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => setPasting(true)}><ClipboardPaste size={14} /> Coller depuis Excel</button>
          <button className="btn-outline" onClick={copy} disabled={!pieces.length}><ClipboardCopy size={14} /> Copier pour Excel</button>
          <button className="btn-primary" disabled={!materials.length}
            onClick={add}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Repère</th>
              <th className="px-2 py-2 font-medium">Matériau</th>
              <th className="px-2 py-2 text-right font-medium">Largeur (mm)</th>
              <th className="px-2 py-2 text-right font-medium">Hauteur (mm)</th>
              <th className="px-2 py-2 text-right font-medium">Qté</th>
              <th className="px-2 py-2 text-center font-medium">
                <label className="inline-flex items-center gap-2 whitespace-nowrap">
                  <input ref={headerCheckbox} type="checkbox" className="accent-primary disabled:opacity-40"
                    aria-label="Autoriser la rotation de toutes les pièces" checked={allChecked} disabled={!eligible.length}
                    onChange={(e) => {
                      const selected = new Set(eligible.map((p) => p.id));
                      onChange(pieces.map((p) => selected.has(p.id) ? { ...p, canRotate: e.target.checked } : p));
                    }} />
                  Peut tourner
                </label>
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {pieces.map((p, i) => {
              const mat = materials.find((m) => m.id === p.materialId);
              const locked = !!mat?.grainLocked;
              const err = validatePiece(p, materials);
              return (
                <tr key={p.id} className={`border-b border-border ${err ? "bg-destructive-soft" : ""}`} title={err ?? undefined}>
                  <td className="px-4 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-[2px] border border-foreground/20" style={{ background: planColor(i) }} />
                      <input className="input-tech w-24" value={p.label} onChange={(e) => upd(p.id, { label: e.target.value })} />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <select className="input-tech min-w-36" value={p.materialId}
                      onChange={(e) => { const m = materials.find((x) => x.id === e.target.value); upd(p.id, { materialId: e.target.value, canRotate: m?.grainLocked ? false : p.canRotate }); }}>
                      {!mat && <option value={p.materialId}>— choisir —</option>}
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.name} {m.thickness}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><input inputMode="decimal" className={`input-num w-24 ${err ? "border-destructive" : ""}`} value={p.width ?? ""} onChange={(e) => upd(p.id, { width: num(e.target.value) })} /></td>
                  <td className="px-2 py-1.5"><input inputMode="decimal" className={`input-num w-24 ${err ? "border-destructive" : ""}`} value={p.height ?? ""} onChange={(e) => upd(p.id, { height: num(e.target.value) })} /></td>
                  <td className="px-2 py-1.5"><input inputMode="numeric" className="input-num w-16" value={p.quantity} onChange={(e) => upd(p.id, { quantity: Math.max(0, parseInt(e.target.value) || 0) })} /></td>
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" aria-label={`Autoriser la rotation de ${p.label}`} className="accent-primary disabled:opacity-40" disabled={locked} checked={!locked && p.canRotate}
                      title={locked ? "Sens imposé par le matériau" : undefined} onChange={(e) => upd(p.id, { canRotate: e.target.checked })} />
                  </td>
                  <td className="pr-3">
                    <button className="btn-danger h-7 px-1.5" aria-label="Supprimer" onClick={() => onChange(pieces.filter((x) => x.id !== p.id))}><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pieces.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Aucune pièce. Ajoutez-en ou collez une liste depuis Excel.</p>}
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
