# E2E Bug Report: Progress first-photo short-phone controls clipped or blocked

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 480 viewport, `EXPO_PUBLIC_E2E_ENTITLEMENT=pro`
Feature: Progress photo first-use flow
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/progress` at a 320 x 480 phone viewport with no progress photos.
2. Inspect the empty-state `Take my first photo` CTA.
3. Open `/progress/capture` and inspect the first-use photo consent actions.
4. Repeat the consent route through legacy `/photos/capture`.

## Expected Result

The Progress first-photo CTA is visible and hit-testable above the floating tab bar. The photo-consent `Take photos. On device only` and `Not now` actions are both readable, 44 pt or larger, hit-testable, and recover safely without opening capture chrome before consent.

## Actual Result

The empty Progress `Take my first photo` CTA rendered at 56 px height but its center was covered by the floating Shelf tab. On `/progress/capture` and redirected `/photos/capture`, `Not now` rendered below the viewport with only an 11 px visible sliver and its center outside the viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/progress-before.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/progress-capture-consent-before.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/legacy-photos-capture-consent-before.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/progress-before.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/progress-capture-consent-before.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/legacy-photos-capture-consent-before.json`

## Frequency

- Always on the audited 320 x 480 route state.

## Scope

- Affected route/screen: `/progress`, `/progress/capture`, `/photos/capture`
- Affected account or fixture: Local Pro entitlement with no progress photos and no saved `photo_capture` consent
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The empty Progress first-run layout was vertically centered without enough bottom clearance for the floating tab bar on the shortest supported phone viewport. The first-use photo consent copy preserved full 320 x 568 spacing on a 320 x 480 viewport, leaving the secondary action below the visible area.

## Minimal Fix Recommendation

Add shortest-phone compaction below 520 px height for the empty Progress first-run surface and the consent gate. Keep the privacy-critical WHAT/WHY/NEVER/backup-off copy visible, but reduce nonessential vertical spacing and hide the prep reminder on the shortest phones.

## Verification Flow After Fix

1. Open `/progress` at 320 x 480 and verify `Take my first photo` is fully visible and not hit-blocked by the floating tab bar.
2. Open `/progress/capture` and verify both consent actions are fully visible, 44 pt or larger, and hit-testable.
3. Open `/photos/capture` and verify the redirected consent route has the same geometry.
4. Tap `Not now` and verify recovery to `/progress`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/progress-fixed.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/progress-capture-consent-fixed.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/legacy-photos-capture-consent-fixed.png`
- Screenshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/not-now-recovery.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/progress-fixed.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/progress-capture-consent-fixed.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/legacy-photos-capture-consent-fixed.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/progress-first-photo-short-phone-480/not-now-recovery.json`

## Remaining Risk

- Untested branches: Native iOS/Android camera permission sheets, Dynamic Type, screen-reader traversal, and hardware safe-area behavior.
- Missing fixtures: Native camera device state.
- Follow-up needed: Add native simulator/device coverage before launch sign-off.
