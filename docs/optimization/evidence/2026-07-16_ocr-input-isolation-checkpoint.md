# OCR Input-Isolation Checkpoint

Date: 2026-07-16 (America/Toronto)
Plan item: OPT-115
Status: Investigating

## Outcome

Shelf OCR review now owns immediate raw text inside a memoized editor leaf. The route receives the latest bounded draft through a ref-only callback and changes parent state only when trimmed-empty eligibility crosses a boundary, so ordinary typing does not rerender the route. The camera/image/fallback surface is a memoized capture panel with stable callbacks.

Preview parsing uses a 200 ms trailing debounce. The expensive parse is owned by the memoized preview leaf rather than by the editor render. During the measured raw-only commits, `previewText` stayed unchanged, the memoized preview bailed out, and the parser did not execute. The prior preview remains mounted with an explicit stale/updating status while the next preview is pending. Active preview cards are bounded to 64 positional-keyed rows; the full parsed result remains available to submission.

OCR text is bounded to 4,000 UTF-16 code units in both the input contract and JavaScript update path, matching the external catalog lookup's raw-ingredient ceiling. Continue rejects duplicate in-flight presses, synchronously parses the exact latest bounded ref before asynchronous photo cleanup, and publishes intake only after cleanup succeeds. The final result never reads the debounced preview. A retry snapshots the latest editor ref only when cleanup succeeds, preserving edits made while cleanup is pending.

Development diagnostics are content-free. They retain only route/capture/editor/preview counts, editor durations, draft changes, and successful exact submissions. The route publishes only numeric counters to development-web attributes.

## Focused Validation

```text
npm --workspace apps/mobile test -- src/features/catalog/ingredientParser.test.ts src/features/catalog/ocrReview.test.ts src/features/catalog/ocrRenderDiagnostics.test.ts src/features/shelf/shelfRoutes.test.ts src/features/navigation/sheetRouteContracts.test.ts
PASS: 5 files / 56 tests

npm --workspace apps/mobile run typecheck
PASS

npm --workspace apps/mobile exec -- eslint src/app/shelf/ocr.tsx src/features/catalog/ocrReview.ts src/features/catalog/ocrReview.test.ts src/features/catalog/ocrRenderDiagnostics.ts src/features/catalog/ocrRenderDiagnostics.test.ts src/features/shelf/shelfRoutes.test.ts --max-warnings=0
PASS: zero warnings
```

```text
npm run typecheck
PASS: 2 workspaces

npm run lint
PASS: 2 workspaces, zero warnings

npm test
PASS: 314 files / 3,883 tests
```

## Human-Simulated E2E

- Surface: Expo web development build, Codex in-app browser
- Start: `EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE=once`, then `npm --workspace apps/mobile run web -- --port 8277`
- Modern viewport: requested 390 x 844, observed 390 x 845
- Compact viewport: requested 375 x 667, observed 376 x 668
- External services: none
- Evidence: `test-results/human-e2e/2026-07-16/ocr-input-isolation-current/`
- Run report: `test-results/human-e2e/2026-07-16/ocr-input-isolation-current/report.md`

### Raw typing and preview debounce

A 3,852-character synthetic draft settled first. The final 128 characters of the 3,980-character pre-submit draft were then entered through 128 individual key actions.

| Counter               | Before | Immediate | Raw-typing delta | After 300 ms | Settled delta |
| --------------------- | -----: | --------: | ---------------: | -----------: | ------------: |
| Route renders         |      5 |         5 |                0 |            5 |             0 |
| Capture-panel renders |      3 |         3 |                0 |            3 |             0 |
| Editor commits        |      3 |       131 |             +128 |          132 |          +129 |
| Draft changes         |      1 |       129 |             +128 |          129 |          +128 |
| Preview parses        |      1 |         1 |                0 |            2 |            +1 |
| Preview renders       |      1 |         1 |                0 |            2 |            +1 |

The editor's development Profiler total increased by about 61.4 ms across the 128 raw-input commits, a mean of about 0.480 ms. The browser driver needed 2,141 ms to issue 128 separate key actions; that driver duration is not app latency, and development Profiler values are not production-Hermes latency evidence.

The settled preview parsed 96 actives, rendered the first 64, and showed the explicit overflow summary. Horizontal overflow and textarea/footer overlap were both 0 px.

### Bound and exact pending submit

The exact synthetic raw draft reached 4,000 code units with SHA-256 `dd2366c8f49188041f9409c62713b7c29c9707a1433f9a7cc9f79202e90fc977`. A 4,001st code unit was attempted and rejected. The final 20-code-unit marker was accepted, the UI still reported the preview as pending, and Continue was activated 31 ms of browser-driver time after the boundary snapshot.

`/shelf/manual` received the exact expected canonical 3,938-character token list, SHA-256 `f3af62ef4dbe64e5b81a1014e198e47d37854350421d81cc13d52cd6cc9e92e9`, including the final `Hydroquinone Exact` marker and excluding the rejected character. This proves submission used the latest bounded draft rather than the stale preview for the measured path.

The deterministic fixture joined 96 one-based, three-digit-indexed `Retinol Stress` tokens and 100 equivalently indexed `Synthetic Inci` tokens, then appended a 60-digit-only padding token. The first 3,852 code units formed the settled prefix and the remaining 128 formed the rapid suffix; `, Hydroquinone Exact` was the final 20-code-unit marker. The parser intentionally omitted the numeric-only token because normalization leaves it empty. Canonical joining replaced its two surrounding separators with one, so the exact canonical result is 62 code units shorter than the 4,000-code-unit raw draft (60 digits plus one two-code-unit separator).

### Layout and browser health

- At 390 x 845, Back, retry, textarea, and Continue were fully visible, center-hit-testable, and about 48/48/132/56 px high.
- At 376 x 668, the smallest visible control was about 48 px; partial controls, blocked centers, horizontal overflow, and textarea/footer overlap were all zero.
- No JavaScript dialog, browser error, unexpected warning signature, or duplicate-key warning appeared. Twelve warnings across repeated loads matched the known placeholder-Supabase and Expo-notifications web signatures.

## E2E-Found Bug And Fix

The first measurement found one preview parse replaying during a raw-only update because the parser calculation was editor-owned behind `useMemo`. The minimal fix moved parsing into the memoized preview leaf. The exact reproduction then passed with zero preview parses/renders during all 128 key actions and one parse/render after quiescence. See `docs/e2e-bug-reports/2026-07-16-ocr-preview-parse-replayed-during-raw-typing.md`.

## Claim Boundary

This checkpoint supports the scoped development Expo-web ownership, render isolation, measured debounce coalescing, input/preview bounds, exact-current pending submission, canonical carryover, capture-failure recovery, and supported-phone geometry behavior. It is not full human-simulated E2E checklist acceptance.

This pass does not prove production Hermes keystroke or parse latency, native keyboard/IME behavior, VoiceOver/TalkBack, native safe areas, camera/OCR lifecycle or recognition accuracy, physical-device frames/CPU/thermal/memory, refresh/relaunch, cleanup-failure retry, permission denial, or Back/retry draft restoration. Existing separate flow-tree evidence for those recovery branches is not promoted into this optimization claim.

OPT-115 remains `investigating`. Ask, catalog search, and OCR ownership are now implemented and web-checked. Progress note ownership is source-proven but still needs persisted-reload/runtime/native evidence; You feedback/mutation ownership, combined analytics transport, native keyboard/accessibility, and production Hermes frame/memory evidence remain open.
