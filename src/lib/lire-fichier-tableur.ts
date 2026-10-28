// Lecture d'un fichier Excel (.xlsx, .xls, .ods) ou .csv en texte tabule, comme un copier-coller :
// la fenetre « Coller depuis Excel » s'occupe ensuite des colonnes et des lignes a ignorer.
// Seule la premiere feuille est lue ; les cellules vides en fin de ligne sont retirees.
export const EXTENSIONS_TABLEUR = ".xlsx,.xlsm,.xls,.ods,.csv,.tsv,.txt";

export const estTableur = (f: File) => /\.(xlsx|xlsm|xls|ods|csv|tsv|txt)$/i.test(f.name);

/** Lignes du tableau (cellules en texte) -> texte tabule. Teste dans lire-fichier-tableur.test.ts. */
export function lignesEnTexte(lignes: unknown[][]): string {
  return lignes
    .map((l) => {
      const c = l.map((v) => (v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v).replace(/[\t\r\n]+/g, " ").trim()));
      while (c.length && c[c.length - 1] === "") c.pop();
      return c.join("\t");
    })
    .filter((l) => l.trim() !== "")
    .join("\n");
}

export async function lireFichierTableur(f: File): Promise<string> {
  if (/\.(csv|tsv|txt)$/i.test(f.name)) {
    const t = await f.text();
    // CSV francais : point-virgule ; sinon virgule ou tabulation
    if (/\.csv$/i.test(f.name)) {
      const sep = t.split("\n")[0]!.includes(";") ? ";" : ",";
      return lignesEnTexte(t.replace(/\r/g, "").split("\n").map((l) => l.split(sep)));
    }
    return t;
  }
  const XLSX = (await import("xlsx-js-style")).default;
  const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!ws) throw new Error("Le fichier ne contient aucune feuille");
  return lignesEnTexte(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" }));
}
