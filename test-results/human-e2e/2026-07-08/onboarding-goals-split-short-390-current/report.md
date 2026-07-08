# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Verify split-short compact onboarding goals layout before committing main changes.
- App surface: Expo web in Codex in-app browser
- Build/start command: npm --workspace apps/mobile run web -- --port 8154 --host localhost
- Browser/device/simulator/OS: Codex in-app browser, 320 x 390 viewport
- Feature or PR tested: /onboarding/goals split-short compact two-column goal cards
- Overall verdict: Pass

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| First-Run Onboarding | Goal selection on split-short phone | Pass | goals-320x390.png, geometry.json | All six goal cards are visible, 60 px tall, center-hit-testable, and the Continue button is visible at 56 px with zero horizontal overflow. |
| First-Run Onboarding | Goal selection action path | Pass | Browser interaction transcript | Tapped Clear skin and Barrier repair; both reflected aria-pressed=true, then Continue advanced to /onboarding/consent. |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| None | - | - | - | - | - |

## Tests Added or Updated

- Test file: apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
- What it covers: route contract expects the split-short goals breakpoint, compact goal card density, one-line labels at sub-420 px heights, and preserved compact-phone route structure.
- Why this should be automated: the original issue is a compact-height regression risk around fixed onboarding footer clearance.

## Commands Run

```bash
npm --workspace apps/mobile run web -- --port 8154 --host localhost
# Browser: opened http://localhost:8154/onboarding/goals at 320 x 390
# Browser: clicked Clear skin, Barrier repair, Continue; landed on /onboarding/consent
```

## Remaining Risk

- Native iOS/Android safe-area, Dynamic Type, and screen-reader traversal remain part of device QA.
