# Ask Route View-Model Checkpoint

Date: 2026-07-15 (America/Toronto)
Branch: `optimization`
Implementation SHA: `e019c5f2e99107362751027cb4ea04f7126c9c1b`
Evidence class: `command`, `decision`, and web `e2e`

This sanitized checkpoint covers the Ask slice of OPT-114. It records source ownership, retry behavior, automated gates, and human-simulated Expo-web behavior. It does not claim native performance verification, a measured commit-duration improvement, a 100-turn history run, or completion of the Today, Progress, and Shelf slices.

## Baseline, Hypothesis, And Result

The Ask route previously mounted independent Shelf and profile observers directly and again through `usePlan()` and `useRecommendations()`. TanStack Query can deduplicate same-key fetches, but every call still creates an observer, subscription callback, result object, and React update path. Plan derivation also ran during hook execution instead of being memoized across unchanged source snapshots.

The implementation makes Ask the owner of one Shelf and one profile result. It passes those exact results into `usePlanFromSources` and `useRecommendationsFromSources`; each derived hook retains only its independently keyed observer. Standalone wrappers preserve the original ownership contract for other callers.

| Source-level mounted work | Before | Current | Scope of proof |
| --- | ---: | ---: | --- |
| Shelf query observers | 3 | 1 | Exact hook composition and call-count test |
| Profile query observers | 3 | 1 | Exact hook composition and call-count test |
| Total query observers | 10 | 6 | Static mounted graph; all six current keys are unique |
| Local-date subscriptions | 4 | 2 | Static hook composition |
| Plan derivation per unchanged authoritative snapshot | Render-driven | Memoized | Dependency contract and source review |

These are source-level observer counts, not a native profiler measurement. No render-duration or frame-time improvement is claimed.

## Recovery And Compatibility Contract

- Ask retries a failing shared Shelf or profile observer exactly once at the route boundary.
- Source-aware Plan retries only routine order; source-aware Recommendations retries only recommendation inputs.
- Standalone Plan and Recommendations wrappers still retry every observer they own.
- Retry results carry `{ isError }`, including a persistent routine-order failure, so Ask's recovery notice cannot report false success while guidance remains unavailable.
- Loading, unavailable, corrupt, future, stale-owner, and pregnancy/safety behavior remains fail-closed because the same authoritative query results feed every derivation.

Two independent read-only reviews found no remaining actionable P0-P2 issue after routine-order result propagation and standalone-wrapper coverage were added.

## Commands And Results

| Command or review | Result |
| --- | --- |
| Focused Ask/Plan/Recommendations/conflict suite | Pass, 5 files / 36 tests |
| `npm test` | Pass, 296 files / 3,713 tests |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm run lint` | Pass, 2 workspaces, zero warnings |
| Scoped ESLint after the final test additions | Pass, zero warnings |
| `git diff --check` and staged-scope audit | Pass; nine implementation/test paths only |

## Human-Simulated Expo-Web Evidence

Host: Windows development workspace
Surface: Expo web through the in-app Browser
Viewport: 390 x 844 supported-phone class
Private fixture data: empty deterministic Shelf state only

Current happy-path actions and observations:

1. Opened `/ask` and confirmed the Ask RoutineKind heading, suggested prompts, named textbox, and Send control.
2. Entered a 158-character question rapidly. The textbox value matched the expected string exactly, with length 158.
3. Triggered keyboard Return and the visible Send control near-simultaneously. Both browser actions settled, while the rendered conversation contained exactly one submitted question and one deterministic answer; the input cleared.
4. Used the unique Back control and confirmed navigation to `/today`.

Current recovery actions and observations:

1. Restarted Expo with `EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE=once` and directly opened `/ask`.
2. Confirmed the named `Private data` / `Guidance unavailable` alert with one `Retry loading private data` button and `Back to Today`.
3. Activated the unique Retry control once. The deterministic Ask surface returned in place with its suggested prompts, textbox, Send control, and disclosure footer.

The browser happy-path run reported no unexpected errors. Expected development warnings were limited to placeholder Supabase configuration, web notification support, and a development multiple-client warning. Raw browser snapshots remain in the Codex task transcript; no private-content artifact was committed.

## Verification Boundary And Next Action

OPT-114 remains `investigating` because the plan names four route families and requires measured comparison. Next:

1. Build the Today route-owned Shelf/profile/Plan/Ramp/Cycle/Recommendations slice and exact completion-cache publication path.
2. Build Progress photo-source sharing and Shelf detail/list view-model boundaries.
3. Capture immutable pre/post QueryObserver counts, React commit counts/flamegraphs, interaction latency, long-task, frame, and memory evidence in production-style Hermes builds on supported iOS and Android device classes.
4. Seed and profile the required 100-turn Ask history, including native keyboard Return, visible Send, draft recovery, whitespace, and duplicate-submit cases.

Rollback this checkpoint if source sharing changes safety or example-plan semantics, any shared dependency is retried twice, a persistent owned-query failure is reported as success, or native profiling shows a material regression.
