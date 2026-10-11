import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Material, Supply } from "@/lib/types";
import { newMaterial } from "@/lib/defaults";
import { uid } from "@/lib/ids";
import { Modal } from "./Modal";
import { NumInput } from "./NumInput";
import { Button } from "@/components/ui/button";
import { dims, num } from "@/lib/format";

const supplyLabel = (s: Supply) =>
  s.mode === "single"
    ? dims(s.width, s.length)
    : s.mode === "catalog"
      ? `${s.formats.length} formats`
      : `${num(s.width)} × ${num(s.minLength)}–${num(s.maxLength)}`;

export function MaterialsCard({
  materials,
  onChange,
}: {
  materials: Material[];
  onChange: (m: Material[]) => void;
}) {
  const [editing, setEditing] = useState<Material | null>(null);

  const save = (m: Material) => {
    const exists = materials.some((x) => x.id === m.id);
    onChange(exists ? materials.map((x) => (x.id === m.id ? m : x)) : [...materials, m]);
    setEditing(null);
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="card-title">Matériaux</h2>
        <Button variant="outline" className="btn-outline" onClick={() => setEditing(newMaterial())}><Plus size={14} /> Nouveau</Button>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {materials.map((m) => (
          <li key={m.id} className="card-tech flex items-start gap-2 p-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {m.name} <span className="mono text-muted-foreground">{num(m.thickness, 1)} mm</span>
              </div>
              <div className="mono overflow-x-auto text-xs leading-5 text-muted-foreground">
                <p className="whitespace-nowrap">{supplyLabel(m.supply)} · {m.cutType === "free" ? "CNC" : "scie"}</p>
                <p className="whitespace-nowrap">trait {m.kerf} · délign. {m.trim}{m.grainLocked && " · sens"}</p>
              </div>
            </div>
            <Button variant="ghost" className="btn-ghost h-7 px-1.5" aria-label="Modifier" onClick={() => setEditing(m)}><Pencil size={14} /></Button>
            <Button variant="ghost"
              className="btn-danger h-7 px-1.5"
              aria-label="Supprimer"
              onClick={() => confirm(`Supprimer « ${m.name} » ?`) && onChange(materials.filter((x) => x.id !== m.id))}
            ><Trash2 size={14} /></Button>
          </li>
        ))}
        {materials.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun matériau</li>}
      </ul>
      {editing && <MaterialForm initial={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </section>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="field-label whitespace-nowrap">{label}</span>
      <NumInput className="input-num" value={value} onChange={(n) => onChange(n ?? NaN)} />
    </label>
  );
}

function MaterialForm({ initial, onSave, onCancel }: { initial: Material; onSave: (m: Material) => void; onCancel: () => void }) {
  const [m, setM] = useState<Material>(structuredClone(initial));
  const set = (patch: Partial<Material>) => setM({ ...m, ...patch });
  const s = m.supply;

  const setMode = (mode: Supply["mode"]) => {
    const w = s.mode === "single" || s.mode === "fixedWidth" ? s.width : 2070;
    if (mode === "single") set({ supply: { mode, width: w, length: 2800 } });
    if (mode === "catalog") set({ supply: { mode, formats: [{ id: uid(), width: w, length: 2800 }] } });
    if (mode === "fixedWidth") set({ supply: { mode, width: w, minLength: 1000, maxLength: 4000, step: 100 } });
  };

  return (
    <Modal title={initial.name ? "Matériau" : "Nouveau matériau"} onClose={onCancel}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="col-span-2 block sm:col-span-1">
          <span className="field-label">Nom</span>
          <input className="input-tech" value={m.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <Num label="Épaisseur (mm)" value={m.thickness} onChange={(thickness) => set({ thickness })} />
        <Num label="Trait de coupe (mm)" value={m.kerf} onChange={(kerf) => set({ kerf })} />
        <Num label="Délignage (mm)" value={m.trim} onChange={(trim) => set({ trim })} />
        <Num label="Chute réutil. mini (mm)" value={m.reuseMin ?? 300} onChange={(reuseMin) => set({ reuseMin })} />
        <label className="col-span-2 block sm:col-span-3">
          <span className="field-label">Type de découpe</span>
          <select className="input-tech" value={m.cutType} onChange={(e) => set({ cutType: e.target.value as Material["cutType"] })}>
            <option value="guillotine">Coupes traversantes (scie à panneaux)</option>
            <option value="free">Placement libre (CNC)</option>
          </select>
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" className="accent-primary" checked={m.grainLocked} onChange={(e) => set({ grainLocked: e.target.checked })} />
          Sens imposé <span className="text-muted-foreground">— les pièces ne tournent pas (décor, fil du bois, laquage)</span>
        </label>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <span className="field-label">Mode d'approvisionnement</span>
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-sm border border-border p-1">
          {([
            ["single", "Format unique"],
            ["catalog", "Plusieurs formats catalogue"],
            ["fixedWidth", "Longueur à la demande"],
          ] as const).map(([k, l]) => (
            <button key={k} className={`btn justify-center text-xs ${s.mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>
        {s.mode === "single" && (
          <div className="grid grid-cols-2 gap-3">
            <Num label="Largeur (mm)" value={s.width} onChange={(width) => set({ supply: { ...s, width } })} />
            <Num label="Longueur (mm)" value={s.length} onChange={(length) => set({ supply: { ...s, length } })} />
          </div>
        )}
        {s.mode === "fixedWidth" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Num label="Largeur (mm)" value={s.width} onChange={(width) => set({ supply: { ...s, width } })} />
            <Num label="Long. mini" value={s.minLength} onChange={(minLength) => set({ supply: { ...s, minLength } })} />
            <Num label="Long. maxi" value={s.maxLength} onChange={(maxLength) => set({ supply: { ...s, maxLength } })} />
            <Num label="Pas" value={s.step} onChange={(step) => set({ supply: { ...s, step } })} />
          </div>
        )}
        {s.mode === "catalog" && (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
              <span>Largeur (mm)</span><span>Longueur (mm)</span><span>Prix / panneau</span><span className="w-7" />
            </div>
            {s.formats.map((f, i) => {
              const upd = (patch: Partial<typeof f>) =>
                set({ supply: { ...s, formats: s.formats.map((x, j) => (j === i ? { ...x, ...patch } : x)) } });
              return (
                <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <NumInput aria-label="Largeur du format" className="input-num" value={f.width} onChange={(n) => upd({ width: n ?? NaN })} />
                  <NumInput aria-label="Longueur du format" className="input-num" value={f.length} onChange={(n) => upd({ length: n ?? NaN })} />
                  <NumInput aria-label="Prix du format" className="input-num" placeholder="—" value={f.price ?? null} onChange={(n) => upd({ price: n ?? undefined })} />
                  <button className="btn-danger h-8 w-7 justify-center px-0" aria-label="Retirer" onClick={() => set({ supply: { ...s, formats: s.formats.filter((_, j) => j !== i) } })}><Trash2 size={14} /></button>
                </div>
              );
            })}
            <button className="btn-ghost" onClick={() => set({ supply: { ...s, formats: [...s.formats, { id: uid(), width: 2070, length: 2800 }] } })}><Plus size={14} /> Format</button>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel}>Annuler</button>
        <button className="btn-primary" onClick={() => onSave(m)}>Enregistrer</button>
      </div>
    </Modal>
  );
}
