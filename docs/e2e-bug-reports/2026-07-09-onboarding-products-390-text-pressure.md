# E2E Bug Report: Onboarding Products Input Under Footer At 390 Text Pressure

Severity: Medium
Surface: Expo web
Environment: Headless Chrome, 390 x 844 viewport, 200% text-pressure audit
Feature: Onboarding product intake
Date: 2026-07-09
Tester: Codex

## Reproduction Steps

1. Run the skipped/direct-entry text-pressure route audit at 390 x 844 with 200% text pressure.
2. Open `/onboarding/products`.
3. Inspect visible control geometry before entering a product.

## Expected Result

The first product input and `Skip for now` action remain complete, readable, at least 44 px visible, and center-hit-testable.

## Actual Result

The `Product name` input entered the bottom edge with only 14 px visible in the full sweep, and 38 px visible after the first compact-layout attempt. Its center hit-test resolved to the fixed `Skip for now` footer instead of the input.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-390-844-current/onboarding-products.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-390-844-current/onboarding-products.json`
- Terminal transcript: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-390-844-current/report.md`

## Frequency

- Always in the tested 390 x 844 / 200% skipped-route state.

## Scope

- Affected route/screen: `/onboarding/products`
- Affected account or fixture: Empty local onboarding product state
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The onboarding product screen only entered compact density for short/support-floor heights. A modern 390 x 844 phone at high text pressure still rendered the full intro, progress helper, category chips, and inline add action, so lower-priority copy pushed the first input into the fixed footer area.

## Minimal Fix Recommendation

Add a 390-wide modern-phone text-pressure guard for product intake. In that state, keep the title, product-count cue, first input, and footer action complete, while deferring lower-priority intro/progress copy and category controls.

## Verification Flow After Fix

1. Run the focused `/onboarding/products` 390 x 844 / 200% text-pressure audit.
2. Run the full 21-route skipped/direct-entry 390 x 844 / 200% audit.
3. Confirm zero clipped controls, sub-44 visible controls, blocked hit centers, horizontal overflow, text overflow, or disallowed browser logs.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-390-844-products-postfix2/onboarding-products.png`
- UI snapshot: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-390-844-products-postfix2/onboarding-products.json`
- Full rerun summary: `test-results/human-e2e/2026-07-09/text-pressure-200-skipped-routes-390-844-postfix/summary.json`

## Remaining Risk

- Native iOS/Android Dynamic Type, keyboard, screen-reader, safe-area, and store-sheet behavior still require native device QA.
