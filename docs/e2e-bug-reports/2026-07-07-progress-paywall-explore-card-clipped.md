# E2E Bug Report: Progress paywall Explore first card clipped on short phones

Severity: High
Surface: Expo web phone-width proxy for iOS and Android
Environment: Expo web at `http://localhost:8101`, 320 x 568 viewport
Feature: Progress contextual photo-timeline paywall
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/progress` as a free user on a 320 x 568 phone viewport.
2. Inspect the contextual photo-timeline paywall before scrolling.
3. Look at the no-card `Explore first. 7 days of Pro` CTA above the floating tab bar.

## Expected Result

The no-card exploration CTA should be fully visible and tappable above the floating tab bar, because it is the value-first path for users who are not ready for a store trial.

## Actual Result

The lower `Explore first` card was partially hidden under the floating tab bar on the first phone viewport, making the no-card path look clipped and lowering trust in the Progress paywall.

## Evidence

- Pre-fix screenshot: `test-results/human-e2e/2026-07-07/navigation-tabbar-current-audit/320-progress.png`
- Pre-fix geometry: `test-results/human-e2e/2026-07-07/navigation-tabbar-current-audit/320-visible-tab-states.json`
- Post-fix screenshot: `test-results/human-e2e/2026-07-07/progress-paywall-explore-clearance/progress-paywall-fixed-320x568.png`
- Post-fix geometry: `test-results/human-e2e/2026-07-07/progress-paywall-explore-clearance/progress-paywall-fixed-320x568-state.json`
- Post-fix scrolled compliance screenshot: `test-results/human-e2e/2026-07-07/progress-paywall-explore-clearance/progress-paywall-compliance-scrolled-320x568.png`
- Post-fix scrolled compliance geometry: `test-results/human-e2e/2026-07-07/progress-paywall-explore-clearance/progress-paywall-compliance-scrolled-320x568-state.json`

## Frequency

- Always on the checked 320 x 568 Progress contextual paywall state with the reverse-trial card visible.

## Scope

- Affected route/screen: `/progress`
- Affected account or fixture: Free user eligible for contextual reverse trial
- External service involved: None; store pricing was unavailable in the local preview
- Destructive action involved: None

## Suspected Cause

The compact contextual paywall still spent vertical space on decorative chrome and general compact spacing. Bottom padding made lower controls scrollable, but it did not keep the reverse-trial CTA visible on the first short-phone viewport above the floating tab bar.

## Minimal Fix Recommendation

Use a dedicated compact tabbed photo-paywall variant that removes the decorative icon, tightens vertical spacing, keeps 48 px controls, and preserves extra scroll padding for compliance links.

## Verification Flow After Fix

1. Open `/progress` at 320 x 568.
2. Confirm `Start free trial` and `Explore first. 7 days of Pro` are fully visible above the floating tab bar before scrolling.
3. Scroll down and confirm Terms, Privacy, and Restore remain 48 px controls above the tab bar.
4. Run the paywall mobile contract test.

## Post-Fix Evidence

- Human-simulated E2E: Expo web at `http://localhost:8101/progress`, viewport 320 x 568.
- Fixed first viewport: `Start free trial` rendered at y=289.9-337.9; `Explore first. 7 days of Pro` text rendered at y=350.8-366.8; floating tab bar top was y=485.0; horizontal overflow was 0.
- Scrolled compliance branch: Terms, Privacy, and Restore rendered as 48 px controls at y=269.1-317.1; floating tab bar top was y=485.0; horizontal overflow was 0.
- Automated contract passed: `npm --workspace apps/mobile run test -- src/features/subscription/paywallMobileContracts.test.ts`

## Remaining Risk

- Native iOS and Android Dynamic Type/paywall QA remains required for final device approval.
