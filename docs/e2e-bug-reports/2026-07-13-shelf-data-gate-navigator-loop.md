# E2E Bug Report: Shelf Recovery Gate Unmounted Nested Navigators

Severity: High
Surface: Expo web
Environment: Expo development build on Windows through the Codex in-app browser
Feature: Shelf private-data availability gating
Date: 2026-07-13
Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_ENTITLEMENT=pro` and `EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE=always`.
2. Open `/routine/plan` directly, or open a static nested Shelf route such as `/shelf/manual`.
3. Let the Shelf query settle as unavailable.

## Expected Result

The nested navigator remains mounted, the exact route remains stable, and only the route's screen content is replaced by one accessible non-destructive Shelf recovery state.

## Actual Result

`/routine/plan` rendered Expo's `Maximum update depth exceeded` overlay. Static Shelf routes could be rewritten as `/shelf/undefined` while the recovery gate was active.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-13/shelf-storage-recovery-current/06-routine-gate-render-loop-before.png`
- Logs: the Expo overlay identified `apps/mobile/src/app/routine/_layout.tsx` and repeated nested navigator updates
- UI snapshot: pre-fix route results showed `/shelf/undefined` for manual, archive, and replenish
- Terminal transcript: Expo web development server output from the current run

## Frequency

- Always

## Scope

- Affected route/screen: nested Shelf, Routine, Ask, Recommendations, Conflict, and Share route groups using the same conditional layout pattern
- Affected account or fixture: any owner whose authoritative Shelf query is pending or errored
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The route-group layouts wrapped or conditionally replaced the Expo Router `Stack` with `ShelfDataAvailabilityGate`. Query state therefore removed and reintroduced the navigator itself instead of gating only its screen content, destabilizing nested route resolution and navigation updates.

## Minimal Fix Recommendation

Keep every `Stack` mounted and pass a stable `screenLayout` function that wraps each affected screen's content in `ShelfDataAvailabilityGate`. Selective groups should decide from `route.name`; they must not conditionally replace the navigator based on query or pathname state.

## Verification Flow After Fix

1. Reopen all twelve Shelf-derived direct-entry routes under persistent failure and confirm each exact URL remains stable.
2. Confirm each route shows one recovery alert with no product names, false-empty guidance, or mutation actions.
3. Reopen `/routine/plan` and static Shelf routes, then verify no update-depth overlay and no `/shelf/undefined` rewrite.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-13/shelf-storage-recovery-current/10-routine-gate-after-fix-desktop.png`
- Route snapshot: `test-results/human-e2e/2026-07-13/shelf-storage-recovery-current/route-results.json`
- Source contract: `apps/mobile/src/features/shelf/shelfAvailability.test.ts`
- Result: 12/12 direct-entry routes retained their exact paths, showed one recovery alert, had zero horizontal overflow, and exposed no maximum-update-depth overlay

## Remaining Risk

- Untested branches: native iOS `Stack` presentation behavior, VoiceOver focus, and native secure-store interruption
- Missing fixtures: physical-device Keychain/SecureStore fault injection
- Follow-up needed: repeat representative direct entries in the supported iOS staging build
