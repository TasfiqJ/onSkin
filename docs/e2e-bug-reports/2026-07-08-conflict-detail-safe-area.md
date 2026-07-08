# E2E Bug Report: Conflict detail sheet collapsed on compact web

Severity: High
Surface: Expo web
Environment: Expo web on localhost at 320 x 568 viewport
Feature: Shelf conflict detail and stale conflict recovery
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web for `apps/mobile`.
2. Set the browser viewport to 320 x 568.
3. Open `http://localhost:19141/conflict/missing-rule-e2e` directly.

## Expected Result

The missing conflict sheet should reserve a dismiss area, remain visible on compact phones, expose modal semantics, avoid horizontal overflow, and keep both `Back to Shelf` and `Add a product` reachable.

## Actual Result

The first patched pass still allowed a transient `useWindowDimensions()` height of 44 px to produce `maxHeight: 0px`. The sheet collapsed at the bottom of the viewport, while `Back to Shelf` and `Add a product` were rendered below the visible viewport.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/conflict-detail-safe-area/01-conflict-missing-320x568-state.json`
- Terminal transcript: focused route contract checks and Expo web output in the Codex thread

## Frequency

- Always when the compact web route reported the 44 px transient height.

## Scope

- Affected route/screen: `/conflict/[ruleId]`
- Affected account or fixture: direct stale conflict route without a matching shelf pair
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The sheet height guard treated any positive viewport height as usable. On Expo web, the route can briefly report a 44 px height, so subtracting the 44 px dismiss reserve collapsed the sheet to zero height.

## Minimal Fix Recommendation

Use the route-local compact-sheet fallback unless the reported viewport height is greater than the 44 px dismiss reserve. Keep safe-area bottom padding conditional on real native insets and preserve web dialog semantics.

## Verification Flow After Fix

1. Reload `/conflict/missing-rule-e2e` at 320 x 568.
2. Confirm the dialog has `aria-modal="true"` and `accessibilityLabel` equivalent copy.
3. Confirm the sheet is not collapsed, has zero horizontal overflow, and both actions are visible/touchable.

## Post-Fix Evidence

- UI snapshot: `test-results/human-e2e/2026-07-08/conflict-detail-safe-area/02-conflict-missing-320x568-after-fallback.json`
- Terminal transcript: focused conflict and commerce route contracts, mobile typecheck, and mobile lint in the Codex thread

## Remaining Risk

- Untested branches: native iOS/Android home-indicator behavior, Dynamic Type, VoiceOver, TalkBack, and the full real-conflict choice path after this fallback change.
- Missing fixtures: no native simulator/device evidence in this slice.
- Follow-up needed: run the same conflict-detail and commerce-consent sheets on iOS and Android before release signoff.
