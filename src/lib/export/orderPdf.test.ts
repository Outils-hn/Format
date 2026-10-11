import { describe, expect, it, vi } from "vitest";
import { Writer } from "./pdf";
import { exportOrderPdf } from "./orderPdf";
import { optimize } from "../optimizer/engine";
import { sampleMaterials } from "@/test/fixtures";
import { newProject } from "../defaults";
import type { Piece } from "../types";

vi.mock("./common", () => ({ cleanName: (s: string) => s, download: vi.fn() }));

describe("Order PDF supplier cuts", () => {
  it("omits the redundant material column and writes remarks after the material table", () => {
    const materials = sampleMaterials();
    const pieces: Piece[] = [{ id: "a", label: "A", materialId: "mat-mdf19", width: 1000, height: 1250, quantity: 4, canRotate: true }];
    const result = optimize({ materials, pieces, options: { objective: "waste", intensive: false } });
    const table = vi.spyOn(Writer.prototype, "table");
    const text = vi.spyOn(Writer.prototype, "text");
    exportOrderPdf(result, materials, pieces, newProject().info, { orderTypes: { "mat-mdf19": "cut" }, supplierRemarks: { "mat-mdf19": "Chants blancs, livraison vendredi" } });
    const call = table.mock.calls.find((c) => c[3]?.startsWith("Pièces débitées"));
    expect(call?.[0].map((c) => c.h)).not.toContain("Matériau");
    expect(call?.[1][0]).toEqual(["A", "19", "1 000", "1 250", "4", "Libre"]);
    const remarksIndex = text.mock.calls.findIndex((c) => c[0].includes("Chants blancs, livraison vendredi"));
    expect(remarksIndex).toBeGreaterThanOrEqual(0);
    expect(text.mock.invocationCallOrder[remarksIndex]).toBeGreaterThan(table.mock.invocationCallOrder[0] ?? 0);
    vi.restoreAllMocks();
  });
});