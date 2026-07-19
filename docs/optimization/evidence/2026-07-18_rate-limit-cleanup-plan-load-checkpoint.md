# OPT-119 Rate-Limit Cleanup Plan/Load Checkpoint

- Date: 2026-07-18 (America/Toronto)
- Branch: `optimization`
- Implementation SHA: `329ce0f6fa19fe2357b5ff562a8e3658f6b1187e`
- Evidence class: `backend`
- Status: `implemented`; scheduled cleanup, policy, hosted, and acceptance gates remain open

## Scope And Boundary

This checkpoint proves the existing `edge_rate_limits.window_start` cleanup index and fixed-window rate-limit RPC against a deterministic, synthetic PostgreSQL 15 fixture. It measures the existing behavior; it does not choose a retention duration, install a cleanup schedule, or approve latency, rejection, or table-growth thresholds.

Canonical report: [`../reports/2026-07-18_rate-limit-cleanup-plan-load-report.json`](../reports/2026-07-18_rate-limit-cleanup-plan-load-report.json)

The canonical run used Docker Engine 29.2.1, immutable image ID `sha256:3d0f7584ed7d04e27fa050d6683a74746608faf21f202be78460d679cc56461f`, `postgres:15-alpine`, and PostgreSQL 15.18. It ran from `2026-07-19T00:53:00.474Z` through `2026-07-19T00:53:54.930Z`. The harness removes its temporary container on success or failure.

## Fixture, Index, And Cleanup Plan

The fixture contains 250,000 aggregate-only synthetic buckets: 247,500 active buckets using representative 900- and 3,600-second windows and 2,500 deliberately expired buckets. It contains no real user IDs, IP addresses, user agents, tokens, request content, or production key hashes.

The existing non-concurrent migration built `edge_rate_limits_window_start_idx` over the populated fixture in 260.423 ms. Runtime catalog inspection proved that the index is a valid, ready, non-unique, non-partial, non-expression B-tree whose sole key is `public.edge_rate_limits.window_start`. Migration `20260718000053_edge_rate_limit_cleanup_index_guard.sql` adds the same fail-closed deployment check. A negative transaction replaced the index with a same-named `updated_at` index, proved that the guard rejected it, and proved rollback restored the original definition.

The exact caller-window-derived cleanup predicate was executed with `EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON)` inside transactions and rolled back. PostgreSQL selected `edge_rate_limits_window_start_idx` with no sequential table scan. The cold plan affected all 2,500 expired rows in 1.625 ms with four root shared-read blocks; the immediate warm plan affected the same rows in 1.586 ms with 2,549 root shared-hit blocks. Buffer counters are root counters and are not double-counted across child nodes.

The harness also forced the production RPC's 1% opportunistic cleanup branch deterministically. It added expired, exact-cutoff, newer, and trigger sentinels inside one transaction. The actual RPC removed exactly all 2,501 expired rows, retained the strict-cutoff and newer sentinels, incremented the trigger bucket exactly once, preserved every non-expired aggregate apart from that increment, returned the expected allow decision, and then rolled back to the exact pre-test counts.

Before latency measurement, a throwaway-fixture-only cleanup removed the original 2,500 expired fixture rows and vacuumed/analyzed the table. This isolates RPC contention/cardinality cost from a one-time stale-backlog delete and is not a production cleanup or retention claim.

## Concurrency And Growth

Every scenario starts inside a guarded 900-second window so the bucket cannot cross during measurement. Missing pgbench summary fields fail validation. Raw log sample counts, pgbench processed counts, expected fixed transaction counts, and stored aggregate counts must reconcile exactly.

| Scenario                      | Samples |       TPS |       p50 |        p95 |        p99 |    Maximum | Reject ratio |
| ----------------------------- | ------: | --------: | --------: | ---------: | ---------: | ---------: | -----------: |
| 32-client hot key             |   4,925 |   492.242 | 44.723 ms | 185.969 ms | 313.589 ms | 560.261 ms |     79.6954% |
| 8,000 unique-key inserts      |   8,000 | 6,289.832 |  3.494 ms |  10.020 ms |  20.777 ms | 147.273 ms |           0% |
| Exact 8,000-key replay/update |   8,000 | 6,739.810 |  3.499 ms |   9.844 ms |  22.087 ms |  90.590 ms |           0% |

The hot-key row stored exactly 4,925 requests in one bucket and rejected exactly the requests above the 1,000 limit. The unique-key pass inserted exactly 8,000 one-count buckets. The replay reused exactly those buckets, increased every count to two, and added no rows. All three scenarios recorded zero failed transactions.

Measured relation/dead-tuple state was:

| State                |    Rows | Total relation bytes | Estimated dead tuples |
| -------------------- | ------: | -------------------: | --------------------: |
| Before load          | 247,501 |           88,932,352 |                 2,506 |
| After hot key        | 247,502 |           89,333,760 |                 7,431 |
| After unique inserts | 255,502 |           93,569,024 |                 7,431 |
| After exact replay   | 255,502 |           93,962,240 |                15,431 |

PostgreSQL statistics are nontransactional. The pre-load `n_tup_del=10,001` counts attempted work from two rolled-back 2,500-row plan executions, the rolled-back 2,501-row forced-RPC reconciliation, and the single committed 2,500-row fixture-isolation delete. It does not mean 10,001 durable rows were deleted. The reconciled committed fixture removal is exactly 2,500.

These values are measurements, not accepted performance budgets. Host contention made this committed-SHA run slower than an earlier pre-commit run, so the canonical JSON retains every content-free raw latency sample rather than selecting the faster result.

## Security And Privacy Contract

Runtime validation proves the RPC retains its exact `(text, text, integer, integer) -> boolean` signature, `SECURITY DEFINER`, empty `search_path`, PostgreSQL owner, and service-role execution. PUBLIC, `anon`, and `authenticated` have no execution path; PUBLIC, `anon`, and `authenticated` have no direct table privileges; RLS remains enabled. Scope, key-hash, limit, and window validation boundaries all fail closed.

All stored keys are 64 lowercase hexadecimal characters and the table has no raw identity columns. The report includes only aggregate class labels, counts, plan/index node names, buffer/WAL totals, sizes, and timing samples. It emits no hashes, raw fixture values, SQL predicate literals, identities, credentials, or request content.

## Open P1 Risks And External Gates

The evidence deliberately keeps these risks open:

- The opportunistic delete is global, but its age threshold comes from the triggering call's `p_window_seconds`. Because the accepted input range reaches 86,400 seconds, a short-window call can potentially remove an active long-window bucket. The primary key also omits `window_seconds`, so changing a scope's configured window can collide with retained state. This requires an approved abuse-policy migration, not a silent benchmark-side change.
- Migration 40 uses blocking `CREATE INDEX`, not `CREATE INDEX CONCURRENTLY`. The guard prevents a wrong definition but does not make production index creation nonblocking.
- Governance does not approve a global retention age, batch/deadline, scheduler identity, alert owner, legal-hold behavior, or production operator. No schedule was installed.
- No p50/p95/p99, reject-ratio, lock, dead-tuple, or growth budget was approved before the run.
- Hosted production-like staging replay remains required.

Rollback triggers are any cleanup sequential scan, wrong/unready index, exact-row reconciliation failure, cutoff-survivor loss, bucket/window crossing, lost update, raw-sample/processed/storage mismatch, security/grant drift, PostgreSQL-major mismatch, unexpected many-key rejection, or an approved budget breach.

## Commands And Verification

```powershell
node --check scripts/optimization/rate-limit-cleanup-plan-load.mjs
node scripts/optimization/rate-limit-cleanup-plan-load-smoke.mjs
node scripts/phase9/rate-limit-index-smoke.mjs
node scripts/optimization/rate-limit-cleanup-plan-load.mjs
npm run typecheck
npm run lint
npm test
git diff --check
```

The report and both focused smoke suites passed. Root typecheck, zero-warning lint, and 344 files / 4,094 tests passed. Independent P0/P1 review found no remaining issue within this local implemented-but-not-verified scope.

This slice changes only backend SQL and measurement tooling. It has no user-interface surface, so human-simulated UI E2E is not applicable.
