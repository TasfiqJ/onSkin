# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify and harden Progress first-use photo consent save failure recovery.
- App surface: Expo web phone-width proxy.
- Build/start command: `EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE=once EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro npm --workspace apps/mobile run web -- --port 8142 --host localhost --clear`
- Browser/device/simulator/OS: Codex in-app browser at 320 x 568.
- Feature or PR tested: `/progress/capture` first-use `photo_capture` consent save failure and retry.
- Overall verdict: Pass with native-device follow-up.

## Tool Inventory

- Expo CLI: available, local dev server on port 8142.
- iOS Simulator: not used.
- Android emulator: not used.
- Expo web: used.
- Playwright/browser API: used for locator clicks, dialog checks, screenshots, geometry, and logs.
- DOM snapshot: unavailable in this in-app browser run because the snapshot helper errored; state JSON and screenshots were captured instead.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Photo Progress | first-use photo consent save failure | Pass | `04-post-fix-inline-failure.png`, `04-post-fix-inline-failure.state.json`, `04-post-fix-dialog.json` | Failed save kept camera and permission path closed, rendered `Photo choice not saved` as a route-owned alert, opened no JS dialog, kept 52 px retry CTA and 48 px `Not now` inside the viewport, and had zero horizontal overflow. |
| Photo Progress | retry after one-shot failure | Pass | `05-post-fix-retry-permission-path.png`, `05-post-fix-retry-permission-path.state.json` | Retry consumed the one-shot fixture and reached the normal web camera-permission path with `Allow camera` and `Not now`. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |
| `2026-07-08-progress-photo-consent-native-alert` | High | Inspect the first-use consent failure handler while running the forced failure branch. | Route-owned inline recovery only for consent persistence failure. | The route still called `Alert.alert` in the same failure callback, which would create native system-dialog recovery on iOS/Android. | `docs/e2e-bug-reports/2026-07-08-progress-photo-consent-native-alert.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/photos/applyCaptureConsent.test.ts`
- What it covers: the `/progress/capture` source contract now rejects `Alert.alert(PHOTO_COPY.capture.consentFailedTitle...)` while keeping the inline alert and retry path.
- Why this should be automated: first-use photo consent is a privacy gate and must fail closed without duplicate recovery channels.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/photos/applyCaptureConsent.test.ts src/features/photos/progressRoutes.test.ts src/features/photos/consent.test.ts
```

Result: 3 files passed, 25 tests passed.

## Remaining Risk

- Native iOS/Android camera permission sheets and real camera startup were not covered by this Expo web pass.
- Physical-device QA must verify no native/system alert appears, no camera or permission prompt appears before saved consent, retry saves consent before permission, and consent remains past the gate after restart.
- Current-origin browser warn/error logs were empty; unfiltered browser logs contained stale warnings from older localhost tabs and were saved separately.
