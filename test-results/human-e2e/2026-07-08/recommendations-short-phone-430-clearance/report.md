# Recommendations 320 x 430 Clearance Report

Date: 2026-07-08
Surface: Expo web
Viewport: 320 x 430
Environment: Codex in-app browser on localhost

## Scope

Verified `/recommendations` and `/recommendations/preferences` after adding the sub-460 px Recommendations density. The target failures were the second For You recommendation card clipping below the viewport and the `Sustainable` preference chip peeking below the viewport.

## Commands

- `npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts`
- `npm --workspace apps/mobile run typecheck`
- `git diff --check`

## Evidence

- For You screenshot: `test-results/human-e2e/2026-07-08/recommendations-short-phone-430-clearance/recommendations-final.png`
- For You geometry: `test-results/human-e2e/2026-07-08/recommendations-short-phone-430-clearance/recommendations-final.json`
- Preferences first viewport: `test-results/human-e2e/2026-07-08/recommendations-short-phone-430-clearance/recommendations-preferences-final.png`
- Preferences scrolled bottom: `test-results/human-e2e/2026-07-08/recommendations-short-phone-430-clearance/recommendations-preferences-bottom.png`
- Preferences after tapping `Sustainable`: `test-results/human-e2e/2026-07-08/recommendations-short-phone-430-clearance/preferences-after-sustainable-tap.png`
- Summary: `test-results/human-e2e/2026-07-08/recommendations-short-phone-430-clearance/summary.json`
- Follow-up sweep: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postrecommendations-sweep/failures.json`

## Result

Targeted Recommendations verification passed. `/recommendations`, `/recommendations/preferences`, the scrolled Preferences bottom state, the Preferences navigation path from the hub, and the `Sustainable` tap all reported zero clipped controls, zero sub-44 visible controls, and zero blocked center hit-tests.

The broader 49-route 320 x 430 follow-up sweep no longer reports `/recommendations` or `/recommendations/preferences`. It still reports separate non-Recommendations issues in Community, Subscription settings, Notifications settings, and the Shelf opened fallback backdrop.

## Remaining Risk

Native iOS and Android safe-area behavior, Dynamic Type, and screen-reader traversal still need release-device QA.
