# E2E Bug Report: Cycle procedure CTA bottom cramped

Severity: Medium
Surface: Expo web
Environment: Expo web on localhost at 320 x 568 viewport
Feature: Cycle post-procedure recovery
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web.
2. Open `/cycle/procedure` at a 320 x 568 phone viewport.
3. Inspect the first viewport and the `Start recovery` action.

## Expected Result

The post-procedure recovery screen should keep the primary action comfortably above the bottom edge while preserving a deliberate scroll path to the recovery checklist.

## Actual Result

The `Start recovery` CTA sat flush with the viewport bottom on compact phones, making the screen feel cramped and less consistent with the app's floating, buffered action style.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/scheduler-direct-route-sweep/cycle-procedure-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/scheduler-direct-route-sweep/cycle-procedure-audit.json`

## Frequency

- Always at 320 x 568.

## Scope

- Affected route/screen: `/cycle/procedure`
- Affected account or fixture: local Expo web direct route with default local scheduler state
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The screen rendered the CTA directly after the scroll view without a bottom action wrapper, and the scroll content only had a small bottom padding. On web compact viewports with no native bottom safe-area inset, the button landed exactly on the viewport edge.

## Minimal Fix Recommendation

Wrap the CTA in a paper bottom action area with explicit bottom padding and increase the scroll content bottom padding so the recovery checklist remains reachable without the action touching the phone edge.

## Verification Flow After Fix

1. Reopen `/cycle/procedure` at 320 x 568.
2. Confirm `Start recovery` remains a 56 px full-width action with visible bottom breathing room.
3. Scroll the recovery content and confirm all recovery checklist rows are reachable while the CTA remains usable.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/cycle-procedure-bottom-buffer/cycle-procedure-after-viewport-320x568.png`
- Scrolled screenshot: `test-results/human-e2e/2026-07-07/cycle-procedure-bottom-buffer/cycle-procedure-after-user-scroll-320x568.png`
- UI audit: `test-results/human-e2e/2026-07-07/cycle-procedure-bottom-buffer/cycle-procedure-after-audit-2.json`
- Scrolled UI audit: `test-results/human-e2e/2026-07-07/cycle-procedure-bottom-buffer/cycle-procedure-after-user-scroll-audit.json`

## Remaining Risk

- Native iOS/Android safe-area rendering still needs device or simulator QA.
