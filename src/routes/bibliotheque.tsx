import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Library } from "lucide-react";
import type { Material } from "@/lib/types";
import { loadMaterials, saveMaterials } from "@/lib/storage";
import { MaterialsCard } from "@/components/format/MaterialsCard";
import { Brand } from "@/components/format/Brand";
import { Button } from "@/components/ui/button";

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

function LibraryPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  useEffect(() => { setMaterials(loadMaterials()); }, []);
  const change = (next: Material[]) => { saveMaterials(next); setMaterials(next); };
  return <div className="min-h-screen">
    <header className="border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-8 py-3">
        <Brand />
        <Button asChild variant="ghost" className="btn-ghost ml-auto"><Link to="/"><ArrowLeft size={15} /> Retour au projet</Link></Button>
      </div>
    </header>
    <main className="mx-auto max-w-[1600px] space-y-5 px-8 py-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Library size={20} /> Bibliothèque</h2>
      <MaterialsCard materials={materials} onChange={change} />
    </main>
  </div>;
}