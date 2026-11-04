// Interface de la bibliotheque commune : connexion par compte Index, etat de la
// synchronisation, envoi des modifications. La logique pure est dans lib/shared-library.ts.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Material } from "@/lib/types";
import { Modal } from "./Modal";
import { Button } from "@/components/ui/button";
import {
  envoyerMateriau, fusionner, lireBibliotheque, noterSynchro, sansPrix, supprimerMateriau,
} from "@/lib/shared-library";
import { LogIn, LogOut } from "lucide-react";
import { INDEX_URL, connexion, deconnexion, lireSession, useCompte } from "@/lib/compte";

// ---------- Connexion : une seule fenetre pour toute l'appli, ouverte a la demande ----------
let resolver: ((v: boolean) => void) | null = null;
const abonnes = new Set<(ouvert: boolean) => void>();

/** Vrai si un compte est connecte, sinon ouvre la fenetre de connexion (faux si l'utilisateur annule). */
export function demanderConnexion(): Promise<boolean> {
  if (lireSession()) return Promise.resolve(true);
  abonnes.forEach((f) => f(true));
  return new Promise((r) => (resolver = r));
}

export function ConnexionDialog() {
  const [ouvert, setOuvert] = useState(false);
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => { abonnes.add(setOuvert); return () => void abonnes.delete(setOuvert); }, []);
  if (!ouvert) return null;
  const fermer = (ok: boolean) => { setOuvert(false); setMdp(""); setErreur(null); resolver?.(ok); resolver = null; };
  const valider = async () => {
    setEnCours(true); setErreur(null);
    const e = await connexion(email, mdp);
    setEnCours(false);
    if (e) setErreur(e); else fermer(true);
  };
  const lien = "underline underline-offset-2 hover:text-foreground";
  return (
    <Modal title="Connexion" onClose={() => fermer(false)}>
      <p className="text-sm text-muted-foreground">La consultation est libre. Pour modifier la bibliothèque commune, connectez-vous avec votre compte Index (mêmes email et mot de passe).</p>
      <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void valider(); }}>
        <label className="block text-sm">Email
          <input autoFocus type="email" autoComplete="username" className="input-tech mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">Mot de passe
          <input type="password" autoComplete="current-password" className="input-tech mt-1" value={mdp} onChange={(e) => setMdp(e.target.value)} />
        </label>
        {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
        <p className="text-xs text-muted-foreground">
          Pas encore de compte ? <a className={lien} href={`${INDEX_URL}/auth`} target="_blank" rel="noopener noreferrer">Créer un compte dans Index</a> (un collègue doit ensuite le valider).
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="btn-ghost" onClick={() => fermer(false)}>Annuler</Button>
          <Button type="submit" className="btn-primary" disabled={enCours || !email || !mdp}>{enCours ? "Connexion…" : "Se connecter"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Etat du compte dans le bandeau : « Lecture seule » + Se connecter, ou email seul + Se déconnecter. */
export function CompteBandeau() {
  const c = useCompte();
  return c.connecte ? (
    <>
      <span className={c.valide === false ? "bandeau-statut" : "bandeau-statut ouvert"} title={c.email}>
        {c.valide === false ? "Compte à valider · lecture seule" : c.email}
      </span>
      <button className="bandeau-btn" aria-label="Se déconnecter" onClick={deconnexion}><LogOut /><span className="max-sm:hidden">Se déconnecter</span></button>
    </>
  ) : (
    <>
      <span className="bandeau-statut">Lecture seule</span>
      <button className="bandeau-btn" aria-label="Se connecter" onClick={() => void demanderConnexion()}><LogIn /><span className="max-sm:hidden">Se connecter</span></button>
    </>
  );
}

const EXPORTS_LIBRES = 3;
const CLE_EXPORTS = "outils.format.exports";

/**
 * Exports (PDF, Excel, .json) : libres pour un compte connecte ; sans compte, 3 exports pour decouvrir
 * l'appli, puis la connexion est demandee. Incitation seulement (compteur dans le navigateur).
 */
export async function autoriserExport(avantConnexion?: () => void): Promise<boolean> {
  if (lireSession()) return true;
  let faits = 0;
  try { faits = Number(localStorage.getItem(CLE_EXPORTS)) || 0; } catch { /* stockage bloque */ }
  if (faits < EXPORTS_LIBRES) {
    try { localStorage.setItem(CLE_EXPORTS, String(faits + 1)); } catch { /* stockage bloque */ }
    toast.message(`Export gratuit ${faits + 1}/${EXPORTS_LIBRES}`, { description: "Connecte-toi avec ton compte Index pour des exports illimités." });
    return true;
  }
  toast.message("Connecte-toi pour exporter", { description: "Les 3 exports de découverte sont utilisés." });
  avantConnexion?.(); // une fenetre deja ouverte (ex. Sauvegarde) se ferme pour laisser la place a la connexion
  return demanderConnexion();
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
 * Un changement de prix seul reste local (pas de connexion requise). Renvoie false si l'envoi n'a pas eu lieu
 * (connexion annulee, compte refuse, pas de connexion) : la modification doit alors etre annulee a l'ecran.
 */
export async function publierChangements(avant: Material[], apres: Material[], localOnly: Set<string>): Promise<boolean> {
  const idsApres = new Set(apres.map((m) => m.id));
  const modifies = apres.filter((m) => { const a = avant.find((x) => x.id === m.id); return !a || !memeContenu(a, m); });
  // Un materiau seulement sur ce poste peut etre supprime sans toucher a l'equipe
  const supprimes = avant.filter((m) => !idsApres.has(m.id) && !localOnly.has(m.id));
  if (!modifies.length && !supprimes.length) return true;
  if (!(await demanderConnexion())) { toast.error("Modification annulée : il faut être connecté pour modifier la bibliothèque commune."); return false; }
  for (const m of modifies) {
    const r = await envoyerMateriau(m);
    if (!r.ok) { toast.error(r.error ?? "Échec de l'envoi."); return false; }
  }
  for (const m of supprimes) {
    const r = await supprimerMateriau(m.id);
    if (!r.ok) { toast.error(r.error ?? "Échec de la suppression."); return false; }
  }
  return true;
}
