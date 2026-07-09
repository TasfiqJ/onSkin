# E2E Bug Report: Settings notifications support-floor nudge clipping

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web on `http://localhost:8255`, 320 x 480 launch support-floor viewport
Feature: `/settings/notifications`
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 8255`.
2. Open `/settings/notifications`.
3. Set the browser viewport to 320 x 480.
4. Inspect the first viewport around the lower notification nudge rows.

## Expected Result

Visible notification controls remain complete, readable, 44 px or taller, and center-hit-testable. Lower-priority rows may move below the first viewport, but must not appear as clipped bottom-edge targets.

## Actual Result

The initial support-floor spacer left the `Progress-photo nudge` switch partially visible at the bottom edge. Its 48 px switch rect started around y=438 and extended to roughly y=486 in a 320 x 481 observed viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/settings-notifications-support-floor-current/01-support-floor-320x480.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/settings-notifications-support-floor-current/01-support-floor-320x480.json`
- Logs: `test-results/human-e2e/2026-07-09/settings-notifications-support-floor-current/summary.json`
- Terminal/browser transcript: current Codex run

## Frequency

- Always before the fix at the 320 x 480 support floor.

## Scope

- Affected route/screen: `/settings/notifications`
- Affected account or fixture: local Expo web default fixture
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The non-micro split-short spacer for the lower nudge group was still tuned too low after the launch floor was narrowed to supported native phone envelopes. At 320 x 480, the first lower-priority switch began inside the bottom edge instead of starting fully below the viewport.

## Minimal Fix Recommendation

Increase the non-micro split-short spacer for the lower notification nudge group so `Progress-photo nudge` begins below the 320 x 480 first viewport while keeping 320 x 568 and modern-phone layouts complete.

## Verification Flow After Fix

1. Open `/settings/notifications` at 320 x 480.
2. Verify visible controls have zero clipping, zero sub-44 targets, zero blocked center hit-tests, and zero horizontal overflow.
3. Repeat at 320 x 568 and 390 x 844.
4. Tap a visible notification switch and verify `aria-checked` changes.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/settings-notifications-support-floor-current/01-support-floor-320x480.png`
- Screenshot: `test-results/human-e2e/2026-07-09/settings-notifications-support-floor-current/02-compact-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-09/settings-notifications-support-floor-current/03-modern-390x844.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/settings-notifications-support-floor-current/summary.json`
- Report: `test-results/human-e2e/2026-07-09/settings-notifications-support-floor-current/report.md`

## Remaining Risk

- Untested branches: native iOS/Android safe-area, Dynamic Type, VoiceOver/TalkBack, and notification scheduling.
- Missing fixtures: physical supported iOS 17+ and Android 10+ devices.
- Follow-up needed: keep native notification QA under Phase 5 device evidence.
