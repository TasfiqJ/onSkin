# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: App-lock unavailable recovery
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 8100`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 568 viewport
- Feature tested: App-wide lock overlay, Progress gallery lock, You-tab App lock switch
- Overall verdict: Pass with native device follow-up

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web -- --port 8100`
- Expo web: Used
- Codex in-app browser: Used
- Playwright API: Used through Browser plugin
- iOS Simulator / Android emulator: Not used in this slice

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| `/progress` with app lock enabled | Local-auth unavailable on app-wide lock overlay | Pass | `01-app-lock-overlay-inline-feedback.png`, `summary.json` | Stable inline app-lock copy visible, Unlock remained visible, zero overflow |
| `/progress` retry | Tap Unlock while auth remains unavailable | Pass | `02-app-lock-retry-no-dialog.png`, `summary.json` | No JS/native dialog before or after retry; topmost Unlock was 106 x 48 px |
| `/you` security row | Enable App lock when readiness is unavailable | Pass | `03-you-app-lock-toggle-inline-feedback.png`, `summary.json` | Switch stayed off, row-local `Choice not saved` copy appeared, no raw native/provider text |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| 2026-07-08-app-lock-inline-recovery | Medium | Force app-lock unavailable and open `/progress` or toggle App lock in `/you` | Inline route-owned recovery, no dialog | Source previously used native alerts | `docs/e2e-bug-reports/2026-07-08-app-lock-inline-recovery.md` |

## Tests Added Or Updated

- `apps/mobile/src/lib/applock/authenticate.test.ts`: app-lock auth/readiness fixtures, inline overlay contracts, no app-lock native alerts.
- `apps/mobile/src/lib/applock/store.test.ts`: dev-only app-lock enabled fixture.
- `apps/mobile/src/features/settings/applyPrivacyChoice.test.ts`: You-tab App lock inline feedback contract.

## Commands Run

```bash
npm --workspace apps/mobile run test -- src/lib/applock/authenticate.test.ts src/lib/applock/store.test.ts src/features/settings/applyPrivacyChoice.test.ts
npm --workspace apps/mobile run test -- src/lib/applock/authenticate.test.ts src/lib/applock/store.test.ts src/features/settings/applyPrivacyChoice.test.ts src/features/photos/progressRoutes.test.ts
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run web -- --port 8100
```

## Remaining Risk

- Native iOS/Android local-auth prompt chrome and cancellation gestures were not exercised in this slice.
- Browser warn/error logs contain expected placeholder Supabase warnings, an Expo web notifications warning, and one Metro reconnect warning from the deliberate fixture-server restart.
