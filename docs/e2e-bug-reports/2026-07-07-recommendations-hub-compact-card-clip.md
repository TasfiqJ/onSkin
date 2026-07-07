# E2E Bug Report: Recommendations hub card clips on compact phones

Severity: Medium
Surface: Expo web
Environment: Expo web, 320 x 568 and 390 x 568 phone viewports
Feature: Personalized Recommendations
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/recommendations`.
2. Set the viewport to 320 x 568.
3. Inspect the first viewport without scrolling.
4. Repeat at 390 x 568 to compare the compact card stack.

## Expected Result

Recommendation cards should feel intentional on compact phones. Visible cards should not be cut before their evidence and `See how` row, and tappable cards should keep 44 pt or larger touch geometry without horizontal overflow.

## Actual Result

Before the fix, the second visible recommendation card (`A ceramide moisturiser`) was cut below the 320 x 568 viewport before the evidence and `See how` row. The card was tappable, but the first viewport looked unfinished and hid the trust-building evidence row that the recommendations spec requires.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19126-current/320-recommendations.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19126-current/compact-route-audit-summary.json`

## Frequency

- Always on the tested 320 x 568 recommendation hub before the fix.

## Scope

- Affected route/screen: `/recommendations`
- Affected account or fixture: Local default recommendation fixture
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The For You hub used one card density for all phone heights. On 320 x 568, two full recommendation cards could not fit in the first viewport, so the second card was clipped before its footer row.

## Minimal Fix Recommendation

Apply a short-phone compact treatment to the For You hub: slightly tighter scroll start, card spacing, icon size, body line-height, and footer spacing while preserving full-card touch targets.

## Verification Flow After Fix

1. Reopen `/recommendations` at 320 x 568.
2. Confirm the first two recommendation cards are readable and the second card includes its evidence and `See how` row.
3. Confirm the second card bottom remains above the viewport edge with a visible buffer.
4. Repeat at 390 x 568 and confirm no horizontal overflow or sub-44 px controls.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/recommendations-hub-compact-card-fit/320-recommendations-hub.png`
- Screenshot: `test-results/human-e2e/2026-07-07/recommendations-hub-compact-card-fit/390-recommendations-hub.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/recommendations-hub-compact-card-fit/recommendations-hub-compact-summary.json`
- Focused test: `npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts`

## Remaining Risk

- Untested branches: Native iOS and Android Dynamic Type/text-scale rendering.
- Missing fixtures: Durable native visual regression for the recommendation hub.
- Follow-up needed: Add the recommendation hub compact state to the eventual native compact-phone E2E suite.
