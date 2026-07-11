# E2E Bug Report: Cadence Helper Runtime Module Cycle

Severity: High
Surface: Expo web
Environment: Port 8154, Pro entitlement, cadence review gate open
Feature: Custom cycle settings
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Open `/cycle/settings` after the shared weekly helper is imported through `customCycle.ts`.
2. Let the route orchestrate the existing eligible Glycolic active.

## Expected Result

Cycle settings renders the generated recommendation and Custom editor.

## Actual Result

The route crashed with `TypeError: minimumCycleLengthForOccurrences is not a function` from `orchestrate.ts`.

## Evidence

- Logs: `runtime-cadence-module-cycle.txt`
- Frequency: Always in the affected bundle
- Affected route: `/cycle/settings`
- External service involved: No
- Destructive action involved: No

## Suspected Cause

`orchestrate.ts` imported a runtime helper from `customCycle.ts`, while that module depended on orchestration types. Vitest's module transform passed, but Metro/HMR exposed the runtime cycle.

## Minimal Fix Recommendation

Move cadence arithmetic to an independent leaf module imported by both generated and Custom scheduling paths.

## Verification Flow After Fix

1. Reload `/cycle/settings` at 390 x 844 and 360 x 640.
2. Enter Custom and exercise length, assignment, frequency, preview, Save failure, and retry.
3. Run scheduler tests, typecheck, and lint.

## Post-Fix Evidence

- Screenshots: `custom-14-night-preview-390x844.png`, `custom-settings-top-360x640.png`
- Result: Route and complete editor flow pass without a runtime error.

## Remaining Risk

- Native bundler/release-build smoke remains release-device QA.
