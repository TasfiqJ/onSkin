# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify nested scheduler route gating and unlocked surfaces on `main`
- App surface: Expo web, Codex in-app browser
- Build/start command: `$env:EXPO_PUBLIC_SUPABASE_URL=''; $env:EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=''; npm --workspace apps/mobile run web -- --port 8155 --clear`
- Browser/device/simulator/OS: Codex in-app browser at 320 x 568
- Feature tested: Pro Feature Gating, nested `/cycle/*` scheduler routes
- Overall verdict: Pass with known preview-only service warnings

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web -- --port 8155 --clear`
- iOS Simulator: Not used
- Android emulator: Not used
- Expo web: Used
- Playwright: Used through the Codex in-app browser API
- Playwright MCP: Not used
- Codex Computer Use: Not used
- Other: Focused Vitest route-contract tests

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Fresh free direct `/cycle/settings`, `/cycle/disruption`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/phased-intro`, `/cycle/procedure` | Direct-link lock | Pass | `free-route-results.json`, `free-cycle-*.png` | All six routes rendered `Unlock your full skin-cycling scheduler.`, exposed no route-body content, had zero horizontal overflow, and had no sub-44 px visible controls. |
| Scheduler paywall to local no-card reverse trial | Pro entitlement state | Pass | `reverse-route-results.json`, `reverse-cycle-procedure-final.png` | `Explore first. 7 days of Pro` unlocked the current route without RevenueCat or Supabase credentials. |
| Manual shelf fixture | Local test state | Pass | Browser transcript plus `reverse-route-results.json` | Added `Retinol 0.2% Night Serum` and `Glycolic Acid 7% Toner` through `/shelf/manual` and `/shelf/opened`; Shelf showed the alternate-nights conflict banner. |
| Phased introduction override | Scheduler staging branch | Pass | `phased-intro-override-results.json`, `settings-after-glycolic-override.json`, `reverse-cycle-settings-after-glycolic-override.png` | The visible `Add it now anyway` action brought staged glycolic into the current cycle. |
| Reverse-trial direct nested scheduler routes | Unlocked route group | Pass | `reverse-route-results.json`, `reverse-cycle-*-final.png` | Settings showed scheduled glycolic and retinol rows, Why Tonight showed APART trace copy, disruption/procedure/phased-intro rendered intended sheets/screens, and recovery rendered the empty fallback. |
| Procedure to active recovery | Recovery branch | Pass | `reverse-cycle-recovery-active-final.png`, `reverse-route-results.json` | `Start recovery` redirected to active `/cycle/recovery`; retinol and glycolic were paused; `Ease back in` returned to `/today`. |
| Browser warnings/errors | Logging branch | Pass | `browser-warn-error-logs-strict-8155.json` | Strict current-port browser warn/error log count was zero. Terminal showed expected Supabase placeholder and Expo web notifications warnings only. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| None | - | - | - | - | - |

## Tests Added Or Updated

- Test file: none
- Existing focused tests run: `src/features/subscription/gatedRoutes.test.ts`, `src/features/subscription/proGatedRoutes.test.ts`, `src/features/scheduler/cycleWeekRoute.test.ts`
- What they cover: route mapping, Pro-gated cycle/routine contracts, direct-entry exits, short-phone scheduler sheet contracts, and cycle route copy contracts.
- Why this should be automated: the contracts already enforce the route layout and key route affordances; this slice added human E2E screenshots rather than new app code.

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8155 --clear
npm --workspace apps/mobile run test -- src/features/subscription/gatedRoutes.test.ts src/features/subscription/proGatedRoutes.test.ts src/features/scheduler/cycleWeekRoute.test.ts
```

## Remaining Risk

- Untested flows: Native iOS/Android bottom-sheet behavior, native safe areas, screen-reader output, Dynamic Type, and native storage persistence.
- Missing fixtures: Live RevenueCat, Supabase entitlement mirror, and reviewer-signed production cadence gate remain unavailable.
- Flaky areas: Expo web route navigation occasionally completed visually after the browser navigation wait timed out; route text and screenshots were captured after visual completion.
- Manual follow-up needed: Native simulator/device QA for scheduler sheets and RevenueCat restore/purchase paths.
