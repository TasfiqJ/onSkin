# E2E Bug Report: Progress paywall CTA is blocked by the floating tab bar on 320 x 430 phones

Severity: High
Surface: Expo web
Environment: Expo web on localhost, Codex in-app browser, 320 x 430 viewport
Feature: Photo Progress contextual Pro paywall
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 8223 --host localhost`.
2. Set the browser viewport to 320 x 430.
3. Open `/progress` as a fresh free user.
4. Inspect the visible paywall controls for clipping, hit-blocking, and horizontal overflow.

## Expected Result

The free-user Progress paywall keeps Terms, Privacy, Restore, Maybe later, the annual price, store-unavailable reason, disabled Start free trial, and `Explore first` visible, readable, 44 px or larger, and center-hit-testable above the floating tab bar.

## Actual Result

The 320 x 430 post-shelf route sweep found `/progress` still failing after the shelf fixes because the `Explore first. 7 days of Pro` row sat in the floating tab-bar hit zone. The button was visible but its center hit-test was blocked by the bottom navigation.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postfix-sweep/progress.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postfix-sweep/progress.json`
- Sweep failures: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postfix-sweep/failures.json`

## Frequency

- Always at 320 x 430 for the free-user `/progress` contextual paywall before the fix.

## Scope

- Affected route/screen: `/progress`
- Affected account or fixture: Fresh free local user with store checkout unavailable in Expo web preview
- External service involved: RevenueCat/Supabase placeholders only; no live external service required
- Destructive action involved: None

## Suspected Cause

The shared short-phone ProGate treatment was tuned for 320 x 480. At 320 x 430, the title, body, price card, unavailable-store reason, and two CTAs still consumed enough height that the lower `Explore first` row landed in the floating tab-bar hit zone.

## Minimal Fix Recommendation

Add a sub-460 px density band to ProGate that tightens nonessential vertical spacing and line counts while keeping all legal and purchase controls at least 44 px tall. Preserve the existing compact compliance header instead of moving legal controls back under the bottom chrome.

## Verification Flow After Fix

1. Reopen `/progress` at 320 x 430.
2. Confirm Terms, Privacy, Restore, Maybe later, annual price, store-unavailable reason, Start free trial, and Explore first are present and readable.
3. Confirm visible controls are not clipped, tiny, horizontally overflowing, or center-hit blocked.
4. Re-run the broader 49-route 320 x 430 sweep and confirm `/progress` is no longer listed in failures.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/progress-final.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/progress-final.json`
- Targeted summary: `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/summary-final.json`
- Follow-up sweep: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postprogress-sweep/failures.json`

## Remaining Risk

- Untested branches: Native iOS and Android safe-area behavior, Dynamic Type, and screen-reader traversal.
- Missing fixtures: Live store purchase sheet, restore flow, and device-specific RevenueCat unavailable states.
- Follow-up needed: The 320 x 430 post-progress sweep still reports separate failures in Recommendations, Community, and Subscription settings.
