# Community Short-Phone Card Fit

Date: 2026-07-08
Surface: Expo web
Viewport: 320 x 480 requested, browser reported 320 x 481 at devicePixelRatio 1.03
Route: `/community`

## Purpose

Verify the shortest-phone fix for the Skin Notes hub after the current-main sweep found the third visible Skin Note card clipped below the viewport.

## Steps

1. Started Expo web on `http://localhost:8206`.
2. Set the in-app browser viewport to 320 x 480.
3. Opened `/community`.
4. Captured visible control geometry, viewport/document dimensions, dialog state, and a screenshot.
5. Tapped the visible `Is "natural" always gentler for sensitive skin?` Skin Note card at its audited center.
6. Verified navigation to the note detail route.

## Result

Pass.

- Horizontal overflow: 0 px.
- Dialogs: none.
- Visible user-facing controls below 44 px: none.
- Visible clipped controls: none.
- Back: 48 x 48 px.
- Ask: not exposed on this local launch surface because community posting is flag-disabled.
- `Can you use niacinamide with vitamin C?` card: fully visible at y=134-223.
- `Is a 10-step "glass skin" routine better?` card: fully visible at y=249-338.
- `Is "natural" always gentler for sensitive skin?` card: fully visible at y=342-433.
- Tapping `Is "natural" always gentler for sensitive skin?` opened `/community/note/note-natural-gentler`.

## Evidence

- Screenshot: `community.png`
- Geometry snapshot: `community.json`
- Tap/navigation snapshot: `community-note-tap.json`

## Remaining Risk

- Native iOS/Android safe-area and Dynamic Type still need device-level regression coverage.
