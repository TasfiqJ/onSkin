# E2E Bug Report: First-run reset retained the withdrawal control journal

- Severity: Medium
- Surface: Expo web
- Environment: Development Expo web with `EXPO_PUBLIC_E2E_LOCAL_RESET=1`
- Feature: Dev-only first-run fixture and health-withdrawal recovery
- Date: 2026-07-15
- Tester: Codex in-app browser

## Reproduction Steps

1. Complete a local health-data withdrawal so the account-preserving paused shell is durable.
2. Open `/?e2eReset=local` to request a clean first-run fixture.
3. Wait for the reset route to replace itself with `/`.

## Expected Result

The development-only fixture opens Welcome with no user data or recovery state, allowing a deterministic first-session replay.

## Actual Result

Private user data was cleared, but the deliberately durable withdrawal-control journal survived and immediately reopened the paused shell.

## Evidence

- UI snapshot: reset URL rendered `HEALTH DATA PAUSED` and `Status: withdrawn. Local cleanup complete.`
- Screenshot: `test-results/human-e2e/2026-07-15/health-consent-withdrawal-current/06-withdrawn-paused-shell-390x844.png`

## Frequency

- Always after a completed local withdrawal

## Scope

- Affected route/screen: `/?e2eReset=local`
- Affected account or fixture: development-only local reset
- External service involved: none
- Destructive action involved: local test-fixture reset only

## Suspected Cause

`clearLocalPrivateData()` correctly preserves recovery controls for production safety. The dev-only fixture called it without separately removing exact secure-control keys and owner-prefixed recovery capabilities.

## Minimal Fix Recommendation

Keep production cleanup unchanged. Only inside the existing `__DEV__` plus environment-gated reset path, remove the exact control-key inventory and matching secure-control prefixes after ordinary private-data cleanup.

## Verification Flow After Fix

1. Complete withdrawal and verify the paused shell survives an ordinary reload.
2. Open the gated reset URL.
3. Confirm Welcome appears, then complete the age and consent flow.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-15/health-consent-withdrawal-current/01-welcome-390x844.png`
- Focused route contract asserts the reset remains development/environment gated and clears secure exact/prefixed controls.

## Remaining Risk

- This fixture is not a production user action and must remain unreachable in release builds.
