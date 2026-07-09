# Human E2E Manifest

Generated: 2026-07-09T15:03:46.215Z
Git SHA: 33b03890133271c5ab2cc3dade532ad87e0b7bd7
Evidence date: 2026-07-09
Status: pass

This generated packet is created by `npm run e2e:human:manifest`. It turns
the committed Expo web-compatible human-simulated E2E evidence into a
repeatable local gate without adding a Playwright, Detox, Maestro, or Appium
dependency to the repo.

## Gates

| Gate                                                             | Class           | Status  | Detail                                                  | Files | Folder                                                                               |
| ---------------------------------------------------------------- | --------------- | ------- | ------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------ |
| 320 x 480 supported-floor 200% text-pressure route sweep         | launch-blocking | pass    | summary status: pass; 0 failed routes.                  | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-support-floor-480-postfix-12     |
| 375 x 812 supported iPhone-class 200% text-pressure route sweep  | supported-phone | pass    | summary status: pass; 0 failed routes.                  | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix           |
| 390 x 844 supported-phone 200% text-pressure route sweep         | supported-phone | pass    | summary status: pass; 0 failed routes.                  | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-7             |
| 412 x 915 supported Android-class 200% text-pressure route sweep | supported-phone | pass    | summary status: pass; 0 failed routes.                  | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-android-412-915-postfix2         |
| 430 x 932 supported-phone 200% text-pressure route sweep         | supported-phone | pass    | summary status: pass; 0 failed routes.                  | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-modern-430-postfix-5             |
| 390 x 844 supported-phone 170% text-pressure route sweep         | supported-phone | pass    | summary status: pass; 0 failed routes.                  | 101   | test-results/human-e2e/2026-07-09/text-pressure-170-modern-390-postfix-6             |
| 430 x 932 supported-phone 170% text-pressure route sweep         | supported-phone | pass    | summary status: pass; 0 failed routes.                  | 101   | test-results/human-e2e/2026-07-09/text-pressure-170-modern-430-postfix-3             |
| 320 x 430 resilience route clearance                             | resilience      | skipped | Optional resilience evidence not present for this date. | 0     | test-results/human-e2e/2026-07-09/current-main-short-phone-430-final-clearance-sweep |
| 320 x 390 split-short stress clearance                           | resilience      | skipped | Optional resilience evidence not present for this date. | 0     | test-results/human-e2e/2026-07-09/current-main-split-short-phone-390-sweep-postfix   |
| 320 x 430 first-session activation stress pass                   | resilience      | skipped | Optional resilience evidence not present for this date. | 0     | test-results/human-e2e/2026-07-09/onboarding-first-session-430-current               |

## Warnings

- This manifest verifies committed local Expo web evidence only; it does not replace physical iOS/Android device QA.
- Only launch-blocking gates are required by the device support policy; 320 x 430, 320 x 390, 320 x 370, and 320 x 360 are resilience stress evidence unless tied to a supported physical device.
- Native keyboard events, Dynamic Type, VoiceOver/TalkBack, camera hardware, notification delivery, StoreKit/Play Billing, RevenueCat, and live Supabase remain separate release gates.

## Blockers

- None.
