import type { Material, Piece, Project } from "./types";
import { today, uid } from "./ids";

export const sampleMaterials = (): Material[] => [
  {
    id: "mat-mdf19",
    name: "MDF",
    thickness: 19,
    kerf: 4,
    trim: 10,
    grainLocked: false,
    cutType: "guillotine",
    supply: { mode: "single", width: 2070, length: 2800 },
  },
  {
    id: "mat-mela18",
    name: "Mélamine chêne",
    thickness: 18,
    kerf: 4,
    trim: 10,
    grainLocked: true,
    cutType: "guillotine",
    supply: { mode: "fixedWidth", width: 2070, minLength: 1000, maxLength: 4000, step: 100 },
  },
  {
    id: "mat-alu3",
    name: "Tôle alu",
    thickness: 3,
    kerf: 2,
    trim: 5,
    grainLocked: false,
    cutType: "free",
    supply: {
      mode: "catalog",
      formats: [
        { id: uid(), width: 1250, length: 2500, price: 45 },
        { id: uid(), width: 1500, length: 3000, price: 65 },
        { id: uid(), width: 1500, length: 4000, price: 85 },
      ],
    },
  },
];

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
