# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Lapsed paid entitlement contextual paywall framing
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 19162 --host localhost`
- Browser/device/simulator/OS: System Chrome via Playwright, 320 x 568 viewport
- Feature or PR tested: `/routine/plan` contextual Pro gate with `EXPO_PUBLIC_E2E_ENTITLEMENT=expired_store`
- Overall verdict: Pass with native RevenueCat QA remaining

## Tool Inventory

- Expo CLI: used through npm workspace script
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used at `http://localhost:19162`
- Playwright: used through `npm exec --package=@playwright/test`
- Playwright MCP: not used
- Codex Computer Use: not used
- Other: local E2E entitlement fixture

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| `/routine/plan` | Expired store-backed entitlement | Pass | `routine-plan-lapsed-paid-renewal-320x568.png`, `summary.json` | Shows `Restore Pro for` and `Renew Pro`; hides no-card and first-trial CTAs. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| 2026-07-08-lapsed-entitlement-contextual-paywall | Medium | Open `/routine/plan` with expired paid entitlement | Paid recovery copy | First-trial framing was possible before fix | `docs/e2e-bug-reports/2026-07-08-lapsed-entitlement-contextual-paywall.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/subscription/paywallMobileContracts.test.ts`
- What it covers: Lapsed contextual paywall uses paid recovery copy and fixture support.
- Test file: `apps/mobile/src/features/photos/progressRoutes.test.ts`
- What it covers: E2E entitlement fixture contract includes expired states.

## Commands Run

```bash
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/features/photos/progressRoutes.test.ts src/features/subscription/entitlement.test.ts
npm --workspace apps/mobile run web -- --port 19162 --host localhost
npm exec --yes --package=@playwright/test -- playwright test scripts/tmp-e2e/lapsed-entitlement-contextual-paywall.spec.js --reporter=list --output=web-build/playwright-output-lapsed-entitlement-contextual-paywall
```

## Remaining Risk

- Native RevenueCat expiration/refund and restore states need sandbox QA.
- Expired reverse-trial branch is contract-covered and fixture-backed, but this E2E pass covered only `expired_store`.
- Final production store pricing and localized renewal eligibility remain external QA.
