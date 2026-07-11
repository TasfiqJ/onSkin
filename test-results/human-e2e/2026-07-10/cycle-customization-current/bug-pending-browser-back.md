# E2E Bug Report: Browser Back Escaped A Pending Cycle Save

Severity: Medium
Surface: Expo web
Environment: 390 x 844, one-shot private-write failure enabled
Feature: Custom cycle Save transaction
Date: 2026-07-11
Tester: Codex

## Reproduction Steps

1. Open Custom cycle settings from Week and change the length.
2. Start Save with `EXPO_PUBLIC_E2E_CYCLE_CONFIG_SAVE_FAILURE=once`.
3. Trigger browser Back concurrently with the pending write.

## Expected Result

Settings remains mounted until persistence resolves. A failed write leaves the complete draft and retry alert visible.

## Actual Result

React Navigation's route-removal listener did not consume Expo web history traversal. Browser Back reached Week, unmounting the draft before failure could render.

## Evidence

- Post-fix screenshot: `custom-save-failure-and-back-guard-390x844.png`
- Frequency: Always with a real concurrent browser Back in the affected implementation
- Affected route: `/cycle/settings`
- External service involved: No
- Destructive action involved: No

## Suspected Cause

`beforeRemove` and `usePreventRemove` cover navigation actions and native stack removal, but browser traversal can remain queued until the pending state releases. Sequential automation initially hid this because Back ran only after the awaited click completed.

## Minimal Fix Recommendation

Arm the native removal guard before starting the write. On web, add a same-URL history shield and capture-phase `popstate` handler so Back is consumed before Expo Router processes it. Disarm and remove the shield before rendering failure or dispatching committed success navigation.

## Verification Flow After Fix

1. Start Save without awaiting the click promise.
2. Trigger browser Back 100 ms into the injected 600 ms write.
3. Verify URL and UI remain on Settings during the write and after failure.
4. Retry and verify committed success exits to the updated Week view.

## Post-Fix Evidence

- Screenshot: `custom-save-failure-and-back-guard-390x844.png`
- Result: Pending Back stayed on Settings; the full draft and failure alert remained; retry exited; a follow-up save restored the 8-night fixture.

## Remaining Risk

- Android hardware Back and iOS swipe-back still require release-device verification, although `usePreventRemove` now guards the same pending state natively.
