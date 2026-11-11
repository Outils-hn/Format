// Liens vers les fiches techniques d'Index (bibliotheque commune du bureau).
// Lecture reservee aux comptes valides : la liste des fiches (nom, fournisseur, categorie) est lue dans la base
// d'Index ; on ne garde ici que l'identifiant et le nom de la fiche choisie.
export const INDEX_URL = "https://outils-hn.github.io/Index";
const INDEX_DB = "https://dtxgvwaqjmmffiiohika.supabase.co";
// Cle PUBLIQUE d'Index (faite pour etre visible dans une page web)
const INDEX_KEY = "sb_publishable_yEWGxFFSLTE1lJRXnFUmpg_dMwa6LxW";

/** Fiche liee : identifiant Index + nom, garde pour l'affichage meme hors ligne. */
export interface FicheRef { id: string; name: string }
export interface FicheIndex { id: string; name: string; supplier: string; category: string }

export const lienFiche = (id: string) => `${INDEX_URL}/?fiche=${encodeURIComponent(id)}`;

// Jeton du compte connecte (session commune a toutes les applis) : sans lui, la base ne renvoie plus rien
const jetonCompte = (): Record<string, string> => {
  try {
    const t = JSON.parse(localStorage.getItem("sb-dtxgvwaqjmmffiiohika-auth-token") ?? "null")?.access_token;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
};

let cache: Promise<FicheIndex[]> | null = null;
/** Liste des fiches actives d'Index (une seule lecture par session). */
export function chargerFiches(): Promise<FicheIndex[]> {
  cache ??= fetch(`${INDEX_DB}/rest/v1/products?select=id,name,supplier,category,deleted_at&order=name`, {
    headers: { apikey: INDEX_KEY, ...jetonCompte() },
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((rows: (FicheIndex & { deleted_at: string | null })[]) => rows.filter((r) => !r.deleted_at))
    .catch((e) => { cache = null; throw e; });
  return cache;
}

const plain = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Recherche mot par mot, sans accents, dans le nom, le fournisseur et la categorie. */
export function chercherFiches(fiches: FicheIndex[], q: string, max = 8): FicheIndex[] {
  const mots = plain(q).split(/\s+/).filter(Boolean);
  const out = mots.length ? fiches.filter((f) => { const h = plain(`${f.name} ${f.supplier} ${f.category}`); return mots.every((m) => h.includes(m)); }) : fiches;
  return out.slice(0, max);
}
