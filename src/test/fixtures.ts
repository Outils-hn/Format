// Matériaux de test uniquement : l application ne crée aucun matériau d exemple.
import type { Material } from "@/lib/types";
import { uid } from "@/lib/ids";

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
