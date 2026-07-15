# E2E Bug Report: Ownerless local reverse trial blocked first-session activation

Severity: Medium
Surface: Expo web
Environment: Windows local Expo development server, placeholder Supabase configuration, 390 x 844 headless Chrome
Feature: Onboarding paywall `Explore first` activation
Date: 2026-07-15
Tester: Codex

## Reproduction Steps

1. Run `npm run e2e:onboarding-first-session` without a configured Supabase project.
2. Complete onboarding to the current `Subscribe to Pro` paywall.
3. Choose `Explore first` without creating an account.

## Expected Result

The documented development-only, no-card reverse-trial fixture should persist locally and open the generated routine plan. Production, configured-backend, and paid-store actions must remain bound to an authenticated RevenueCat owner.

## Actual Result

The action remained on the paywall because `startReverseTrial` required `revenueCatOwner` before the local unconfigured-development fallback could run. The first automation attempt also waited for obsolete `Start free trial` copy instead of the current `Subscribe to Pro` heading.

## Evidence

- Logs: Codex task transcript from the initial 2026-07-15 maintained first-session runs
- UI snapshot: paywall checkpoint in `test-results/human-e2e/2026-07-15/today-opt114-current/`
- Terminal transcript: initial harness failure at the paywall action, followed by the post-fix pass

## Frequency

- Always for the ownerless local-development fixture before the fix

## Scope

- Affected route/screen: `/onboarding/paywall`
- Affected account or fixture: signed-out development fixture with unconfigured Supabase
- External service involved: no live service; the placeholder configuration is intentional
- Destructive action involved: no

## Suspected Cause

The reverse-trial mutation was grouped with paid RevenueCat operations and unconditionally derived an authenticated store owner. Its existing local-development fallback accepts an absent store user only when the app is in development and Supabase is unconfigured, but the new owner assertion ran first.

## Minimal Fix Recommendation

Use the authenticated user ID when present. Permit an absent reverse-trial store ID only for the exact development plus unconfigured-Supabase fixture, retain `REVENUECAT_OWNER_REQUIRED` everywhere else, and update the maintained harness to the current paywall heading. Do not relax ownership for purchases, restores, downgrades, win-back offers, or subscription management.

## Verification Flow After Fix

1. Repeat onboarding at 390 x 844 with placeholder Supabase configuration.
2. Confirm `Subscribe to Pro` and `Explore first` are visible.
3. Choose `Explore first`, reach `/routine/plan`, choose `Start today`, and complete AM and PM check-offs.

## Post-Fix Evidence

- Screenshot sequence: `test-results/human-e2e/2026-07-15/today-opt114-final/17-paywall-current.png` through `24-today-pm-after-checkoff.png`
- UI snapshot: `test-results/human-e2e/2026-07-15/today-opt114-final/report.md`
- Logs: `test-results/human-e2e/2026-07-15/today-opt114-final/browser-warn-error-logs.json`
- Terminal transcript: `Onboarding first-session E2E passed.`

## Remaining Risk

- Untested branches: physical iPhone StoreKit and authenticated configured-backend reverse trial
- Missing fixtures: live Supabase/RevenueCat sandbox account
- Follow-up needed: native subscription QA remains part of the release gate
