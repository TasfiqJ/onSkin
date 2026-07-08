# E2E Bug Report: Shelf And Paywall Bottom Actions Clipped On Short Phones

Severity: High
Surface: Expo web
Environment: `npm --workspace apps/mobile run web -- --port 8202 --host localhost`, Codex in-app browser, 320 x 480 viewport, `EXPO_PUBLIC_E2E_ENTITLEMENT=pro`
Feature: Shelf empty state and contextual subscription paywall
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and set the browser viewport to 320 x 480.
2. Open `/shelf` with an empty shelf.
3. Inspect the `Scan a barcode` and `Add by hand` controls against the floating tab bar.
4. Open `/paywall/upsell?feature=full_routine`.
5. Inspect `Start free trial`, Terms, Privacy, Restore, and `Maybe later`.

## Expected Result

The user can see and tap all bottom actions. Controls remain at least 44 px tall, center hit-tests land on the intended control, and no primary or secondary action is clipped or hidden by the floating tab bar or viewport edge.

## Actual Result

The 320 x 480 route sweep flagged `/shelf` because `Add by hand` sat under the floating tab bar, making the secondary empty-state path visually and functionally compromised. The same sweep flagged `/paywall/upsell?feature=full_routine` because `Maybe later` extended below the viewport, so the dismiss path was only partially visible.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/short-phone-480-scroll-bottom-audit/shelf.png`
- Screenshot: `test-results/human-e2e/2026-07-08/short-phone-480-scroll-bottom-audit/paywall-upsell-feature-full-routine.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/short-phone-480-scroll-bottom-audit/summary.json`

## Frequency

- Always on the tested 320 x 480 Expo web fixture.

## Scope

- Affected route/screen: `/shelf`, `/paywall/upsell?feature=full_routine`
- Affected account or fixture: Empty local shelf and Pro-preview subscription fixture
- External service involved: No
- Destructive action involved: No

## Suspected Cause

Both routes used compact layouts tuned for 320 x 568, but not the shortest-phone 320 x 480 viewport. The Shelf no-archive empty state kept full illustration, copy, and action spacing above the floating tab bar. The contextual paywall kept the decorative icon and taller vertical rhythm, leaving the secondary dismiss control below the viewport.

## Minimal Fix Recommendation

Add sub-520 px density for the affected states only: shorten Shelf empty-state spacing, title/body rhythm, illustration size, and secondary action height while preserving 44 px+ targets; shorten the contextual paywall by hiding the decorative icon and tightening sheet padding, body copy, price card, reason, CTA spacing, and footer spacing.

## Verification Flow After Fix

1. Reopen `/shelf` at 320 x 480.
2. Verify `Scan a barcode` and `Add by hand` are fully visible, at least 44 px tall, and center hit-tests land on the buttons.
3. Tap `Add by hand` and confirm `/shelf/manual`.
4. Reopen `/paywall/upsell?feature=full_routine` at 320 x 480.
5. Verify `Maybe later` is fully visible and at least 44 px tall.
6. Tap `Maybe later` and confirm dismissal to `/today`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/shelf-320x480-after-fix.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/shelf-add-by-hand-click-result.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/paywall-upsell-320x480-after-fix.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/paywall-maybe-later-click-result.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/shelf-320x480-after-fix.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-paywall-short-phone-clearance/paywall-upsell-320x480-after-fix.json`

## Remaining Risk

- Untested branches: Native iOS/Android safe-area and Dynamic Type/text-scale variants.
- Missing fixtures: Durable native E2E harness for smallest supported device classes.
- Follow-up needed: Add the stable short-phone clearance cases to the durable E2E suite once the repo selects the long-lived harness.
