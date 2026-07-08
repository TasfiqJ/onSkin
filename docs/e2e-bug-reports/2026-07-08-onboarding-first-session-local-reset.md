# E2E Bug Report: first-session product intake contaminated by persisted shelf state

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, 320 x 430 viewport, local Expo web
Feature: First-run onboarding product intake
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Run a first-session onboarding flow in a browser context that previously stored local shelf data.
2. Complete age, goals, consent, and quiz to reach `/onboarding/products`.
3. Inspect the product-count cue before adding any new product.

## Expected Result

The product intake screen starts clean for a fresh-install E2E run, with `0 of 3 products`, no persisted shelf rows, and only the skip path before a product name is entered.

## Actual Result

The route showed an existing shelf item from prior local storage and exposed `Add 2 more` / `Continue with 1 product` after adding only one new product, contaminating the first-session evidence.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/onboarding-first-session-430-current/01-product-count-after-one-before.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/onboarding-first-session-430-current/01-product-count-after-one-before.json`

## Frequency

- Often when the browser profile already contains local shelf/onboarding state.

## Scope

- Affected route/screen: `/onboarding/products`
- Affected account or fixture: Local Expo web browser profile with persisted private data
- External service involved: None
- Destructive action involved: Local dev fixture clears only local private app data and query cache

## Suspected Cause

The app had no controlled fresh-install reset fixture for human-simulated E2E, so browser-local AsyncStorage from earlier runs could leak into a new onboarding scenario.

## Minimal Fix Recommendation

Add a dev-only and env-gated reset hook on the launch route. When `EXPO_PUBLIC_E2E_LOCAL_RESET=1` and `/?e2eReset=local` are both present, clear local private app data and query cache, then return to `/`. Keep the hook unavailable in production builds.

## Verification Flow After Fix

1. Start Expo web with `EXPO_PUBLIC_E2E_LOCAL_RESET=1`.
2. Open `/?e2eReset=local` at 320 x 430 and confirm the welcome route renders after reset.
3. Complete onboarding to `/onboarding/products`.
4. Confirm the screen starts at `0 of 3 products` with no persisted shelf item.
5. Add three products and verify the footer advances through `Add 2 more`, `Add 1 more`, and `Continue`.

## Post-Fix Evidence

- Screenshot sequence: `test-results/human-e2e/2026-07-08/onboarding-first-session-430-current/`
- UI snapshot: `test-results/human-e2e/2026-07-08/onboarding-first-session-430-current/summary.json`

## Remaining Risk

- Untested branches: Native iOS/Android first-install reset using actual app reinstall.
- Missing fixtures: Durable native E2E harness remains open.
- Follow-up needed: Keep this fixture dev-only and use it only for local E2E setup.
