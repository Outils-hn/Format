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
  await ctx.route(/supabase\.co/, (r) => r.abort()); // jamais la vraie bibliotheque commune
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
  await page.getByRole("banner").getByRole("button", { name: /^Sauvegarder$/ }).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Nouveau$/ }).click(); await page.waitForTimeout(400);
  verif("Nouveau projet : champs du chantier ouverts", await page.getByText("Numéro de tâche").isVisible());
  verif("Nouveau projet : mode atelier garde", (await page.getByRole("switch", { name: "Mode atelier" }).getAttribute("aria-checked")) === "true");
  await page.getByRole("button", { name: /Mes projets/ }).click(); await page.waitForTimeout(300);
  await page.locator("li", { hasText: "Chantier démo" }).getByRole("button", { name: /Ouvrir/ }).click(); await page.waitForTimeout(400);
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
// 6. Quick wins : premier lancement guide, collage sans en-tete, piece impossible, resultat perime
try {
  const vierge = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await vierge.route(/supabase\.co/, (r) => r.abort()); // jamais la vraie bibliotheque commune
  const p2 = await vierge.newPage();
  p2.on("dialog", (d) => d.accept());
  await p2.goto(BASE, { waitUntil: "networkidle" });
  verif("Premier lancement : guide « Pour commencer »", await p2.getByText("Pour commencer").isVisible());
  await p2.screenshot({ path: `${OUT}/check-premier-lancement.png` });
  await vierge.close();

  const c3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await c3.route(/supabase\.co/, (r) => r.abort()); // jamais la vraie bibliotheque commune
  const p3 = await c3.newPage();
  p3.on("dialog", (d) => d.accept());
  await p3.addInitScript((m) => { if (!sessionStorage.getItem("s")) { localStorage.setItem("format.materials", JSON.stringify(m)); sessionStorage.setItem("s", "1"); } }, materials);
  await p3.goto(BASE, { waitUntil: "networkidle" });
  await p3.keyboard.press("Enter");
  await p3.getByRole("button", { name: "Ajouter un matériau" }).click();
  await p3.getByRole("button", { name: /Fibres-Gypse/ }).click();
  await p3.getByRole("button", { name: "Coller depuis Excel" }).click();
  await p3.locator("textarea").fill("G1\t150\t120\t1\nG2\t2'010\t382\t24");
  await p3.waitForTimeout(400);
  const roles = await p3.locator("thead select").evaluateAll((els) => els.map((e) => e.value));
  verif("Collage sans en-tete : Repere, Largeur, Hauteur, Quantite", roles.join(",") === "label,width,height,quantity", roles.join(","));
  await p3.screenshot({ path: `${OUT}/check-collage-sans-entete.png` });
  await p3.getByRole("button", { name: "Remplacer la liste" }).click(); await p3.waitForTimeout(300);
  verif("Collage sans en-tete : largeur de G2 = 2010", (await p3.getByLabel("Largeur de G2").inputValue()).replace(/\D/g, "") === "2010");
  await p3.getByLabel("Largeur de G1").fill("5000"); await p3.waitForTimeout(200);
  await p3.keyboard.press("Control+Enter"); await p3.waitForTimeout(600);
  const t = (await p3.locator("[data-sonner-toast]").allInnerTexts()).join(" ");
  verif("Piece impossible : calcul bloque avec la raison", /Plus grande que le plus grand format/.test(t), t.replace(/\s+/g, " "));
  await p3.screenshot({ path: `${OUT}/check-piece-impossible.png` });
  await p3.getByLabel("Largeur de G1").fill("150");
  await p3.keyboard.press("Control+Enter");
  await p3.getByText(/Plans de découpe/i).first().waitFor({ timeout: 60000 });
  await p3.getByLabel("Quantité de G2").fill("40"); await p3.waitForTimeout(300);
  // Etiquettes des plans : taille reelle a l'ecran (taille du texte x echelle du dessin)
  const tailles = await p3.evaluate(() => [...document.querySelectorAll("#project-tab-panel svg text")].map((t) => {
    const m = t.getScreenCTM(); const fsz = parseFloat(t.getAttribute("font-size") || "0");
    return m && fsz ? fsz * m.a : 99;
  }));
  const plusPetit = Math.min(...tailles);
  verif("Plans : etiquettes lisibles a l'ecran (>= 9,5 px)", tailles.length > 0 && plusPetit >= 9.5, `${tailles.length} textes, plus petit ${plusPetit.toFixed(1)} px`);
  await p3.locator("#project-tab-panel svg").first().screenshot({ path: `${OUT}/check-plan-vignette.png` });
  verif("Saisie : nombre affiche « 2 010 »", (await p3.getByLabel("Largeur de G2").inputValue()).replace(/[\u00a0\u202f]/g, " ") === "2 010");
  verif("Resultat perime : bandeau affiche", await p3.getByText("Saisie modifiée depuis le calcul").isVisible());
  verif("Resultat perime : export bloque", await p3.getByRole("button", { name: /Exporter/ }).isDisabled());
  await p3.screenshot({ path: `${OUT}/check-resultat-perime.png` });
  await c3.close();
} catch (e) { verif("Deroulement des quick wins", false, e.message.split("\n")[0]); }
// 7. Bibliotheque commune (Supabase simule) : reception, prix gardes sur le poste, PIN, hors ligne
try {
  const envois = [];
  const c4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await c4.route(/supabase\.co/, async (route) => {
    const url = route.request().url();
    if (url.includes("/rest/v1/format_materiaux")) return route.fulfill({ json: [{ id: "eq1", data: { id: "eq1", name: "MDF équipe", thickness: 19, kerf: 4, trim: 10, grainLocked: false, cutType: "guillotine", supply: { mode: "single", width: 2800, length: 2070 } }, updated_at: "2026-10-28T10:00:00Z", deleted_at: null }] });
    const body = JSON.parse(route.request().postData() || "{}");
    if (url.endsWith("/rpc/verify_pin")) return route.fulfill({ json: body.p_pin === "1234" ? { ok: true } : { ok: false, error: "PIN incorrect (4 essai(s) restant(s))." } });
    if (url.endsWith("/rpc/format_save_material")) { envois.push(body); return route.fulfill({ json: { ok: true } }); }
    return route.fulfill({ json: { ok: true } });
  });
  const p4 = await c4.newPage();
  const avecPrix = [{ ...materials[0], supply: { mode: "catalog", formats: [{ id: "f1", width: 2500, length: 1250, price: 42 }] } }];
  await p4.addInitScript((m) => { if (!sessionStorage.getItem("s")) { localStorage.setItem("format.materials", JSON.stringify(m)); sessionStorage.setItem("s", "1"); } }, avecPrix);
  await p4.goto(BASE + "bibliotheque", { waitUntil: "networkidle" }); await p4.waitForTimeout(500);
  verif("Bibliotheque commune : etat « a jour »", await p4.getByText(/Bibliothèque commune à l'équipe · à jour/).isVisible());
  verif("Bibliotheque commune : materiau de l'equipe recu", await p4.getByText("MDF équipe").isVisible());
  verif("Bibliotheque commune : materiau local signale", await p4.getByText(/1 matériau\(x\) seulement sur ce poste/).isVisible());
  await p4.screenshot({ path: `${OUT}/check-bibliotheque-commune.png` });
  await p4.getByRole("button", { name: /Envoyer à l'équipe/ }).click(); await p4.waitForTimeout(300);
  verif("Bibliotheque commune : PIN demande", await p4.getByText("Code PIN requis").isVisible());
  await p4.getByLabel("Code PIN").fill("0000"); await p4.getByRole("button", { name: "Déverrouiller" }).click(); await p4.waitForTimeout(300);
  verif("Bibliotheque commune : PIN faux refuse", envois.length === 0 && await p4.getByText("Code PIN requis").isVisible());
  await p4.getByLabel("Code PIN").fill("1234"); await p4.getByRole("button", { name: "Déverrouiller" }).click(); await p4.waitForTimeout(800);
  verif("Bibliotheque commune : envoi apres PIN", envois.length === 1, `${envois.length} envoi(s)`);
  verif("Bibliotheque commune : aucun prix envoye", envois.length > 0 && !JSON.stringify(envois).includes("price"), JSON.stringify(envois[0]?.p?.supply ?? {}));
  const local = await p4.evaluate(() => localStorage.getItem("format.materials") ?? "");
  verif("Bibliotheque commune : prix garde sur le poste", local.includes('"price":42'));
  await c4.close();

  const c5 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await c5.route(/supabase\.co/, (r) => r.abort());
  const p5 = await c5.newPage();
  await p5.addInitScript((m) => { if (!sessionStorage.getItem("s")) { localStorage.setItem("format.materials", JSON.stringify(m)); sessionStorage.setItem("s", "1"); } }, materials);
  await p5.goto(BASE + "bibliotheque", { waitUntil: "networkidle" }); await p5.waitForTimeout(500);
  verif("Hors ligne : copie locale affichee", await p5.getByText(/injoignable/).isVisible() && await p5.getByText("Fibres-Gypse").first().isVisible());
  await c5.close();
} catch (e) { verif("Deroulement bibliotheque commune", false, e.message.split("\n")[0]); }
await browser.close();
writeFileSync(`${OUT}/checkup.txt`, lignes.join("\n"));
console.log(lignes.join("\n"));
