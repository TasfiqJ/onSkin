# Shelf scanner terminal-session checkpoint

Date: 2026-07-25
Plan scope: §9.3 Product catalog, scanner, and OCR
Status: Implemented locally; signed-native camera proof pending

## Outcome

Shelf barcode scanning now admits exactly one frame into a session, pauses camera delivery and torch during lookup and every terminal result, and requires a deliberate `Scan again` action to re-arm. A terminal result can no longer expire back into live scanning.

`barcodeScanSession.ts` is the single state machine for idle, invalid, lookup, matched, no-match, offline, and error states. `scan.tsx` synchronously updates a state ref before React publication, which closes the same-render multi-frame window. `CameraView.active`, `onBarcodeScanned`, and `enableTorch` all derive from the same focused-idle predicate.

Each lookup carries a monotonic attempt ID in addition to the active `AbortController`. Completion and cancellation must match both barcode and attempt. This prevents delayed work from an earlier scan of the same barcode from replacing or reopening a newer session.

The terminal recovery control is a named, complete 48 pt+ action. It aborts the active request, clears the duplicate gate and torch, and resets the session without navigation. Terminal states also suppress idle-only scanner guidance, closing the overlap found during the first 390 x 844 visual pass.

An accepted decode now emits the source-required selection haptic. The native reticle derives from the same active-scanner predicate, so a paused lookup/result no longer presents an active-looking target. Lookup and terminal copy expose polite alert semantics with concise labels that state the outcome and that scanning is paused; actual VoiceOver announcement behavior remains native QA.

## Automated evidence

- `npm --workspace apps/mobile run typecheck` — pass.
- Focused ESLint on the scanner/session/routes files with `--max-warnings=0` — pass.
- `npx vitest run src/features/shelf/barcodeScanSession.test.ts src/features/shelf/shelfRoutes.test.ts src/features/native/camera/barcode.test.ts` — 3 files / 56 tests pass.
- The session matrix covers all terminal outcomes, different-frame rejection, deliberate same-barcode re-arm, and stale same-barcode finish/cancel attempt fencing.

## Human-simulated evidence

Expo web ran with the development-only `no_match` fixture for barcode `012345678905`.

- 375 x 667 requested viewport: terminal result remained stable for 2.8 seconds; exactly one `Scan again` action measured 49.94 px high; reset removed terminal copy and action without changing `/shelf/scan`; zero horizontal overflow.
- 390 x 844 requested viewport: the same persistence, control, reset, route, and overflow checks passed.
- The denser matched fixture passed at both viewports. Add this, Wrong, Scan again, OCR, catalog search, and manual entry were all complete and center-hit-testable. At 375 x 667, the lowest control ended at 651.97 px within the browser-reported 668 px viewport; at 390 x 844, it ended at 804.67 px within 845 px.
- The matched result remained stable for 2.8 seconds, exposed `Catalog match: RoutineKind Fixture Mineral SPF 50. Scanner paused.` as its alert label, and reset in place.
- Post-fix screenshots show no overlap and no idle scanner guidance during the terminal result.
- Browser logs contain only expected local placeholder and Expo web notification warnings, with no scanner-route error.

Artifacts: `test-results/human-e2e/2026-07-25/shelf-scanner-terminal-session-current/`.

## Remaining acceptance

Expo web cannot exercise a physical barcode camera or torch. Before this plan item can be called device-verified, run the branch on a signed supported iPhone and prove:

1. one genuine held barcode produces one lookup/log/analytics outcome;
2. lookup and every terminal state stop frame callbacks and torch;
3. focus loss/backgrounding cannot publish stale work;
4. `Scan again` admits exactly one new lookup of the same barcode;
5. VoiceOver and Dynamic Type retain a complete recovery action and result copy.
