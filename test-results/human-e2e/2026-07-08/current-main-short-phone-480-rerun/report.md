# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Re-run the current `main` shortest-phone route sweep after the recent ProGate, Progress, Shelf, Today, Recommendations, Community, Ask, and cycle fixes.
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run web -- --port 8211 --host localhost`
- Browser/device/simulator/OS: Headless Chrome through Playwright, 320 x 480 viewport, Windows host
- Feature or PR tested: Current shortest-phone app-shell and direct-entry route fit
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: Used through `npm --workspace apps/mobile run web`
- iOS Simulator: Not used
- Android emulator: Not used
- Expo web: Used
- Playwright: Used from bundled Codex runtime with local Chrome
- Playwright MCP: Not used
- Codex Computer Use: Not used
- Other: Prior focused Vitest route-contract tests cover the fixed routes

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| App shell and launch surfaces | 49 direct-entry routes at 320 x 480 | Pass | `summary.json`, `failures.json`, route screenshots/JSON/log files | Zero failed routes, zero visible clipped controls, zero sub-44 user-facing controls, zero blocked hit-tests, zero horizontal overflow, zero disallowed browser logs. |

## Route Scope

`/today`, `/today?routine=PM`, `/progress`, `/progress/capture`, `/progress/review`, `/routine/plan`, `/routine/ramp`, `/routine/tolerance`, `/routine/reorder`, `/routine/adaptation`, `/cycle/settings`, `/cycle/disruption`, `/cycle/procedure`, `/cycle/phased-intro`, `/cycle/recovery`, `/cycle/why-tonight`, `/recommendations`, `/recommendations/preferences`, `/recommendations/stale-local-rec`, `/community`, `/community/note/missing-note-e2e`, `/community/ask`, `/community/people-like-you`, `/commerce/consent`, `/commerce/stacks`, `/commerce/stack/barrier-basics`, `/commerce/stack/missing-stack-e2e`, `/commerce/transparency`, `/settings/subscription`, `/settings/notifications`, `/settings/timing`, `/settings/privacy`, `/trend/optin`, `/trend/fairness`, `/ask`, `/ask/consent`, `/shelf`, `/shelf/search`, `/shelf/no-match`, `/shelf/scan`, `/shelf/ocr`, `/shelf/manual`, `/shelf/archive`, `/shelf/opened`, `/paywall/upsell?feature=full_routine`, `/paywall/success`, `/routine/streak`, `/routine/widgets`, and `/cycle/week`.

## Bugs Found

None in this current-source rerun. The rerun specifically verified that the older current-main sweep failures for Progress, shared ProGate routes, cycle sheets, Recommendations, and Community no longer reproduce on `main`.

## Tests Added or Updated

- Test file: None in this evidence-only slice.
- What it covers: Existing route-contract tests already cover the source-level short-phone branches added in previous slices.
- Why this should be automated: This broad sweep should become a durable compact-phone Playwright or native E2E suite once the repo standardizes an E2E harness.

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8211 --host localhost
node test-results/human-e2e/2026-07-08/current-main-short-phone-480-rerun/audit.cjs
```

## Remaining Risk

- Native iOS/Android safe-area, Dynamic Type, VoiceOver/TalkBack, StoreKit/Play, RevenueCat, camera, notification, and live Supabase behavior remain outside Expo web evidence and stay in `docs/FOR_TAS_TO_DO.md`.
- The audit is an exploratory Playwright script committed as evidence, not a configured CI E2E harness.
