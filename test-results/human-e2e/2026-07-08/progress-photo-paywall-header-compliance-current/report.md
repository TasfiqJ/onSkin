# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify compact photo-progress contextual paywall compliance placement before committing the ProGate change to `main`.
- App surface: Expo web
- Build/start command: `EXPO_PUBLIC_E2E_LOCAL_RESET=1 EXPO_PUBLIC_E2E_DISABLE_APP_LOCK=1 EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=empty npm --workspace apps/mobile run web -- --port 8154 --host localhost --clear`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 viewport
- Feature tested: Free-user `/progress`, `/progress/capture`, and `/progress/review` `photo_timeline` ProGate paywalls
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: used through `npm --workspace apps/mobile run web`
- Expo web: used on `http://localhost:8154`
- Codex in-app browser: used for screenshots, one user-like tap, and read-only geometry checks
- Playwright DOM snapshot: unavailable on this Expo page, so evidence uses screenshots plus read-only DOM geometry

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Local reset | Clean free-user state | Pass | `00-local-reset-320x480.png` | `/?e2eReset=local` returned to the welcome screen with zero horizontal overflow. |
| `/progress/capture` | Direct compact photo paywall | Pass | `01-progress-capture-paywall-320x480.png`, `01-progress-capture-paywall-320x480-controls.json` | Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first were present, 48 px or larger, unclipped, and center-hit-testable. |
| `/progress/review` | Direct compact photo paywall | Pass | `02-progress-review-paywall-320x480.png`, `02-progress-review-paywall-320x480-controls.json` | Same geometry result as capture; no JavaScript dialog and no current-run browser warnings/errors. |
| `/progress/review` | Dismiss branch | Pass | `03-review-maybe-later-dismiss-320x480.png`, `03-review-maybe-later-dismiss.json` | A real tap on the unique `Maybe later` button routed to `/progress`. |
| `/progress` | Tabbed compact photo paywall | Pass | `04-progress-paywall-tabbar-320x480.png`, `04-progress-paywall-tabbar-320x480-controls.json` | The same controls remained above the floating tab bar, with zero blocked hit-tests and zero horizontal overflow. |

## Bugs Found

None in this pass.

## Tests Added or Updated

- `apps/mobile/src/features/subscription/paywallMobileContracts.test.ts`
- The contract now asserts the compact progress photo paywall uses the header compliance row and hides the bottom compliance row.

## Commands Run

```bash
EXPO_PUBLIC_E2E_LOCAL_RESET=1 EXPO_PUBLIC_E2E_DISABLE_APP_LOCK=1 EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=empty npm --workspace apps/mobile run web -- --port 8154 --host localhost --clear
```

## Remaining Risk

- Native iOS/Android safe-area behavior for physical devices remains release QA.
- Live RevenueCat purchase sheet behavior is blocked until Tas-owned store credentials/products are configured.
