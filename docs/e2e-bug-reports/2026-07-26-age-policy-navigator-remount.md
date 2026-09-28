# E2E Bug Report: Age receipt activation replayed Welcome

Severity: High
Surface: Expo web
Environment: Headless Chrome/Edge, 390 x 844, Expo SDK 56 development web build
Feature: CORE-01 age-policy provider boundary
Date: 2026-07-26
Tester: Codex

## Reproduction Steps

1. Reset local private state and open Welcome.
2. Tap `Begin`, enter an eligible DOB, and tap `Continue`.
3. Observe the route after the minimized age-policy receipt becomes current.

## Expected Result

The protected navigator mounts and opens `/onboarding/consent`. The app never
collects goals or quiz answers before dedicated health-data consent.

## Actual Result

The route returned to `/` and displayed Welcome. The age receipt was current,
but the user had to tap `Begin` again to continue.

## Evidence

- Pre-fix screenshots and UI snapshots:
  `test-results/human-e2e/2026-07-26/core01-age-profile-provenance-current/01a-direct-protected-age-gate.*`,
  `02-age-empty.*`, `03-age-filled.*`
- Terminal transcript:
  `Age submission did not reach consent. Current screen: http://localhost:8294/`

## Frequency

- Always

## Scope

- Affected route/screen: `/onboarding/age` -> `/onboarding/consent`
- Affected account or fixture: fresh local device state
- External service involved: none
- Destructive action involved: dev-only local fixture reset

## Suspected Cause

The root age gate intentionally replaces the receipt-bootstrap navigator with
the protected provider tree. Publishing the current receipt unmounted the age
screen and its navigator before that disappearing screen's route replacement
could be applied, so Expo web initialized the new navigator at `/`.

## Minimal Fix Recommendation

Stage one fixed post-age consent intent before publishing the current receipt.
Have the root age gate consume it exactly once after the protected navigator
mounts. Do not persist an arbitrary destination or any DOB/age value.

## Verification Flow After Fix

1. Reset at 390 x 844 and prove a direct `/today` entry recovers to age without
   mounting Today content.
2. Enter an eligible DOB and verify the immediate post-submit snapshot is
   `/onboarding/consent`.
3. Continue through consent, goals, quiz, reveal, and first routine activation.

## Post-Fix Evidence

- `/onboarding/consent` is captured in
  `test-results/human-e2e/2026-07-26/core01-age-profile-provenance-current/03a-after-age-submit.*`
  and `04-consent.*`.
- The same supported 390 x 844 run completes all 12 quiz questions, adds three
  products, reaches reveal and paywall, activates `Explore first`, opens the
  generated routine, completes AM and PM check-offs, then proves a fresh
  below-threshold re-verification closes protected providers and remains closed
  across direct Today navigation and reload. Its `summary.json` records
  `verdict: pass`.
- The final integration fix stages one fixed consent intent, accepts the
  durable receipt publication only on the safe bootstrap route, waits for the
  exact development owner to be committed, and carries that already-claimed
  synthetic session across the Expo Router provider remount in process memory.
  The handoff is unavailable in configured, staging, production, or release
  runtimes and is cleared when session state becomes null.
- Focused age/auth lifecycle and contract suites pass, including stale
  foreground completion, unavailable storage, direct protected-route fencing,
  and exact fixture-boundary cases.

## Remaining Risk

- Native iPhone navigation, background/foreground, relaunch, VoiceOver,
  Dynamic Type, signed entitlement inspection, and Apple Declared Age Range
  sandbox behavior remain mandatory release evidence.
