// Types metier de Format — toutes les dimensions sont en millimetres.

export type CutType = "guillotine" | "free"; // scie a panneaux | CNC
export type OrderType = "panels" | "cut"; // panneaux entiers | pieces debitees par le fournisseur

export interface SheetFormat {
  id: string;
  width: number;
  length: number;
  price?: number | undefined; // prix optionnel par panneau
}

export type Supply =
  | { mode: "single"; width: number; length: number }
  | { mode: "catalog"; formats: SheetFormat[] }
  | { mode: "fixedWidth"; width: number; minLength: number; maxLength: number; step: number };

export type SupplyValues = { [Mode in Supply["mode"]]?: Extract<Supply, { mode: Mode }> };

export interface Material {
  id: string;
  name: string;
  thickness: number;
  kerf: number; // trait de coupe
  trim: number; // delignage par bord
  grainLocked: boolean; // sens impose
  cutType: CutType;
  reuseMin?: number | undefined; // seuil de chute reutilisable (mm), defaut 300
  supply: Supply;
  supplyValues?: SupplyValues | undefined; // valeurs conservées des modes inactifs
  supplier?: string | undefined;
  orderType?: OrderType | undefined;
}

export interface Piece {
  id: string;
  label: string; // repere
  materialId: string;
  width: number | null;
  height: number | null;
  quantity: number;
  canRotate: boolean;
}

export interface Linear {
  id: string;
  label: string;
  materialId: string;
  bandWidth: number | null; // largeur de bande (mm)
  totalLength: number | null; // longueur totale (m)
  mode: "fixed" | "joined"; // troncons fixes | raboutage autorise
  segment: number | null; // mode fixed (mm)
  min: number | null; // mode joined (mm)
  max: number | null;
  multiple: number | null;
}

export interface ProjectInfo {
  site: string; // chantier
  taskNumber: string;
  client: string;
  date: string; // ISO yyyy-mm-dd
}

export interface MaterialStatus {
  status: "toOrder" | "ordered" | "stock";
  orderDate?: string | undefined;
  supplier?: string | undefined;
  orderNumber?: string | undefined;
}

/** Chutes dans le PDF atelier : sans qualification, indicatif, ou consigne de conservation. */
export interface OffcutSettings {
  mode: "hide" | "indicative" | "retain";
  labelsPage: boolean;
  marks: Record<string, { keep?: boolean; note?: string }>;
}

export interface Project {
  id: string;
  info: ProjectInfo;
  pieces: Piece[];
  linears?: Linear[] | undefined;
  materialStatus?: MaterialStatus | undefined;
  offcuts?: OffcutSettings | undefined;
  orderTypes?: Record<string, OrderType> | undefined; // surcharge par materiau pour ce projet
  supplierRemarks?: Record<string, string> | undefined; // remarques par materiau pour ce projet
  showEstimate?: boolean | undefined; // estimation de panneaux dans le PDF commande
  workshopMode?: boolean | undefined;
  updatedAt: string;
}

/** Fichier d'export : projet + materiaux utilises. */
export interface ProjectFile {
  app: "format";
  version: 1;
  project: Project;
  materials: Material[];
}
