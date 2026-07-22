# E2E Bug Report: Shelf filter offsets reset after collection-scale switching

Severity: Medium

Surface: Expo web

Environment: Development bundle at 390 x 844 with 100 deterministic active Shelf rows and 100 archive rows

Feature: Shelf virtualized-list filter state retention

Date: 2026-07-21

Tester: Codex

## Reproduction Steps

1. Open Shelf with the bounded 100-row development stress fixture.
2. Traverse All to the final row and record its `16,122` px scroll offset.
3. Switch to Actives, scroll to an independent middle anchor, then switch to Expiring and scroll to another anchor.
4. Switch back to All.

## Expected Result

Each filter restores its last independent scroll boundary without remounting the entire list, blanking the viewport, or changing the stored offset during the programmatic restoration.

## Actual Result

The first run returned All to scroll offset `0` instead of `16,122`. Later adversarial reruns exposed two related races: a queued outgoing-list scroll event could overwrite Expiring after the next filter committed, and Archive Back could clamp the saved bottom offset to the height of an incompletely rebuilt recycler window.

## Evidence

- Failed harness assertion: `All offset was not restored (0 vs 16122)`.
- Pre-failure screenshots: `01-shelf-top.png` and `02-shelf-bottom.png` in `test-results/human-e2e/2026-07-21/shelf-archive-stress-current/`.
- The same run traversed all 100 All rows after the harness was corrected to use viewport-sized recycler steps, so this failure occurred after complete list traversal rather than on fixture startup.

## Frequency

- Always in the first collection-scale filter restoration run.

## Scope

- Affected route/screen: Shelf tab `/shelf`.
- Affected account or fixture: deterministic development-only row fixture; no account or private product content.
- External service involved: None.
- Destructive action involved: None.

## Suspected Cause

The route retained numeric offsets per filter but depended on the `contentOffset` prop to apply every filter change. That prop establishes the initial offset; it is not a reliable controlled-scroll mechanism for an already-mounted virtualized list. Scroll callbacks also lacked an outgoing-filter identity fence, and a numeric bottom offset was treated as stable while the variable-height list was rebuilding.

## Minimal Fix Applied

The route keeps one `FlatList`, attaches a ref, and restores ordinary filter offsets with `scrollToOffset` after the filtered collection commits. It synchronously fences all transition writes, rejects callbacks whose captured filter no longer matches the current filter, and retains only one filter enum plus three numeric offsets outside the focus-gated private observer. Archive navigation records a semantic end-boundary; return repeatedly uses `scrollToEnd` while content size settles and releases the fence only when the stable viewability callback reports the final row. No filter key remount or unmeasured native window/clipping parameter was added.

## Verification Flow After Fix

1. Repeat full 100-row traversal.
2. Set distinct All, Actives, and Expiring offsets.
3. Cycle through the filters twice and compare stable visible-row anchors; retain raw offsets for diagnostic comparison because variable-height recycler estimates can settle to different pixel totals.
4. Open the 100-row archive through the Shelf footer, traverse it, press Back, and verify the All boundary remains restored.
5. Confirm zero blank intermediate viewports, horizontal overflow, dialogs, and unexpected browser warnings/errors.

## Post-Fix Evidence

- Pass at 390 x 844 with 100 active Shelf rows and 100 archived rows.
- Exact traversal: All 100/100, Actives 34/34, Expiring 40/40, Archive 100/100, with no blank sampled viewport.
- Independent filter anchors restored; Archive Back returned with row 0100 visible at scroll offset `16,132`.
- Zero horizontal overflow, zero dialogs, and zero unexpected browser warnings/errors.
- Screenshots `01` through `05`, raw content-free metrics, logs, and the run report are in `test-results/human-e2e/2026-07-21/shelf-archive-stress-current/`.

## Remaining Risk

- Native iOS list settlement, repeated rapid touch flings, memory/frame behavior, Dynamic Type, and VoiceOver focus remain physical-device gates.
