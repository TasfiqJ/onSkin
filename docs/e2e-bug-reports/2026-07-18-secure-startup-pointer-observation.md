# E2E Bug Report: Desktop pointer did not record the route-interaction milestone

Severity: Low
Surface: Expo web
Environment: Development Expo web, Codex in-app browser, 390 x 844 viewport
Feature: Development-only local diagnostics / secure-startup instrumentation
Date: 2026-07-18
Tester: Codex

## Reproduction Steps

1. Direct-open `/settings/diagnostics` in the actual Expo web app.
2. Click `Refresh diagnostics` with the browser pointer.
3. Inspect `STARTUP MILESTONES`.

## Expected Result

The first admitted pointer or touch is recorded once as the fixed
`first_route_interaction_observed` milestone, without recording its target or
content.

## Actual Result

The milestone remained absent because the shared route `Screen` observed only
React Native touch input; a desktop pointer click did not emit that callback.

## Evidence

- UI snapshot: initial diagnostics DOM snapshot contained the secure gate/content milestones and reconciliation but no route-interaction milestone after pointer activation.
- Logs: zero browser error entries.

## Frequency

- Always for the exercised desktop-pointer path.

## Scope

- Affected route/screen: Every shared `Screen` surface on Expo web.
- Affected account or fixture: Placeholder local development state.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

The shared screen root registered `onTouchStart` but not the cross-input
`onPointerDown` event.

## Minimal Fix Recommendation

Route pointer and touch callbacks through the same idempotent fixed-phase
handler. Do not attach event data and do not change route or privacy gates.

## Verification Flow After Fix

1. Let Expo web reload the changed shared screen.
2. Click `Refresh diagnostics` once.
3. Confirm `first route interaction observed` appears, refresh remains usable, and no browser error is logged.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-18/secure-startup-diagnostics-current/secure-startup-diagnostics-390x844.png`
- UI snapshot: the startup card contains `first route interaction observed: 64723 ms` and `startup reconciliation complete: 257.6 ms`.
- Logs: zero browser error entries.
- Tests: the fixed audit rejects dynamic marker content and requires both pointer and touch ownership through one literal marker call.

## Remaining Risk

- Untested branches: Native iOS touch, keyboard/switch input, App Lock, vault failure, offline, and low-resource launch distributions.
- Missing fixtures: Signed supported-iOS cold/warm/resume runs across empty/median/stress datasets.
- Follow-up needed: Collect native distributions without changing the current authorization gates.
