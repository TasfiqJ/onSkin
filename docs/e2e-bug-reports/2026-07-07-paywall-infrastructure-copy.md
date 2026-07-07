# E2E Bug Report: Paywall Infrastructure Copy Leakage

Severity: Medium
Surface: Expo web phone viewport
Environment: Expo web at `http://127.0.0.1:8095`, 320x568 viewport
Feature: Subscription paywall and contextual Pro upsell
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 8095`.
2. Open `/paywall/upsell?feature=full_routine` at a 320x568 phone viewport without native store checkout configured.
3. Inspect the copy between the annual price card and the primary CTA.

## Expected Result

The paywall can explain that checkout is unavailable in the current build or moment without exposing implementation details. Visible fallback copy should remain calm, user-facing, and consistent with the subscription trust posture.

## Actual Result

The contextual paywall displayed `RevenueCat is not configured. Prices are disabled development previews.` as a tiny label on the purchase screen, making a conversion-critical surface look like a debug build.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/current-compact-ux-sweep/paywall-upsell-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/current-compact-ux-sweep/paywall-upsell-audit.json`
- Terminal transcript: Expo web sessions on ports `8094` and `8095`

## Frequency

- Always in Expo web or other non-native preview builds without store checkout configured.

## Scope

- Affected route/screen: `/paywall/upsell?feature=full_routine`, with shared copy risk on onboarding paywall, reverse-trial reoffer, and reusable Pro gate surfaces.
- Affected account or fixture: Local development fallback subscription offering.
- External service involved: Native store checkout is intentionally unavailable in the tested surface.
- Destructive action involved: No

## Suspected Cause

The subscription offering fallback reason was authored as an implementation diagnostic and then rendered directly in paywall UI. The paywall rendered it with the small label style, amplifying the unfinished/debug feel.

## Minimal Fix Recommendation

Replace visible fallback reasons with user-facing checkout-unavailable copy, keep internal RevenueCat diagnostics out of paywall text, and render the message as calm body copy on paywall surfaces.

## Verification Flow After Fix

1. Reopen `/paywall/upsell?feature=full_routine` at 320x568 with checkout unavailable.
2. Confirm the paywall displays `Store checkout is unavailable in this preview. You can keep exploring.` with no `RevenueCat`, package, setup, or production-build wording.
3. Confirm the primary CTA remains disabled, the price card remains readable, and Terms/Privacy/Restore plus dismiss actions stay reachable.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/paywall-infrastructure-copy/upsell-after-copy-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/paywall-infrastructure-copy/upsell-after-copy-320x568-state.json`
- Visible DOM snapshot: `test-results/human-e2e/2026-07-07/paywall-infrastructure-copy/upsell-after-copy-320x568-dom.txt`
- Current-run warnings: `test-results/human-e2e/2026-07-07/paywall-infrastructure-copy/upsell-console-warn-error.json`

## Remaining Risk

- Untested branches: Native iOS and Android purchase sheets still need simulator/device QA with real RevenueCat sandbox/test-store configuration.
- Missing fixtures: The web pass uses the development fallback rather than a configured native store offering.
- Follow-up needed: Add durable mobile E2E coverage for checkout-unavailable and sandbox purchase paths once the mobile E2E harness is selected.
