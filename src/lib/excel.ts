// Collage / copie depuis et vers Excel.
import type { Material, Piece } from "./types";
import { uid } from "./ids";

export type ColumnRole = "label" | "material" | "width" | "height" | "quantity" | "ignore";
export const COLUMN_ROLES: { value: ColumnRole; label: string }[] = [
  { value: "label", label: "Repère" },
  { value: "material", label: "Matériau" },
  { value: "width", label: "Largeur" },
  { value: "height", label: "Hauteur" },
  { value: "quantity", label: "Quantité" },
  { value: "ignore", label: "Ignorer" },
];

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** "1 250 mm" -> 1250, "2,5 m" -> 2500, "12cm" -> 120, "10 pces" -> 10. */
export function parseNumber(raw: string, toMm = true): number | null {
  if (!raw) return null;
  const s = raw.replace(/[\s\u00a0\u202f]/g, "").toLowerCase();
  const m = s.match(/^(-?\d+(?:[.,]\d+)?)([a-z]*)/);
  if (!m) return null;
  let n = parseFloat(m[1]!.replace(",", "."));
  if (!isFinite(n)) return null;
  if (toMm && m[2]) {
    if (m[2] === "m") n *= 1000;
    else if (m[2] === "cm") n *= 10;
  }
  return Math.round(n * 100) / 100;
}

export const parseTable = (text: string): string[][] =>
  text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => l.split("\t").map((c) => c.trim()));

const HEADER_HINTS: Record<Exclude<ColumnRole, "ignore">, string[]> = {
  label: ["repere", "ref", "nom", "piece", "designation"],
  material: ["materiau", "matiere", "panneau", "mat"],
  width: ["largeur", "larg", "l", "width"],
  height: ["hauteur", "haut", "longueur", "long", "h", "height", "length"],
  quantity: ["quantite", "qte", "qty", "nb", "nombre", "q"],
};

export function detectHeader(row: string[]): ColumnRole[] | null {
  const roles = row.map((cell): ColumnRole => {
    const c = normalize(cell).replace(/[^a-z]/g, "");
    for (const [role, hints] of Object.entries(HEADER_HINTS))
      if (hints.some((h) => c === h || (h.length > 2 && c.startsWith(h)))) return role as ColumnRole;
    return "ignore";
  });
  return roles.some((r) => r !== "ignore") ? roles : null;
}

export function matchMaterial(text: string, materials: Material[]): string | null {
  const t = normalize(text);
  if (!t) return null;
  const exact = materials.find(
    (m) => normalize(m.name) === t || normalize(`${m.name} ${m.thickness}`) === t ||
      normalize(`${m.name} ${m.thickness}mm`) === t,
  );
  if (exact) return exact.id;
  const partial = materials.find((m) => t.includes(normalize(m.name)) || normalize(m.name).includes(t));
  return partial?.id ?? null;
}

export function rowsToPieces(
  rows: string[][],
  roles: ColumnRole[],
  materials: Material[],
  fallbackMaterialId: string,
  materialOverrides: Record<string, string>,
): Piece[] {
  const idx = (r: ColumnRole) => roles.indexOf(r);
  return rows.map((row, i) => {
    const get = (r: ColumnRole) => (idx(r) >= 0 ? row[idx(r)] ?? "" : "");
    const matText = get("material");
    const materialId =
      materialOverrides[matText] ?? matchMaterial(matText, materials) ?? fallbackMaterialId;
    const mat = materials.find((m) => m.id === materialId);
    return {
      id: uid(),
      label: get("label") || `P${i + 1}`,
      materialId,
      width: parseNumber(get("width")),
      height: parseNumber(get("height")),
      quantity: Math.max(1, Math.round(parseNumber(get("quantity"), false) ?? 1)),
      canRotate: !mat?.grainLocked,
    };
  });
}

/** Fusionne les doublons (meme repere, materiau, dimensions). */
export function mergeDuplicates(pieces: Piece[]): Piece[] {
  const map = new Map<string, Piece>();
  for (const p of pieces) {
    const k = [normalize(p.label), p.materialId, p.width, p.height].join("|");
    const ex = map.get(k);
    if (ex) ex.quantity += p.quantity;
    else map.set(k, { ...p });
  }
  return [...map.values()];
}

const fr = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

export function piecesToTsv(pieces: Piece[], materials: Material[]): string {
  const name = (id: string) => materials.find((m) => m.id === id)?.name ?? "";
  const lines = [["Repère", "Matériau", "Largeur", "Hauteur", "Quantité"].join("\t")];
  for (const p of pieces)
    lines.push([p.label, name(p.materialId), fr(p.width), fr(p.height), fr(p.quantity)].join("\t"));
  return lines.join("\n");
}
