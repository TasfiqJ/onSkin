# Lightweight Photo Account Boundary

Date: 2026-07-25

Branch: `optimization`

Checkpoint parent: `fae950ab32f724f324b3df72edb48bd3aa40fdc3`

Item: `PERF-P0-009`

## Finding

`AuthProvider` imported the complete encrypted-photo storage module in order to
start, drain, and end the photo account boundary. That module evaluates native
filesystem, crypto, cipher, AsyncStorage, SecureStore, metadata, and plaintext
staging dependencies. The first direct-import extraction was still incomplete:
`AuthProvider` also statically imports `localAccountIsolation`, which retained a
second edge to the same heavy module.

No photo storage operation is required merely to construct either startup
coordinator.

## Invariant

The root authentication and local-account-isolation graph may evaluate only the
dependency-light photo boundary coordinator. The coordinator must preserve the
same singleton state for:

- nested boundary depth and generation invalidation;
- active pure-read rejection and late-result suppression;
- strict in-flight mutation draining;
- destructive-operation serialization;
- app-wide account-generation leases.

Opening and closing a boundary never makes an old-generation mutation current
again. Destructive work queued under the old owner must reject before its body
starts, even if the boundary has reopened.

## Change

- Move the complete photo account-boundary state machine, without semantic
  edits, to `features/photos/photoAccountBoundary.ts`.
- Import that lightweight module from both `AuthProvider` and
  `localAccountIsolation`.
- Keep `encryptedStorage.ts` callers compatible by importing the internal
  wrappers and re-exporting the existing public boundary/error API.
- Follow the complete static local dependency closure from `AuthProvider` in a
  regression test and reject any path to `encryptedStorage.ts`.
- Freeze the lightweight coordinator's runtime dependency allowlist to the
  existing `accountGeneration` module and reject dynamic imports.
- Add stale-generation-after-reopen, queued-destructive-operation, and
  cross-module-singleton regressions.
- Repoint the executable account-scope inventory at the coordinator that now
  owns the boundary implementation.

No persisted bytes, encryption format, cleanup order, photo behavior,
authorization gate, route state, or user-facing UI changed.

## Verification

```text
npm.cmd --workspace apps/mobile run test -- --run \
  src/features/photos/photoAccountBoundary.test.ts \
  src/features/photos/encryptedStorage.test.ts \
  src/lib/auth/AuthProvider.providerLazyLoadingContract.test.ts \
  src/lib/auth/accountSessionIsolationContracts.test.ts \
  src/lib/auth/localAccountIsolation.test.ts \
  src/lib/auth/localAccountIsolation.lazyImport.test.ts \
  src/lib/auth/accountScopeInventory.test.ts

npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile run lint
npm.cmd --workspace apps/mobile test
npx.cmd expo export --platform ios --output-dir <temporary-directory> --clear
```

Results:

- Focused startup/privacy matrix: 7 files / 100 tests passed.
- Mobile typecheck: passed.
- Mobile lint with zero warnings: passed.
- Full mobile run: 355 of 357 files and 4,267 of 4,271 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf provenance and the
  notification behavioural snapshot; none imports or exercises this slice.
- Production iOS export: passed; 2,866 modules bundled to Hermes.
- Independent agent semantic and transitive-import review: no remaining P1
  blocker.

Human-simulated E2E is not applicable to this dependency-graph refactor because
it changes no rendered surface or interaction contract. Existing account
boundary behavior remains covered by the focused integration/adversarial
matrix; production bundling proves the revised graph resolves for the accepted
iOS release target.

## Remaining Evidence

This removes one avoidable root-evaluation edge; it is not a startup latency
claim. Repeated signed supported-iOS cold, warm, and resume distributions across
the plan's empty, median, stress, locked, offline, protected-storage-failure,
low-storage, and low-memory states remain required. No gate was skipped,
parallelized, cached, reordered, or replaced.
