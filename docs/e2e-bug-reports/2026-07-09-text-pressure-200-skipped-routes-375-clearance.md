# E2E Bug Report: 375x667 200% skipped-route controls blocked or clipped

Severity: High
Surface: Expo web
Environment: Headless Chrome, Expo web, 375 x 667 viewport, 200% text pressure
Feature: Direct-entry onboarding, lifecycle paywall, shelf, conflict, and recovery routes
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the skipped-route text-pressure sweep at 375 x 667 with `TEXT_PRESSURE_SCALE=2`.
2. Include direct routes for onboarding, lifecycle paywalls, progress, shelf, conflict, and share fallbacks.
3. Inspect visible controls for clipping, sub-44 px visible targets, blocked hit centers, horizontal overflow, and unexpected browser logs.

## Expected Result

Every visible control is at least 44 px in visible height, hit-testable at its center, and clear of fixed footers or viewport edges.

## Actual Result

The initial run failed five routes: `/onboarding/age`, `/onboarding/goals`, `/onboarding/products`, `/onboarding/paywall`, and `/paywall/downgrade`. Post-fix reruns also exposed the same support-floor problem on `/shelf/missing-shelf-e2e` and the local-auth-unavailable `/onboarding/account` fallback before the final pass.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-375-667-current/failures.json`
- UI snapshots: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-375-667-postfix3/`
- Terminal transcript: `npm run e2e:text-pressure`

## Frequency

Always with the listed viewport, route set, and text-pressure scale before the fix.

## Scope

- Affected routes/screens: `/onboarding/age`, `/onboarding/account`, `/onboarding/goals`, `/onboarding/products`, `/onboarding/paywall`, `/paywall/downgrade`, `/shelf/missing-shelf-e2e`
- Affected account or fixture: local Expo web with store/auth unavailable preview fixtures
- External service involved: none
- Destructive action involved: none

## Suspected Cause

Several compact layouts only activated below 640 px height. A 375 x 667 phone under 200% text pressure needs the same dense support-floor treatment even though its raw viewport height is above 640 px. The account route also rendered disabled auth controls in the unavailable-backend fixture, creating a dead clipped input instead of a clean recovery state.

## Minimal Fix Recommendation

Promote the affected onboarding, paywall, and shelf fallback routes into compact mode for the 375 x 667 support-floor band under large text. Keep the account route scrollable above its fixed skip action and hide unavailable auth controls when Supabase is not configured.

## Verification Flow After Fix

1. Re-run the same 21-route skipped-route sweep at 375 x 667 and 200% text pressure.
2. Confirm zero failed routes, zero clipped visible controls, zero sub-44 visible targets, zero blocked center hit-tests, zero horizontal overflow, and zero disallowed browser logs.
3. Run focused route-contract tests for onboarding, paywall, and shelf routes.

## Post-Fix Evidence

- UI snapshots: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-375-667-postfix3/`
- Summary: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-375-667-postfix3/summary.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/onboarding/onboardingRoutes.test.ts src/features/subscription/paywallMobileContracts.test.ts src/features/shelf/shelfRoutes.test.ts`

## Remaining Risk

- Untested branches: native iOS/Android Dynamic Type, hardware safe-area, keyboard, and screen-reader traversal
- Missing fixtures: live Supabase sign-in and native RevenueCat purchase sheets
- Follow-up needed: device QA on physical iOS and Android phones
