# Progress ProGate 320 x 430 Clearance Report

Date: 2026-07-08
Surface: Expo web
Viewport: 320 x 430
Environment: Codex in-app browser on localhost

## Scope

Verified the free-user `/progress` contextual photo paywall after adding the ProGate sub-460 px density band. The target bug was `Explore first. 7 days of Pro` being visible but center-hit blocked by the floating tab bar.

## Commands

- `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts`
- `git diff --check`

## Evidence

- Pre-fix failure source: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postfix-sweep/progress.png`
- Post-fix screenshot: `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/progress-final.png`
- Post-fix geometry: `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/progress-final.json`
- Targeted summary: `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/summary-final.json`
- Follow-up sweep: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postprogress-sweep/failures.json`

## Result

Targeted `/progress` verification passed with zero clipped controls, zero tiny targets, zero blocked hit-tests, and zero horizontal overflow. The 49-route follow-up sweep no longer reports `/progress`; remaining 320 x 430 failures are outside this slice: `/recommendations`, `/recommendations/preferences`, `/community`, and `/settings/subscription`.

## Remaining Risk

Native iOS and Android device safe-area, Dynamic Type, screen-reader traversal, and live store purchase/restore behavior still need release-device QA.
