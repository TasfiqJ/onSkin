# E2E Bug Report: 375 x 667 200% Progress paywall clearance

Severity: High
Surface: Expo web
Environment: 375 x 667 viewport, 200% text-pressure route audit
Feature: Progress contextual ProGate paywall
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit with `TEXT_PRESSURE_SCALE=2`, `TEXT_PRESSURE_VIEWPORT_WIDTH=375`, and `TEXT_PRESSURE_VIEWPORT_HEIGHT=667`.
2. Inspect the default 49-route sweep for visible partial controls, blocked hit centers, and tab-bar intersections.
3. Re-run `/progress` and the full route set after the fix.

## Expected Result

Every visible Progress paywall control remains fully visible, 44 px or larger, center-hit-testable, free of horizontal overflow, and free of unexpected browser logs. Lower-priority actions may start below the first viewport as long as they remain reachable by scroll.

## Actual Result

The first full sweep failed `/progress`. The lower-priority `Explore first. 7 days of Pro. No credit card. See your routine work, then decide.` card was visible at the bottom of the first viewport, but its center hit-test resolved to the surrounding paywall wrapper near the floating tab bar instead of the button.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-current/progress.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-current/progress.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-current/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

Always with the listed viewport and text-pressure scale before the fix.

## Scope

- Affected route/screen: `/progress`
- Affected account or fixture: local fresh free-user Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The support-floor Progress paywall kept the no-card secondary card in the first viewport while 200% text pressure pushed the card into the floating tab-bar hit zone. The primary paid CTA remained visible, but the secondary card's center was no longer tappable.

## Minimal Fix Recommendation

For the support-floor Progress contextual paywall, defer the lower-priority `Explore first` card below the first viewport. Keep Terms, Privacy, Restore, Maybe later, annual price, store-unavailable feedback, and Start free trial visible and complete in the initial view.

## Verification Flow After Fix

1. Run `npm --workspace apps/mobile run test -- paywallMobileContracts.test.ts`.
2. Run focused text-pressure E2E for `/progress` at 375 x 667 / 200%.
3. Run the full 49-route Expo web text-pressure audit at 375 x 667 / 200%.

## Post-Fix Evidence

- Focused screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-progress-postfix/`
- Full screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-postfix/`
- Summary: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-postfix/summary.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-postfix/progress.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Remaining Risk

- Untested branches: native iOS and Android Dynamic Type, hardware safe areas, store sheet, and screen-reader traversal
- Missing fixtures: native device/simulator text-size and accessibility passes
- Follow-up needed: native iOS/Android Dynamic Type and store-sheet QA
