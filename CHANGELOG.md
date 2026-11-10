# Journal des versions — Format

Le numéro de version se met à jour dans `src/lib/appInfo.ts` (pied de page et fenêtre « À propos » le lisent).

Chaque version qui change quelque chose de visible pour l'équipe a une puce « Nouveauté : … », en langage courant : c'est la seule phrase affichée sur la page « Nouveautés » de l'Accueil.

## 2.21 — 10 novembre 2026

- Nouveauté : dans le menu des applis, la ligne « Rechercher » est alignée avec les autres.

## 2.20 — 10 novembre 2026

- Nouveauté : Ctrl+K ouvre la recherche de l'Accueil (applis, chantiers, fiches Index, notes Check) dans un nouvel onglet ; le menu de l'appli propose aussi « Rechercher ».

## 2.19 — 10 novembre 2026

- Nouveauté : le chantier choisi dans l'onglet « Chantiers » de l'Accueil est proposé automatiquement dans le champ « Chantier » d'un nouveau projet.

## 2.18 — 9 novembre 2026

- Nouveauté : au téléphone, un léger fondu indique qu'il reste des onglets à droite dans le bandeau.

## 2.17 — 9 novembre 2026

- Nouveauté : Format s'installe sur le téléphone (menu du navigateur, « Ajouter à l'écran d'accueil ») et s'ouvre aussi sans réseau ; seuls la connexion et la bibliothèque commune attendent le réseau.

## 2.16 — 9 novembre 2026

- Nouveauté : au téléphone, les liens du pied de page (« Conçu par », « Sauvegarde », « Suggestion / bug ») se touchent plus facilement.

## 2.15 — 8 novembre 2026

- Technique : les données sont passées sur le nouveau serveur Supabase en Suisse (adresse, clé et mémoire de connexion mises à jour). Il faut se reconnecter une fois.

## 2.14 — 7 novembre 2026

- Nouveauté : le menu des applis propose maintenant Joint (dilatation et joints) et Membrane (étanchéité).

## 2.13 — 6 novembre 2026

- Le menu des applis propose Joint (en préparation), pour le concepteur seulement : aucune Nouveauté à annoncer à l'équipe.

## 2.12 — 4 novembre 2026

- Nouveauté : sans compte, on ne peut plus exporter ni importer de fichier JSON (sauvegarde complète, projet, bibliothèque) : un message invite à se connecter avec son compte Index. Les exports PDF et Excel gardent leurs 3 essais gratuits.

## 2.11 — 4 novembre 2026

- Nouveauté : en mode sombre, les champs de date (calendrier et chiffres) ne restent plus noirs sur fond sombre : ils suivent le thème et se lisent bien.

## 2.10 — 4 novembre 2026

- Nouveauté : le bandeau affiche seulement l'adresse email quand on est connecté (sans « Connecté · »), comme dans toutes les autres applis.

## 2.9 — 4 novembre 2026

- Nouveauté : « Se connecter » est maintenant en haut de chaque page de Format, comme dans Index ; se connecter dans une appli connecte toutes les autres.
- Nouveauté : sans compte, Format reste utilisable (saisie, calcul, enregistrement local) et offre 3 exports de découverte (PDF, Excel, projet, sauvegarde). Ensuite, les exports demandent de se connecter avec son compte Index.

## 2.8 — 4 novembre 2026

- Nouveauté : plus de code PIN dans Format. Pour modifier la bibliothèque commune, on se connecte avec son compte Index (mêmes email et mot de passe, compte validé par un collègue) ; la connexion est partagée avec Index et Masse. Le calcul et la consultation restent libres.
- Page Bibliothèque : indication « Lecture seule » / « Connecté · email » avec bouton Se connecter / Se déconnecter.
- Base : script `supabase/format-comptes.sql` (fonctions d'écriture réservées aux comptes validés).
- Avant la mise en ligne : coller ce script dans le SQL Editor de Supabase (projet Index).

## 2.7 — 4 novembre 2026

- Nouveauté : la base de données de Format est maintenant dans le même projet Supabase que Index, Access et Check (un seul projet à gérer). Rien ne change à l'usage : mêmes données, même code PIN.
- Avant la mise en ligne : la base doit avoir été migrée (scripts dans le dépôt de Masse, `supabase/migration-vers-index/`).

## 2.6 — 1er novembre 2026

- Nouveauté : sur téléphone, Format ne déborde plus, les actions sont regroupées dans un menu « ⋯ » et le bouton « Lancer » ne cache plus les pièces.
- Messages d'erreur précis (« Largeur absente », « Hauteur négative »), pluriel corrigé et nombre de pièces à compléter indiqué.
- Contour de focus visible dans le tableau des pièces ; bouton « Lancer » grisé tant qu'il n'y a aucune pièce.
- Rendements nommés (« tous matériaux » / « du matériau ») avec la formule en infobulle.

## 2.5 — 1er novembre 2026

- Nouveauté : le mode clair ou sombre que tu choisis dans une appli est repris dans toutes les autres.
- Le réglage clair / sombre est aussi enregistré dans une clé commune à toutes les applis (`outils-theme`, même site) ; la clé propre à l'appli est conservée.

## 2.4 — 31 octobre 2026

- Disparition de l'avertissement technique « React #418 » dans la console du navigateur : le contenu s'affiche une fois la page chargée, au lieu de se télescoper avec la page de départ générée au build. Aucun changement visible.

## 2.3 — 31 octobre 2026

- Toutes les applis sont maintenant sur GitHub Pages : le sélecteur d'applis pointe vers `https://outils-hn.github.io/<Appli>/` à la place des adresses Lovable. Les liens vers les fiches d'Index (`?fiche=`, `?q=`, création de compte) ouvrent `https://outils-hn.github.io/Index/`.

## 2.2 — 31 octobre 2026

- Publication sur GitHub Pages (`https://outils-hn.github.io/Format/`) : l'appli est construite en mode SPA statique, sans serveur.
- Nouveau workflow « Pages » : construction avec le sous-dossier `/Format/`, page de repli `404.html`, déploiement automatique à chaque fusion sur `main`.
- Pages « Page introuvable » et « Cette page ne s'est pas chargée » en français.
- Les données gardées dans le navigateur à l'ancienne adresse (`lovable.app`) ne suivent pas automatiquement : faire une « Sauvegarde » avant de changer d'adresse, puis la restaurer à la nouvelle.

## 2.1 — 31 octobre 2026

- Adresses mises à jour après le renommage du compte GitHub en `outils-hn` : « Suggestion / bug » ouvre l'Accueil sur `https://outils-hn.github.io/`, et le sélecteur d'applis pointe vers Strate (`https://outils-hn.github.io/Strate/`) et Trame (`https://outils-hn.github.io/Trame/`), publiées sur GitHub Pages.
