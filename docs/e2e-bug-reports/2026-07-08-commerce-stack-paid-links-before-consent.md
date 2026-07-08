# E2E Bug Report: Stack paid-link copy visible before commerce consent

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 568 viewport, commerce enabled with final-domain gate
Feature: Commerce Trust And Shoppable Routines
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true` and `EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app`.
2. Open `/commerce/stack/sensitive-skin-starter-set` on a fresh origin with commerce consent off.
3. Inspect the stack item rows, footer disclosure, external glyphs, and accessibility labels.

## Expected Result

No paid links or retailer telemetry are exposed before the separate commerce data-sharing consent. Stack items show a locked state, and tapping a locked item opens the consent sheet.

## Actual Result

Before the fix, stack rows showed `Paid link`, the stack footer showed `Paid links`, rows displayed the external-link glyph, and row accessibility labels ended with `paid link` even though consent was off. Tapping was consent-gated, but the visible and accessible paid-link affordance was already exposed.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/commerce-no-consent-locking/01-stack-before-paid-links-visible.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/commerce-no-consent-locking/01-stack-before-paid-links-visible.json`

## Frequency

- Always in the audited fresh-origin stack state before commerce consent.

## Scope

- Affected route/screen: `/commerce/stack/[slug]`
- Affected account or fixture: Fresh local Expo web origin with commerce feature enabled and consent off
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The stack detail route had only one item-row visual state. It correctly gated the tap handler before outbound attribution, but the row chip, external glyph, footer disclosure, and accessibility label were unconditional.

## Minimal Fix Recommendation

Split stack item rendering by `useCommerceConsent()`: before consent, render a locked chip, no external glyph, locked accessibility labels, and locked disclosure copy. After consent, preserve the FTC `Paid link` chip, external glyph, and paid-link disclosure.

## Verification Flow After Fix

1. Reopen `/commerce/stack/sensitive-skin-starter-set` with consent off.
2. Verify stack rows show `Consent needed`, not `Paid link`, and no external glyph.
3. Tap the first stack item.
4. Verify `/commerce/consent` opens as a separate dialog.
5. Add a cleanser through `/shelf/manual`, open `/recommendations/gap:mineral_spf`, and verify the where-to-buy block remains locked with no paid-link text.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/commerce-no-consent-locking/02-stack-no-consent-locked.png`
- Screenshot: `test-results/human-e2e/2026-07-08/commerce-no-consent-locking/03-stack-item-opens-consent.png`
- Screenshot: `test-results/human-e2e/2026-07-08/commerce-no-consent-locking/04-recommendation-where-to-buy-locked.png`
- Screenshot: `test-results/human-e2e/2026-07-08/commerce-no-consent-locking/05-recommendation-allow-opens-consent.png`
- Screenshot: `test-results/human-e2e/2026-07-08/commerce-no-consent-locking/06-recommendation-shelf-alternative.png`
- UI snapshots and run report: `test-results/human-e2e/2026-07-08/commerce-no-consent-locking/`

## Remaining Risk

- Untested branches: Native iOS/Android screen-reader traversal and modal focus behavior.
- Missing fixtures: Approved real HTTPS retailer links for native OS-refusal handoff QA.
- Follow-up needed: Native commerce QA once source-cleared retailer links are available.
