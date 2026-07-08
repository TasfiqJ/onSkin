# E2E Bug Report: Today empty state short-phone clearance

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 480 viewport, `EXPO_PUBLIC_E2E_ENTITLEMENT=pro`
Feature: Today empty routine state
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with Pro entitlement enabled.
2. Set the browser viewport to 320 x 480.
3. Open `/today` with no real routine in local state.
4. Inspect the first viewport around the empty-routine card and floating tab bar.

## Expected Result

The `Add products` primary CTA is fully visible, keeps its rounded pill shape, hit-tests to itself, has no horizontal overflow, and leaves clear visual breathing room above the floating tab bar on the shortest supported phone viewport.

## Actual Result

The empty-routine card was too tall for the first viewport with the reverse-trial banner and floating tab bar present. The `Add products` pill remained technically hit-testable, but it appeared visually crowded at the bottom of the card and too close to the floating tab bar, making the compact screen feel clipped rather than premium.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/short-phone-480-route-audit-6/today.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/short-phone-480-route-audit-6/today.json`
- Route audit summary: `test-results/human-e2e/2026-07-08/short-phone-480-route-audit-6/summary.json`

## Frequency

- Always in the empty-routine `/today` state at 320 x 480.

## Scope

- Affected route/screen: `/today`
- Affected account or fixture: Local empty-routine state with Pro entitlement banner visible.
- External service involved: None.
- Destructive action involved: None.

## Suspected Cause

The compact empty routine card reused too much vertical spacing from the larger layout. At 320 x 480, the reverse-trial banner, date label, greeting, card padding, body copy, CTA margin, and floating tab bar left too little first-viewport clearance.

## Minimal Fix Recommendation

Tighten only the compact empty-routine card density by reducing the compact top margin, vertical padding, heading size/line-height, body line-height, and CTA margin while preserving the full 56 px CTA height.

## Verification Flow After Fix

1. Reload `/today` at 320 x 480.
2. Confirm the `Add products` CTA is fully visible and hit-tests to itself.
3. Confirm the CTA has clear separation from the floating tab bar and zero horizontal overflow.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/today-empty-short-phone-480-clearance/today-post-fix.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/today-empty-short-phone-480-clearance/today-post-fix-geometry.json`
- Post-fix geometry: `Add products` is 230 x 56 px at y=314-370, floating tab bar starts at y=407, clearance is 37 px, `scrollWidth` is 320.

## Remaining Risk

- Untested branches: Native iOS/Android safe-area and Dynamic Type rendering for the same empty state.
- Missing fixtures: Durable native E2E harness is still an open repo question.
- Follow-up needed: Native simulator/device pass before final launch acceptance.
