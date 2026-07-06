# E2E Bug Report: Data export share rejection shows generic failure

Severity: Medium
Surface: Native share helper / You tab
Environment: Unit-simulated native share rejection
Feature: Settings data export
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start a Settings data export with a configured backend.
2. Let the JSON export file be written to cache.
3. Make the native share sheet reject after availability probing succeeds.

## Expected Result

The app should delete the temporary plaintext JSON export, show the handled `Export unavailable` path, and avoid prompting for a successful export review.

## Actual Result

`exportData()` let `Sharing.shareAsync()` rejection throw. The You tab handled that as a generic privacy-request failure even though the backend export and temporary-file cleanup path had already run.

## Evidence

- Source inspection: `apps/mobile/src/features/settings/actions.ts`
- Regression test: `apps/mobile/src/features/settings/actions.test.ts`

## Frequency

- Always when `Sharing.isAvailableAsync()` resolves true and `Sharing.shareAsync()` rejects.

## Scope

- Affected route/screen: You tab, `Export my data`
- Affected account or fixture: any account with live data-export backend configured
- External service involved: Supabase Edge Function for real exports
- Destructive action involved: No

## Suspected Cause

The helper normalized availability-probe failures to `false`, but treated share-sheet rejection as an exception. That mixed native share-sheet failure with backend/data-rights failure.

## Minimal Fix Recommendation

Catch `Sharing.shareAsync()` rejection inside the temporary-file cleanup block and return `false` so the You tab uses the existing unavailable-share user message.

## Verification Flow After Fix

1. Unit-simulate `isAvailableAsync()` resolving true.
2. Unit-simulate `shareAsync()` rejecting.
3. Confirm `exportData()` resolves `false` and deletes the cache file.

## Post-Fix Evidence

- Test: `npm --workspace apps/mobile run test -- src/features/settings/actions.test.ts`

## Remaining Risk

- Native iOS and Android share-sheet rejection behavior still needs device QA with a configured staging data-export backend.
