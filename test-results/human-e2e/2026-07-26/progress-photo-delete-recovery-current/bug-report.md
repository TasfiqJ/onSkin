# E2E Bug Report: Empty Progress capture action partially below the narrow viewport

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser; requested 360 x 640, observed 360 x 641
Feature: Progress photo-deletion recovery status
Date: 2026-07-26
Tester: Codex

## Reproduction Steps

1. Start Expo web with Pro entitlement, app lock disabled, no Progress photos, and
   `EXPO_PUBLIC_E2E_PHOTO_DELETE_SYNC_STATUS=needs_attention`.
2. Open `/progress` at the requested 360 x 640 viewport.

## Expected Result

The retry and primary first-photo actions are both complete and usable above the floating tab bar.

## Actual Result

The full-height first-run layout placed `Take my first photo` from CSS y=585.82 to y=641.81 in a
641 px browser viewport, leaving it partially outside the visible area.

## Evidence

- Initial browser geometry: top 585.8162, bottom 641.8083, height 55.9921 CSS px.
- Post-fix screenshot: `empty-attention-360x640.png`.
- Post-fix metrics: `metrics.json`.

## Frequency

- Always with the narrow needs-attention fixture before the fix.

## Scope

- Affected route/screen: `/progress`, empty timeline, short supported-phone viewport.
- Affected account or fixture: deterministic development-web needs-attention fixture.
- External service involved: No.
- Destructive action involved: No; the fixture does not delete a real photo.

## Suspected Cause

The empty Progress route selected the compact first-run presentation only below 520 px. The
aggregate attention card added enough height for the primary action to cross the 640 px floor.

## Minimal Fix Recommendation

Use the existing compact first-run presentation for empty Progress below 700 px while leaving
populated Progress behavior unchanged.

## Verification Flow After Fix

1. Rerun the exact needs-attention fixture at requested 360 x 640.
2. Inspect both retry and primary-action rectangles.
3. Activate the retry by its exact accessible name and check dialog state.

## Post-Fix Evidence

- `Take my first photo`: top 483.8441, bottom 535.8313, height 51.9873 CSS px.
- `Try deletion again`: top 200.9102, bottom 256.9023, height 55.9921 CSS px.
- Partial visible controls: zero.
- Horizontal overflow: zero.
- JavaScript dialog after retry activation: none.
- Screenshot: `empty-attention-360x640.png`.

## Remaining Risk

- Native iOS safe areas, Dynamic Type, and VoiceOver remain device QA.
