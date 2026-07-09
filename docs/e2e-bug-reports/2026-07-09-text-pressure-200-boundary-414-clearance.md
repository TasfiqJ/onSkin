# E2E Bug Report: 414px text-pressure paywall and preference clearance

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, Expo web, 414 x 896 viewport, 200% text pressure
Feature: Contextual ProGate paywalls and Recommendation Preferences
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the 49-route text-pressure audit at 414 x 896 with `TEXT_PRESSURE_SCALE=2`.
2. Inspect `/progress`, `/cycle/disruption`, `/cycle/procedure`, and `/recommendations/preferences`.
3. Re-run with the harness waiting for gated entitlement loading to clear before geometry capture.

## Expected Result

All visible controls should be complete, 44 px or larger, center-hit-testable, and free of horizontal/text overflow. The audit should measure loaded gated content instead of the subscription-loading fallback.

## Actual Result

The first sweep clipped the contextual ProGate `Start free trial` CTA at the bottom edge on `/progress`, `/cycle/disruption`, and `/cycle/procedure`. After hardening the harness to wait for loaded entitlement content, the follow-up full route sweep exposed `/recommendations/preferences` budget chips peeking as partial controls.

## Evidence

- Initial failure: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-current/failures.json`
- Hardened follow-up failure: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-postfix2/failures.json`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

- Always for the contextual ProGate CTA on the initial 414 x 896 / 200% sweep.
- Reproducible for Recommendation Preferences once the harness measured loaded gated content.

## Scope

- Affected route/screen: `/progress`, `/cycle/disruption`, `/cycle/procedure`, `/recommendations/preferences`.
- Affected account or fixture: local Expo web E2E fixture.
- External service involved: none.
- Destructive action involved: none.

## Suspected Cause

The 414 x 896 boundary sits below the tall-phone ProGate density band but still behaves like a large-text supported phone. Long contextual body copy and full price blocks pushed primary CTAs to the bottom edge. The text-pressure harness also captured the first gated route before entitlement loading resolved, allowing false-positive passes. Recommendation Preferences reused support-floor compact layout under device-scale emulation and let the lower Budget group begin inside the first viewport.

## Minimal Fix Recommendation

Add a 414-class text-pressure density tier for contextual ProGate paywalls, move compliance controls into the header, suppress nonessential body/icon copy, and keep price plus CTA complete. Harden the text-pressure harness to wait for `Checking your access` to clear before measuring. Defer lower-priority Recommendation Preferences budget controls below the first viewport in support-floor/boundary text-pressure states.

## Verification Flow After Fix

1. Re-run `/progress` at 414 x 896 / 200% text pressure with the hardened harness.
2. Re-run `/recommendations/preferences` at 414 x 896 / 200% text pressure.
3. Re-run the full 49-route 414 x 896 / 200% text-pressure sweep.

## Post-Fix Evidence

- Loaded Progress paywall: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-progress-loaded-postfix2/`
- Focused Recommendation Preferences: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-recprefs-postfix3/`
- Full 49-route pass: `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-postfix3/`

## Remaining Risk

- Native iOS/Android Dynamic Type, screen-reader, keyboard, safe-area, camera, notification, and store-sheet QA remain device gates.
