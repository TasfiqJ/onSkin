# E2E Bug Report: Settings time picker needed a single named dialog

Severity: Medium
Surface: Expo web / native accessibility semantics
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Reminder timing settings
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/settings/timing` at a 320 x 568 phone viewport.
2. Tap the Morning reminder time control.
3. Inspect the time picker dialog boundary, dismiss control, time-row geometry, and horizontal overflow.

## Expected Result

The time picker exposes one named modal dialog, keeps a named dismiss action, keeps 48 px time rows, and does not horizontally overflow.

## Actual Result

The picker used React Native `Modal`, but the route contract did not require a stable accessible dialog name or guard against adding a second nested dialog role inside the modal body.

## Evidence

- Source review: `apps/mobile/src/app/settings/timing.tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Settings Account Controls / reminder timing and discretion
- Draft-fix DOM inspection: `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/current-duplicate-dialog-details.json`

## Frequency

- Always on the reminder timing picker before the route contract was hardened.

## Scope

- Affected route/screen: `/settings/timing`
- Affected account or fixture: Any user editing reminder or quiet-hour times
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The custom time picker modal sits outside the shared `Sheet` component, so its dialog naming and single-dialog behavior had no focused guard.

## Minimal Fix Recommendation

Pass the picker title to the `Modal` wrapper as its accessible label, keep `accessibilityViewIsModal` on the sheet body, and assert that this route does not add nested `role="dialog"` / `aria-modal` attributes inside the React Native web modal.

## Verification Flow After Fix

1. Open `/settings/timing` at 320 x 568.
2. Tap the Morning reminder time control.
3. Confirm exactly one modal dialog with `aria-modal="true"` and `aria-label="Morning reminder"` renders.
4. Confirm the named dismiss control and time rows remain at least 44 px.
5. Dismiss the picker and confirm the route remains on `/settings/timing`.

## Post-Fix Evidence

- Screenshot:
  - `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/route-open-320x568.png`
  - `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/post-fix-time-picker-dialog-320x568.png`
  - `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/post-fix-time-picker-dismissed-320x568.png`
- UI snapshot:
  - `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/route-open-state.json`
  - `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/post-fix-time-picker-dialog-state.json`
  - `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/post-fix-time-picker-dismissed-state.json`
- Logs: `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/post-fix-browser-warn-error-logs.json`
- Focused route contract: `npm --workspace apps/mobile run test -- src/features/settings/settingsRoutes.test.ts`

## Remaining Risk

- Untested branches: Native VoiceOver/TalkBack announcement timing.
- Missing fixtures: Automated assistive-technology traversal.
- Follow-up needed: Include reminder timing picker traversal in Phase 5 device QA.
