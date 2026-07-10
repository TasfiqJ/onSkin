# E2E Bug Report: Export card implied an available photo-upload choice

Severity: Medium
Surface: Expo web
Environment: Local development build at 390 x 844
Feature: Settings privacy and data export
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Open `/you?section=privacy`.
2. Scroll to the `YOUR DATA` card.
3. Read the footer below Delete account.

## Expected Result

Photo-storage copy matches D-086: Progress photos remain encrypted on the device unless the user explicitly shares one, and cloud backup is unavailable.

## Actual Result

The footer said `Photos stay on your device by default`, which implied a current alternate upload/backup state even though no such capability exists.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/data-export-local-photo-disclosure-current/pre-fix-stale-photo-default-footer.png`.
- Logs: no runtime error; this was a visible copy-contract defect.

## Frequency

- Always.

## Scope

- Affected route/screen: `/you?section=privacy` and the You tab.
- Affected account or fixture: All states rendering `YOUR DATA`.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The footer retained language from the retired optional-backup design after backup was made unavailable.

## Minimal Fix Recommendation

Replace the default-state claim with the explicit-share-only boundary and guard against restoring the old phrase in mobile and Phase 9 tests.

## Verification Flow After Fix

1. Reload the data card at 360 x 640 and 390 x 844.
2. Confirm both the export exclusion and explicit-share-only footer are visible and readable.
3. Trigger export failure and verify both disclosures remain intact with no dialog or overflow.

## Post-Fix Evidence

- Screenshots and UI snapshots: `test-results/human-e2e/2026-07-10/data-export-local-photo-disclosure-current/`.
- Code gates: `apps/mobile/src/features/settings/actions.test.ts` and `npm run phase9:data-rights-smoke`.

## Remaining Risk

- Untested branches: final counsel-approved wording and native assistive-technology output.
- Missing fixtures: live staging export and native share-sheet evidence.
- Follow-up needed: Tas must complete `PHASE9_DATA_EXPORT_DELETE_PASS` with real artifacts.
