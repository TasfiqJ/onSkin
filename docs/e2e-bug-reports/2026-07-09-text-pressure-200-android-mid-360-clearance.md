# E2E Bug Report: 360 x 780 200% supported-phone text-pressure clearance

Severity: High
Surface: Expo web
Environment: 360 x 780 viewport, 200% text-pressure route audit
Feature: Contextual ProGate paywalls and Recommendation Preferences
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit with `TEXT_PRESSURE_SCALE=2`, `TEXT_PRESSURE_VIEWPORT_WIDTH=360`, and `TEXT_PRESSURE_VIEWPORT_HEIGHT=780`.
2. Inspect the default 49-route sweep results for visible clipped controls, blocked hit targets, and nowrap text overflow.
3. Re-run the same sweep after each fix.

## Expected Result

Every visible control on the supported-phone first viewport remains at least 44 px, fully visible, center-hit-testable, and free of horizontal or nowrap text overflow.

## Actual Result

The first sweep failed `/routine/reorder` and `/recommendations/preferences`. The routine reverse-trial card forced `No card needed.` onto one nowrap line, producing text overflow. Recommendation Preferences exposed a partially visible `Oil` texture chip at the bottom of the viewport.

After those fixes, the follow-up sweep exposed `/progress`: Terms, Privacy, and Restore were visible but their centers hit the surrounding paywall wrapper instead of the buttons because the bottom compliance row sat in the floating-tab transition zone.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-current/routine-reorder.png`
- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-current/recommendations-preferences.png`
- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-postfix/progress.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-current/failures.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-postfix/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

Always with the listed viewport and text-pressure scale before the fix.

## Scope

- Affected route/screen: `/routine/reorder`, `/recommendations/preferences`, and `/progress`
- Affected account or fixture: local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The shared ProGate text-pressure tier shortened reverse-trial copy but still forced the supporting body onto one line on supported-width phones. Recommendation Preferences did not have a mid-height supported-phone spacer for the texture chip group. Progress photo paywalls used bottom compliance controls on a mid-height supported phone, leaving the legal/restore buttons too close to the floating tab bar shadow/transition layer under 200% pressure.

## Minimal Fix Recommendation

Allow supported-width reverse-trial body copy to wrap except on ultra-short paywalls, move the lower-priority Recommendation Preferences texture group below the first 360 x 780 viewport, and promote supported-width Progress photo paywalls into the existing header compliance layout with a compact dismiss icon.

## Verification Flow After Fix

1. Run focused subscription and recommendation contract tests.
2. Run the full 49-route Expo web text-pressure audit at 360 x 780 / 200%.
3. Inspect `/progress`, `/recommendations/preferences`, and `/routine/reorder` route JSON for zero issues.

## Post-Fix Evidence

- Screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-postfix2/`
- Summary: `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-postfix2/summary.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-postfix2/progress.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-postfix2/recommendations-preferences.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-mid-360-780-postfix2/routine-reorder.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type and safe-area behavior
- Missing fixtures: native store sheet and screen-reader runs
- Follow-up needed: device QA for VoiceOver, TalkBack, hardware safe areas, and store purchase surfaces
