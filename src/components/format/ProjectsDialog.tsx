import { useRef, useState } from "react";
import { jsonPermis } from "@/components/format/SharedLibrary";
import { CloudDownload, Download, FolderOpen, Share2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { chantierAccueil } from "@/lib/chantier-accueil";
import { chantierDe, lire, lister, monId, partager, retirer, type CalculBase } from "@/lib/calculs-base";
import type { Material } from "@/lib/types";
import type { Project } from "@/lib/types";
import { deleteProject, listProjects } from "@/lib/storage";
import { Modal } from "./Modal";
import { confirmer } from "./Confirm";

export function ProjectsDialog({
  onClose, onOpen, onExport, onImport, onOpenBase, materials, currentId,
}: {
  materials: Material[];
  onOpenBase: (json: string) => void;
  currentId?: string | undefined;
  onClose: () => void;
  onOpen: (p: Project) => void;
  onExport: () => void;
  onImport: (json: string) => void;
}) {
  const [projects, setProjects] = useState(listProjects);
  const file = useRef<HTMLInputElement>(null);
  const [base, setBase] = useState<CalculBase[] | null>(null);
  const [charge, setCharge] = useState(false);
  const numero = chantierDe(chantierAccueil()).numero;
  const erreur = (e: unknown, d: string) => toast.error(e instanceof Error ? e.message : d);
  const actualiser = async (tous: boolean) => {
    setCharge(true);
    try { setBase(await lister(tous ? "" : numero)); } catch (e) { erreur(e, "Lecture impossible"); } finally { setCharge(false); }
  };
  return (
    <Modal title="Mes projets" onClose={onClose}>
      <div className="mb-3 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base commune</span>
          <button className="btn-outline ml-auto" disabled={charge} onClick={() => void actualiser(false)}><CloudDownload size={14} /> {numero ? `Chantier ${numero}` : "Tous"}</button>
          {numero && <button className="btn-outline" disabled={charge} onClick={() => void actualiser(true)}>Tous</button>}
        </div>
        {base && (
          <ul className="mt-2 space-y-1">
            {base.length === 0 && <li className="py-2 text-center text-xs text-muted-foreground">Rien de partagé pour l'instant.</li>}
            {base.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5">
                <button className="min-w-0 flex-1 text-left" onClick={async () => {
                  try { const x = await lire(c.id); if (x?.donnees?.project) onOpenBase(JSON.stringify(x.donnees)); else toast.error("Calcul illisible."); } catch (e) { erreur(e, "Ouverture impossible"); }
                }}>
                  <div className="truncate text-sm font-medium">{c.nom || "Sans nom"}</div>
                  <div className="text-xs text-muted-foreground">{c.auteur_email.split("@")[0]} · {new Date(c.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                </button>
                {c.auteur === monId() && (
                  <button className="btn-danger h-8 px-2" aria-label="Retirer de la base" title="Retirer de la base"
                    onClick={async () => { try { await retirer(c.id); setBase((l) => l && l.filter((y) => y.id !== c.id)); toast.success("Retiré de la base (corbeille 30 jours)"); } catch (e) { erreur(e, "Suppression impossible"); } }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {p.info.site || "Sans nom"}
                {p.id === currentId && <span className="ml-2 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">ouvert</span>}
              </div>
              <div className="mono text-xs text-muted-foreground">
                {p.info.taskNumber && `#${p.info.taskNumber} · `}{p.info.date} · {p.pieces.length} pièce(s)
              </div>
            </div>
            <button className="btn-outline" onClick={() => onOpen(p)}><FolderOpen size={14} /> Ouvrir</button>
            <button className="btn-outline h-8 px-2" aria-label="Partager sur la base commune" title="Partager sur la base commune (visible dans le dossier du chantier)"
              onClick={async () => { try { await partager(p, materials); toast.success("Partagé sur la base commune : visible dans le dossier du chantier"); } catch (e) { erreur(e, "Partage impossible"); } }}>
              <Share2 size={14} />
            </button>
            <button className="btn-danger h-8 px-2" aria-label="Supprimer"
              onClick={async () => {
                if (!await confirmer({ titre: "Supprimer le projet", message: `« ${p.info.site || "Sans nom"} » sera supprimé de ce navigateur. Pensez à l'exporter (.json) si vous voulez le garder.`, ok: "Supprimer", danger: true })) return;
                deleteProject(p.id); setProjects(listProjects());
              }}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {projects.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun projet sauvegardé</li>}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <button className="btn-outline" onClick={() => { if (jsonPermis()) onExport(); }}><Download size={14} /> Exporter le projet (.json)</button>
        <button className="btn-outline" onClick={() => { if (jsonPermis()) file.current?.click(); }}><Upload size={14} /> Importer un projet (.json)</button>
        <input ref={file} type="file" accept=".json,application/json" hidden
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) onImport(await f.text()); e.target.value = ""; }} />
      </div>
    </Modal>
  );
}
