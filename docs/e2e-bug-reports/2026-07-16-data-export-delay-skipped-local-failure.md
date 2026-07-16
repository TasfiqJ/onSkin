# E2E Bug Report: Export delay skipped local failure path

Severity: Low
Surface: Expo web
Environment: Development build with `EXPO_PUBLIC_E2E_DATA_EXPORT_DELAY_MS=2500`
Feature: You data export pending and single-flight feedback
Date: 2026-07-16
Tester: Codex in-app browser

## Reproduction Steps

1. Start Expo web with the 2,500 ms export delay fixture.
2. Direct-open `/you?section=privacy`.
3. Double-click `Export my data` and inspect the immediate/pending label.

## Expected Result

The first activation starts one export, `Preparing...` remains visible and disabled for the configured delay, and the second activation is rejected.

## Actual Result

Before the fix, export still started once but failed before the pending snapshot. The fixture delay ran after local snapshot collection, so a web collection failure never reached it.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-16/you-mutation-isolation-current/390x844-export-pending.png`
- Logs: `test-results/human-e2e/2026-07-16/you-mutation-isolation-current/browser-logs.json`
- UI snapshot: post-fix `Preparing...` and disabled Delete control
- Terminal transcript: action source contract and focused test output retained in the task transcript

## Frequency

- Always when local collection fails before the original delay point

## Scope

- Affected route/screen: You / Your Data
- Affected account or fixture: local Expo-web development fixture
- External service involved: No
- Destructive action involved: No

## Suspected Cause

`waitForExportE2EDelay` was placed after `collectLocalDeviceExportData`, so early local failures bypassed the deterministic pending-state window.

## Minimal Fix Recommendation

Run the existing development-only, abort-aware delay at the export operation boundary before collection, then assert account-generation currency as before.

## Verification Flow After Fix

1. Repeat the exact delayed double-click.
2. Verify Export reads `Preparing...`, Export and Delete are disabled, and `exportStarts` increases by 1.
3. Wait for settlement and verify the sanitized inline failure with no dialog.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-16/you-mutation-isolation-current/390x844-export-pending.png`
- Logs: `test-results/human-e2e/2026-07-16/you-mutation-isolation-current/browser-logs.json`
- UI snapshot: pending and settled counter snapshots in `metrics.json`
- Terminal transcript: settings actions tests and mobile typecheck passed

## Remaining Risk

- Untested branches: native share-sheet success, authenticated server export, abort during a real native collection
- Missing fixtures: physical device and backend account
- Follow-up needed: keep successful native share/export in release QA
