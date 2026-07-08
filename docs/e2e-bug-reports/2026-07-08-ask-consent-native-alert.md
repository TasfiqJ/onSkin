# E2E Bug Report: Ask consent failure used native alert recovery

Severity: High
Surface: Expo web
Environment: Expo web at 320 x 568, `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true`, `EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once`, `EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only`
Feature: Ask RoutineKind cloud consent gate
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with Cloud Ask enabled and a forced Ask consent save failure.
2. Open `/ask/consent` on a compact phone viewport.
3. Toggle `Enable Ask RoutineKind`.

## Expected Result

The consent state must fail closed, the route must show persistent in-app recovery copy, retry must remain possible, and no native or JavaScript dialog should interrupt the polished mobile surface.

## Actual Result

Before the fix, the failure handler called `Alert.alert`, so failure recovery depended on a native/platform dialog instead of durable route-owned feedback. On web-compatible E2E surfaces, this can create missing, duplicate, or blocking recovery behavior.

## Evidence

- Screenshot: pending post-fix run
- Logs: pending post-fix run
- UI snapshot: pending post-fix run

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

- Screenshot: pending post-fix run
- Logs: pending post-fix run
- UI snapshot: pending post-fix run
- Terminal transcript: pending focused checks

## Remaining Risk

- Untested branches: native iOS/Android consent animation and authenticated Supabase consent-ledger save/withdrawal.
- Missing fixtures: live authenticated consent ledger for production-like verification.
- Follow-up needed: device QA before Cloud Ask is release-enabled.
