# Routine Plan Profile Label E2E Report

Date: 2026-07-08
Surface: Expo web in System Chrome
Viewport: 320 x 568
Route: `/routine/plan`
Fixture: `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`

## Scope

- Branch: empty-shelf example label
- Branch: real profile label
- Branch: direct-entry back recovery
- Regression guard: placeholder Supabase requests after returning to `/you`

## Result

Passed after fixes.

The empty local state shows `EXAMPLE ROUTINE` and `Example only`, with no hardcoded dry/sensitive profile copy and zero horizontal overflow.

The seeded local profile/shelf state uses the stored profile and shelf payloads, shows `BUILT FOR OILY, RESISTANT SKIN`, renders `Gel cleanser` and `Mineral SPF 50`, keeps the compact PM suffix readable, has zero horizontal overflow, and keeps visible controls at 44 px or taller.

Direct-entry Back returns from `/routine/plan` to `/you` with zero horizontal overflow. Browser logs contain expected React/Expo development warnings and placeholder Supabase configuration warnings only. They do not contain page errors, request failures, or failed requests to the placeholder Supabase host after the consent backend guard.

## Evidence

- `01-empty-example-label.png`
- `01-empty-example-label.json`
- `02-local-profile-label.png`
- `02-local-profile-label.json`
- `03-direct-entry-back-to-you.png`
- `03-direct-entry-back-to-you.json`
- `empty-browser-logs.json`
- `local-profile-browser-logs.json`

## Remaining Risk

- Native iOS/Android rendering, secure-storage behavior, and live Supabase profile reconciliation still need device/staging QA.
