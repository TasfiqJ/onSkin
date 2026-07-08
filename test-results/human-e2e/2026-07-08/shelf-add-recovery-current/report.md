# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Shelf add recovery, no-match/offline fallback, and archive recovery on compact phones
- App surface: Expo web through Codex in-app browser
- Build/start command: `EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT=offline EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=no_match EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro npm --workspace apps/mobile run web -- --port 8138 --host localhost --clear`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport, Windows host
- Feature or PR tested: Shelf Product Add branches from `docs/USER_FLOW_TREE.md`
- Overall verdict: Pass with issues fixed

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web`
- iOS Simulator: Not used
- Android emulator: Not used
- Expo web: Used
- Playwright: Used through Codex in-app browser control
- Playwright MCP: Not installed as a durable repo dependency
- Codex Computer Use: Not used
- Other: Browser console log capture

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf start | Empty shelf compact layout | Pass | `01-shelf-start.png`, `01-shelf-start.json` | Empty state rendered at 320 px with zero horizontal overflow. |
| Catalog search | No search result | Pass | `02-search-no-result.png`, `02-search-no-result.json` | Forced no-match fixture showed manual fallback copy. |
| Catalog search | No-match manual fallback | Pass | `03-search-fallback-manual.png`, `03-search-fallback-manual.json` | `Add by hand` opened `/shelf/manual`. |
| Barcode scan | Offline catalog lookup | Pass | `04-scan-offline.png`, `04-scan-offline.json` | Offline copy showed search, label-scan, and manual fallbacks; no `Product not found` link. |
| No-match sheet | Safe fallback routes | Pass | `05-no-match-sheet.png`, `05-no-match-sheet.json`, `06-no-match-search-route.png`, `06-no-match-search-route.json` | Sheet exposed search, label scan, and manual paths without contribution-back promises. |
| Manual add | Product intake and opened-date sheet | Pass | `07-opened-date-for-archive-product.png`, `07-opened-date-for-archive-product.json` | Added `E2E Archive Balm` through manual intake. |
| Shelf list | One active product | Pass | `08-shelf-one-product.png`, `08-shelf-one-product.json`, `09-resume-shelf-state.png`, `09-resume-shelf-state.json` | Product card visible, zero horizontal overflow. |
| Product detail | Lifecycle action | Pass | `10-product-detail-before-finish.png`, `10-product-detail-before-finish.json` | Detail exposed visible 50 px `Mark finished` action. |
| Empty shelf archive | Archive action after finish | Fail, then fixed | `11-empty-shelf-with-archive-pre-fix.png`, `11-empty-shelf-with-archive-pre-fix.json`, `bug-001-empty-shelf-archive-covered.md` | Floating tab bar covered the archive action before the fix. |
| Empty shelf archive | Post-fix archive action | Pass | `12-empty-shelf-with-archive-fixed.png`, `12-empty-shelf-with-archive-fixed.json` | `View archive (1)` rendered as a visible 48 px target above the floating tab bar. |
| Archive route | Archived product visible | Pass | `13-archive-product-visible.png`, `13-archive-product-visible.json` | Tapping archive opened `/shelf/archive` with `E2E Archive Balm` visible. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| BUG-001 | High | Finish the only active Shelf product at 320 x 568 and return to `/shelf`. | `View archive (1)` is visible and tappable above the floating tab bar. | The archive action existed in the DOM but was covered by the tab bar. | `bug-001-empty-shelf-archive-covered.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/shelf/shelfRoutes.test.ts`
- What it covers: The empty Shelf archive branch now has a compact-with-archive layout contract that keeps the archive affordance reachable on short phones.
- Why this should be automated: The regression was a real compact-screen visibility bug that DOM-only route checks could miss without a source contract and browser evidence.

## Commands Run

```bash
git fetch --all --prune
git restore -- package-lock.json
git merge --ff-only origin/main
EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT=offline EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=no_match EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro npm --workspace apps/mobile run web -- --port 8138 --host localhost --clear
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test -- shelfRoutes.test.ts scanLog.test.ts analytics.test.ts client.test.ts store.test.ts useShelf.test.ts
```

Results:

- `npm --workspace apps/mobile run typecheck`: passed
- `npm --workspace apps/mobile run lint`: passed
- Focused Vitest command: 27 files passed, 156 tests passed

## Logs

- Browser warn/error capture: `browser-warn-error-logs.json`
- Log result: warnings only. Expected local warnings include placeholder Supabase URL/key, Expo notifications web listener limitation, and one Metro reconnect warning after hot reload.

## Remaining Risk

- Native iOS/Android barcode camera and OCR capture were not tested.
- Live Open Beauty Facts lookup and source attribution behavior were not tested.
- Live Supabase `shelf_scans` insert/RLS evidence was not tested because Supabase credentials remain a Tas-owned launch blocker.
- Native home-indicator, Dynamic Type, VoiceOver, and TalkBack traversal still require physical-device QA.
