# Today Empty Routine And Cycle Labels E2E Report

Date: 2026-07-08
Surface: Expo web in System Chrome
Viewport: 320 x 568
Routes: `/today?routine=AM`, `/today?routine=PM`
Fixture: `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`

## Scope

- Branch: empty routine
- Branch: compact PM cycle strip labels

## Result

Passed after fixes.

Empty local state shows `No routine yet`, `Build a routine from your shelf.`, and a 56 px `Add products` action. It does not show example `Cream cleanser` or `Morning routine` check-off rows. Tapping `Add products` routes to `/shelf/manual` with zero horizontal overflow.

The seeded PM cycle shows split two-line Exfoliate/Retinoid/Recover labels with full accessibility labels, zero horizontal overflow, and no visible sub-44 px controls. Browser logs contain expected React/Expo development warnings and placeholder Supabase configuration warnings only; no page errors or request failures were recorded.

## Evidence

- `01-empty-today.png`
- `01-empty-today.json`
- `02-empty-add-products-route.png`
- `02-empty-add-products-route.json`
- `03-pm-cycle-labels.png`
- `03-pm-cycle-labels.json`
- `empty-today-browser-logs.json`
- `pm-cycle-labels-browser-logs.json`

## Remaining Risk

- Native iOS/Android rendering, Dynamic Type, and native secure-storage behavior still need device QA.
