# E2E Bug Report: Progress photo share confirmation can appear inert

Severity: Medium
Surface: Expo web
Environment: In-app browser, 320 x 568, `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, `EXPO_PUBLIC_E2E_SHARE_PHOTO_FAILURE=1`, local Expo web on port 19163
Feature: Progress single-photo detail sharing
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with populated progress photos, store-backed Pro, and forced photo-share failure.
2. Open `/progress/e2e-front-2026-04-01` at 320 x 568.
3. Tap the `Share photo` icon.

## Expected Result

The user sees an immediate confirmation UI, can cancel or confirm sharing, remains on the photo detail after failure, and sees stable share-unavailable recovery copy.

## Actual Result

Before the fix, the route used `Alert.alert` for the share confirmation. In the Expo web surface used for E2E, tapping the share icon did not expose an actionable dialog or run the share callback, so the action appeared inert and no durable route-local failure feedback could render.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/01-before-share.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/02-share-confirmation.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/03-after-share-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/browser-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/confirmation-state.json`

## Frequency

- Always on the tested Expo web share-confirmation path.

## Scope

- Affected route/screen: `/progress/[id]`
- Affected account or fixture: Populated progress fixture with store-backed Pro entitlement.
- External service involved: No live external service; native share failure forced locally.
- Destructive action involved: No.

## Suspected Cause

The route delegated share confirmation to the platform alert API. That API is inconsistent on Expo web and does not provide durable in-route state, so failures could be invisible or feel like no action occurred.

## Minimal Fix Recommendation

Use a route-owned confirmation panel for photo sharing, await `sharePhotoImageOnly`, and render an accessible in-route failure panel when the helper returns `false`.

## Verification Flow After Fix

1. Open `/progress/e2e-front-2026-04-01` at 320 x 568.
2. Tap the share icon and verify the route-owned confirmation panel is visible with 48 px Cancel and Share photo controls.
3. Tap the panel `Share photo` action and verify the failure alert is visible, the route stays on the same photo detail, and browser logs remain clean.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/03-after-share-failure.png`
- Logs: `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/browser-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-photo-detail-share-failure-current/after-state.json`

## Remaining Risk

- Untested branches: Native iOS/Android share sheet rejection after decrypting a real encrypted photo export.
- Missing fixtures: Device-level encrypted photo bytes and native OS share target failure.
- Follow-up needed: Native share-sheet and encrypted export cleanup QA before launch.
