# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify Today PM cycle completion analytics path and product-detail More options glyph change before pushing to `main`
- App surface: Expo web
- Build/start command: `EXPO_PUBLIC_E2E_LOCAL_RESET=1 EXPO_PUBLIC_E2E_ENTITLEMENT=pro npm --workspace apps/mobile run web -- --port 8154 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature or PR tested: PM cycle-night check-off path, generated routine handoff, product-detail More options sheet
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Routine Plan First Value | manual front-label shelf products | Pass | `routine-plan.png`, `routine-plan-state.json`, `today-pm-before.png`, `today-pm-before.json`, `today-pm-after-retake.png`, `today-pm-after-retake.json` | Added Retinol 0.3% Night Serum, Glycolic 7% Toner, and Mineral SPF 50 through manual Shelf UI, generated a routine, opened Today PM, and completed Night 1 from `0 of 1` to `1 of 1`. |
| Shelf Product Add | product detail lifecycle and catalog-report recovery | Pass | `product-detail-before-more.png`, `product-detail-before-more.json`, `product-detail-more-sheet.png`, `product-detail-more-sheet.json` | Opened Mineral SPF 50 detail, verified More options remains a 48 x 48 accessible target, and opened the named `Remove from shelf?` dialog. |

## Bugs Found

None.

## Tests Added Or Updated

- `apps/mobile/src/features/today/cycleCompletion.test.ts`: unit coverage for only firing `cycle_night_completed` on a completed PM cycle night.
- `apps/mobile/src/features/today/todayRoute.test.ts`: source contract for the Today PM check-off instrumentation and privacy-safe payload.
- `apps/mobile/src/features/shelf/shelfRoutes.test.ts`: source contract for the More options glyph and product-detail action sizing.
- `apps/mobile/src/lib/analytics/track.test.ts`: allowlist coverage for `cycle_night_completed`.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/today/cycleCompletion.test.ts src/features/today/todayRoute.test.ts src/features/shelf/shelfRoutes.test.ts src/lib/analytics/track.test.ts
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm run phase7:check-core-loop
npm run phase10:beta-analytics-audit
npm run docs:source-packet-audit:strict
```

## Remaining Risk

- Native iOS/Android dynamic type, screen-reader traversal, and device persistence remain covered by the existing external device QA gates.
- Live PostHog dashboard ingestion still depends on Tas-owned production analytics configuration and dashboard evidence.
