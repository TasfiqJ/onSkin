# E2E Bug Report: direct-entry aliases show stale or unmatched route screens

Severity: Medium
Surface: Expo web
Environment: Local Expo web at `http://localhost:8140`, 320 x 568 phone viewport
Feature: Shelf add, photo progress, and settings direct-entry recovery
Date: 2026-07-06
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 8140`.
2. Set the browser viewport to 320 x 568.
3. Open `/shelf/add`, `/photos/capture`, `/photos/review`, `/photos/missing-photo`, and `/settings/privacy` directly.

## Expected Result

Direct entries should land on app-owned recovery surfaces: `/shelf/add` should open manual add, legacy `/photos/*` entries should land in the matching Progress photo surfaces, and `/settings/privacy` should recover to the You tab privacy controls.

## Actual Result

`/shelf/add` was captured by the dynamic product detail route and showed `This product is no longer on your shelf.` The `/photos/*` and `/settings/privacy` paths showed Expo Router's generic unmatched-route page.

## Evidence

- UI snapshot: `test-results/human-e2e/2026-07-06/multi-phone-route-audit-continuation/route-audit-issues.json`
- Screenshot: `test-results/human-e2e/2026-07-06/multi-phone-route-audit-continuation/se-320x568-shelf-add.png`
- Screenshot: `test-results/human-e2e/2026-07-06/multi-phone-route-audit-continuation/se-320x568-photos-capture.png`
- Screenshot: `test-results/human-e2e/2026-07-06/multi-phone-route-audit-continuation/se-320x568-settings-privacy.png`

## Frequency

- Always

## Scope

- Affected route/screen: `/shelf/add`, `/photos/capture`, `/photos/review`, `/photos/[id]`, `/settings/privacy`
- Affected account or fixture: Fresh local/free web state
- External service involved: No
- Destructive action involved: No

## Suspected Cause

The canonical routes are `/shelf/manual` and `/progress/*`, but the intuitive or legacy direct-entry paths did not have static aliases. In the shelf case, Expo Router matched `add` as the dynamic product id.

## Minimal Fix Recommendation

Add static redirect aliases for the direct-entry paths and source-level route-contract tests to prevent the dynamic routes or unmatched page from catching them again.

## Verification Flow After Fix

1. Open each affected path directly at 320 x 568.
2. Confirm it redirects to the canonical app route.
3. Confirm the page no longer contains the stale product-detail or unmatched-route copy.

## Post-Fix Evidence

- UI snapshot: `test-results/human-e2e/2026-07-06/direct-entry-alias-recovery/alias-route-results.json`
- Screenshot: `test-results/human-e2e/2026-07-06/direct-entry-alias-recovery/shelf-add-after-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/direct-entry-alias-recovery/photos-capture-after-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/direct-entry-alias-recovery/photos-review-after-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/direct-entry-alias-recovery/photos-missing-photo-after-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-06/direct-entry-alias-recovery/settings-privacy-after-320x568.png`

## Remaining Risk

- Native iOS and Android deep-link handling still needs device QA.
- The broad route audit has noisy React Native Web geometry false positives; durable mobile E2E should use a native harness.
