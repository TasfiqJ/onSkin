# E2E Bug Report: Community Retinoids Card Peeks At 393 x 852 Text Pressure

Severity: Medium
Surface: Expo web
Environment: 393 x 852 viewport, 200% text-pressure route audit
Feature: Skin Notes Community hub
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the text-pressure route audit at 393 x 852 with `TEXT_PRESSURE_SCALE=2`.
2. Open `/community` in the generated evidence.
3. Inspect visible controls near the bottom edge.

## Expected Result

The Skin Notes hub should show complete, hit-testable note cards in the first viewport. Later topic cards should either be fully visible or start below the first viewport until the user scrolls.

## Actual Result

The Retinoids card `Does retinol thin your skin?` started at `y=826` and extended below the `852` px viewport. Only `26` px of the 110 px button was visible, so the audit flagged both a partial clip and a sub-44 visible target.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-current/community.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-current/community.json`
- Failure report: `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-current/failures.json`

## Frequency

- Always at 393 x 852 with 200% text pressure before the fix.

## Scope

- Affected route/screen: `/community`
- Affected account or fixture: seeded Skin Notes hub
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The Community hub had multiple compact and text-pressure deferral guards, but none covered the supported modern Android midpoint around 393 px wide and 852 px tall. The second Sensitive Skin card was complete, but the next Retinoids topic began close enough to the viewport bottom to expose a partial button.

## Minimal Fix Recommendation

Add a supported modern text-pressure guard for 391-414 px wide, 840-899 px tall viewports that defers the Retinoids section below the first viewport while keeping the first two Sensitive Skin cards complete.

## Verification Flow After Fix

1. Run the focused Community route contract test.
2. Rerun the full text-pressure route audit at 393 x 852 with `TEXT_PRESSURE_SCALE=2`.
3. Confirm `/community` has zero clipped controls, zero sub-44 visible controls, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.

## Post-Fix Evidence

- Focused Community rerun: `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-community-rerun/`
- Final 49-route rerun: `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-full-rerun/`
- Community screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-full-rerun/community.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-full-rerun/community.json`
- Failure report: `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-full-rerun/failures.json`
- Summary: `test-results/human-e2e/2026-07-09/text-pressure-200-android-393-852-full-rerun/summary.json`

## Remaining Risk

- Native iOS/Android Dynamic Type, screen-reader traversal, and safe-area behavior still require device QA.
