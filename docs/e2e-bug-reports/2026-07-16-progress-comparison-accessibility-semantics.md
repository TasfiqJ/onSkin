# E2E Bug Report: Comparison Slider Lost Its Range Value And Full Focus Target

Severity: Medium
Surface: Expo web, with the same semantic ownership relevant to native
Environment: populated local Progress fixture at `http://localhost:8291/progress`
Feature: Progress comparison accessibility
Date: 2026-07-16
Tester: Codex

## Reproduction Steps

1. Open populated Progress in draggable comparison mode.
2. Inspect the accessible element named for the before/after comparison divider.
3. Measure its range attributes and semantic bounding rectangle.

## Expected Result

The divider exposes the current bounded comparison value, action text, and a
semantic target that occupies the full 46 x 46 handle. Side-by-side remains an
explicit non-gesture alternative.

## Actual Result

The first implementation placed the accessibility contract on a Reanimated
view. Expo web retained its slider role and label but dropped min, max, current,
and spoken-value attributes. Moving the contract to a stable inner React Native
view restored ownership but initially left that semantic view at about 46 x 24
px inside the 46 x 46 visual handle.

## Evidence

- Final screenshots: `test-results/human-e2e/2026-07-16/progress-comparison-accessibility-current/`
- Final UI snapshot: `accessibility-snapshot.txt`
- Final geometry: `geometry.json`
- Terminal transcript: Expo session and root verification in the Codex task

## Frequency

- Always in the tested Expo-web fixture before the fixes.

## Scope

- Affected route/screen: `/progress`, populated Compare mode
- Affected account or fixture: deterministic populated Progress fixture
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The Reanimated web wrapper did not forward `accessibilityValue` as ARIA range
attributes. After semantic ownership moved inward, the inner view used content
height instead of the fixed outer handle height.

## Minimal Fix Recommendation

Keep animation and positioning on the outer Reanimated view. Put role, label,
hint, bounded value, and accessibility actions on a stable inner React Native
view; publish explicit ARIA range aliases for Expo web; size that semantic view
to 100% of the handle.

## Verification Flow After Fix

1. Reload populated Progress and inspect the named slider.
2. Confirm min 0, max 100, now 52, and the non-judgmental spoken value.
3. Confirm the semantic rectangle is approximately 46 x 46 px.
4. Activate Side-by-side and confirm the slider is replaced by both photos and
   a named `Use draggable comparison` action.
5. Change the first date and confirm the dialog closes and the slider label
   updates.

## Post-Fix Evidence

- Screenshot: `draggable-comparison.jpg`, `side-by-side-comparison.jpg`
- UI snapshot: `accessibility-snapshot.txt`
- Geometry: `geometry.json`
- Automated checks: 25 focused tests and 3,928 full-root tests pass

## Remaining Risk

- Native VoiceOver/TalkBack action dispatch and announcement behavior were not
  available in this Windows/Expo-web task and remain physical-device QA.
- New supported-phone viewport evidence was not captured because the in-app
  browser runtime did not expose device emulation.
