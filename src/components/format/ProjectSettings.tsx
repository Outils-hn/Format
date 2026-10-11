import type { ReactNode } from "react";
import type { MaterialStatus, OffcutSettings } from "@/lib/types";
import { DEFAULT_OFFCUT_SETTINGS } from "@/lib/offcuts";

export function ProjectSettings({ children, status, onStatus, offcuts, onOffcuts }: {
  children?: ReactNode;
  status?: MaterialStatus | undefined;
  onStatus: (s: MaterialStatus) => void;
  offcuts?: OffcutSettings | undefined;
  onOffcuts: (o: OffcutSettings) => void;
}) {
  const s = status ?? { status: "toOrder" as const };
  const oc = offcuts ?? DEFAULT_OFFCUT_SETTINGS;
  return <div className="flex flex-wrap items-end gap-4 border-t border-border bg-muted/30 px-4 py-4 text-sm">
    {children}
    <label><span className="field-label">Statut de la matière</span>
      <select className="input-tech w-56 max-w-full" value={s.status} onChange={(e) => onStatus({ ...s, status: e.target.value as MaterialStatus["status"] })}>
        <option value="toOrder">À commander</option><option value="ordered">Commandée</option><option value="stock">Matière déjà disponible</option>
      </select>
    </label>
    {s.status === "ordered" && <>
      <label><span className="field-label">Date de commande</span><input type="date" className="input-tech" value={s.orderDate ?? ""} onChange={(e) => onStatus({ ...s, orderDate: e.target.value })} /></label>
      <label><span className="field-label">Fournisseur</span><input className="input-tech" value={s.supplier ?? ""} onChange={(e) => onStatus({ ...s, supplier: e.target.value })} /></label>
      <label><span className="field-label">N° de commande</span><input className="input-tech" value={s.orderNumber ?? ""} onChange={(e) => onStatus({ ...s, orderNumber: e.target.value })} /></label>
    </>}
    <label><span className="field-label">Chutes dans le PDF atelier</span>
      <select className="input-tech w-64 max-w-full" value={oc.mode} onChange={(e) => onOffcuts({ ...oc, mode: e.target.value as OffcutSettings["mode"] })}>
        <option value="hide">Ne pas afficher</option><option value="indicative">Chutes conservables (indicatif)</option><option value="retain">Chutes à conserver (consigne)</option>
      </select>
    </label>
    {oc.mode === "retain" && <label className="flex items-center gap-2 py-2"><input type="checkbox" className="accent-primary" checked={oc.labelsPage} onChange={(e) => onOffcuts({ ...oc, labelsPage: e.target.checked })} />Ajouter une page d'étiquettes</label>}
  </div>;
}