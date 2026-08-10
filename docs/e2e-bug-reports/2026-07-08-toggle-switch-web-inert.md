# E2E Bug Report: Shared web switch was inert through user activation

Severity: High
Surface: Expo web
Environment: Codex in-app browser, 320 x 568 viewport, Expo web on port 8139 with Ask cloud-consent E2E fixtures
Feature: Shared `ToggleSwitch` used by Ask consent and other settings/consent surfaces
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true`, `EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once`, and `EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only`.
2. Open `/ask/consent` at a 320 x 568 viewport.
3. Scroll until `Enable Ask Layerwell` is visible.
4. Activate the switch by role click, visible coordinate click, or DOM-node click.

## Expected Result

The switch should call the consent handler. With the one-shot grant failure fixture, it should keep `aria-checked=false`, render persistent route-owned `Choice not saved` feedback, keep retry possible, and open no native or JavaScript dialog.

## Actual Result

The switch rendered with the correct `role="switch"`, `aria-checked=false`, and 52 x 48 geometry, but user-like browser activation did not call the handler. The visible state stayed unchanged and no failure alert appeared.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/ask-consent-failure-current/01b-toggle-visible-before-grant.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/ask-consent-failure-current/01b-toggle-visible-before-grant.json`
- Post-fix screenshots: `test-results/human-e2e/2026-07-08/ask-consent-failure-current/02-grant-failure-inline-alert.png`, `03-grant-retry-success.png`, `04-revoke-failure-inline-alert.png`, `05-revoke-retry-success.png`
- Logs: `test-results/human-e2e/2026-07-08/ask-consent-failure-current/browser-warn-error-logs.json`

## Frequency

- Always in the pre-fix in-app browser run.

## Scope

- Affected route/screen: `/ask/consent`; likely any Expo web surface using `ToggleSwitch`.
- Affected account or fixture: local Expo web with Ask consent failure fixtures.
- External service involved: none. The branch used the local-only ledger fixture.
- Destructive action involved: no.

## Suspected Cause

`ToggleSwitch` set `onPress={Platform.OS === 'web' ? undefined : activate}` and relied on web-specific `onClick`. The React Native web node exposed the right accessibility role, but the app-surface activation paths used in E2E did not trigger the custom `onClick`, leaving the switch inert.

## Minimal Fix Recommendation

Use React Native `Pressable`'s `onPress={activate}` across platforms, keep the explicit web `tabIndex`, and add a small web Space-key handler because Enter toggles through the press responder while Space did not.

## Verification Flow After Fix

1. Reload `/ask/consent` with the same fixtures and normalize the switch to off.
2. Scroll to `Enable Ask Layerwell`.
3. Activate the switch: failed grant keeps the switch off and renders inline `Choice not saved`.
4. Retry: grant succeeds, switch turns on, and the alert clears.
5. Activate again: failed withdrawal keeps the switch on and renders inline `Choice not saved`.
6. Retry: withdrawal succeeds, switch turns off, and the alert clears.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/ask-consent-failure-current/02-grant-failure-inline-alert.png`
- Screenshot: `test-results/human-e2e/2026-07-08/ask-consent-failure-current/03-grant-retry-success.png`
- Screenshot: `test-results/human-e2e/2026-07-08/ask-consent-failure-current/04-revoke-failure-inline-alert.png`
- Screenshot: `test-results/human-e2e/2026-07-08/ask-consent-failure-current/05-revoke-retry-success.png`
- UI snapshots: matching `.json` files in the same folder
- Logs: `test-results/human-e2e/2026-07-08/ask-consent-failure-current/browser-warn-error-logs.json`

## Remaining Risk

- Untested branches: native iOS/Android switch activation and screen-reader traversal.
- Missing fixtures: live authenticated Supabase consent ledger is still blocked by production credentials.
- Follow-up needed: native device QA for shared switch surfaces that manage privacy/security state.
