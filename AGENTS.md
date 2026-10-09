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
