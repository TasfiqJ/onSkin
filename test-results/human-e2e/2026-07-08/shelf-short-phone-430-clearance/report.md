# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Shelf intake shortest-phone clearance
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 8223 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser at 320 x 430 viewport
- Feature or PR tested: `/shelf/manual`, `/shelf/ocr`, and `/shelf/no-match`
- Overall verdict: Pass for shelf intake, with native-device follow-up

## Tool Inventory

- Expo CLI: Running on localhost port 8223
- iOS Simulator: Not used in this slice
- Android emulator: Not used in this slice
- Expo web: Used
- Playwright: Browser plugin Playwright API
- Codex Computer Use: Not used
- Other: Browser viewport override

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Direct manual add | 320 x 430 compact form | Pass | `shelf-manual-final.png`, `shelf-manual-final.json` | Ingredients field is visible and not hit-blocked by Continue. |
| Direct OCR fallback | 320 x 430 manual text escape | Pass | `shelf-ocr-final.png`, `shelf-ocr-final.json` | `Continue with manual text` is fully visible and unblocked. |
| Barcode no-match sheet | 320 x 430 recovery choices | Pass | `shelf-no-match-final.png`, `shelf-no-match-final.json` | Search, OCR, and manual rows are all visible 48 px+ targets. |
| 49-route compact sweep | Regression check | Pass for shelf | `../current-main-short-phone-430-postfix-sweep/failures.json` | Shelf routes dropped from the failure list; 5 non-shelf routes remain. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| SHELF-430-CLEARANCE | Medium | Open shelf intake routes at 320 x 430 | No clipped or blocked fallback controls | Manual Ingredients, OCR Continue, and no-match manual row were blocked or clipped | `docs/e2e-bug-reports/2026-07-08-shelf-short-phone-430-intake-clearance.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/shelf/shelfRoutes.test.ts`
- What it covers: Ultra-short 430 px shelf intake density contracts for manual add, OCR fallback, and no-match recovery.
- Why this should be automated: These are static route-level layout contracts that prevent future regressions back to 480 px assumptions.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts
git diff --check
# Codex in-app browser human E2E at 320 x 430
```

## Remaining Risk

- Untested flows: Native iOS and Android safe-area, keyboard, Dynamic Type, real camera permission, real OCR capture.
- Missing fixtures: Real device camera/OCR and barcode capture.
- Flaky areas: Expo web route geometry is a proxy for mobile layout, not a replacement for native device QA.
- Manual follow-up needed: Fix the remaining 320 x 430 non-shelf failures from the post-fix sweep.
