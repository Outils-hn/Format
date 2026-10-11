import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MaterialsCard } from "./MaterialsCard";
import { newMaterial } from "@/lib/defaults";

describe("Material editor", () => {
  it("keeps mode values, blocks rotated duplicates and saves inactive modes", () => {
    const save = vi.fn();
    render(<MaterialsCard materials={[newMaterial()]} onChange={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByLabelText("Largeur (mm)"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Longueur (mm)"), { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: "Plusieurs formats catalogue" }));
    expect(screen.getByLabelText("Largeur du format")).toHaveValue("1000");
    expect(screen.getByLabelText("Longueur du format")).toHaveValue("2000");
    fireEvent.change(screen.getByLabelText("Prix du format"), { target: { value: "42,5" } });
    expect(screen.getByText("CHF")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Format", exact: true }));
    fireEvent.change(screen.getAllByLabelText("Largeur du format")[1], { target: { value: "2000" } });
    fireEvent.change(screen.getAllByLabelText("Longueur du format")[1], { target: { value: "1000" } });
    expect(screen.getAllByText("Format en double")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "Retirer" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Longueur à la demande" }));
    fireEvent.change(screen.getByLabelText("Long. mini"), { target: { value: "777" } });
    fireEvent.click(screen.getByRole("button", { name: "Format unique" }));
    expect(screen.getByLabelText("Largeur (mm)")).toHaveValue("1000");
    expect(screen.getByLabelText("Longueur (mm)")).toHaveValue("2000");
    fireEvent.click(screen.getByRole("button", { name: "Format unique" }));
    expect(screen.getByLabelText("Longueur (mm)")).toHaveValue("2000");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(save.mock.calls[0]?.[0][0]).toMatchObject({
      supply: { mode: "single", width: 1000, length: 2000 },
      supplyValues: { catalogue: undefined, catalog: { formats: [{ width: 1000, length: 2000, price: 42.5 }] }, fixedWidth: { minLength: 777 } },
    });
  });
});