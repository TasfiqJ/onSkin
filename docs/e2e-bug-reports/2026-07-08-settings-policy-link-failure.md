# E2E Bug Report: Settings policy link failures are not visibly recoverable on Expo web

Severity: Medium
Surface: Expo web, with native handoff parity risk
Environment: Expo web on `localhost:19146`, System Chrome, 320 x 568 phone viewport, `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser`
Feature: Settings account controls, policy/help links
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with valid placeholder policy URLs and `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser`.
2. Open `/settings/privacy`, which redirects to `/you?section=privacy`.
3. Tap Privacy policy, Consumer health privacy, Terms, Support, Account deletion, and Data export while browser handoff is forced to fail.

## Expected Result

Each failed policy/help handoff shows clear recovery copy, stays inside Settings, and does not leave the user wondering whether the tap worked.

## Actual Result

Before the fix, Settings relied only on `Alert.alert` from the shared external-open helper. In this Expo web run, Playwright observed no browser dialog and no visible in-app recovery copy after six failed handoffs, even though the policy rows stayed tappable.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/settings-policy-link-failure/01-policy-list-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/settings-policy-link-failure/summary.json`
- Browser logs: `test-results/human-e2e/2026-07-08/settings-policy-link-failure/browser-logs.json`
- Terminal transcript: first Playwright run in Codex terminal failed with zero observed dialogs.

## Frequency

- Always in the forced failed-handoff Expo web fixture.

## Scope

- Affected route/screen: `/settings/privacy` -> `/you?section=privacy`
- Affected account or fixture: Local Settings privacy direct-entry state
- External service involved: No live external service; policy URLs were valid placeholder HTTPS URLs and browser opening was forced to fail locally.
- Destructive action involved: No

## Suspected Cause

The shared helper correctly owns native/browser handoff validation and alert copy, but the Settings web surface had no persistent in-app feedback when `Alert.alert` was not surfaced as an observable browser dialog.

## Minimal Fix Recommendation

Keep the shared external-open helper, add a development-only failed-handoff fixture for deterministic E2E, and show row-local Settings feedback when the helper returns `false`.

## Verification Flow After Fix

1. Reopen `/settings/privacy` at 320 x 568 with `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser`.
2. Tap all six policy/help rows.
3. Verify each row remains at least 44 px tall, each failed handoff renders row-local `Link unavailable` recovery copy, horizontal overflow is zero, and the route remains `/you?section=privacy`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/settings-policy-link-failure/02-after-alerts-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/settings-policy-link-failure/summary.json`
- Browser logs: `test-results/human-e2e/2026-07-08/settings-policy-link-failure/browser-logs.json`
- Terminal transcript: final Playwright run passed.

## Remaining Risk

- Untested branches: Native iOS/Android OS browser handoff failure UI.
- Missing fixtures: Native E2E harness for real Linking/WebBrowser failures.
- Follow-up needed: Repeat policy, billing, and support link handoff failure on physical beta devices once native builds exist.
