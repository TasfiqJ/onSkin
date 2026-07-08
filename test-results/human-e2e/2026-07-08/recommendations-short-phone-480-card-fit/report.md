# Recommendations Short-Phone Card Fit

Date: 2026-07-08
Surface: Expo web
Viewport: 320 x 480 requested, browser reported 320 x 481 at devicePixelRatio 1.03
Route: `/recommendations`

## Purpose

Verify the shortest-phone fix for the For You hub after the current-main sweep found the second visible recommendation card clipped below the viewport before its evidence and `See how` row.

## Steps

1. Started Expo web on `http://localhost:8206`.
2. Set the in-app browser viewport to 320 x 480.
3. Opened `/recommendations`.
4. Captured visible control geometry, viewport/document dimensions, dialog state, and a screenshot.
5. Tapped the visible ceramide recommendation card at its audited center.
6. Verified navigation to the recommendation detail route.

## Result

Pass.

- Horizontal overflow: 0 px.
- Dialogs: none.
- Visible user-facing controls below 44 px: none.
- Visible clipped controls: none.
- Back: 48 x 48 px.
- Preferences: 101 x 48 px.
- `A mineral SPF 30+` card: fully visible at y=154-289.
- `A ceramide moisturiser` card: fully visible at y=297-432.
- Tapping `A ceramide moisturiser` opened `/recommendations/routine_completion:ceramide_moisturiser`.

## Evidence

- Screenshot: `recommendations.png`
- Geometry snapshot: `recommendations.json`
- Tap/navigation snapshot: `recommendation-tap.json`

## Remaining Risk

- Native iOS/Android safe-area and Dynamic Type still need device-level regression coverage.
