import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { PiecesCard } from "./PiecesCard";
import { sampleMaterials, newPiece } from "@/lib/defaults";
import { newLinear } from "@/lib/linear";
import type { Piece } from "@/lib/types";

const materials = sampleMaterials();
function Example() {
  const [pieces, setPieces] = useState<Piece[]>([
    { ...newPiece("mat-mdf19", 1), width: 600, height: 400 },
    { ...newPiece("mat-mdf19", 2), width: 600, height: 400, canRotate: false },
    { ...newPiece("mat-mela18", 3, true), width: 600, height: 400 },
  ]);
  return <PiecesCard pieces={pieces} materials={materials} onChange={setPieces} />;
}

describe("Bulk rotation", () => {
  it("shows mixed selection and toggles only unlocked pieces", () => {
    render(<Example />);
    const all = screen.getByRole("checkbox", { name: "Autoriser la rotation de toutes les pièces" });
    expect(all).toBePartiallyChecked();
    fireEvent.click(all);
    expect(all).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Autoriser la rotation de P2" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Autoriser la rotation de P3" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Autoriser la rotation de P3" })).not.toBeChecked();
    fireEvent.click(all);
    expect(screen.getByRole("checkbox", { name: "Autoriser la rotation de P1" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Autoriser la rotation de P2" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /^Ajouter$/ }));
    expect(screen.getByRole("checkbox", { name: "Autoriser la rotation de P4" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Autoriser la rotation de P4" })).toBeDisabled();
  });
});

describe("Entry sections", () => {
  it("shows only the empty message when there are no rows", () => {
    render(<PiecesCard pieces={[]} materials={materials} onChange={() => {}} linears={[]} onLinearsChange={() => {}} />);
    expect(screen.getByText("Ajoutez des pièces ou un linéaire")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a two-level linear section independently of pieces", () => {
    render(<PiecesCard pieces={[]} materials={materials} onChange={() => {}}
      linears={[newLinear("mat-mdf19", 1)]} onLinearsChange={() => {}} />);
    expect(screen.queryByRole("table", { name: "Pièces" })).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Linéaires" });
    expect(table.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(screen.getByLabelText("Mode de tronçons")).toBeInTheDocument();
    expect(screen.getByLabelText("Tronçon (mm)")).toBeInTheDocument();
  });
});