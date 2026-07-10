# Human E2E Manifest

Generated: 2026-07-10T10:26:19.257Z
Git SHA: bcda7bba39c1e7b2c9224c04ad6abb05cadcc712
Evidence date: 2026-07-10
Baseline suite date: 2026-07-09
Status: pass

This generated packet is created by `npm run e2e:human:manifest`. It turns
the committed Expo web-compatible human-simulated E2E evidence into a
repeatable local gate without adding a Playwright, Detox, Maestro, or Appium
dependency to the repo.

## Gates

| Gate                                                             | Class           | Status | Detail                                 | Files | Folder                                                                                 |
| ---------------------------------------------------------------- | --------------- | ------ | -------------------------------------- | ----- | -------------------------------------------------------------------------------------- |
| 360 x 640 launch-floor 200% text-pressure route sweep            | launch-blocking | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-postfix          |
| 360 x 740 supported Android-class 200% text-pressure route sweep | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-postfix            |
| 375 x 667 compact iPhone-class 200% text-pressure route sweep    | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-667-full-postfix3-clear |
| 375 x 812 supported iPhone-class 200% text-pressure route sweep  | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix             |
| 390 x 844 supported-phone 200% text-pressure route sweep         | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-7               |
| 412 x 640 supported Android-class 200% text-pressure route sweep | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-android-412-640-current            |
| 412 x 915 supported Android-class 200% text-pressure route sweep | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-android-412-915-postfix2           |
| 414 x 896 boundary-phone 200% text-pressure route sweep          | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-postfix3          |
| 430 x 640 supported Android-class 200% text-pressure route sweep | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-android-430-640-postfix3           |
| 430 x 932 supported-phone 200% text-pressure route sweep         | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-modern-430-postfix-5               |
| 360 x 640 skipped/direct-entry 200% text-pressure route sweep    | supported-phone | pass   | summary status: pass; 0 failed routes. | 45    | test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-360-640-current     |
| 375 x 667 skipped/direct-entry 200% text-pressure route sweep    | supported-phone | pass   | summary status: pass; 0 failed routes. | 45    | test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-375-667-postfix3    |
| 390 x 844 skipped/direct-entry 200% text-pressure route sweep    | supported-phone | pass   | summary status: pass; 0 failed routes. | 45    | test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-390-844-postfix     |
| 412 x 640 skipped/direct-entry 200% text-pressure route sweep    | supported-phone | pass   | summary status: pass; 0 failed routes. | 45    | test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-412-640-postfix     |
| 430 x 640 skipped/direct-entry 200% text-pressure route sweep    | supported-phone | pass   | summary status: pass; 0 failed routes. | 45    | test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-640-current     |
| 430 x 932 skipped/direct-entry 200% text-pressure route sweep    | supported-phone | pass   | summary status: pass; 0 failed routes. | 45    | test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-932-postfix     |
| 390 x 844 supported-phone 170% text-pressure route sweep         | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-170-modern-390-postfix-6               |
| 430 x 932 supported-phone 170% text-pressure route sweep         | supported-phone | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-170-modern-430-postfix-3               |
| 320 x 480 stress 200% text-pressure route sweep                  | resilience      | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-200-support-floor-480-postfix-12       |
| 320 x 480 stress 170% text-pressure route sweep                  | resilience      | pass   | summary status: pass; 0 failed routes. | 101   | test-results/human-e2e/2026-07-09/text-pressure-170-support-floor-480-postfix-16       |
| 320 x 480 stress route rerun                                     | resilience      | pass   | 0 failures recorded.                   | 101   | test-results/human-e2e/2026-07-09/current-main-short-phone-480-rerun                   |
| 320 x 430 resilience route clearance                             | resilience      | pass   | 0 failures recorded.                   | 101   | test-results/human-e2e/2026-07-09/current-main-short-phone-430-final-clearance-sweep   |
| 320 x 390 split-short stress clearance                           | resilience      | pass   | 0 failures recorded.                   | 101   | test-results/human-e2e/2026-07-09/current-main-split-short-phone-390-sweep-postfix     |
| 320 x 430 first-session activation stress pass                   | resilience      | pass   | summary verdict: pass.                 | 58    | test-results/human-e2e/2026-07-09/onboarding-first-session-430-current                 |
| 390 x 844 local Progress time-lapse and reduced-motion pass      | supported-phone | pass   | summary status: pass.                  | 17    | test-results/human-e2e/2026-07-10/progress-timelapse-current                           |
| Progress quality states and support-floor save recovery          | supported-phone | pass   | summary status: pass.                  | 19    | test-results/human-e2e/2026-07-10/progress-capture-analysis-current                    |
| Device-only Progress photo storage                               | supported-phone | pass   | summary status: pass; 0 failed routes. | 15    | test-results/human-e2e/2026-07-10/progress-device-only-backup-current                  |
| Progress direct-route app-lock coverage                          | supported-phone | pass   | summary status: pass; 0 failed routes. | 39    | test-results/human-e2e/2026-07-10/progress-direct-route-lock-current                   |
| Progress encrypted-storage recovery                              | supported-phone | pass   | summary status: pass; 0 failed routes. | 39    | test-results/human-e2e/2026-07-10/progress-storage-recovery-current                    |
| Account export local-photo scope disclosure                      | supported-phone | pass   | summary status: pass; 0 failed routes. | 14    | test-results/human-e2e/2026-07-10/data-export-local-photo-disclosure-current           |
| Combined account and current-device export                       | supported-phone | pass   | summary status: pass; 0 failed routes. | 13    | test-results/human-e2e/2026-07-10/data-export-combined-device-current                  |

## Warnings

- This manifest verifies committed local Expo web evidence only; it does not replace physical iOS/Android device QA.
- Supported-phone 200% text-pressure gates listed in this manifest are launch-required local Expo web evidence; 320 x 568, 320 x 480, 320 x 430, 320 x 390, 320 x 370, and 320 x 360 remain resilience stress evidence unless tied to a supported physical device.
- Native keyboard events, Dynamic Type, VoiceOver/TalkBack, camera hardware, notification delivery, StoreKit/Play Billing, RevenueCat, and live Supabase remain separate release gates.

## Blockers

- None.
