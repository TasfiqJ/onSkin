# E2E Bug Report: Progress photo consent save failure recovery

Date: 2026-07-07

Status: Fixed

Feature: Progress first-use photo capture consent

## Environment

- Surface: Expo web
- URL: `http://localhost:8088/progress/capture`
- Viewport: 320 x 568
- Fixture: `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once`

## Reproduction

1. Start Expo web with the one-shot photo consent failure fixture.
2. Open `/progress/capture` with no saved `photo_capture` consent.
3. Tap `Take photos. On device only`.
4. Tap the same CTA again after the failure copy appears.

## Expected

The first tap must fail closed: no camera permission prompt, no capture path, stable save-failure copy, and a retryable CTA. The second tap must consume the one-shot fixture, save local-only consent, and move to the normal camera permission/capture path.

## Actual Before Fix

The web surface did not expose durable failure copy because the route relied on `Alert.alert`. After adding persistent copy, the retry still stayed blocked because `grantPhotoCaptureConsent` rolled back capture consent when the remote consent ledger failed. In local no-account development, `recordConsent` requires an authenticated Supabase session, so local-only capture could not proceed.

## Fix

- Added a dev-only one-shot `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once` hook for the real capture route.
- Added persistent in-page `role="alert"` failure copy while keeping the consent CTA retryable.
- Stored `photo_capture` as a local proof with consent version, consent-text hash, and timestamp before camera access.
- Kept the immutable ledger write best-effort for local-only photo capture when Supabase/auth is unavailable.
- Left `photo_cloud_backup` fail-closed on ledger failure because it moves images off device.

## Verification

- Focused tests: `npm.cmd --workspace apps/mobile run test -- consent.test.ts applyCaptureConsent.test.ts progressRoutes.test.ts`
- Typecheck: `npm.cmd --workspace apps/mobile run typecheck`
- Human E2E evidence:
  - `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure/02-consent-save-failure-rerun.png`
  - `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure/03-consent-retry-normal-path-rerun.png`
  - `test-results/human-e2e/2026-07-07/progress-photo-consent-save-failure/04-reload-after-consent.png`

## Residual Risk

The browser test stopped at the normal camera permission gate and did not accept camera access. Native camera permission/capture and production Supabase consent-ledger proof remain Phase 5 / production-account evidence gates.
