# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify `/recommendations` shortest-phone card fit after the 320 x 480 clipping fix.
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 8210 --host localhost`
- Browser/device/simulator/OS: Headless Chrome through Playwright, 320 x 480 viewport, Windows host
- Feature or PR tested: Personalized Recommendations For You hub
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web`
- iOS Simulator: Not used
- Android emulator: Not used
- Expo web: Used
- Playwright: Used from bundled Codex runtime with local Chrome
- Playwright MCP: Not used
- Codex Computer Use: Not used
- Other: Focused Vitest route-contract test

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Personalized Recommendations | Mobile recommendation card width at 320 x 480 | Pass | `recommendations.png`, `recommendations.json`, `summary.json`, `browser-logs.json` | Back and Preferences remain visible, both recommendation cards show evidence plus `See how`, zero clipped visible controls, zero sub-44 controls, zero blocked hit-tests, and zero horizontal overflow. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- |
| `2026-07-08-recommendations-short-phone-card-clipping` | Medium | Open `/recommendations` at 320 x 480 before the fix | Visible cards are complete before their evidence/action row | Second visible card clipped below viewport | `../current-main-short-phone-480-sweep/recommendations.png`, `../current-main-short-phone-480-sweep/recommendations.json` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/recommendations/recommendationRoutes.test.ts`
- What it covers: The For You hub now has a `height < 520` branch, passes `shortHub` into `HubIntro` and `RecCard`, keeps compact evidence typography, and preserves the narrow continuation spacing.
- Why this should be automated: The bug is a route-density regression that is easy to reintroduce with copy or spacing changes.

## Commands Run

```bash
npx prettier --write apps/mobile/src/app/recommendations/index.tsx apps/mobile/src/features/recommendations/recommendationRoutes.test.ts PROGRESS.md docs/USER_FLOW_TREE.md docs/e2e-bug-reports/2026-07-08-recommendations-short-phone-card-clipping.md
npm --workspace apps/mobile run test -- src/features/recommendations/recommendationRoutes.test.ts
npm --workspace apps/mobile run web -- --port 8210 --host localhost
node test-results/human-e2e/2026-07-08/recommendations-short-phone-480-card-fit/audit.cjs
```

## Remaining Risk

- Untested flows: Native iOS/Android safe-area, Dynamic Type, and screen-reader traversal.
- Missing fixtures: Durable native compact-phone visual regression for the For You hub.
- Flaky areas: Expo web dev-server startup can vary by local port availability.
- Manual follow-up needed: Promote this route into the eventual native compact-phone E2E suite.
