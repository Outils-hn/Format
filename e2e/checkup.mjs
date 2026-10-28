// Check-up automatique de Format dans un vrai navigateur : enregistrement des projets,
// nouveau projet, curseur sur le champ vide, export, theme, sauvegarde complete.
// Resultat : checkup.txt (OK / ECHEC). Donnees fictives uniquement.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:8080/";
const OUT = process.argv[2] ?? "captures";
const lignes = [];
const verif = (nom, ok, detail = "") => lignes.push(`${ok ? "OK    " : "ECHEC "} ${nom}${detail ? ` (${detail})` : ""}`);
const materials = [{ id: "fg", name: "Fibres-Gypse", thickness: 15, kerf: 4, trim: 0, grainLocked: false, cutType: "free", supplier: "A", orderType: "cut", supply: { mode: "single", width: 2500, length: 1250 } }];
const projet = { id: "demo", info: { site: "Chantier démo", taskNumber: "T-01", client: "Client démo", date: "2026-10-27" }, workshopMode: true,
  pieces: [{ id: "P1", label: "P1", materialId: "fg", width: 2010, height: 382, quantity: 24, canRotate: true }], linears: [], updatedAt: "2026-10-27T00:00:00Z" };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("dialog", (d) => d.accept());
await page.addInitScript(([m, p]) => {
  if (sessionStorage.getItem("seeded")) return;
  localStorage.setItem("format.materials", JSON.stringify(m));
  localStorage.setItem("format.current", JSON.stringify(p));
  sessionStorage.setItem("seeded", "1");
}, [materials, projet]);
try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  // 1. Champ vide : curseur dessus au lancement (Ctrl + Entree)
  await page.getByLabel("Largeur de P1").fill(""); await page.keyboard.press("Control+Enter"); await page.waitForTimeout(600);
  const actif = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  verif("Champ vide : le curseur va dessus", actif === "Largeur de P1", actif);
  await page.getByLabel("Largeur de P1").fill("2010");
  // 2. Calcul + menu Exporter (3 sorties en mode atelier)
  await page.keyboard.press("Control+Enter"); await page.getByText(/Plans de découpe/i).first().waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: /Exporter/ }).click();
  const sorties = await page.getByRole("menuitem").allTextContents();
  verif("Menu Exporter : PDF commande, PDF atelier, Excel", sorties.length === 3, sorties.join(" / "));
  await page.keyboard.press("Escape");
  // 3. Enregistrer, puis nouveau projet, puis rouvrir
  await page.getByRole("button", { name: /^Sauvegarder$/ }).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Nouveau$/ }).click(); await page.waitForTimeout(400);
  verif("Nouveau projet : champs du chantier ouverts", await page.getByText("Numéro de tâche").isVisible());
  verif("Nouveau projet : mode atelier garde", (await page.getByRole("switch", { name: "Mode atelier" }).getAttribute("aria-checked")) === "true");
  await page.getByRole("button", { name: /Mes projets/ }).click(); await page.waitForTimeout(300);
  await page.getByText("Chantier démo").first().click(); await page.waitForTimeout(400);
  const titre = await page.locator("#titre-projet").textContent();
  verif("Projet enregistre puis rouvert", titre === "Chantier démo", titre ?? "");
  // 4. Theme sombre retenu
  await page.getByRole("button", { name: "Basculer le thème" }).click(); await page.waitForTimeout(200);
  await page.reload({ waitUntil: "networkidle" });
  verif("Mode sombre retenu apres rechargement", await page.evaluate(() => document.documentElement.classList.contains("dark")));
  // 5. Sauvegarde complete
  await page.getByRole("button", { name: /^Sauvegarde$/ }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Télécharger la sauvegarde/ }).click()]);
  const chemin = `${OUT}/sauvegarde-test.json`; await dl.saveAs(chemin);
  const json = JSON.parse(readFileSync(chemin, "utf8"));
  verif("Sauvegarde complete : projets, materiaux et theme inclus", json.app === "format" && ["format.projects", "format.materials", "format.theme"].every((k) => k in json.data), Object.keys(json.data).join(", "));
} catch (e) { verif("Deroulement du check-up", false, e.message.split("\n")[0]); }
await browser.close();
writeFileSync(`${OUT}/checkup.txt`, lignes.join("\n"));
console.log(lignes.join("\n"));
