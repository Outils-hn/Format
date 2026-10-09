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
- Business logic (types, storage, Excel parsing, validation, palette) lives in src/lib/, UI in src/components/format/ — so the optimisation algorithm can plug in without touching UI.
- All data is persisted in localStorage only (no backend) — user requirement for offline/private use.
- Colors, fonts, cut-plan palette and hatch patterns are centralised in src/styles.css tokens.
- The 2D optimiser lives in src/lib/optimizer/ (pure code, run in a Web Worker via runOptimization) — keeps the UI responsive and the engine testable without React.
- Rotation suggestions use a second call to the unchanged optimizer, with candidate selection and safe savings comparison in src/lib/rotation.ts; input snapshots guard stale results and applying a suggestion reuses its verified plan.
- The optimiser explores format strategies × heuristics × orientation variants × sort orders (plus grid blocks for identical pieces) and reports per-strategy bests as solutions — keeps the choice transparent while verify.ts stays the single safety net.
- Offcut labels and retained-offcut summaries are derived in src/lib/offcuts.ts and shared by screen and PDF; quantities use actual sheets rather than grouped drawings to preserve traceability without altering the optimizer.
- PDF tables are measured before rendering and placed atomically with their titles; shared measurement also sizes sheet drawings so wrapped cells cannot trigger mid-table page breaks.
- Linear (metre lineaire) rows are converted to rectangular pieces in src/lib/linear.ts before calling the unchanged optimizer; the produced-length check is appended to result errors there — keeps verify.ts untouched.
