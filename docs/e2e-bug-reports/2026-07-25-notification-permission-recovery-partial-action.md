# Notification permission recovery action peeked at the viewport edge

Date: 2026-07-25
Severity: P2
Surface: `/settings/notifications`
Status: Fixed and reverified

## Summary

Human-simulated verification of the new permission recovery card found the `Allow notifications` action beginning partially at the bottom of the 390 x 844 first viewport.

## Reproduction

1. Run Expo web with `EXPO_PUBLIC_E2E_NOTIFICATION_PERMISSION=undetermined_then_granted`.
2. Open `/settings/notifications` at 390 x 844.
3. Enable the Morning routine switch.
4. Inspect the bottom of the first viewport.

Expected: the recovery action is either fully visible or fully below the first viewport.

Actual: the recovery copy was readable, but only the beginning of the action entered the viewport.

## Fix

The tail recovery card now starts 40 px lower. Existing calibrated notification rows remain unchanged, while the 56 px action stays fully below the first viewport until the user scrolls.

## Verification

The post-fix 390 x 844 pass shows no partial interactive recovery control in the first viewport. After user scroll, `Allow notifications` is 316 x 56 px and center-hit-testable. The 320 x 568 denied/open-settings branch keeps its action 246 x 56 px, center-hit-testable, and free of horizontal overflow.

Evidence: `test-results/human-e2e/2026-07-25/notification-permission-recovery-current/`.
