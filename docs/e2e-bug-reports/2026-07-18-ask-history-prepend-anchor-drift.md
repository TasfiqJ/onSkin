# E2E Bug Report: Ask History Prepend Lost The Visible Anchor

- Severity: High
- Surface: Expo web
- Environment: Windows-hosted Expo development web, 390 x 844 requested viewport
- Feature: Ask chronological history pagination
- Date: 2026-07-18
- Tester: Codex in-app Browser

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_ASK_HISTORY_TURNS=100`, open `/ask`, and submit one sanitized question so the transcript contains 202 logical messages.
2. Scroll the latest 16-message page to its exact start so the preceding page is inserted.
3. Observe the row that was first visible before insertion.

## Expected Result

The previously visible first row remains at the same viewport position while the older mixed-height page is inserted above it.

## Actual Result

The initial content-height-delta implementation restored by about 254 px, the current React Native Web virtual-spacer growth, instead of the real inserted page height of about 4,160 px. The prior anchor disappeared, and the viewport jumped to an earlier group of rows.

## Evidence

- Screenshot: No pre-fix screenshot retained; final screenshots are in `test-results/human-e2e/2026-07-18/ask-history-prepend-anchor-current/`.
- Video: Not captured.
- Trace: Content-free browser geometry and diagnostics were observed during the failed run.
- Logs: No app exception; expected placeholder configuration warnings only.
- UI snapshot: The failed run showed fixture turns 86-93 while the prior turn-94 anchor was absent.
- Terminal transcript: Expo development server remained healthy.

## Frequency

- Always with the initial aggregate-content-height implementation and the 100-turn mixed-height fixture.

## Scope

- Affected route/screen: `/ask`
- Affected account or fixture: Development-only deterministic 100-turn Ask fixture
- External service involved: None
- Destructive action involved: None

## Suspected Cause

React Native Web `VirtualizedList` reports aggregate content-size changes that include a changing virtual spacer estimate. That aggregate delta is not the physical height of the page just inserted, so it cannot preserve a mixed-height visible anchor precisely.

## Minimal Fix Recommendation

On web, record the exact IDs inserted by one page, wait for every inserted wrapper's positive `onLayout` height, sum only those measurements, and restore `baselineScrollOffset + measuredPrependHeight`. Reissue the same target through a short bounded settlement window if virtual-spacer layout drifts. On native, use `maintainVisibleContentPosition` instead of duplicating the web measurement path.

## Verification Flow After Fix

1. Repeat the 202-message mixed-height fixture and traverse every older-page boundary to visible start index zero.
2. At each boundary, verify the expected start index, unique prior anchor, settled correction, stable logical cardinality, and nonblank viewport.
3. At the oldest row, type and submit with keyboard Return, then verify zero typing-induced history work and correct latest-edge recovery.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-18/ask-history-prepend-anchor-current/oldest-turn.png`
- Screenshot: `test-results/human-e2e/2026-07-18/ask-history-prepend-anchor-current/post-keyboard-latest.png`
- Video: Not captured.
- Trace: `test-results/human-e2e/2026-07-18/ask-history-prepend-anchor-current/metrics.json`
- Logs: No app exception observed in Metro or app browser logs.
- UI snapshot: All 12 expected start indexes matched; oldest row visible; no blank viewport.
- Terminal transcript: Focused 39 tests, full 4,098 tests, typecheck, and zero-warning lint passed.

## Remaining Risk

- Untested branches: Native `maintainVisibleContentPosition`, VoiceOver, Dynamic Type, native keyboard interruption, background/foreground, and physical-device memory/frame behavior.
- Missing fixtures: Signed supported-iOS stress run.
- Follow-up needed: Capture representative native Shelf/archive/Ask/Progress stress-list evidence before OPT-105 verification.
