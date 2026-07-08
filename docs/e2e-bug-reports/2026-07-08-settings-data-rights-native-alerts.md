# E2E Bug Report: Settings data-rights recovery used native alerts

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 568 viewport, local placeholder Supabase
Feature: You tab privacy and data-rights controls
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/settings/privacy`.
2. Tap `Export my data` while the data-rights backend is unavailable.
3. Tap `Delete account` or `Withdraw health-data consent`.

## Expected Result

Recoverable export and data-rights failures stay on the route, show inline raw-error-free feedback, and destructive actions require an in-app second confirmation with visible Cancel and confirm controls.

## Actual Result

The route used `Alert.alert` for export unavailable/failure, delete confirmation/failure, withdrawal confirmation/failure, and cloud-backup success copy. That handed privacy recovery and destructive confirmation to platform chrome instead of the premium route surface.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/02-export-inline-failure.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/03-delete-inline-confirmation.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/05-delete-inline-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/browser-warn-error-logs.json`

## Frequency

- Always in the old route code for these branches.

## Scope

- Affected route/screen: `/you?section=privacy`
- Affected account or fixture: Local placeholder Supabase, backend unavailable
- External service involved: Supabase data-rights Edge Functions and consent ledger
- Destructive action involved: Yes, account deletion and health-data consent withdrawal

## Suspected Cause

The route mixed inline feedback for privacy toggles with older native alert patterns for data export and destructive account actions.

## Minimal Fix Recommendation

Replace native alerts with route-owned inline notice and confirmation cards, keep destructive actions behind a second explicit button press, and preserve raw-error-free user messages.

## Verification Flow After Fix

1. Open `/settings/privacy` on Expo web at 320 x 568.
2. Tap `Export my data` with placeholder Supabase unavailable.
3. Tap `Delete account`, cancel, then confirm against the unavailable backend.
4. Tap `Withdraw health-data consent`, then confirm against the unavailable backend.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/02-export-inline-failure.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/03-delete-inline-confirmation.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/04-delete-cancelled.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/05-delete-inline-failure.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/06-withdraw-inline-confirmation.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/07-withdraw-inline-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/browser-warn-error-logs.json`

## Remaining Risk

- Native iOS/Android delete, withdrawal, data-export share sheet, and live Supabase data-rights Edge Function evidence remain Phase 5/7/9 QA.
- Cloud-backup success still needs live consent-ledger/native evidence because it correctly fails closed without ledger persistence.
