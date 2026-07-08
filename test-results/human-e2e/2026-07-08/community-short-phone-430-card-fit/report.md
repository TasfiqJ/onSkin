# Community 320 x 430 Card Fit Report

Date: 2026-07-08
Surface: Expo web
Viewport: 320 x 430
Environment: Codex in-app browser on localhost

## Scope

Verified the Skin Notes hub after adding the sub-460 px Community scroll-content density. The target failure was the third visible note card, `Is "natural" always gentler for sensitive skin?`, clipping by about 3 px at the bottom of the 320 x 430 viewport.

## Commands

- `npm --workspace apps/mobile run test -- src/features/community/communityRoutes.test.ts`
- `npm --workspace apps/mobile run typecheck`
- `git diff --check`

## Evidence

- Pre-fix route snapshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postrecommendations-sweep/community.json`
- Post-fix hub screenshot: `test-results/human-e2e/2026-07-08/community-short-phone-430-card-fit/community.png`
- Post-fix hub geometry: `test-results/human-e2e/2026-07-08/community-short-phone-430-card-fit/community.json`
- Tapped note detail: `test-results/human-e2e/2026-07-08/community-short-phone-430-card-fit/community-natural-note-detail.png`
- Summary: `test-results/human-e2e/2026-07-08/community-short-phone-430-card-fit/summary.json`
- Follow-up sweep: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postcommunity-sweep/failures.json`

## Result

Targeted `/community` verification passed with zero clipped controls, zero sub-44 visible controls, and zero blocked center hit-tests. Tapping the previously clipped note opened `/community/note/note-natural-gentler`, which also passed the same geometry audit.

The 49-route post-Community sweep no longer reports `/community`. Remaining 320 x 430 failures are `/settings/subscription`, `/settings/notifications`, and the `/shelf/opened` backdrop audit.

## Remaining Risk

Native iOS and Android safe-area behavior, Dynamic Type, and screen-reader traversal still need release-device QA.
