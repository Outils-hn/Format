// Verifie la navigation au clavier (Tab) dans le tableau des pieces, sous Chromium et WebKit (Safari).
import { chromium, webkit } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:8080/";
const OUT = process.argv[2] ?? "captures";
const lines = [];
const materials = [{ id: "fg", name: "Fibres-Gypse", thickness: 15, kerf: 4, trim: 0, grainLocked: false, cutType: "free", supplier: "A", orderType: "cut", supply: { mode: "single", width: 2500, length: 1250 } }];
const projet = { id: "demo", info: { site: "Chantier démo", taskNumber: "T-01", client: "", date: "2026-10-27" }, workshopMode: false,
  pieces: [{ id: "P1", label: "P1", materialId: "fg", width: 2010, height: 382, quantity: 24, canRotate: true }, { id: "P2", label: "P2", materialId: "fg", width: 2045, height: 382, quantity: 4, canRotate: true }],
  linears: [], updatedAt: "2026-10-27T00:00:00Z" };
for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch();
  const page = await browser.newPage();
  await page.addInitScript(([m, p]) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.setItem("format.materials", JSON.stringify(m));
    localStorage.setItem("format.current", JSON.stringify(p));
    localStorage.setItem("format.full-backup-date", new Date().toISOString());
    sessionStorage.setItem("seeded", "1");
  }, [materials, projet]);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByLabel("Repère de pièce").first().click();
  const seq = [];
  for (let i = 0; i < 6; i++) {
    seq.push(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName));
    if (i === 1) await page.keyboard.type("2100");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);
  }
  // Entree : meme colonne, ligne suivante
  await page.getByLabel("Largeur de P1").click();
  await page.keyboard.press("Enter");
  seq.push("[Entree] " + await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
  lines.push(`${name}: ${seq.join(" -> ")}`);
  await browser.close();
}
writeFileSync(`${OUT}/tab.txt`, lines.join("\n"));
console.log(lines.join("\n"));
