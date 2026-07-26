# E2E Bug Report: Denied notification toggle crashes Expo web while opening native Settings

Severity: Medium
Surface: Expo web
Environment: Expo SDK 56 development web preview; Codex in-app browser; 1279 x
720 evidence raster; local placeholder Supabase configuration. Dirty working
tree based on `f0ccac28e24fa7800c7b4a353576647a14a68cf7`.
Feature: CORE-05 notification authorization recovery and effective-off settings
Date: 2026-07-26
Tester: Codex

## Reproduction Steps

1. Open `/settings/notifications` in the Expo development web preview while
   notification authorization is denied/unavailable.
2. Confirm the Morning routine switch renders off.
3. Activate the Morning routine switch.

## Expected Result

The browser preview remains on Notification Settings, explains that
notification permission is unavailable in the browser preview, leaves every
reminder purpose effectively off, and does not attempt a native Settings
handoff.

## Actual Result

The route displayed the Expo uncaught-error overlay:
`Linking.default.openSettings is not a function`. The settings UI was obscured,
so the pre-fix screenshot is reproduction evidence, not an all-off pass.

## Evidence

- Screenshot:
  `test-results/human-e2e/2026-07-26/core05-notification-local-contract/settings-web-open-settings-crash-prefix.jpg`
- Video: Not captured
- Trace: Not captured
- Logs: The browser log contained the same TypeError and stack at
  `setAuthorizedToggle`; the exact standalone pre-fix log was not retained.
- UI snapshot: Not retained before the fix
- Terminal transcript: Not retained

## Frequency

- Once. Only one pre-fix observation was retained.

## Scope

- Affected route/screen: `/settings/notifications`, denied authorization branch
  in Expo web
- Affected account or fixture: local development onboarding state; browser
  notification authorization unavailable
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The denied branch called React Native `Linking.openSettings()` from Expo web,
where that native handoff is unavailable.

## Minimal Fix Recommendation

Keep the web branch local and non-mutating: show browser-preview-unavailable
copy, do not render or call Open Settings on web, and keep purposes effectively
off. Keep the native Settings handoff only where the API exists.

## Verification Flow After Fix

1. Open the current exact source in a clean Expo-web browser tab.
2. Open `/settings/notifications` and activate Morning routine.
3. Confirm no overlay, dialog, or navigation; the unavailable banner remains
   and the switch remains `aria-checked="false"`.
4. Inspect the clean tab's browser log for runtime errors.

## Post-Fix Evidence

- Screenshot:
  `test-results/human-e2e/2026-07-26/core05-notification-local-contract/settings-web-unavailable-all-off-postfix.jpg`
- Video: Not captured
- Trace: Not captured
- Logs: The clean post-fix tab recorded development/environment warnings but
  no error entry after the interaction.
- UI snapshot: The clean post-fix snapshot retained the unavailable banner, six
  switches, and `aria-checked="false"` for the Morning switch after activation.
- Terminal transcript: Focused typecheck, lint, source-contract, and notification
  tests passed after the fix.

## Remaining Risk

- Untested branches: native Settings handoff failure, iOS denied/revoked return,
  authorized/provisional/ephemeral outcomes, request errors, accessibility, and
  supported-phone layouts
- Missing fixtures: deterministic native authorization fixtures and scheduled
  notification inventory
- Follow-up needed: iOS Simulator and physical-iPhone permission, foreground,
  relaunch, scheduling, cancellation, and archive-identical QA
