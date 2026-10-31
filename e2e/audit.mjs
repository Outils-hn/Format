// Audit UX de Format : premier lancement vide, parcours complet, cas limites, mobile, accessibilite (donnees fictives).
import { lancer, ouvrir, photo, mesures, axe, tabsJusqua, focusVisible, note, ecrire, tenter } from "./audit-lib.mjs";
import fs from "node:fs";
const b = await lancer();
const formats = [[2500, 1250], [3000, 1250], [2000, 1250]];
const materials = [
  { id: "fg", name: "Fibres-Gypse", thickness: 15, kerf: 4, trim: 0, grainLocked: false, cutType: "free", supplier: "Fournisseur A", orderType: "cut", supply: { mode: "catalog", formats: formats.map(([l, w], i) => ({ id: "f" + i, width: l, length: w })) } },
  { id: "mdf", name: "MDF", thickness: 19, kerf: 4, trim: 10, grainLocked: false, cutType: "guillotine", supplier: "Fournisseur B", orderType: "panels", reuseMin: 300, supply: { mode: "single", width: 2800, length: 2070 } },
];
const P = [["P1", 2010, 382, 24], ["P2", 2045, 382, 4], ["P3", 1652.5, 237, 8], ["P4", 2010, 237, 24]];
const projet = (pieces) => ({ id: "demo", info: { site: "Chantier démo", taskNumber: "T-01", client: "Client démo", date: "2026-10-27" }, workshopMode: false, pieces, linears: [], updatedAt: "2026-10-27T00:00:00Z" });
const piecesDemo = [...P.map(([id, w, h, q]) => ({ id, label: id, materialId: "fg", width: w, height: h, quantity: q, canRotate: true })), { id: "M1", label: "M1", materialId: "mdf", width: 600, height: 400, quantity: 6, canRotate: true }];
const semer = (pieces, mats = materials) => async (p) => p.addInitScript(([m, pr]) => {
  if (sessionStorage.getItem("seeded")) return;
  localStorage.setItem("format.materials", JSON.stringify(m)); localStorage.setItem("format.current", JSON.stringify(pr)); localStorage.setItem("format.full-backup-date", new Date().toISOString()); sessionStorage.setItem("seeded", "1");
}, [mats, projet(pieces)]);
const coupe = (ctx) => ctx.route(/supabase\.co/, (r) => r.abort());
const txt = async (p, sel = "body") => (await p.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ");
const calcul = async (p) => { const t0 = Date.now(); await p.getByRole("button", { name: /Lancer l'optimisation|Relancer/ }).click(); await p.getByText(/PLANS DE DÉCOUPE/i).first().waitFor({ timeout: 90000 }).catch(() => {}); await p.waitForTimeout(600); return Date.now() - t0; };

// 1. Premier lancement (aucune donnee)
let p = await ouvrir(b, "vide", { brancher: coupe });
await photo(p, "01-premier-lancement"); await mesures(p, "vide"); await axe(p, "vide");
note("vide:texte", (await txt(p)).slice(0, 700));
note("vide:lancer-sans-pieces", await (async () => { await p.getByRole("button", { name: /Lancer l'optimisation/ }).click().catch(() => {}); await p.waitForTimeout(500); await photo(p, "01b-lancer-sans-pieces", false); return (await txt(p)).slice(0, 300); })());
// 2. Parcours complet avec projet demo
p = await ouvrir(b, "demo", { init: semer(piecesDemo), brancher: coupe });
await photo(p, "02-projet-avant-calcul"); await mesures(p, "demo"); await axe(p, "demo"); note("focus:demo", await focusVisible(p));
note("tabs-jusqu-a-lancer", await tabsJusqua(p, () => /Lancer l'optimisation|Relancer/.test(document.activeElement?.textContent || ""), 80));
note("calcul-demo-ms", await calcul(p)); await photo(p, "03-resultats"); await axe(p, "resultats");
note("resultats:texte", (await txt(p)).slice(0, 900));
await p.getByText("Synthèse").first().click().catch(() => {}); await p.waitForTimeout(700); await photo(p, "03b-synthese");
// export : combien de clics, quels formats
await p.getByRole("button", { name: /Exporter/ }).first().click().catch(() => {}); await p.waitForTimeout(300); await photo(p, "03c-menu-exporter", false);
note("menu-exporter", (await p.getByRole("menuitem").allInnerTexts().catch(() => [])).join(" | "));
await p.keyboard.press("Escape");
// 3. Cas limites : piece plus grande que tous les panneaux, valeurs absurdes, quantites enormes
const limites = {
  "trop-grande": [{ id: "X1", label: "X1", materialId: "fg", width: 4000, height: 2000, quantity: 1, canRotate: true }],
  "zero-negatif": [{ id: "Z1", label: "Z1", materialId: "mdf", width: 0, height: 400, quantity: 2, canRotate: true }, { id: "Z2", label: "Z2", materialId: "mdf", width: -300, height: 400, quantity: 2, canRotate: true }, { id: "Z3", label: "", materialId: "mdf", width: 300, height: 400, quantity: 0, canRotate: true }],
  "quantite-folle": [{ id: "Q1", label: "Q1", materialId: "mdf", width: 300, height: 200, quantity: 100000, canRotate: true }],
  "mille-pieces": Array.from({ length: 1000 }, (_, i) => ({ id: "G" + i, label: "G" + i, materialId: "mdf", width: 120 + ((i * 53) % 900), height: 90 + ((i * 71) % 600), quantity: 1 + (i % 4), canRotate: true })),
};
for (const [nom, pieces] of Object.entries(limites)) {
  const q = await ouvrir(b, `lim-${nom}`, { init: semer(pieces), brancher: coupe });
  await photo(q, `04-${nom}-avant`, false);
  const ms = await Promise.race([calcul(q), q.waitForTimeout(95000).then(() => -1)]);
  note(`limite:${nom}`, { ms, apercu: (await txt(q)).slice(0, 500) });
  await photo(q, `04-${nom}-apres`, nom !== "mille-pieces");
  await q.context().close();
}
await tenter("Saisie reelle", async () => {
// 4. Saisie reelle : ajouter une ligne, taper des valeurs bizarres
p = await ouvrir(b, "saisie", { init: semer([]), brancher: coupe });
await p.getByRole("button", { name: "Ajouter" }).first().click(); await p.waitForTimeout(400);
const champ = p.locator("[data-col=w]").first();
for (const v of ["600,5", "6 000", "abc", "-20", "1e5"]) { await champ.fill(v); await p.keyboard.press("Tab"); await p.waitForTimeout(200); note(`saisie-largeur:${v}`, { champ: await champ.inputValue(), invalide: await champ.getAttribute("aria-invalid") }); }
await photo(p, "05-saisie-valeurs", false);
// collage Excel : 300 lignes + lignes defectueuses
await p.getByRole("button", { name: "Coller depuis Excel" }).click(); await p.waitForTimeout(300);
const lignes = ["Repère\tMatériau\tLargeur\tHauteur\tQuantité", "A1\tMDF\t600\t400\t2", "A2\tInconnu\t500\t300\t1", "A3\tMDF\tabc\t300\t1", "A4\tMDF\t500\t300\t0", "A5\tMDF\t500\t300\t1,5"].join("\n");
await p.locator("textarea").first().fill(lignes); await p.waitForTimeout(600); await photo(p, "05b-collage-erreurs", false);
note("collage-erreurs", (await txt(p, "[role=dialog], .modal, body")).slice(0, 600));
});
await tenter("Retour arriere", async () => {
// 5. Retour arriere / projets / sauvegarde
await p.keyboard.press("Escape");
await p.getByRole("button", { name: /^Sauvegarde$/ }).click().catch(() => {}); await p.waitForTimeout(400); await photo(p, "06-sauvegarde", false);
await p.keyboard.press("Escape");
await p.getByRole("button", { name: "Mes projets" }).click().catch(() => {}); await p.waitForTimeout(400); await photo(p, "06b-mes-projets", false);
});
await tenter("Bibliotheque", async () => {
// 6. Bibliotheque
const bib = await ouvrir(b, "bibliotheque", { init: semer(piecesDemo), brancher: coupe, url: "http://127.0.0.1:8080/bibliotheque" });
await photo(bib, "07-bibliotheque"); await axe(bib, "bibliotheque");
});
await tenter("Mobile, tablette, sombre", async () => {
// 7. Mobile, tablette, sombre
for (const [nom, w, h] of [["mobile", 390, 844], ["tablette", 768, 1024]]) {
  const m = await ouvrir(b, nom, { w, h, init: semer(piecesDemo), brancher: coupe }); await photo(m, `08-${nom}`); await mesures(m, nom);
  await calcul(m); await photo(m, `08-${nom}-resultats`);
}
const d = await ouvrir(b, "sombre", { dark: true, init: semer(piecesDemo), brancher: coupe }); await d.getByRole("button", { name: "Basculer le thème" }).click(); await calcul(d); await photo(d, "09-sombre-resultats", false); await axe(d, "sombre");
});
ecrire(); await b.close();
