# E2E Bug Report: Recommendations short-phone card clipping

Severity: Medium
Surface: Expo web
Environment: 320 x 480 phone viewport, local Expo web
Feature: Personalized recommendations
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start the mobile app on Expo web.
2. Open `/recommendations` at a 320 x 480 phone viewport.
3. Inspect the visible recommendation card controls in the first viewport.

## Expected Result

Visible recommendation cards should be fully readable and tappable before their evidence and `See how` rows. Back and Preferences should remain 44 pt or larger, and the route should have no horizontal overflow.

## Actual Result

The second recommendation card was visible but clipped below the viewport before the full evidence and `See how` row. The pre-fix geometry snapshot recorded the card as a clipped visible control with only 114 px of its 171 px height visible.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-480-sweep/recommendations.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-480-sweep/recommendations.json`

## Frequency

- Always on the tested 320 x 480 For You hub state.

## Scope

- Affected route/screen: `/recommendations`
- Affected account or fixture: Local default recommendation fixture
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The existing compact hub density targeted shorter 568 px phones but still left the 320 x 480 viewport with too much heading, card padding, title leading, and evidence-row spacing to show the second visible recommendation card cleanly.

## Minimal Fix Recommendation

Add a sub-520 px For You hub density that trims heading, card, copy, and evidence-row spacing while preserving readable labels and 44 pt or larger navigation controls.

## Verification Flow After Fix

1. Reopen `/recommendations` at 320 x 480.
2. Confirm Back and Preferences remain visible 44 pt or larger.
3. Confirm visible recommendation controls are not clipped before their evidence and `See how` rows.
4. Confirm horizontal overflow is zero and no JavaScript dialog appears.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/recommendations-short-phone-480-card-fit/recommendations.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/recommendations-short-phone-480-card-fit/recommendations.json`
- Report: `test-results/human-e2e/2026-07-08/recommendations-short-phone-480-card-fit/report.md`

## Remaining Risk

- Untested branches: Native iOS/Android safe-area, Dynamic Type, and screen-reader pass.
- Missing fixtures: Durable native visual regression for the For You hub.
- Follow-up needed: Promote this shortest-phone hub case into the eventual native compact-phone E2E suite.
