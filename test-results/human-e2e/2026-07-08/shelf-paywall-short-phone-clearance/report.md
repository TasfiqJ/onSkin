# Human-Simulated E2E Report: Shelf And Paywall Short-Phone Clearance

Date: 2026-07-08
Surface: Expo web
Viewport: 320 x 480
Command: `EXPO_PUBLIC_E2E_ENTITLEMENT=pro npm --workspace apps/mobile run web -- --port 8202 --host localhost`

## Flow

1. Opened `/shelf` in the 320 x 480 browser viewport.
2. Confirmed the empty Shelf screen was visible.
3. Measured `Scan a barcode` and `Add by hand` rectangles, visible height, and center hit-test target.
4. Captured a screenshot.
5. Tapped `Add by hand` at its measured center and confirmed navigation to `/shelf/manual`.
6. Opened `/paywall/upsell?feature=full_routine`.
7. Measured `Start free trial`, Terms, Privacy, Restore, and `Maybe later`.
8. Captured a screenshot.
9. Tapped `Maybe later` at its measured center and confirmed dismissal to `/today`.

## Result

Pass after fix.

- `/shelf` `Scan a barcode`: 256.4 x 56.0 px, y=256.9-312.9, center hit-test inside the button.
- `/shelf` `Add by hand`: 256.4 x 48.0 px, y=320.9-368.9, center hit-test inside the button.
- Floating tab bar: top y=400.6, leaving about 31.7 px between `Add by hand` and the bar.
- `Add by hand` tap result: `/shelf/manual`.
- `/paywall/upsell?feature=full_routine` `Start free trial`: 264.4 x 52.0 px, y=312.6-364.6, center hit-test inside the button.
- `Maybe later`: 264.4 x 48.0 px, y=412.6-460.6, center hit-test inside the button.
- `Maybe later` tap result: `/today`.

## Evidence

- `shelf-320x480-after-fix.png`
- `shelf-320x480-after-fix.json`
- `shelf-add-by-hand-click-result.png`
- `shelf-add-by-hand-click-result.json`
- `paywall-upsell-320x480-after-fix.png`
- `paywall-upsell-320x480-after-fix.json`
- `paywall-maybe-later-click-result.png`
- `paywall-maybe-later-click-result.json`

## Notes

The in-app browser tab handle was stale once before the run and was reset. The successful evidence above was captured after a clean reconnect. Expo web emitted only expected local placeholder Supabase and Expo notifications warnings during this server session.
