import { useMemo, useState } from "react";
import type { Material, Piece } from "@/lib/types";
import {
  COLUMN_ROLES, detectHeader, matchMaterial, parseTable, rowsToPieces, type ColumnRole,
} from "@/lib/excel";
import { loadPasteMapping, savePasteMapping } from "@/lib/storage";
import { Modal } from "./Modal";

const DEFAULT_ROLES: ColumnRole[] = ["label", "material", "width", "height", "quantity"];

export function PasteDialog({
  materials, onClose, onApply, defaultMaterialId,
}: {
  materials: Material[];
  defaultMaterialId?: string | undefined;
  onClose: () => void;
  onApply: (pieces: Piece[], mode: "replace" | "append") => void;
}) {
  const [text, setText] = useState("");
  const [roles, setRoles] = useState<ColumnRole[] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [fallback, setFallback] = useState(defaultMaterialId ?? materials[0]?.id ?? "");

  const table = useMemo(() => parseTable(text), [text]);
  const header = useMemo(() => (table[0] ? detectHeader(table[0]) : null), [table]);
  const cols = Math.max(0, ...table.map((r) => r.length));
  const effRoles: ColumnRole[] = Array.from({ length: cols }, (_, i) =>
    roles?.[i] ?? header?.[i] ?? ((loadPasteMapping() as ColumnRole[] | null) ?? DEFAULT_ROLES)[i] ?? "ignore");
  const dataRows = header ? table.slice(1) : table;

  const matCol = effRoles.indexOf("material");
  const unmatched = matCol < 0 ? [] : [...new Set(dataRows.map((r) => r[matCol] ?? ""))]
    .filter((t) => t && !matchMaterial(t, materials));

  const apply = (mode: "replace" | "append") => {
    savePasteMapping(effRoles);
    onApply(rowsToPieces(dataRows, effRoles, materials, fallback, overrides), mode);
  };

  return (
    <Modal title="Coller depuis Excel" onClose={onClose} wide>
      {table.length === 0 ? (
        <>
          <p className="mb-2 text-sm text-muted-foreground">Copiez des cellules dans Excel puis collez-les ici (Ctrl+V).</p>
          <textarea autoFocus className="input-tech mono h-48 py-2" value={text} onChange={(e) => setText(e.target.value)}
            placeholder={"Repère\tMatériau\tLargeur\tHauteur\tQuantité\nA1\tMDF\t600\t400\t2"} />
        </>
      ) : (
        <>
          <div className="max-h-80 overflow-auto rounded-sm border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {effRoles.map((r, i) => (
                    <th key={i} className="p-1.5">
                      <select className="input-tech h-7 text-xs" value={r}
                        onChange={(e) => { const n = [...effRoles]; n[i] = e.target.value as ColumnRole; setRoles(n); }}>
                        {COLUMN_ROLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {effRoles.map((r, j) => (
                      <td key={j} className={`px-2 py-1 ${r === "ignore" ? "text-muted-foreground/50 line-through" : ""} ${["width", "height", "quantity"].includes(r) ? "mono text-right" : ""}`}>{row[j]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{dataRows.length} ligne(s){header && " · en-têtes détectés"}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {unmatched.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">« {t} » →</span>
                <select className="input-tech w-48" value={overrides[t] ?? fallback} onChange={(e) => setOverrides({ ...overrides, [t]: e.target.value })}>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name} {m.thickness}</option>)}
                </select>
              </label>
            ))}
            {matCol < 0 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="flex-1">Matériau pour toutes les pièces</span>
                <select className="input-tech w-48" value={fallback} onChange={(e) => setFallback(e.target.value)}>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name} {m.thickness}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost mr-auto" onClick={() => { setText(""); setRoles(null); }}>Recommencer</button>
            <button className="btn-outline" onClick={() => apply("replace")}>Remplacer la liste</button>
            <button className="btn-primary" onClick={() => apply("append")}>Ajouter à la liste</button>
          </div>
        </>
      )}
    </Modal>
  );
}
