# Shelf And Archive Collection Stress Checkpoint

Date: 2026-07-21 (America/Toronto)

Branch: `optimization`

Evidence class: focused tests and supported-phone Expo-web human-simulated E2E

Status: Shelf/archive collection stress behavior is locally implemented and web-checked. OPT-105 remains `investigating` because signed supported-iOS frame, memory, lifecycle, Dynamic Type, VoiceOver, and oldest-device tuning evidence is still open.

## Baseline And Findings

Shelf and Archive already used `FlatList`, stable IDs, memoized narrow rows, and focus-gated data ownership. The remaining gap was deterministic 100+ row traversal evidence and content-free diagnostics. The first stress run also found that filter offsets depended on `contentOffset`, queued callbacks from an outgoing filter could overwrite its saved position, and Archive Back treated a variable-height bottom pixel offset as stable while the recycler was rebuilding.

## Implementation

- `shelfStressFixture.ts` creates deterministic mixed-height active and archive rows only when `__DEV__`, web, and the exact two stress-count environment variables are active. Each collection is independently capped at 250 rows, invalid input fails closed, and the fixture overlays only after the real Shelf availability query succeeds.
- `shelfRenderDiagnostics.ts` records only bounded numeric list-commit durations and row/header/footer render counts in development. It accepts no row content, product identifier, query key, or private record.
- Shelf and Archive expose stable native IDs for exact recycler traversal. Production data ownership, error/loading behavior, and query paths remain unchanged.
- Independent filter offsets are retained as one filter enum plus three non-sensitive numbers outside the focus-gated private observer. Programmatic transitions suppress writes, stale callbacks are rejected against the current filter identity, and no filter-key remount is used.
- Archive navigation records a semantic end boundary. On return, the list continues `scrollToEnd` restoration through content-size changes and releases the fence only when the stable viewability callback reports the final row.
- The CDP harness uses viewport-sized traversal steps, verifies every expected stable row ID, rejects blank sampled viewports, cycles all filters twice, enters Archive through the accessible footer, traverses Archive, uses Back, and waits for the final Shelf row to become visible before asserting the restored anchor.
- No `getItemLayout`, `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, or clipping guess was introduced without supported-native measurement.

## Verification

| Check | Result |
| --- | --- |
| Shelf fixture/diagnostic/route matrix | Pass, 3 files / 48 tests |
| Broader Shelf store/availability/detail/stress matrix | Pass, 6 files / 107 tests |
| Mobile TypeScript | Pass |
| Targeted zero-warning ESLint | Pass |
| Harness syntax | Pass |
| Repository TypeScript | Pass, 2 workspaces |
| Repository zero-warning lint | Pass, 2 workspaces |
| Repository tests | 2 files failed / 347 passed; 4 tests failed / 4,151 passed, all in unrelated user-owned notification/Shelf metadata changes already present in the dirty worktree |
| Expo-web viewport | 390 x 844 |
| All Shelf traversal | Pass, 100/100 unique rows; 30-100 mounted-row range across samples |
| Actives traversal | Pass, 34/34 unique rows |
| Expiring traversal | Pass, 40/40 unique rows |
| Archive traversal | Pass, 100/100 unique rows; 30-100 mounted-row range across samples |
| Filter restoration | Pass for All, Actives, and Expiring visible anchors |
| Archive Back restoration | Pass; final Shelf row visible at scroll offset 16,132 |
| Sampled blank viewports | 0 |
| Horizontal overflow | 0 px |
| JavaScript dialogs | 0 |
| Unexpected browser warnings/errors | 0 |

Raw screenshots, numeric Profiler metrics, browser/Expo logs, and the run report are in `test-results/human-e2e/2026-07-21/shelf-archive-stress-current/`. The offset/restoration defect and post-fix sequence are recorded in `docs/e2e-bug-reports/2026-07-21-shelf-filter-offset-restoration.md`.

## Privacy And Scope

The fixture contains synthetic names, deterministic dates/statuses, and sequence IDs only. No account, barcode, ingredient, health, storage, credential, provider, or real product data enters the evidence packet. Diagnostics contain counts and durations only.

This closes the decision-free local Shelf/archive stress-coverage gap. It does not claim native window tuning, production-Hermes frame or memory performance, physical focus/background behavior, Dynamic Type, VoiceOver, TalkBack, or signed-device completion.
