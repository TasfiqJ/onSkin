# E2E Bug Report: Conflict choice sheet clipped an action and lacked web keyboard exits

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser at 360 x 640 and 390 x 844
Feature: Exact-pair conflict choice and schedule explanation
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Add an AHA and retinoid, then open their exact conflict sheet at 390 x 844.
2. Inspect the two choice controls before scrolling and press Escape from the focused dialog.
3. Press Tab from the initially focused dialog and Shift+Tab from the first action.

## Expected Result

Visible actions are complete and at least 44 px tall. Keyboard focus enters and
wraps within the dialog, and Escape returns to Shelf.

## Actual Result

`Use together anyway` extended 4 px below the 390 x 844 viewport. The dialog
implemented Tab boundary logic but did not handle Escape, and the initially
focused dialog did not explicitly transfer focus to the first/last action.

## Evidence

- Geometry: `test-results/human-e2e/2026-07-10/conflict-choice-schedule-current/geometry.json`
- Screenshot: `test-results/human-e2e/2026-07-10/conflict-choice-schedule-current/conflict-choice-390x844-top.png`
- UI snapshot: `test-results/human-e2e/2026-07-10/conflict-choice-schedule-current/conflict-choice-390x844-dom.txt`

## Frequency

- Always in the reproduced pre-fix state

## Scope

- Affected route/screen: `/conflict/[ruleId]` with an exact product pair
- Affected account or fixture: local Pro shelf with a reviewed cosmetic conflict
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The action stack's top margin left the secondary action just beyond the sheet's
visible boundary. The web key handler handled only Tab wrapping and assumed
focus already belonged to an action.

## Minimal Fix Recommendation

Reduce the action-stack top margin enough to keep the secondary action complete
at the supported modern-phone viewport. Handle Escape inside the dialog key
boundary and explicitly route initial/outside Tab focus to the first or last
action.

## Verification Flow After Fix

1. Reopen at 390 x 844 and require both actions to be fully inside the viewport.
2. Reopen at 360 x 640, scroll normally, and require both actions to be complete and center-hit-testable.
3. Verify initial focus, forward Tab, backward wrap, and Escape to Shelf.

## Post-Fix Evidence

- Screenshots and DOM snapshots: `test-results/human-e2e/2026-07-10/conflict-choice-schedule-current/`
- Geometry: both actions are 48 px or taller, fully visible, and center-hit-testable at both sizes after expected scrolling
- Keyboard: dialog -> Keep -> Shift+Tab wrap to Use together -> Escape to `/shelf`
- Logs: `test-results/human-e2e/2026-07-10/conflict-choice-schedule-current/browser-warn-error-logs.json`

## Remaining Risk

- VoiceOver, TalkBack, native Dynamic Type, and native safe-area traversal remain release-device QA.
