import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsPanel } from "./ResultsPanel";
import type { OptimizeResult } from "@/lib/optimizer";
import { optimize } from "@/lib/optimizer/engine";
import { sampleMaterials } from "@/test/fixtures";
import type { Piece } from "@/lib/types";

const result: OptimizeResult = {
  materials: [], errors: [], durationMs: 10,
  total: { sheets: 0, totalPrice: null, balance: { purchased: 0, pieces: 0, trim: 0, reusable: 0, losses: 0 } },
};

describe("Simple results", () => {
  it("shows a two-level cut order and distinct legend lengths without changing rotated dimensions", () => {
    const materials = sampleMaterials();
    const pieces: Piece[] = [
      { id: "lin:1:1234", label: "L1", materialId: "mat-mdf19", width: 300, height: 1234, quantity: 2, canRotate: true },
      { id: "lin:1:994", label: "L1", materialId: "mat-mdf19", width: 300, height: 994, quantity: 1, canRotate: true },
    ];
    const plan = optimize({ materials, pieces, options: { objective: "waste", intensive: false } });
    render(<ResultsPanel result={plan} materials={materials} pieces={pieces} orderTypeOf={() => "cut"} />);
    const title = screen.getByText("3 pièces à faire débiter - MDF 19 mm");
    expect(title).toHaveClass("text-xl");
    expect(screen.getByText(/^Estimation : environ/)).toHaveClass("text-xs");
    expect(screen.getByText(/L1 · 1'234/)).toBeInTheDocument();
    expect(screen.getByText("L1 · 994")).toBeInTheDocument();
  });
  it("collapses verification details initially and lets the user open them", () => {
    const { container } = render(<ResultsPanel result={result} materials={[]} />);
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Détails"));
    expect(container.querySelector("details")).toHaveAttribute("open");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("opens details and shows an alert when a new result fails verification", async () => {
    const { container, rerender } = render(<ResultsPanel result={result} materials={[]} />);
    rerender(<ResultsPanel result={{ ...result, errors: ["Chevauchement détecté"] }} materials={[]} />);
    await waitFor(() => expect(container.querySelector("details")).toHaveAttribute("open"));
    expect(screen.getByRole("alert")).toHaveTextContent("La vérification a échoué");
    expect(screen.getByText("Chevauchement détecté")).toBeInTheDocument();
  });
});