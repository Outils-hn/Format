// Fenetre de confirmation au style de l'appli (remplace confirm() du navigateur).
// Utilisation : `if (await confirmer({ titre, message, ok: "Supprimer", danger: true })) …`
// Le composant <ConfirmHost /> doit etre present une fois par page.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Demande { titre: string; message: string; ok?: string; annuler?: string; danger?: boolean }

let ouvrir: ((d: Demande, r: (v: boolean) => void) => void) | null = null;

export function confirmer(d: Demande): Promise<boolean> {
  // Page sans hote (ne devrait pas arriver) : on retombe sur la boite du navigateur
  if (!ouvrir) return Promise.resolve(typeof window !== "undefined" && window.confirm(d.message));
  return new Promise((r) => ouvrir!(d, r));
}

export function ConfirmHost() {
  const [demande, setDemande] = useState<{ d: Demande; r: (v: boolean) => void } | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ouvrir = (d, r) => setDemande({ d, r });
    return () => { ouvrir = null; };
  }, []);
  const fermer = (v: boolean) => { demande?.r(v); setDemande(null); };
  useEffect(() => {
    if (!demande) return;
    okRef.current?.focus();
    // Echap ferme seulement cette fenetre (pas la fenetre « Mes projets » en dessous)
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); fermer(false); }
    };
    window.addEventListener("keydown", touche, true);
    return () => window.removeEventListener("keydown", touche, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demande]);
  if (!demande) return null;
  const { d } = demande;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-foreground/30 p-4 pt-24" onMouseDown={() => fermer(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-titre" aria-describedby="confirm-message"
        className="card-tech w-full max-w-md p-5" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="confirm-titre" className="text-base font-semibold">{d.titre}</h2>
        <p id="confirm-message" className="mt-2 text-sm text-muted-foreground">{d.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" className="btn-ghost" onClick={() => fermer(false)}>{d.annuler ?? "Annuler"}</Button>
          <Button ref={okRef} className={d.danger ? "bg-destructive text-white hover:bg-destructive/90" : "btn-primary"} onClick={() => fermer(true)}>{d.ok ?? "Continuer"}</Button>
        </div>
      </div>
    </div>
  );
}
