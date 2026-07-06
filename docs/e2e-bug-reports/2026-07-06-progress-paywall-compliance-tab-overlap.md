# E2E Bug Report: Progress paywall compliance row sits under floating tab bar

Severity: High
Surface: Expo web
Environment: `npm --workspace apps/mobile run web -- --port 8086`, 320 x 568 viewport
Feature: Progress contextual photo-timeline paywall
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start Expo web.
2. Open `/progress` as a free user at a 320 x 568 phone viewport.
3. Inspect the contextual photo-timeline paywall while store pricing is unavailable.

## Expected Result

The annual price, disabled-pricing reason, Start free trial CTA, Explore first CTA, Terms, Privacy, Restore, Maybe later, and floating tab bar should remain readable and tappable without controls entering the tab bar zone.

## Actual Result

The `Terms`, `Privacy`, and `Restore` buttons started at y=482.78 while the floating tab bar zone began at y=489.94. The legal controls overlapped the tab bar on the first compact-phone viewport.

## Evidence

- Before screenshot: `test-results/human-e2e/2026-07-06/fresh-compact-scan/progress-320.png`
- Before geometry: `test-results/human-e2e/2026-07-06/fresh-compact-scan/progress-320-state.json`

## Frequency

- Always in the tested 320 x 568 Expo web viewport when `/progress` renders the contextual paywall and the store-pricing unavailable reason is visible.

## Scope

- Affected route/screen: `/progress`
- Affected account or fixture: free/local user without active Pro entitlement
- External service involved: RevenueCat unavailable/configuration fallback copy
- Destructive action involved: No

## Suspected Cause

The shared compact `ProGate` layout was tuned for non-tab paywalls. Inside the Progress tab, the floating tab bar consumes the bottom viewport while the unavailable-pricing reason adds another text row, pushing the compliance controls into the tab bar zone.

## Minimal Fix Recommendation

When the compact contextual photo paywall is rendered in the Progress tab, insert a compact-only spacer before the compliance row so the first viewport ends cleanly above the floating tab bar and the legal controls are reached by a deliberate scroll.

## Verification Flow After Fix

1. Reload `/progress` at 320 x 568.
2. Confirm the first viewport has no non-tab controls overlapping the floating tab bar.
3. Scroll the paywall down.
4. Confirm `Terms`, `Privacy`, and `Restore` are visible, 48 px tall, and clear of the floating tab bar.

## Post-Fix Evidence

- First-viewport screenshot: `test-results/human-e2e/2026-07-06/progress-paywall-compact-compliance/progress-320.png`
- First-viewport geometry: `test-results/human-e2e/2026-07-06/progress-paywall-compact-compliance/progress-320-geometry.json`
- Scrolled screenshot: `test-results/human-e2e/2026-07-06/progress-paywall-compact-compliance/progress-320-scrolled.png`
- Scrolled geometry: `test-results/human-e2e/2026-07-06/progress-paywall-compact-compliance/progress-320-scrolled-geometry.json`
- Test: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts`

## Remaining Risk

- Native iOS and Android rendering still need simulator/device QA with the real RevenueCat offering states.
