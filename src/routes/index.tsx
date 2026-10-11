import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FilePlus2, FileSpreadsheet, FileText, FolderOpen, Library, Loader2, Play, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import type { Material, Project } from "@/lib/types";
import { newProject } from "@/lib/defaults";
import {
  exportProject, importProject, loadCurrent, loadMaterials, saveCurrent, saveMaterials, saveProject,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/format/Brand";
import { ProjectSettings } from "@/components/format/ProjectSettings";
import { Modal } from "@/components/format/Modal";
import { PiecesCard } from "@/components/format/PiecesCard";
import { ProjectsDialog } from "@/components/format/ProjectsDialog";
import { ResultsPanel } from "@/components/format/ResultsPanel";
import { runOptimization, type Objective, type OptimizeResult } from "@/lib/optimizer";
import { linearErrors, linearPieces, linearRecap, linearSegments } from "@/lib/linear";
import { allowRotation, rotationCandidates, rotationSavings } from "@/lib/rotation";
import { validatePiece } from "@/lib/validation";
import { dims, num } from "@/lib/format";

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
  const [activeTab, setActiveTab] = useState<string>("");
  const [addedMaterials, setAddedMaterials] = useState<string[]>([]);
  const [choosingMaterial, setChoosingMaterial] = useState(false);
  const [objective, setObjective] = useState<Objective>("waste");
  const [intensive, setIntensive] = useState(false);
  const [running, setRunning] = useState(false);
  const [checkInputs, setCheckInputs] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [suggestion, setSuggestion] = useState<{
    key: string; ids: string[]; saved: number; result: OptimizeResult;
  } | null>(null);
  const calculation = useRef(0);
  const linears = project.linears ?? [];
  const allPieces = [...project.pieces, ...linearPieces(linears, materials)];
  const recap = result ? linearRecap(linears, materials, allPieces, result) : [];
  const inputKey = JSON.stringify({ materials, pieces: project.pieces, linears, objective, intensive, projectId: project.id });
  const latestInput = useRef(inputKey);
  latestInput.current = inputKey;
  const visibleSuggestion = suggestion?.key === inputKey ? suggestion : null;
  const tabIds = [...new Set([...project.pieces.map((p) => p.materialId), ...linears.map((l) => l.materialId), ...addedMaterials])];
  const selectedTab = activeTab === "summary" || tabIds.includes(activeTab) ? activeTab : tabIds[0] ?? "summary";
  const activeMaterial = materials.find((m) => m.id === selectedTab);
  const invalidTab = (id: string) => project.pieces.some((p) => p.materialId === id && validatePiece(p, materials))
    || linears.some((l) => l.materialId === id && (!l.bandWidth || !l.totalLength || (l.mode === "fixed" ? !l.segment : !l.min) || typeof linearSegments(l, materials) === "string"));
  useEffect(() => { setAddedMaterials([]); setActiveTab(""); }, [project.id]);

  const usedMats = materials.filter((m) => project.pieces.some((p) => p.materialId === m.id));
  const priceAvailable = usedMats.length > 0 && usedMats.every((m) => m.supply.mode === "catalog" && m.supply.formats.every((f) => f.price != null));
  const run = async () => {
    const emptyField = project.pieces.some((p) => !p.width || !p.height || !p.quantity)
      || linears.some((l) => !l.bandWidth || !l.totalLength || (l.mode === "fixed" ? !l.segment : !l.min));
    if (emptyField) { setCheckInputs(true); toast.error("Complétez les champs entourés en rouge"); return; }
    setCheckInputs(false);
    if (!allPieces.length) { toast.error("Ajoutez des pièces avant de lancer l'optimisation"); return; }
    if (linears.some((l) => typeof linearSegments(l, materials) === "string")) { toast.error("Un linéaire est incomplet ou impossible"); return; }
    const withLinearCheck = (r: OptimizeResult) => ({ ...r, errors: [...r.errors, ...linearErrors(linearRecap(linears, materials, allPieces, r))] });
    const runId = ++calculation.current;
    const key = inputKey;
    const options = { objective: objective === "price" && !priceAvailable ? "waste" as Objective : objective, intensive };
    const isCurrent = () => calculation.current === runId && latestInput.current === key;
    setSuggestion(null);
    setRunning(true);
    try {
      const baseline = withLinearCheck(await runOptimization({ materials, pieces: allPieces, options }));
      if (!isCurrent()) return;
      setResult(baseline);
      setRunning(false);
      const ids = rotationCandidates(allPieces, materials).map((p) => p.id);
      if (!ids.length) return;
      try {
        const alternative = withLinearCheck(await runOptimization({ materials, pieces: allowRotation(allPieces, ids), options }));
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

  const optimizationControls = <>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Objectif</span>
            <select className="input-tech w-72 max-w-full" value={objective === "price" && !priceAvailable ? "waste" : objective} onChange={(e) => setObjective(e.target.value as Objective)}>
              <option value="waste">Minimiser la chute</option>
              <option value="sheets">Minimiser le nombre de panneaux</option>
              <option value="price" disabled={!priceAvailable}>Minimiser le prix{priceAvailable ? "" : " (prix manquants)"}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm" title="Essais aléatoires supplémentaires pendant 2 secondes">
            <Button type="button" role="switch" variant="ghost" size="icon" aria-checked={intensive} onClick={() => setIntensive(!intensive)}
              className={`relative h-5 w-9 rounded-full transition-colors ${intensive ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all ${intensive ? "left-[18px]" : "left-0.5"}`} />
            </Button>
            Optimisation intensive
          </label>

  </>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-8 py-3">
          <Brand />
          <nav className="ml-auto flex flex-wrap gap-2">
            <Button asChild variant="ghost" className="btn-ghost"><Link to="/bibliotheque"><Library size={15} /> Bibliothèque</Link></Button>
            <button className="btn-outline" disabled={!result} title={result ? "" : "Lancez d'abord l'optimisation"} onClick={async () => {
              if (!result) return;
              if ((!info.site.trim() || !info.taskNumber.trim()) && !confirm("Le chantier ou le numéro de tâche est vide. Générer le PDF quand même ?")) return;
              try { const { exportWorkshopPdf } = await import("@/lib/export/pdf"); exportWorkshopPdf(result, materials, allPieces, info, recap, project.materialStatus, project.offcuts); }
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

      <main className="mx-auto max-w-[1600px] space-y-5 px-8 pt-6 pb-28">
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

        <div className="flex items-end gap-2 border-b border-border">
          <div role="tablist" aria-label="Matériaux du projet" className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {tabIds.map((id) => {
              const m = materials.find((row) => row.id === id);
              const invalid = invalidTab(id);
              return <Button key={id} id={`tab-${id}`} role="tab" aria-selected={selectedTab === id} aria-controls="project-tab-panel" variant="ghost"
                className={`h-11 rounded-none border-b-2 px-4 ${selectedTab === id ? "border-primary bg-primary/5 text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setActiveTab(id)}>
                {m ? `${m.name} ${num(m.thickness, 1)} mm` : "Matériau inconnu"}
                {invalid && <span role="img" aria-label="Saisie invalide" title="Saisie invalide" className="h-2 w-2 shrink-0 rounded-full bg-destructive" />}
              </Button>;
            })}
            <Button variant="ghost" size="icon" aria-label="Ajouter un matériau" title="Ajouter un matériau" className="h-10 w-10 text-primary" onClick={() => setChoosingMaterial(true)}><Plus size={18} /></Button>
            <Button id="tab-summary" role="tab" aria-selected={selectedTab === "summary"} aria-controls="project-tab-panel" variant="ghost"
              className={`ml-auto h-11 rounded-none border-b-2 px-4 ${selectedTab === "summary" ? "border-primary bg-primary/5 text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setActiveTab("summary")}>Synthèse</Button>
          </div>
        </div>

        {selectedTab !== "summary" && <div className="space-y-4">
          <PiecesCard key={selectedTab} materialId={selectedTab} pieces={project.pieces} materials={materials} onChange={(pieces) => setProject({ ...project, pieces })}
            subtitle={activeMaterial && <>
            {activeMaterial.supply.mode === "single" ? dims(activeMaterial.supply.width, activeMaterial.supply.length)
              : activeMaterial.supply.mode === "catalog" ? activeMaterial.supply.formats.map((f) => dims(f.width, f.length)).join(" · ")
              : `${num(activeMaterial.supply.width)} × ${num(activeMaterial.supply.minLength)}–${num(activeMaterial.supply.maxLength)}`}
            {` · ${activeMaterial.cutType === "free" ? "CNC" : "scie"} · trait ${num(activeMaterial.kerf, 1)} · délign. ${num(activeMaterial.trim, 1)}${activeMaterial.grainLocked ? " · sens imposé" : ""}`}
          </>}
            settings={<ProjectSettings status={project.materialStatus} onStatus={(materialStatus) => setProject({ ...project, materialStatus })} offcuts={project.offcuts} onOffcuts={(offcuts) => setProject({ ...project, offcuts })}>
              {optimizationControls}
            </ProjectSettings>}
            highlightEmpty={checkInputs} linears={linears} onLinearsChange={(l) => setProject({ ...project, linears: l })} />
        </div>}

        <section id="project-tab-panel" role="tabpanel" aria-labelledby={selectedTab === "summary" ? "tab-summary" : `tab-${selectedTab}`} className="card-tech">
          <div className="card-tech-head"><h2 className="card-title">{selectedTab === "summary" ? "Synthèse" : "Résultats"}</h2></div>
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
          {result ? <ResultsPanel result={result} materials={materials} materialId={selectedTab === "summary" ? undefined : selectedTab} summaryOnly={selectedTab === "summary"}
            linears={selectedTab === "summary" ? recap : recap.filter((r) => linears.some((l) => l.id === r.id && l.materialId === selectedTab))}
            pieces={allPieces} status={project.materialStatus} onStatus={(materialStatus) => setProject({ ...project, materialStatus })} offcuts={project.offcuts} onOffcuts={(offcuts) => setProject({ ...project, offcuts })} /> : (
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-end gap-x-4 gap-y-2 pl-4 pr-[140px] py-3 sm:pl-8">
          <span className="tabular-nums text-sm text-muted-foreground">{num(allPieces.reduce((n, p) => n + p.quantity, 0))} pièces</span>
          <Button className="btn-primary h-10 max-w-full whitespace-normal px-4" disabled={running} onClick={run}>
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}{running ? "Calcul en cours…" : "Lancer l'optimisation"}
          </Button>
        </div>
      </div>

      {choosingMaterial && <Modal title="Ajouter un matériau" onClose={() => setChoosingMaterial(false)}>
        <div className="divide-y divide-border">
          {materials.map((m) => <Button key={m.id} variant="ghost" className="flex h-auto w-full justify-between rounded-none px-2 py-3 text-left"
            onClick={() => { setAddedMaterials((ids) => [...new Set([...ids, m.id])]); setActiveTab(m.id); setChoosingMaterial(false); }}>
            <span>{m.name} <span className="tabular-nums text-muted-foreground">{num(m.thickness, 1)} mm</span></span>
            <Plus size={16} />
          </Button>)}
          {materials.length === 0 && <p className="py-4 text-sm text-muted-foreground">Aucun matériau dans la bibliothèque.</p>}
        </div>
        <Button asChild variant="outline" className="btn-outline mt-4"><Link to="/bibliotheque"><Library size={15} /> Bibliothèque</Link></Button>
      </Modal>}

      {showProjects && (
        <ProjectsDialog onClose={() => setShowProjects(false)} onExport={doExport} onImport={doImport}
          onOpen={(p) => { setProject(p); setShowProjects(false); }} />
      )}
    </div>
  );
}
