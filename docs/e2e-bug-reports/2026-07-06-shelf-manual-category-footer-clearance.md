# E2E Bug Report: Shelf manual category picker footer clearance

Severity: Medium
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web, 320x568 viewport, localhost
Feature: Shelf manual product add
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Open `/shelf/manual` in a 320x568 phone viewport.
2. Enter a product name and brand.
3. Open the Category picker and scroll toward the lower category options.

## Expected Result

Visible category rows stay tappable 48 px targets, lower options are reachable by scroll, and the fixed Continue footer does not intercept option taps.

## Actual Result

The lower picker area could sit under the fixed Continue footer. A visible lower row hit-tested to Continue instead of the category option, making the picker feel trapped on short phones.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/shelf-add-phone-sweep/pre-manual-category-open-320.jpg`
- UI snapshot: `test-results/human-e2e/2026-07-06/shelf-add-phone-sweep/pre-manual-category-open-320-geometry.json`
- Terminal transcript: Browser E2E output in the Codex thread

## Frequency

- Always on the tested 320x568 viewport before the fix

## Scope

- Affected route/screen: `/shelf/manual`
- Affected account or fixture: local manual product entry
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The manual add scroll view had only a small bottom content buffer while the Continue action was fixed at the bottom. Picker rows also relied on padding instead of a stable minimum target height.

## Minimal Fix Recommendation

Make the scroll view fill available height, add a larger bottom buffer while the picker is open, enforce 48 px category row targets, and keep the compact collapsed category field from wrapping on short phones.

## Verification Flow After Fix

1. Open `/shelf/manual` at 320x568.
2. Enter product name and brand.
3. Open the category picker, scroll to lower options, and tap "Something else".

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/shelf-add-phone-sweep/post-final-manual-category-open-320.jpg`
- Screenshot: `test-results/human-e2e/2026-07-06/shelf-add-phone-sweep/post-final-manual-category-scrolled-bottom-320.jpg`
- Screenshot: `test-results/human-e2e/2026-07-06/shelf-add-phone-sweep/post-final-manual-category-other-selected-320.jpg`
- UI snapshot: `test-results/human-e2e/2026-07-06/shelf-add-phone-sweep/post-final-manual-category-scrolled-bottom-320-hit-test.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/shelf-add-phone-sweep/post-final-manual-category-other-selected-metrics.json`

## Remaining Risk

- Untested branches: native iOS and Android simulator rendering for this exact picker state
- Missing fixtures: none for this manual-entry path
- Follow-up needed: include this branch in a future automated visual or E2E suite
