import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FilePlus2, FileSpreadsheet, FileText, FolderOpen, Loader2, Play, Save } from "lucide-react";
import { toast } from "sonner";
import type { Material, Project } from "@/lib/types";
import { newProject } from "@/lib/defaults";
import {
  exportProject, importProject, loadCurrent, loadMaterials, saveCurrent, saveMaterials, saveProject,
} from "@/lib/storage";
import { Logo } from "@/components/format/Logo";
import { MaterialsCard } from "@/components/format/MaterialsCard";
import { PiecesCard } from "@/components/format/PiecesCard";
import { ProjectsDialog } from "@/components/format/ProjectsDialog";
import { ResultsPanel } from "@/components/format/ResultsPanel";
import { runOptimization, type Objective, type OptimizeResult } from "@/lib/optimizer";
import { allowRotation, rotationCandidates, rotationSavings } from "@/lib/rotation";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Format — Optimisation de découpe 2D" },
      { name: "description", content: "Préparez vos fiches de débit de panneaux bois, plâtre, tôle et composite. Données stockées dans votre navigateur." },
      { property: "og:title", content: "Format — Optimisation de découpe 2D" },
      { property: "og:description", content: "Saisie des matériaux et pièces pour l'optimisation de débit de panneaux." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [ready, setReady] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [project, setProject] = useState<Project>(newProject);
  const [showProjects, setShowProjects] = useState(false);
  const [objective, setObjective] = useState<Objective>("waste");
  const [intensive, setIntensive] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [suggestion, setSuggestion] = useState<{
    key: string; ids: string[]; saved: number; result: OptimizeResult;
  } | null>(null);
  const calculation = useRef(0);
  const inputKey = JSON.stringify({ materials, pieces: project.pieces, objective, intensive, projectId: project.id });
  const latestInput = useRef(inputKey);
  latestInput.current = inputKey;
  const visibleSuggestion = suggestion?.key === inputKey ? suggestion : null;

  const usedMats = materials.filter((m) => project.pieces.some((p) => p.materialId === m.id));
  const priceAvailable = usedMats.length > 0 && usedMats.every((m) => m.supply.mode === "catalog" && m.supply.formats.every((f) => f.price != null));
  const run = async () => {
    if (!project.pieces.length) { toast.error("Ajoutez des pièces avant de lancer l'optimisation"); return; }
    const runId = ++calculation.current;
    const key = inputKey;
    const options = { objective: objective === "price" && !priceAvailable ? "waste" as Objective : objective, intensive };
    const isCurrent = () => calculation.current === runId && latestInput.current === key;
    setSuggestion(null);
    setRunning(true);
    try {
      const baseline = await runOptimization({ materials, pieces: project.pieces, options });
      if (!isCurrent()) return;
      setResult(baseline);
      setRunning(false);
      const ids = rotationCandidates(project.pieces, materials).map((p) => p.id);
      if (!ids.length) return;
      try {
        const alternative = await runOptimization({ materials, pieces: allowRotation(project.pieces, ids), options });
        const saved = rotationSavings(baseline, alternative);
        if (isCurrent() && saved > 0) setSuggestion({ key, ids, saved, result: alternative });
      } catch {
        // A failed optional comparison must not interrupt the displayed result.
      }
    } catch (e) {
      toast.error("Échec de l'optimisation");
      console.error(e);
    } finally { if (calculation.current === runId) setRunning(false); }
  };

  useEffect(() => {
    setMaterials(loadMaterials());
    const cur = loadCurrent();
    if (cur) setProject(cur);
    setReady(true);
  }, []);
  useEffect(() => { if (ready) saveMaterials(materials); }, [materials, ready]);
  useEffect(() => { if (ready) saveCurrent(project); }, [project, ready]);

  const info = project.info;
  const setInfo = (patch: Partial<typeof info>) => setProject({ ...project, info: { ...info, ...patch } });

  const doExport = () => {
    const blob = new Blob([exportProject(project, materials)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `format-${(info.site || "projet").replace(/[^\w-]+/g, "_")}-${info.date}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = (json: string) => {
    try {
      const r = importProject(json, materials);
      setMaterials(r.materials);
      setProject(r.project);
      setShowProjects(false);
      toast.success("Projet importé");
    } catch {
      toast.error("Fichier invalide");
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-8 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-lg font-bold leading-none tracking-[0.35em]">FORMAT</h1>
              <p className="mt-1 text-[10px] font-medium tracking-[0.2em] text-muted-foreground">OPTIMISATION DE DÉCOUPE 2D</p>
            </div>
          </div>
          <nav className="ml-auto flex flex-wrap gap-2">
            <button className="btn-outline" disabled={!result} title={result ? "" : "Lancez d'abord l'optimisation"} onClick={async () => {
              if (!result) return;
              if ((!info.site.trim() || !info.taskNumber.trim()) && !confirm("Le chantier ou le numéro de tâche est vide. Générer le PDF quand même ?")) return;
              try { const { exportWorkshopPdf } = await import("@/lib/export/pdf"); exportWorkshopPdf(result, materials, project.pieces, info); }
              catch (e) { console.error(e); toast.error("Échec de la génération du PDF"); }
            }}><FileText size={15} /> PDF atelier</button>
            <button className="btn-outline" disabled={!result} title={result ? "" : "Lancez d'abord l'optimisation"} onClick={async () => {
              if (!result) return;
              try { const { exportOrderXlsx } = await import("@/lib/export/xlsx"); exportOrderXlsx(result, materials, info); }
              catch (e) { console.error(e); toast.error("Échec de l'export Excel"); }
            }}><FileSpreadsheet size={15} /> Commande Excel</button>
            <button className="btn-ghost" onClick={() => setShowProjects(true)}><FolderOpen size={15} /> Mes projets</button>
            <button className="btn-ghost" onClick={() => confirm("Commencer un nouveau projet ? Les modifications non sauvegardées seront perdues.") && setProject(newProject())}><FilePlus2 size={15} /> Nouveau</button>
            <button className="btn-primary" onClick={() => { setProject(saveProject(project)); toast.success("Projet sauvegardé"); }}><Save size={15} /> Sauvegarder</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-5 px-8 py-6">
        <section className="card-tech">
          <div className="card-tech-head"><h2 className="card-title">Informations du projet</h2></div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {([["site", "Chantier"], ["taskNumber", "Numéro de tâche"], ["client", "Client"]] as const).map(([k, l]) => (
              <label key={k} className="block">
                <span className="field-label">{l}</span>
                <input className="input-tech" value={info[k]} onChange={(e) => setInfo({ [k]: e.target.value })} />
              </label>
            ))}
            <label className="block">
              <span className="field-label">Date</span>
              <input type="date" className="input-tech mono" value={info.date} onChange={(e) => setInfo({ date: e.target.value })} />
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">Ces informations apparaîtront en haut de la fiche de débit PDF.</p>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr]">
          <MaterialsCard materials={materials} onChange={setMaterials} />
          <PiecesCard pieces={project.pieces} materials={materials} onChange={(pieces) => setProject({ ...project, pieces })} />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Objectif</span>
            <select className="input-tech w-64" value={objective === "price" && !priceAvailable ? "waste" : objective} onChange={(e) => setObjective(e.target.value as Objective)}>
              <option value="waste">Minimiser la chute</option>
              <option value="sheets">Minimiser le nombre de panneaux</option>
              <option value="price" disabled={!priceAvailable}>Minimiser le prix{priceAvailable ? "" : " (prix manquants)"}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm" title="Essais aléatoires supplémentaires pendant 2 secondes">
            <button type="button" role="switch" aria-checked={intensive} onClick={() => setIntensive(!intensive)}
              className={`relative h-5 w-9 rounded-full transition-colors ${intensive ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all ${intensive ? "left-[18px]" : "left-0.5"}`} />
            </button>
            Optimisation intensive
          </label>
          <button className="btn-primary h-11 px-6 text-base" disabled={running} onClick={run}>
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {running ? "Calcul en cours…" : "Lancer l'optimisation"}
          </button>
        </div>

        <section className="card-tech">
          <div className="card-tech-head"><h2 className="card-title">Résultats</h2></div>
          {visibleSuggestion && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent px-4 py-3 text-sm text-accent-foreground">
              <p>Autoriser la rotation de ces pièces économiserait {visibleSuggestion.saved} panneau(x)</p>
              <button className="btn-primary" onClick={() => {
                calculation.current++;
                setProject({ ...project, pieces: allowRotation(project.pieces, visibleSuggestion.ids) });
                setResult(visibleSuggestion.result);
                setSuggestion(null);
                setRunning(false);
              }}>Appliquer</button>
            </div>
          )}
          {result ? <ResultsPanel result={result} materials={materials} /> : (
            <div className="flex flex-col items-center gap-4 px-4 py-12 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="h-8 w-12 rounded-sm border border-border hatch-waste" />
                <span className="h-8 w-12 rounded-sm border border-border hatch-reuse" />
              </div>
              Lancez l'optimisation pour voir les résultats
            </div>
          )}
        </section>
      </main>

      {showProjects && (
        <ProjectsDialog onClose={() => setShowProjects(false)} onExport={doExport} onImport={doImport}
          onOpen={(p) => { setProject(p); setShowProjects(false); }} />
      )}
    </div>
  );
}
