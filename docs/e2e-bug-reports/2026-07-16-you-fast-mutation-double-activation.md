# E2E Bug Report: Fast You mutation escaped double-activation guard

Severity: Medium
Surface: Expo web
Environment: Development build at `http://localhost:8237`, requested 390 x 844 viewport
Feature: You privacy and settings mutation ownership
Date: 2026-07-16
Tester: Codex in-app browser

## Reproduction Steps

1. Direct-open `/you?section=privacy` and wait for the consent controls to settle.
2. Double-click `Share data with partners for where-to-buy`.
3. Read the content-free action counter and both shared switch states.

## Expected Result

The gesture is accepted once, both shared switches settle to the same enabled choice, and only the consent coordinator plus Commerce/Privacy consumers rerender.

## Actual Result

Before the fix, `consentStarts` increased by 2 and both switches returned to off. The fast local save released its ref guard between the gesture's two browser click events.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-16/you-mutation-isolation-current/390x844-final.png`
- Logs: `test-results/human-e2e/2026-07-16/you-mutation-isolation-current/browser-logs.json`
- UI snapshot: in-app browser DOM snapshot retained in the task transcript
- Terminal transcript: focused test and typecheck output retained in the task transcript

## Frequency

- Always with the original fast local web fixture

## Scope

- Affected route/screen: You / Privacy direct entry
- Affected account or fixture: local development account
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The synchronous ref was claimed before the first await, but cleared immediately when the fast action settled. A browser double-click dispatches two click events with microtask and React work between them, allowing the second event to enter after the ref cleared.

## Minimal Fix Recommendation

Keep fast mutation latches claimed through the next animation frame after settlement. Apply the same fence to consent, app lock, policy links, and fast export settlement so pending state is painted before another gesture can enter.

## Verification Flow After Fix

1. Repeat the exact double-click.
2. Verify `consentStarts` increases by exactly 1.
3. Verify both shared switches settle on and protected owners retain zero render deltas.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-16/you-mutation-isolation-current/390x844-final.png`
- Logs: `test-results/human-e2e/2026-07-16/you-mutation-isolation-current/browser-logs.json`
- UI snapshot: both shared switches checked; no alert
- Terminal transcript: 9 focused files / 118 tests passed; mobile typecheck passed

## Remaining Risk

- Untested branches: native touch timing and accessibility activation
- Missing fixtures: physical iOS device and production Hermes trace
- Follow-up needed: retain a native rapid-tap test in release QA
