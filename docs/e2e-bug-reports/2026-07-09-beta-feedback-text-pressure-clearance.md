# E2E Bug Report: Beta feedback text-pressure clearance

Severity: Medium
Surface: Expo web
Environment: Headless Chrome via `npm run e2e:text-pressure`, 200% text pressure
Feature: Settings beta feedback categorized support handoff
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit for `/settings/beta-feedback`.
2. Use `TEXT_PRESSURE_SCALE=2`, `TEXT_PRESSURE_VIEWPORT_WIDTH=360`, and `TEXT_PRESSURE_VIEWPORT_HEIGHT=640`.
3. Inspect the generated UI snapshot and route geometry.

## Expected Result

The beta-feedback route should keep visible controls fully readable, at least 44 px tall, center-hit-testable, and free of bottom-edge clipping on supported phone viewports.

## Actual Result

The third issue-type row entered the bottom edge as a 4 px visible target on the 360 x 640 support floor. Follow-up compact iPhone and modern-phone checks reproduced the same class of clipped next-row target before the high-text-pressure density was tightened.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-360-640-current/settings-beta-feedback.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-360-640-current/settings-beta-feedback.json`
- Failure summary: `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-360-640-current/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always on the focused 360 x 640 / 200% route pass before the fix.

## Scope

- Affected route/screen: `/settings/beta-feedback`
- Affected account or fixture: local Expo web route fixture
- External service involved: no live support service required
- Destructive action involved: none

## Suspected Cause

The normal explanatory intro card and dense category list consumed too much first-viewport height under high text pressure, leaving the next category row partially visible at the bottom edge.

## Minimal Fix Recommendation

Collapse the beta-feedback intro copy under high text pressure, use compact row density without arbitrary blank-gap offsets, and keep visible controls at least 44 px tall and center-hit-testable on supported compact phone viewports.

## Verification Flow After Fix

1. Re-run `/settings/beta-feedback` at 360 x 640 / 200%.
2. Re-run compact and supported-phone spot checks at 360 x 740, 375 x 667, 390 x 844, 412 x 915, and 430 x 932.
3. Confirm zero failed routes, no sub-44 visible controls, no blocked center hit-tests, no horizontal overflow, and no oversized blank layout gaps in the final screenshots.

## Post-Fix Evidence

- 360 x 640: `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-360-640-postfix8/`
- 360 x 740: `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-360-740-postfix5/`
- 375 x 667: `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-375-667-postfix8/`
- 390 x 844: `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-390-844-postfix7/`
- 412 x 915: `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-412-915-postfix5/`
- 430 x 932: `test-results/human-e2e/2026-07-09/text-pressure-200-beta-feedback-430-932-postfix5/`

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver/TalkBack, and external support-link handoff still require device QA.
