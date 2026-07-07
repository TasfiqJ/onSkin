# E2E Bug Report: Progress photo picker needed a named dialog

Severity: Medium
Surface: Expo web / native accessibility semantics
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Progress comparison photo picker
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Seed at least two local progress photos.
2. Open `/progress` at a 320 x 568 phone viewport.
3. Tap the first comparison date chip to open the comparison photo picker.
4. Inspect the modal dialog boundary, dismiss control, photo-tile labels, touch geometry, and horizontal overflow.

## Expected Result

The picker exposes one named modal dialog, keeps a named dismiss action, labels each photo tile with the comparison target, keeps visible controls at least 44 px, and does not horizontally overflow.

## Actual Result

The picker used React Native `Modal`, but the route contract did not require a stable accessible dialog name or contextual labels for the image-only photo tiles.

## Evidence

- Source review: `apps/mobile/src/app/(tabs)/progress.tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Progress Photos / direct-entry back, close, and permission escape
- App-surface evidence folder: `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/`

## Frequency

- Always on the comparison picker when the user has at least two local progress photos.

## Scope

- Affected route/screen: `/progress`
- Affected account or fixture: Any user with a populated local progress-photo series
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The comparison picker is a custom `Modal` outside the shared `Sheet` component and predated the single-dialog naming contract.

## Minimal Fix Recommendation

Pass the visible picker title to the `Modal` wrapper as its accessible label, keep `accessibilityViewIsModal` on the sheet body, and label every photo tile with the date plus whether it selects the first or second comparison photo.

## Verification Flow After Fix

1. Seed two local progress photos.
2. Open `/progress` at 320 x 568.
3. Tap the first comparison date chip.
4. Confirm exactly one modal dialog with `aria-modal="true"` and `aria-label="Choose the first photo"` renders.
5. Confirm the named dismiss control, contextual photo-tile labels, 44 px visible controls, and no horizontal overflow.
6. Dismiss the picker and confirm the route remains on `/progress`.

## Post-Fix Evidence

- Populated picker screenshots:
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-progress-ready-320x568.png`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-photo-picker-dialog-320x568.png`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-photo-picker-dismissed-320x568.png`
- Populated picker UI snapshots:
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-progress-ready-state.json`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-photo-picker-dialog-state.json`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-photo-picker-dismissed-state.json`
- Data-URI save limitation screenshots:
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/capture-consent-320x568.png`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/review-direct-data-uri-320x568.png`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/progress-after-web-save-attempt-320x568.png`
- Data-URI save limitation UI snapshots:
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/review-visible-dom.txt`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/progress-after-web-save-visible-dom.txt`
- Run report: `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/report.md`
- Logs: `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-browser-warn-error-logs.json`
- Focused route contract: `npm --workspace apps/mobile run test -- src/features/photos/progressRoutes.test.ts`
- Expo web limitation: direct review renders and exposes Save, but data-URI photo saves return to `/progress` without creating a persisted encrypted photo record because the production photo store depends on native file persistence. The populated picker check used synthetic local encrypted-photo URI metadata to verify the modal/tile semantics; native real-image traversal remains required.

## Remaining Risk

- Untested branches: Native VoiceOver/TalkBack announcement timing and real encrypted photo thumbnail rendering.
- Missing fixtures: Physical-device photo series with real image bytes.
- Follow-up needed: Include comparison picker traversal in Phase 5 device QA, or add a sanctioned local metadata fixture command before promoting this picker path to durable web E2E.
