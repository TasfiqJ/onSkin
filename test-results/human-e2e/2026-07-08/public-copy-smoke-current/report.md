# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Public-copy smoke for working brand identity.
- App surface: Expo web, Codex in-app browser.
- Build/start command: `EXPO_PUBLIC_APP_DISPLAY_NAME=RoutineKind npm --workspace apps/mobile run web -- --port 8150 --host localhost --clear`
- Browser/device/simulator/OS: In-app browser at 320 x 568 viewport.
- Feature or PR tested: Public visible copy on age gate, share landing, shelf catalog search, timing preview, and widgets route after no-card reverse trial.
- Overall verdict: Pass.

## Tool Inventory

- Expo CLI: Used on localhost port 8150.
- iOS Simulator: Not used.
- Android emulator: Not used.
- Expo web: Used.
- Playwright: Used through the in-app browser.
- Codex Computer Use: Not used.
- Other: Browser screenshots, DOM state JSON, console log capture.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Age gate | Public display name | Pass | `01-onboarding-age.png`, `01-onboarding-age.json` | Visible copy says `RoutineKind`; no visible `OnSkin`. |
| Public share landing | Public display name | Pass | `02-public-share-landing.png`, `02-public-share-landing.json` | Share landing names `RoutineKind` privacy posture; no visible `OnSkin`. |
| Catalog search | Public display name | Pass | `03-shelf-search.png`, `03-shelf-search.json` | Catalog copy says `RoutineKind catalog`; no visible `OnSkin`. |
| Timing preview | Public display name | Pass | `04-settings-timing.png`, `04-settings-timing.json` | Lock-screen preview shows `RoutineKind`; no visible `OnSkin`. |
| Widgets paywall | Local reverse-trial path | Pass | `05-widgets-paywall-before-reverse-trial.png`, `05-widgets-paywall-before-reverse-trial.json` | Free widgets route shows contextual paywall and visible no-card Pro week path; no visible `OnSkin`. |
| Widgets deferred | Native-widget deferred surface | Pass | `06-widgets-deferred-after-reverse-trial.png`, `06-widgets-deferred-after-reverse-trial.json` | After tapping `Explore first. 7 days of Pro`, widgets route reaches `Widgets are not in this beta` with `Back to Today`. |

## Bugs Found

None.

## Tests Added or Updated

- None. This was a smoke/evidence-only pass over existing brand and deferred-surface behavior.

## Commands Run

```bash
EXPO_PUBLIC_APP_DISPLAY_NAME=RoutineKind npm --workspace apps/mobile run web -- --port 8150 --host localhost --clear
npm run brand:audit:strict
npm --workspace apps/mobile run test -- src/lib/brand.test.ts
```

Results: brand audit strict passed with `public-launch-risk: 0` and `review-needed: 0`; brand unit test passed, 1 file and 4 tests.

## Remaining Risk

- Expo web proves visible route copy only. It does not replace final trademark clearance, store-listing QA, native bundle identifiers, final domain, Universal/App Links, or device QA.
- `RoutineKind` remains the working clearance candidate, not a final legal conclusion.
