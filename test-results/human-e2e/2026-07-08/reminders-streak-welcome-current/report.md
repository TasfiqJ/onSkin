# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify the reminders/streak/widgets Pro route group with fresh UI evidence.
- App surface: Expo web in the Codex in-app browser.
- Build/start command: `npm --workspace apps/mobile run web -- --port 8153 --non-interactive`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 phone viewport.
- Feature or PR tested: Direct `/routine/streak`, `/routine/welcome-back`, and `/routine/widgets` gating and reverse-trial access.
- Overall verdict: Pass with native follow-up.

## Tool Inventory

- Expo CLI: available; web server started on port 8153.
- iOS Simulator: not used.
- Android emulator: not used.
- Expo web: used.
- Playwright: used through the Codex in-app browser API where available; DOM snapshot API failed on this RN web route, so bounded read-only DOM evaluation plus screenshots were used.
- Codex Computer Use: not used.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Pro Feature Gating | Fresh free direct `/routine/streak` | Pass | `01-free-streak-paywall.*` | Shows `Reminders, streaks & home-screen widgets.`, no streak surface content, zero horizontal overflow, 48 px+ controls. |
| Pro Feature Gating | Fresh free direct `/routine/welcome-back` | Pass | `02-free-welcome-back-paywall.*` | Shows the same contextual paywall, no welcome-back surface content, zero horizontal overflow, 48 px+ controls. |
| Pro Feature Gating | Fresh free direct `/routine/widgets` | Pass | `03-free-widgets-paywall.*` | Shows the reminders/widgets contextual paywall, no widget deferred surface content before entitlement. |
| Pro entitlement state | No-card reverse trial from contextual paywall | Pass | `04-reverse-trial-widgets-unlocked.*` | `Explore first. 7 days of Pro` unlocks the widget deferred surface with `Back to Today`. |
| Pro entitlement state | Reverse-trial direct `/routine/streak` | Pass | `05-reverse-trial-streak-unlocked.*` | Renders the calm streak surface: `Showing up beats being perfect.` |
| Pro entitlement state | Reverse-trial direct `/routine/welcome-back` | Pass | `06-reverse-trial-welcome-back-unlocked.*` | Renders `Welcome back.` plus the primary `Tonight's step` action. |
| Pro direct-entry exits | Welcome-back CTA | Pass | `07-welcome-back-cta-today.*` | `Tonight's step` routes to `/today`; no trap on direct entry. |
| Pro direct-entry exits | Widget deferred CTA | Pass | `08-widgets-back-to-today.*` | `Back to Today` routes to `/today`; no trap on direct entry. |

## Bugs Found

None.

## Tests Added or Updated

- No app code or tests changed in this slice.
- Existing focused route contracts were run:
  - `apps/mobile/src/features/subscription/gatedRoutes.test.ts`
  - `apps/mobile/src/features/subscription/proGatedRoutes.test.ts`

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8153 --non-interactive
npm --workspace apps/mobile run test -- src/features/subscription/gatedRoutes.test.ts src/features/subscription/proGatedRoutes.test.ts
```

## Remaining Risk

- Native iOS/Android rendering, safe-area, text-scale, and screen-reader behavior remain device QA.
- Native WidgetKit/Glance/ActivityKit surfaces remain deferred behind device-build QA.
- RevenueCat purchase, restore, and live entitlement sync remain Phase 6 QA.
