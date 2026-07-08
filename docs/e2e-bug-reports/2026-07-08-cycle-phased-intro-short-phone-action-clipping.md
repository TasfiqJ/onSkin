# E2E Bug Report: Cycle phased-intro actions clipped on shortest phones

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo web at 320 x 480, local Pro entitlement
Feature: Skin cycling phased introduction sheet
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with Pro entitlement enabled.
2. Set the browser viewport to 320 x 480.
3. Open `/cycle/phased-intro` directly.
4. Inspect the action buttons at the bottom of the sheet.

## Expected Result

`Sounds good` and `Add it now anyway` remain fully visible, at least 44 px tall, and tappable on the shortest supported phone viewport.

## Actual Result

Before the fix, `Sounds good` rendered from about y=428.5 to y=484.5 in a 481 px viewport, so the bottom of the primary action clipped. The secondary override was not visible in the first viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-480-audit/cycle-phased-intro.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-480-audit/cycle-phased-intro.json`

## Frequency

- Always on the checked 320 x 480 direct route.

## Scope

- Affected route/screen: `/cycle/phased-intro`
- Affected account or fixture: Pro or reverse-trial user viewing scheduler sheets
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The compact sheet breakpoint only reduced bottom padding on phones under 640 px high. The title, body copy, timeline rows, and action stack still consumed too much vertical space for the 320 x 480 viewport.

## Minimal Fix Recommendation

Add a sub-520 px sheet density for this route only: reduce nonessential text leading and timeline spacing, preserve the primary and secondary actions as 48 px targets, and keep the direct-entry dismissal behavior unchanged.

## Verification Flow After Fix

1. Reopen `/cycle/phased-intro` at 320 x 480.
2. Confirm both actions are visible.
3. Confirm each visible action is at least 44 px tall and its center hit-test resolves to itself.
4. Tap `Sounds good` and confirm direct entry recovers to `/today`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/cycle-phased-intro-short-phone-480/phased-intro-320x480-after-fix.png`
- Click screenshot: `test-results/human-e2e/2026-07-08/cycle-phased-intro-short-phone-480/phased-intro-sounds-good-click-result.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/cycle-phased-intro-short-phone-480/phased-intro-320x480-after-fix.json`
- Click result: `test-results/human-e2e/2026-07-08/cycle-phased-intro-short-phone-480/phased-intro-sounds-good-click-result.json`

## Remaining Risk

- Untested branches: Native iOS/Android bottom-sheet safe-area, Dynamic Type, and screen-reader behavior.
- Missing fixtures: Device-specific home-indicator and notch combinations.
- Follow-up needed: Native simulator/device QA before release.
