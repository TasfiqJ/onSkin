# E2E Bug Report: Ask long-history scroll commit storm

Severity: Medium
Surface: Expo web
Environment: Windows development workspace, Expo web, 390 x 844 viewport override
Feature: Ask virtualized history
Date: 2026-07-15
Tester: Codex in-app Browser

## Reproduction Steps

1. Seed the development-only 100-turn Ask history.
2. Submit a draft while the virtualized list is still positioned at the oldest turn.
3. Keep a pending `scrollToEnd` request active across every `onContentSizeChange` until the appended row becomes viewable.

## Expected Result

Submission should publish once without forcing the recycler to walk and render the entire unmeasured backlog.

## Actual Result

The repeated content-size chase produced 183 Ask-history commits and 123 row renders within the first second, reached only about turn 59, and then detached the development browser webview before the appended row became visible.

## Evidence

- Screenshot: Not retained; the failure was a commit/render loop rather than a stable visual state.
- Video: Not captured.
- Trace: Content-free profiler counters in the Codex task transcript.
- Logs: Browser attachment ended during the loop; no app exception preceded it.
- UI snapshot: Intermediate snapshot reached fixture turns 50-59 after one second.
- Terminal transcript: Expo remained running without a Metro exception.

## Frequency

- Always with the intermediate repeated-scroll implementation and the 100-turn fixture positioned at the oldest turn.

## Scope

- Affected route/screen: `/ask`
- Affected account or fixture: Development-only 100-turn history fixture
- External service involved: None
- Destructive action involved: No

## Suspected Cause

Variable-height `FlatList` rows beyond the measured window do not have a complete end offset. Reissuing `scrollToEnd` for every incremental content-size change forced successive recycler batches to mount and commit.

## Implemented Containment

Keep the complete logical transcript in route state, but present only the latest 16 chronological messages to `FlatList` after an append. An exact-start interaction prepends one 16-message page. Latest-edge work is limited to eight distinct positive content-height measurements, while duplicate measurements and transient nonpositive measurements do not consume the budget. A transient zero-height measurement resets height deduplication and never becomes a literal scroll-to-top command.

## Verification Flow After Fix

1. Reload `/ask` with 100 seeded turns and confirm only a bounded visible window mounts.
2. Type a 158-character draft and compare content-free history counters.
3. Dispatch keyboard Enter and visible Send together, then verify one accepted turn, a 200-to-202 logical-message change, and a cleared draft.
4. Confirm the browser remains attached and no error or dialog occurs.

## Predecessor Post-Fix Evidence

- Screenshot: Captured and visually inspected in the Codex task transcript.
- Video: Not captured.
- Trace: 8-to-8 history commits and 12-to-12 row renders while typing; submission settled at 10 history commits and 12 row renders.
- Logs: Zero browser errors; three expected development warnings only.
- UI snapshot: Six fixture turn labels mounted from 200 logical messages.
- Terminal transcript: Expo stayed responsive through submission, whitespace rejection, and recycler-state checks.

This predecessor evidence was captured before the bounded chronological-page implementation and is retained only to show the failed implementation history. It is not the final checkpoint measurement.

## Final Bounded-Page Verification

The final run cold-started Expo web with `EXPO_PUBLIC_E2E_ASK_HISTORY_TURNS=100`, used a 390 x 844 viewport override (390 x 845 observed), and opened a fresh browser tab after the code stopped changing.

- Initial route state: 200 logical messages; 16 active `FlatList` messages; six history commits; 16 row renders; latest-edge distance 0.388 px.
- Rapid input: an exact sanitized 158-character draft produced zero accepted-turn, logical-message, history-commit, row-render, or active-message deltas.
- Duplicate-submit boundary: near-simultaneous keyboard Return plus visible Send produced one accepted turn, two logical messages, three history commits, two row renders, and a cleared draft.
- Delayed-collapse regression: 24 samples at 250 ms intervals covered six seconds after submission. Every sample retained 202 logical messages, 16 active messages, nine history commits, and 18 row renders. No sample rebounded to the top; `scrollTop` stayed 3262.136 px with an absolute latest-edge error of 0.136 px.
- Final-row geometry: the submitted user row remained inside the history viewport at y=328.792..436.833 px; the latest report control remained inside it at y=542.718..590.716 px.
- Whitespace: a three-space draft remained present and published no turn or messages.
- Recycling: reporting the latest answer produced one acknowledgement. After older-page growth and returning to the bottom, the same acknowledgement and submitted row were present.
- Older-page growth: one automatic prepend changed active messages from 16 to 32 without changing the 202-message logical transcript. The prior first active fixture row settled at y=182.100 px while the history viewport began at y=55.977 px; precise anchor retention is therefore not claimed.
- Geometry: the input and Send control were 47.998 px high; the Send control was 47.998 px wide; horizontal overflow was zero.
- Runtime: no JavaScript dialog or Metro app exception occurred. Expected development warnings were limited to placeholder Supabase configuration and unsupported web notification-listener behavior.

No screenshot or video was retained. The raw sanitized measurements are stored under `test-results/human-e2e/2026-07-15/ask-100-turn-keystroke-current/` and do not contain the draft or answer text.

## Remaining Risk

- Untested branches: Native keyboard, precise prepend anchoring, repeated/all-page traversal, mixed-height history, and long-history auto-scroll from the oldest position.
- Missing fixtures: Production-style Hermes frame/memory trace and native accessibility traversal.
- Follow-up needed: Replace the early two-frame/average prepend anchor with measured/native-maintained position handling, then measure scroll behavior on the oldest supported iOS and Android devices before marking OPT-105 or OPT-115 verified.
