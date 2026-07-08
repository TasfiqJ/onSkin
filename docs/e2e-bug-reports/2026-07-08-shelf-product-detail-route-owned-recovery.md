# E2E Bug Report: Shelf product-detail recovery used platform alerts

Severity: Medium
Surface: Expo web
Environment: Codex in-app browser, Expo web, 320 x 568 viewport, local placeholder Supabase/catalog backend
Feature: Shelf product detail lifecycle and catalog issue reporting
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web and open the Shelf tab on a 320 x 568 viewport.
2. Add `Route Owned Balm` through manual Shelf add and open the product detail route.
3. Tap `More options`.
4. Tap `Report an issue`, then choose `Wrong product match` while the catalog backend is unavailable.

## Expected Result

Product lifecycle choices and catalog-report recovery stay inside the route, expose named modal sheet semantics, provide 48 px+ controls, open no native or JavaScript dialog, and show raw-error-free inline feedback after the failed report.

## Actual Result

The old product-detail route used `Alert.alert` for remove/discard choices and catalog-report issue selection/result messages. During the first route-owned replacement pass, the new sheet had modal dialog semantics but the dialog node was unnamed, which made the accessibility surface incomplete.

## Evidence

- Pre-label-fix screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/05-product-manage-sheet-prelabel-fix.png`
- Pre-label-fix screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/06-product-report-sheet-prelabel-fix.png`
- Final screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/05-product-manage-sheet.png`
- Final screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/06-product-report-sheet.png`
- Final screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/07-product-report-inline-feedback.png`
- Logs: `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/browser-warn-error-logs.json`

## Frequency

- Always in the old route code for these product-detail branches.
- The unnamed dialog regression reproduced once during the first route-owned sheet E2E pass.

## Scope

- Affected route/screen: `/shelf/[id]`
- Affected account or fixture: Local Shelf product and unavailable catalog backend
- External service involved: Catalog issue backend when reporting a product issue
- Destructive action involved: Yes, remove completely and discard product actions are gated by the lifecycle sheet

## Suspected Cause

Product detail still used platform alert flows for lifecycle and catalog-report recovery, while the first route-owned sheet implementation applied the accessibility name to the backdrop container instead of the dialog node.

## Minimal Fix Recommendation

Replace product-detail `Alert.alert` usage with route-owned action sheets, add `accessibilityLabel={title}` to the dialog node, keep destructive choices as explicit sheet actions, and render catalog-report success/failure as inline feedback.

## Verification Flow After Fix

1. Open product detail for `Route Owned Balm` on Expo web at 320 x 568.
2. Tap `More options` and verify `Remove from shelf?` is a named modal sheet with 48 px+ actions and no JavaScript/native dialog.
3. Tap `Report an issue` and verify `Report catalog issue` is a named modal sheet with 48 px+ actions and no JavaScript/native dialog.
4. Tap `Wrong product match` and verify inline `Report not sent` feedback appears with zero horizontal overflow.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/05-product-manage-sheet.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/06-product-report-sheet.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/07-product-report-inline-feedback.png`
- Report: `test-results/human-e2e/2026-07-08/shelf-detail-you-inline-recovery-current/report.md`

## Remaining Risk

- Native iOS/Android screen-reader announcement order, Dynamic Type, and real catalog-backend success copy still need device/backend QA.
