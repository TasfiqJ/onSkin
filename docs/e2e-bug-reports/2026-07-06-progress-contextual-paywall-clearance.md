# E2E Bug Report: Progress contextual paywall phone clearance

Severity: Medium
Surface: Expo web, 320 x 568 phone viewport
Environment: Expo web dev server on localhost, route `/progress`
Feature: Progress contextual photo-timeline paywall
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start the Expo mobile web surface.
2. Open `/progress` as a free user in a 320 x 568 phone viewport.
3. Inspect the contextual photo-timeline paywall around the price card, CTA, compliance links, and floating tab bar.

## Expected Result

The annual price card, `Start free trial` CTA, `Terms`, `Privacy`, `Restore`, `Maybe later`, and floating tab bar should
all be visible and tappable without overlaps, clipped text, or sub-44 pt targets.

## Actual Result

The fixed paywall action area rendered on top of the annual price card. Before the fix, the price card occupied
`y=308..392` and the `Start free trial` CTA occupied `y=351..405`, hiding part of the price row on the smallest phone
viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/shelf-progress-phone-sweep/pre-progress-320x568-after-return.jpg`
- UI snapshot: `test-results/human-e2e/2026-07-06/shelf-progress-phone-sweep/pre-progress-320x568-after-return-geometry.json`

## Frequency

- Always at 320 x 568 before the fix

## Scope

- Affected route/screen: `/progress` free-user contextual ProGate paywall
- Affected account or fixture: local free-user placeholder state with RevenueCat unavailable
- External service involved: RevenueCat unavailable placeholder offering only
- Destructive action involved: none

## Suspected Cause

`ProGate` kept the purchase CTA and compliance row outside the scroll body. On very short phones, the scroll body still
centered the paywall content underneath that fixed action area, so the CTA overlapped the pricing card.

## Minimal Fix Recommendation

Keep contextual paywall actions inside the scroll flow on short phones, add compact spacing below 640 px viewport
height, and preserve the 44 pt compliance controls above the floating tab bar.

## Verification Flow After Fix

1. Reopen `/progress` at 320 x 568.
2. Confirm the price card and `Start free trial` CTA do not overlap.
3. Confirm `Terms`, `Privacy`, and `Restore` are 48 px controls above the floating tab bar.
4. Reopen `/progress` and `/shelf` at 390 x 844 to confirm normal phone layouts still have no small controls, clipping,
   horizontal overflow, or tab-bar collisions.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/shelf-progress-phone-sweep/post-progress-paywall-320x568-viewport-only.jpg`
- UI snapshot: `test-results/human-e2e/2026-07-06/shelf-progress-phone-sweep/post-progress-paywall-320x568-fresh-tab-geometry.json`
- Screenshot: `test-results/human-e2e/2026-07-06/shelf-progress-phone-sweep/post-progress-paywall-390x844.jpg`
- UI snapshot: `test-results/human-e2e/2026-07-06/shelf-progress-phone-sweep/post-progress-paywall-390x844-geometry.json`
- Screenshot: `test-results/human-e2e/2026-07-06/shelf-progress-phone-sweep/post-shelf-390x844.jpg`
- UI snapshot: `test-results/human-e2e/2026-07-06/shelf-progress-phone-sweep/post-shelf-390x844-geometry.json`

## Remaining Risk

- Untested branches: native iOS and Android rendering for the same contextual paywall
- Missing fixtures: Pro entitlement fixture for the ungated Progress comparison surface
- Follow-up needed: verify the Progress comparison controls on a native device with an active Pro entitlement before
  final launch acceptance
