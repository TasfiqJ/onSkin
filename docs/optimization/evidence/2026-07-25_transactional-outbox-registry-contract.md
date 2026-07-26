# Transactional Outbox Registry Contract

Date: 2026-07-25

## Finding

The encrypted transactional outbox writes schema version 5 and retains strict
read compatibility for versions 1 through 4. The private-data registry
described the same storage key as version 1 with no legacy versions. Its
structural gap audit still passed, so export, cleanup, and recovery inventory
checks could certify stale codec metadata.

Baseline:

```text
3 focused files / 54 tests passed
```

That green baseline demonstrated that the previous suite did not bind registry
metadata to the runtime codec.

## Invariant

The registry descriptor for `onskin.outbox.v1` must import the runtime writer
version and complete supported-legacy tuple. Adding or removing a runtime
compatibility version must therefore update the same exported contract or fail
the cross-contract test.

## Change

- Export the ordered runtime legacy-version tuple from the outbox codec.
- Use that tuple in strict runtime version admission.
- Build the registry descriptor from the live version constants.
- Add registry and outbox regression tests for current, legacy, and future
  version behavior.
- Correct the implementation ledger from 47 to the actual 49 registered keys.

No persisted bytes, migration behavior, export payload, cleanup behavior,
network behavior, or user-facing surface changed.

## Verification

```text
npm.cmd --workspace apps/mobile test -- src/features/settings/localPrivateDataRegistry.test.ts src/features/settings/localPrivateDataKeys.test.ts src/lib/offline/outbox.pure.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile run lint
npm.cmd --workspace apps/mobile test
```

Results:

- Focused registry/outbox matrix: 3 files / 55 tests passed.
- Mobile typecheck: passed.
- Mobile lint with zero warnings: passed.
- Full mobile run: 354 of 356 files and 4,263 of 4,267 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf provenance and the
  notification behavioural snapshot; none imports or exercises this slice.

Human-simulated E2E is not applicable because this is a metadata-contract and
codec-regression change with no UI or runtime mutation-path behavior.

## Remaining Evidence

The shared outbox still requires hosted replay/RLS/concurrency evidence and
signed-iPhone offline, reconnect, process-kill, duplicate-worker, and
presentation verification. This registry correction does not claim those
external gates are complete.
