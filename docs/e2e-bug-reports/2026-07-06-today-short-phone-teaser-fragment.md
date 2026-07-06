# E2E Bug Report: Today teaser fragment behind floating tab bar

Severity: Low
Surface: Expo web
Environment: Expo web at 360 x 640 phone viewport, localhost:8093
Feature: Today tab, floating bottom navigation clearance
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Open `/today` at a 360 x 640 phone viewport.
2. Dismiss the transient SPF prompt if present.
3. Observe the lower first viewport above the floating tab bar.

## Expected Result

The first viewport should show complete, intentional Today content. Lower cards should either be fully visible or absent until scroll, not peeking as a partial fragment behind the floating tab bar.

## Actual Result

The dark `Tonight` teaser enabled at the 640 px height boundary and appeared only as a top sliver above the tab bar, making the floating bar look like it was covering content.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/today-360x640.png`
- Geometry: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/today-360x640-geometry.json`

## Frequency

- Always on the tested 360 x 640 Expo web viewport.

## Scope

- Affected route/screen: `/today`
- Affected account or fixture: local placeholder app state
- External service involved: none
- Destructive action involved: no

## Suspected Cause

`compactPhone` switched off at `height >= 640`, so the optional Tonight teaser rendered on a short phone height where the first viewport could not show it cleanly.

## Minimal Fix Recommendation

Raise the compact-phone cutoff so short phones keep the Today first viewport focused on routine and recommendation content. Keep the full Tonight teaser available on taller phone screens.

## Verification Flow After Fix

1. Open `/today` at 360 x 640.
2. Confirm no partial dark teaser appears behind the tab bar.
3. Open `/today` at 390 x 844.
4. Confirm the Tonight teaser still renders fully and tab labels remain clean.

## Post-Fix Evidence

- 360 px screenshot: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/today-360x640-compact-fixed.png`
- 390 px screenshot: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/today-390x844-final.png`
- Cross-width summary: `test-results/human-e2e/2026-07-06/final-cross-phone-sweep/cross-width-summary.json`

## Remaining Risk

- Native iOS and Android hardware still need final device QA for exact safe-area and font-rendering differences.
