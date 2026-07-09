# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Verify Shelf no-match spacing after the launch support-floor decision.
- App surface: Expo web through the Codex in-app browser.
- Build/start command: `npm --workspace apps/mobile run web -- --port 8255`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 and 390 x 844 viewport overrides.
- Feature or PR tested: `/shelf/no-match` barcode no-match recovery actions.
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web -- --port 8255`.
- iOS Simulator: Not used.
- Android emulator: Not used.
- Expo web: Used.
- Playwright: Used through the in-app browser runtime.
- Playwright MCP: Not used as a standalone harness.
- Codex Computer Use: Not used.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf barcode no-match recovery | 320 x 480 launch support floor | Pass | `01-no-match-320x480.png`, `01-no-match-320x480.metrics.json` | Search catalog, Scan ingredients, and Add it by hand are visible 264 x 48 px controls with passing center hit-tests and zero horizontal overflow. |
| Shelf barcode no-match recovery | Recovery routing | Pass | `02-click-search-result.png`, `03-click-scan-result.png`, `04-click-manual-result.png`, `click-results.json` | Search routes to `/shelf/search`, scan routes to `/shelf/ocr`, and manual routes to `/shelf/manual`. |
| Shelf barcode no-match recovery | 390 x 844 modern phone | Pass | `05-no-match-390x844.png`, `05-no-match-390x844.metrics.json` | Full `Scan the ingredient list` label is visible, and all three recovery controls are 334 x 68 px, center-hit-testable, and inside the viewport. |

## Bugs Found

None.

## Tests Added or Updated

- Test file: `apps/mobile/src/features/shelf/shelfRoutes.test.ts`
- What it covers: Source contract for preserving 320 x 480 supported-floor no-match recovery spacing while retaining tighter fallback behavior below the support floor.
- Why this should be automated: The no-match sheet is a critical recovery path after scan misses and should not regress into clipped or blocked fallback actions.

## Commands Run

```bash
git fetch origin
npm --workspace apps/mobile run test -- shelfRoutes
npm --workspace apps/mobile run web -- --port 8255
```

## Remaining Risk

- Untested flows: Native barcode camera, OCR camera capture, native safe-area, native Dynamic Type, and screen-reader traversal.
- Missing fixtures: Live Supabase `shelf_scans`, real Open Beauty Facts lookup, and native camera permission fixtures.
- Flaky areas: Browser DOM snapshot API threw inside the in-app browser plugin, so this run used screenshot plus bounded read-only DOM geometry evidence.
- Manual follow-up needed: Native iOS/Android device QA before clearing camera/OCR launch gates.
