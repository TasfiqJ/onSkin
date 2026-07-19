# Ask History Prepend-Anchor Checkpoint

Date: 2026-07-18 (America/Toronto)

Branch: `optimization`

Implementation SHA: `401f506f1e4f4931cca41c3cb6b2cc0cf38bf259`

Evidence class: `command` and web `e2e`

Status: OPT-105 remains `investigating`; the Ask web prepend-anchor slice is implemented and human-checked, while representative signed native stress-list evidence remains open.

## Baseline, Hypothesis, And Implementation

The prior Ask checkpoint activated only the latest 16 chronological messages and could add one older 16-message presentation page, but it did not preserve a precise visible anchor. The first attempted fix used aggregate content-height growth. Human E2E showed React Native Web's virtual spacer can grow by a value unrelated to the physical mixed-height page, so that approach lost the prior row. The failed behavior and final fix are recorded in `docs/e2e-bug-reports/2026-07-18-ask-history-prepend-anchor-drift.md`.

The committed design:

- records the exact stable message IDs inserted by the current page;
- on web, sums only positive per-row layout measurements for those IDs;
- restores `baseline scroll offset + exact inserted-page height` without an average-row estimate or `scrollToIndex` walk;
- reissues the same exact target during a 100 ms quiet period, capped at eight drift corrections;
- uses native `maintainVisibleContentPosition` exclusively off web;
- retains stable keys, memoized rows, a 16-message page size, and a bounded latest-edge retry;
- exposes content-free development diagnostics for page start, adjustment count, anchor activity, and target offset;
- extends the capped 100-turn fixture with deterministic sanitized mixed-height rows.

This remains presentation paging rather than storage pagination. The complete logical transcript remains in JavaScript route state.

## Environment And Artifact Identity

| Field | Value |
| --- | --- |
| Host | Windows development workspace |
| Surface | Expo web through the Codex in-app Browser |
| Build mode | Development (`expo start --web --clear`) |
| Viewport | 390 x 844 requested; 390 x 845 observed |
| Dataset | Deterministic 100-turn mixed-height fixture plus one accepted turn: 202 logical messages |
| Network | No external service required for deterministic Ask |
| Device/OS class | Desktop-hosted web emulating a supported-phone viewport |
| Thermal/power/storage state | Not available for web development evidence |
| Raw sanitized metrics | `test-results/human-e2e/2026-07-18/ask-history-prepend-anchor-current/metrics.json` |
| Visual checkpoints | `oldest-turn.png`; `post-keyboard-latest.png` in the same evidence folder |

## Human-Simulated Action Script

1. Cold-start Expo web with `EXPO_PUBLIC_E2E_ASK_HISTORY_TURNS=100` and open `/ask` on a clean local origin.
2. Submit one sanitized question, producing 202 logical messages with the latest 16 active.
3. At each exact list start, trigger one older presentation page and wait for the anchor diagnostic to settle.
4. Record expected/actual start index, active/logical cardinality, unique prior-anchor geometry, target offset, observed scroll position, and blank state.
5. Repeat through all 12 boundaries until the oldest row is visible at start index zero.
6. At the oldest boundary, type a sanitized 51-character question and compare history commits, row renders, and logical cardinality before and after typing.
7. Submit with keyboard Return and verify exactly one pair, cleared draft, latest 16-message presentation, latest-edge settlement, phone geometry, overflow, dialogs, and logs.

## Pagination And Anchor Results

Every expected visible start index matched exactly:

`170, 154, 138, 122, 106, 90, 74, 58, 42, 26, 10, 0`

| Measurement | Result |
| --- | ---: |
| Older-page boundaries | 12 / 12 matched |
| Logical messages throughout traversal | 202 |
| Prior anchor cardinality | 1 at every boundary |
| Settled anchor diagnostic | 12 / 12 inactive after settlement |
| Prior-anchor top delta, minimum | 20.388 px |
| Prior-anchor top delta, maximum | 21.632 px |
| Top-delta range across traversal | 1.244 px |
| Maximum absolute commanded-offset error | 0.428 px |
| Blank viewport count | 0 |

At start index zero, scroll top was zero, the oldest row was visible 21.996 px below the history viewport top, and one copy of that row existed. Although the presentation window then referenced all 202 messages, only eight assistant report controls were mounted, implying about 16 mounted message rows near the viewport. This is a recycler observation, not a JavaScript-memory bound.

## Keyboard And Geometry Results

Typing the 51-character sanitized draft at the oldest boundary left history commits at 90, message renders at 359, and logical messages at 202. Keyboard Return then produced 204 logical messages, cleared the draft, reset the active presentation to the latest 16 messages at start index 188, and settled within 0.583 px of the latest edge.

Input and Send remained 47.998 px tall; Send was 47.998 px wide; the input was 254.384 px wide. Horizontal overflow and JavaScript dialog counts were both zero. No app exception was observed in Metro or browser logs. Placeholder Supabase configuration and unsupported web-notification warnings were expected. One clipboard-bridge error belonged to the browser automation driver and is excluded from app results.

## Commands And Reviews

| Command or review | Result |
| --- | --- |
| Focused Ask history/fixture/route suite | Pass, 3 files / 39 tests |
| `npm run typecheck` before final refinement | Pass, 2 workspaces |
| Mobile typecheck after final refinement | Pass |
| `npm run lint` after final refinement | Pass, 2 workspaces, zero warnings |
| `npm test` | Pass, 344 files / 4,098 tests |
| `git diff --check` | Pass |
| Independent P0/P1 review | No remaining P0/P1 for the measured-row web design; native proof retained as an explicit gate |

## Privacy, Tradeoffs, And Rollback

Only deterministic fixture cardinality, opaque turn numbers, content-free counters, geometry, and two sanitized fixture screenshots are retained. No real question, answer, account, product, health, credential, or stable personal identifier appears in the packet.

Tradeoffs:

- web row wrappers publish layout measurements only in development-compatible component behavior, while native relies on the platform-maintained anchor;
- exact page restoration waits until every inserted row has a positive measurement;
- the bounded settlement loop can issue several identical nonanimated offsets while the web virtual spacer stabilizes;
- active presentation cardinality grows when traversing to the oldest row, even though mounted recycler rows remain near the viewport;
- web behavior cannot substitute for production Hermes frame, memory, keyboard, accessibility, or lifecycle evidence.

Rollback this slice if a prior anchor disappears or duplicates, start indexes skip/repeat, any page blanks, measured correction becomes unbounded, typing commits the history tree, submission duplicates or loses a turn, latest recovery rebounds, native maintained-position behavior regresses, or production exposes content-bearing diagnostics.

## Status And Remaining Gates

OPT-105 remains `investigating`. Ask precise, repeated, mixed-height, oldest-page, recycler, and keyboard behavior is now implemented and checked on Expo web. Verification still requires representative signed supported-iOS Shelf, archive, Ask, and Progress stress-list traces covering frame pacing, memory, focus/background lifecycle, native keyboard, Dynamic Type, VoiceOver, and the supported oldest device class.

No additional decision-free repository implementation slice was identified after this checkpoint. The remaining optimization plan gates depend on approved photo-v2/cache/thumbnail and startup-shield decisions, hosted Supabase/provider rehearsals, retention/abuse/scheduler ownership, approved budgets and signed release baselines, or physical-device/accessibility/lifecycle evidence.
