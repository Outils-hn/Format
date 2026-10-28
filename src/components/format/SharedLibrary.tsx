// Interface de la bibliotheque commune : demande du PIN (comme dans Masse), etat de la
// synchronisation, envoi des modifications. La logique pure est dans lib/shared-library.ts.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Material } from "@/lib/types";
import { Modal } from "./Modal";
import { Button } from "@/components/ui/button";
import {
  envoyerMateriau, erreurDePin, fusionner, lireBibliotheque, noterSynchro, pinSession, retenirPin,
  sansPrix, supprimerMateriau, verifierPin,
} from "@/lib/shared-library";

// ---------- PIN : une seule fenetre pour toute l'appli, ouverte a la demande ----------
let resolver: ((v: string | null) => void) | null = null;
const abonnes = new Set<(ouvert: boolean) => void>();

/** PIN de la session, ou demande a l'utilisateur (null s'il annule). */
export function demanderPin(): Promise<string | null> {
  const p = pinSession();
  if (p) return Promise.resolve(p);
  abonnes.forEach((f) => f(true));
  return new Promise((r) => (resolver = r));
}

export function PinDialog() {
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState("");
  const [enCours, setEnCours] = useState(false);
  useEffect(() => { abonnes.add(setOuvert); return () => void abonnes.delete(setOuvert); }, []);
  if (!ouvert) return null;
  const fermer = (v: string | null) => { setOuvert(false); setValeur(""); resolver?.(v); resolver = null; };
  const valider = async () => {
    setEnCours(true);
    const r = await verifierPin(valeur);
    setEnCours(false);
    if (r.ok) { retenirPin(valeur); fermer(valeur); } else toast.error(r.error ?? "PIN incorrect.");
  };
  return (
    <Modal title="Code PIN requis" onClose={() => fermer(null)}>
      <p className="text-sm text-muted-foreground">La bibliothèque est commune à l'équipe : saisissez le PIN (le même que Masse) pour la modifier pendant cette session.</p>
      <input autoFocus type="password" inputMode="numeric" aria-label="Code PIN" className="input-tech mono mt-4" value={valeur}
        onChange={(e) => setValeur(e.target.value)} onKeyDown={(e) => e.key === "Enter" && valeur && void valider()} />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" className="btn-ghost" onClick={() => fermer(null)}>Annuler</Button>
        <Button className="btn-primary" disabled={enCours || !valeur} onClick={valider}>Déverrouiller</Button>
      </div>
    </Modal>
  );
}

// ---------- Synchronisation ----------
export type Etat = "synchro" | "ok" | "horsLigne";

/** Recupere la bibliotheque commune et la fusionne avec la copie locale. */
export async function synchroniser(local: Material[], used: Set<string>) {
  const remote = await lireBibliotheque();
  if (!remote) return { etat: "horsLigne" as Etat, materials: local, localOnly: [] as Material[] };
  const f = fusionner(local, remote, used);
  noterSynchro(f.known);
  return { etat: "ok" as Etat, materials: f.materials, localOnly: f.localOnly };
}

const memeContenu = (a: Material, b: Material) => JSON.stringify(sansPrix(a)) === JSON.stringify(sansPrix(b));

/**
 * Envoie a l'equipe ce qui a change entre deux versions de la bibliotheque.
 * Un changement de prix seul reste local (pas de PIN). Renvoie false si l'envoi n'a pas eu lieu
 * (PIN annule ou refuse, pas de connexion) : la modification doit alors etre annulee a l'ecran.
 */
export async function publierChangements(avant: Material[], apres: Material[], localOnly: Set<string>): Promise<boolean> {
  const idsApres = new Set(apres.map((m) => m.id));
  const modifies = apres.filter((m) => { const a = avant.find((x) => x.id === m.id); return !a || !memeContenu(a, m); });
  // Un materiau seulement sur ce poste peut etre supprime sans toucher a l'equipe
  const supprimes = avant.filter((m) => !idsApres.has(m.id) && !localOnly.has(m.id));
  if (!modifies.length && !supprimes.length) return true;
  const pin = await demanderPin();
  if (!pin) { toast.error("Modification annulée : le PIN est nécessaire pour modifier la bibliothèque commune."); return false; }
  for (const m of modifies) {
    const r = await envoyerMateriau(pin, m);
    if (!r.ok) { if (erreurDePin(r.error)) retenirPin(null); toast.error(r.error ?? "Échec de l'envoi."); return false; }
  }
  for (const m of supprimes) {
    const r = await supprimerMateriau(pin, m.id);
    if (!r.ok) { if (erreurDePin(r.error)) retenirPin(null); toast.error(r.error ?? "Échec de la suppression."); return false; }
  }
  return true;
}
