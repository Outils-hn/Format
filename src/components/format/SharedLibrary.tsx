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

/** Pastille d'etat du compte (page Bibliotheque). */
export function EtatCompte() {
  const c = useCompte();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{!c.connecte ? "Lecture seule" : c.valide === false ? "Compte à valider · lecture seule" : `Connecté · ${c.email}`}</span>
      {c.connecte
        ? <Button variant="link" size="sm" className="h-auto p-0" onClick={deconnexion}>Se déconnecter</Button>
        : <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void demanderConnexion()}>Se connecter</Button>}
    </span>
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
