# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Replace Progress single-photo delete native alert with route-owned inline confirmation and recovery.
- App surface: Expo web in Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run web -- --port 8161`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature or PR tested: Progress single-photo detail deletion
- Overall verdict: Pass with known external follow-up

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web -- --port 8161`
- iOS Simulator: Not used
- Android emulator: Not used
- Expo web: Used
- Playwright: Used through Codex in-app browser
- Codex Computer Use: Not used
- Other: Dev-only fixtures `EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated`, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`, `EXPO_PUBLIC_E2E_PHOTO_DELETE_FAILURE=1`

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Progress single-photo detail | Delete confirmation cancel | Pass | `02-delete-confirmation.png`, `03-after-cancel.png`, `confirmation-state.json`, `cancel-state.json` | Panel used route-owned UI, no JS dialog, Cancel returned to the action row. |
| Progress single-photo detail | Delete failure | Pass | `04-after-delete-failure.png`, `after-state.json`, `browser-logs.json` | Forced local delete failure stayed on `/progress/e2e-front-2026-04-01`, rendered inline recovery copy, hid raw fixture text, and kept horizontal overflow at zero. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| `2026-07-08-progress-photo-delete-native-alert` | Medium | Tap `Delete photo` on `/progress/e2e-front-2026-04-01` before the fix. | Route-owned confirmation and delete-failure recovery. | Delete confirmation used `Alert.alert`, with no route-owned failure state. | `docs/e2e-bug-reports/2026-07-08-progress-photo-delete-native-alert.md` |

## Tests Added or Updated

- Test file: `apps/mobile/src/features/photos/progressRoutes.test.ts`
- What it covers: The single-photo detail route no longer uses `Alert.alert` for delete, owns delete confirmation/failure state, uses central photo copy, and waits on `remove.mutateAsync`.
- Why this should be automated: This is a critical privacy/destructive-action branch on the Progress surface and should not regress to platform alerts.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/features/photos/progressRoutes.test.ts src/features/photos/sharePhoto.test.ts src/features/photos/claimsafety.test.ts
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run web -- --port 8161
```

## Remaining Risk

- Native iOS/Android deletion with real encrypted image bytes was not tested in this web-compatible run.
- Device-level file deletion failure still needs simulator/device QA before launch.
- Live Supabase values remain blocked by `B-SUPABASE`; they were not needed for this local fixture flow.
