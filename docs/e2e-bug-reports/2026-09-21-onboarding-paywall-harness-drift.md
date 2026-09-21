# E2E Bug Report: onboarding harness expects retired paywall copy and route

Severity: Medium
Surface: Expo web test harness
Environment: headless Chrome, 375 x 667, development-only account fixture
Feature: first-session account upgrade
Date: 2026-09-21
Tester: Codex

## Reproduction Steps

1. Run the first-session harness in account-upgrade mode at 375 x 667.
2. Enter an invalid fixture email code, then the valid `424242` code.
3. Observe the harness after `/onboarding/paywall` loads.

## Expected Result

The harness recognizes the current paywall and continues through the intended
current route without relying on retired copy.

## Actual Result

The app reaches the paywall, but the full-session harness waits for `Start free
trial` and then `Explore first`. The current paywall truthfully shows `Subscribe
to Pro` when no eligible trial offering is available and `Continue with the free
plan` for the no-purchase path. That free path routes to Today, not the legacy
routine-plan continuation assumed by the harness.

## Evidence

- Local screenshots and UI snapshots: `test-results/human-e2e/2026-09-21/onboarding-account-upgrade-375x667/` and `test-results/human-e2e/2026-09-21/onboarding-account-upgrade-checkpoint-current/`.
- Source: `apps/mobile/src/app/onboarding/paywall.tsx`, `apps/mobile/src/features/subscription/copy.ts`, `scripts/e2e/onboarding-first-session.mjs`.

## Frequency

Always in the no-offering development fixture.

## Scope

- Affected route: `/onboarding/paywall` test continuation.
- Affected account: deterministic development-only email upgrade fixture.
- External service: no live RevenueCat or Supabase service.
- Destructive action: none; the browser uses a temporary profile.

## Suspected Cause

The paywall product route and trial-eligibility copy changed after the old
full-session harness was written. The harness hard-coded one paid CTA and one
free CTA, then assumed the former routine-plan route.

## Minimal Fix Recommendation

Keep a focused account-upgrade checkpoint that asserts the current paywall and
stops there. Separately re-map and re-run the full free-plan-to-Today activation
flow before treating the legacy full-session harness as current evidence.

## Verification Flow After Fix

1. Run `node scripts/e2e/onboarding-first-session.mjs --account-upgrade-checkpoint`
   with `ONBOARDING_E2E_VIEWPORT_WIDTH=375` and
   `ONBOARDING_E2E_VIEWPORT_HEIGHT=667`.
2. Confirm the invalid-code state, resend countdown, valid-code navigation,
   and current paid/free paywall labels.

## Post-Fix Evidence

- `test-results/human-e2e/2026-09-21/onboarding-account-upgrade-checkpoint-current/summary.json`
  reports `pass`; its screenshots show the account error and paywall.

## Remaining Risk

- The legacy full-session harness still needs a current free-plan-to-Today
  rewrite and rerun.
- Local fixture evidence does not prove live email delivery, same-user
  Supabase linking, native iPhone behavior, or actual purchase eligibility.
