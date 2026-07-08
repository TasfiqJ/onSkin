# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Commerce attribution hardening plus current short-phone Shelf/paywall verification
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8202`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 viewport
- Feature or PR tested: Empty Shelf shortest-phone layout, contextual upsell shortest-phone layout
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: available; server on `http://localhost:8202`
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used
- Playwright: in-app browser Playwright API
- Playwright MCP: not used
- Codex Computer Use: not used
- Other: Vitest, TypeScript, ESLint

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf Product Add | empty Shelf compact phone overflow at 320 x 480 | Pass | `shelf-empty-320x480.png`, `shelf-empty-320x480-audit.json`, `shelf-empty-clicks.json` | Empty state shows headline, helper copy, `Scan a barcode`, `Add by hand`, and tab bar in the first viewport. Both exits route correctly. |
| Paywall And Entitlements | contextual upsell shortest-phone recovery at 320 x 480 | Pass | `upsell-reminders-320x480.png`, `upsell-reminders-320x480-audit.json`, `upsell-reminders-320x480-controls-debug.json`, `upsell-maybe-later-click.json`, `upsell-maybe-later-today-320x480.png` | Terms, Privacy, Restore, `Start free trial`, and `Maybe later` are visible and hit-testable. `Maybe later` recovers to `/today`. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| None | - | - | - | - | - |

## Tests Added Or Updated

- `apps/mobile/src/features/commerce/attribution.test.ts`: exact commerce click payload shape and unsafe-value negatives.
- `apps/mobile/src/features/shelf/shelfRoutes.test.ts`: refreshed Shelf empty-state contracts for the current `shortPhone` path.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/commerce/attribution.test.ts src/features/commerce/commerce.test.ts src/features/commerce/commerceRoutes.test.ts
npm --workspace apps/mobile run test -- src/features/commerce/attribution.test.ts src/features/shelf/shelfRoutes.test.ts
npm run typecheck
npm run lint
npm test
git diff --check
npm --workspace apps/mobile run web -- --port 8202
```

## Remaining Risk

- Expo web verifies responsive layout only; native iOS/Android safe-area, StoreKit/Play purchase sheet, and physical-device camera checks remain in `docs/FOR_TAS_TO_DO.md`.
- Live RevenueCat, Supabase, affiliate rail, and policy URL evidence still require Tas-owned production accounts and credentials.
