# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Settings policy link failed-handoff recovery
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 19146 --host localhost`
- Browser/device/simulator/OS: System Chrome, 320 x 568 phone viewport
- Feature or PR tested: Settings policy/help links in `/settings/privacy`
- Overall verdict: Pass with fix

## Tool Inventory

- Expo CLI: Used through the mobile workspace web script
- iOS Simulator: Not used
- Android emulator: Not used
- Expo web: Used
- Playwright: Used through `npm exec --package=@playwright/test`
- Playwright MCP: Not used
- Codex Computer Use: Not used
- Other: Dev-only `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser` fixture

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| `/settings/privacy` | Policy link handoff failure | Pass after fix | `summary.json`, `02-after-alerts-320x568.png` | Privacy, Consumer Health Privacy, Terms, Support, Account deletion, and Data export each showed row-local failure copy. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| SET-POLICY-001 | Medium | Force browser handoff failure and tap all six policy/help rows | Clear visible recovery copy | No observable browser dialog and no inline feedback before the fix | First failing Playwright run, `summary.json` |

## Tests Added or Updated

- Test file: `apps/mobile/src/lib/navigation/externalOpen.test.ts`
- What it covers: Shared external opener rejects unsafe URLs, alerts on native/browser failures, and exposes a dev-only failed-handoff fixture that is ignored outside development.
- Test file: `apps/mobile/src/features/settings/settingsRoutes.test.ts`
- What it covers: Settings policy rows use row-local accessible feedback when a policy/help handoff fails.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/lib/navigation/externalOpen.test.ts src/features/settings/settingsRoutes.test.ts
npm --workspace apps/mobile run typecheck
npm exec --yes --package=@playwright/test -- playwright test scripts/tmp-e2e/settings-policy-link-failure.spec.js --reporter=list --output=web-build/playwright-output-settings-policy-link-failure
```

## Remaining Risk

- Untested flows: Native iOS/Android OS handoff failures for policy and billing links.
- Missing fixtures: Durable native E2E harness for real Linking/WebBrowser failures.
- Flaky areas: Expo web still logs expected Supabase placeholder network errors while live backend is blocked.
- Manual follow-up needed: Physical-device policy/billing link failure QA during beta build verification.
