# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-13 (America/Toronto)
- Codex task: Maximum React Native optimization plan — typed age-verification storage recovery
- App surface: Expo web
- Build/start command: `npm --workspace apps/mobile run start -- --web --port 8261`
- Browser/device: Codex in-app browser with 375 × 667 and 390 × 844 supported-phone viewports, plus 320 × 480 compact stress coverage
- Overall verdict: Pass for the recorded web-compatible UI states; the final non-visual unmount publication guard passed automated/adversarial review, while a fresh second browser backend was unavailable

## Setup

- Persistent read failure: `EXPO_PUBLIC_E2E_AGE_VERIFICATION_READ_FAILURE=always`
- One-shot read failure: `EXPO_PUBLIC_E2E_AGE_VERIFICATION_READ_FAILURE=once`
- One-shot write failure: `EXPO_PUBLIC_E2E_AGE_VERIFICATION_WRITE_FAILURE=once`
- Account/external services: none required; Supabase remained on the repository's blocked placeholder configuration
- Seed: a synthetic adult DOB entered through the real form; the app persisted only its minimized Boolean pass flag
- Destructive actions: none

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Age-state read | Persistent failure | Pass | `persistent-read-failure-375x667.png` | Exactly one accessible alert, no DOB inputs, no Continue action, 55.99 px retry control, route unchanged |
| Age-state read | Persistent retry | Pass | `persistent-read-failure-after-retry-375x667.png` | Retry remained fail-closed and added honest unchanged-state copy |
| Age-state write | One-shot failure | Pass | `write-once-before-submit-375x667.png`, `write-once-failure-375x667.png` | Day/month/year stayed `01`/`01`/`1990`; one alert; no navigation |
| Age-state write | Deliberate retry | Pass | `write-once-retry-success-goals-375x667.png` | Successful retry advanced to `/onboarding/goals` |
| Age-state read | One-shot failure with saved verified flag | Pass | `read-once-before-retry-verified-375x667.png`, `read-once-retry-restores-verified-goals-375x667.png` | Initial recovery contained no DOB inputs; user retry re-read the saved flag and advanced directly to Goals |
| Responsive recovery | 390 × 844 | Pass | `persistent-read-failure-390x844.png` | One alert, no inputs, 55.99 px action, zero horizontal overflow |
| Responsive recovery | 320 × 480 compact stress | Pass | `persistent-read-failure-320x480.png`, `persistent-read-failure-after-retry-320x480.png` | Initial and failed-retry states remained complete, visible, and horizontally contained |

## Observed Geometry And Logs

- The in-app browser rendered the requested 375 × 667 CSS viewport as 376 × 668 and the requested 320 × 480 viewport as 320 × 481. Measurements use the rendered CSS viewport.
- All measured retry/Continue actions were 55.99 px high.
- Document width equaled viewport width in every recorded state.
- Browser error log count: 0.
- JavaScript dialogs: 0.
- Development warnings were limited to existing Supabase placeholder configuration, the Expo Notifications web limitation, and the existing multiple-GoTrueClient development warning.

## Tests Added Or Updated

- `apps/mobile/src/features/onboarding/ageGateStore.test.ts`: typed absent/current/legacy/corrupt/future/unavailable classifications; non-destructive fixtures; explicit-write-only legacy migration; corrupt/future write rejection.
- `apps/mobile/src/features/onboarding/onboardingRoutes.test.ts`: explicit loading/recovery branches, stale-read protection, accessible 56 px retry, and caught/disabled save behavior.
- `apps/mobile/src/features/settings/localPrivateDataRegistry.test.ts`: age-verification typed-read gap removed from the exact registry list.

## Bugs Found

- The post-E2E adversarial review found that a slow successful age-confirmation write could call `router.replace` after the user had left the screen. The final source invalidates a save request generation on unmount and guards navigation plus catch/finally state publication. Focused tests, root typecheck/lint, the full 235-file / 2,673-test suite, and the final adversarial review passed after the fix.
- A requested fresh browser rerun after that non-visual guard could not acquire a second browser backend. Expo started and stopped cleanly with the one-shot fixture, but no browser/tab was available; the browser skill prohibited substituting another automation surface. The previously recorded visible error/retry flow is unchanged by the generation guard.

The preceding code audit found a separate launch concern: the age flag is currently consulted only by `/onboarding/age`, so direct protected-route entry is not an app-wide age boundary. This storage slice does not claim to fix that broader routing contract.

## Remaining Risk

- iOS Simulator/physical-iPhone Keychain interruption, relaunch, VoiceOver, and native Dynamic Type are not available from this Windows environment and remain native device QA.
- Browser local-storage internals were not inspected. Behavioral re-entry proves the minimized flag was readable after recovery; focused unit tests prove the exact `v1:1` codec and byte-preservation rules.
- A central age-verification route boundary is a separate launch-hardening task.
- The save-generation guard still needs a direct slow-write-and-leave native/browser lifecycle exercise when a fresh interactive surface is available; its source-order contract and stale-publication invalidation are covered automatically.

## Evidence Index

Structured measurements and the post-visual verification boundary are in `browser-observations.json`.
