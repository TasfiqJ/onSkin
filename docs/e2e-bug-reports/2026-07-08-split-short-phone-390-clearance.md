# E2E Bug Report: 320 x 390 split-short controls clipped

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web on localhost, 320 x 390 viewport
Feature: Ask, Shelf, contextual paywall, Recommendations, Skin Notes, Settings notifications
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and set the browser viewport to 320 x 390.
2. Open the current direct-entry route set, including `/ask`, `/shelf`, `/shelf/scan`, `/shelf/no-match`, `/shelf/ocr`, `/paywall/upsell?feature=full_routine`, `/recommendations`, `/recommendations/preferences`, `/community`, and `/settings/notifications`.
3. Inspect visible controls before scrolling and run center hit-tests on each visible interactive element.

## Expected Result

Visible controls should be fully readable, hit-testable, and at least 44 px in the relevant touch dimension. Lower-priority controls can sit below the first viewport, but they should not be half-visible at the bottom edge.

## Actual Result

The 320 x 390 stress pass exposed partially clipped or blocked controls across split-short layouts:

- `/recommendations/preferences`: budget chips clipped at the first viewport bottom.
- `/settings/subscription`: the free-plan Privacy row clipped.
- `/settings/notifications`: Progress-photo nudge and later the promotional switch clipped.
- `/ask`: lower prompt controls sat in the fixed composer hit zone.
- `/shelf`, `/shelf/no-match`, `/shelf/scan`, `/shelf/ocr`: empty, recovery, camera, and OCR actions could clip or be center-blocked.
- `/paywall/upsell?feature=full_routine`: Maybe later clipped at the bottom edge.
- `/community` and `/recommendations`: lower cards were partially visible as cut controls.

## Evidence

- Targeted post-fix screenshots and audit JSON: `test-results/human-e2e/2026-07-08/split-short-phone-390-clearance/`
- Post-fix full sweep: `test-results/human-e2e/2026-07-08/current-main-split-short-phone-390-sweep-postfix/`
- Interaction transcript: `test-results/human-e2e/2026-07-08/split-short-phone-390-clearance/interactions.json`

## Frequency

Always in the tested direct-entry 320 x 390 states before the fix.

## Scope

- Affected route/screen: split-short direct-entry routes listed above
- Affected account or fixture: default local Expo web state
- External service involved: none; Supabase and RevenueCat remain placeholder/local
- Destructive action involved: none

## Suspected Cause

The 430 px compact layouts still assumed enough vertical room for secondary prompts, lower cards, helper copy, or compliance rows. At 390 px those elements either intersected the viewport edge or shared space with fixed/floating surfaces.

## Minimal Fix Recommendation

Add a narrower split-short density band below 410 px that removes nonessential helper copy, limits first-screen prompt/card count, and deliberately defers secondary controls below the first viewport while preserving 48 px touch targets.

## Verification Flow After Fix

1. Re-open the affected routes at 320 x 390.
2. Confirm zero clipped controls and zero blocked center hit-tests.
3. Tap representative formerly affected controls.
4. Re-run the 49-route 320 x 390 sweep.

## Post-Fix Evidence

- Focused 11-route pass: `test-results/human-e2e/2026-07-08/split-short-phone-390-clearance/targeted-320x390-audit.json`
- User-like interaction pass: `test-results/human-e2e/2026-07-08/split-short-phone-390-clearance/interactions.json`
- Full sweep: `test-results/human-e2e/2026-07-08/current-main-split-short-phone-390-sweep-postfix/summary.json`
- Result: focused pass reports zero failures, interaction pass reports zero failures across 10 taps, and the 49-route sweep reports zero failed routes.

## Remaining Risk

- Native iOS and Android safe-area behavior, Dynamic Type, screen-reader traversal, native camera permission sheets, notification delivery, and RevenueCat store behavior still require physical-device QA.
- 320 x 390 is a web split-screen stress size below normal portrait phone height; it is useful for pressure testing, but not a substitute for native device matrix evidence.
