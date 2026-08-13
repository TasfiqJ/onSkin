# Catalog Search Input-Isolation Human E2E

## Summary

- Date: 2026-07-16
- Task: OPT-115 catalog search input isolation and stale-publication closure
- Surface: Expo web development build in the Codex in-app browser
- Requested viewport: 390 x 844
- Observed viewport: 390 x 845
- Start command: `npm --workspace apps/mobile run web -- --port 8276`
- Fixture: dev-only 12-result catalog fixture with a deterministic 5,000 ms delay
- External services: none; placeholder Supabase configuration remained offline
- Destructive actions: none
- Verdict: Scoped evidence captured; this is not full human-simulated E2E checklist acceptance

## Flows Executed

| Flow | Result | Evidence |
| --- | --- | --- |
| Load 12 bounded catalog results | Pass | `01-baseline-12-results.png`, `metrics.json` |
| Enter 80 characters through 80 individual key actions | Pass | numeric DOM counters in `metrics.json` |
| Attempt an 81st character | Pass: value stayed at 80 | `metrics.json` |
| Edit a pending 5-second query | Pass: one cancellation, zero publication before and after the delay | `04-pending-cancellation.png`, `metrics.json` |
| Press Return twice rapidly | Pass: one request start and one duplicate suppression | `metrics.json` |
| Submit a replacement after cancellation | Pass: one publication and 12 result cards | numeric DOM counters in `metrics.json` |
| Continue with Add by hand after editing | Pass: `/shelf/manual` received the latest synthetic draft | `03-manual-latest-draft.png`, `metrics.json` |
| Responsive/dialog/log check | Pass with expected dev warnings | `metrics.json` |

The server-sanitized short-input case (`a%`) is covered by query/client unit tests and route source contracts, not by durable browser metrics in this evidence set. Capture attempts `02-80-character-draft.png`, `05-cancelled-draft.png`, and `06-replacement-12-results.png` contain opaque occlusion, are excluded as standalone visual proof, and are intentionally not committed. Their content-free numeric DOM metrics remain usable.

After the review-driven request-coordinator refactor, a fresh Expo-web browser run repeated the five-second cancellation, two-Return duplicate, supersession, and 12-card replacement flow. It reproduced the same lifecycle outcome (`1` cancellation with `0` late publications, then `1` duplicate and `1` current publication). That desktop regression is recorded separately in `post-coordinator-regression.json`; it does not replace the supported-phone layout or 80-key profile above. `browser-console-post-coordinator.json` is a sanitized console artifact from that rerun.

## Render Checkpoint

The 80-key window produced exactly 80 composer commits and 80 draft changes. It produced zero result-region commits, result-card renders, search starts, cancellations, publications, or duplicate submissions. React Profiler actual-duration total increased by 30.9 ms across the 80 composer commits (mean about 0.386 ms); the global maximum counter did not increase above its pre-window 2.2 ms value.

These development Profiler values are diagnostic browser evidence, not production-Hermes latency or frame-budget evidence. The 1,521 ms driver duration measures browser automation round trips and is not an app latency measurement.

## Request-Lifecycle Checkpoint

Editing the deterministic pending request changed counters from `starts=1, cancellations=0, publications=0` to `starts=1, cancellations=1, publications=0`. After 5.2 seconds, those values were unchanged. Two rapid Return actions then changed a clean route from `starts=0, duplicateSubmits=0` to `starts=1, duplicateSubmits=1`. After superseding that request and submitting the replacement, the route reported `starts=2, cancellations=1, duplicateSubmits=1, publications=1`, with 12 visible cards.

## Layout And Browser Health

- Input height: 50.0 px
- Search action height: 50.0 px
- Add by hand height: 56.0 px
- Horizontal overflow: 0 px
- JavaScript dialog: none
- In-session browser summary: zero error entries and only the expected placeholder Supabase URL/key and Expo web-notification listener warning signatures, repeated across deliberate route reloads
- Raw console artifact: not captured; the browser-health statements are session-summary evidence only

## Commands

```text
npm --workspace apps/mobile test -- src/features/catalog/searchQuery.test.ts src/features/catalog/searchRenderDiagnostics.test.ts src/features/catalog/searchRequestCoordinator.test.ts src/features/catalog/client.test.ts src/features/shelf/shelfRoutes.test.ts
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
```

The focused matrix passed 5 files / 69 tests after the coordinator refactor. Final root gates passed 312 files / 3,873 tests, two-workspace typecheck, and two-workspace zero-warning lint.

Deterministic behavioral coordinator tests cover duplicate begin, A-to-B supersession, stale success/error rejection, old-finally rejection, blur cancellation, and unmount rejection. Catalog-search analytics now runs only after the route accepts the exact current controller. The browser runs did not retain analytics-transport evidence.

## Remaining Risk

- Production Hermes/native iOS keystroke latency, frames, CPU, thermal impact, and memory remain unmeasured.
- Native keyboard, VoiceOver, Dynamic Type, and physical-device behavior remain open.
- Blur/unmount/back/re-entry and refresh/relaunch were not rerun in this slice.
- No-match/empty/reporting, wrong-match/use-match, and the visible Search button were not rerun in this slice.
- Accessibility and native-keyboard behavior were not rerun in this slice.
- Live Supabase latency, timeout/retry behavior, and database query plans remain open.
- OCR review input and You-screen mutation-state isolation remain separate OPT-115 work.
