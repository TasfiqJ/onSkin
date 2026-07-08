# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Fix shortest-phone contextual ProGate paywall compliance reachability.
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 8204 --host localhost`
- Browser/device/simulator/OS: Installed Chrome through bundled Playwright, 320 x 480 viewport
- Feature tested: Shared contextual ProGate paywalls plus direct contextual upsell regression route
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: used through `npm --workspace apps/mobile run web`
- iOS Simulator: not used
- Android emulator: not used
- Expo web: used
- Playwright: bundled runtime package with installed Chrome executable
- Playwright MCP: not available as a repo dependency
- Codex in-app browser: attempted; connector timed out on viewport/tab control, so fallback Chrome verification was used for this pass
- Other: focused Vitest source-contract test

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Bottom Tab Navigation | Content clearance beneath floating tab bar | Pass | `progress.png`, `progress.json` | `/progress` contextual paywall legal controls no longer sit under the tab bar. |
| Photo Progress | Contextual photo-timeline paywall on short phones | Pass | `progress.png`, `progress.json` | Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first passed target geometry. |
| Pro Feature Gating | Full routine intelligence routes | Pass | `routine-*.png`, `routine-*.json` | `/routine/plan`, `/routine/ramp`, `/routine/tolerance`, `/routine/reorder`, `/routine/adaptation`. |
| Pro Feature Gating | Nested scheduler routes | Pass | `cycle-*.png`, `cycle-*.json` | `/cycle/settings`, `/cycle/disruption`, `/cycle/procedure`, `/cycle/phased-intro`, `/cycle/recovery`, `/cycle/why-tonight`, `/cycle/week`. |
| Pro Feature Gating | Reminders/widgets routes | Pass | `routine-streak.*`, `routine-widgets.*` | Both contextual paywalls passed. |
| Pro Feature Gating | Direct-entry paywall stability | Pass | `paywall-upsell-feature-full-routine.*` | Existing contextual upsell still passed after shared ProGate changes. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| --- | -------- | ------------ | -------- | ------ | -------- |
| `2026-07-08-progate-short-phone-compliance-clipping` | High | Open affected ProGate routes at 320 x 480 as a free user | Legal controls remain visible and hit-testable | Pre-fix sweep showed bottom compliance clipped or hit-blocked by tab bar | `docs/e2e-bug-reports/2026-07-08-progate-short-phone-compliance-clipping.md` |

## Tests Added Or Updated

- Test file: `apps/mobile/src/features/subscription/paywallMobileContracts.test.ts`
- What it covers: `ProGate` now has a `shortPaywall` breakpoint, compact header compliance, no duplicate bottom compliance on shortest phones, and 48 px legal controls in both default and compact densities.
- Why this should be automated: Apple subscription compliance controls must remain reachable on the smallest supported phones.

## Commands Run

```bash
npx prettier --write apps/mobile/src/features/subscription/ComplianceRow.tsx apps/mobile/src/features/subscription/ProGate.tsx apps/mobile/src/features/subscription/paywallMobileContracts.test.ts
npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts
$env:NODE_PATH='C:\Users\jasim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules;C:\Users\jasim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules'; & 'C:\Users\jasim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' test-results\human-e2e\2026-07-08\progate-short-phone-480-compliance\audit.cjs
```

## Remaining Risk

- Untested flows: Native iOS/Android safe-area, Dynamic Type, and screen-reader traversal.
- Missing fixtures: Live RevenueCat purchase sheet, restore, expiry, and store-unavailable states on device.
- Flaky areas: Expo web startup logs are expected with placeholder Supabase environment.
- Manual follow-up needed: Promote these routes into the selected durable mobile E2E harness after that harness is chosen.
