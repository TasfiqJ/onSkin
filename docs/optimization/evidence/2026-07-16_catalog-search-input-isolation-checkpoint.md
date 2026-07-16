# Catalog Search Input-Isolation Checkpoint

Date: 2026-07-16 (America/Toronto)
Plan items: OPT-115, partial OPT-118
Status: Investigating

## Outcome

Catalog search now keeps raw draft state inside a memoized leaf composer. The route receives stable callbacks and a synchronous latest-draft ref but does not rerender result cards for ordinary keystrokes. Each result card is memoized, the query uses the same normalization/grammar/minimum/80-character contract as the catalog Edge Function, and the client rejects ineligible queries before delay, fixture, analytics, or transport work.

Active search identity is now `{ query, controller }`. A different normalized draft aborts it immediately; the same active query is synchronously deduplicated; a replacement aborts the previous controller; and response/error/busy publication requires exact current-controller identity plus mounted state. Blur/unmount cancellation and mounted cleanup use layout effects, and dev auto-search waits for route focus. `Add by hand` reads the latest bounded draft rather than parent keystroke state.

Development diagnostics are content-free. They retain only composer commit/duration counts, draft changes, result-region commits, card renders, request starts, cancellations, publications, and duplicate submissions. The route publishes only those numeric counters to dev-web attributes.

## Focused Validation

```text
npm --workspace apps/mobile test -- src/features/catalog/searchQuery.test.ts src/features/catalog/searchRenderDiagnostics.test.ts src/features/catalog/searchRequestCoordinator.test.ts src/features/catalog/client.test.ts src/features/shelf/shelfRoutes.test.ts
PASS: 5 files / 69 tests

npm --workspace apps/mobile run typecheck
PASS

npm --workspace apps/mobile run lint
PASS: zero warnings
```

```text
npm run typecheck
PASS: 2 workspaces

npm run lint
PASS: 2 workspaces, zero warnings

npm test
PASS: 312 files / 3,873 tests
```

## Human-Simulated E2E

- Surface: Expo web development build, Codex in-app browser
- Requested viewport: 390 x 844
- Observed viewport: 390 x 845
- Fixture: 12 bounded dev-only results
- Deterministic request delay: 5,000 ms
- External services: none
- Evidence: `test-results/human-e2e/2026-07-16/catalog-search-input-isolation-current/`

### Typing profile

An exact synthetic 80-character input was entered through 80 individual key actions. SHA-256: `d68d62c262c2ec08961c1104188cde86f51695878759666ad61490c8ec66745c`.

| Counter                        |    Before |     After |      Delta |
| ------------------------------ | --------: | --------: | ---------: |
| Composer commits               |        19 |        99 |        +80 |
| Composer actual-duration total | 10.700 ms | 41.600 ms | +30.900 ms |
| Draft changes                  |        16 |        96 |        +80 |
| Result-region commits          |         3 |         3 |          0 |
| Result-card renders            |        12 |        12 |          0 |
| Search starts                  |         1 |         1 |          0 |
| Cancellations                  |         0 |         0 |          0 |
| Publications                   |         1 |         1 |          0 |

The mean development Profiler duration across those 80 composer commits was about 0.386 ms. The global maximum counter stayed at its pre-window 2.2 ms value. The browser driver took 1,521 ms to issue 80 separate key actions; that driver duration is not app latency. The 81st character was rejected by the 80-character input bound.

### Request lifecycle

- A five-second pending query started with `starts=1, cancellations=0, publications=0`.
- One draft edit changed it to `starts=1, cancellations=1, publications=0`.
- After 5.2 seconds, the counters were unchanged and no cards appeared.
- Two rapid Return actions on a fresh query yielded `starts=1, duplicateSubmits=1, publications=0`.
- After superseding that request and submitting its replacement, the route yielded `starts=2, cancellations=1, duplicateSubmits=1, publications=1` and 12 visible cards.
- `Add by hand` carried the latest synthetic draft into the Product name field on `/shelf/manual`.

The server-sanitized short-input case (`a%`) is covered by query/client unit tests and route source contracts. It is not claimed as durable browser evidence because this evidence set does not retain a corresponding counter snapshot.

A fresh post-review desktop Expo-web regression then exercised the production-used request coordinator. It reproduced the five-second cancellation with zero late publication, two-Return duplicate suppression, supersession, and one current replacement publication with 12 visible cards. Exact counters are in `post-coordinator-regression.json`; this desktop rerun does not expand the supported-phone or typing-profile claim. Deterministic coordinator tests cover duplicate begin, A-to-B supersession, stale success/error rejection, older completion rejection, blur cancellation, and unmounted publication.

Capture attempts `02-80-character-draft.png`, `05-cancelled-draft.png`, and `06-replacement-12-results.png` contain opaque occlusion, are excluded as standalone visual proof, and are intentionally not committed. Their content-free numeric DOM measurements in `metrics.json` remain usable.

### Layout and browser health

- Input and Search controls were 50 px high; Add by hand was about 56 px high.
- Horizontal overflow was 0 px.
- No JavaScript dialog appeared.
- The original run's in-session summary reported zero browser errors and only three expected development warning signatures: placeholder Supabase URL, placeholder publishable key, and the Expo notifications web-listener limitation.
- The post-coordinator rerun retained a sanitized console artifact with zero errors, nine expected warnings across three loads, and zero unexpected warning signatures (`browser-console-post-coordinator.json`).

## Claim Boundary

This checkpoint supports the scoped Expo-web ownership, commit-isolation, bounded-input, duplicate/cancellation, current-publication, recovery, and layout behavior. The route emits catalog-search analytics only after exact-current-controller acceptance, but no analytics-transport artifact was retained. It is not full human-simulated E2E checklist acceptance. This slice did not rerun blur/unmount/back/re-entry, no-match/empty/reporting, wrong-match/use-match, the visible Search button, refresh/relaunch, or accessibility/native-keyboard behavior. It also does not prove production Hermes keystroke latency, frame delivery, CPU/thermal cost, memory, native keyboard/VoiceOver behavior, live network latency, database query-plan performance, or browser analytics transport.

OPT-115 therefore remains `investigating`. OCR preview parsing and You-screen mutation state remain open. Progress note ownership was already isolated in `PhotoNoteEditor`; its persisted-reload and native profiler evidence remain open rather than requiring another ownership refactor. OPT-118 advances only for this catalog route; the broader timeout/retry/offline/rate-limit failure matrix remains open.
