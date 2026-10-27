import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Material, OrderType, Supply } from "@/lib/types";
import { newMaterial } from "@/lib/defaults";
import { materialProblems } from "@/lib/validation";
import { uid } from "@/lib/ids";
import { Modal } from "./Modal";
import { NumInput } from "./NumInput";
import { Button } from "@/components/ui/button";
import { dims, num } from "@/lib/format";
import { duplicateFormats, switchSupply } from "@/lib/materialSupply";

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
        {materials.length === 0 && <li className="card-tech col-span-full flex flex-col items-center gap-3 px-4 py-14 text-center">
          <p className="text-base font-semibold">Aucun matériau pour l'instant</p>
          <p className="text-sm text-muted-foreground">Créez vos matériaux une fois, ils seront disponibles dans tous vos projets.</p>
          <Button className="btn-primary mt-1" onClick={() => setEditing(newMaterial())}><Plus size={14} /> Créer un matériau</Button>
        </li>}
      </ul>
      {editing && <MaterialForm initial={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </section>
  );
}

function Num({ label, value, onChange, invalid }: { label: string; value: number; onChange: (n: number) => void; invalid?: boolean }) {
  return (
    <label className="block">
      <span className="field-label whitespace-nowrap">{label}</span>
      <NumInput className="input-num" invalid={!!invalid} value={value} onChange={(n) => onChange(n ?? NaN)} />
    </label>
  );
}

function MaterialForm({ initial, onSave, onCancel }: { initial: Material; onSave: (m: Material) => void; onCancel: () => void }) {
  const [m, setM] = useState<Material>(structuredClone(initial));
  const set = (patch: Partial<Material>) => setM((current) => ({ ...current, ...patch,
    ...(patch.supply ? { supplyValues: { ...current.supplyValues, [patch.supply.mode]: patch.supply } } : {}),
  }));
  const s = m.supply;

  const setMode = (mode: Supply["mode"]) => setM((current) => switchSupply(current, mode));
  const duplicates = duplicateFormats(s.mode === "catalog" ? s : m.supplyValues?.catalog);
  // Champs vides ou impossibles : enregistrement bloque (sinon la page plante plus loin)
  const problems = materialProblems(m);
  const bad = (n: unknown) => !(typeof n === "number" && Number.isFinite(n) && n > 0);
  const badOrNeg = (n: unknown) => !(typeof n === "number" && Number.isFinite(n) && n >= 0);

  return (
    <Modal title={initial.name ? "Matériau" : "Nouveau matériau"} onClose={onCancel}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="col-span-2 block sm:col-span-1">
          <span className="field-label">Nom</span>
          <input className="input-tech" value={m.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <Num label="Épaisseur (mm)" invalid={bad(m.thickness)} value={m.thickness} onChange={(thickness) => set({ thickness })} />
        <Num label="Trait de coupe (mm)" invalid={badOrNeg(m.kerf)} value={m.kerf} onChange={(kerf) => set({ kerf })} />
        <Num label="Délignage (mm)" invalid={badOrNeg(m.trim)} value={m.trim} onChange={(trim) => set({ trim })} />
        <Num label="Chute réutil. mini (mm)" value={m.reuseMin ?? 300} onChange={(reuseMin) => set({ reuseMin })} />
        <label className="col-span-2 block sm:col-span-3">
          <span className="field-label">Type de découpe</span>
          <select className="input-tech" value={m.cutType} onChange={(e) => set({ cutType: e.target.value as Material["cutType"] })}>
            <option value="guillotine">Coupes traversantes (scie à panneaux)</option>
            <option value="free">Placement libre (CNC)</option>
          </select>
        </label>
        <label className="col-span-2 block sm:col-span-1">
          <span className="field-label">Fournisseur</span>
          <input className="input-tech" value={m.supplier ?? ""} onChange={(e) => set({ supplier: e.target.value })} />
        </label>
        <label className="col-span-2 block">
          <span className="field-label">Type de commande</span>
          <select className="input-tech" value={m.orderType ?? "panels"} onChange={(e) => set({ orderType: e.target.value as OrderType })}>
            <option value="panels">Panneaux entiers</option>
            <option value="cut">Pièces débitées par le fournisseur</option>
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
            <Button key={k} variant="ghost" aria-pressed={s.mode === k} className={`btn h-auto min-h-8 justify-center whitespace-normal text-xs ${s.mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setMode(k)}>{l}</Button>
          ))}
        </div>
        {s.mode === "single" && (
          <div className="grid grid-cols-2 gap-3">
            <Num label="Largeur (mm)" invalid={bad(s.width)} value={s.width} onChange={(width) => set({ supply: { ...s, width } })} />
            <Num label="Longueur (mm)" invalid={bad(s.length)} value={s.length} onChange={(length) => set({ supply: { ...s, length } })} />
          </div>
        )}
        {s.mode === "fixedWidth" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Num label="Largeur (mm)" invalid={bad(s.width)} value={s.width} onChange={(width) => set({ supply: { ...s, width } })} />
            <Num label="Long. mini" invalid={bad(s.minLength)} value={s.minLength} onChange={(minLength) => set({ supply: { ...s, minLength } })} />
            <Num label="Long. maxi" invalid={bad(s.maxLength)} value={s.maxLength} onChange={(maxLength) => set({ supply: { ...s, maxLength } })} />
            <Num label="Pas" invalid={bad(s.step)} value={s.step} onChange={(step) => set({ supply: { ...s, step } })} />
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
                  <NumInput aria-label="Largeur du format" className="input-num" invalid={bad(f.width)} value={f.width} onChange={(n) => upd({ width: n ?? NaN })} />
                  <NumInput aria-label="Longueur du format" className="input-num" invalid={bad(f.length)} value={f.length} onChange={(n) => upd({ length: n ?? NaN })} />
                  <div className="relative min-w-0">
                    <NumInput aria-label="Prix du format" className="input-num pr-10" placeholder="—" value={f.price ?? null} onChange={(n) => upd({ price: n ?? undefined })} />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">CHF</span>
                  </div>
                  <Button variant="ghost" className="btn-danger h-8 w-7 justify-center px-0" aria-label="Retirer" onClick={() => set({ supply: { ...s, formats: s.formats.filter((_, j) => j !== i) } })}><Trash2 size={14} /></Button>
                  {duplicates.has(i) && <p role="alert" className="col-span-4 text-xs font-medium text-warning">Format en double</p>}
                </div>
              );
            })}
            <Button variant="ghost" className="btn-ghost" onClick={() => set({ supply: { ...s, formats: [...s.formats, { id: uid(), width: 2070, length: 2800 }] } })}><Plus size={14} /> Format</Button>
            <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>Mélanger les formats seulement si cela fait gagner au moins</span>
              <NumInput aria-label="Gain minimum pour mélanger les formats" className="input-num w-16" value={m.mixMinGain ?? 3}
                onChange={(n) => set({ mixMinGain: n ?? undefined })} />
              <span>% de matière</span>
            </label>
            <p className="text-xs text-muted-foreground">Sinon, un seul format est utilisé pour tout le débit.</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        {s.mode !== "catalog" && duplicates.size > 0 && <p role="alert" className="self-center text-xs text-warning">Format en double dans le catalogue</p>}
        {problems.length > 0 && <p role="alert" className="mr-auto self-center text-xs font-medium text-destructive">À compléter : {problems.join(", ")}</p>}
        <Button variant="ghost" className="btn-ghost" onClick={onCancel}>Annuler</Button>
        <Button className="btn-primary" disabled={duplicates.size > 0 || problems.length > 0} onClick={() => {
          if (duplicates.size > 0 || problems.length > 0) return;
          onSave({ ...m, supplyValues: { ...m.supplyValues, [s.mode]: s } });
        }}>Enregistrer</Button>
      </div>
    </Modal>
  );
}
