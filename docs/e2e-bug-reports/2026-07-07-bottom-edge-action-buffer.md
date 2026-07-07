# E2E Bug Report: Bottom-edge primary actions clipped on compact routes

Severity: Medium
Surface: Expo web
Environment: Expo web, 320 x 568 viewport
Feature: Shelf Product Add / Pro direct-entry routes
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/shelf/search` at a 320 x 568 phone viewport.
2. Inspect the `Add by hand` fallback action at the bottom of the route.
3. Open `/routine/welcome-back` at the same viewport.
4. Inspect the `Tonight's step` action.

## Expected Result

Primary route actions remain fully visible and tappable with a rendered bottom buffer, even on short phones and direct-entry routes.

## Actual Result

Both actions rendered flush to the viewport bottom. `/routine/welcome-back` visibly clipped the rounded bottom of the primary button, and `/shelf/search` placed its fallback action at the physical bottom edge.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/compact-direct-route-sweep-b/shelf-search.png`
- Screenshot: `test-results/human-e2e/2026-07-07/compact-direct-route-sweep-b/routine-welcome-back.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/compact-direct-route-sweep-b/shelf-search.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/compact-direct-route-sweep-b/routine-welcome-back.json`

## Frequency

- Always at 320 x 568 when those routes are opened directly.

## Scope

- Affected route/screen: `/shelf/search`, `/routine/welcome-back`
- Affected account or fixture: Local Expo web state; no special account data required
- External service involved: None
- Destructive action involved: None

## Suspected Cause

The routes rendered their final `Button` directly as the last child of `Screen`. On web the bottom safe-area inset is zero, so the 56 px action can end exactly at the viewport edge.

## Minimal Fix Recommendation

Wrap each bottom action in a small footer buffer, preserving the existing 56 px button target while adding explicit bottom spacing.

## Verification Flow After Fix

1. Reopen `/shelf/search` at 320 x 568.
2. Confirm `Add by hand` remains 56 px tall, has no horizontal overflow, and has bottom buffer.
3. Tap `Add by hand` and confirm `/shelf/manual` opens.
4. Reopen `/routine/welcome-back` at 320 x 568.
5. Confirm `Tonight's step` remains 56 px tall, has no horizontal overflow, and has bottom buffer.
6. Tap `Tonight's step` and confirm Today opens.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/shelf-search-manual-fallback-buffer/320-search.png`
- Screenshot: `test-results/human-e2e/2026-07-07/shelf-search-manual-fallback-buffer/320-search-manual-fallback-after-click.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/shelf-search-manual-fallback-buffer/shelf-direct-entry-current-summary.json`
- Shelf direct-entry sweep: `/shelf/search` keeps `Add by hand` 32 px above the bottom edge at 320 x 568 and 390 x 568, and routes to `/shelf/manual`.
- Screenshot: `test-results/human-e2e/2026-07-07/direct-entry-bottom-actions/01-shelf-search-320.png`
- Screenshot: `test-results/human-e2e/2026-07-07/direct-entry-bottom-actions/03-welcome-back-320.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/direct-entry-bottom-actions/01-shelf-search-320.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/direct-entry-bottom-actions/03-welcome-back-320.json`
- Focused tests: `npm --workspace apps/mobile run test -- shelfRoutes proGatedRoutes`
- Full checks: `npm --workspace apps/mobile run typecheck`, `npm --workspace apps/mobile run lint`, `npm --workspace apps/mobile run test`, and `git diff --check`

## Remaining Risk

- Untested branches: Native iOS/Android device safe-area rendering.
- Missing fixtures: Durable compact-route visual regression harness.
- Follow-up needed: Promote bottom-edge action checks to native E2E once the harness is selected.
