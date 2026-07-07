# E2E Bug Report: Recommendations hub shows third-card sliver on compact phones

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
4. Record visible controls and partial visible tappable controls.

## Expected Result

The For You hub should feel intentionally composed on compact phones. The first viewport can show two complete recommendation cards, but it should not expose a tiny tappable sliver of the next card before the user scrolls.

## Actual Result

Before the fix, the first two recommendation cards were complete, but the third card (`A gentle cleanser`) entered the bottom of the 320 x 568 viewport with only 19 px visible. The route had zero horizontal overflow and valid tap targets, but the sliver made the hub look unfinished and created a weak scroll boundary on the first phone viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/current-compact-sweep-19128/recommendations.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/current-compact-sweep-19128/recommendations.json`
- Sweep summary: `test-results/human-e2e/2026-07-07/current-compact-sweep-19128/summary.json`

## Frequency

- Always on the tested 320 x 568 recommendation hub before the fix.

## Scope

- Affected route/screen: `/recommendations`
- Affected account or fixture: Local default recommendation fixture
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The earlier compact card-density fix made the first two cards fit, but the third card still started close enough to the viewport bottom that a small part of its tappable surface appeared before the user intentionally scrolled.

## Minimal Fix Recommendation

On narrow short-phone viewports, keep recommendation cards after the first two below the initial fold with a deliberate continuation gap while preserving the compact card density and full-card tap targets for the first two visible cards.

## Verification Flow After Fix

1. Reopen `/recommendations` at 320 x 568.
2. Confirm only the first two recommendation cards are visible in the initial viewport.
3. Confirm `overflowX` is zero, no visible controls are smaller than 44 px, and no partial small visible controls remain.
4. Repeat at 390 x 568.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/recommendations-hub-narrow-scroll-continuation/320-recommendations.png`
- Screenshot: `test-results/human-e2e/2026-07-07/recommendations-hub-narrow-scroll-continuation/390-recommendations.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/recommendations-hub-narrow-scroll-continuation/320-recommendations.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/recommendations-hub-narrow-scroll-continuation/390-recommendations.json`
- Logs: `test-results/human-e2e/2026-07-07/recommendations-hub-narrow-scroll-continuation/browser-warnings.json`
- Focused test: `npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts`

## Remaining Risk

- Untested branches: Native iOS and Android Dynamic Type/text-scale rendering.
- Missing fixtures: Durable native visual regression for the recommendation hub.
- Follow-up needed: Include compact For You hub geometry in the eventual native compact-phone E2E suite.
