# Shelf Freshness And Replacement Provenance E2E

## Summary

- Date: 2026-07-11
- Surface: Expo web development build in the Codex in-app browser
- Viewports: 360 x 640 support floor and 390 x 844 modern supported phone
- Result: Pass after two issues were found, fixed, and rerun
- Fixture: Local encrypted Shelf with manual products and Pro E2E entitlement
- External services: None; expected Supabase placeholder and web-notification warnings only

## Start Command

```powershell
$env:CI='1'
$env:EXPO_PUBLIC_E2E_LOCAL_RESET='1'
$env:EXPO_PUBLIC_E2E_ENTITLEMENT='pro'
npm --workspace apps/mobile exec -- expo start --web --port 8155 --clear
```

The server was cache-cleared after the compact-layout fix because CI mode disables
Metro watch reloads. Final screenshots and browser diagnostics came from the fresh
bundle.

## Flows Executed

| Flow | Result | Evidence |
| --- | --- | --- |
| Onboarding product draft crosses into Shelf freshness intake and returns | Pass | `01-onboarding-products-390x844.png`, `04-onboarding-return-product-390x844.png` |
| Impossible and future opened dates block save | Pass | `02-invalid-opened-date-390x844.png`, `14-future-opened-date-rejected-390x844.png` |
| Exact opened date plus explicitly confirmed open-jar PAO | Pass | `03-exact-date-label-pao-390x844.png` |
| Later printed date loses to opened date plus PAO | Pass | `05-later-printed-date-pao-wins-390x844.png` |
| Earlier printed date becomes the displayed winning source | Pass | `06-earlier-printed-date-wins-390x844.png` |
| Reload retains exact freshness provenance | Pass | DOM snapshot and `06-earlier-printed-date-wins-390x844.png` |
| Re-add creates a new active UUID, archives the old unit, and clears package-specific printed expiry | Pass | `07-replacement-active-and-archive-390x844.png`, `08-new-unit-clears-printed-expiry-390x844.png`, `09-archived-unit-retains-provenance-390x844.png` |
| Unopened plus no-label intake keeps the opened date absent and PAO unknown | Pass | `12-unopened-no-label-390x844.png`, `13-unopened-null-opened-at-390x844.png` |
| Supported-floor Shelf keeps scan in flow and reachable after scrolling | Pass | `11-shelf-replacement-360x640.png`, `11-shelf-inline-scan-360x640.png`, `geometry-360x640.json` |
| Browser diagnostics | Pass | `browser-warn-error.json` |

## Bugs Found

| ID | Severity | Result | Record |
| --- | --- | --- | --- |
| SHELF-E2E-001 | Critical | Fixed and rerun | `bug-001-intake-provider-scope.md` |
| SHELF-E2E-002 | High | Fixed and rerun | `bug-002-compact-shelf-scan-overlap.md` |

## Automated Coverage

- Freshness normalization, migration, real-date validation, calendar-month PAO, and winning-source contracts.
- Shelf store add, update, re-add UUID, archive preservation, and package-expiry clearing.
- Reviewed catalog provenance and Edge lookup/search response contracts.
- Replenishment signals, Ask/recommendation copy, notification opt-in, and migration defaults.
- Current mobile result at packet assembly: 196 test files and 2094 tests passed.

## Browser Diagnostics

- JavaScript dialogs: 0.
- Unexpected browser errors: 0.
- Unexpected warning messages: 0.
- Expected local warnings: Supabase placeholder URL/key and Expo Notifications web limitation.
- 360 x 640 horizontal overflow: 0 px.
- Visible interactive controls below 44 x 44: 0.

## Remaining Risk

- Configured staging must apply both migrations and prove owner/second-user RLS isolation.
- Live Edge responses must prove reviewed, region-matched freshness evidence and conflict degradation.
- Supported physical iOS and Android devices still need encrypted-storage relaunch, keyboard, safe-area, notification opt-in/delivery, VoiceOver, TalkBack, and Dynamic Type proof.
- Named cosmetic-chemistry review remains required before production release.
