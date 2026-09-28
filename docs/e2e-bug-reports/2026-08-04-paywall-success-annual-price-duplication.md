# E2E Bug Report: Paywall success duplicated the annual billing cadence

Severity: Medium
Surface: Expo web
Environment: Local development, 390 x 844 viewport, web-only `store_pro` fixture
Feature: PAY-07 entitlement admission and purchase confirmation
Date: 2026-08-04
Tester: Codex in-app browser

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`.
2. Complete the local age and health-consent gates.
3. Open `/paywall/success`.

## Expected Result

The confirmed annual plan shows exactly one cadence, such as `$49.99/year` and
`renews $49.99/yr`.

## Actual Result

The screen rendered `$49.99/year/year` in the body and
`renews $49.99/year/yr` in the metadata.

## Evidence

- UI snapshot: in-app browser snapshot captured during the 2026-08-04 run.
- Terminal transcript: Expo web server on local port 19009.

## Frequency

- Always with an entitlement price label that already includes `/year` or `/yr`.

## Scope

- Affected route/screen: `/paywall/success` confirmed branch.
- Affected account or fixture: web-only `store_pro`; any stored price label that already includes an annual cadence.
- External service involved: None for the reproduction.
- Destructive action involved: None.

## Suspected Cause

The success-copy helpers appended `/year` or `/yr` without first normalizing an
already-cadenced price label.

## Minimal Fix Recommendation

Normalize one trailing annual cadence before adding the copy-specific cadence,
and retain a safe no-price lane when exact billing facts are unavailable.

## Verification Flow After Fix

1. Run focused success-copy and PAY-07 contract tests.
2. Reload the confirmed fixture at 390 x 844.
3. Verify one cadence, no overflow, and 44 px-or-larger visible controls.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-08-04/pay07-entitlement-admission-current/confirmed-390x844.png`.
- UI snapshot: `test-results/human-e2e/2026-08-04/pay07-entitlement-admission-current/summary.json`.

## Remaining Risk

- Untested branches: native StoreKit/RevenueCat purchase and restore on a real iOS release candidate.
- Missing fixtures: localized native store price strings beyond the deterministic web fixture.
- Follow-up needed: real-device sandbox and TestFlight purchase evidence remains a launch gate.
