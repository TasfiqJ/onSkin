# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify Shelf product-detail More options glyph and bottom lifecycle dock polish
- App surface: Expo web
- Build/start command: `EXPO_PUBLIC_E2E_LOCAL_RESET=1 npx expo start --web --port 8157 --clear`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature or PR tested: Shelf manual add to product detail, More options sheet, product-detail freshness controls
- Overall verdict: Pass with native-device follow-up

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf manual add | Happy path | Pass | `01-manual-entry-empty.png`, `02-manual-entry-filled.png`, `03-opened-date.png`, `04-opened-date-scrolled.png`, `05-shelf-after-add.png` | Added `Glyph Gel` / `RoutineKind` through the real manual intake and opened-date sheet. |
| Product detail | More options glyph and dock | Pass | `09-product-detail-clipped-visibility-initial.png`, `10-product-detail-scrolled-best-before.png`, `11-more-options-manage-sheet.png` | More options is an accessible 48 x 48 target, raw `...` is absent, the best-before row is reachable after scroll, and the named manage sheet has 48 px+ controls. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- |
| shelf-detail-more-options-glyph-dock | Medium | Open product detail at 320 x 568 and inspect the top-right More options control plus freshness rows near the lifecycle dock. | Intentional icon affordance and no blocked visible freshness control. | Literal ellipsis source and a blocked pre-fix best-before center hit-test. | `docs/e2e-bug-reports/2026-07-08-shelf-detail-more-options-glyph-dock.md` |

## Tests Added Or Updated

- `apps/mobile/src/features/shelf/shelfRoutes.test.ts`: source contracts for the More options glyph, 48 px controls, and constrained product-detail scroll area.

## Commands Run

```bash
npx prettier --write apps/mobile/src/app/shelf/[id].tsx apps/mobile/src/features/shelf/shelfRoutes.test.ts
npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts
```

## Remaining Risk

- Native iOS/Android safe-area, Dynamic Type, and screen-reader traversal remain covered by the native QA gate.
- Live catalog-report backend behavior remains out of scope for this local fixture.
