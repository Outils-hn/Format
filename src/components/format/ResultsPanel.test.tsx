import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsPanel } from "./ResultsPanel";
import type { OptimizeResult } from "@/lib/optimizer";

const result: OptimizeResult = {
  materials: [], errors: [], durationMs: 10,
  total: { sheets: 0, totalPrice: null, balance: { purchased: 0, pieces: 0, trim: 0, reusable: 0, losses: 0 } },
};

describe("Simple results", () => {
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