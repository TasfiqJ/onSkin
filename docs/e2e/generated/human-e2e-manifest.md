# Human E2E Manifest

Generated: 2026-07-09T07:59:44.936Z
Git SHA: 0382cb2136b6c7115939daaefc26b4756af5a94d
Evidence date: 2026-07-08
Status: pass

This generated packet is created by `npm run e2e:human:manifest`. It turns
the committed Expo web-compatible human-simulated E2E evidence into a
repeatable local gate without adding a Playwright, Detox, Maestro, or Appium
dependency to the repo.

## Gates

| Gate                                           | Class           | Status | Detail                 | Files | Folder                                                                               |
| ---------------------------------------------- | --------------- | ------ | ---------------------- | ----- | ------------------------------------------------------------------------------------ |
| 320 x 480 supported-floor route rerun          | launch-blocking | pass   | 0 failures recorded.   | 151   | test-results/human-e2e/2026-07-08/current-main-short-phone-480-rerun                 |
| 320 x 430 resilience route clearance           | resilience      | pass   | 0 failures recorded.   | 101   | test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep |
| 320 x 390 split-short stress clearance         | resilience      | pass   | 0 failures recorded.   | 51    | test-results/human-e2e/2026-07-08/current-main-split-short-phone-390-sweep-postfix   |
| 320 x 430 first-session activation stress pass | resilience      | pass   | summary verdict: pass. | 15    | test-results/human-e2e/2026-07-08/onboarding-first-session-430-current               |

## Warnings

- This manifest verifies committed local Expo web evidence only; it does not replace physical iOS/Android device QA.
- Only launch-blocking gates are required by the device support policy; 320 x 430, 320 x 390, 320 x 370, and 320 x 360 are resilience stress evidence unless tied to a supported physical device.
- Native keyboard events, Dynamic Type, VoiceOver/TalkBack, camera hardware, notification delivery, StoreKit/Play Billing, RevenueCat, and live Supabase remain separate release gates.

## Blockers

- None.
