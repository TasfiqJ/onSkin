# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-16 (America/Toronto)
- Codex task: OPT-115 OCR review input isolation
- App surface: Expo web development build
- Build/start command: `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once`; `npm --workspace apps/mobile run web -- --port 8277`
- Browser/device/simulator/OS: Codex in-app browser on Windows; requested 390 x 844 and 375 x 667 supported Expo-web viewports, observed 390 x 845 and 376 x 668
- Feature tested: `/shelf/ocr` capture-failure recovery, long-draft typing isolation, preview debounce/bound, exact pending submission, and supported-phone geometry
- Overall verdict: Pass with one issue found and fixed, scoped to Expo web development evidence

## Test State And Safety

- Account: no signed-in account or account-specific fixture was required.
- Local state: the E2E-only environment flag forced the next shelf OCR label capture to fail once; a deterministic synthetic ingredient draft was entered into the resulting review editor.
- Required environment variables: `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once` for this run only.
- External services: none required or exercised.
- Destructive actions: none.
- Evidence folder: `test-results/human-e2e/2026-07-16/ocr-input-isolation-current/`.

## Tool Inventory

- Expo CLI: available through the mobile workspace; Expo web server used on port 8277.
- iOS Simulator: not used.
- Android emulator: not used.
- Expo web: used.
- Playwright: not used.
- Playwright MCP: not used.
- Codex Computer Use: not used.
- Other: Codex in-app Browser semantic interaction and screenshots; React development Profiler plus content-free numeric render/parse diagnostics; PowerShell for artifact and hash validation.

## Deterministic Fixture Recipe

```js
const indexed = (label, count) =>
  Array.from(
    { length: count },
    (_, index) => `${label} ${String(index + 1).padStart(3, '0')}`,
  );

const active = indexed('Retinol Stress', 96);
const unknown = indexed('Synthetic Inci', 100);
const preSubmit = [...active, ...unknown].join(', ') + ', ' + '1'.repeat(60);
const prefix = preSubmit.slice(0, 3852);
const rapidSuffix = preSubmit.slice(3852);
const finalMarker = ', Hydroquinone Exact';
const raw = preSubmit + finalMarker;
const canonical = [...active, ...unknown, 'Hydroquinone Exact'].join(', ');
```

Expected lengths are 3,980 for `preSubmit`, 3,852 for `prefix`, 128 for `rapidSuffix`, 20 for `finalMarker`, 4,000 for `raw`, and 3,938 for `canonical`. The raw and canonical SHA-256 values are recorded in `metrics.json`. The 60-digit-only token normalizes to empty and is omitted; canonical joining also replaces its two surrounding separators with one, accounting for the exact 62-code-unit reduction.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Enter OCR review | Forced label-capture failure | Pass | `01-capture-failure-review-390x844.png` | Real `/shelf/ocr` fallback surface became interactive. |
| Type a long draft | 128 individual raw-input key actions | Pass | `metrics.json`, `02-long-draft-preview-390x844.png` | Route, capture panel, and preview parse/render deltas remained zero during the burst. |
| Settle the preview | 300 ms trailing debounce | Pass | `metrics.json` | Exactly one preview parse and render occurred after quiescence. |
| Bound preview rows | 96 parsed active tokens | Pass | `02-long-draft-preview-390x844.png`, `metrics.json` | 64 rows rendered and the overflow summary remained visible. |
| Enforce input bound | Attempt a 4,001st UTF-16 code unit | Pass | `metrics.json` | The final input remained exactly 4,000 code units. |
| Continue while stale | Submit before the latest preview settled | Pass | `03-exact-canonical-manual-carryover-390x844.png`, `metrics.json` | Manual intake received the exact expected canonical draft and final marker. |
| Compact layout | Supported 375 x 667-class viewport | Pass | `04-compact-review-375x667.png`, `metrics.json` | No overflow, overlap, partial controls, or blocked hit centers. |
| Browser health | Dialog/error/warning review | Pass | `metrics.json` | No dialog, error, unexpected warning, or duplicate-key warning. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- |
| OCR preview parser replay | P2 | Enter a raw character before the preview debounce expires with parsing owned by the editor. | No preview parse during a raw-only editor commit. | One parse occurred before debounce in the first run. Parsing was moved into the memoized preview leaf and the exact reproduction passed. | `docs/e2e-bug-reports/2026-07-16-ocr-preview-parse-replayed-during-raw-typing.md`, `metrics.json` |

## Tests Added Or Updated

- `apps/mobile/src/features/catalog/ocrReview.test.ts`: bounds, debounce, preview-row cap, and trimmed eligibility contracts.
- `apps/mobile/src/features/catalog/ocrRenderDiagnostics.test.ts`: development-only, numeric, content-free diagnostics.
- `apps/mobile/src/features/shelf/shelfRoutes.test.ts`: OCR source boundary, exact-current submit, memoized preview ownership, and route contracts.
- These stable source and unit contracts prevent the measured ownership regression without encoding browser timing into a brittle automated test.

## Commands Run

```text
EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once
npm --workspace apps/mobile run web -- --port 8277
PASS: Expo web development server and interactive route

npm --workspace apps/mobile test -- src/features/catalog/ingredientParser.test.ts src/features/catalog/ocrReview.test.ts src/features/catalog/ocrRenderDiagnostics.test.ts src/features/shelf/shelfRoutes.test.ts src/features/navigation/sheetRouteContracts.test.ts
PASS: 5 files / 56 tests

npm --workspace apps/mobile run typecheck
PASS

npm --workspace apps/mobile exec -- eslint src/app/shelf/ocr.tsx src/features/catalog/ocrReview.ts src/features/catalog/ocrReview.test.ts src/features/catalog/ocrRenderDiagnostics.ts src/features/catalog/ocrRenderDiagnostics.test.ts src/features/shelf/shelfRoutes.test.ts --max-warnings=0
PASS: zero warnings

npm run typecheck
PASS: 2 workspaces

npm run lint
PASS: 2 workspaces, zero warnings

npm test
PASS: 314 files / 3,883 tests
```

## Remaining Risk

- Untested flows: production Hermes/native keyboard and IME behavior, VoiceOver/TalkBack, native safe areas, real camera/OCR lifecycle and recognition, refresh/relaunch, cleanup-failure retry, permission denial, and Back/retry draft restoration were not rerun in this slice.
- Missing fixtures: no production-like native OCR fixture or physical device was available for this scoped web pass.
- Flaky areas: browser-observed viewport dimensions rounded by one pixel from the requested sizes; both remained inside the supported viewport classes.
- Manual follow-up needed: production-Hermes frame, CPU, thermal, and memory evidence plus native keyboard/accessibility verification remain launch work.
