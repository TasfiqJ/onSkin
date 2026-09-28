# E2E Bug Report: Ask consent failure used native alert recovery

Severity: High
Surface: Expo web static export
Environment: Expo web static export at 320 x 568, `APP_VARIANT=development`, `EXPO_PUBLIC_APP_ENV=development`, `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true`, `EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once`, `EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only`
Feature: Ask Layerwell cloud consent gate
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with Cloud Ask enabled and a forced Ask consent save failure.
2. Open `/ask/consent` on a compact phone viewport.
3. Toggle `Enable Ask Layerwell`.

## Expected Result

The consent state must fail closed, the route must show persistent in-app recovery copy, retry must remain possible, and no native or JavaScript dialog should interrupt the polished mobile surface.

## Actual Result

Before the fix, the failure handler called `Alert.alert`, so failure recovery depended on a native/platform dialog instead of durable route-owned feedback. On web-compatible E2E surfaces, this can create missing, duplicate, or blocking recovery behavior.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/main-branch-merge/ask-consent-inline-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/main-branch-merge/state.json`
- UI snapshot: at 320 x 568 the route showed the Back button, `Enable Ask Layerwell` switch, and `Open Ask Layerwell` CTA without horizontal overflow.

## Frequency

- Always when the Ask consent ledger grant or withdrawal path failed.

## Scope

- Affected route/screen: `/ask/consent`
- Affected account or fixture: Cloud Ask enabled, consent ledger save/withdrawal failure
- External service involved: Supabase consent ledger for production verification
- Destructive action involved: No

## Suspected Cause

The route delegated failure communication to `Alert.alert` inside the `applyAskConsentChoice` failure callback. That is inconsistent with the app's route-owned recovery pattern for trust-critical privacy gates and is not dependable enough for compact web E2E or native polish.

## Minimal Fix Recommendation

Remove `Alert.alert` from the Ask consent route, keep the consent toggle fail-closed, add persistent `accessibilityRole="alert"` recovery copy below the toggle, and add dev-only one-shot grant/revoke failure fixtures with a local-only ledger mode for repeatable E2E.

## Verification Flow After Fix

1. Start Expo web with `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true`, `EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once`, and `EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only`.
2. Open `/ask/consent` at 320 x 568.
3. Toggle on, confirm inline failure and no dialog, retry successfully, toggle off, confirm inline failure and no dialog, then retry successfully.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/main-branch-merge/ask-consent-inline-failure.png`
- Logs and UI state: `test-results/human-e2e/2026-07-08/main-branch-merge/state.json`
- UI snapshot: the failed consent save produced durable in-route recovery copy, left the switch fail-closed with `aria-checked="false"`, and did not trigger a JavaScript dialog.
- Terminal transcript: full branch-merge checks passed with `npm run typecheck`, `npm run lint`, `npm test`, and `node scripts/phase9/store-build-inspect.mjs`.

## Remaining Risk

- Untested branches: native iOS/Android consent animation and authenticated Supabase consent-ledger save/withdrawal.
- Static export limitation: the export is not `__DEV__`, so the one-shot local-ledger retry success path still needs Expo dev-server or native verification.
- Follow-up needed: device QA before Cloud Ask is release-enabled.
