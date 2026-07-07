# E2E Bug Report: Progress Paywall Compliance Links Under Floating Tab Bar

Severity: Medium
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web at `http://localhost:19008`, 320x568 viewport
Feature: Progress contextual photo-timeline paywall
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 19008`.
2. Open `/progress` at a 320x568 phone viewport in the compact contextual paywall state.
3. Inspect the `Terms`, `Privacy`, and `Restore` controls near the floating bottom tab bar.

## Expected Result

The compliance controls remain readable and tappable without sitting inside the floating tab bar zone. If the longer `Explore first` card is present, the legal controls may require a deliberate scroll, but they must not visibly overlap the tab bar.

## Actual Result

`Terms`, `Privacy`, and `Restore` rendered at `y=511.8-559.8` while the floating tab bar started at `y=491.9`, placing the compliance controls underneath the tab bar chrome on a short phone viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-current-19008/320-progress-clearance-current.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-current-19008/clearance.json`
- Terminal transcript: Expo web session on port `19008`

## Frequency

- Always in the checked compact Progress paywall state.

## Scope

- Affected route/screen: `/progress` contextual `photo_timeline` paywall
- Affected account or fixture: local free entitlement state with the contextual `Explore first` path visible
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The compact Progress paywall inserted a 112 px compliance spacer after the `Explore first` card. The card itself already ended above the floating tab bar, so the extra spacer pushed `Terms`, `Privacy`, and `Restore` down into the tab bar zone.

## Minimal Fix Recommendation

Remove the compact compliance spacer so the compliance row follows the compact CTA stack and remains above the floating tab bar.

## Verification Flow After Fix

1. Run `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/features/navigation/tabBar.test.ts`.
2. Reopen `/progress` at 320x568.
3. Confirm `Terms`, `Privacy`, and `Restore` are above the floating tab bar.
4. Re-run the 320/390 bottom-tab switch check.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/progress-paywall-compliance/progress-320-after-spacer-removal.png`
- UI geometry: `test-results/human-e2e/2026-07-07/progress-paywall-compliance/progress-320-after-spacer-removal-geometry.json`
- Terminal transcript: Expo web session on port `19009` after port `19008`
  was occupied.

Post-fix geometry at 320x568: `Terms`, `Privacy`, and `Restore` button bottoms
were at `447.8px`; the floating tab bar started at `492px`, leaving `44.2px`
clearance.

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type and lapsed-entitlement paywall variants.
- Missing fixtures: no live RevenueCat/store account state was used.
- Follow-up needed: native simulator/device QA before final launch acceptance.
