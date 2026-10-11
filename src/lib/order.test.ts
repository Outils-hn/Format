import { describe, expect, it } from "vitest";
import { optimize } from "./optimizer/engine";
import { orderEntries, supplierSections } from "./order";
import { exportProject, importProject, loadCurrent, saveCurrent } from "./storage";
import { newProject } from "./defaults";
import { sampleMaterials } from "@/test/fixtures";
import type { Piece } from "./types";

describe("Supplier order presentation", () => {
  it("separates the cut quantity from its panel estimate and preserves material-scoped remarks", () => {
    const materials = sampleMaterials();
    const pieces: Piece[] = [{ id: "a", materialId: "mat-mdf19", label: "A", width: 1000, height: 1250, quantity: 4, canRotate: true }];
    const result = optimize({ materials, pieces, options: { objective: "waste", intensive: false } });
    const entries = orderEntries(result.materials, () => "cut");
    expect(entries).toEqual([{ title: "4 pièces à faire débiter - MDF 19 mm", estimate: "Estimation : environ 1 panneau de 2 070 × 2 800 mm" }]);
    const project = { ...newProject(), pieces, orderTypes: { "mat-mdf19": "cut" as const }, supplierRemarks: { "mat-mdf19": "Chants blancs\nLivraison vendredi", "mat-mela18": "Autre consigne" } };
    expect(supplierSections(result, materials, pieces, project)[0]?.cuts[0]?.remarks).toBe("Chants blancs\nLivraison vendredi");
    saveCurrent(project);
    expect(loadCurrent()?.supplierRemarks).toEqual(project.supplierRemarks);
    expect(importProject(exportProject(project, materials), []).project.supplierRemarks).toEqual(project.supplierRemarks);
  });
});