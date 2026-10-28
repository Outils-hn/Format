// Deplacements au clavier dans un tableau de saisie, comme dans Excel.
// Chaque champ porte data-col="<nom de colonne>" ; le gestionnaire se pose sur le <tbody>.
//  - Entree / Maj+Entree : ligne suivante / precedente, meme colonne
//  - Fleche bas / haut  : idem
//  - Fleche droite / gauche : colonne suivante / precedente de la meme ligne,
//    seulement si le curseur est deja au bout du texte (sinon la fleche deplace le curseur
//    dans le texte, pour corriger un chiffre). Un texte entierement selectionne compte comme « au bout ».
import type { KeyboardEvent } from "react";

type Champ = HTMLInputElement | HTMLTextAreaElement;

/** Position du curseur : debut, fin, les deux (texte vide ou tout selectionne) ou milieu. */
export function positionCurseur(valeur: string, debut: number | null, fin: number | null) {
  // Champs sans curseur lisible (type=number) : on considere toujours qu'on est au bout
  if (debut == null || fin == null) return { auDebut: true, aLaFin: true };
  const toutSelectionne = debut === 0 && fin === valeur.length;
  return { auDebut: toutSelectionne || (debut === 0 && fin === 0), aLaFin: toutSelectionne || (debut === valeur.length && fin === valeur.length) };
}

function curseur(el: Champ) {
  try {
    return positionCurseur(el.value, el.selectionStart, el.selectionEnd);
  } catch {
    return positionCurseur(el.value, null, null);
  }
}

function aller(cible: HTMLElement | null | undefined) {
  if (!cible) return false;
  cible.focus();
  if (cible instanceof HTMLInputElement || cible instanceof HTMLTextAreaElement) cible.select();
  return true;
}

export function naviguerClavier(e: KeyboardEvent<HTMLElement>, colonnes: readonly string[]) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const el = e.target as HTMLElement;
  const col = el.dataset["col"];
  if (!col) return;
  const tbody = e.currentTarget;
  const memeColonne = (pas: number) => {
    const cases = [...tbody.querySelectorAll<HTMLElement>(`[data-col="${col}"]`)];
    return cases[cases.indexOf(el) + pas];
  };
  const memeLigne = (pas: number) => {
    const ligne = el.closest("tr");
    const i = colonnes.indexOf(col);
    for (let k = i + pas; k >= 0 && k < colonnes.length; k += pas) {
      const c = ligne?.querySelector<HTMLElement>(`[data-col="${colonnes[k]}"]`);
      if (c) return c;
    }
    return undefined;
  };
  const champ = el as Champ;
  let cible: HTMLElement | undefined;
  switch (e.key) {
    case "Enter": cible = memeColonne(e.shiftKey ? -1 : 1); e.preventDefault(); break;
    case "ArrowDown": if (e.shiftKey) return; cible = memeColonne(1); e.preventDefault(); break;
    case "ArrowUp": if (e.shiftKey) return; cible = memeColonne(-1); e.preventDefault(); break;
    case "ArrowRight": if (e.shiftKey || !curseur(champ).aLaFin) return; cible = memeLigne(1); if (cible) e.preventDefault(); break;
    case "ArrowLeft": if (e.shiftKey || !curseur(champ).auDebut) return; cible = memeLigne(-1); if (cible) e.preventDefault(); break;
    default: return;
  }
  aller(cible);
}
