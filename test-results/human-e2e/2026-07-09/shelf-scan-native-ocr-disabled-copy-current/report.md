# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-09
- Codex task: B-NATIVE-OCR copy honesty pass for Shelf scan fallback
- App surface: Expo web through Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8260 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser, 360 x 640 viewport
- Feature or PR tested: `/shelf/scan` fallback into `/shelf/ocr`
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web -- --port 8260 --host localhost`
- iOS Simulator: Not used for this Expo-web-compatible copy pass
- Android emulator: Not used for this Expo-web-compatible copy pass
- Expo web: Used
- Playwright: Used through the Codex in-app browser runtime
- Playwright MCP: Not used
- Codex Computer Use: Not used
- Other: Vitest focused shelf route contract test

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf Product Add | Native OCR disabled scan fallback copy | Pass | `scan-native-ocr-disabled-copy.png`, `scan-native-ocr-disabled-copy.json` | Verified the compact scan fallback shows `Scan label`, exposes the honest accessibility label `Scan ingredient label. Capture label, then type from it`, has a 320 x 48 control, has 0 px horizontal overflow, and does not expose `Review editable OCR`. |
| Shelf Product Add | Scan label fallback opens OCR route | Pass | `ocr-native-ocr-disabled-copy.png`, `ocr-native-ocr-disabled-copy.json`, `browser-warn-error-logs.json` | Tapped the scan fallback, reached `/shelf/ocr`, and verified `On-device OCR is not enabled in this build yet` with no old editable-OCR copy and no current-route warning/error logs. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| None | n/a | n/a | n/a | n/a | n/a |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/shelf/shelfRoutes.test.ts`
- What it covers: Prevents `/shelf/scan` from advertising `Review editable OCR` while native OCR is not enabled and requires the honest label-capture/manual-typing copy.
- Why this should be automated: OCR remains blocked on native implementation and device QA, so scan fallback copy must not imply the app can read labels automatically.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/shelf/shelfRoutes.test.ts
npm --workspace apps/mobile run web -- --port 8260 --host localhost
```

## Remaining Risk

- Native iOS and Android camera, safe-area, Dynamic Type, and screen-reader behavior remain physical-device QA gates.
- Real OCR capture quality and parsing accuracy remain blocked until a native OCR module is selected, implemented, and reviewed.
- The local Expo web route runs with camera unavailable, so it verifies copy posture and fallback navigation, not real native camera behavior.
