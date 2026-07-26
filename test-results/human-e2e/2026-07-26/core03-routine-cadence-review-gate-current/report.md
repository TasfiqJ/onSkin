# CORE-03 Routine Cadence Review-Gate Human-Simulated E2E

## Summary

- Date: 2026-07-26
- Surface: Expo web in the Codex in-app browser
- Feature: production-closed direct entry for routine cadence and cycle guidance
- Overall verdict: Pass with native, exact-viewport, immutable-binding, and
  professional/legal gates open
- Start command:
  `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE=closed npm run web -- --port 8091`
- Local state: neutral eligible age-check fixture, current local collection
  consent, development-only `store_pro` entitlement
- External services: none; Supabase remained deliberately unconfigured and
  fail-closed

The capture was made from the current working tree after the route fixes. Its
pre-commit Git head was
`d21a2877a09e140bf87125f0707a4e65e0808aa3`; the packet does not claim an
immutable source-commit binding.

This packet is historical outer-gate UI evidence. It predates the later
source-artifact, recovery/stop-refer, explainability-copy, ramp-cache,
notification-admission, and stale-state hardening. It therefore proves neither
those later paths nor the exact current source revision.

## Flow Executed

Direct entry, closed-copy inspection, forbidden-copy inspection, geometry,
horizontal overflow, visible-control clipping, and screenshot capture passed
for all nine routes:

- `/cycle/week`
- `/cycle/settings`
- `/cycle/why-tonight`
- `/cycle/disruption`
- `/cycle/recovery`
- `/cycle/phased-intro`
- `/cycle/procedure`
- `/routine/ramp`
- `/routine/tolerance`

The matrix passed 27 of 27 route/viewport observations at 375 x 666, 390 x
844, and 430 x 932 CSS pixels. The 375 x 666 run is a one-pixel-shorter stress
boundary, not exact 375 x 667 evidence: the selected browser controller could
produce 375 x 666 or 376 x 668, but not the exact requested pair. Exact 390 x
844 and 430 x 932 were confirmed from `innerWidth`/`innerHeight`.

All nine routes remained closed after refresh. Eleven visible exit controls
were exercised, including screen Back/Cancel actions, sheet Dismiss backdrops,
`Got it`, and `Back to routine`; every one returned to `/today`.

The final matrix had:

- zero forbidden draft-control/copy exposures;
- zero horizontal-overflow failures;
- zero clipped visible controls;
- 48 px minimum visible control width and height;
- zero JavaScript dialogs; and
- zero browser errors.

The retained console aggregate covers
`2026-07-26T14:19:55.088Z` through
`2026-07-26T14:29:17.190Z`. It contains 132 expected development warnings:
33 each for missing local Supabase URL, missing local Supabase publishable key,
Expo web notification-listener support, and the known React Native web
`pointerEvents` deprecation.

## Bugs Found and Fixed

1. Metro watched the repo-local `.tmp` verification tree. The concurrent
   isolated database copy therefore produced a duplicate `routinekind` package
   name. `apps/mobile/metro.config.js` now excludes only the repo-local `.tmp`
   subtree while retaining the monorepo watch boundary.
2. Visual review found that closed `/cycle/week` still displayed
   `moisturizer → SPF`. That was an unreviewed sequencing instruction despite
   zero production sequencing admission. The closed card now says only
   `DAILY ROUTINE`, `Available from Today`, and `unchanged`. Its contract
   rejects `amSummary`, `moisturizer`, and `SPF` in the closed component.

## Evidence

- `summary.json`
- `browser-console-summary.json`
- 27 calibrated screenshots named
  `<confirmed-width>x<confirmed-height>-<route>.png`
- `docs/e2e-bug-reports/2026-07-26-core03-metro-temp-collision.md`
- `docs/e2e-bug-reports/2026-07-26-core03-week-closed-sequencing-copy.md`

## Remaining Risk

- Exact 375 x 667 browser evidence remains open.
- No Playwright trace or raw browser-console export is retained.
- This packet is not registered in `e2e:human:manifest`.
- Current-exact-source partial-admission and independently closed
  recovery/explainability evidence remain open.
- Expo web does not prove native safe areas, navigation, encrypted storage,
  Dynamic Type, VoiceOver, physical-iPhone behavior, or an archive-identical
  App Store build.
- Professional source review, legal/privacy review, U.S. market clearance,
  hosted service evidence, and App Store review remain required.
