# E2E Bug Report: ProGate shortest-phone compliance controls clip or sit under chrome

Severity: High
Surface: Expo web
Environment: Expo web on localhost, 320 x 480 viewport
Feature: Contextual ProGate subscription paywalls
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and open the app as a fresh free user.
2. Set the viewport to 320 x 480.
3. Open `/progress`, `/routine/plan`, `/cycle/settings`, `/routine/streak`, or `/routine/widgets`.

## Expected Result

Contextual paywalls keep Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first visible, 44 pt or larger, and center hit-testable. In tab routes, no compliance control sits underneath the floating tab bar.

## Actual Result

The pre-fix 49-route short-phone sweep found shared ProGate compliance controls partially below the 480 px viewport on direct routine/cycle/streak/widget routes. On `/progress`, Terms/Privacy/Restore were visible but their centers were intercepted by the floating bottom tab bar.

## Evidence

- Sweep summary: `test-results/human-e2e/2026-07-08/current-main-short-phone-480-sweep/summary.json`
- Representative pre-fix screenshots and geometry: `test-results/human-e2e/2026-07-08/current-main-short-phone-480-sweep/progress.*`, `routine-plan.*`, `cycle-settings.*`, `routine-streak.*`, `routine-widgets.*`
- Post-fix route audit: `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/summary.json`
- Post-fix screenshots and route JSON: `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/`
- Terminal transcript: focused Vitest and Playwright audit commands in `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/report.md`

## Frequency

Always at 320 x 480 when the shared ProGate paywall body included both purchase CTAs and bottom compliance controls.

## Scope

- Affected route/screen: `/progress`, `/routine/plan`, `/routine/ramp`, `/routine/tolerance`, `/routine/reorder`, `/routine/adaptation`, `/cycle/settings`, `/cycle/disruption`, `/cycle/procedure`, `/cycle/phased-intro`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/week`, `/routine/streak`, `/routine/widgets`
- Affected account or fixture: Fresh free local user
- External service involved: RevenueCat/Supabase placeholders only; no live external service required
- Destructive action involved: No

## Suspected Cause

`ProGate` rendered Terms, Privacy, and Restore at the bottom of the scroll body. The compact layout reserved enough bottom padding for 568 px phones, but at 480 px the compliance row either clipped below direct-route viewports or sat in the floating tab-bar zone on `/progress`.

## Minimal Fix Recommendation

Use a shared sub-520 px ProGate treatment: render Terms, Privacy, and Restore in a compact header row beside the 48 px Maybe later exit, hide the duplicate bottom compliance row, remove the decorative icon, and tighten only the paywall body spacing while preserving 48 px CTA and legal controls.

## Verification Flow After Fix

1. Start Expo web on localhost.
2. Open the affected ProGate routes at 320 x 480.
3. Verify Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first are present where applicable, at least 44 px, not clipped, not center-hit blocked, and not horizontally overflowing.

## Post-Fix Evidence

- Screenshot/JSON packet: `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/`
- Summary: `test-results/human-e2e/2026-07-08/progate-short-phone-480-compliance/summary.json`
- Result: 16 routes checked; zero failed routes, zero target issues, zero visible-control issues, zero horizontal overflow, zero dialogs, zero unexpected browser logs.

## Remaining Risk

- Untested branches: Native iOS/Android safe-area, Dynamic Type, and screen-reader traversal.
- Missing fixtures: Live RevenueCat purchase sheet, restore, and store-unavailable states on physical devices.
- Follow-up needed: Include these contextual paywall routes in the durable mobile E2E harness once the project selects Detox, Maestro, XCTest, or another native harness.
