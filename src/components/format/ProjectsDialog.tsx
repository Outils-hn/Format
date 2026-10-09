import { useRef, useState } from "react";
import { Download, FolderOpen, Trash2, Upload } from "lucide-react";
import type { Project } from "@/lib/types";
import { deleteProject, listProjects } from "@/lib/storage";
import { Modal } from "./Modal";

export function ProjectsDialog({
  onClose, onOpen, onExport, onImport,
}: {
  onClose: () => void;
  onOpen: (p: Project) => void;
  onExport: () => void;
  onImport: (json: string) => void;
}) {
  const [projects, setProjects] = useState(listProjects);
  const file = useRef<HTMLInputElement>(null);
  return (
    <Modal title="Mes projets" onClose={onClose}>
      <ul className="divide-y divide-border rounded-sm border border-border">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{p.info.site || "Sans nom"}</div>
              <div className="mono text-xs text-muted-foreground">
                {p.info.taskNumber && `#${p.info.taskNumber} · `}{p.info.date} · {p.pieces.length} pièce(s)
              </div>
            </div>
            <button className="btn-outline" onClick={() => onOpen(p)}><FolderOpen size={14} /> Ouvrir</button>
            <button className="btn-danger h-8 px-2" aria-label="Supprimer"
              onClick={() => { if (confirm("Supprimer ce projet ?")) { deleteProject(p.id); setProjects(listProjects()); } }}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {projects.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun projet sauvegardé</li>}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <button className="btn-outline" onClick={onExport}><Download size={14} /> Exporter le projet (.json)</button>
        <button className="btn-outline" onClick={() => file.current?.click()}><Upload size={14} /> Importer un projet (.json)</button>
        <input ref={file} type="file" accept=".json,application/json" hidden
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) onImport(await f.text()); e.target.value = ""; }} />
      </div>
    </Modal>
  );
}
