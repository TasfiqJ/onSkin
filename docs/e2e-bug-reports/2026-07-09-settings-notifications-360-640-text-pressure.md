# E2E Bug Report: Notification Nudges Peek At 360 x 640 Text Pressure

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, 360 x 640 viewport, 200% text-pressure route audit
Feature: Settings notifications
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the text-pressure route audit with `TEXT_PRESSURE_VIEWPORT_WIDTH=360`,
   `TEXT_PRESSURE_VIEWPORT_HEIGHT=640`, and `TEXT_PRESSURE_SCALE=2`.
2. Open the generated `/settings/notifications` route snapshot.

## Expected Result

Visible notification controls remain complete, 44 px or larger, and
center-hit-testable. Lower-priority notification sections may start below the
first viewport, but no switch should peek into the bottom edge as a partial
target.

## Actual Result

The `Streak & adherence` switch in the Gentle Nudges card started at the bottom
edge of the first viewport. Only 5 px of the 48 px control was visible, so the
audit reported both a partial clip and a sub-44 visible target.

## Evidence

- Screenshot:
  `test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-current/settings-notifications.png`
- UI snapshot:
  `test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-current/settings-notifications.json`
- Failure summary:
  `test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-current/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always in the 360 x 640 / 200% text-pressure audit before the fix.

## Scope

- Affected route/screen: `/settings/notifications`
- Affected account or fixture: local Expo web fixture notification preferences
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The notification route only treated heights below 600 px as split-short. A
360 x 640 supported-phone viewport with enlarged text used the normal nudge
spacing, so the lower-priority Gentle Nudges section began before the first
viewport ended.

## Minimal Fix Recommendation

Add a 360/390-class supported text-pressure band that pushes the Gentle Nudges
section below the first viewport while keeping the utility reminder controls
complete and readable.

## Verification Flow After Fix

1. Re-run the same 360 x 640 / 200% route audit.
2. Confirm all 49 direct-entry routes pass.
3. Confirm `/settings/notifications` has zero clipped controls, zero sub-44
   visible controls, zero blocked centers, and zero unexpected browser logs.

## Post-Fix Evidence

- Screenshot:
  `test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-postfix/settings-notifications.png`
- UI snapshot:
  `test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-postfix/settings-notifications.json`
- Summary:
  `test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-postfix/summary.json`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, VoiceOver/TalkBack, and
  hardware safe-area behavior
- Missing fixtures: native accessibility tree snapshots
- Follow-up needed: physical-device notification permission and scheduling QA
