# E2E Bug Report: Progress unlock glyph rendered as a square

Severity: Low
Surface: Expo web
Environment: Local development build at 360 x 640 and 390 x 844
Feature: Progress gallery app lock
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Start Expo web with populated Progress photos and app lock enabled.
2. Authenticate the global cold-start lock but cancel the gallery prompt.
3. Inspect the locked Progress `Unlock` action.

## Expected Result

The unlock action has a clean label and an accessible name of `Unlock`.

## Actual Result

A decorative `⊡` text glyph rendered as a malformed square before `Unlock` and became part of the web control's computed accessible name.

## Evidence

- Screenshot: observed during the first visual review; the evidence set was regenerated after the fix.
- UI snapshot: the pre-fix role node exposed `⊡Unlock`.

## Frequency

- Always in the tested Expo web fixture.

## Scope

- Affected route/screen: `/progress`, populated gallery-lock state.
- Affected account or fixture: Pro entitlement, populated local photos, app lock enabled.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The button used a manually inserted text glyph whose appearance depended on font fallback.

## Minimal Fix Recommendation

Remove the nonessential glyph and set the Pressable's explicit accessibility label from `PHOTO_COPY.lock.unlock`.

## Verification Flow After Fix

1. Reload locked Progress at 360 x 640 and 390 x 844.
2. Confirm the button renders only `Unlock`, remains 56 px tall, and has the exact accessible label.
3. Re-run geometry, hit-test, overflow, dialog, log, and network assertions.

## Post-Fix Evidence

- Screenshots: `test-results/human-e2e/2026-07-10/progress-device-only-backup-current/progress-locked-modern-390x844.png` and `progress-locked-supported-floor-360x640.png`.
- UI snapshot: `test-results/human-e2e/2026-07-10/progress-device-only-backup-current/summary.json`.
- Logs and requests: same evidence folder.

## Remaining Risk

- Untested branches: native font rendering and OS authentication prompts.
- Missing fixtures: physical iOS/Android VoiceOver and TalkBack evidence.
- Follow-up needed: complete the Phase 5 device QA packet before release.
