# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Catalog search wrong-match pre-add reporting
- App surface: Expo web
- Build/start command: `EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=wrong_match npm --workspace apps/mobile run web -- --port 8426 --host localhost`
- Browser/device/simulator/OS: Headless Chrome or Edge, 390 x 844 plus 360 x 640 support-floor spot check
- Feature or PR tested: Shelf catalog search result reporting
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf catalog search | Wrong match before add | pass | `test-results/human-e2e/2026-07-09/catalog-search-wrong-match-current` | Searched `ceramide cleanser`, reported `Not this product`, saw inline feedback, then continued to manual add with query preserved. |
| Shelf catalog search | 360 x 640 support-floor controls | pass | `test-results/human-e2e/2026-07-09/catalog-search-wrong-match-current` | Result card, `Use this match`, `Not this product`, Search, Back, and Add by hand were complete and center-hit-testable. |

## Bugs Found

None in this pass.

## Commands Run

```bash
npm run e2e:catalog-search-wrong-match
```

## Remaining Risk

- Live Supabase insertion remains backend/environment QA because this run uses the offline placeholder configuration.
- Native iOS/Android camera and OS-level catalog recovery QA remain separate device work.

