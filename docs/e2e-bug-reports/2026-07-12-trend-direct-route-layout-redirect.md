# E2E Bug Report: Trend opt-in direct route rendered the fairness route

Severity: High
Surface: Expo web
Environment: Local Expo web at `http://localhost:8081`, Codex in-app browser, requested 375 x 667 phone viewport
Feature: Photo Trend deferred direct routes
Date: 2026-07-12
Tester: Codex

## Reproduction Steps

1. Open `/trend/optin` directly while the Trend engine capability is unavailable.
2. Inspect the final URL and rendered deferred surface.

## Expected Result

The URL remains `/trend/optin`, no Trend consent control mounts, and the route presents the explicit unavailable surface with a recovery action to Progress.

## Actual Result

Before the fix, the layout-level unavailable surface replaced the nested route and changed the final URL to `/trend/fairness`. This collapsed two auditable direct-entry routes into one route even though the visible refusal copy was safe.

## Evidence

- Screenshot: Pre-fix screenshot was overwritten during the required same-path post-fix rerun; post-fix screenshots are `test-results/human-e2e/2026-07-12/required-surface-honesty-rerun/trend-optin-route.png` and `trend-fairness-route.png`.
- Video: Not captured.
- Trace: Not captured.
- Logs: `test-results/human-e2e/2026-07-12/required-surface-honesty-rerun/browser-warn-error-logs.json`.
- UI snapshot: Interactive pre-fix browser observation recorded requested `/trend/optin` resolving to `/trend/fairness`; the persisted post-fix route and geometry snapshot is `test-results/human-e2e/2026-07-12/required-surface-honesty-rerun/route-evidence.json`.
- Terminal transcript: Focused route-contract test output is part of the checkpoint verification transcript.

## Frequency

- Always before the fix.

## Scope

- Affected route/screen: `/trend/optin`; `/trend/fairness` remained reachable.
- Affected account or fixture: Direct-entry local fixture; no account or consent state required.
- External service involved: None.
- Destructive action involved: No.

## Suspected Cause

`apps/mobile/src/app/trend/_layout.tsx` rendered `DeferredSurface` for the entire nested navigator. The shared fallback's recovery destination was `/trend/fairness`, so Expo Router canonicalized every unavailable child entry to the fairness route.

## Minimal Fix Recommendation

Keep the Trend layout as a stable `Stack` and apply the same hard capability gate inside each direct child route. This preserves route identity without enabling the missing engine or consent flow.

## Verification Flow After Fix

1. Open `/trend/optin` and confirm the final URL remains `/trend/optin`.
2. Confirm no input, switch, or consent action mounts and the visible recovery control is at least 44 points high.
3. Open `/trend/fairness` and repeat the same assertions.
4. Activate `Back to Progress` and confirm the final URL is `/progress`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-12/required-surface-honesty-rerun/trend-optin-route.png` and `trend-fairness-route.png`.
- Video: Not captured.
- Trace: Not captured.
- Logs: `test-results/human-e2e/2026-07-12/required-surface-honesty-rerun/browser-warn-error-logs.json`; the six warnings are the declared missing local Supabase configuration and Expo web notification limitation, with no new route error.
- UI snapshot: `test-results/human-e2e/2026-07-12/required-surface-honesty-rerun/route-evidence.json` records both exact URLs, zero inputs/switches, 55.99 px recovery controls, no horizontal overflow, and `/progress` recovery.
- Terminal transcript: `apps/mobile/src/features/trend/trendRoutes.test.ts` covers the child-route gates and stable layout contract.

## Remaining Risk

- Untested branches: Native iPhone navigation, VoiceOver, and large Dynamic Type remain part of device QA.
- Missing fixtures: No live Trend engine exists yet; this test proves only the truthful unavailable state.
- Follow-up needed: Re-run these direct entries on the supported iPhone matrix before release and replace the unavailable state only after the validated engine, consent, legal, safety, and evidence gates pass.
