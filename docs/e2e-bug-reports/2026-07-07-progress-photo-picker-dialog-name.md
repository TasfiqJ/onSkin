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

- Screenshot:
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-progress-ready-320x568.png`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-photo-picker-dialog-320x568.png`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-photo-picker-dismissed-320x568.png`
- UI snapshot:
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-progress-ready-state.json`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-photo-picker-dialog-state.json`
  - `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-photo-picker-dismissed-state.json`
- Logs: `test-results/human-e2e/2026-07-07/progress-photo-picker-dialog-name/post-fix-browser-warn-error-logs.json`
- Focused route contract: `npm --workspace apps/mobile run test -- src/features/photos/progressRoutes.test.ts`

## Remaining Risk

- Untested branches: Native VoiceOver/TalkBack announcement timing and real encrypted photo thumbnail rendering.
- Missing fixtures: Physical-device photo series with real image bytes.
- Follow-up needed: Include comparison picker traversal in Phase 5 device QA.
