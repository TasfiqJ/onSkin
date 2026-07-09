# Human E2E Manifest

Generated: 2026-07-09T00:02:12.971Z
Git SHA: 71cb9a64eee8b2a9997462da7c4169afeca1dcd1
Evidence date: 2026-07-08
Status: pass

This generated packet is created by `npm run e2e:human:manifest`. It turns
the committed Expo web-compatible human-simulated E2E evidence into a
repeatable local gate without adding a Playwright, Detox, Maestro, or Appium
dependency to the repo.

## Gates

| Gate                                   | Status | Detail                 | Files | Folder                                                                               |
| -------------------------------------- | ------ | ---------------------- | ----- | ------------------------------------------------------------------------------------ |
| 320 x 480 direct-route rerun           | pass   | 0 failures recorded.   | 151   | test-results/human-e2e/2026-07-08/current-main-short-phone-480-rerun                 |
| 320 x 430 final route clearance        | pass   | 0 failures recorded.   | 101   | test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep |
| 320 x 390 split-short stress clearance | pass   | 0 failures recorded.   | 51    | test-results/human-e2e/2026-07-08/current-main-split-short-phone-390-sweep-postfix   |
| 320 x 430 first-session activation     | pass   | summary verdict: pass. | 15    | test-results/human-e2e/2026-07-08/onboarding-first-session-430-current               |

## Warnings

- This manifest verifies committed local Expo web evidence only; it does not replace physical iOS/Android device QA.
- Native keyboard events, Dynamic Type, VoiceOver/TalkBack, camera hardware, notification delivery, StoreKit/Play Billing, RevenueCat, and live Supabase remain separate release gates.

## Blockers

- None.
