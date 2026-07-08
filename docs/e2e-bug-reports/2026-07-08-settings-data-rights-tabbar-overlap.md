# E2E Bug Report: Data-rights confirmation overlapped the tab bar

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 568 viewport, local placeholder Supabase
Feature: You tab destructive data-rights confirmations
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Open `/settings/privacy` on a 320 x 568 viewport.
2. Tap `Withdraw health-data consent`.
3. Tap the visible `Withdraw & delete` button without manually scrolling.

## Expected Result

The destructive confirmation controls remain fully above the floating tab bar, so tapping the confirm button activates the confirmation action and keeps the route on `/you?section=privacy`.

## Actual Result

The inline confirmation rendered too low after insertion. The `Withdraw & delete` control intersected the floating tab bar, and a click at the button center activated the `Shelf` tab instead of confirming withdrawal.

## Evidence

- Screenshot before final fix: same flow reproduced during the run; final post-fix screenshots are retained in the evidence folder.
- Post-fix screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/06-withdraw-inline-confirmation.png`
- Post-fix screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/07-withdraw-inline-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/browser-warn-error-logs.json`

## Frequency

- Reproduced once during the compact-width withdrawal branch before the scroll-nudge fix.

## Scope

- Affected route/screen: `/you?section=privacy`
- Affected account or fixture: Local placeholder Supabase
- External service involved: None for the overlap itself
- Destructive action involved: Yes, health-data consent withdrawal and account deletion confirmations

## Suspected Cause

The confirmation card was inserted below the initiating row without adjusting the ScrollView position, while the app uses a floating tab bar over the bottom of the viewport.

## Minimal Fix Recommendation

Track the ScrollView offset and nudge the viewport down after opening a destructive data-rights confirmation so both confirm and Cancel controls are above the tab bar on compact screens.

## Verification Flow After Fix

1. Open `/settings/privacy` on a 320 x 568 viewport.
2. Tap `Delete account`; verify Delete and Cancel controls are 56 px tall and above the tab bar.
3. Tap `Withdraw health-data consent`; verify `Withdraw & delete` and Cancel controls are 56 px tall and above the tab bar.
4. Confirm withdrawal against the unavailable backend and verify the route stays `/you?section=privacy`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/03-delete-inline-confirmation.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/06-withdraw-inline-confirmation.png`
- Screenshot: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/07-withdraw-inline-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/settings-data-rights-inline-recovery-current/browser-warn-error-logs.json`

## Remaining Risk

- Native iOS/Android safe-area, home-indicator, Dynamic Type, and screen-reader traversal still need physical-device QA.
