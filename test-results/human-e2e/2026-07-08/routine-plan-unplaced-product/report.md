# Routine Plan Unplaced Product E2E

- Date: 2026-07-08
- Surface: Codex in-app browser, Expo web
- App URL: `http://localhost:8164`
- Viewport: 320 x 568
- Fixture: `EXPO_PUBLIC_E2E_ENTITLEMENT=pro`
- Flow tree branch: `Routine Plan First Value / unclassified shelf item`

## Steps

1. Opened `/shelf/manual`.
2. Added `Mystery drops` with no brand, no category, and no ingredients.
3. Kept `Just opened it` on `/shelf/opened` and saved with `Add to shelf`.
4. Used `Build my routine` from Shelf.
5. Verified `/routine/plan`, then tapped `Start today`.

## Result

- `/routine/plan` shows `BUILT FROM YOUR SHELF`.
- First insight title is `Product needs details`.
- First insight body is `Mystery drops needs a category or ingredient clue before it can be placed.`
- `Mystery drops` is not placed into AM or PM routine steps.
- The previous lower product-note sliver is gone; product-specific guidance lives in the first insight card.
- `Start today` is visible and routes to `/today`.
- Horizontal overflow is `0` on `/routine/plan` and `/today`.
- No raw error text appears in the checked pages.
- Current-route warning/error logs: `0`.

## Artifacts

- `routine-plan-unplaced-product.png`
- `routine-plan-unplaced-product.json`
- `today-after-start.png`
- `today-after-start.json`
