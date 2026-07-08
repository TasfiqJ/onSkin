# E2E Bug Report: Progress photo detail used native alerts for recovery

Severity: Medium
Surface: Expo web, native iOS/Android risk
Environment: Codex in-app browser, Expo web, 320 x 568 viewport, populated local Progress photo fixture
Feature: Single-photo Progress detail share and delete actions
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with populated Progress photos and a Pro entitlement fixture.
2. Open `/progress/e2e-front-2026-04-01`.
3. Tap Delete photo.
4. Tap Share photo, confirm sharing, and force the native share helper to fail.

## Expected Result

Sensitive photo actions stay inside the dark Progress route, use explicit route-owned confirmation/recovery UI, open no native or JavaScript dialog, keep 48 px actions visible on compact phones, and leave failed delete/share attempts on the same photo detail.

## Actual Result

The single-photo detail route still used `Alert.alert` for deletion, and the shared photo helper also called `Alert.alert` on share failures even though the route rendered inline recovery. On native builds this could stack platform chrome over the privacy-sensitive photo surface and duplicate recovery messaging.

## Evidence

- Source before fix: `apps/mobile/src/app/progress/[id].tsx`
- Source before fix: `apps/mobile/src/features/photos/sharePhoto.ts`

## Frequency

- Always in the old route/helper code for these branches.

## Scope

- Affected route/screen: `/progress/[id]`
- Affected account or fixture: Populated local Progress photo fixture
- External service involved: Native share sheet for share failure
- Destructive action involved: Yes, local photo deletion

## Suspected Cause

The share branch had been made route-owned at the screen level, but the helper still displayed native alert UI. The delete branch had not yet been migrated from the older platform-alert confirmation pattern.

## Minimal Fix Recommendation

Keep `sharePhotoImageOnly` UI-free and return `false` for all unavailable/failure paths. Replace delete `Alert.alert` with a route-owned confirmation panel, keep Cancel and Delete photo controls at 48 px, add a dev-only delete-failure fixture, and render failed deletes through the same inline alert surface.

## Verification Flow After Fix

1. Open `/progress/e2e-front-2026-04-01` on Expo web at 320 x 568 with populated photos, Pro entitlement, forced share failure, and forced delete failure.
2. Tap Share photo, cancel, reopen, confirm, and verify inline share failure with no JavaScript/native dialog.
3. Tap Delete photo, cancel, reopen, confirm against the forced delete failure, and verify inline delete failure with no JavaScript/native dialog.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-detail-delete-recovery-current/02-share-confirm.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-detail-delete-recovery-current/03-share-inline-failure.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-detail-delete-recovery-current/04-delete-confirm.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-photo-detail-delete-recovery-current/06-delete-inline-failure.png`
- Report: `test-results/human-e2e/2026-07-08/progress-photo-detail-delete-recovery-current/report.md`
- Logs: `test-results/human-e2e/2026-07-08/progress-photo-detail-delete-recovery-current/browser-warn-error-logs.json`

## Remaining Risk

- Native iOS/Android share-sheet rejection chrome, screen-reader announcement order, Dynamic Type, and real encrypted-file deletion failure still need device QA.
