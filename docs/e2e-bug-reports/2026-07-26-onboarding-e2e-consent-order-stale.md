# E2E Bug Report: First-session driver expected the retired consent order

Severity: High
Surface: Expo web
Environment: Headless Chrome/Edge, 390 x 844, Expo SDK 56 development web build
Feature: First-run onboarding and CORE-01 age/profile provenance
Date: 2026-07-26
Tester: Codex

## Reproduction Steps

1. Run `npm run e2e:onboarding-first-session` with a fresh local-state fixture.
2. Enter an eligible DOB and tap `Continue`.
3. Observe the app route and the driver's next expected screen.

## Expected Result

The driver follows the current privacy order: age -> health-data consent ->
goals -> quiz.

## Actual Result

The app correctly opened health-data consent, while the driver waited for the
goals heading and timed out after 30 seconds. The stale driver still encoded
the retired age -> goals -> consent order.

## Evidence

- Screenshots:
  `test-results/human-e2e/2026-07-26/core01-age-profile-provenance-current/01-welcome.png`,
  `02-age-empty.png`, and `03-age-filled.png`
- Logs:
  `test-results/human-e2e/2026-07-26/core01-age-profile-provenance-current/expo-web.log`
- Terminal transcript: `Timed out waiting for text "What brings you here?": condition false`

## Frequency

- Always

## Scope

- Affected route/screen: first-session E2E after `/onboarding/age`
- Affected account or fixture: dev-only fresh local-state reset
- External service involved: none
- Destructive action involved: dev-only local fixture reset

## Suspected Cause

The source flow was changed to collect dedicated health-data consent before
health-purpose goal and quiz inputs, but the reusable browser driver retained
the earlier route order.

## Minimal Fix Recommendation

Update only the driver's route sequence and evidence labels. Add a direct
protected-route check before onboarding so the same run also proves the new
root age-policy gate hides private content.

## Verification Flow After Fix

1. Reset local state at 390 x 844.
2. Open `/today` directly and verify recovery to the age screen without Today content.
3. Complete age -> consent -> goals -> quiz -> reveal -> activation.
4. Reload direct Today AM and PM states and complete their check-offs.

## Post-Fix Evidence

- The maintained driver now follows age -> consent -> goals -> quiz and first
  proves direct `/today` entry fails closed to `/onboarding/age` without
  mounting Today content.
- The 2026-07-26 supported 390 x 844 rerun passed the complete first-session
  path through all 12 quiz questions, three-product intake, reveal,
  notifications, account skip, paywall, `Explore first`, routine plan,
  `Start today`, and AM/PM check-offs. Evidence is in
  `test-results/human-e2e/2026-07-26/core01-age-profile-provenance-current/`;
  `summary.json` records `verdict: pass` and zero horizontal overflow on every
  summarized screen.
- The driver now waits for the actual post-age route rather than a fixed delay
  and captures `03a-after-age-submit.*` plus `18a-after-explore-first.*` so
  future lifecycle or entitlement failures retain the visible recovery state.

## Remaining Risk

- Physical-iPhone lifecycle and Apple Declared Age Range sandbox cases remain
  native release evidence.
