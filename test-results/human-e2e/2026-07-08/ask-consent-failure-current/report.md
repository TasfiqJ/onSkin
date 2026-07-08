# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Ask RoutineKind cloud consent save and withdrawal failure branch
- App surface: Expo web through the Codex in-app browser
- Build/start command: `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only npm --workspace apps/mobile run web -- --port 8139 --host localhost --clear`
- Browser/device/simulator/OS: Codex in-app browser on Windows, 320 x 568 viewport
- Feature or PR tested: `/ask/consent` cloud Ask consent persistence failure recovery
- Overall verdict: Pass after fix

## Tool Inventory

- Expo CLI: used
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used
- Playwright: used through the in-app browser runtime
- Playwright MCP: not used as a standalone harness
- Codex Computer Use: not used
- Other: browser console warn/error log capture

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Ask RoutineKind Deterministic Advisor | cloud consent save or withdrawal failure | Pass after shared switch fix | `01-initial-ask-consent.png/json`, `01b-toggle-visible-before-grant.png/json`, `02-grant-failure-inline-alert.png/json`, `03-grant-retry-success.png/json`, `04-revoke-failure-inline-alert.png/json`, `05-revoke-retry-success.png/json` | Initial state starts off; grant failure keeps switch off and shows route-owned alert; grant retry turns on and clears alert; revoke failure keeps switch on and shows route-owned alert; revoke retry turns off and clears alert. |
| Browser console | current run warn/error logs | Pass | `browser-warn-error-logs.json` | Current `8139` run had no warn/error logs. Unfiltered browser history included stale warnings from previous localhost ports, so the artifact filters to the run under test. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| BUG-001 | High | Open `/ask/consent` at 320 x 568, scroll to the switch, activate `Enable Ask RoutineKind` via role click, coordinate click, or DOM click. | The switch runs the consent handler and shows the one-shot failure recovery. | The switch exposed the correct role and 52 x 48 geometry but did not toggle on web because the shared component disabled React Native `onPress` on web. | `docs/e2e-bug-reports/2026-07-08-toggle-switch-web-inert.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/components/ui/ToggleSwitch.test.ts`
- What it covers: the shared switch remains semantic, keeps the 52 x 48 phone target, uses `onPress={activate}` across platforms, keeps a web `tabIndex`, and keeps the web Space-key activation handler.
- Why this should be automated: `ToggleSwitch` is shared by Ask consent, Trend consent, notification settings, You privacy/security controls, and widgets opt-in; an inert switch blocks critical consent and settings flows.

## Commands Run

```bash
EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=true EXPO_PUBLIC_E2E_ASK_CONSENT_FAILURE=grant_once,revoke_once EXPO_PUBLIC_E2E_ASK_CONSENT_LEDGER=local_only npm --workspace apps/mobile run web -- --port 8139 --host localhost --clear
npm --workspace apps/mobile run test -- src/components/ui/ToggleSwitch.test.ts src/features/ask/routeContract.test.ts src/features/ask/applyConsentChoice.test.ts src/features/ask/consent.test.ts src/features/ask/store.test.ts src/features/ask/gate.test.ts src/features/ask/claimsafety.test.ts src/features/trend/trendRoutes.test.ts # 8 files, 124 tests passed
npm --workspace apps/mobile run test # 169 files, 1695 tests passed
npm --workspace apps/mobile run typecheck # passed
npm --workspace apps/mobile run lint # passed
npm run typecheck # passed, 2 Turbo tasks successful
npm run lint # passed, 2 Turbo tasks successful
npm test # passed, 1 Turbo task successful, mobile 169 files / 1695 tests
```

## Remaining Risk

- Untested flows: native iOS/Android switch activation, VoiceOver/TalkBack traversal, and OS back-swipe behavior.
- Missing fixtures: live authenticated Supabase consent ledger and cloud Ask vendor path remain blocked by production credentials/legal/vendor approvals.
- Flaky areas: none observed in the final Expo web rerun.
- Manual follow-up needed: run this branch on native iOS and Android beta builds once device/service QA is available.
