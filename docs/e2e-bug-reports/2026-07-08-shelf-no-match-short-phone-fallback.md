# E2E Bug Report: Shelf no-match manual fallback clipped on 320x480

Severity: High
Surface: Expo web
Environment: Codex in-app browser, Expo web on localhost:8185, 320 px wide by 481 px high viewport
Feature: Shelf barcode no-match recovery
Date: 2026-07-08
Tester: Codex

## Reproduction Steps

1. Start Expo web for the mobile app.
2. Set the browser viewport to a shortest-phone size, 320 x 480.
3. Open `/shelf/no-match`.
4. Inspect the visible recovery actions.

## Expected Result

The barcode no-match sheet shows Search catalog, Scan the ingredient list, and Add it by hand as visible, tappable recovery choices. The manual path must not be clipped because it is the always-works fallback.

## Actual Result

The Add it by hand recovery row was only partially visible at the bottom of the viewport. Its center sat outside the viewport, and the page itself had no useful document scroll, making the always-works fallback feel hidden and unreliable on the shortest supported phone size.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/no-match-before.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/no-match-before.json`
- Logs: no JavaScript dialog captured

## Frequency

- Always at 320 x 480 / 320 x 481 browser viewport

## Scope

- Affected route/screen: `/shelf/no-match`
- Affected account or fixture: direct route entry, no account-specific fixture required
- External service involved: none
- Destructive action involved: no

## Suspected Cause

The route relied on the default night sheet density. At very short viewport heights, the title, helper copy, three 68 px action rows, and footer microcopy exceeded the visible sheet space. The shared sheet clipped overflow, while the content did not need enough document height to expose a normal page scroll.

## Minimal Fix Recommendation

Add a route-local compact layout for heights below 520 px: slightly reduce title/body spacing, keep the close action large, reduce recovery rows to still-accessible 54 px targets, and hide only nonessential footer microcopy.

## Verification Flow After Fix

1. Open `/shelf/no-match` at 320 x 480.
2. Verify Search catalog, Scan the ingredient list, and Add it by hand are all fully visible and at least 44 px high.
3. Confirm no horizontal overflow, blocked hit-tests, clipped visible controls, JavaScript dialogs, or current-route warning/error logs.
4. Tap the Add it by hand row by its visible center.
5. Confirm the route changes to `/shelf/manual`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/no-match-fixed.png`
- UI snapshot: `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/no-match-fixed.json`
- Tap-through screenshot: `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/manual-after-click.png`
- Tap-through snapshot: `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/manual-after-click.json`
- Current-source recheck: `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/current-recheck-8193.json`
- Current-source screenshot: `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/no-match-current-recheck-8193.png`
- Current-source tap-through screenshot: `test-results/human-e2e/2026-07-08/shelf-no-match-short-phone-480/manual-after-current-recheck-8193.png`
- Terminal transcript: focused shelf route contracts passed with `npm --workspace apps/mobile run test -- --run src/features/shelf/shelfRoutes.test.ts`

## Remaining Risk

- Untested branches: real native barcode camera no-match and Open Beauty Facts lookup behavior
- Missing fixtures: physical iOS and Android safe-area, Dynamic Type, and screen-reader traversal
- Follow-up needed: re-run this route on native devices before app-store launch
