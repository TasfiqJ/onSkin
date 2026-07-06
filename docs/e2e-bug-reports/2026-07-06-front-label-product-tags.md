# E2E Bug Report: Front-label product names route glycolic toner into morning

Severity: High
Surface: Expo web
Environment: Local Expo web at 320 x 568 phone viewport
Feature: First-session shelf-to-routine core loop
Date: July 6, 2026
Tester: Codex

## Reproduction Steps

1. Start Expo web and open `/onboarding/products`.
2. Add `Retinol 0.3% Night Serum`, `Glycolic 7% Toner`, and `Mineral SPF 50`.
3. Use the app's `Explore first. 7 days of Pro` no-card unlock path and inspect `/routine/plan`.

## Expected Result

Front-label shorthand should be enough for the offline pre-catalog routine engine to classify common products: SPF belongs in Morning, glycolic belongs in the PM exfoliant slot, and retinol belongs in the PM treatment slot.

## Actual Result

Before the fix, `Glycolic 7% Toner` appeared in the Morning routine as a generic toner, while the Evening card showed only retinol and recovery.

## Evidence

- Screenshot: N/A before fix
- Video: N/A
- Trace: N/A
- Logs: Browser state read before fix
- UI snapshot: `test-results/human-e2e/2026-07-06/front-label-product-tags/pre-fix-state.json`
- Terminal transcript: `npm --workspace apps/mobile run web -- --port 8084`

## Frequency

- Always for manually/onboarding-entered product names that use common front-label shorthand not present as formal INCI text.

## Scope

- Affected route/screen: `/onboarding/products`, `/routine/plan`, `/today`
- Affected account or fixture: Local-first shelf products without catalog ingredient data
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The starter tag dictionary matched formal strings such as `glycolic acid` and `zinc oxide`, but onboarding/manual entry only supplied product names. Common label shorthands such as `Glycolic 7% Toner`, `Mineral SPF 50`, and `Vitamin C Serum` did not produce functional tags before catalog seed.

## Minimal Fix Recommendation

Add conservative front-label aliases for common actives and SPF in the offline tag layer, then guard the shelf-like routine-generation path with tests.

## Verification Flow After Fix

1. Re-open `/routine/plan` with the same local shelf.
2. Confirm Morning contains `Mineral SPF 50` and does not contain Glycolic.
3. Confirm Evening contains `Glycolic 7%` and `Retinol 0.3% Night Serum`, with no SPF.
4. Tap `Start today`, confirm Today PM shows the Glycolic check-off, then tap it and confirm the counter reaches `1 of 1`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/front-label-product-tags/routine-plan-fixed-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/front-label-product-tags/today-pm-fixed-320.png`
- Screenshot: `test-results/human-e2e/2026-07-06/front-label-product-tags/today-pm-checkoff-320.png`
- Logs: `test-results/human-e2e/2026-07-06/front-label-product-tags/browser-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/front-label-product-tags/routine-plan-fixed-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/front-label-product-tags/today-pm-fixed-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/front-label-product-tags/today-pm-checkoff-state.json`
- Terminal transcript: `npm --workspace apps/mobile run web -- --port 8084`

## Remaining Risk

- Untested branches: native iOS/Android device behavior and full age-gate-to-quiz onboarding replay.
- Missing fixtures: final catalog seed and reviewed source-approved product records.
- Follow-up needed: promote this shelf-to-routine fixture into a durable Expo-web E2E once the repo standardizes an E2E harness.
