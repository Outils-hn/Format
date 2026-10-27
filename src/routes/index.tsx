import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/format/ThemeToggle";
import { FilePlus2, FileSpreadsheet, FileText, FolderOpen, Library, Loader2, Play, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import type { Material, Project } from "@/lib/types";
import { newProject } from "@/lib/defaults";
import {
  exportProject, importProject, listProjects, loadCurrent, loadMaterials, saveCurrent, saveMaterials, saveProject,
} from "@/lib/storage";
import { uid } from "@/lib/ids";
import { defaultOffcutSettings } from "@/lib/offcuts";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/format/Brand";
import { AppFooter } from "@/components/format/AppFooter";
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
import { orderTypeLabel, orderTypeOf } from "@/lib/order";

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
  // Projet enregistre dont le chantier ou la tache a change : on demande avant d'ecraser
  const [saveChoice, setSaveChoice] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [addedMaterials, setAddedMaterials] = useState<string[]>([]);
  const [choosingMaterial, setChoosingMaterial] = useState(false);
  const [objective, setObjective] = useState<Objective>("waste");
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
  const inputKey = JSON.stringify({ materials, pieces: project.pieces, linears, objective, projectId: project.id });
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
  const workshop = !!project.workshopMode;
  const typeOf = (id: string) => orderTypeOf(materials.find((m) => m.id === id), project);
  // Chutes dans le PDF : le choix du projet, sinon masquees si tout est debite par le fournisseur
  const offcutSettings = project.offcuts ?? defaultOffcutSettings(tabIds.map(typeOf));
  const checkInfo = () => (info.site.trim() && info.taskNumber.trim()) || confirm("Le chantier ou le numéro de tâche est vide. Générer le PDF quand même ?");
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
    // La recherche approfondie est toujours active : le moteur la saute si le resultat est deja optimal.
    const options = { objective: objective === "price" && !priceAvailable ? "waste" as Objective : objective, intensive: true };
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

  // Ctrl + Entree (Cmd + Entree sur Mac) : lance l'optimisation depuis n'importe quel champ
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void runRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMaterials(loadMaterials());
    const cur = loadCurrent();
    if (cur) setProject(cur);
    setReady(true);
  }, []);
  useEffect(() => { if (ready) saveMaterials(materials); }, [materials, ready]);
  useEffect(() => { if (ready) saveCurrent(project); }, [project, ready]);

  const info = project.info;
  const projectName = (p: Project) => [p.info.site, p.info.taskNumber && `tâche ${p.info.taskNumber}`].filter(Boolean).join(" · ") || "Sans nom";
  // asNew : nouvel identifiant, l'ancien projet reste intact dans « Mes projets »
  const writeProject = (p: Project, asNew: boolean) => {
    const saved = saveProject(asNew ? { ...p, id: uid() } : p);
    setProject(saved);
    toast.success(asNew ? `Nouveau projet enregistré : « ${projectName(saved)} »` : `Projet « ${projectName(saved)} » mis à jour`);
  };
  const save = () => {
    const existing = listProjects().find((x) => x.id === project.id);
    if (!existing) { writeProject(project, false); return; }
    const renamed = existing.info.site.trim() !== info.site.trim() || existing.info.taskNumber.trim() !== info.taskNumber.trim();
    if (renamed) setSaveChoice(existing); else writeProject(project, false);
  };
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

  </>;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-8 py-3.5">
          <Brand />
          <nav className="ml-auto flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" className="btn-ghost"><Link to="/bibliotheque"><Library size={15} /> Bibliothèque</Link></Button>
            <label className="mr-1 flex items-center gap-2 px-2 text-[13px] text-muted-foreground">
              <Button type="button" role="switch" variant="ghost" size="icon" aria-checked={workshop} aria-label="Mode atelier" onClick={() => setProject({ ...project, workshopMode: !workshop })}
                className={`relative h-5 w-9 rounded-full transition-colors ${workshop ? "bg-primary" : "bg-input"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all ${workshop ? "left-[18px]" : "left-0.5"}`} />
              </Button>
              Mode atelier
            </label>
            <button className="btn-outline" disabled={!result} title={result ? "" : "Lancez d'abord l'optimisation"} onClick={async () => {
              if (!result || !checkInfo()) return;
              try { const { exportOrderPdf } = await import("@/lib/export/orderPdf"); exportOrderPdf(result, materials, allPieces, info, project); }
              catch (e) { console.error(e); toast.error("Échec de la génération du PDF"); }
            }}><FileText size={15} /> PDF commande</button>
            {workshop && <button className="btn-outline" disabled={!result} title={result ? "" : "Lancez d'abord l'optimisation"} onClick={async () => {
              if (!result || !checkInfo()) return;
              try { const { exportWorkshopPdf } = await import("@/lib/export/pdf"); exportWorkshopPdf(result, materials, allPieces, info, recap, project.materialStatus, offcutSettings); }
              catch (e) { console.error(e); toast.error("Échec de la génération du PDF"); }
            }}><FileText size={15} /> PDF atelier</button>}
            <button className="btn-outline" disabled={!result} title={result ? "" : "Lancez d'abord l'optimisation"} onClick={async () => {
              if (!result) return;
              try { const { exportOrderXlsx } = await import("@/lib/export/xlsx"); exportOrderXlsx(result, materials, info, allPieces, project, workshop); }
              catch (e) { console.error(e); toast.error("Échec de l'export Excel"); }
            }}><FileSpreadsheet size={15} /> Commande Excel</button>
            <button className="btn-ghost" onClick={() => setShowProjects(true)}><FolderOpen size={15} /> Mes projets</button>
            <button className="btn-ghost" onClick={() => confirm("Commencer un nouveau projet ? Les modifications non sauvegardées seront perdues.") && setProject(newProject())}><FilePlus2 size={15} /> Nouveau</button>
            <button className="btn-primary" onClick={save}><Save size={15} /> Sauvegarder</button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-8 pt-8 pb-6">
        <section aria-labelledby="titre-projet">
          <h2 id="titre-projet" className="text-[40px] font-semibold leading-none tracking-[-0.03em]">{info.site || "Nouveau projet"}</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">{[info.taskNumber, info.client].filter(Boolean).join(" · ") || "Renseignez le chantier ci-dessous"}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">Ces informations apparaissent en haut des PDF.</p>
          </div>
        </section>

        <div className="flex items-center gap-2 pt-2">
          <div role="tablist" aria-label="Matériaux du projet" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-xl bg-muted p-1">
            {tabIds.map((id) => {
              const m = materials.find((row) => row.id === id);
              const invalid = invalidTab(id);
              return <Button key={id} id={`tab-${id}`} role="tab" aria-selected={selectedTab === id} aria-controls="project-tab-panel" variant="ghost"
                className={`h-9 rounded-lg px-4 text-[13px] ${selectedTab === id ? "bg-card text-foreground shadow-sm hover:bg-card" : "text-muted-foreground hover:bg-transparent hover:text-foreground"}`} onClick={() => setActiveTab(id)}>
                {m ? `${m.name} ${num(m.thickness, 1)} mm` : "Matériau inconnu"}
                {invalid && <span role="img" aria-label="Saisie invalide" title="Saisie invalide" className="h-2 w-2 shrink-0 rounded-full bg-destructive" />}
              </Button>;
            })}
            <Button variant="ghost" size="icon" aria-label="Ajouter un matériau" title="Ajouter un matériau" className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-card hover:text-foreground" onClick={() => setChoosingMaterial(true)}><Plus size={16} /></Button>
            <Button id="tab-summary" role="tab" aria-selected={selectedTab === "summary"} aria-controls="project-tab-panel" variant="ghost"
              className={`ml-auto h-9 rounded-lg px-4 text-[13px] ${selectedTab === "summary" ? "bg-card text-foreground shadow-sm hover:bg-card" : "text-muted-foreground hover:bg-transparent hover:text-foreground"}`} onClick={() => setActiveTab("summary")}>Synthèse</Button>
          </div>
        </div>

        {selectedTab !== "summary" && <div className="space-y-4">
          <PiecesCard key={selectedTab} materialId={selectedTab} pieces={project.pieces} materials={materials} onChange={(pieces) => setProject({ ...project, pieces })}
            subtitle={activeMaterial && <>
            {activeMaterial.supply.mode === "single" ? dims(activeMaterial.supply.width, activeMaterial.supply.length)
              : activeMaterial.supply.mode === "catalog" ? activeMaterial.supply.formats.map((f) => dims(f.width, f.length)).join(" · ")
              : `${num(activeMaterial.supply.width)} × ${num(activeMaterial.supply.minLength)}–${num(activeMaterial.supply.maxLength)}`}
            {` · ${activeMaterial.cutType === "free" ? "CNC" : "scie"} · trait ${num(activeMaterial.kerf, 1)} · délign. ${num(activeMaterial.trim, 1)}${activeMaterial.grainLocked ? " · sens imposé" : ""} · ${orderTypeLabel(typeOf(activeMaterial.id)).toLowerCase()}${activeMaterial.supplier ? ` · ${activeMaterial.supplier}` : ""}`}
          </>}
            settings={<ProjectSettings status={project.materialStatus} onStatus={(materialStatus) => setProject({ ...project, materialStatus })} offcuts={offcutSettings} onOffcuts={(offcuts) => setProject({ ...project, offcuts })}
              workshop={workshop} orderType={typeOf(selectedTab)} onOrderType={(t) => setProject({ ...project, orderTypes: { ...project.orderTypes, [selectedTab]: t } })}
              showEstimate={project.showEstimate} onShowEstimate={(showEstimate) => setProject({ ...project, showEstimate })}
              supplierRemarks={project.supplierRemarks?.[selectedTab] ?? ""} onSupplierRemarks={(remarks) => setProject({ ...project, supplierRemarks: { ...project.supplierRemarks, [selectedTab]: remarks } })}>
              {optimizationControls}
            </ProjectSettings>}
            highlightEmpty={checkInputs} linears={linears} onLinearsChange={(l) => setProject({ ...project, linears: l })} />
        </div>}

        <section id="project-tab-panel" role="tabpanel" aria-labelledby={selectedTab === "summary" ? "tab-summary" : `tab-${selectedTab}`} className="card-tech">
          <div className="card-tech-head"><h2 className="card-title">{selectedTab === "summary" ? "Synthèse" : "Résultats"}</h2>{result && <kbd className="hidden font-mono text-[11px] text-muted-foreground sm:inline">Ctrl + Entrée pour relancer</kbd>}</div>
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
          {result ? <ResultsPanel result={result} materials={materials} materialId={selectedTab === "summary" ? undefined : selectedTab} summaryOnly={selectedTab === "summary"} workshop={workshop} orderTypeOf={typeOf}
            linears={selectedTab === "summary" ? recap : recap.filter((r) => linears.some((l) => l.id === r.id && l.materialId === selectedTab))}
            pieces={allPieces} status={project.materialStatus} onStatus={(materialStatus) => setProject({ ...project, materialStatus })} offcuts={offcutSettings} onOffcuts={(offcuts) => setProject({ ...project, offcuts })} /> : (
            <div className="flex flex-col items-center gap-4 px-4 py-12 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="h-8 w-12 rounded-lg border border-border hatch-waste" />
                <span className="h-8 w-12 rounded-lg border border-border hatch-reuse" />
              </div>
              Lancez l'optimisation pour voir les résultats
            </div>
          )}
        </section>
      </main>
      <AppFooter aboveLaunchBar />

      {/* Barre de lancement : pastille flottante en bas, toujours a portee de main */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 print:hidden">
        <div className="pointer-events-auto flex items-center gap-4 rounded-full bg-primary py-1.5 pl-5 pr-1.5 text-primary-foreground shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35)]">
          <span className="tabular-nums text-[13px] opacity-70">{num(allPieces.reduce((n, p) => n + p.quantity, 0))} pièces</span>
          <Button className="h-9 rounded-full bg-signal px-4 text-[13px] font-semibold text-white hover:bg-signal/90" disabled={running} onClick={run} title="Raccourci : Ctrl + Entrée">
            {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}{running ? "Calcul en cours…" : "Lancer l'optimisation"}
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
          {materials.length === 0 && <p className="py-4 text-sm font-medium">Créez d'abord un matériau</p>}
        </div>
        <Button asChild variant="outline" className="btn-outline mt-4"><Link to="/bibliotheque"><Library size={15} /> {materials.length ? "Bibliothèque" : "Aller à la Bibliothèque"}</Link></Button>
      </Modal>}

      {showProjects && (
        <ProjectsDialog currentId={project.id} onClose={() => setShowProjects(false)} onExport={doExport} onImport={doImport}
          onOpen={(p) => { setProject(p); setShowProjects(false); }} />
      )}

      {saveChoice && (
        <Modal title="Enregistrer le projet" onClose={() => setSaveChoice(null)}>
          <p className="text-sm">
            Le projet ouvert était enregistré sous <b>« {projectName(saveChoice)} »</b>. Le chantier ou la tâche a changé depuis.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button className="btn-ghost" onClick={() => setSaveChoice(null)}>Annuler</button>
            <button className="btn-outline" onClick={() => { writeProject(project, false); setSaveChoice(null); }}>Remplacer « {projectName(saveChoice)} »</button>
            <button className="btn-primary" onClick={() => { writeProject(project, true); setSaveChoice(null); }}>Enregistrer comme nouveau projet</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
