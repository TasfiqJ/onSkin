# E2E Bug Report: Shelf intake actions clip on 320 x 430 phones

Severity: Medium
Surface: Expo web
Environment: Expo web on localhost, Codex in-app browser, 320 x 430 viewport
Feature: Smart Shelf intake fallbacks
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web with `npm --workspace apps/mobile run web -- --port 8223 --host localhost`.
2. Set the browser viewport to 320 x 430.
3. Open `/shelf/manual`, `/shelf/ocr`, and `/shelf/no-match`.
4. Inspect visible controls for clipping, hit-blocking, and horizontal overflow.

## Expected Result

All shelf intake fallback paths remain reachable on the shorter phone height. Manual add keeps the Ingredients field clear of the sticky Continue footer, OCR exposes `Continue with manual text`, and no-match exposes Search, OCR, and manual fallback rows as tappable controls.

## Actual Result

The pre-fix 49-route sweep found three shelf failures at 320 x 430: `/shelf/manual` had the Ingredients field hit-blocked by Continue, `/shelf/ocr` clipped `Continue with manual text`, and `/shelf/no-match` clipped and hit-blocked `Add it by hand`.

A follow-up 320 x 440 manual-picker pass also found the lower `Something else`
category row was tappable but still partially clipped after scrolling.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-audit/shelf-manual.png`
- Screenshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-audit/shelf-ocr.png`
- Screenshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-audit/shelf-no-match.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-audit/failures.json`

## Frequency

- Always

## Scope

- Affected route/screen: `/shelf/manual`, `/shelf/ocr`, `/shelf/no-match`
- Affected account or fixture: Direct route entry, local Expo web state
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The shelf fallback layouts had already been compacted for 320 x 480, but the shortest-height 320 x 430 viewport needed a second density breakpoint. Sticky footers and capped sheets still consumed enough vertical space to expose partially clipped controls.

## Minimal Fix Recommendation

Add an ultra-short height band below 460 px: reduce nonessential copy/media height, keep controls at 48 px or higher, and hide nonessential helper copy that would otherwise peek behind fixed footers.
Pad the category sheet list enough for the final option to scroll fully into
view, and expose explicit accessibility labels for no-match fallback rows.

## Verification Flow After Fix

1. Reopen `/shelf/manual`, `/shelf/ocr`, and `/shelf/no-match` at 320 x 430.
2. Confirm visible controls have no clipping, hit-blocking, tiny targets, or horizontal overflow.
3. Run the broader 49-route 320 x 430 sweep and confirm shelf routes no longer appear in failures.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-short-phone-430-clearance/shelf-manual-final.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-short-phone-430-clearance/shelf-ocr-final.png`
- Screenshot: `test-results/human-e2e/2026-07-08/shelf-short-phone-430-clearance/shelf-no-match-final.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-short-phone-430-clearance/summary-final.json`
- Full sweep: `test-results/human-e2e/2026-07-08/current-main-short-phone-430-postfix-sweep/failures.json`
- Current 320 x 440 manual/OCR evidence: `test-results/human-e2e/2026-07-08/shelf-ultrashort-manual-ocr-current/`
- Current no-match labeled fallback evidence: `test-results/human-e2e/2026-07-08/shelf-ultrashort-manual-ocr-current/no-match-current-labeled-320x430.json`

## Remaining Risk

- Untested branches: Native iOS and Android device safe-area and Dynamic Type passes.
- Missing fixtures: Real camera/OCR permission sheets and real barcode/OCR capture.
- Follow-up needed: The same 320 x 430 sweep still reports non-shelf issues in Progress, Recommendations, Community, and Subscription settings.
