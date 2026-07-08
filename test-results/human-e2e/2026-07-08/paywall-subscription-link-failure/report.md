# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Paywall and subscription settings external-handoff failure recovery
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 19159 --host localhost`
- Browser/device/simulator/OS: System Chrome via Playwright, 320 x 568 viewport
- Feature or PR tested: Paywall Terms/Privacy/Restore feedback and Subscription Settings Manage/Terms/Privacy/Restore feedback
- Overall verdict: Pass with external native QA remaining

## Tool Inventory

- Expo CLI: used through npm workspace script
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used at `http://localhost:19159`
- Playwright: used through `npm exec --package=@playwright/test`
- Playwright MCP: not used
- Codex Computer Use: not used
- Other: local E2E env fixtures

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| `/paywall/upsell?feature=full_routine` | Terms/Privacy browser handoff failure | Pass | `paywall-terms-failure.png`, `paywall-after.json` | Row-local `Link unavailable` feedback is visible. |
| `/paywall/upsell?feature=full_routine` | Restore empty state | Pass | `paywall-restore-failure.png`, `paywall-after.json` | Restore reports `No active subscription was found for this account.` |
| `/settings/subscription` | Store-backed manage billing linking failure | Pass | `settings-manage-failure.png`, `settings-after.json` | Billing failure copy remains visible in the card. |
| `/settings/subscription` | Policy and Restore failure/empty state | Pass | `settings-restore-failure.png`, `settings-after.json` | Policy failure and restore-empty status remain visible. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| 2026-07-08-paywall-subscription-link-failure | Medium | Force browser/linking failure, tap paywall/subscription policy and billing controls | Persistent visible recovery feedback | Pre-fix surfaces relied on transient alerts only | `docs/e2e-bug-reports/2026-07-08-paywall-subscription-link-failure.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/subscription/paywallMobileContracts.test.ts`
- What it covers: Paywall compliance feedback, restore feedback, and store-backed E2E entitlement fixture.
- Test file: `apps/mobile/src/features/settings/settingsRoutes.test.ts`
- What it covers: Subscription settings feedback for billing/policy/restore failure.
- Test file: `apps/mobile/src/features/photos/progressRoutes.test.ts`
- What it covers: Updated entitlement fixture contract for `pro` and `store_pro`.

## Commands Run

```bash
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts src/features/settings/settingsRoutes.test.ts src/features/photos/progressRoutes.test.ts src/lib/navigation/externalOpen.test.ts
npm --workspace apps/mobile run web -- --port 19159 --host localhost
npm exec --yes --package=@playwright/test -- playwright test scripts/tmp-e2e/paywall-subscription-link-failure.spec.js --reporter=list --output=web-build/playwright-output-paywall-subscription-link-failure
```

## Remaining Risk

- Native StoreKit/Play billing-management sheet success and failure need physical iOS/Android QA.
- Live RevenueCat restore active/empty states need sandbox QA.
- Final production policy URLs need final legal/domain evidence.
