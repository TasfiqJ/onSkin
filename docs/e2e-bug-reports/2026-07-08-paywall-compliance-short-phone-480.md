# E2E Bug Report: Paywall compliance controls blocked on shortest phones

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo web at 320 x 480, local development store fallback
Feature: Subscription paywalls and Progress photo contextual paywall
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and set the browser viewport to 320 x 480.
2. Open `/progress/capture`, `/progress/review`, `/paywall/winback`, `/paywall/downgrade`, and `/paywall/reoffer`.
3. Inspect Terms, Privacy, and Restore positions and center hit-tests.

## Expected Result

Terms, Privacy, and Restore remain visible, at least 44 px, and tappable without being covered by fixed footer actions or fallback purchase messaging.

## Actual Result

Before the fix, `/progress/capture` and `/progress/review` pushed Terms, Privacy, and Restore below the shortest-phone viewport. `/paywall/winback`, `/paywall/downgrade`, and `/paywall/reoffer` rendered those controls in the scroll body where the fixed action footer covered their hit targets.

## Evidence

- Pre-fix screenshots and geometry: `test-results/human-e2e/2026-07-08/short-phone-480-current-audit-3/`
- Post-fix screenshots and geometry: `test-results/human-e2e/2026-07-08/short-phone-480-paywall-compliance-final/`
- UI snapshot: `test-results/human-e2e/2026-07-08/short-phone-480-paywall-compliance-final/summary.json`

## Frequency

- Always on the checked 320 x 480 routes.

## Scope

- Affected route/screen: `/progress/capture`, `/progress/review`, `/paywall/winback`, `/paywall/downgrade`, `/paywall/reoffer`
- Affected account or fixture: Free/local preview store fallback
- External service involved: RevenueCat/store pricing unavailable in local preview
- Destructive action involved: No

## Suspected Cause

The compact layouts optimized the primary purchase actions but left compliance controls in the scroll body. On the shortest phone viewport, direct Progress photo paywalls did not receive the compact photo treatment, and lifecycle paywall fixed footers physically covered the compliance row.

## Minimal Fix Recommendation

Apply the compact photo paywall treatment to all `/progress/*` photo-timeline paywall entries, and render Terms, Privacy, and Restore inside the compact fixed action footer for lifecycle paywalls.

## Verification Flow After Fix

1. Reopen all affected routes at 320 x 480.
2. Confirm Terms, Privacy, and Restore are visible.
3. Confirm each center hit-test resolves to its own control.
4. Confirm no sub-44 controls, visible clipped controls, horizontal overflow, or JavaScript dialogs.

## Post-Fix Evidence

- Screenshot and geometry folder: `test-results/human-e2e/2026-07-08/short-phone-480-paywall-compliance-final/`

## Remaining Risk

- Untested branches: Native iOS/Android device safe-area and Dynamic Type behavior.
- Missing fixtures: Live RevenueCat purchase, restore, win-back, and store-management states.
- Follow-up needed: Native simulator/device QA before release.
