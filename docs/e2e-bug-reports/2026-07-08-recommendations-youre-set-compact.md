# E2E Bug Report: For You you're-set state clips on compact phones

Severity: Medium
Surface: Expo web, with iOS/Android compact-layout risk
Environment: Expo web on `localhost:19144`, System Chrome DevTools Protocol, 320 x 568 and 320 x 480 phone viewports
Feature: Personalized Recommendations, For You hub empty state
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Seed local shelf storage with a complete, non-expiring routine: cleanser, treatment serum, moisturiser, and SPF.
2. Open `/recommendations` at 320 x 568 and 320 x 480.
3. Inspect the "Your routine looks complete" state before and after scrolling.

## Expected Result

The hub subtitle, completion icon, title, body, checks, and footnote do not overlap or clip. Compact phones can reach all trust copy without horizontal overflow or sub-44 px controls.

## Actual Result

Before the fix, the you're-set branch used a centered fixed `View` instead of the scrollable compact layout used by recommendation cards. At 320 x 568, content extended to 602 px and the footnote was below the viewport. At 320 x 480, content extended to 558 px. The completion icon also sat too close to the hub subtitle.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/recommendations-youre-set-compact/prefix-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-08/recommendations-youre-set-compact/prefix-320x480.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/recommendations-youre-set-compact/prefix-summary.json`
- Terminal transcript: seeded Chrome CDP run in Codex terminal

## Frequency

- Always with the seeded complete-routine fixture on compact heights.

## Scope

- Affected route/screen: `/recommendations`
- Affected account or fixture: Complete shelf state that produces the honest "you're set" result
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The empty state predated the compact hub work and did not receive the same scroll container, height-aware spacing, or explicit compact sizing as the recommendation-card path.

## Minimal Fix Recommendation

Render `YoureSet` inside a `ScrollView`, pass the existing compact hub signal, tighten the short-phone spacing, and use explicit React Native width/height/fontSize for the completion icon.

## Verification Flow After Fix

1. Reopen `/recommendations` with the same seeded complete shelf at 320 x 568.
2. Verify the first viewport has no subtitle overlap, zero horizontal overflow, no sub-44 px controls, and a fully visible footnote at 320 x 568.
3. Reopen at 320 x 480, scroll the you're-set state, and verify the footnote becomes fully visible inside the scroll region.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/recommendations-youre-set-compact/final2-320x568-top.png`
- Screenshot: `test-results/human-e2e/2026-07-08/recommendations-youre-set-compact/final2-320x480-bottom.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/recommendations-youre-set-compact/final2-summary.json`
- Terminal transcript: final seeded Chrome CDP run in Codex terminal

## Remaining Risk

- Untested branches: Native iOS/Android Dynamic Type and font-scaling behavior.
- Missing fixtures: Durable mobile E2E harness for local private-storage seeding.
- Follow-up needed: Repeat on real beta devices once the project standardizes native E2E.
