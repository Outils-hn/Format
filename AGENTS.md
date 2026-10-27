<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Screen-only release identity is centralized in src/lib/appInfo.ts and displayed by shared AppFooter; export modules never import it, keeping authorship out of PDF and Excel files.
- Business logic (types, storage, Excel parsing, validation, palette) lives in src/lib/, UI in src/components/format/ — so the optimisation algorithm can plug in without touching UI.
- All data is persisted in localStorage only (no backend) — user requirement for offline/private use.
- Colors, fonts, cut-plan palette and hatch patterns are centralised in src/styles.css tokens.
- The 2D optimiser lives in src/lib/optimizer/ (pure code, run in a Web Worker via runOptimization) — keeps the UI responsive and the engine testable without React.
- Rotation suggestions use a second call to the unchanged optimizer, with candidate selection and safe savings comparison in src/lib/rotation.ts; input snapshots guard stale results and applying a suggestion reuses its verified plan.
- The optimiser explores format strategies × heuristics × orientation variants × sort orders (plus grid blocks for identical pieces) and reports per-strategy bests as solutions — keeps the choice transparent while verify.ts stays the single safety net.
- Offcut labels and retained-offcut summaries are derived in src/lib/offcuts.ts and shared by screen and PDF; quantities use actual sheets rather than grouped drawings to preserve traceability without altering the optimizer.
- PDF tables are measured before rendering and placed atomically with their titles; shared measurement also sizes sheet drawings so wrapped cells cannot trigger mid-table page breaks.
- Linear (metre lineaire) rows are converted to rectangular pieces in src/lib/linear.ts before calling the unchanged optimizer; the produced-length check is appended to result errors there — keeps verify.ts untouched.
- Result indicators (yield/reusable/definitive-loss split, theoretical lower bound, material status texts) are derived in src/lib/indicators.ts and shared by screen and PDF — presentation only, the optimizer stays untouched.
- Number formatting (src/lib/format.ts) and piece-label fitting (src/lib/pieceLabels.ts) are shared by screen and PDF; the PDF embeds a frozen-tabular Inter subset (src/lib/export/interFont.ts) so text is measured with the real font.
- Order lines, sheet-group labels, unbreakable X/Y pairs and offcut captions use shared format helpers across presentation and exports to keep terminology and traceability consistent.
- The library uses its own client-only route and existing material storage; project tabs are derived from piece/linear material IDs with transient empty selections, leaving the project/JSON schema and optimization/export inputs unchanged.
- PiecesCard receives the complete project lists and an optional material filter; scoped edits preserve other materials and paste receives the active material as its default.
- ProjectSettings presents existing project controls inside PiecesCard; disclosure state is transient, and SheetPlan splits drawings from detail tables through presentation props so PDF and optimization inputs remain unchanged.
- Brand is shared by the project and library headers to keep the visual identity identical across pages.
- Screen panel groups use PanelGroupLabel and PDF headings use Writer badges with count-free panelGroup labels — quantities stay visually separate without changing export data or sheet grouping.
- Order mode is derived in src/lib/order.ts (supplier sections, order lines) and shared by screen, order PDF (export/orderPdf.ts) and Excel; per-project order-type overrides live on Project.orderTypes so the library default stays untouched.
- Supplier remarks are keyed by material ID on Project.supplierRemarks and passed through supplierSections to the order PDF — existing local project persistence and JSON round-trips preserve them without changing library defaults or optimization inputs.
- Material.supply remains the sole active optimizer input; optional supplyValues stores inactive mode drafts, with switching and orientation-independent duplicate detection in src/lib/materialSupply.ts — preserves legacy materials and existing local/JSON persistence without modifying calculations.
- Intensive optimisation is reproducible: a seeded RNG (from pieces and material settings) and a deterministic work budget (workMeter in packers.ts, ~1–1.5 s) replace Math.random and wall-clock limits; time only acts as a safety cap. verify.ts also checks that every placement keeps its piece's dimensions in the stated orientation.
- The deep search (former "Optimisation intensive" toggle) always runs: the UI passes intensive: true and the engine skips it when the deterministic pass already meets indicators.lowerBound (single-format materials).
- Pasted numbers (src/lib/excel.ts parseNumber) treat spaces and Swiss apostrophes (' ’ ‘) as thousands separators; validatePiece flags any side under MIN_DIMENSION (10 mm) as suspect so a misread value is never optimised silently.
- In fixed-segment linears, a last segment shorter than Linear.min (shown as "Dernière pièce mini") is raised to that minimum, capped at the segment length; linearRecap checks placed length against the planned segment sum (planned), so the deliberate extra never triggers an error.
- Excel paste rejects rows whose mapped quantity is empty, non-numeric, non-integer or zero (quantityError in src/lib/excel.ts), lists them with their line number and never imports them, matching Linear.
- User-facing wording for linear modes avoids trade jargon: "Pièces de même longueur" (fixed) and "Longueurs variables, bout à bout" (joined), under the label "Découpe de la bande"; internal values stay "fixed" / "joined".
- Full backup (src/lib/full-backup.ts, pure and tested; config in src/lib/backup-config.ts): the footer "Sauvegarde" link downloads every localStorage key owned by the app into one .json and restores it; restore validates app/kind/version, first downloads the current data as "-avant-restauration", replaces only this app's keys, then reloads. BackupReminder shows a dismissible pill when data exists and the last backup is older than reminderDays (null = no reminder). The same two files are shared verbatim by Linear, Format and Trame.
- A numeric field left empty is stored as null (JSON of NaN). num()/dec() in src/lib/format.ts therefore print "—" for null/NaN instead of throwing; materialProblems() in validation.ts lists empty or impossible material fields, blocks saving in the material form and makes validatePiece report "Matériau incomplet"; normalizeMaterial() (storage.ts) resets empty kerf/trim to 0 on load and import.
- finalizeSheets first runs unifyIdenticalSheets (engine.ts): sheets with the same bought format and the same multiset of pieces (pieceId, placed size, rotation) all take the first sheet's placements, so groupSheets shows one drawing per distinct content instead of one per arbitrary placement order. Sheet count, pieces and verification are unchanged.
- Catalog materials use a single format unless mixing formats saves at least Material.mixMinGain % (default DEFAULT_MIX_MIN_GAIN = 3) on the primary objective (surface, price or sheet count). The engine compares the best mixed solution with the best single-format strategy already explored and reports the decision in MaterialResult.formatChoice, shown under the results; the threshold is set in the material form (catalog mode).
- stripPack (engine.ts) is an extra single-format strategy for strip cutting: when no two pieces can follow each other along the panel length, each piece takes a full column and the width packing becomes 1D; the fullest pattern is repeated while pieces remain, and pieces of the same type are laid consecutively so few distinct drawings result. It is scored like every other strategy.
- stripPack also tries the panel turned a quarter (width and length swapped, coordinates mapped back), because formats may be typed either way (2500 x 1250 or 1250 x 2500).
- The PDF offcut summary prints compactOrigins() (src/lib/offcuts.ts): panel references are grouped by offcut mark and compressed into ranges ("P1 à P96 / C1") instead of listing every panel.
