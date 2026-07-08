# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Slow entitlement no-flash verification for contextual Pro gates
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 19163 --host localhost`
- Browser/device/simulator/OS: System Chrome via Playwright, 320 x 568 viewport
- Feature or PR tested: `/routine/plan` contextual Pro gate with delayed expired-store entitlement
- Overall verdict: Pass with native RevenueCat slow-network QA remaining

## Tool Inventory

- Expo CLI: used through npm workspace script
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used at `http://localhost:19163`
- Playwright: used through `npm exec --package=@playwright/test` with installed system Chrome
- Playwright MCP: not used
- Codex Computer Use: not used
- Other: local E2E entitlement delay fixture

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| `/routine/plan` | Entitlement loading with expired store-backed entitlement | Pass | `01-loading-entitlement-320x568.png`, `02-resolved-contextual-paywall-320x568.png`, `summary.json` | Loading state shows `Checking your access`; sampled text contains no premium routine-plan copy before resolution. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| 2026-07-08-slow-entitlement-no-flash | Medium | Open `/routine/plan` with a delayed entitlement query | Neutral loading state and no premium flash | Empty loading screen before fix | `docs/e2e-bug-reports/2026-07-08-slow-entitlement-no-flash.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/subscription/paywallMobileContracts.test.ts`
- What it covers: The Pro gate renders its loading branch before children and exposes the E2E entitlement delay fixture.

## Commands Run

```bash
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/features/subscription/entitlement.test.ts src/features/subscription/proGatedRoutes.test.ts
npm --workspace apps/mobile run web -- --port 19163 --host localhost
npm exec --yes --package=@playwright/test -- playwright test scripts/tmp-e2e/slow-entitlement-no-flash.spec.js --reporter=list --output=web-build/playwright-output-slow-entitlement-no-flash
```

## Remaining Risk

- Native iOS/Android offline cache restoration and app resume during entitlement resolution remain untested.
- Live RevenueCat slow-network behavior remains external QA.
- The E2E fixture validates UI gating semantics, not RevenueCat service latency.
