# E2E Bug Report: Remaining 320 x 430 route controls clipped

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web on localhost, 320 x 430 viewport
Feature: Community, Settings subscription, Settings notifications, Shelf opened-date recovery
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and set the browser viewport to 320 x 430.
2. Open `/community`, `/settings/subscription`, `/settings/notifications`, and `/shelf/opened` directly.
3. Inspect visible button, switch, radio, and route-exit geometry before scrolling.

## Expected Result

Visible controls are either fully readable and at least 44 px tall/wide, or they sit below the first viewport until the user deliberately scrolls to them. Direct-entry recovery sheets should expose complete visible recovery actions and should not expose a clipped backdrop dismiss target.

## Actual Result

The post-Recommendations 320 x 430 route sweep found four remaining clipped visible controls:

- `/community`: the third Skin Note card, `Is "natural" always gentler for sensitive skin?`, clipped by roughly 3 px.
- `/settings/subscription`: the free-plan `Privacy` compliance row was visible only at about 39 px.
- `/settings/notifications`: the `Replenishment` switch was visible only at about 18 px.
- `/shelf/opened`: the no-draft sheet backdrop exposed `Dismiss` as a clipped visible control.

## Evidence

- Pre-fix sweep: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postrecommendations-sweep/failures.json`
- Pre-fix route snapshots: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postrecommendations-sweep/community.json`, `settings-subscription.json`, `settings-notifications.json`, `shelf-opened.json`
- Post-fix focused evidence: `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/`
- Post-fix full sweep: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep/`

## Frequency

Always in the tested direct-entry 320 x 430 states.

## Scope

- Affected route/screen: `/community`, `/settings/subscription`, `/settings/notifications`, `/shelf/opened`
- Affected account or fixture: default local Expo web state
- External service involved: none; Supabase and RevenueCat remain placeholder/local
- Destructive action involved: none

## Suspected Cause

The remaining routes had enough content to place a valid control partly across the 430 px viewport bottom. The opened-date recovery sheet also left its backdrop accessible in the no-draft branch, so the audit correctly treated the visible dimmed area as a user-facing `Dismiss` button even though a visible Close control existed.

## Minimal Fix Recommendation

Add sub-460 px density only where the layout needs it, keep controls at a real 48 px floor, and remove the no-draft opened-date backdrop from the accessibility tree so the visible Close and recovery CTA are the available dismissal/recovery actions.

## Verification Flow After Fix

1. Re-open the four affected routes at 320 x 430.
2. Confirm zero clipped controls, zero sub-44 controls, zero blocked center hit-tests, and zero disallowed browser logs.
3. Tap the formerly clipped controls: the Skin Note, Restore purchases, Replenishment, and Add product by hand.
4. Run the full 49-route 320 x 430 sweep.

## Post-Fix Evidence

- Focused screenshot/JSON packet: `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/`
- Full sweep screenshot/JSON packet: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep/`
- Result: focused four-route pass and 49-route sweep both report zero failed routes. User-like taps opened the note detail, rendered subscription Restore feedback, toggled Replenishment, and routed no-draft Shelf opened recovery to manual add without JavaScript dialogs.

## Remaining Risk

- Native iOS/Android safe-area, Dynamic Type, screen-reader traversal, real notification scheduling, and RevenueCat restore/store-management behavior remain external device QA.
- The full sweep is Expo web only; native rendering can still differ around home-indicator and modal/backdrop semantics.
