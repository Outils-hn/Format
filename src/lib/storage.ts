// Persistance locale (localStorage) — aucune donnee ne quitte le navigateur.
import type { Material, Project, ProjectFile } from "./types";
import { uid } from "./ids";

const K = {
  materials: "format.materials",
  projects: "format.projects",
  current: "format.current",
  pasteMapping: "format.pasteMapping",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v));

// Un champ laisse vide est enregistre comme null : on remet les valeurs neutres
// (trait de coupe et delignage a 0) pour que les calculs restent possibles.
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
export const normalizeMaterial = (m: Material): Material => ({
  ...m,
  kerf: finite(m.kerf) ? m.kerf : 0,
  trim: finite(m.trim) ? m.trim : 0,
  // 0 ou moins : toute chute deviendrait « reutilisable » -> seuil par defaut (300 mm)
  reuseMin: finite(m.reuseMin) && m.reuseMin > 0 ? m.reuseMin : undefined,
  mixMinGain: finite(m.mixMinGain) ? m.mixMinGain : undefined,
});

export const loadMaterials = (): Material[] => read<Material[]>(K.materials, []).map(normalizeMaterial);
export const saveMaterials = (m: Material[]) => write(K.materials, m);

export const listProjects = (): Project[] =>
  read<Project[]>(K.projects, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export function saveProject(p: Project): Project {
  const saved = { ...p, updatedAt: new Date().toISOString() };
  const all = read<Project[]>(K.projects, []).filter((x) => x.id !== p.id);
  write(K.projects, [...all, saved]);
  return saved;
}
export const deleteProject = (id: string) =>
  write(K.projects, read<Project[]>(K.projects, []).filter((x) => x.id !== id));

export const loadCurrent = () => read<Project | null>(K.current, null);
export const saveCurrent = (p: Project) => write(K.current, p);

export const loadPasteMapping = () => read<string[] | null>(K.pasteMapping, null);
export const savePasteMapping = (m: string[]) => write(K.pasteMapping, m);

export function exportProject(project: Project, materials: Material[]): string {
  const used = new Set([...project.pieces, ...(project.linears ?? [])].map((p) => p.materialId));
  const file: ProjectFile = {
    app: "format",
    version: 1,
    project,
    materials: materials.filter((m) => used.has(m.id)),
  };
  return JSON.stringify(file, null, 2);
}

/** Importe un fichier : ajoute les materiaux inconnus a la bibliotheque. */
export function importProject(
  json: string,
  materials: Material[],
): { project: Project; materials: Material[] } {
  const f = JSON.parse(json) as ProjectFile;
  if (f?.app !== "format" || !f.project) throw new Error("Fichier non reconnu");
  const known = new Set(materials.map((m) => m.id));
  const merged = [...materials, ...(f.materials ?? []).filter((m) => !known.has(m.id)).map(normalizeMaterial)];
  return { project: { ...f.project, id: f.project.id || uid() }, materials: merged };
}

export const exportLibrary = (materials: Material[]) =>
  JSON.stringify({ app: "format", kind: "library", version: 1, materials }, null, 2);

/** Lit un fichier de bibliotheque (ou de projet) et renvoie ses materiaux. */
export function parseLibrary(json: string): Material[] {
  const f = JSON.parse(json) as { app?: string; materials?: Material[] };
  if (f?.app !== "format" || !Array.isArray(f.materials)) throw new Error("Fichier non reconnu");
  return f.materials.map(normalizeMaterial);
}

/** Materiaux utilises par le projet ouvert ou un projet enregistre sur ce poste. */
export function usedMaterialIds(): Set<string> {
  const ids = new Set<string>();
  const cur = loadCurrent();
  for (const p of [...(cur ? [cur] : []), ...listProjects()])
    for (const x of [...p.pieces, ...(p.linears ?? [])]) ids.add(x.materialId);
  return ids;
}
