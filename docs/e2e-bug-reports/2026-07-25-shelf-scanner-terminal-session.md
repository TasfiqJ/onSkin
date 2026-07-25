# Shelf scanner terminal session could re-arm itself

Date: 2026-07-25
Severity: P1
Surface: `/shelf/scan`
Status: Fixed locally; signed-native camera proof remains required

## Summary

After a no-match, offline, invalid, or failed barcode result, the scanner accepted frames again. The duplicate gate expired after 1.8 seconds, so holding the barcode in view could start another lookup and replace the visible result without a deliberate user action.

## Reproduction

1. Open Shelf barcode scan with camera permission granted.
2. Hold a valid barcode in frame until the lookup reaches no-match, offline, or error.
3. Keep the barcode in frame for longer than the duplicate-read window.

Expected: the terminal result remains authoritative, camera frames and torch stay paused, and only a named `Scan again` action can re-arm the scanner.

Actual before the fix: only `looking_up` and `matched` detached the frame handler. Other terminal states left the focused camera active, so a held barcode could issue another request after the duplicate window elapsed.

## Cause

The route mixed transient and terminal state in component-local branches. Camera activity, frame-handler ownership, torch state, duplicate suppression, and request completion were not governed by one persistent scan session.

## Fix

- Added a pure barcode-session reducer with explicit idle, lookup, and terminal states.
- Added a synchronous state ref so multiple camera callbacks in one React render cannot start multiple sessions.
- Paused `CameraView`, its scan handler, and torch during lookup and every terminal state.
- Hid the active-looking reticle while scanning is paused and restored the documented selection haptic after an accepted decode.
- Added monotonic attempt IDs plus controller identity guards so stale same-barcode work cannot publish into a newer attempt.
- Added a complete 48 pt+ `Scan again` action that aborts pending work, clears the duplicate identity, and re-arms in place.
- Added polite alert semantics with concise paused-state labels for lookup and every terminal result.

## Verification

- `barcodeScanSession.test.ts`: one-start gating, all terminal outcomes, exact reset, same-barcode re-arm, stale same-barcode finish/cancel fencing, camera/torch activity.
- `shelfRoutes.test.ts`: route-level handler, lifecycle, controller, attempt-ID, recovery-control, and terminal-layout contracts.
- Expo web at 375 x 667 and 390 x 844: no-match and the denser matched terminal fixture remained complete. The matched result exposed one accessible paused-state alert; Add this, Wrong, Scan again, and all three fallback controls were fully in-viewport and center-hit-testable. Matched and no-match results persisted for 2.8 seconds, and reset returned to idle without navigation.

Evidence: `test-results/human-e2e/2026-07-25/shelf-scanner-terminal-session-current/`.

## Remaining native proof

Expo web cannot prove physical camera callback count, torch shutdown, interruption behavior, or native focus/background lifecycle. A signed supported-iOS run must hold a real barcode through terminal state, inspect request/log count, re-arm, and scan the same code once more.
