# E2E Bug Report: Account Method Recovery Target Below 44 Pixels

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, 360 x 640, Expo development build
Feature: Anonymous email account upgrade
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Start `npm run e2e:onboarding-account-upgrade`.
2. Complete onboarding to `/onboarding/account`, enter an email, and tap `Email me a code`.
3. Inspect the `Use a different method` recovery control.

## Expected Result

Every visible phone action has at least a 44 px touch target and remains clear of the fixed `Not now` footer.

## Actual Result

`Use a different method` rendered at 40 px high. It was visible and hit-testable, but below the phone accessibility target.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/onboarding-account-upgrade-account-target-prefix/16a-account-code-entry.png`
- UI snapshot: `test-results/human-e2e/2026-07-10/onboarding-account-upgrade-account-target-prefix/16a-account-code-entry.json`
- Terminal transcript: E2E assertion `16a-account-code-entry has 1 visible control issue(s)`

## Frequency

- Always

## Scope

- Affected route/screen: `/onboarding/account`, email code stage
- Affected account or fixture: development-only `email_same_user` fixture
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The recovery `Pressable` used vertical padding only and had no minimum height, producing a 40 px rendered target.

## Minimal Fix Recommendation

Give the recovery control `min-h-[48px]` and vertically center its label, matching the route's existing footer action.

## Verification Flow After Fix

1. Re-run the deterministic account-upgrade flow at 360 x 640.
2. Confirm the recovery target is at least 44 px and all route geometry assertions pass.
3. Submit an invalid code, recover with `424242`, and complete the downstream activation flow.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/onboarding-account-upgrade-current/16a-account-code-entry.png`
- UI snapshot: `test-results/human-e2e/2026-07-10/onboarding-account-upgrade-current/16a-account-code-entry.json` records the target at 48 px with `hitOk=true`, zero issues, and zero horizontal overflow.
- Full flow: `test-results/human-e2e/2026-07-10/onboarding-account-upgrade-current/summary.json` records `verdict=pass`, invalid-code recovery, valid-code paywall handoff, and completed AM/PM check-offs.
- Logs: `test-results/human-e2e/2026-07-10/onboarding-account-upgrade-current/browser-warn-error-logs.json` contains no disallowed browser warnings/errors.

## Remaining Risk

- Untested branches: Live email delivery and native Apple/Google account linking
- Missing fixtures: Tas-owned Supabase/provider accounts and supported physical devices
- Follow-up needed: Complete `B-VERIFY-AUTH-LINKING`
