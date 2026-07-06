# E2E Bug Report: Paywall success metadata wraps poorly on compact phones

Severity: Medium
Surface: Expo web
Environment: Expo web at 320x568 phone viewport
Feature: Paywall purchase success confirmation
Date: July 6, 2026
Tester: Codex

## Reproduction Steps

1. Start the mobile app on Expo web.
2. Set the browser viewport to 320x568.
3. Open `/paywall/success`.
4. Inspect the confirmation badge, renewal metadata, and bottom CTA.

## Expected Result

The success badge renders a clean checkmark, the title and renewal terms remain readable, the renewal metadata does not orphan `yr` onto its own line, and the Today CTA remains visible.

## Actual Result

The renewal metadata rendered as one centered sentence, which left `yr` orphaned on its own line on the smallest supported phone width. The checkmark also depended on a raw glyph instead of a stable escaped source character.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/full-phone-route-audit/paywall-success-320x568.png`
- Video: N/A
- Trace: N/A
- Logs: N/A
- UI snapshot: full route audit summary in `test-results/human-e2e/2026-07-06/full-phone-route-audit/summary.json`
- Terminal transcript: N/A

## Frequency

- Always on the tested 320x568 paywall success route.

## Scope

- Affected route/screen: `/paywall/success`
- Affected account or fixture: local Expo web paywall success fixture
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The route rendered the renewal metadata as a single text node with a middle dot separator. At 320 px, the trailing price suffix could wrap independently from the amount.

## Minimal Fix Recommendation

Render the trial or paid renewal metadata as two compact centered rows inside a constrained container, and render the confirmation checkmark from an escaped source character with explicit line height.

## Verification Flow After Fix

1. Reload `/paywall/success` at 320x568.
2. Confirm the checkmark, title, body, two metadata rows, and Today CTA are visible.
3. Confirm no metadata row overflows horizontally or vertically.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-06/paywall-success-metadata-wrap/paywall-success-320x568.png`
- Video: N/A
- Trace: N/A
- Logs: `test-results/human-e2e/2026-07-06/paywall-success-metadata-wrap/browser-warn-error-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-06/paywall-success-metadata-wrap/paywall-success-320x568-state.json`
- Terminal transcript: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts`, `npm --workspace apps/mobile run typecheck`, `npm --workspace apps/mobile run lint`, `npm --workspace apps/mobile run test`, `npm run typecheck`, `npm run lint`, and `npm test` all passed.

Post-fix result: Pass on Expo web at a 320 x 568 viewport. The metadata renders
as two centered 238 px rows inside a 272 px container, and the Today CTA remains
visible. Logs contain only the expected local placeholder Supabase and web
notification warnings plus a stale Metro disconnect from the previous server
restart.

## Remaining Risk

- Untested branches: native iOS and Android purchase-success rendering.
- Missing fixtures: live RevenueCat purchase completion state.
- Follow-up needed: confirm native rendering during the full release-device pass.
