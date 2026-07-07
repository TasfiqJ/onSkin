# E2E Bug Report: Onboarding age gate mojibake punctuation

Severity: Medium
Surface: Expo web
Environment: Expo web dev server, in-app browser, 320 x 568 viewport, Windows host
Feature: First-run onboarding age gate
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web.
2. Open `/onboarding/age` on a compact phone viewport.
3. Inspect the first-run privacy sentence under the heading.

## Expected Result

The sentence reads `We don't store your birth date.` with clean punctuation and no clipped text.

## Actual Result

The sentence rendered as `We donâ€™t store your birth date.`, exposing mojibake punctuation on the first onboarding screen.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-age-gate-live-audit/01-initial.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-age-gate-live-audit/01-initial.json`

## Frequency

- Always

## Scope

- Affected route/screen: `/onboarding/age`
- Affected account or fixture: first-run local state
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The visible copy used a curly apostrophe that was bundled/rendered as mojibake in the Expo web surface.

## Minimal Fix Recommendation

Use ASCII punctuation for this user-facing sentence and add a route-contract regression that rejects the known mojibake sequence.

## Verification Flow After Fix

1. Open `/onboarding/age` on a fresh local origin at 320 x 568.
2. Confirm the visible sentence says `We don't store your birth date.`
3. Enter an impossible DOB and confirm the invalid-date recovery copy still appears.
4. Enter an underage valid DOB, tap Continue, and confirm the underage block copy still appears.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-age-gate-live-audit/01-postfix-initial.png`
- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-age-gate-live-audit/02-postfix-impossible-date.png`
- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-age-gate-live-audit/03-postfix-underage-after-submit.png`
- Screenshot: `test-results/human-e2e/2026-07-07/onboarding-age-copy/age-gate-copy-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-age-gate-copy-fix/postfix-summary.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/onboarding-age-copy/age-gate-copy-state.json`

## Remaining Risk

- Untested branches: native iOS and Android keyboard-safe rendering for the same age-gate layout.
- Missing fixtures: no standard local reset command for first-run onboarding state.
- Follow-up needed: broader user-facing copy sweep for mojibake across non-onboarding surfaces.
