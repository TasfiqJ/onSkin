# E2E Bug Report: App Lock Failure Recovery Used Blocking Native Alerts

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 568 viewport, app-lock E2E fixtures
Feature: Biometric app lock and Progress photo timeline lock
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=true`, `EXPO_PUBLIC_E2E_APP_LOCK_AUTH=unavailable`, `EXPO_PUBLIC_E2E_APP_LOCK_READY=available`, populated Progress photos, and store Pro entitlement.
2. Open `/progress` so the app-wide lock overlay and Progress timeline lock are active.
3. Tap Unlock while local authentication is unavailable.
4. Restart Expo web with app lock disabled and `EXPO_PUBLIC_E2E_APP_LOCK_READY=unavailable`.
5. Open `/you`, activate the App lock switch.

## Expected Result

The app stays locked when authentication is unavailable, shows stable device-neutral recovery copy on the owning surface, keeps Unlock or the switch retryable, keeps user cancellation quiet, and opens no blocking JavaScript or native dialog.

## Actual Result

Before this fix, app-lock unavailable recovery used `Alert.alert` in the global provider, Progress timeline lock, and You-tab switch catch path. On web this can become a blocking JavaScript dialog, and on native it stacks OS chrome over the polished locked surface instead of leaving durable route-owned recovery.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/01-app-lock-overlay-inline-feedback.png`
- Screenshot: `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/02-app-lock-retry-no-dialog.png`
- Screenshot: `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/03-you-app-lock-toggle-inline-feedback.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/summary.json`
- Logs: `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/browser-warn-error-logs.json`
- Terminal transcript: focused app-lock/settings tests, typecheck, and lint passed locally.

## Frequency

- Always with the forced app-lock unavailable fixtures.

## Scope

- Affected route/screen: app-wide `AppLockProvider` overlay, Progress tab gallery lock, You tab Security card.
- Affected account or fixture: local Expo web with app-lock E2E fixtures.
- External service involved: Device local-auth is simulated locally for E2E; live native biometric prompt not used.
- Destructive action involved: None.

## Suspected Cause

The lock surfaces used the shared `authenticateAppLock` helper, but still handled unavailable status by opening native alerts. That kept cancellation quiet, but made true native-auth unavailability transient and disconnected from the lock surface.

## Minimal Fix Recommendation

Move unavailable recovery into inline feedback owned by the lock overlay, Progress gallery lock, and You-tab App lock row. Add dev-only auth/readiness/enabled fixtures so the branch can be tested without real device biometrics.

## Verification Flow After Fix

1. Run focused app-lock/settings source contracts plus typecheck and lint.
2. Start Expo web with app-lock enabled and auth unavailable.
3. Open `/progress`, verify the app stays locked, the inline app-lock-unavailable message is visible, Unlock remains 44 pt+, retry opens no dialog, and overflow is zero.
4. Restart Expo web with app lock disabled and readiness unavailable.
5. Open `/you`, activate App lock, verify the switch remains off, row-local feedback appears, no raw provider text leaks, no dialog opens, and overflow is zero.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/01-app-lock-overlay-inline-feedback.png`
- Screenshot: `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/02-app-lock-retry-no-dialog.png`
- Screenshot: `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/03-you-app-lock-toggle-inline-feedback.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/summary.json`
- Logs: `test-results/human-e2e/2026-07-08/app-lock-inline-recovery-current/browser-warn-error-logs.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/lib/applock/authenticate.test.ts src/lib/applock/store.test.ts src/features/settings/applyPrivacyChoice.test.ts src/features/photos/progressRoutes.test.ts` passed 31 tests.
- Terminal transcript: `npm --workspace apps/mobile run typecheck` passed.
- Terminal transcript: `npm --workspace apps/mobile run lint` passed.

## Remaining Risk

- Native iOS and Android biometric prompt chrome, cancellation gestures, and OS-level unavailable prompts still need device/simulator QA.
- The durable mobile E2E harness decision remains open; this branch is currently covered through Expo web plus source contracts.
