# E2E Bug Report: Progress empty state short-phone clearance

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 480 viewport, `EXPO_PUBLIC_E2E_ENTITLEMENT=pro`
Feature: Photo Progress empty first-run state
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with Pro entitlement enabled.
2. Set the browser viewport to 320 x 480.
3. Open `/progress` with no local progress photos.
4. Inspect and tap the `Take my first photo` action near the floating tab bar.

## Expected Result

The `Take my first photo` CTA is fully visible, keeps a premium pill shape, hit-tests to itself, has no horizontal overflow, and leaves clear separation above the floating tab bar on the shortest supported phone viewport.

## Actual Result

The compact first-run Progress copy stack was still too tall at 320 x 480. The `Take my first photo` CTA rendered at y=349-405 while the floating tab bar started at y=407, leaving only about 2 px of clearance and visually covering the lower CTA label.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/progress-empty-320x480-before-fix.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/progress-empty-320x480-before-buttons.json`
- Route audit source: `test-results/human-e2e/2026-07-08/short-phone-480-scroll-bottom-audit/progress.json`

## Frequency

- Always in the empty `/progress` state at 320 x 480.

## Scope

- Affected route/screen: `/progress`
- Affected account or fixture: Empty local Progress timeline with Pro entitlement.
- External service involved: None.
- Destructive action involved: None.

## Suspected Cause

The compact first-run card kept too much vertical rhythm from the larger phone layout. On the 320 x 480 viewport, the heading, body, expectation bar, reassurance row, 56 px CTA, and floating tab bar left no meaningful first-viewport clearance.

## Minimal Fix Recommendation

Tighten only the compact first-run Progress empty state by reducing card padding, compact type size/leading, expectation-bar and reassurance spacing, and the compact CTA height while preserving a 44 px+ tappable target.

## Verification Flow After Fix

1. Reload `/progress` at 320 x 480.
2. Confirm `Take my first photo` is fully visible and hit-tests to itself.
3. Confirm the CTA has clear separation above the floating tab bar and zero horizontal overflow.
4. Tap the CTA and confirm it routes to the local-only photo consent gate.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/progress-empty-320x480-after-fix.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/progress-empty-320x480-after-fix.json`
- Tap result: `test-results/human-e2e/2026-07-08/progress-empty-short-phone-clearance/progress-empty-cta-click-result.json`
- Post-fix geometry: `Take my first photo` is 272 x 52 px at y=315-367, floating tab bar starts at y=401, clearance is 33.6 px, the CTA center hit-tests to `Take my first photo`, and `scrollWidth` is 320.

## Remaining Risk

- Untested branches: Native iOS/Android safe-area, Dynamic Type, and screen-reader traversal.
- Missing fixtures: Durable native E2E harness is still an open repo question.
- Follow-up needed: Native simulator/device pass before final launch acceptance.
