# Interface State Token Checkpoint

Date: 2026-07-16

Branch: `optimization`

Checkpoint parent: `a4fb0d41fa3d71de94df27ebb836b1c2fc6e27c1`

Item: `OPT-205`

## Invariant

Loading, empty, offline, error, unavailable, corrupt, locked, and destructive
states must remain semantically distinct. Every rendered state names its meaning
in text rather than color alone, uses the appropriate accessibility role and
live-region behavior, and preserves a recovery path where recovery exists.

## Baseline Finding

State appearance and semantics were repeated across startup, private storage,
photo storage, scheduler, notification, commerce, subscription, onboarding, and
catalog surfaces. Several owners used a spinner plus free text, handcrafted
one-off colors, or local alert markup. Catalog search flattened a transport
failure and a successful no-match into the same message channel, making empty
and offline visually and semantically interchangeable.

## Implementation

- Added a complete paper/night semantic token matrix for eight state kinds.
- Added shared `StateNotice` and `StateLoading` primitives. Every state renders a
  visible label; alert-sensitive states use alert semantics; loading uses a busy
  progress role and polite live region; empty remains non-alert content.
- Migrated startup/session/private-storage, Shelf, photo/lock, scheduler,
  completion-history, notifications, commerce, paywall, onboarding, and You
  recovery owners to the shared state contract.
- Kept recovery controls as children of the named state instead of hiding them
  in native alerts. Added a secondary inverse button treatment so night-surface
  recovery preserves primary/secondary hierarchy.
- Split catalog results into explicit loading, empty, offline, and error
  meanings. A successful no-match retains report/manual recovery; offline
  retains manual add without claiming the catalog is empty.
- Kept paywall/store and purchase feedback typed. Pending verification remains
  loading; unavailable pricing is unavailable; purchase failure is error.
- Added source inventory tests so the semantic matrix, accessibility roles, and
  representative adopters cannot silently drift back to one-off state markup.

## Deterministic Evidence

```text
npm.cmd --workspace @onskin/mobile test -- \
  src/theme/stateTokens.test.ts \
  src/components/ui/stateNoticeInventory.test.ts \
  src/features/shelf/shelfRoutes.test.ts \
  src/features/settings/settingsRoutes.test.ts \
  src/features/photos/progressRoutes.test.ts \
  src/features/onboarding/onboardingRoutes.test.ts \
  src/features/onboarding/onboardingStatusQuery.test.ts \
  src/features/subscription/paywallMobileContracts.test.ts \
  src/features/subscription/claimsafety.test.ts \
  src/lib/auth/accountSessionIsolationContracts.test.ts \
  src/lib/storage/plaintextStagingCore.test.ts \
  src/features/notifications/NotificationPreferenceState.test.ts
12 files / 274 tests PASS

npm.cmd --workspace @onskin/mobile test -- \
  src/lib/applock/authenticate.test.ts \
  src/features/photos/PhotoStorageGate.test.ts \
  src/features/commerce/commerceRoutes.test.ts \
  src/lib/storage/privateDataAvailabilityGate.test.ts \
  src/features/routine/rampAvailability.test.ts
5 files / 40 tests PASS

npm.cmd test
321 files / 3,944 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings
```

The token tests prove all eight states have unique visible names and complete
paper/night values. The inventory tests prove the roles and labels live in the
shared primitive, representative high-value owners adopt it, and catalog search
retains explicit offline/error/empty branches.

## Human-Simulated E2E

Actual Expo web at 1281 x 720 passed five rendered-state checks:

- persistent private-storage failure rendered exactly one visibly named
  `Unavailable` alert, non-destructive encrypted-data copy, and one Retry;
- persistent Retry retained the unavailable state and added explicit
  unchanged-data detail;
- delayed catalog search rendered exactly one named `Loading` progress state
  while Search was disabled;
- a successful no-match rendered `Nothing here yet` / `No catalog match` with
  both reporting and manual-add recovery; and
- backend unavailability rendered exactly one `Offline` alert, one manual-add
  recovery, and no JavaScript dialog.

Screenshots and the machine-readable inspection are in
`test-results/human-e2e/2026-07-16/interface-state-tokens-current/`. Expected
placeholder-Supabase and Expo Notifications web warnings were present; no
feature error was emitted.

## Result And Remaining Verification

`OPT-205` is implemented locally. It is not `verified` because the plan requires
a visual regression review. The remaining gate is supported-iOS appearance in
paper and night surfaces, VoiceOver announcement order and focus, Dynamic Type,
and critical-route comparison across loading, empty, offline, error,
unavailable, corrupt, locked, and destructive states. Android resilience review
remains outside the accepted iOS-only V1 launch contract unless scope changes.

## Rollback Trigger

Rollback or repair if a state loses its visible semantic label, relies on color,
uses error alerting for ordinary empty content, flattens offline/error into
empty, hides recovery behind a platform dialog, leaks raw storage/network
detail, or makes a destructive state appear safe or routine.
