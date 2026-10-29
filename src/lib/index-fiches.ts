// Liens vers les fiches techniques d'Index (bibliotheque commune du bureau).
// Lecture seule et publique : la liste des fiches (nom, fournisseur, categorie) est lue dans la base
// d'Index ; on ne garde ici que l'identifiant et le nom de la fiche choisie.
export const INDEX_URL = "https://index-hn.lovable.app";
const INDEX_DB = "https://ngfzwfbraqkdcocdcmib.supabase.co";
// Cle PUBLIQUE d'Index (faite pour etre visible dans une page web)
const INDEX_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZnp3ZmJyYXFrZGNvY2RjbWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mzg2NTcsImV4cCI6MjA5NTIxNDY1N30.Ikovcm4eWkLvPO_PvkI8C8DJebBT011Rz87k_EYFdbU";

/** Fiche liee : identifiant Index + nom, garde pour l'affichage meme hors ligne. */
export interface FicheRef { id: string; name: string }
export interface FicheIndex { id: string; name: string; supplier: string; category: string }

export const lienFiche = (id: string) => `${INDEX_URL}/?fiche=${encodeURIComponent(id)}`;

let cache: Promise<FicheIndex[]> | null = null;
/** Liste des fiches actives d'Index (une seule lecture par session). */
export function chargerFiches(): Promise<FicheIndex[]> {
  cache ??= fetch(`${INDEX_DB}/rest/v1/products?select=id,name,supplier,category,deleted_at&order=name`, {
    headers: { apikey: INDEX_KEY, Authorization: `Bearer ${INDEX_KEY}` },
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
