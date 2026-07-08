# Human-Simulated E2E Report: Shelf detail and You inline recovery

Surface: Expo web
Viewport: 320 x 568
Date: 2026-07-08

## Flows

1. Added `Route Owned Balm` through Shelf manual add and opened product detail.
2. Opened `More options`; verified the `Remove from shelf?` route-owned dialog is named, modal, 320 px wide, has 48+ px controls, opens no JS/native dialog, and keeps zero horizontal overflow.
3. Opened `Report an issue`, selected `Wrong product match`, and verified inline `Report not sent` feedback with no JS/native dialog.
4. Opened You tab at 320 px, forced cloud-backup save failure, export failure, delete confirmation, and withdrawal confirmation. Each stayed inline with no JS/native dialog and zero horizontal overflow.
5. Did not press destructive final `Delete` or `Withdraw & delete` actions.

## Evidence

- `01-shelf-manual-filled.png`
- `02-opened-date-default.png`
- `03-shelf-with-product.png`
- `04-product-detail-start-final.png`
- `05-product-manage-sheet.png`
- `06-product-report-sheet.png`
- `07-product-report-inline-feedback.png`
- `08-you-start.png`
- `09-you-cloud-backup-inline-notice.png`
- `10-you-export-inline-feedback.png`
- `11-you-delete-inline-confirm-final.png`
- `12-you-withdraw-inline-confirm-final.png`
- `browser-warn-error-logs.json`

## Result

Pass with fixes. The first Shelf pass found unnamed dialog nodes; after patch, both product-detail sheets expose named `role=dialog` nodes and rerun evidence passes. The first withdrawal confirmation pass put Cancel at the bottom edge; after the scroll nudge, both confirmation actions are fully visible above the floating tab bar.

## Remaining Risk

- Native iOS and Android screen-reader announcement and Dynamic Type behavior still need device QA.
- Successful cloud-backup tradeoff copy needs a backend/success fixture; this no-backend run covers the failure path.
- Final destructive data-rights actions were not executed.
