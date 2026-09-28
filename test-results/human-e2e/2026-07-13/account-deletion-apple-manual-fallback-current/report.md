# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-13
- Codex task: DB-10 Apple manual-revocation completion notice
- App surface: Expo web compatibility pass; this is not native-iPhone release evidence
- Build/start command: `EXPO_PUBLIC_E2E_ACCOUNT_DELETION_NOTICE=apple_manual_revocation EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser npm --workspace apps/mobile run web -- --port 8094 --clear`
- Browser/device/simulator/OS: Codex in-app Chromium browser on Windows; 360 x 640 resilience viewport and 390 x 844 supported Expo-web viewport
- Feature tested: account-deletion completion notice when Apple access could not be revoked automatically
- Fixture: development-only notice and external-open failure fixtures; no account, credentials, provider calls, or destructive deletion
- Overall verdict: Pass with launch gaps

## Tool Inventory

- Expo CLI: available; web server compiled and served the app at `http://127.0.0.1:8094/`
- iOS Simulator: not available on this Windows host; not tested
- Android emulator: not used; Android is outside the current launch contract
- Expo web: used
- Browser automation: Codex in-app browser Playwright-compatible controls
- External services: none; Supabase used its documented development placeholder and emitted expected blocker warnings

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Deleted account completion | Apple automatic revocation unavailable | Pass | `01-account-deleted-360x640.png`, `03-account-deleted-390x844.png` | The start state visibly said `ACCOUNT DELETED`, explained that one Apple step remained, and listed the complete iPhone Settings path. |
| Apple Support handoff | Browser cannot open external instructions | Pass | `02-apple-support-open-failure-360x640.png` | Clicking the unique `Open Apple instructions` button stayed on the page, opened no JavaScript dialog, and displayed an inline recovery message directing the user to the visible Settings steps. |
| Responsive layout | 360 x 640 resilience viewport | Pass | `01-account-deleted-360x640.png`, `02-apple-support-open-failure-360x640.png` | `scrollWidth` equaled the 360 px viewport. Visible controls measured approximately 56 px, 56 px, and 48 px high. |
| Responsive layout | 390 x 844 supported Expo-web viewport | Pass | `03-account-deleted-390x844.png` | `scrollWidth` equaled the 390 px viewport. All completion content and actions were visible without horizontal overflow; controls measured approximately 56 px, 56 px, and 48 px high. |
| Relaunch compatibility | Browser reload with development fixture | Pass | DOM snapshot and command transcript in this report | A full reload restored the deterministic completion state at 390 x 844. This does not prove durable production notice recovery. |

## Browser Observations

- Accessible DOM exposed one alert for the completion notice and one uniquely named `Open Apple instructions` button.
- After the forced external-open failure, the DOM exposed the inline text `Apple Support could not open. Use the iPhone Settings steps above.` as an alert.
- The URL remained `http://127.0.0.1:8094/` and no JavaScript dialog opened.
- No browser console errors were observed. Expected development warnings reported missing Supabase credentials and limited Expo notification support on web.

## Bugs Found

No new product bug was reproduced during the final post-fix browser pass. Independent review before that pass found and fixed three bounded notice-handoff risks: render-time consumption could lose a notice if React discarded the render, a loading/null commit could acknowledge it before the card was eligible to render, and placing the interactive Apple button inside the alert live region produced an unnecessarily broad announcement. The final implementation peeks during render, acknowledges only after the completion card is eligible to commit, separates the live region from the button, and was re-run through the same visible flow. One transient browser screenshot was malformed while the measured DOM and an immediate second viewport capture remained correct; the malformed capture was discarded as a capture-backend artifact.

## Tests Added or Updated

- `apps/mobile/src/features/settings/accountDeletionNotice.test.ts`: render-safe peek/ack notice handoff plus development-only, one-shot fixture behavior.
- `apps/mobile/src/features/settings/actions.test.ts`: typed deletion-response attestation, pre-boundary manual Apple outcome queuing, and malformed-response rejection before local sign-out.
- Existing mobile typecheck and focused Vitest suites cover the non-visual contracts; the visible flow was exercised here because unit tests alone do not establish usability.

## Commands Run

```text
EXPO_PUBLIC_E2E_ACCOUNT_DELETION_NOTICE=apple_manual_revocation
EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=browser
npm --workspace apps/mobile run web -- --port 8094 --clear
# Result: PASS; Expo web bundle served and the fixture rendered.

# Browser actions
# 1. Open http://127.0.0.1:8094/ at 360 x 640.
# 2. Confirm completion notice and exact manual Settings path.
# 3. Click the unique Open Apple instructions button.
# 4. Confirm inline recovery, unchanged URL, no dialog, and no horizontal overflow.
# 5. Apply the review fixes, restart with a cleared bundle, and repeat the same flow.
# 6. Reload at 390 x 844 and repeat visual/layout checks.
# Result: PASS after the final source changes.
```

## Remaining Risk

- The production notice is currently in memory. If the app process terminates after server deletion but before the welcome screen consumes it, the completion notice can be lost. A durable deletion-status/notice handoff is still required.
- Native iOS behavior, VoiceOver, Dynamic Type, safe areas, and the real Apple Support handoff were not testable on this Windows host. This Expo-web evidence cannot satisfy the physical-iPhone launch gate.
- The destructive service-backed deletion flow was intentionally not invoked without an approved disposable account and live provider credentials. RevenueCat, PostHog, Apple token revocation, Supabase row scrubbing, and Auth deletion require separate live evidence.
- The development fixture proves deterministic presentation and reload compatibility, not recovery of a real production result after process death.
- This targeted pass does not replace the repository-wide supported-device route sweep at 375 x 667, 390 x 844, and 430 x 932.

## Recommended Follow-Up

- Persist an authenticated deletion operation and post-sign-out completion status so pending provider work and Apple manual instructions survive retries, relaunches, and process death.
- Run the same branch on a physical iPhone/iOS 17+ build with VoiceOver and Dynamic Type, then test a disposable live account through the complete provider-backed deletion path.
