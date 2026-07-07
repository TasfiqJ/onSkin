# E2E Bug Report: Compact floating tab bar missed first Progress tap

Date: 2026-07-07
Environment: Expo web on localhost:19118, 320 x 568 and 390 x 568 mobile viewports
Feature: Bottom tab navigation and contextual photo paywall
Priority: Critical
Status: Fixed

## Steps To Reproduce

1. Start Expo web.
2. Open `/(tabs)/today` at a 320 x 568 mobile viewport.
3. Tap the floating `Progress` tab.
4. Continue switching to `Shelf` and `You` after the locked Progress photo timeline paywall appears.

## Expected

The first tap on each visible tab selects the tapped destination. Inactive locked routes do not leave hidden paywall controls over the floating tab bar or in the active hit-test area.

## Actual

The first 320 px audit showed `Progress` did not become selected after the first tap. Once Progress had mounted the contextual photo paywall, its `Terms`, `Privacy`, and `Restore` controls remained mounted over the floating bar coordinates after switching to Shelf/You.

## Root Cause

The tab item rendered icon and label visuals directly inside the `Pressable`, which made React Native Web hit testing less reliable on the first compact tab tap. The locked contextual paywall also stayed mounted while its tab route was no longer focused.

## Fix

Wrap tab icon/label visuals in a non-hit-testing `tabItemContent` view so the semantic tab `Pressable` owns the whole target. For locked contextual gates, render nothing while the route is unfocused, so inactive paywall compliance controls cannot sit over the active tab bar.
Paywall impression analytics are also limited to focused locked routes.

## Verification

- Post-fix screenshots and geometry: `test-results/human-e2e/2026-07-07/navigation-tabbar-compact/`
- Post-fix summary: `test-results/human-e2e/2026-07-07/navigation-tabbar-compact/run-summary.json`
- Supplemental pointer-events metrics: `test-results/human-e2e/2026-07-07/navigation-tab-pointer-events/tab-navigation-metrics.json`
- Focused contracts: `npm --workspace apps/mobile run test -- src/features/navigation/tabBar.test.ts src/features/subscription/paywallMobileContracts.test.ts`

## Follow-Up

Repeat the same tab switching pass on native iOS and Android once the selected native E2E harness is available.
