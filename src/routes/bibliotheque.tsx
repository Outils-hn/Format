import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/format/ThemeToggle";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Material } from "@/lib/types";
import { exportLibrary, loadMaterials, parseLibrary, saveMaterials } from "@/lib/storage";
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
  useEffect(() => { setMaterials(loadMaterials()); }, []);
  const change = (next: Material[]) => { saveMaterials(next); setMaterials(next); };

  // Ajoute sans conflit jusqu'au prochain doublon de nom, qui attend une réponse.
  const advance = (lib: Material[], queue: Material[], added: number) => {
    let next = [...lib]; let rest = [...queue]; let n = added;
    while (rest.length) {
      const m = rest[0]!;
      if (next.some((x) => sameName(x, m))) { setPending({ lib: next, queue: rest, added: n }); return; }
      next.push(next.some((x) => x.id === m.id) ? { ...m, id: uid() } : m); rest = rest.slice(1); n++;
    }
    setPending(null); change(next); toast.success(`${n} matériau(x) importé(s)`);
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
      <MaterialsCard materials={materials} onChange={change} />
    </main>
    <AppFooter />
    {conflict && <Modal title="Matériau déjà présent" onClose={() => setPending(null)}>
      <p className="text-sm">Un matériau nommé « {conflict.name} » existe déjà dans la bibliothèque.</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" className="btn-outline" onClick={() => resolve(false)}>Garder les deux</Button>
        <Button className="btn-primary" onClick={() => resolve(true)}>Remplacer</Button>
      </div>
    </Modal>}
  </div>;
}
