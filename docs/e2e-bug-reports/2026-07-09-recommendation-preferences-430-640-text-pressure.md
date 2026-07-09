# E2E Bug Report: Recommendation Preferences 430 x 640 Text Pressure

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, 430 x 640 viewport, 200% text-pressure route audit
Feature: Recommendation Preferences
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Start the Expo web text-pressure audit at 430 x 640 with 200% text pressure.
2. Include `/settings/privacy`, `/community`, and `/recommendations/preferences`.
3. Inspect visible controls in the first viewport.

## Expected Result

Visible controls are complete, 44 px or taller where applicable, center-hit-testable, free of horizontal overflow, and free of unexpected browser logs. Lower-priority controls can start below the first viewport.

## Actual Result

`/recommendations/preferences` exposed `Non-comedogenic` and `Sustainable` as 8 px bottom-edge partial targets at the first viewport bottom.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-support-band-430-640-current/recommendations-preferences.png`
- Logs: `test-results/human-e2e/2026-07-09/text-pressure-200-support-band-430-640-current/expo-web.log`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-support-band-430-640-current/recommendations-preferences.json`
- Terminal transcript: `test-results/human-e2e/2026-07-09/text-pressure-200-support-band-430-640-current/report.md`

## Frequency

- Always with the listed viewport and text-pressure scale before the fix.

## Scope

- Affected route/screen: `/recommendations/preferences`
- Affected account or fixture: local Expo web route audit
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The 430-wide support-band guard broadened the route into split-short density, but the wide support-band deferred value-chip margin still left the lower value group peeking into the first viewport.

## Minimal Fix Recommendation

Keep the first three value chips in the first viewport and move the lower-priority value chips farther below the first 430 x 640 text-pressure viewport.

## Verification Flow After Fix

1. Re-run the focused route contract for Recommendation Preferences.
2. Re-run the same 430 x 640 / 200% text-pressure route audit for `/settings/privacy`, `/community`, and `/recommendations/preferences`.
3. Confirm zero route failures and zero disallowed browser logs.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-support-band-430-640-postfix/recommendations-preferences.png`
- Logs: `test-results/human-e2e/2026-07-09/text-pressure-200-support-band-430-640-postfix/expo-web.log`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-support-band-430-640-postfix/recommendations-preferences.json`
- Terminal transcript: `test-results/human-e2e/2026-07-09/text-pressure-200-support-band-430-640-postfix/report.md`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type and safe-area behavior
- Missing fixtures: native screen-reader traversal and keyboard states
- Follow-up needed: physical-device Dynamic Type QA remains a Phase 5/7 gate
