import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import { chargerFiches, chercherFiches, lienFiche, type FicheIndex, type FicheRef } from "@/lib/index-fiches";

/**
 * Lien vers une fiche technique d'Index : affiche la fiche liee (ouverture dans Index),
 * ou un bouton « Lier une fiche Index » avec une recherche dans la bibliotheque.
 * Sans onChange : simple lien en lecture.
 */
export function FicheIndexLien({ value, onChange }: { value: FicheRef | null | undefined; onChange?: (v: FicheRef | null) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [fiches, setFiches] = useState<FicheIndex[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    chargerFiches().then(setFiches, () => setErreur(true));
    const dehors = (e: MouseEvent) => { if (!boite.current?.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert]);

  if (value) {
    return (
      <span className="inline-flex max-w-full items-center gap-1 text-xs">
        <a href={lienFiche(value.id)} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 text-foreground underline-offset-2 hover:underline" title="Ouvrir la fiche technique dans Index">
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{value.name}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </a>
        {onChange && (
          <button type="button" onClick={() => onChange(null)} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Retirer le lien vers ${value.name}`}>
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }
  if (!onChange) return null;

  const res = fiches ? chercherFiches(fiches, q) : [];
  return (
    <div ref={boite} className="relative inline-block">
      <button type="button" onClick={() => setOuvert((o) => !o)} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        Lier une fiche Index
      </button>
      {ouvert && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              const premier = res[0];
              if (e.key === "Escape") setOuvert(false);
              if (e.key === "Enter" && premier) { onChange({ id: premier.id, name: premier.name }); setOuvert(false); }
            }}
            placeholder="Rechercher dans Index…"
            aria-label="Rechercher une fiche dans Index"
            className="mb-1 w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:border-foreground"
          />
          {erreur ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Index injoignable pour le moment.</p>
          ) : !fiches ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Chargement…</p>
          ) : !res.length ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">Aucune fiche trouvée.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {res.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => { onChange({ id: f.id, name: f.name }); setOuvert(false); }} className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="block truncate">{f.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{f.supplier} · {f.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
