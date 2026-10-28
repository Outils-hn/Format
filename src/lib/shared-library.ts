// Bibliotheque commune de materiaux (Supabase, projet de Masse, Francfort).
// - La lecture est libre ; les modifications passent par des fonctions protegees par le PIN de Masse.
// - LES PRIX RESTENT SUR LE POSTE : ils sont retires avant l'envoi (et la base les retire aussi),
//   puis remis depuis la copie locale a chaque synchronisation.
// - Sans reseau, Format continue avec la derniere copie locale.
// Logique pure testee dans shared-library.test.ts ; script SQL : supabase/format-bibliotheque.sql.
import type { Material, Supply } from "./types";
import { normalizeMaterial } from "./storage";

// Adresse et cle PUBLIQUE du projet (faite pour etre visible dans une page web, comme dans Masse)
export const SUPABASE_URL = "https://kkxqgdljkvuapryqydcx.supabase.co";
export const SUPABASE_KEY = "sb_publishable_xAvqc9Z9clDeBJi_MVsh_g_-oRKBSqK";

export interface RemoteRow { id: string; data: Material; updated_at: string; deleted_at: string | null }

const KNOWN = "format.shared.known"; // identifiants deja recus de la bibliotheque commune
const SYNCED = "format.shared.syncedAt";
const PIN = "format-pin";

// ---------- Logique pure ----------

const sansPrixSupply = (s: Supply): Supply =>
  s.mode === "catalog" ? { ...s, formats: s.formats.map(({ price: _p, ...f }) => f) } : s;

/** Materiau tel qu'il est envoye a l'equipe : sans aucun prix. */
export function sansPrix(m: Material): Material {
  const out: Material = { ...m, supply: sansPrixSupply(m.supply) };
  if (m.supplyValues?.catalog) out.supplyValues = { ...m.supplyValues, catalog: sansPrixSupply(m.supplyValues.catalog) as Extract<Supply, { mode: "catalog" }> };
  return out;
}

/** Remet les prix saisis sur ce poste (retrouves par identifiant de format). */
export function remettrePrix(distant: Material, local: Material | undefined): Material {
  if (!local) return distant;
  const prix = new Map<string, number>();
  for (const s of [local.supply, local.supplyValues?.catalog]) if (s?.mode === "catalog") for (const f of s.formats) if (f.price != null) prix.set(f.id, f.price);
  if (!prix.size) return distant;
  const avec = (s: Supply): Supply => (s.mode === "catalog" ? { ...s, formats: s.formats.map((f) => (prix.has(f.id) ? { ...f, price: prix.get(f.id) } : f)) } : s);
  const out: Material = { ...distant, supply: avec(distant.supply) };
  if (distant.supplyValues?.catalog) out.supplyValues = { ...distant.supplyValues, catalog: avec(distant.supplyValues.catalog) as Extract<Supply, { mode: "catalog" }> };
  return out;
}

export interface Fusion {
  materials: Material[];
  /** Materiaux presents seulement sur ce poste (jamais envoyes a l'equipe). */
  localOnly: Material[];
  known: string[];
}

/**
 * Fusionne la copie locale et la bibliotheque commune.
 * - materiau commun : version de l'equipe, avec les prix de ce poste ;
 * - materiau supprime par l'equipe : retire, sauf s'il sert encore au projet ouvert ;
 * - materiau jamais envoye : garde, signale comme « seulement sur ce poste ».
 */
export function fusionner(local: Material[], remote: RemoteRow[], used: Set<string>): Fusion {
  const byId = new Map(remote.map((r) => [r.id, r]));
  const localById = new Map(local.map((m) => [m.id, m]));
  const materials: Material[] = [];
  const localOnly: Material[] = [];
  for (const m of local) {
    const r = byId.get(m.id);
    if (!r) { materials.push(m); localOnly.push(m); continue; }
    if (r.deleted_at) { if (used.has(m.id)) materials.push(m); continue; }
    materials.push(remettrePrix(normalizeMaterial({ ...r.data, id: r.id }), m));
  }
  for (const r of remote) if (!r.deleted_at && !localById.has(r.id)) materials.push(normalizeMaterial({ ...r.data, id: r.id }));
  return { materials, localOnly, known: remote.filter((r) => !r.deleted_at).map((r) => r.id) };
}

// ---------- Reseau ----------

const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };

async function appel(path: string, init?: RequestInit, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(`${SUPABASE_URL}${path}`, { ...init, headers, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

/** Liste de la bibliotheque commune, ou null si elle est injoignable. */
export async function lireBibliotheque(): Promise<RemoteRow[] | null> {
  try {
    const r = await appel("/rest/v1/format_materiaux?select=id,data,updated_at,deleted_at");
    if (!r.ok) return null;
    return (await r.json()) as RemoteRow[];
  } catch { return null; }
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await appel(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
    if (!r.ok) return { ok: false, error: "La bibliothèque commune ne répond pas. Réessayez plus tard." };
    return (await r.json()) as { ok: boolean; error?: string };
  } catch { return { ok: false, error: "Pas de connexion à la bibliothèque commune." }; }
}

export const verifierPin = (pin: string) => rpc("verify_pin", { p_pin: pin });
export const envoyerMateriau = (pin: string, m: Material) => rpc("format_save_material", { p_pin: pin, p: sansPrix(m) });
export const supprimerMateriau = (pin: string, id: string) => rpc("format_delete_material", { p_pin: pin, p_id: id });

/** Un refus lie au PIN (faux, bloque) : on oublie le PIN retenu pour la session. */
export const erreurDePin = (e?: string) => /PIN|essais/i.test(e ?? "");

// ---------- Memoire locale ----------

const lire = <T,>(k: string, d: T, store: Storage | undefined = typeof localStorage !== "undefined" ? localStorage : undefined): T => {
  try { const v = store?.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
};
export const lireDateSynchro = () => lire<string | null>(SYNCED, null);
export function noterSynchro(known: string[]) {
  try { localStorage.setItem(KNOWN, JSON.stringify(known)); localStorage.setItem(SYNCED, JSON.stringify(new Date().toISOString())); } catch { /* stockage bloque */ }
}
export const pinSession = () => { try { return sessionStorage.getItem(PIN); } catch { return null; } };
export const retenirPin = (p: string | null) => {
  try { if (p) sessionStorage.setItem(PIN, p); else sessionStorage.removeItem(PIN); } catch { /* stockage bloque */ }
};
