# E2E Bug Report: Settings time picker dialog lacked a stable name

Severity: Medium
Surface: Expo web / native accessibility semantics
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Reminder timing settings
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/settings/timing` at a 320 x 568 phone viewport.
2. Tap the Morning reminder time control.
3. Inspect the time picker sheet container semantics and visible controls.

## Expected Result

The time picker sheet exposes a named modal dialog, keeps a named dismiss action, keeps 48 px time rows, and does not horizontally overflow.

## Actual Result

React Native web supplies the Modal dialog wrapper, but the custom time picker did not give that wrapper a stable name such as `Morning reminder`.

## Evidence

- Source review: `apps/mobile/src/app/settings/timing.tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Settings Account Controls / reminder timing and discretion

## Frequency

- Always on the reminder timing picker before the fix.

## Scope

- Affected route/screen: `/settings/timing`
- Affected account or fixture: Any user editing reminder or quiet-hour times
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The custom time picker modal relied on its visible title but did not pass that title to the native/web Modal wrapper.

## Minimal Fix Recommendation

Pass the picker title to the Modal as its accessibility label, preserve the named dismiss and 48 px rows, and avoid adding a second nested dialog role.

## Verification Flow After Fix

1. Open `/settings/timing` at 320 x 568.
2. Tap the Morning reminder time control.
3. Confirm one modal dialog with `aria-modal="true"` and `aria-label="Morning reminder"` renders.
4. Confirm the named dismiss control and time rows remain at least 44 px.
5. Dismiss the picker and confirm the route remains on `/settings/timing`.

## Post-Fix Evidence

- Screenshot:
  - `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/route-open-320x568.png`
  - `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/post-fix-time-picker-dialog-8099-320x568.png`
- UI snapshot:
  - `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/route-open-state.json`
  - `test-results/human-e2e/2026-07-07/settings-time-picker-dialog-semantics/post-fix-time-picker-dialog-8099-state.json`
- Logs:
- Focused route contract: `npm --workspace apps/mobile run test -- src/features/settings/settingsRoutes.test.ts`

## Remaining Risk

- Untested branches: Native VoiceOver/TalkBack announcement timing.
- Missing fixtures: Automated assistive-technology traversal.
- Follow-up needed: Include reminder timing picker traversal in Phase 5 device QA.
