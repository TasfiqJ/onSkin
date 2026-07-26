# Routine Plan Route View-Model Checkpoint

Date: 2026-07-25 (America/Toronto)
Branch: `optimization`
Checkpoint parent SHA: `1f5f9a0a62a9457de545a6b2eb8efc03189533d4`
Evidence class: `command`, `decision`, source-level observer inventory, and web `e2e`

This sanitized checkpoint covers the Routine Plan slice of OPT-114. It records
route ownership, retry behavior, automated gates, independent review, and
human-simulated Expo-web behavior. It does not claim native QueryObserver,
React-commit, frame-time, memory, or production-Hermes verification.

## Baseline, Hypothesis, And Result

The Routine Plan route previously mounted one Shelf gate and then composed
standalone `usePlan()` and `useCycle()` graphs. TanStack Query could deduplicate
same-key fetching, but the route still owned three Shelf observers, two profile
observers, two routine-order observers, and three local-date subscriptions.

The routine layout now owns one local-date boundary and one Shelf result, passes
that exact result through the fail-closed Shelf boundary, and exposes both to a
route view model. The view model reuses the owner-leased profile already loaded
inside Shelf and mounts routine order, ramp, and cycle config exactly once.
Standalone Plan, Ramp, and Cycle hooks remain unchanged for other routes.

| Source-level mounted work          | Before | Current | Scope of proof                      |
| ---------------------------------- | -----: | ------: | ----------------------------------- |
| Shelf query observers              |      3 |       1 | Exact route/provider composition    |
| Profile query observers            |      2 |       0 | Exact reuse of `shelf.data.profile` |
| Routine-order query observers      |      2 |       1 | Source-aware Plan composition       |
| Ramp query observers               |      1 |       1 | Source-aware Ramp composition       |
| Cycle-config query observers       |      1 |       1 | Source-aware Cycle composition      |
| Total routine-data query observers |      9 |       4 | Static mounted graph                |
| Local-date subscriptions           |      3 |       1 | Route-owned boundary composition    |

The unchanged Pro gate adds entitlement and disabled-offering observers, making
the complete visible route graph 11 to 6 observers. These are source-level
composition counts, not native profiler measurements. No render-duration,
frame-time, interaction-latency, or memory improvement is claimed.

## Recovery And Compatibility Contract

- Shelf pending or failure mounts only the outer Shelf observer; Plan, Ramp,
  Cycle, and Start Today remain unmounted behind
  `ShelfDataAvailabilityBoundary`.
- The Shelf recovery action refetches only Shelf.
- The Plan recovery action retries only the routine-order observer owned by
  source-aware Plan.
- The schedule recovery action retries only ramp and cycle config.
- A failed Start Today mutation retains the prior cycle and its route-local
  retry contract.
- Empty-Shelf example behavior, real-profile conflict derivation, active cycle
  projection, navigation, and standalone hook contracts remain unchanged.

## Commands And Results

| Command or review              | Result                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Focused route/source matrix    | Pass, 7 files / 45 tests                                                                                    |
| Independent final source audit | No P0-P2 findings; 11 files / 83 tests pass                                                                 |
| Mobile TypeScript check        | Pass                                                                                                        |
| Mobile zero-warning ESLint     | Pass                                                                                                        |
| `git diff --check`             | Pass                                                                                                        |
| Full mobile Vitest run         | 357 files / 4,271 tests pass; four known unrelated failures in two user-owned notification/Shelf test areas |

The unrelated full-suite baseline failures are one behavioral-notification
snapshot assertion and three Shelf expiry/provenance assertions. The focused
route/source matrix is green.

## Human-Simulated Expo-Web Evidence

Host: Windows development workspace
Surface: Expo web through the Codex in-app Browser
Viewports: requested 390 x 844 and 360 x 640; observed 390 x 845 and 360 x 641
Maintained evidence:
`test-results/human-e2e/2026-07-25/routine-plan-view-model-current/`

Happy-path actions and observations:

1. Opened `/routine/plan` on a fresh loopback origin and confirmed the empty
   Shelf example with Back, safety-setting review, Morning, Evening skin
   cycling, Night 1 Glycolic 7%, Night 2 Recover, and Start Today.
2. Activated Back and confirmed the exact `/you` destination.
3. Returned to Plan, activated Start Today, and confirmed `/today`.
4. Confirmed Today published the same active schedule: skin cycling night 1 of
   7 with Glycolic 7% as the one evening routine item.
5. Reopened Plan at 360 x 640, scrolled through the compact route, and confirmed
   the complete recovery-night copy and final cleanser suggestion remained
   reachable above the sticky Start Today action.
6. Both phone sizes reported document scroll width equal to client width.
   Browser diagnostics contained zero errors or dialogs. The nine warnings were
   three expected development warnings repeated across reloads: placeholder
   Supabase URL, placeholder Supabase publishable key, and unsupported web push
   token listening.

One-shot Shelf recovery actions and observations:

1. Restarted the current app with
   `EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE=once` and reopened `/routine/plan`.
2. Confirmed the exact `Private Shelf` / `Shelf data unavailable` alert and its
   single `Retry loading private Shelf data` action. Back, Plan content, Cycle
   content, and Start Today were absent while Shelf was unreadable.
3. Activated Retry once and confirmed the complete example Plan returned in
   place with Back, schedule content, and Start Today.
4. The recovery run reported zero browser errors or dialogs.

The original `localhost` origin contained unreadable pre-existing private
storage and correctly remained behind its non-destructive global recovery
surface. No local data was cleared. The isolated `127.0.0.1` origin supplied a
fresh app store for this route proof.

## Verification Boundary

OPT-114 remains `investigating`. Signed supported-iOS before/after
QueryObserver counts, React commit counts/flamegraphs, interaction traces,
representative latency and memory evidence, date/time-zone rollover, and native
accessibility verification remain required before implementation or
verification status.
