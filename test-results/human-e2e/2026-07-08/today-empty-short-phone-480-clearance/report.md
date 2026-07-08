# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-08
- Codex task: Fix `/today` empty-routine short-phone clearance near the floating tab bar.
- App surface: Expo web
- Build/start command: `EXPO_PUBLIC_E2E_ENTITLEMENT=pro npm --workspace apps/mobile run web -- --port 8201 --host localhost`
- Browser/device/simulator/OS: Codex in-app browser, 320 x 480 viewport
- Feature tested: Today empty routine state
- Overall verdict: Pass with native-device follow-up

## Flows Covered

1. Opened `/today` at 320 x 480 after the compact empty-state spacing fix.
2. Verified the `Add products` CTA remains fully visible and hit-testable.
3. Verified the CTA has 37 px clearance above the floating tab bar.
4. Verified zero horizontal overflow.

## Evidence

- Screenshot: `today-post-fix.png`
- Geometry snapshot: `today-post-fix-geometry.json`
- Pre-fix route-audit screenshot: `../short-phone-480-route-audit-6/today.png`
- Bug report: `../../../../docs/e2e-bug-reports/2026-07-08-today-empty-state-short-phone-clearance.md`

## Branches Not Covered

- Native iOS/Android home-indicator safe-area rendering.
- Dynamic Type / larger system text.
- Screen-reader traversal.

## Recommendation

Accept the Expo web compact-layout fix. Keep native iOS/Android simulator or device QA as the launch gate for hardware safe-area and accessibility behavior.
