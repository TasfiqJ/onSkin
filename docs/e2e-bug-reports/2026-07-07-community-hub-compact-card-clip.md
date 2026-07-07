# E2E Bug Report: Community hub cards clip on compact phones

Severity: Medium
Surface: Expo web
Environment: Expo web, 320 x 568 and 390 x 568 phone viewports
Feature: Skin Notes Community Trust Layer
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/community`.
2. Set the viewport to 320 x 568.
3. Inspect the first viewport without scrolling.
4. Repeat at 390 x 568.

## Expected Result

The Skin Notes hub should feel like a deliberate reference library on compact phones. Visible expert-note cards should not be clipped mid-card, evidence pills should remain readable, and tap targets should stay at least 44 px tall with zero horizontal overflow.

## Actual Result

Before the fix, the third Skin Note entered the 320 x 568 viewport as a tiny clipped sliver and entered the 390 x 568 viewport with only part of the card visible. The route was scrollable, but the first viewport looked unfinished and reduced confidence in the expert-library surface.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19126-current/320-community.png`
- Screenshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19126-current/390-community.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19126-current/320-community.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/compact-route-audit-19126-current/390-community.json`

## Frequency

- Always on the tested compact Community hub before the fix.

## Scope

- Affected route/screen: `/community`
- Affected account or fixture: Local Skin Notes seeded corpus
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The Community hub used one card density for all phone heights. On 568 px-tall phones, the large hub heading, section gaps, and full-size note cards pushed the next tappable note into the bottom of the viewport before its body could fit.

## Minimal Fix Recommendation

Apply a short-phone compact treatment to the Community hub: shorter heading/subtitle spacing, tighter section gaps, compact card padding, smaller evidence pills, and reduced card line-height while preserving accessible full-card touch geometry.

## Verification Flow After Fix

1. Reopen `/community` at 320 x 568.
2. Confirm the first three Skin Note cards are fully readable in the first viewport.
3. Confirm the next offscreen card is only a scroll continuation, not a clipped active target that hides the current card body.
4. Repeat at 390 x 568 and confirm no horizontal overflow, no sub-44 px controls, and no clipped visible controls.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/community-hub-compact-card-fit/320-community.png`
- Screenshot: `test-results/human-e2e/2026-07-07/community-hub-compact-card-fit/390-community.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/community-hub-compact-card-fit/320-community.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/community-hub-compact-card-fit/390-community.json`
- Logs: `test-results/human-e2e/2026-07-07/community-hub-compact-card-fit/browser-warnings.json`
- Focused test: `npm --workspace apps/mobile run test -- src/features/community/communityRoutes.test.ts`

## Remaining Risk

- Untested branches: Native iOS and Android Dynamic Type/text-scale rendering.
- Missing fixtures: Durable native visual regression for the Skin Notes hub.
- Follow-up needed: Include compact Skin Notes hub geometry in the eventual native compact-phone E2E suite.
