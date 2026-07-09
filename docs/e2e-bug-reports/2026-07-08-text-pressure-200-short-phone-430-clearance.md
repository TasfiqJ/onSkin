# E2E Bug Report: 200 percent short-phone controls clipped

Severity: Medium
Surface: Expo web
Environment: Headless Chrome via `npm run e2e:text-pressure`, 320 x 430 viewport, text pressure scale 2.0
Feature: Short-phone Dynamic Type, paywall feedback, and first-viewport clearance
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Set `TEXT_PRESSURE_VIEWPORT_WIDTH=320`, `TEXT_PRESSURE_VIEWPORT_HEIGHT=430`, and `TEXT_PRESSURE_SCALE=2.0`.
2. Run `npm run e2e:text-pressure`.
3. Inspect failed route evidence for clipped controls, blocked centers, text overflow, horizontal overflow, and browser logs.

## Expected Result

All 49 route entries keep visible controls complete, 44 px or larger, center-hit-testable, and within the 320 px viewport under 200 percent text pressure on a short phone.

## Actual Result

The first audit failed `/progress`, `/recommendations/preferences`, and `/settings/notifications`. The locked Progress paywall rendered `Start free trial` as a visible but disabled primary CTA when store pricing was unavailable in the preview, so the button center hit the parent container instead of the button. Recommendation Preferences let the `Fragrance-free` value chip peek into the viewport as a 14 px visible target, and Settings Notifications let the `Streak & adherence` switch peek into the viewport as a 3 px visible target.

## Evidence

- Screenshot packet: `test-results/human-e2e/2026-07-08/text-pressure-200-short-phone-430-audit-current/`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-200-short-phone-430-audit-current/failures.json`
- Terminal transcript: `npm run e2e:text-pressure` failed with `3 text-pressure route(s) failed.`

## Frequency

- Always at 320 x 430 with 200 percent text pressure before the short-phone fixes.

## Scope

- Affected route/screen: `/progress`, `/recommendations/preferences`, and `/settings/notifications`.
- Affected account or fixture: local Expo web route fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`.
- External service involved: none.
- Destructive action involved: none.

## Suspected Cause

The 200 percent short-phone sweep combined the compact 568 px text-pressure problems with the tighter 430 px first viewport. Recommendation Preferences and Settings Notifications needed additional ultra-short spacing so the first lower-priority group did not partially appear at the bottom edge. ProGate already had a store-unavailable feedback path, but disabling the CTA before that handler ran created a visible dead button under preview store conditions.

## Minimal Fix Recommendation

Keep the contextual paywall primary CTA enabled unless a purchase mutation is pending, so preview store-unavailable taps surface the existing feedback. Add ultra-short first-group spacing to Recommendation Preferences and move the Gentle Nudges block below the first viewport on ultra-short notification settings.

## Verification Flow After Fix

1. Run focused route contract tests for Settings, Recommendations, and paywall mobile contracts.
2. Re-run the same 320 x 430 / 200 percent route sweep.
3. Confirm 49 routes pass with zero failed routes, zero disallowed logs, and zero visible control issues.

## Post-Fix Evidence

- Screenshot packet: `test-results/human-e2e/2026-07-08/text-pressure-200-short-phone-430-postfix/`
- UI snapshot: `test-results/human-e2e/2026-07-08/text-pressure-200-short-phone-430-postfix/summary.json`
- Terminal transcript: `npm run e2e:text-pressure` passed and printed the final evidence path.

## Remaining Risk

- Untested branches: real native iOS and Android Dynamic Type rendering, keyboard behavior, VoiceOver/TalkBack traversal, and hardware safe-area combinations.
- Missing fixtures: physical device builds with real OS text settings.
- Follow-up needed: keep Phase 5 native-device QA as the source of truth for iOS/Android Dynamic Type and accessibility proof.
