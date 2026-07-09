# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: Beta feedback categorized support handoff
- App surface: Expo web in Codex in-app browser
- Build/start command: `EXPO_PUBLIC_SUPPORT_URL=https://support.example.com/beta EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser npm --workspace apps/mobile run web -- --port 8161 --clear`
- Browser/device/simulator/OS: Codex in-app browser, 390 x 844 viewport
- Feature or PR tested: `/you` Beta feedback entry and `/settings/beta-feedback`
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: available, used
- iOS Simulator: not used
- Android emulator: not used
- Expo web: available, used
- Playwright: used through Codex in-app browser
- Playwright MCP: not used
- Codex Computer Use: not used
- Other: Browser console logs and DOM geometry snapshots

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Settings Account Controls | Beta feedback categorized support handoff | Pass | `01-you-initial.png`, `02-you-help-row.png`, `03-beta-feedback-top.png`, `04-beta-feedback-selected.png`, `05-beta-feedback-unavailable.png`, `06-back-to-you.png`, `summary.json` | You tab row opened the beta route, fixed category and priority selections enabled support, forced support handoff failure rendered inline recovery, and Back returned to `/you`. |
| Settings Account Controls | Layout and privacy guard | Pass | `03-beta-feedback-top.json`, `04-beta-feedback-selected.json`, `05-beta-feedback-unavailable.json` | Route had 0 text inputs, 0 horizontal overflow, no JS dialog, and visible controls at 48 px or taller. |
| Settings Account Controls | Browser logs | Pass | `browser-current-origin-warn-error-logs.json` | Current `localhost:8161` run had 0 warn/error logs. Raw tab logs also include historical entries from earlier localhost ports, stored separately in `browser-warn-error-logs.json`. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- |
| None | - | - | - | - | - |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/settings/settingsRoutes.test.ts`
- What it covers: You tab Beta feedback entry, direct-entry back recovery, fixed category/severity support route, no free-text field, and beta-safe support analytics handoff.
- Test file: `apps/mobile/src/lib/analytics/track.test.ts`
- What it covers: Analytics sanitizer permits enum `category` and `severity` for beta support while dropping free text.

## Open Questions

- Native iOS/Android external browser handoff evidence remains Phase 10 device QA.
- Live support desk category/SLA routing remains blocked until Tas configures the production support URL and desk rules.
