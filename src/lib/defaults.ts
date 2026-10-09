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
    name: "Melamine chene",
    thickness: 18,
    kerf: 4,
    trim: 10,
    grainLocked: true,
    cutType: "guillotine",
    supply: {
      mode: "catalog",
      formats: [
        { id: uid(), width: 2070, length: 2800, price: 85 },
        { id: uid(), width: 1830, length: 2620, price: 72 },
      ],
    },
  },
  {
    id: "mat-alu3",
    name: "Tole alu",
    thickness: 3,
    kerf: 2,
    trim: 5,
    grainLocked: false,
    cutType: "free",
    supply: { mode: "fixedWidth", width: 1500, minLength: 1000, maxLength: 4000, step: 100 },
  },
];

export const newMaterial = (): Material => ({
  id: uid(),
  name: "Nouveau materiau",
  thickness: 18,
  kerf: 4,
  trim: 10,
  grainLocked: false,
  cutType: "guillotine",
  supply: { mode: "single", width: 2070, length: 2800 },
});

export const newPiece = (materialId: string, n: number): Piece => ({
  id: uid(),
  label: `P${n}`,
  materialId,
  width: null,
  height: null,
  quantity: 1,
  canRotate: true,
});

export const newProject = (): Project => ({
  id: uid(),
  info: { site: "", taskNumber: "", client: "", date: today() },
  pieces: [],
  updatedAt: new Date().toISOString(),
});
