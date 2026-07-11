# E2E Bug Report: Onboarding freshness handoff crashes outside IntakeProvider

Severity: Critical
Surface: Expo web
Environment: RoutineKind local Expo web, 390 x 844, `EXPO_PUBLIC_E2E_LOCAL_RESET=1`
Feature: Onboarding product to Shelf freshness handoff
Date: 2026-07-11
Tester: Codex

## Reproduction Steps

1. Reset local app state.
2. Open `/onboarding/products`.

## Expected Result

The onboarding product intake renders and can carry a draft into `/shelf/opened`.

## Actual Result

The route rendered blank and logged `useIntake must be used within IntakeProvider`.

## Evidence

- Expo terminal transcript captured during the run.
- Browser DOM snapshot was empty at the failed route.

## Frequency

- Always

## Scope

- Affected route/screen: `/onboarding/products`
- Affected account or fixture: reset local device state
- External service involved: none
- Destructive action involved: local E2E reset only

## Suspected Cause

`IntakeProvider` was mounted inside `shelf/_layout.tsx`, but onboarding now consumes the same draft before navigating across stack boundaries.

## Minimal Fix Recommendation

Mount one `IntakeProvider` above the root router stack and remove the nested Shelf provider so the transient draft has one authority across both routes.

## Verification Flow After Fix

1. Reset and reopen `/onboarding/products`.
2. Enter a product and choose a category.
3. Continue to `/shelf/opened`, save, and verify return to onboarding.

## Post-Fix Evidence

- `01-onboarding-products-390x844.png`
- `03-exact-date-label-pao-390x844.png`
- `04-onboarding-return-product-390x844.png`
- Browser errors after the cache-cleared rerun: 0

## Remaining Risk

- Native stack transition behavior still requires supported iOS/Android QA.
