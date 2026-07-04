# Phase 10 TestFlight Packet

Status: BLOCKED until App Store Connect evidence is attached.

## Platform Facts Used

- TestFlight supports internal and external testing.
- External beta testing may require beta app review.
- Builds expire for beta testing after 90 days.
- TestFlight in-app purchases use sandbox behavior and do not create production paid-conversion evidence.

## Required App Store Connect Setup

| Item | Evidence |
| --- | --- |
| App record exists | BLOCKED |
| Bundle ID matches production identity | BLOCKED |
| Build uploaded | BLOCKED |
| Build number | BLOCKED |
| Internal group created | BLOCKED |
| External group created | BLOCKED |
| Beta review status | BLOCKED |
| Beta app description | BLOCKED |
| Feedback email/support URL | BLOCKED |
| Privacy policy URL | BLOCKED |
| Terms URL | BLOCKED |
| Test information includes no-medical-advice language | BLOCKED |
| RevenueCat/TestFlight sandbox behavior documented | BLOCKED |

## Internal Testing Checklist

- Install fresh on iPhone.
- Upgrade from prior beta build if available.
- Sign in and complete onboarding.
- Add products through all available intake modes.
- Trigger first value.
- Complete routine check-off.
- Attempt photo/progress flow.
- Try notification/reminder permission flow.
- Open paywall, manage subscription, and restore.
- Find deletion/export controls.
- Submit TestFlight feedback with screenshot.
- Verify feedback is visible by build/device in App Store Connect.

## External Testing Checklist

- External group invite copy uses the tester brief.
- Beta review has no unresolved health, privacy, or subscription issue.
- Groups are segmented by Wave 1/Wave 2 where possible.
- Every issue report records build, platform, OS, device, and tester ID.
- Crash feedback is reviewed before adding the next wave.
- Build expiry date is tracked before inviting long-running cohorts.

## iOS Beta Exit Evidence

Attach before Phase 10 exit:

- App Store Connect build screenshot
- group/tester count screenshot
- beta review result
- crash/feedback export summary
- iOS support-ticket summary
- payment/restore QA summary
- privacy/deletion/export QA summary

