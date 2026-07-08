# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Progress photo camera/photo permission denied recovery.
- App surface: Expo web through Codex in-app browser.
- Build/start command: `EXPO_PUBLIC_E2E_PROGRESS_CAMERA_PERMISSION=denied_no_retry EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1 EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro npm --workspace apps/mobile run web -- --port 8146 --host localhost --clear`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport.
- Feature or PR tested: `/progress/capture` permission denied and failed Settings handoff.
- Overall verdict: Pass with native-device follow-up.

## Tool Inventory

- Expo CLI: used through `npm --workspace apps/mobile run web`.
- iOS Simulator: not used in this web-compatible fixture pass.
- Android emulator: not used in this web-compatible fixture pass.
- Expo web: used.
- Playwright: used through the in-app browser runtime.
- Codex Computer Use: not used.

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Progress capture | First-use photo consent gate | Pass | `01-initial-consent-gate.state.json`, `01-initial-consent-gate-viewport.png` | Started on local-only photo consent copy with one 52 px `Take photos. On device only` action and one 48 px `Not now` action. |
| Progress capture | Camera/photo permission denied | Pass | `02-permission-denied-open-settings.state.json`, `02-permission-denied-open-settings-viewport.png`, `02-dialog-after-consent.json` | After consent, route showed `Camera access is needed for progress photos.`, one `Open settings` action, one `Not now` exit, no `Capture photo` control, and no JavaScript dialog. |
| Progress capture | Settings handoff failure | Pass | `03-settings-failure-inline.state.json`, `03-settings-failure-inline-viewport.png`, `03-dialog-after-open-settings.json`, `03-layout-audit.json` | Forced Settings failure rendered inline `Camera settings unavailable` alert, no JavaScript dialog, no raw fixture text, no horizontal overflow, and all visible controls were 48 px+. |
| Progress capture | Permission escape | Pass | `04-returned-progress.state.json`, `04-returned-progress-viewport.png` | `Not now` returned to `/progress` with the first-photo CTA. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| PPD-001 | High | Denied/no-retry permission gate, then failed Settings handoff. | Route-owned recovery and no inert capture affordances behind the gate. | Before the fix, Settings failure depended on shared native-alert fallback and the permission gate still exposed capture chrome behind the overlay. | Post-fix evidence in `03-settings-failure-inline.state.json` and `03-layout-audit.json`; bug report in `docs/e2e-bug-reports/2026-07-08-progress-photo-permission-settings-inline-recovery.md`. |

## Tests Added Or Updated

- `apps/mobile/src/lib/navigation/appSettings.test.ts`: route-owned app-settings failure can return `false` without native alert.
- `apps/mobile/src/features/photos/progressRoutes.test.ts`: Progress capture route keeps denied permission/settings recovery inline and gates capture chrome behind `canAttemptCapture`.
- `apps/mobile/src/features/navigation/sheetRouteContracts.test.ts`: route contracts require inline Progress permission/settings recovery and capture-chrome gating.

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8146 --host localhost --clear
```

## Remaining Risk

- Native iOS and Android OS permission sheets, real Settings handoff, safe-area/home-indicator behavior, and physical camera permission state still require device QA.
- Expo web fixture proves the route recovery contract but not native `Linking.openSettings()` success/failure behavior.
