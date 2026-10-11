import type { Material, Piece, Project } from "./types";
import { today, uid } from "./ids";

export const newMaterial = (): Material => ({
  id: uid(),
  name: "Nouveau matériau",
  thickness: 18,
  kerf: 4,
  trim: 10,
  grainLocked: false,
  cutType: "guillotine",
  supply: { mode: "single", width: 2070, length: 2800 },
});

export const newPiece = (materialId: string, n: number, grainLocked = false): Piece => ({
  id: uid(),
  label: `P${n}`,
  materialId,
  width: null,
  height: null,
  quantity: 1,
  canRotate: !grainLocked,
});

export const newProject = (): Project => ({
  id: uid(),
  info: { site: "", taskNumber: "", client: "", date: today() },
  pieces: [],
  updatedAt: new Date().toISOString(),
});
