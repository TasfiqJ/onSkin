# E2E Bug Report: Progress review direct entry showed a fake photo

Severity: High
Surface: Expo web
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Photo Progress review
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/progress/review` directly at a 320 x 568 phone viewport without a `capturedUri` route parameter.
2. Inspect the review screen.
3. Attempt to use the visible review actions.

## Expected Result

The app should show stable photo-not-captured recovery copy, keep the timeline unchanged, and offer safe routes to take a new photo or return to Progress. It must not show a fake photo preview or a save action.

## Actual Result

The route rendered a review screen with `your photo`, quality chips, `Retake`, and `Save to my phone` even though no captured photo existed. The save path could submit `localUri: null`.

## Evidence

- Pre-fix screenshot: `test-results/human-e2e/2026-07-07/direct-entry-compact-sweep-8099/progress__review.png`
- Pre-fix UI snapshot: `test-results/human-e2e/2026-07-07/direct-entry-compact-sweep-8099/progress__review.json`

## Frequency

- Always when `/progress/review` was opened without `capturedUri`.

## Scope

- Affected route/screen: `/progress/review`
- Affected account or fixture: Any direct route entry, refresh, or stale link without a captured photo URI.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The review route treated missing `capturedUri` as a nullable preview state instead of a blocked review state, while the save handler still passed the nullable URI to `add.mutate`.

## Minimal Fix Recommendation

Guard review rendering and saving behind a non-blank captured photo URI. When the URI is missing, show a recovery state with Take photo, Back to Progress, and Close actions.

## Verification Flow After Fix

1. Open `/progress/review` directly at 320 x 568.
2. Confirm the route shows `Photo not captured` and `No photo to review yet.`
3. Confirm `your photo` and `Save to my phone` are absent.
4. Tap `Take photo` and confirm it routes to `/progress/capture`.
5. Reopen `/progress/review`, tap `Back to Progress`, and confirm `/progress`.
6. Reopen `/progress/review`, tap Close, and confirm `/progress`.

## Post-Fix Evidence

- Screenshot:
  - `test-results/human-e2e/2026-07-07/progress-review-direct-entry-recovery/post-fix-recovery-320x568.png`
  - `test-results/human-e2e/2026-07-07/progress-review-direct-entry-recovery/post-fix-take-photo-route-320x568.png`
  - `test-results/human-e2e/2026-07-07/progress-review-direct-entry-recovery/post-fix-back-to-progress-320x568.png`
  - `test-results/human-e2e/2026-07-07/progress-review-direct-entry-recovery/post-fix-close-to-progress-320x568.png`
- UI snapshot:
  - `test-results/human-e2e/2026-07-07/progress-review-direct-entry-recovery/post-fix-recovery-state.json`
  - `test-results/human-e2e/2026-07-07/progress-review-direct-entry-recovery/post-fix-take-photo-route-state.json`
  - `test-results/human-e2e/2026-07-07/progress-review-direct-entry-recovery/post-fix-back-to-progress-state.json`
  - `test-results/human-e2e/2026-07-07/progress-review-direct-entry-recovery/post-fix-close-to-progress-state.json`
- Focused route contract: `npm --workspace apps/mobile run test -- src/features/photos/progressRoutes.test.ts`

## Remaining Risk

- Untested branches: Native camera handoff after the recovery `Take photo` action.
- Missing fixtures: Native stale-link launch with no captured photo URI.
- Follow-up needed: Include the stale review route in Phase 5 device QA.
