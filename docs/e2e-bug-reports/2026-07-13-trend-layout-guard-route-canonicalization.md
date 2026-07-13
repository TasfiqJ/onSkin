# E2E Bug Report: Trend layout guard reintroduced route canonicalization

Severity: High
Surface: Expo web
Environment: Local Expo web at `http://localhost:8267`, Codex in-app browser, requested 375 x 667 supported phone viewport
Feature: Photo Trend deferred direct routes
Date: 2026-07-13
Tester: Codex

## Reproduction Steps

1. Start Expo web with the Trend capability hard-disabled.
2. Open `/trend/optin` directly.
3. Inspect the rendered refusal and final URL.

## Expected Result

The URL remains `/trend/optin`, no Trend consent or data-backed child mounts,
and the route presents the explicit unavailable surface with a recovery action
to Progress.

## Actual Result

The unavailable copy was truthful and exposed no input or switch, but the
layout-level early return removed the nested `Stack` and Expo Router changed the
final URL to `/trend/fairness`. This recreated the route-identity defect fixed
and documented on 2026-07-12.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-13/trend-route-group-gate-current/pre-fix-optin-canonicalized-to-fairness.png`; the Chrome recapture visibly includes the badge, refusal title/body/detail, and recovery label at an exact 375 x 667 CSS viewport.
- Video: Not captured.
- Trace: Not captured.
- Logs: `test-results/human-e2e/2026-07-13/trend-route-group-gate-current/pre-fix-route-evidence.json`.
- UI snapshot: The same JSON records requested `/trend/optin`, observed `/trend/fairness`, zero inputs/switches, a 55.99 px recovery action, and zero horizontal overflow.

## Frequency

- Always with the early-return layout guard.

## Scope

- Affected route/screen: Direct `/trend/optin`; `/trend/fairness` remained reachable.
- Affected account or fixture: No account or consent state required.
- External service involved: None. Missing local Supabase configuration remained an explicit unrelated warning.
- Destructive action involved: No.

## Suspected Cause

`apps/mobile/src/app/trend/_layout.tsx` returned `DeferredSurface` instead of the
nested `Stack` while Trend was disabled. Expo Router consequently selected the
fairness child as the canonical nested route.

## Minimal Fix Recommendation

Keep the Trend navigator mounted so direct-route identity is stable. Enforce the
hard capability gate before hooks or data access inside every child: opt-in stays
an unconditional deferred surface, and fairness uses a wrapper that returns the
deferred surface before mounting the child that calls `useMonkBand()`.

## Verification Flow After Fix

1. Open `/trend/optin` and confirm the exact URL remains `/trend/optin`.
2. Confirm no input, switch, consent mutation, or Trend data request mounts.
3. Open `/trend/fairness` and repeat the same checks.
4. Put another Trend route in browser history, activate `Back to Progress`, and confirm deterministic `/progress` replacement rather than a history back-navigation.
5. Refresh and directly re-open both routes at 375 x 667.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-13/trend-route-group-gate-current/post-fix-trend-optin.png` and `post-fix-trend-fairness.png`. Both visibly contain the complete refusal surface at 375 x 667 CSS pixels (750 x 1334 retained pixels at 2x scale).
- Video: Not captured.
- Trace: Not captured.
- Logs: `test-results/human-e2e/2026-07-13/trend-route-group-gate-current/post-fix-route-evidence.json` records only the declared missing-local-Supabase and Expo-web notification warnings, with zero unexpected warnings/errors.
- UI snapshot: The same JSON records exact URLs after direct entry and refresh, visible text-pixel bounds, zero inputs/switches, 55.99 px recovery controls, zero horizontal overflow, no dialogs, and successful `/progress` recovery from direct entry and pre-existing Trend history.
- Capture note: The pre/post PNGs are intentionally pixel-identical because the bug affected route identity, not copy or layout; the paired JSON records requested and observed URLs.

## Remaining Risk

- Untested branches: Native iPhone navigation, VoiceOver, and large Dynamic Type remain device QA.
- Missing fixtures: No validated Trend engine exists; this flow proves only the truthful unavailable state.
- Follow-up needed: Re-run on supported physical iPhones before release.
