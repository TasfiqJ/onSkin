# Shelf-Add Operation-Identity Checkpoint

Date: 2026-07-16

Branch: `optimization`

Checkpoint parent: `fff02b89d479c2f138eef3843c472205afdd97c9`

Items: `PERF-P0-005`, `OPT-007`

## Invariant

Every Shelf add must be one explicit caller-owned intent before private storage
is entered. The low-level store must never invent a token after the caller has
lost the ability to retain it: the same token and semantic payload converge on
one product, while a different token represents a genuinely distinct package.

## Baseline Finding

The executable intake path already freezes one operation token and exact input
across retries, the owner-bound mutation hook requires that token, and the
encrypted Shelf v3 envelope retains bounded pending/acknowledged operation
receipts. `addProduct` still made its owner argument optional and generated a
random fallback token, however. A caller using that low-level fallback could
not reproduce the token after commit-response loss, so retrying could add a
second physical unit even though the atomic store itself was working correctly.

## Implementation

- `ShelfAddOwner.operationId` and the `addProduct` owner argument are now
  required at the type boundary.
- Runtime validation rejects absent, blank, padded, and oversized operation IDs
  before `updatePrivateItem`.
- The random fallback was removed. Product IDs remain independently random;
  operation identity belongs to the caller and is persisted with the atomic
  product commit.
- A narrower owner context remains accepted by acknowledgement, which locates
  the durable receipt from the already-published product ID.
- The real intake route and owner-bound hook required no behavior change: they
  already pass the frozen `addOperationId` through every retry.

## Deterministic Evidence

Focused matrix:

```text
npm.cmd --workspace @layerwell/mobile test -- --run \
  src/features/shelf/store.test.ts \
  src/features/shelf/mutations.addIdempotency.test.ts \
  src/features/shelf/mutations.test.ts \
  src/features/shelf/addSubmissionAttempt.test.ts \
  src/lib/storage/privateKV.test.ts

5 files / 127 tests PASS
```

The focused tests prove:

- absent and padded operation IDs stop before private-KV update/write calls;
- 100 same-operation public calls converge on one product;
- 100 distinct caller operations remain 100 distinct packages;
- commit-response loss followed by hook recreation and the same token returns
  the committed product;
- owner changes, input changes, midnight changes, acknowledgement loss, bounded
  receipt pressure, and concurrent edits remain fail-closed; and
- product plus operation receipt still commit in one same-key transform.

Repository verification:

```text
npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings

npm.cmd test
316 files / 3,922 tests PASS

git diff --check
PASS
```

## Result And Tradeoffs

There is no implicit low-level Shelf-add intent anymore. Tests that intentionally
create separate packages now supply separate test tokens, matching the public
contract. This does not claim process-death recovery of an intake attempt that
has not yet received its result; durable cross-process mutation orchestration
belongs to the still-unimplemented OPT-010 transactional outbox.

No UI component, copy, navigation, or interaction changed, so this checkpoint
does not claim new human-simulated E2E. Existing Shelf add/recovery evidence
still exercises the executable route, whose token flow was already explicit.

## Rollback Trigger

Rollback or repair if any executable add path cannot supply a stable token, a
same-token retry creates a second product, a distinct token is collapsed into
an older package, invalid identity enters private storage, or account-A identity
can reuse an account-B receipt. Do not restore implicit random operation IDs.
