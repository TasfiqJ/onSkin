# Shelf sync status exposed duplicate progress bars

Date: 2026-07-18

Environment: Expo web development build at 390 x 844 with `EXPO_PUBLIC_E2E_SHELF_SYNC_STATUS=syncing`.

## Reproduction

1. Open `/shelf` with the syncing-status fixture.
2. Inspect the visible accessibility tree.

## Expected

The syncing notice exposes one named progress bar and one polite status message while the Shelf remains usable.

## Actual

The notice wrapper declared `progressbar`, while Expo's `ActivityIndicator` also exposed its native web progress-bar role. The accessibility tree therefore contained a progress bar nested inside another progress bar.

## Cause

The wrapper duplicated semantics already owned by `ActivityIndicator`; setting `accessible={false}` on the spinner did not remove its web role.

## Fix

The wrapper now owns only the polite live region. `ActivityIndicator` is the single progress bar and carries the explicit `Syncing Shelf changes` label plus busy state.

## Verification

The exact post-fix rerun on `/shelf` with the same syncing fixture and requested 390 x 844 viewport exposes one `progressbar "Syncing Shelf changes"`, zero alerts, zero horizontal overflow, no JavaScript dialog, and no browser errors. Evidence is in `test-results/human-e2e/2026-07-18/shelf-outbox-status-current/syncing-390x844.png`.
