# Request-Policy Idempotent-Mutation Checkpoint

Date: 2026-07-18 (America/Toronto)

Branch: `optimization`

Checkpoint parent: `7a309261303447c521b38aeaae663568e57b431e`

Item: `OPT-118`

## Outcome

Four direct PostgREST mutations now use the shared bounded request policy. Each
operation has a concrete replay proof, so a transient retry cannot duplicate
user intent or let an older ordered snapshot replace a newer one.

`OPT-118` remains `investigating`. Eight direct mutation files still contain an
ordered upsert or append-only ledger/log operation that lacks the required
operation identity, conditional ordering, or terminal reconciliation. Those
writes retain their existing owner abort fence without an unsafe timeout race or
retry.

## Replay-Safe Mutations

### Completion synchronization

The encrypted completion queue already owns the exact database uniqueness key
`(user_id, step_id, completed_date)`. A transient insert retries at most once;
Postgres `23505` is the durable success receipt for a response-lost first
attempt. The local queue row is removed only after insert success or that exact
dedup receipt. Exhausted, offline, cancelled, or timed-out work keeps the row for
a later flush.

### Commerce click attribution

`20260718000044_commerce_click_event_idempotency.sql` collapses historical
duplicate owner/token rows and adds a unique `(user_id, click_token)` index. One
random content-free click token therefore identifies one explicit handoff
attempt. The request policy replays the identical captured payload, and `23505`
is accepted as the response-loss success receipt.

### Shelf and photo deletion mirrors

Deleting the same owner/row identity repeatedly is commutative. Shelf and photo
server deletes now have an eight-second absolute deadline, at most two attempts,
a 16 KiB response ceiling, owner-linked abort, and typed outcome metrics. Their
encrypted local stores remain authoritative, and a failed best-effort mirror
does not roll back an already completed local deletion.

## Fixed Policy

All four mutations use:

- the already captured account-generation lease;
- an eight-second absolute deadline across every attempt and delay;
- at most two attempts;
- transient-only full-jitter retry and bounded `Retry-After`;
- a 16 KiB serialized response ceiling;
- content-free endpoint/status/duration/attempt metrics; and
- no request payload, identifier, token, product value, or private content in
  public errors or diagnostics.

The fixed endpoint registry grows from 17 to 21 names.

## Deferred Mutation Boundary

The exact source inventory now identifies eight files that still need stronger
write semantics:

1. Conflict-choice ordered upsert.
2. Notification delivery log append.
3. Notification-preference ordered upsert.
4. Onboarding profile append.
5. Recommendation-preference ordered upsert.
6. Shelf product ordered upsert.
7. Shelf scan intake append.
8. Consent ledger append.

An absolute timeout can release an ordered client queue while a signal-ignoring
older request later commits, and a blind retry can duplicate an append-only row.
Those paths must first add durable operation identity plus conditional ordering
or terminal reconciliation. The broader durable solution remains the encrypted
transactional outbox tracked by `OPT-010` and `PERF-P0-007`.

## Deterministic Verification

```text
npm.cmd --workspace apps/mobile test -- [idempotent-mutation matrix]
6 files / 121 tests PASS

npm.cmd test
332 files / 3,986 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings
```

The focused matrix proves identical retry payloads, one transient retry,
completion and Commerce dedup receipts, the exact Commerce migration/index,
owner-linked abort signals, Shelf/photo repeated delete identity, local queue
retention, private photo journal ordering, and the frozen production mutation
inventory.

Machine-readable coverage is recorded in
`docs/optimization/reports/2026-07-18_request-policy-idempotent-mutation-report.json`.

## Remaining Proof

- Operation identity, server ordering, and terminal reconciliation for the
  eight deferred mutations.
- The approved encrypted transactional outbox schema and one full entity slice.
- Physical supported-iOS offline, timeout, rate-limit, `Retry-After`,
  captive-portal, VPN, poor-network, background, and account-switch scenarios.
- Production migration rehearsal and query/index inspection for the Commerce
  uniqueness constraint.
- Native timing/attempt distributions and approved endpoint thresholds.

No production migration, native reliability, or latency claim is inferred from
deterministic source tests.
