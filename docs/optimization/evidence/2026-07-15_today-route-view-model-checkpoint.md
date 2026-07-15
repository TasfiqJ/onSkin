# Today Route View-Model Checkpoint

Date: 2026-07-15 (America/Toronto)
Branch: `optimization`
Implementation SHA: `bc69450e64c7d4c16c431d513515d18af626f438`
Evidence class: `command`, `decision`, source-level observer inventory, and web `e2e`

This sanitized checkpoint covers the Today slice of OPT-114. It records route ownership, durable completion publication, date/owner safety, automated gates, and human-simulated Expo-web behavior. It does not claim a native QueryObserver capture, React flamegraph, frame-time or memory improvement, a production Hermes latency result, or completion of the Progress and Shelf route slices.

## Baseline, Hypothesis, And Result

Before this checkpoint, Today mounted standalone domain hooks recursively. The Shelf availability gate, Plan, Cycle, Ramp, and Recommendations paths each mounted overlapping Shelf/profile observers and local-date subscriptions. TanStack Query could deduplicate same-key fetches, but each hook call still created an observer and a React publication path.

Today now owns one local-date boundary and one Shelf result at the route. `useTodayViewModel` owns the remaining profile, routine-order/Plan, Ramp, cycle-config, Progress, completion, entitlement, and recommendation-input observers, then passes the exact authoritative snapshots into source-aware derivations. Standalone wrappers remain available for other routes.

| Source-level mounted work     |                              Before |                    Current | Scope of proof                                                                   |
| ----------------------------- | ----------------------------------: | -------------------------: | -------------------------------------------------------------------------------- |
| Shelf query observers         |                                   5 |                          1 | Exact hook composition and route source contract                                 |
| Profile query observers       |                                   4 |                          1 | Exact hook composition and call-count tests                                      |
| Routine-order query observers |                                   2 |                          1 | Source-aware Plan composition                                                    |
| Total query observers         |                                  17 |                          9 | Static mounted graph; all nine current observers are independently keyed domains |
| Local-date subscriptions      |                                   9 |                          1 | Route-owned boundary composition                                                 |
| Completion publication        | Invalidate and reread the whole log | Exact post-atomic snapshot | Store/coordinator concurrency tests                                              |

The total source-level query-observer graph falls by 8 of 17 observers (about 47%), and local-date subscriptions fall by 8 of 9 (about 89%). These are static composition counts, not native profiler measurements. No render-duration, frame-time, or memory improvement is claimed.

## Durable Interaction Contract

- A completion is never placed in the React Query cache before the encrypted atomic transform resolves.
- `commitCompletion` returns the exact durable local-day `Set`, whether the write changed state, and whether it was the first-ever completion. It does not reread/decrypt the full log after commit.
- Rapid same-owner/date/step taps join one in-flight promise. The row is disabled and announces `SAVING`; repeated completed-row activation is append-only and does not replay analytics, haptics, or review prompts.
- Distinct rapid step commits merge append-only durable snapshots, so reverse publication order cannot delete a sibling completion.
- Cache cancellation/publication is exact to the captured owner, local date, and time-zone identity. A same-date travel identity receives the committed snapshot; a new local date never receives the old-day snapshot.
- Progress reconciliation is trailing/coalesced and failure-soft. It cannot reclassify an already durable completion as failed.
- Cycle-night analytics first reserves an encrypted owner/local-date receipt through a strict atomic reducer. Routine expansion, remount, restart, and concurrent candidates cannot emit the metric twice. Malformed, future, full, or unavailable receipt storage fails closed without repairing bytes or adding date/product data to the event payload.

## Date, Owner, And Recovery Contract

- One shared routine-phase store reacts at 17:00, local midnight, foreground, time-zone changes, and a bounded active-clock check.
- The local-date coordinator is reconciled synchronously before a cross-day phase publication. Today withholds routine controls whenever the clock identity and route query boundary disagree, preventing a new AM/PM surface from writing into the previous day's key.
- Completion read/write work is owner-generation bound. An old-scope retry cannot erase a newer scope's failure, and delayed post-reservation haptic/review/cycle effects are suppressed after owner replacement.
- Completion read or write uncertainty replaces the routine with the named `Check-ins unavailable` recovery surface; unreadable bytes are not represented as `0 of N` or reset.
- Recommendation dismissal persistence is single-flight outside the gap-prompt lifetime. Route-owned success/failure publication survives prompt/query/phase remounts, while stale-owner settlement publishes no callback, cache update, or reset.
- The private-data registry now contains 47 exhaustive entries, including the owner-bound `onskin.cycleNightAnalytics.v1` receipt ledger and its export/cleanup contract.

## Commands And Results

| Command or review                                                    | Result                                        |
| -------------------------------------------------------------------- | --------------------------------------------- |
| Focused Today/source/registry/recovery matrix                        | Pass, 22 files / 260 tests                    |
| `npm --workspace apps/mobile test`                                   | Pass, 300 files / 3,789 tests                 |
| `npm test`                                                           | Pass, 300 files / 3,789 tests                 |
| `npm run typecheck`                                                  | Pass, 2 workspaces                            |
| `npm run lint`                                                       | Pass, 2 workspaces, zero warnings             |
| `git diff --check` and staged-scope audit                            | Pass; unrelated dirty-worktree files excluded |
| Final adversarial audit (four P2 findings) plus date/phase re-review | All findings closed; final re-review clean    |

## Human-Simulated Expo-Web Evidence

Host: Windows development workspace
Surface: headless Chrome/Edge Expo web, plus in-app Browser recovery verification
Viewport: 390 x 844 supported-phone class
Maintained evidence: `test-results/human-e2e/2026-07-15/today-opt114-final/`

Fresh post-audit happy-path actions and observations:

1. Completed the maintained onboarding flow through three visible product additions, Explore first, generated Plan, and Start today.
2. Captured one AM row rectangle, dispatched two touch sequences against that same rectangle while a bounded 1,200 ms durable-commit fixture remained pending, and verified `21a-today-am-saving.json` reported `SAVING`, a disabled 122 px checkbox target, zero UI issues, and zero horizontal overflow.
3. Verified AM reached exact `1 of 1`, activating the completed row did not remove it, and a full page reload retained exact `1 of 1`.
4. Repeated the same-rectangle pending-write interaction for PM and verified exact `1 of 1` after settlement.
5. Every audited checkpoint reported zero horizontal overflow. The 12 captured warning/error entries were limited to the explicitly allowed local placeholder configuration and Expo web-notification warnings; no disallowed browser problem remained.

Current recovery actions and observations:

1. Opened `/today?routine=AM` in the in-app Browser with `EXPO_PUBLIC_E2E_COMPLETION_STORAGE_FAILURE=today_once`.
2. Confirmed `Check-ins unavailable`, the statement that history was not reset, and one uniquely named `Retry loading check-ins` action.
3. Activated Retry and reached the truthful empty-routine state in place after the one-shot read recovered.

The in-app recovery DOM snapshots and terminal output remain in the Codex task transcript. The maintained screenshot/JSON/report folder is intentionally local evidence and is not presented as native iPhone proof.

## Verification Boundary And Next Action

OPT-114 remains `investigating` because the plan requires all four route families and measured native comparison. Next:

1. Build the Progress route model around one entitlement/photo/lock/storage/trend source graph and release its image-bearing subtree on blur.
2. Build Shelf list/detail/archive route models and isolate list/filter/editor state from shared domain observers.
3. Capture immutable pre/post native QueryObserver counts, React commit counts/flamegraphs, interaction latency, long-task, frame, and memory evidence in production-style Hermes builds on the supported device scope.
4. Retain native completion latency markers for median and stress completion logs and verify foreground, travel, DST, and midnight behavior on device.

Rollback this checkpoint if a shared source weakens fail-closed safety, a durable completion can be lost by reverse publication, a new owner/date can receive a stale result, cycle-night analytics can duplicate, or native profiling shows a material regression.
