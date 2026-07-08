# E2E Bug Report: Cycle disruption fourth choice clipped on shortest phone

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 480 viewport, `EXPO_PUBLIC_E2E_ENTITLEMENT=pro`
Feature: Actives scheduler disruption sheet
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with local Pro entitlement.
2. Open `/cycle/disruption` at a 320 x 480 phone viewport.
3. Inspect the four disruption choices and their visible hit areas.

## Expected Result

All four disruption choices are visible, readable, at least 44 px tall, and hit-testable. The user can choose the post-facial/peel recovery path without relying on a clipped bottom sliver.

## Actual Result

The fourth choice, `I had a facial or peel`, rendered from y=438.4 to y=510.4 in a 481 px viewport. Only 42.6 px was visible, making it a clipped sub-44 target while the document had no useful page scroll.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/cycle-disruption-short-phone-480/cycle-disruption-before.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/cycle-disruption-short-phone-480/cycle-disruption-before.json`

## Frequency

- Always in the audited 320 x 480 route state.

## Scope

- Affected route/screen: `/cycle/disruption`
- Affected account or fixture: Local Pro entitlement
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The compact sheet used the same 72 px option rows for every height below 640 px. On 320 x 480, the title, explanatory copy, handle, sheet padding, and four rows exceeded the visible sheet area by roughly one row sliver.

## Minimal Fix Recommendation

Add a shortest-phone sheet density below 520 px that preserves the same choices and accessibility labels while reducing sheet padding, title/body leading, icon size, row padding, and row spacing. Keep option targets above 44 px.

## Verification Flow After Fix

1. Reopen `/cycle/disruption` at 320 x 480.
2. Verify all four choices are visible, unblocked, and at least 44 px tall.
3. Tap `I had a facial or peel`.
4. Verify the route moves to `/cycle/procedure`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/cycle-disruption-short-phone-480/cycle-disruption-fixed.png`
- Screenshot: `test-results/human-e2e/2026-07-08/cycle-disruption-short-phone-480/facial-option-routes-to-procedure.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/cycle-disruption-short-phone-480/cycle-disruption-fixed.json`
- UI snapshot: `test-results/human-e2e/2026-07-08/cycle-disruption-short-phone-480/facial-option-routes-to-procedure.json`
- Logs: `test-results/human-e2e/2026-07-08/cycle-disruption-short-phone-480/browser-warn-error-logs.json`

## Remaining Risk

- Untested branches: Native iOS/Android modal safe-area behavior, Dynamic Type, and screen-reader traversal.
- Missing fixtures: Native device/simulator sheet rendering.
- Follow-up needed: Native QA for bottom-sheet safe areas before launch sign-off.
