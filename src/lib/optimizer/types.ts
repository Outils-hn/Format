// Types du moteur d'optimisation — dimensions en mm, surfaces en mm².
import type { Material, Piece } from "../types";

export type Objective = "waste" | "price" | "sheets";

export interface OptimizeOptions {
  objective: Objective;
  intensive: boolean;
}

export interface OptimizeRequest {
  materials: Material[];
  pieces: Piece[];
  options: OptimizeOptions;
}

export interface Rect { x: number; y: number; w: number; h: number }

/** Exemplaire de piece a placer (une unite). */
export interface Item { pieceId: string; label: string; w: number; h: number; canRotate: boolean; flip?: boolean }

export interface Placement extends Rect { pieceId: string; label: string; rotated: boolean }

export interface Offcut extends Rect { reusable: boolean }

export interface SheetResult {
  index: number;
  width: number; // brut
  length: number; // brut
  usableW: number;
  usableL: number;
  price?: number | undefined;
  placements: Placement[];
  offcuts: Offcut[]; // coordonnees dans la zone utile
  piecesArea: number;
  efficiency: number; // pieces / surface brute
}

export interface Balance {
  purchased: number;
  pieces: number;
  trim: number;
  reusable: number;
  losses: number;
}

export interface FormatCount { width: number; length: number; count: number; price?: number | undefined }

export interface Unplaced { pieceId: string; label: string; quantity: number; reason: string }

/** Resume d'une solution testee, pour le tableau "Solutions comparees". */
export interface SolutionSummary {
  label: string;
  formats: FormatCount[];
  sheets: number;
  purchased: number; // mm²
  price: number | null;
  unplaced: number;
  chosen: boolean;
}

export interface MaterialResult {
  materialId: string;
  name: string;
  thickness: number;
  sheets: SheetResult[];
  formats: FormatCount[];
  totalPrice: number | null;
  balance: Balance;
  unplaced: Unplaced[];
  errors: string[]; // verification
  solutions: SolutionSummary[];
}

export interface OptimizeResult {
  materials: MaterialResult[];
  total: { sheets: number; totalPrice: number | null; balance: Balance };
  errors: string[];
  durationMs: number;
}
