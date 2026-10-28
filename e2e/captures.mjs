// Captures d'ecran et PDF de Format avec des donnees fictives, pour une revue visuelle.
// Lance par .github/workflows/captures.yml ; resultat dans le dossier passe en argument.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:8080/";
const OUT = process.argv[2] ?? "captures";
mkdirSync(OUT, { recursive: true });
const formats = [[2500, 1250], [3000, 1250], [2000, 1250]];
const materials = [
  { id: "fg", name: "Fibres-Gypse", thickness: 15, kerf: 4, trim: 0, grainLocked: false, cutType: "free", supplier: "Fournisseur A", orderType: "cut",
    supply: { mode: "catalog", formats: formats.map(([l, w], i) => ({ id: "f" + i, width: l, length: w })) } },
  { id: "mdf", name: "MDF", thickness: 19, kerf: 4, trim: 10, grainLocked: false, cutType: "guillotine", supplier: "Fournisseur B", orderType: "panels", reuseMin: 300,
    supply: { mode: "single", width: 2800, length: 2070 } },
];
const P = [["P1", 2010, 382, 24], ["P2", 2045, 382, 4], ["P3", 1652.5, 237, 8], ["P4", 2010, 237, 24]];
const projet = (workshopMode) => ({
  id: "demo", info: { site: "Chantier démo", taskNumber: "T-01", client: "Client démo", date: "2026-10-27" }, workshopMode,
  pieces: [...P.map(([id, w, h, q]) => ({ id, label: id, materialId: "fg", width: w, height: h, quantity: q, canRotate: true })),
    { id: "M1", label: "M1", materialId: "mdf", width: 600, height: 400, quantity: 6, canRotate: true },
    { id: "M2", label: "M2", materialId: "mdf", width: 1200, height: 300, quantity: 4, canRotate: true }],
  linears: [{ id: "l1", label: "L1", materialId: "fg", bandWidth: 300, totalLength: 12.5, mode: "fixed", segment: 2500, min: 200, max: null, multiple: null }],
  updatedAt: "2026-10-27T00:00:00Z",
});
const errors = [];
const browser = await chromium.launch();

async function session(name, workshop, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${name}] ${e.message}`));
  page.on("dialog", (d) => d.accept());
  await page.addInitScript(([m, p]) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.setItem("format.materials", JSON.stringify(m));
    localStorage.setItem("format.current", JSON.stringify(p));
    localStorage.setItem("format.full-backup-date", new Date().toISOString());
    sessionStorage.setItem("seeded", "1");
  }, [materials, projet(workshop)]);
  await page.goto(BASE, { waitUntil: "networkidle" });
  try { await fn(page); } catch (e) { errors.push(`[${name}] ${e.message.split("\n")[0]}`); }
  await ctx.close();
}
const shot = (page, file, full = true) => page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full });
const pdf = async (page, label, file) => {
  await page.getByRole("button", { name: /Exporter/ }).first().click();
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.getByRole("menuitem", { name: label }).first().click()]);
  await dl.saveAs(`${OUT}/${file}.pdf`);
};
const run = async (page) => {
  await page.getByRole("button", { name: /Lancer l'optimisation/ }).click();
  await page.getByText(/PLANS DE DÉCOUPE/i).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
};

await session("commande", false, async (page) => {
  await shot(page, "01-projet-avant-calcul");
  await run(page);
  await shot(page, "02-projet-resultats-materiau1");
  await shot(page, "02b-ecran-apres-calcul", false);
  await page.getByRole("button", { name: /Exporter/ }).first().click(); await page.waitForTimeout(300);
  await shot(page, "02c-menu-exporter", false);
  await page.keyboard.press("Escape");
  await page.getByText("Synthèse").first().click(); await page.waitForTimeout(800);
  await shot(page, "03-synthese");
  await pdf(page, /PDF commande/, "10-pdf-commande");
});
await session("atelier", true, async (page) => {
  await run(page);
  await shot(page, "04-mode-atelier-resultats");
  await pdf(page, /PDF atelier/, "11-pdf-atelier");
});
await session("bibliotheque", false, async (page) => {
  await page.goto(BASE + "bibliotheque", { waitUntil: "networkidle" });
  await shot(page, "05-bibliotheque");
  await page.getByRole("button", { name: "Modifier" }).first().click(); await page.waitForTimeout(500);
  await shot(page, "06-fenetre-materiau", false);
});
await session("mobile", false, async (page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, "07-mobile");
});
await session("sombre", true, async (page) => {
  await page.getByRole("button", { name: "Basculer le thème" }).click();
  await run(page);
  await shot(page, "08-mode-sombre");
  await page.getByText("Synthèse").first().click(); await page.waitForTimeout(800);
  await shot(page, "09-mode-sombre-synthese");
  // le PDF doit rester en couleurs claires
  await pdf(page, /PDF atelier/, "12-pdf-atelier-depuis-mode-sombre");
  await page.goto(BASE + "bibliotheque", { waitUntil: "networkidle" });
  await shot(page, "13-mode-sombre-bibliotheque");
  await page.getByRole("button", { name: "Modifier" }).first().click(); await page.waitForTimeout(500);
  await shot(page, "14-mode-sombre-fenetre-materiau", false);
});
writeFileSync(`${OUT}/erreurs.txt`, errors.join("\n") || "aucune");
console.log(errors.join("\n") || "aucune erreur");
await browser.close();
