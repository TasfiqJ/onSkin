# E2E Bug Report: 375 x 667 200% follow-up route clearance

Severity: High
Surface: Expo web
Environment: 375 x 667 viewport, 200% text-pressure route audit
Feature: Recommendation Preferences, Shelf Manual, and Skin Notes
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the Expo web text-pressure route audit with `TEXT_PRESSURE_SCALE=2`, `TEXT_PRESSURE_VIEWPORT_WIDTH=375`, and `TEXT_PRESSURE_VIEWPORT_HEIGHT=667`.
2. After the Progress paywall fix, clear the Expo web cache and rerun focused and full route sweeps.
3. Inspect route geometry for partial controls at the bottom edge and fixed-footer intersections.

## Expected Result

All visible controls on supported 375 x 667 / 200% text-pressure routes are fully visible, 44 px or larger, center-hit-testable, free of horizontal overflow, and free of unexpected browser logs.

## Actual Result

Focused reruns exposed a partial `Non-comedogenic` value chip in `/recommendations/preferences` and a partial `Ingredients` textarea under the fixed Continue footer in `/shelf/manual`. The cache-cleared full sweep then exposed the first Sensitive Skin note card in `/community` starting 9 px into the bottom edge.

## Evidence

- Screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-prefs-shelf-current/`
- Screenshot/report set: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-postfix2-clear/`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-prefs-shelf-current/failures.json`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-postfix2-clear/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

Always with the listed viewport and text-pressure scale before the follow-up fixes.

## Scope

- Affected route/screen: `/recommendations/preferences`, `/shelf/manual`, and `/community`
- Affected account or fixture: local Expo web fixtures used by `scripts/e2e/text-pressure-route-audit.mjs`
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The 375 x 667 text-pressure band is tall enough to reveal the start of lower-priority controls but not tall enough to make them complete. Recommendation Preferences deferred later groups too little, Shelf Manual still exposed an optional ingredient textarea behind the fixed footer, and Skin Notes used a support-floor detector that missed the rendered web dimensions for the first Sensitive Skin card.

## Minimal Fix Recommendation

Defer lower-priority Recommendation Preferences value chips farther below the first viewport, keep compact Shelf Manual focused on essential name/brand/category fields and the Continue action, and broaden the Skin Notes support-floor detector so the first Sensitive Skin note starts below the first viewport under text pressure.

## Verification Flow After Fix

1. Run focused route-contract tests for Recommendation Preferences, Shelf Manual, and Community.
2. Run focused text-pressure E2E for `/recommendations/preferences`, `/shelf/manual`, and `/community` at 375 x 667 / 200%.
3. Run the full 49-route Expo web text-pressure audit at 375 x 667 / 200% from a cache-cleared web server.

## Post-Fix Evidence

- Focused Preferences/Shelf pass: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-prefs-shelf-postfix4-clear/`
- Focused Community pass: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-community-postfix2/`
- Final full pass: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-postfix3-clear/`
- Summary: `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-postfix3-clear/summary.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Remaining Risk

- Untested branches: native iOS and Android Dynamic Type, hardware safe areas, keyboard, and screen-reader traversal
- Missing fixtures: native device/simulator text-size and accessibility passes
- Follow-up needed: native iOS/Android Dynamic Type and safe-area QA
