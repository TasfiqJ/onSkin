# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Commerce no-consent paid-link locking
- App surface: Expo web
- Build/start command: `CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app npm --workspace apps/mobile run web -- --port 8199 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature tested: Commerce Trust And Shoppable Routines / no commerce consent
- Overall verdict: Pass after fix

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Stack detail | No commerce consent | Pass after fix | 01, 02, 03 | Pre-fix stack exposed paid-link copy before consent; post-fix renders locked rows and consent sheet. |
| Recommendation detail | No commerce consent | Pass | 04, 05, 06 | SPF gap recommendation shows locked where-to-buy block, opens consent, and shelf fallback routes to manual add. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |
| COM-NOCONSENT-STACK-001 | High | Open `/commerce/stack/sensitive-skin-starter-set` with commerce enabled and consent off. | No paid links shown at all before separate commerce consent. | Stack rows showed `Paid link`, `Paid links`, external glyph, and paid-link accessibility labels before consent. | `01-stack-before-paid-links-visible.*` |

## Tests Added Or Updated

- `apps/mobile/src/features/commerce/commerceRoutes.test.ts`: source contract for stack locked rows/disclosure before consent.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/commerce/commerceRoutes.test.ts src/features/commerce/claimsafety.test.ts src/features/commerce/commerce.test.ts
npm run typecheck
npm run lint
npm test
git diff --check
```

## Remaining Risk

- Native iOS/Android screen-reader traversal and modal focus trapping need device QA.
- Real retailer URL OS-refusal remains blocked until approved HTTPS retailer links are available.
