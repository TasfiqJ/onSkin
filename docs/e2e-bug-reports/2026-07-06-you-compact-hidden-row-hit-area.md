# E2E Bug Report: You compact hidden routine row hit area

Severity: Medium
Surface: Expo web phone viewport
Environment: `npm --workspace apps/mobile run web -- --port 8094`, Browser viewport 320 x 568
Feature: You tab / bottom tab-bar clearance
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Open `http://localhost:8094/you` at 320 x 568.
2. Inspect visible controls near the floating bottom tab bar.
3. Measure topmost `role="button"` controls that intersect the tab-bar zone.

## Expected Result

The first compact viewport ends on complete, visible rows above the floating tab bar. Lower routine rows require deliberate scroll before their hit areas become reachable.

## Actual Result

The `Streak & adherence` routine row started behind the floating tab bar while part of its hit area remained topmost at the bottom edge of the viewport.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/compact-phone-route-sweep-post-fix/you-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/compact-phone-route-sweep-post-fix/you-320x568-audit.json`
- Terminal transcript: Browser route sweep summary reported 58/59 pass before final spacing fix.

## Frequency

- Always at 320 x 568 before the fix.

## Scope

- Affected route/screen: `/you`
- Affected account or fixture: Completed local onboarding / returning user state
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The compact You tab reduced card spacing enough to keep `Retinoid ramp` visible, but the following routine row still began inside the overlaid floating-tab-bar zone.

## Minimal Fix Recommendation

Split compact routine links into a primary first-viewport section and a lower secondary section with enough separation that secondary rows begin below the initial viewport.

## Verification Flow After Fix

1. Reopen `/you` at 320 x 568.
2. Confirm `Your plan`, `Edit the order`, and `Retinoid ramp` are complete above the tab bar.
3. Confirm `Streak & adherence`, `Weekly check-in`, and `Recent changes` begin below the first viewport and require scroll.
4. Re-run the direct route geometry sweep.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/you-compact-hidden-row-hit-area-final/you-final-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-06/you-compact-hidden-row-hit-area-final/you-final-320x568-audit.json`
- Route sweep: `test-results/human-e2e/2026-07-06/compact-phone-route-sweep-final-pass/summary.json`

## Remaining Risk

- Untested branches: Native iOS/Android rendering of the same route.
- Missing fixtures: Standard app-state reset fixture for returning-user route sweeps.
- Follow-up needed: Promote this direct-route geometry pass into durable E2E when the repo chooses a harness.
