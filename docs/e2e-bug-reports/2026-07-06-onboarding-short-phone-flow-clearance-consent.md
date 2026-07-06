# E2E Bug Report: Onboarding short-phone flow blocked by consent and footer collisions

Severity: High
Surface: Expo web
Environment: `npm --workspace apps/mobile run web -- --port 8094 --clear`, 320 x 568 browser viewport, Supabase/RevenueCat placeholders
Feature: First-run onboarding
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Clear local browser app state and start first-run onboarding at `/`.
2. Complete welcome, age gate, and goals at 320 x 568.
3. Continue through health-data consent, quiz, product intake, reveal, notifications, account, and paywall.
4. Exercise consent decline, consent agree, sensitivity `None that I know of` replacement, product add/remove, and paywall Explore first.

## Expected Result

The onboarding flow remains usable on a short phone viewport. Health-data consent is recorded before quiz access, consent decline explains the locked state, lower controls do not sit behind fixed footers, product add feedback is visible, and the user can reach the routine plan.

## Actual Result

- Goals: the sixth goal sat in the fixed Continue footer hit zone on 320 x 568.
- Consent: the privacy card bled behind the action stack, and applying clipping directly to `ScrollView` made lower consent copy unscrollable on web.
- Consent persistence: fresh local onboarding could not enter the quiz because consent ledger writes required an authenticated Supabase user while auth was placeholder/unavailable.
- Consent decline: after local-first consent was fixed, the decline explanation rendered below the fold with no immediate visible feedback.
- Quiz: short-phone single-option screens allowed lower options to sit under the fixed Next footer.
- Product intake: the in-card Add to shelf button and added product confirmation were below the fold/under the footer, so users had no immediate add confirmation.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/05-goals-start-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/12-consent-start-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/23-quiz-start-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/32-products-start-320x568.png`
- UI snapshot: matching `*-geometry.json` files in the same evidence folder
- Terminal transcript: this Codex thread

## Frequency

- Always on 320 x 568 with fresh Expo web state and placeholder backend services.

## Scope

- Affected route/screen: `/onboarding/goals`, `/onboarding/consent`, `/onboarding/quiz`, `/onboarding/products`
- Affected account or fixture: fresh local first-run onboarding with placeholder Supabase/RevenueCat
- External service involved: Supabase auth/consents ledger unavailable in local placeholder mode
- Destructive action involved: no

## Suspected Cause

Several onboarding screens used fixed footer actions without a scroll-wrapper pattern that both clips visual bleed and preserves scrolling. Health-data consent used the shared remote ledger helper before account creation without an offline/local-first proof, even though onboarding is guest-first and local development intentionally runs without configured Supabase. Product intake also kept the add action inside scroll content on compact phones, below the footer.

## Minimal Fix Recommendation

- Wrap fixed-footer scroll areas in a clipping `View`, keep `ScrollView` itself scrollable, and give footers an opaque page background.
- Add compact-phone `OptionCard` density and screen-specific spacing where a short phone needs it.
- Store health-data collection consent locally first with version and consent-text hash, then mirror to the immutable ledger best-effort pre-account.
- Move consent status feedback above the privacy card and scroll to it after decline/save failure.
- Make product intake's compact footer context-aware: typed product name -> `Add to shelf`; added product -> `Continue`; auto-scroll to the shelf row after add.

## Verification Flow After Fix

1. Re-run first-run onboarding at 320 x 568 from welcome through routine plan.
2. Verify age invalid/underage branches, goals selection, consent decline and agree, quiz answers, sensitivity None replacement, product add/remove, reveal, notifications Not now, account Not now, paywall disclosure scroll, and Explore first.
3. Run focused onboarding tests, mobile typecheck/lint/tests, and repository typecheck/lint/tests.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/10-goals-resumed-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/16-consent-scrolled-readable-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/22-consent-decline-visible-feedback-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/24-quiz-clearance-fixed-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/40-products-add-autoscrolled-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/onboarding-fresh-phone-sweep/50-routine-plan-after-paywall-explore-320x568.png`
- UI snapshot: matching `*-geometry.json` files in the same evidence folder
- Terminal transcript: `npm --workspace apps/mobile run typecheck`, `npm --workspace apps/mobile run lint`, `npm --workspace apps/mobile run test`, `npm run typecheck`, `npm run lint`, `npm test`

## Remaining Risk

- Untested branches: native iOS/Android visual QA for the same screens, carded RevenueCat purchase, real Supabase anonymous-session ledger mirroring, notification permission allow branch.
- Missing fixtures: standard fresh-onboarding reset command for Expo web/native.
- Follow-up needed: promote the stable Expo web first-run path to an automated Playwright-style E2E once the project has a durable browser harness.
