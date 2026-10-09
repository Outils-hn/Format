import { describe, expect, it, vi } from "vitest";
import { Writer } from "./pdf";

const cols = [{ h: "Repère", w: 20 }, { h: "Position X / Y (mm)", w: 40 }];

describe("PDF atomic tables", () => {
  it("moves the entire table and its title before drawing any row", () => {
    const w = new Writer();
    w.y = w.bottom - 14;
    const pages: number[] = [];
    const text = w.doc.text.bind(w.doc);
    vi.spyOn(w.doc, "text").mockImplementation((...args: Parameters<typeof w.doc.text>) => {
      pages.push(w.doc.getNumberOfPages());
      return text(...args);
    });
    w.table(cols, Array.from({ length: 10 }, (_, i) => [`C${i + 1}`, "10 / 20"]), false, "Chutes");
    expect(w.doc.getNumberOfPages()).toBe(2);
    expect(new Set(pages)).toEqual(new Set([2]));
    expect(w.y).toBeLessThanOrEqual(w.bottom);
  });
  it("keeps multiline rows together using measured height", () => {
    const w = new Writer();
    const rows = [["P1", Array.from({ length: 90 }, (_, i) => `${i * 100}/10`).join(" · ")]];
    const height = w.measureTable(cols, rows).height;
    expect(height).toBeGreaterThan(30);
    w.y = w.bottom - height + 2;
    w.table(cols, rows, false, "Pièces");
    expect(w.doc.getNumberOfPages()).toBe(2);
    expect(w.y).toBeLessThanOrEqual(w.bottom);
  });
  it("fits a table taller than a page without splitting or discarding rows", () => {
    const w = new Writer();
    w.table(cols, Array.from({ length: 100 }, (_, i) => [`C${i + 1}`, "10 / 20"]), false, "Chutes");
    expect(w.doc.getNumberOfPages()).toBe(1);
    expect(w.y).toBeLessThanOrEqual(w.bottom + 0.01);
    expect(w.doc.output()).toContain("C100");
  });
});