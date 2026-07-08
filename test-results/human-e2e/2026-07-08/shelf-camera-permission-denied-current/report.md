# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Shelf scan/OCR camera permission denied recovery
- App surface: Expo web through Codex in-app browser
- Build/start command: `EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION=denied_no_retry EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1 EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro npm --workspace apps/mobile run web -- --port 8147 --host localhost --clear`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature or PR tested: Shelf Product Add, camera permission denied branch
- Overall verdict: Pass with native-device follow-up

## Tool Inventory

- Expo CLI: used through `npm --workspace apps/mobile run web`
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used
- Playwright/browser automation: Codex in-app browser targeted page checks and screenshots
- Codex Computer Use: not used

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf Product Add | Scan camera permission denied | Pass | `scan-before-open-settings.png`, `scan-after-open-settings.png`, `scan-after-open-settings.json` | Shows one `Open settings`, no JS dialog after forced Settings failure, inline `Camera settings unavailable`, search/OCR/manual fallbacks remain visible. |
| Shelf Product Add | OCR camera permission denied | Pass | `ocr-before-open-settings.png`, `ocr-after-open-settings.png`, `ocr-after-open-settings.json` | Shows one `Open settings`, no JS dialog, inline settings-unavailable recovery, and `Continue with manual text`. |
| Shelf Product Add | OCR manual fallback after denied camera | Pass | `ocr-manual-review.png`, `ocr-to-manual-after-continue.png`, `ocr-to-manual-after-continue.json` | Entered `Aqua, Glycerin, Niacinamide`; `/shelf/manual` receives the ingredient text. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| `2026-07-08-shelf-permission-settings-inline-recovery` | Important | Source review of `/shelf/scan` and `/shelf/ocr` before the fix showed `Open settings` used the shared default alert path and had no route-owned failure state. | Settings handoff failure renders stable in-app recovery and keeps fallback paths available. | The route could rely on a native/browser alert and had no deterministic denied/no-retry web fixture. | `docs/e2e-bug-reports/2026-07-08-shelf-permission-settings-inline-recovery.md` |

## Tests Added or Updated

- `apps/mobile/src/features/shelf/shelfRoutes.test.ts`: source contracts for the Shelf camera permission fixture, inline settings failure state, 48 px settings button, and OCR reticle gating.
- `apps/mobile/src/features/navigation/sheetRouteContracts.test.ts`: shared permission recovery contract requires Shelf scan/OCR to use the settings failure copy with `alertOnFailure: false`.
- Focused command passed: `npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts src/features/navigation/sheetRouteContracts.test.ts src/lib/navigation/appSettings.test.ts`.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts src/features/navigation/sheetRouteContracts.test.ts src/lib/navigation/appSettings.test.ts

$env:EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION='denied_no_retry'
$env:EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE='1'
$env:EXPO_PUBLIC_E2E_ENTITLEMENT='store_pro'
npm --workspace apps/mobile run web -- --port 8147 --host localhost --clear
```

## Evidence Files

- `scan-before-open-settings.png`
- `scan-before-open-settings.json`
- `scan-after-open-settings.png`
- `scan-after-open-settings.json`
- `ocr-before-open-settings.png`
- `ocr-before-open-settings.json`
- `ocr-after-open-settings.png`
- `ocr-after-open-settings.json`
- `ocr-manual-review.png`
- `ocr-manual-review.json`
- `ocr-to-manual-after-continue.png`
- `ocr-to-manual-after-continue.json`
- `ui-geometry-audit.json`
- `browser-warn-error-logs-localhost-8147.json`

## Remaining Risk

- Expo web cannot prove the native iOS/Android OS permission sheet, "don't ask again" semantics, real `Linking.openSettings()` success, physical camera startup, barcode frame processor behavior, or OCR camera behavior.
- Native safe-area, Dynamic Type, VoiceOver, and TalkBack traversal still need physical iOS/Android QA.
- Live Supabase `shelf_scans` RLS evidence and real Open Beauty Facts lookup coverage remain separate launch gates.
