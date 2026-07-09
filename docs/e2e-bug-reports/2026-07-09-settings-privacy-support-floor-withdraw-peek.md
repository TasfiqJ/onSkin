# E2E Bug Report: Settings Privacy support-floor withdraw row peek

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, 320 x 480 launch support-floor viewport, Expo web on localhost:8255
Feature: Settings Privacy direct entry
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 8255`.
2. Set the browser viewport to 320 x 480.
3. Open `/settings/privacy`, which resolves to `/you?section=privacy`.

## Expected Result

The first support-floor viewport keeps visible privacy controls complete and never leaves lower destructive actions partially covered by the floating tab bar; a destructive action is acceptable only when it is fully visible, 44 px+, and center-hit-testable.

## Actual Result

With the initial support-floor spacer, `Withdraw health-data consent` remained visible from roughly y=358 to y=430 while the floating tab bar began around y=407, leaving the lower portion of the destructive action under navigation.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/settings-privacy-support-floor-withdraw-current/01-support-floor-first-viewport.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/settings-privacy-support-floor-withdraw-current/01-support-floor-first-viewport.json`
- Logs: `test-results/human-e2e/2026-07-09/settings-privacy-support-floor-withdraw-current/summary.json`

## Frequency

- Always at the 320 x 480 launch support-floor viewport before the final spacer calibration.

## Scope

- Affected route/screen: `/settings/privacy` -> `/you?section=privacy`
- Affected account or fixture: Local signed-in placeholder state
- External service involved: None
- Destructive action involved: Yes, health-data consent withdrawal

## Suspected Cause

The support-floor withdraw spacer was large enough to move the row down, but not large enough to move it fully below the first support-floor viewport and away from the floating tab bar.

## Minimal Fix Recommendation

Increase the support-floor-only withdraw margin so the lower destructive action starts below the first 320 x 480 viewport while keeping wider and shorter privacy layouts on their existing paths.

## Verification Flow After Fix

1. Reopen `/settings/privacy` at 320 x 480 and confirm `Withdraw health-data consent` is either below the first viewport or fully visible above the floating tab bar with its center hit-test landing inside the button.
2. Confirm visible controls report zero clipping, sub-44 targets, blocked centers, and horizontal overflow.
3. Scroll down and confirm `Withdraw health-data consent` is reachable as a complete 44 px+ button with no blocked center.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/settings-privacy-support-floor-withdraw-current/01-support-floor-first-viewport.png`
- Screenshot: `test-results/human-e2e/2026-07-09/settings-privacy-support-floor-withdraw-current/02-support-floor-scrolled-withdraw.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/settings-privacy-support-floor-withdraw-current/01-support-floor-first-viewport.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/settings-privacy-support-floor-withdraw-current/02-support-floor-scrolled-withdraw.json`
- Logs: `test-results/human-e2e/2026-07-09/settings-privacy-support-floor-withdraw-current/summary.json`
- Follow-up UI snapshot: `test-results/human-e2e/2026-07-09/settings-privacy-direct-entry-current/settings-privacy.json`
- Follow-up summary: `test-results/human-e2e/2026-07-09/settings-privacy-direct-entry-current/summary.json`

## Remaining Risk

- Untested branches: Native iOS/Android safe-area and Dynamic Type rendering
- Missing fixtures: Physical-device QA
- Follow-up needed: Include this support-floor case in the next route sweep if adjacent privacy spacing changes again.
