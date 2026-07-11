# E2E Bug Report: Onboarding Freshness Intake Provider Scope

Severity: Critical
Surface: Expo web
Feature: Onboarding product to Shelf freshness handoff
Date: 2026-07-11
Status: Fixed and rerun

## Reproduction

1. Reset local app state.
2. Open `/onboarding/products`.

Expected: onboarding renders and can carry a product draft into `/shelf/opened`.

Actual: the route rendered blank and logged `useIntake must be used within IntakeProvider`.

## Cause And Fix

`IntakeProvider` was mounted inside `shelf/_layout.tsx`, while onboarding consumed
the same draft before crossing into the Shelf stack. One provider now wraps the
root router stack, and the nested Shelf provider was removed.

## Post-Fix Evidence

- `test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/01-onboarding-products-390x844.png`
- `test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/03-exact-date-label-pao-390x844.png`
- `test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/04-onboarding-return-product-390x844.png`
- Browser errors after the cache-cleared rerun: 0

## Remaining Risk

Supported native stack transitions still require physical iOS and Android QA.
