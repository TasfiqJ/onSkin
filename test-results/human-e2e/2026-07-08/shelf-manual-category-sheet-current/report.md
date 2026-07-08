# Shelf Manual Category Sheet Current

Date: 2026-07-08

Surface: Expo web on Chrome, driven through bundled Playwright against `http://localhost:8221`.

Verdict: Pass.

## Scope

- Route: `/shelf/manual`
- Viewports: 320 x 480 and 320 x 568
- Branch: manual category picker on short phones
- Evidence folder: `test-results/human-e2e/2026-07-08/shelf-manual-category-sheet-current/`

## Result

- Filled product name and brand through user-facing labels.
- Opened the category picker through the `Category` control.
- Verified the sheet exposes `role="dialog"` with `Choose product category`.
- Verified the sheet reserves a 48 px outside dismiss band at 320 x 480.
- Verified all category rows, including `Something else`, are reachable by scroll.
- Verified visible category rows are 272 x 52 px.
- Selected `Something else`; the collapsed field returned as `Category, Other`.
- Continued to `/shelf/opened`.
- Horizontal overflow stayed at 0 for the checked states.
- Browser logs contained only expected local Supabase placeholder and Expo web notification warnings; `disallowedLogs` is empty.

## Commands

```powershell
$env:BROWSER='none'; $env:EXPO_NO_TELEMETRY='1'; npm --workspace apps/mobile run web -- --port 8221 --host localhost
$env:NODE_PATH='C:\Users\jasim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules;C:\Users\jasim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules'; $env:E2E_BASE_URL='http://localhost:8221'; $env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'; & 'C:\Users\jasim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' test-results\human-e2e\2026-07-08\shelf-manual-category-sheet-current\audit.cjs
```

## Remaining Risk

Native iOS/Android safe-area, Dynamic Type, keyboard, and screen-reader traversal remain Phase 5 device QA follow-ups.
