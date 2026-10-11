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
    expect(screen.queryByRole("checkbox", { name: "Autoriser la rotation de P3" })).not.toBeInTheDocument();
    expect(screen.getByText("Sens imposé")).toBeInTheDocument();
    fireEvent.click(all);
    expect(screen.getByRole("checkbox", { name: "Autoriser la rotation de P1" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Autoriser la rotation de P2" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /^Ajouter$/ }));
    expect(screen.queryByRole("checkbox", { name: "Autoriser la rotation de P4" })).not.toBeInTheDocument();
  });
});

describe("Entry sections", () => {
  it("integrates the subtitle and hides settings by default", () => {
    render(<PiecesCard pieces={[]} materials={materials} onChange={() => {}} subtitle="2 070 × 2 800 · scie" settings={<label>Objectif<input /></label>} />);
    expect(screen.getByText("2 070 × 2 800 · scie")).toBeInTheDocument();
    expect(screen.queryByLabelText("Objectif")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
    expect(screen.getByLabelText("Objectif")).toBeInTheDocument();
  });
  it("filters material rows and preserves the other material when editing or adding", () => {
    function FilteredExample() {
      const [rows, setRows] = useState<Piece[]>([
        { ...newPiece("mat-mdf19", 1), width: 600, height: 400 },
        { ...newPiece("mat-mela18", 2, true), width: 700, height: 500 },
      ]);
      return <><PiecesCard materialId="mat-mdf19" pieces={rows} materials={materials} onChange={setRows} />
        <output data-testid="rows">{JSON.stringify(rows)}</output></>;
    }
    render(<FilteredExample />);
    expect(screen.queryByRole("columnheader", { name: "Matériau" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Largeur de P2" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Largeur de P1" }), { target: { value: "650" } });
    fireEvent.click(screen.getByRole("button", { name: /^Ajouter$/ }));
    const rows = JSON.parse(screen.getByTestId("rows").textContent ?? "[]") as Piece[];
    expect(rows).toHaveLength(3);
    expect(rows[0]?.width).toBe(650);
    expect(rows[1]?.materialId).toBe("mat-mela18");
    expect(rows[1]?.width).toBe(700);
    expect(rows[2]?.materialId).toBe("mat-mdf19");
  });
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