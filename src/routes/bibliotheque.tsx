import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/format/ThemeToggle";
import { ArrowLeft, CloudOff, Download, RefreshCw, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import type { Material } from "@/lib/types";
import { exportLibrary, loadMaterials, parseLibrary, saveMaterials, usedMaterialIds } from "@/lib/storage";
import { PinDialog, publierChangements, synchroniser, type Etat } from "@/components/format/SharedLibrary";
import { lireDateSynchro } from "@/lib/shared-library";
import { uid } from "@/lib/ids";
import { MaterialsCard } from "@/components/format/MaterialsCard";
import { Brand } from "@/components/format/Brand";
import { AppFooter } from "@/components/format/AppFooter";
import { Modal } from "@/components/format/Modal";
import { Button } from "@/components/ui/button";
import { download } from "@/lib/export/common";

export const Route = createFileRoute("/bibliotheque")({
  head: () => ({ meta: [
    { title: "Bibliothèque de matériaux — Format" },
    { name: "description", content: "Créez et modifiez les matériaux et formats de panneaux de votre bibliothèque Format, dans votre navigateur." },
    { property: "og:title", content: "Bibliothèque de matériaux — Format" },
    { property: "og:description", content: "Votre bibliothèque locale de matériaux et formats de découpe." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: LibraryPage,
});

const sameName = (a: Material, b: Material) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

function LibraryPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  // Import en cours : bibliothèque en construction + matériaux restant à traiter.
  const [pending, setPending] = useState<{ lib: Material[]; queue: Material[]; added: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Bibliotheque commune : etat de la synchronisation et materiaux encore seulement sur ce poste
  const [etat, setEtat] = useState<Etat>("synchro");
  const [localOnly, setLocalOnly] = useState<Set<string>>(new Set());
  const [envoi, setEnvoi] = useState(false);
  const synchro = async (base: Material[]) => {
    setEtat("synchro");
    const r = await synchroniser(base, usedMaterialIds());
    setEtat(r.etat);
    if (r.etat === "ok") { saveMaterials(r.materials); setMaterials(r.materials); setLocalOnly(new Set(r.localOnly.map((m) => m.id))); }
  };
  useEffect(() => { const m = loadMaterials(); setMaterials(m); void synchro(m); }, []);
  // Chaque modification est envoyee a l'equipe (PIN) ; sans PIN ou sans reseau, elle est annulee.
  const change = async (next: Material[]) => {
    const avant = materials;
    saveMaterials(next); setMaterials(next);
    if (etat === "horsLigne") { saveMaterials(avant); setMaterials(avant); toast.error("Bibliothèque commune injoignable : modification annulée. Réessayez une fois la connexion revenue."); return; }
    const ok = await publierChangements(avant, next, localOnly);
    if (!ok) { saveMaterials(avant); setMaterials(avant); return; }
    // Les materiaux envoyes ne sont plus « seulement sur ce poste »
    const envoyes = new Set(next.filter((m) => JSON.stringify(m) !== JSON.stringify(avant.find((a) => a.id === m.id))).map((m) => m.id));
    setLocalOnly((s) => new Set([...s].filter((id) => !envoyes.has(id) && next.some((m) => m.id === id))));
  };
  const envoyerLocaux = async () => {
    setEnvoi(true);
    const locaux = materials.filter((m) => localOnly.has(m.id));
    const ok = await publierChangements(materials.filter((m) => !localOnly.has(m.id)), materials, new Set());
    setEnvoi(false);
    if (ok) { toast.success(`${locaux.length} matériau(x) envoyé(s) à l'équipe`); void synchro(materials); }
  };
  const dateSynchro = lireDateSynchro();

  // Ajoute sans conflit jusqu'au prochain doublon de nom, qui attend une réponse.
  const advance = (lib: Material[], queue: Material[], added: number) => {
    let next = [...lib]; let rest = [...queue]; let n = added;
    while (rest.length) {
      const m = rest[0]!;
      if (next.some((x) => sameName(x, m))) { setPending({ lib: next, queue: rest, added: n }); return; }
      next.push(next.some((x) => x.id === m.id) ? { ...m, id: uid() } : m); rest = rest.slice(1); n++;
    }
    // Un import reste sur ce poste : le bandeau propose ensuite de l'envoyer a l'equipe
    setPending(null); saveMaterials(next); setMaterials(next);
    setLocalOnly((s) => new Set([...s, ...next.filter((m) => !materials.some((x) => x.id === m.id)).map((m) => m.id)]));
    toast.success(`${n} matériau(x) importé(s)`);
  };
  const resolve = (replace: boolean) => {
    if (!pending) return;
    const [m, ...rest] = pending.queue;
    if (!m) return;
    const lib = replace
      ? pending.lib.map((x) => (sameName(x, m) ? { ...m, id: x.id } : x))
      : [...pending.lib, { ...m, id: uid() }];
    advance(lib, rest, pending.added + 1);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { advance(materials, parseLibrary(await f.text()), 0); }
    catch { toast.error("Fichier invalide"); }
    if (fileRef.current) fileRef.current.value = "";
  };
  const conflict = pending?.queue[0];

  return <div className="flex min-h-screen flex-col">
    <header className="border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-8 py-3">
        <Brand />
        <Button asChild variant="ghost" className="btn-ghost ml-auto"><Link to="/"><ArrowLeft size={15} /> Retour au projet</Link></Button>
        <ThemeToggle />
      </div>
    </header>
    <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-5 px-8 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[32px] font-semibold leading-none tracking-[-0.03em]">Bibliothèque</h2>
        <Button variant="outline" className="btn-outline" disabled={!materials.length}
          onClick={() => download(new Blob([exportLibrary(materials)], { type: "application/json" }), "format-bibliotheque.json")}>
          <Download size={14} /> Exporter la bibliothèque (.json)</Button>
        <Button variant="outline" className="btn-outline" onClick={() => fileRef.current?.click()}><Upload size={14} /> Importer une bibliothèque (.json)</Button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {/* Etat de la bibliotheque commune */}
      <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {etat === "horsLigne" ? <CloudOff size={15} /> : etat === "synchro" ? <RefreshCw size={15} className="animate-spin" /> : <Users size={15} />}
        {etat === "ok" && "Bibliothèque commune à l'équipe · à jour. Les prix restent sur ce poste."}
        {etat === "synchro" && "Synchronisation avec la bibliothèque commune…"}
        {etat === "horsLigne" && `Bibliothèque commune injoignable : copie locale${dateSynchro ? ` du ${new Date(dateSynchro).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" })}` : ""}. Consultation possible, modifications impossibles.`}
        {etat === "horsLigne" && <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void synchro(materials)}>Réessayer</Button>}
      </p>
      {etat === "ok" && localOnly.size > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-accent px-4 py-3 text-sm text-accent-foreground">
          <p><b className="font-semibold">{localOnly.size} matériau(x) seulement sur ce poste</b> : {materials.filter((m) => localOnly.has(m.id)).map((m) => m.name).join(", ")}.</p>
          <Button className="btn-primary" disabled={envoi} onClick={envoyerLocaux}><Users size={14} /> Envoyer à l'équipe</Button>
        </div>
      )}
      <MaterialsCard materials={materials} onChange={(m) => void change(m)} localOnly={localOnly} />
    </main>
    <AppFooter />
    <PinDialog />
    {conflict && <Modal title="Matériau déjà présent" onClose={() => setPending(null)}>
      <p className="text-sm">Un matériau nommé « {conflict.name} » existe déjà dans la bibliothèque.</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" className="btn-outline" onClick={() => resolve(false)}>Garder les deux</Button>
        <Button className="btn-primary" onClick={() => resolve(true)}>Remplacer</Button>
      </div>
    </Modal>}
  </div>;
}
