# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Replace You-tab privacy/data-rights native alerts with route-owned inline recovery and confirmations.
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 8160`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature or PR tested: Settings privacy/data-rights recovery on `/settings/privacy` -> `/you?section=privacy`
- Overall verdict: Pass with external-service follow-up

## Tool Inventory

- Expo CLI: Used on port 8160
- iOS Simulator: Not used
- Android emulator: Not used
- Expo web: Used
- Playwright: Used through the Codex in-app browser
- Playwright MCP: Not used separately
- Codex Computer Use: Not used
- Other: Browser screenshots and console logs

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Settings privacy entry | Direct `/settings/privacy` route | Pass | `01-settings-privacy-baseline.png` | Redirected to `/you?section=privacy`, no initial alerts, zero horizontal overflow. |
| Data export | Backend unavailable | Pass | `02-export-inline-failure.png`, `summary.json` | Inline `Export failed`, no JS/native dialog, no raw backend text. |
| Delete account | Inline confirmation and cancel | Pass | `03-delete-inline-confirmation.png`, `04-delete-cancelled.png` | Delete and Cancel controls are 200 x 56 and above the floating tab bar. |
| Delete account | Backend unavailable after confirm | Pass | `05-delete-inline-failure.png`, `summary.json` | Inline `Deletion failed`, route stayed `/you?section=privacy`, no raw backend text. |
| Health-data withdrawal | Inline confirmation and backend unavailable | Pass | `06-withdraw-inline-confirmation.png`, `07-withdraw-inline-failure.png`, `summary.json` | The first pass found a tab-bar overlap; post-fix buttons are above the tab bar and route stays put. |
| Encrypted cloud backup | Consent ledger unavailable | Pass | `08-cloud-backup-inline-failure.png`, `summary.json` | Fails closed inline with switch still OFF; success tradeoff needs live ledger/native QA. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |
| `2026-07-08-settings-data-rights-native-alerts` | Medium | Export/delete/withdrawal recovery in You tab | Route-owned feedback and confirmations | Old route used `Alert.alert` | `docs/e2e-bug-reports/2026-07-08-settings-data-rights-native-alerts.md` |
| `2026-07-08-settings-data-rights-tabbar-overlap` | High | Tap Withdraw confirmation at 320 x 568 | Confirm controls above floating tab bar | Button center overlapped tab bar before scroll nudge | `docs/e2e-bug-reports/2026-07-08-settings-data-rights-tabbar-overlap.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/settings/actions.test.ts`
- What it covers: Export feedback remains inline, destructive data-rights actions use route-owned confirmations, stale cross-section feedback is cleared, and confirmation cards nudge above the tab bar.
- Why this should be automated: These are high-trust privacy/destructive actions and easy to regress to native alerts or overlapped controls.
- Test file: `apps/mobile/src/features/settings/applyPrivacyChoice.test.ts`
- What it covers: Cloud-backup success copy is route-owned and no longer uses `Alert.alert`.
- Why this should be automated: Cloud backup is a high-risk consent surface and must not rely on platform chrome for core explanatory copy.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/settings/actions.test.ts src/features/settings/applyPrivacyChoice.test.ts src/features/photos/consent.test.ts
# passed: 3 files, 26 tests

npm --workspace apps/mobile run typecheck
# passed

npm --workspace apps/mobile run lint
# passed

npm --workspace apps/mobile run test
# passed: 169 files, 1718 tests
```

## Remaining Risk

- Native iOS/Android data export share sheet, account deletion, withdrawal, and safe-area/screen-reader traversal still need physical-device QA.
- Live Supabase data-rights Edge Function, RLS, and consent-ledger evidence remains Tas-owned external setup.
- Cloud-backup success tradeoff notice is source-guarded inline, but the success path correctly needs live consent-ledger/native evidence because local placeholder Supabase fails closed.
