# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify the remaining full-routine intelligence direct routes with fresh UI evidence.
- App surface: Expo web in the Codex in-app browser.
- Build/start command: `npm --workspace apps/mobile run web -- --port 8154 --non-interactive`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 phone viewport.
- Feature or PR tested: `/routine/reorder`, `/routine/ramp`, `/routine/tolerance`, and `/routine/adaptation` direct gating, local no-card reverse-trial access, and direct-entry exits.
- Overall verdict: Pass with native follow-up.

## Tool Inventory

- Expo CLI: available; web server started from `main` on port 8154.
- iOS Simulator: not used.
- Android emulator: not used.
- Expo web: used.
- Playwright: used through the Codex in-app browser API where supported; screenshots and bounded read-only DOM evaluation captured route state.
- Codex Computer Use: not used.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Pro Feature Gating | Fresh free direct `/routine/reorder` | Pass | `01-free-reorder-paywall.*` | Shows `Unlock your full routine.`, no reorder body markers, zero horizontal overflow, 48 px+ controls. |
| Pro Feature Gating | Fresh free direct `/routine/ramp` | Pass | `02-free-ramp-paywall.*` | Shows the full-routine contextual paywall, no ramp body markers. |
| Pro Feature Gating | Fresh free direct `/routine/tolerance` | Pass | `03-free-tolerance-paywall.*` | Shows the full-routine contextual paywall, no tolerance sheet content. |
| Pro Feature Gating | Fresh free direct `/routine/adaptation` | Pass | `04-free-adaptation-paywall.*` | Shows the full-routine contextual paywall, no adaptation content. |
| Pro entitlement state | No-card reverse trial from contextual paywall | Pass | `05-reverse-trial-adaptation-unlocked.*` | `Explore first. 7 days of Pro` unlocks the adaptation surface. |
| Pro entitlement state | Reverse-trial direct `/routine/reorder` | Pass | `06-reverse-trial-reorder-unlocked.*` | Renders `Example morning`, `Done`, `Save`, and editable example routine rows. |
| Pro entitlement state | Reverse-trial direct `/routine/ramp` | Pass | `07-reverse-trial-ramp-unlocked.*` | Renders `Low and slow, on your terms.` and the ramp status surface. |
| Pro entitlement state | Reverse-trial direct `/routine/tolerance` | Pass | `08-reverse-trial-tolerance-unlocked.*` | Renders the optional non-diagnostic check-in with all three answer choices. |
| Pro direct-entry exits | Reorder `Done` from a fresh direct tab | Pass | `09-exit-reorder-done-before.*`, `09-exit-reorder-done-after.*` | `Done` returns to `/today`. |
| Pro direct-entry exits | Tolerance `Skip` from a fresh direct tab | Pass | `10-exit-tolerance-skip-before.*`, `10-exit-tolerance-skip-after.*` | `Skip` returns to `/today`. |
| Pro direct-entry exits | Adaptation `Looks good` from a fresh direct tab | Pass | `11-exit-adaptation-looks-good-before.*`, `11-exit-adaptation-looks-good-after.*` | `Looks good` returns to `/today`. |
| Pro direct-entry exits | Ramp `Back` from a fresh direct tab | Pass | `12-exit-ramp-back-before.*`, `12-exit-ramp-back-after.*` | `Back` returns to `/today`. |

## Bugs Found

None.

## Tests Added or Updated

- No app code or tests changed in this slice.
- Existing focused route contracts were run after the previous same-area slice:
  - `apps/mobile/src/features/subscription/gatedRoutes.test.ts`
  - `apps/mobile/src/features/subscription/proGatedRoutes.test.ts`

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8154 --non-interactive
```

## Logs

- `browser-warn-error-logs-localhost-8154.json` records no current 8154-origin warn/error logs and no JavaScript dialog.
- `browser-warn-error-logs.json` preserves the broader browser-local warning buffer, which contains expected placeholder Supabase and Expo web-notification warnings from local dev ports.

## Remaining Risk

- Native iOS/Android safe-area, screen-reader, Dynamic Type, and back-swipe behavior remain device QA.
- Live RevenueCat purchase, restore, and entitlement sync remain Phase 6 QA.
- Real non-example shelf/profile states for reorder/ramp/tolerance/adaptation remain broader beta-flow QA; this run proves route gating, unlock access, compact layout, and direct exits.
