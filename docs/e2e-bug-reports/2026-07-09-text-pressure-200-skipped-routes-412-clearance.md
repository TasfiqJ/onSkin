# E2E Bug Report: 412px skipped onboarding/paywall routes clipped under 200% text pressure

Severity: High
Surface: Expo web mobile viewport harness
Environment: 412 x 640 viewport, 200% text pressure
Feature: Onboarding and lifecycle paywall direct-entry routes
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the text-pressure route audit at 412 x 640 with scale 2.
2. Limit routes to the skipped/direct-entry onboarding, paywall, recovery, conflict, share, shelf, and progress routes.
3. Inspect visible controls for clipping, blocked hit centers, text overflow, and horizontal overflow.

## Expected Result

All visible controls and price/compliance labels stay readable, at least 44 px tall where actionable, and center-hit-testable above fixed footers or viewport chrome.

## Actual Result

The first run failed 5 of 21 routes:

- `/onboarding/age`: DOB fields were blocked by the fixed Continue footer.
- `/onboarding/goals`: the final goal card was partially blocked by Continue.
- `/onboarding/products`: `Oil / balm` and `Add to shelf` were blocked by the fixed footer.
- `/onboarding/paywall`: `Explore first` clipped at the bottom edge.
- `/paywall/downgrade`: Terms, Privacy, and Restore centers were blocked by store-unavailable copy.

After extending the compact support-floor guard, `/onboarding/paywall` still had one follow-up overflow: the annual card `$4.16/mo` label was squeezed into a 48 px column.

## Evidence

- Initial failed route audit: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-412-640-current/`
- Focused follow-up with remaining overflow: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-412-640-focused-postfix/`
- Focused passing rerun: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-412-640-focused-postfix2/`
- Full 21-route passing rerun: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-412-640-postfix/`
- 430 x 640 focused regression: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-640-focused-regression/`

## Frequency

- Always at 412 x 640 / 200% text pressure before the fix.

## Scope

- Affected route/screen: `/onboarding/age`, `/onboarding/goals`, `/onboarding/products`, `/onboarding/paywall`, `/paywall/downgrade`
- Affected account or fixture: local E2E fixtures
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The affected screens only entered their compact support-floor layout at widths up to 390 px. Supported 412 px and 430 px wide phones with short 640 px viewport height and high text scale kept the roomier layout, leaving lower controls under fixed footers or squeezing paywall price text.

## Minimal Fix Recommendation

Extend the direct-entry onboarding and downgrade support-floor text-pressure guards through 430 px width, then reserve a real compact width for the onboarding paywall monthly-equivalent label while allowing the annual price column to shrink.

## Verification Flow After Fix

1. Re-run the five affected routes at 412 x 640 / 200% text pressure.
2. Re-run all 21 skipped/direct-entry routes at 412 x 640 / 200% text pressure.
3. Re-run the five affected routes at 430 x 640 / 200% text pressure.

## Post-Fix Evidence

- Focused 412 x 640 pass: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-412-640-focused-postfix2/`
- Full skipped-route 412 x 640 pass: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-412-640-postfix/`
- Focused 430 x 640 pass: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-430-640-focused-regression/`
- Focused contract tests: `npm --workspace apps/mobile run test -- src/features/onboarding/onboardingRoutes.test.ts src/features/subscription/paywallMobileContracts.test.ts`

## Remaining Risk

- Untested branches: native iOS and Android Dynamic Type rendering, safe-area variation, hardware keyboard overlays, screen-reader traversal, and live store sheet behavior.
- Missing fixtures: real RevenueCat store pricing and native device screenshots.
- Follow-up needed: keep Phase 5/6 native device QA as final platform proof.
