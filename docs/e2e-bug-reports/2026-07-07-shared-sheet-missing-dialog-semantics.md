# E2E Bug Report: Shared sheets missing modal dialog semantics

Severity: Medium
Surface: Expo web
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Shared route sheets
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/shelf/no-match` directly at a 320 x 568 phone viewport.
2. Inspect the route sheet semantics and visible controls.
3. Use the visible Close control.

## Expected Result

The sheet body is announced as a modal dialog surface, the visible Close action remains a 44 pt target, and direct-entry Close returns to Shelf without leaving the user trapped.

## Actual Result

The shared Sheet body had no explicit modal dialog semantics. Visual recovery worked, but assistive technology had less context that the visible sheet was a modal surface.

## Evidence

- Source review: `apps/mobile/src/components/ui/Sheet.tsx`
- Custom modal precedent: `apps/mobile/src/app/settings/timing.tsx`
- Custom modal precedent: `apps/mobile/src/app/(tabs)/progress.tsx`

## Frequency

- Always on shared Sheet routes before the fix.

## Scope

- Affected route/screen: Shared `Sheet` surfaces, including Shelf and cycle/paywall sheet routes.
- Affected account or fixture: Any user entering a sheet route.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The shared Sheet container handled visual modal layout and safe fallback navigation but did not expose modal semantics on the sheet body.

## Minimal Fix Recommendation

Add dialog semantics, web `aria-modal`, and native modal semantics to the shared Sheet body, then pin the contract so route sheets do not regress.

## Verification Flow After Fix

1. Open `/shelf/no-match` at 320 x 568.
2. Confirm the sheet has one `role=dialog`, `aria-modal=true`, a visible 48 x 48 Close control, no sub-44 px visible controls, and no horizontal overflow.
3. Tap Close and confirm the route returns to `/shelf` with no lingering dialog.

## Post-Fix Evidence

- Screenshot:
  - `test-results/human-e2e/2026-07-07/shared-sheet-dialog-semantics/post-fix-no-match-dialog-320x568.png`
  - `test-results/human-e2e/2026-07-07/shared-sheet-dialog-semantics/shelf-after-close-320x568.png`
- UI snapshot:
  - `test-results/human-e2e/2026-07-07/shared-sheet-dialog-semantics/post-fix-no-match-dialog-state.json`
  - `test-results/human-e2e/2026-07-07/shared-sheet-dialog-semantics/shelf-after-close-state.json`
- Logs: `test-results/human-e2e/2026-07-07/shared-sheet-dialog-semantics/post-fix-browser-warn-error-logs.json`
- Focused route contract: `npm --workspace apps/mobile run test -- src/features/navigation/sheetRouteContracts.test.ts`

## Remaining Risk

- Untested branches: Native iOS/Android screen-reader announcement timing.
- Missing fixtures: VoiceOver/TalkBack device automation.
- Follow-up needed: Include shared sheet semantics in native device QA.
