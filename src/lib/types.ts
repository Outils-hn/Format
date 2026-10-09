// Types metier de Format — toutes les dimensions sont en millimetres.

export type CutType = "guillotine" | "free"; // scie a panneaux | CNC

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

export interface Material {
  id: string;
  name: string;
  thickness: number;
  kerf: number; // trait de coupe
  trim: number; // delignage par bord
  grainLocked: boolean; // sens impose
  cutType: CutType;
  supply: Supply;
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

export interface ProjectInfo {
  site: string; // chantier
  taskNumber: string;
  client: string;
  date: string; // ISO yyyy-mm-dd
}

export interface Project {
  id: string;
  info: ProjectInfo;
  pieces: Piece[];
  updatedAt: string;
}

/** Fichier d'export : projet + materiaux utilises. */
export interface ProjectFile {
  app: "format";
  version: 1;
  project: Project;
  materials: Material[];
}
