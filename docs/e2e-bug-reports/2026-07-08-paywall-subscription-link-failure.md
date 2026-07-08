# E2E Bug Report: Paywall And Subscription Handoff Failures Need Visible Recovery

Severity: Medium
Surface: Expo web
Environment: System Chrome, Expo web, 320 x 568 viewport, `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=all`, `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`
Feature: Paywall compliance row and Subscription Settings
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE=all`.
2. Open `/paywall/upsell?feature=full_routine` and tap Terms, Privacy, and Restore.
3. Open `/settings/subscription` with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro` and tap Manage in App Store, Terms, Privacy, and Restore purchases.

## Expected Result

Failed policy or billing handoffs leave clear visible recovery feedback on the current surface, Restore reports empty/active/failure state, and compact-phone controls remain tappable.

## Actual Result

Before this fix, the shared paywall policy opener and subscription settings rows relied on transient alerts for external-open failure. If the alert was dismissed, suppressed, or not visible in the web/native bridge, the user had no persistent status on the paywall or subscription settings surface.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/01-paywall-before-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/02-paywall-after-feedback-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/03-settings-subscription-before-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/04-settings-subscription-after-feedback-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/summary.json`
- Logs: `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/browser-logs.json`
- Terminal transcript: System Chrome CDP E2E run passed seven interactions.

## Frequency

- Always with the forced failed-handoff fixture.

## Scope

- Affected route/screen: `/paywall/upsell?feature=full_routine`, shared lifecycle/contextual paywall `ComplianceRow`, `/settings/subscription`
- Affected account or fixture: local Expo web free paywall and `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`
- External service involved: RevenueCat and OS/browser external URL handoff are simulated locally; live services not used.
- Destructive action involved: None.

## Suspected Cause

The external URL helper returned failure and displayed an alert, but calling surfaces did not preserve a route-local recovery message after the handoff failed.

## Minimal Fix Recommendation

Return and await the shared policy opener result, then set inline `accessibilityRole="alert"` feedback in the paywall compliance row and subscription settings rows. Add a store-backed local entitlement fixture so the manage-billing branch can be exercised without live RevenueCat.

## Verification Flow After Fix

1. Run focused typecheck and contract tests.
2. Start Expo web with failed browser/linking handoff fixtures and a store-backed entitlement fixture.
3. Reopen the paywall and subscription settings routes, tap policy, billing, and restore controls, then verify visible feedback, 44 pt+ controls, and zero horizontal overflow.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/02-paywall-after-feedback-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/04-settings-subscription-after-feedback-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/subscription-compliance-feedback-current/summary.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- paywallMobileContracts.test.ts externalOpen.test.ts settingsRoutes.test.ts` passed 36 tests.
- Terminal transcript: System Chrome CDP E2E passed seven interactions.

## Remaining Risk

- Untested branches: native StoreKit/Play manage-subscription sheet success, live RevenueCat active restore, live RevenueCat empty restore, final production policy URLs.
- Missing fixtures: real App Store/Play sandbox accounts and RevenueCat product setup.
- Follow-up needed: physical iOS/Android QA is tracked in `docs/FOR_TAS_TO_DO.md`.
