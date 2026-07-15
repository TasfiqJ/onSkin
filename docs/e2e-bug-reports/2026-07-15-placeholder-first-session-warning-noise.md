# E2E Bug Report: Placeholder first-session run emitted avoidable auth warnings

Severity: Low
Surface: Expo web
Environment: Windows local Expo development server, placeholder Supabase configuration, 390 x 844 headless Chrome
Feature: Maintained first-session activation harness
Date: 2026-07-15
Tester: Codex

## Reproduction Steps

1. Run the maintained first-session harness with unconfigured Supabase placeholders.
2. Add the three onboarding Shelf products and continue through AM and PM Today check-offs.
3. Inspect the final browser warning/error gate.

## Expected Result

The local-only fixture should avoid backend work that cannot succeed, and the warning gate should remain strict without adding broad exceptions for real configured-backend failures.

## Actual Result

The UI flow completed, but the final gate found six disallowed warnings: three `shelf_mirror_upsert_failed` events carrying `AuthSessionMissingError`, plus three duplicate-client warnings for `sb-blocked-supabase-url-auth-token:1` after deliberate full-page navigations.

## Evidence

- Logs: `test-results/human-e2e/2026-07-15/today-opt114-current/browser-warn-error-logs.json`
- Terminal transcript: `Unexpected browser warn/error logs: 6`
- UI snapshot: all Today checkpoints in the same folder completed before the log assertion

## Frequency

- Always for this placeholder first-session run before the fix

## Scope

- Affected route/screen: onboarding Shelf intake and every full web document load
- Affected account or fixture: signed-out development fixture with unconfigured Supabase
- External service involved: no live service
- Destructive action involved: no

## Suspected Cause

Shelf best-effort mirrors entered authenticated owner capture even when Supabase was explicitly unconfigured. Separately, the anonymous account-deletion completion client was created eagerly at module load without a distinct auth storage key, so auth-js reported a second client for the placeholder key.

## Minimal Fix Recommendation

Skip Shelf mirror owner/network work when Supabase is unconfigured. Create the anonymous deletion-receipt client only when the capability lookup is actually requested and assign its nonpersistent auth client a distinct storage key. Keep the E2E warning allowlist unchanged so configured-backend regressions still fail.

## Verification Flow After Fix

1. Repeat the exact maintained first-session flow at 390 x 844.
2. Confirm all three Shelf products still persist locally and build the routine.
3. Confirm the final warning gate passes without `shelf_mirror_upsert_failed` or duplicate GoTrue-client warnings.

## Post-Fix Evidence

- Screenshot sequence: `test-results/human-e2e/2026-07-15/today-opt114-final/`
- Logs: `test-results/human-e2e/2026-07-15/today-opt114-final/browser-warn-error-logs.json` contains only the accepted placeholder configuration and Expo web notification warnings
- UI snapshot: `test-results/human-e2e/2026-07-15/today-opt114-final/report.md`
- Terminal transcript: `Onboarding first-session E2E passed.`

## Remaining Risk

- Untested branches: configured authenticated mirror failure and live deletion-receipt lookup
- Missing fixtures: live Supabase test account
- Follow-up needed: retain strict warning handling for configured environments
