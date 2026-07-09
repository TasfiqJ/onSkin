# E2E Bug Report: 390 x 844 200% text-pressure route clearance

Severity: High
Surface: Expo web
Environment: Headless Chrome, Expo web, 390 x 844 viewport, 200% text pressure
Feature: Modern-phone accessibility text layout across paywalls, tab bar, Shelf recovery, Settings Privacy, Skin Notes, and Recommendation Preferences
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit at 390 x 844 with `TEXT_PRESSURE_SCALE=2`.
2. Inspect all 49 direct-entry routes for clipped visible controls, sub-44 px visible targets, blocked center hit-tests, horizontal overflow, and disallowed browser logs.

## Expected Result

Visible controls remain complete, readable, 44 px or taller where applicable, and center-hit-testable. Lower-priority controls can move below the first viewport, but no button, chip, tab label, or row should appear as a partial bottom-edge target.

## Actual Result

The initial modern-phone 200% sweep failed 16 routes. The failures centered on contextual paywall monthly-equivalent price overflow, `Explore first` CTA clipping, the floating `Progress` tab label, Recommendation Preferences budget chips, Settings Privacy policy rows, and Shelf scan fallback hit-layer overlap. Follow-up reruns exposed final partial-target issues in the Skin Notes Sunscreen section and Shelf no-match Scan recovery row.

## Evidence

- Initial failing audit: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-audit-current/`
- Follow-up audit: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-3/`
- Final passing audit: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/`
- Final UI report: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/report.md`

## Minimal Fix

- Contextual ProGate hides the monthly-equivalent price on supported-phone 200% text pressure, keeps the annual price flexible, and gives `Explore first` one-line fitted copy.
- The floating tab bar abbreviates only the visible Progress label at 390 px while preserving the full accessibility label.
- Recommendation Preferences uses dense chip sizing on modern text-pressure phones.
- Settings Privacy direct entry aligns the privacy card and pushes policy rows below the first viewport.
- Shelf scan keeps the fallback sheet below the header hit layer.
- Shelf no-match lifts the compact Scan recovery action and keeps secondary recovery scroll-reachable.
- Skin Notes pushes the later Sunscreen section below the first short modern-phone viewport.

## Verification Flow After Fix

1. Run focused route contracts for Settings, Shelf, Subscription paywalls, Navigation, Recommendation Preferences, and Community.
2. Re-run the full 49-route text-pressure audit at 390 x 844 / 200%.

## Post-Fix Evidence

- Focused contracts: `npm --workspace apps/mobile run test -- settingsRoutes.test.ts shelfRoutes.test.ts paywallMobileContracts.test.ts tabBar.test.ts recommendationRoutes.test.ts communityRoutes.test.ts`
- Final screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/`
- Final UI report: `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-4/report.md`

The final audit passed 49 / 49 routes with zero clipped visible controls, zero sub-44 px visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard behavior, camera hardware, RevenueCat store sheets, and hardware safe-area rendering remain device QA.
