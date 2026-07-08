# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Fix `/progress` empty first-photo short-phone clearance near the floating tab bar.
- App surface: Expo web
- Build/start command: `EXPO_PUBLIC_E2E_ENTITLEMENT=pro npm --workspace apps/mobile run web -- --port 8203 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 viewport
- Feature tested: Photo Progress empty first-run state
- Overall verdict: Pass with native-device follow-up

## Flows Covered

1. Opened `/progress` at 320 x 480 before the fix and reproduced the first-photo CTA visually sitting under the floating tab bar.
2. Applied the compact Progress first-run spacing fix.
3. Reloaded `/progress` at 320 x 480 and verified the `Take my first photo` CTA is fully visible and hit-testable.
4. Verified the CTA has 33.6 px clearance above the floating tab bar and zero horizontal overflow.
5. Tapped `Take my first photo` and confirmed navigation to `/progress/capture` with local-only photo consent copy visible.

## Evidence

- Before screenshot: `progress-empty-320x480-before-fix.png`
- Before geometry snapshot: `progress-empty-320x480-before-buttons.json`
- After screenshot: `progress-empty-320x480-after-fix.png`
- After geometry snapshot: `progress-empty-320x480-after-fix.json`
- Tap result screenshot: `progress-empty-cta-click-result.png`
- Tap result snapshot: `progress-empty-cta-click-result.json`
- Bug report: `../../../../docs/e2e-bug-reports/2026-07-08-progress-empty-short-phone-clearance.md`

## Branches Not Covered

- Native iOS/Android home-indicator safe-area rendering.
- Dynamic Type / larger system text.
- Screen-reader traversal.

## Recommendation

Accept the Expo web compact-layout fix. Keep native iOS/Android simulator or device QA as the launch gate for hardware safe-area, system text scale, and accessibility behavior.
