# Ask 100-Turn Keystroke Checkpoint

Date: 2026-07-15 (America/Toronto)

Branch: `optimization`

Implementation SHA: `8bc2c14a64c8c05c28602f6220dfbf678b1faf90`

Evidence class: `command` and web `e2e`

This sanitized checkpoint covers the Ask portions of OPT-105 and OPT-115. It proves a bounded chronological presentation window, isolated composer typing, duplicate-submit suppression, and a six-second Expo-web regression for the observed zero-height scroll rebound. It does not verify OPT-105 or OPT-115, native performance, precise prepend anchoring, analytics transport, or the remaining OCR/search/note/feedback input work.

## Baseline, Hypothesis, And Implementation

The Ask route previously rendered every message through a `ScrollView`, so a growing transcript and composer state shared one render path. An intermediate `FlatList` implementation then chased incremental content-size changes through the complete 100-turn fixture, producing 183 history commits and 123 row renders in one second before the development webview detached.

The implemented slice:

- keeps all logical messages in route JavaScript state;
- passes only the latest 16 chronological messages to `FlatList` after load or append;
- prepends one 16-message presentation page at the exact start;
- uses stable domain IDs, a memoized row, stable render/key callbacks, and parent-owned report state;
- keeps the controlled composer in a sibling leaf outside the history `Profiler`;
- clears a synchronous draft ref before publication so Return plus Send cannot publish twice;
- limits latest-edge work to eight distinct positive content heights;
- rejects transient nonpositive content heights, resets height deduplication after collapse, and never converts height zero into a scroll-to-top command;
- exposes development-only, content-free counters and a capped deterministic 100-turn fixture.

This is presentation paging, not storage pagination. No bounded total JavaScript-memory claim is made because the complete transcript remains in route state.

## Environment And Artifact Identity

| Field | Value |
| --- | --- |
| Host | Windows development workspace |
| Surface | Expo web through the Codex in-app Browser |
| Build mode | Development (`expo start --web --clear`) |
| Viewport | 390 x 844 requested; 390 x 845 observed |
| Dataset | Deterministic development fixture, 100 turns / 200 messages |
| Network | No external service required for the tested deterministic Ask path |
| Device/OS class | Desktop-hosted web emulating a supported-phone viewport; not a physical mobile device |
| Thermal/power/storage state | Not available for web development evidence |
| Raw sanitized artifact | `test-results/human-e2e/2026-07-15/ask-100-turn-keystroke-current/metrics.json` |

No screenshot, video, browser-console capture, private-content artifact, or native trace was retained.

## Human-Simulated Action Script And Results

1. Cold-start Expo web with `EXPO_PUBLIC_E2E_ASK_HISTORY_TURNS=100` and open `/ask` in a fresh browser tab.
2. Wait for the latest chronological page and lock two identical content-free baselines.
3. Focus the named Ask textbox and rapidly enter an exact sanitized 158-character draft.
4. Dispatch keyboard Enter and the visible Send control together.
5. Sample history metrics every 250 ms for six seconds.
6. Try a three-space draft with Enter.
7. Report the latest answer, load one older presentation page, return to the bottom, and check the acknowledgement.
8. Inspect phone-width control geometry, overflow, dialog state, and Metro output.

| Observation | Before | After / result |
| --- | ---: | ---: |
| Logical messages during typing | 200 | 200 |
| Active `FlatList` messages during typing | 16 | 16 |
| History commits during typing | 6 | 6 |
| Row renders during typing | 16 | 16 |
| Accepted turns during typing | 0 | 0 |
| Exact draft length | 0 | 158, exact |
| Near-simultaneous accepted-turn delta | — | 1 |
| Near-simultaneous logical-message delta | — | 2 |
| Submission history-commit delta | — | 3 |
| Submission row-render delta | — | 2 |
| Draft after accepted submit | 158 | 0 |
| Whitespace publication delta | — | 0 |
| Active messages after one older-page prepend | 16 | 32 |
| Logical messages after prepend | 202 | 202 |
| Report acknowledgement after recycle/return | 1 | 1 |

## Delayed-Collapse Regression

All 24 post-submit samples were identical:

- `scrollTop`: 3262.135986328125 px;
- `scrollHeight`: 3939 px;
- client height: 677 px;
- logical messages: 202;
- active messages: 16;
- history commits: 9;
- row renders: 18;
- accepted turns: 1.

No sample had a top rebound while content exceeded the viewport. The maximum absolute latest-edge distance was 0.135986328125 px. At the end of six seconds, the submitted row and latest answer remained mounted and inside the history viewport.

These are raw bounded samples, not an official latency distribution. Because all samples were identical, p50, p95, and maximum `scrollTop` are the same value; no performance threshold was approved or evaluated.

## Paging And Geometry Boundary

One exact-start interaction grew the active presentation window from 16 to 32 while retaining all 202 logical messages. The prior first active fixture row settled at y=182.100 px while the history viewport began at y=55.977 px. That measured displacement means this checkpoint does not claim precise anchor retention. Repeated paging, oldest reach, mixed-height correctness, blank avoidance, and native maintained-position behavior remain open.

The final phone-width geometry was:

- history viewport: y=55.977..732.737 px;
- submitted row after the six-second check: y=328.792..436.833 px;
- latest report control: y=542.718..590.716 px;
- input: 254.384 x 47.998 px;
- Send: 47.998 x 47.998 px;
- horizontal overflow: 0 px;
- JavaScript dialogs: 0.

Metro reported no app exception. Expected warnings were limited to placeholder Supabase configuration and the unsupported web notification-listener notice. Browser console errors were not captured and are not claimed as zero.

## Commands And Reviews

| Command or review | Result |
| --- | --- |
| Focused latest-scroll/route contracts | Pass, 2 files / 26 tests |
| Full Ask feature suite | Pass, 17 files / 252 tests |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm run lint` | Pass, 2 workspaces, zero warnings |
| `npm test` | Pass, 309 files / 3,854 tests |
| `git diff --check` | Pass |
| Independent rebound-fix review | No remaining P0/P1 blocker for this scoped web checkpoint; prepend anchoring retained as P2/open risk |

## Privacy, Tradeoffs, And Rollback

Only deterministic fixture cardinality, content-free counters, lengths, and geometry are stored. No draft text, answer text, product/routine/health content, account data, credentials, or stable personal identifiers are retained.

Tradeoffs:

- presentation paging reduces mounted history but does not bound route-state memory;
- development diagnostics add counters only under the development gate and are no-ops in production;
- the capped fixture proves cardinality and window mechanics but is not representative of every variable-height transcript;
- web behavior cannot substitute for release Hermes frame, memory, keyboard, or accessibility proof.

Rollback this slice if accepted input is lost or duplicated, whitespace publishes, report state disappears after recycling, a transient collapsed size can scroll to the top, latest-edge work exceeds its bounded retry policy, stable IDs are lost, or production builds expose the development fixture/diagnostics.

## Status And Next Actions

OPT-105 remains `investigating`: Ask now has bounded active presentation and stress behavior evidence, but representative Shelf/archive/Progress/Ask native scroll, frame, memory, focus, and accessibility traces are still required.

OPT-115 moves from `not-started` to `investigating`: Ask composer isolation is implemented and web-checked, while OCR ingredient input, catalog search, Progress notes, You feedback, combined draft/private-recovery, analytics transport, native keyboard, and production Hermes profiling remain open.

Next actions:

1. Replace the early two-frame/average prepend anchor with a measured or native maintained-position design and verify repeated/mixed-height pages.
2. Isolate/defer OCR parsing and catalog search result work without delaying raw input.
3. Isolate Progress note and You feedback mutation state from their heavy route subtrees.
4. Capture release-style native keystroke commits/durations, frame pacing, memory, keyboard behavior, and VoiceOver/TalkBack on supported device classes.
