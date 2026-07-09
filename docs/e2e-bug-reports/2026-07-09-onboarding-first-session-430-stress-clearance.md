# E2E Bug Report: 320x430 first-session onboarding controls overlapped fixed footers

Severity: Medium
Surface: Expo web
Environment: Headless Chrome Expo web at 320 x 430, dev-only local reset fixture
Feature: First-run onboarding
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run `EXPO_PUBLIC_E2E_LOCAL_RESET=1 npm --workspace apps/mobile run web -- --port 8296 --host localhost`.
2. Open `http://localhost:8296/?e2eReset=local` at 320 x 430.
3. Complete age, goal selection, health-data consent, and enter the quiz.
4. Continue to product intake and add `Retinol 0.3% serum`, then `Glycolic 7% toner`.

## Expected Result

Visible quiz answers, product inputs, product rows, remove controls, and footer actions remain complete, 44 px or larger, and center-hit-testable. Lower-priority or overflowing controls should be fully below the first viewport until a deliberate scroll.

## Actual Result

The first quiz screen painted the lower answer under the fixed `Next` footer. Product intake also exposed the product-name field or product remove controls in blocked/clipped positions after adding one or two products.

## Evidence

- Post-fix run report: `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/report.md`
- Post-fix summary: `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/summary.json`
- Post-fix screenshots: `07-quiz-01.png`, `09-products-empty.png`, `10-products-after-1.png`, `11-products-after-2.png`, `12-products-after-3.png`, `14-reveal-insight.png`, and `17-paywall-current.png`

## Frequency

Always in the 320 x 430 stress viewport before the fix.

## Scope

- Affected route/screen: `/onboarding/quiz`, `/onboarding/products`, `/onboarding/analyzing`
- Affected account or fixture: dev-only `?e2eReset=local` first-session fixture
- External service involved: none
- Destructive action involved: local private-state reset only

## Suspected Cause

The quiz did not have a split-short layout for sub-460 px heights, so the standard one-column answer stack painted into the fixed footer zone. Product intake kept full explanatory copy and standard post-add scrolling at the same height, which left input/product controls partially visible behind fixed footer actions. The analyzing screen also requested the native animation driver on web, creating noisy fallback warnings during the E2E run.

## Minimal Fix Recommendation

Add a split-short quiz answer layout, tighten split-short product intake copy and scroll padding, keep post-add confirmation controls away from fixed footers, and select the JS animation driver on web.

## Verification Flow After Fix

1. Run `npm --workspace apps/mobile run test -- onboardingRoutes`.
2. Run `ONBOARDING_E2E_PORT=8296 ONBOARDING_E2E_DEBUG_PORT=9396 npm run e2e:onboarding-first-session`.
3. Confirm the flow reaches `/onboarding/paywall` with zero control issues, zero horizontal overflow, expected first-insight copy, and only expected local placeholder warnings.

## Post-Fix Evidence

- `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/summary.json`
- `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/browser-warn-error-logs.json`
- `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/report.md`

## Remaining Risk

- Native iOS/Android first-session onboarding still needs simulator or physical-device QA for OS permission prompts, safe areas, and platform text settings.
- 320 x 430 is resilience evidence below the accepted launch web floor, not the V1 launch support floor.
