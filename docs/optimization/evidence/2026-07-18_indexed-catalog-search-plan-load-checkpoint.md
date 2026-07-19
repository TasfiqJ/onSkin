# OPT-116 Indexed Catalog Search Plan/Load Checkpoint

- Date: 2026-07-18 (America/Toronto)
- Branch: `optimization`
- Implementation SHA: `4ee37e8fcdfceeb0d3e83c26c5d1d940891030ff`
- Evidence class: `backend`
- Status: `implemented`; hosted and scale-acceptance gates remain open

## Scope And Hypothesis

This checkpoint tests whether catalog substring search can preserve the existing API semantics while preventing the pathological two-character scan identified in the baseline. The implementation retains the exact normalized `LIKE` predicate, the service-role-only RPC, deterministic ranking, the 20-result cap, blocked-product exclusion, source attribution, and reviewed-freshness output.

The new two-character path uses a capped 1,001-row bigram candidate probe. A token with at most 1,000 candidates uses the GIN bigram index plus the exact `LIKE` filter. Higher-cardinality tokens use the deterministic ranking index to bound top-N filtering. Three-or-more-character queries continue to require both name and brand trigram indexes, and barcode lookup continues to use the unique barcode index.

## Reproducible Run

Canonical report: [`../reports/2026-07-18_catalog-search-plan-load-report.json`](../reports/2026-07-18_catalog-search-plan-load-report.json)

```powershell
node scripts/optimization/catalog-search-plan-load.mjs
node scripts/optimization/catalog-search-plan-load-smoke.mjs
deno test supabase/functions/catalog-search/indexedSearchContract.test.ts supabase/functions/catalog-search/catalogContract.test.ts supabase/functions/catalog-search/bigramSearchContract.test.ts
npm run typecheck
npm run lint
npm test
git diff --check
```

The canonical rerun ran from `2026-07-19T00:04:16.268Z` through `2026-07-19T00:05:45.348Z` with Docker Engine 29.2.1 and immutable image ID `sha256:3d0f7584ed7d04e27fa050d6683a74746608faf21f202be78460d679cc56461f` (`postgres:15-alpine`, PostgreSQL 15.18). This matches the repository's PostgreSQL 15 configuration. The harness deletes its temporary container on success or failure.

## Fixture And Cache Protocol

The deterministic, synthetic-only fixture contains 250,000 products, including 2,577 blocked rows, 25,000 reviewed-freshness rows, and 250 deliberately rare two-character rows. No user content, identifiers, search strings, product IDs, credentials, or query text are emitted in the report; query classes replace values.

Cold means the first execution after a PostgreSQL container restart. PostgreSQL shared buffers are cold, but host filesystem cache is explicitly uncontrolled. Warm means the immediate second execution of the identical query in the same PostgreSQL process. Readiness requires three consecutive successful SQL probes after each restart.

`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` covers predicate-equivalent product filtering and ranking. It deliberately omits the catalog-source join and reviewed-freshness aggregation so plan-node evidence stays attributable; full RPC latency, including that work, is measured separately with `pgbench`.

## Results

The report passed all locally enforceable validation. No final query class performed a sequential products scan.

| Warm query class        |        Execution | Required index path    |
| ----------------------- | ---------------: | ---------------------- |
| Common name             |        17.142 ms | name and brand trigram |
| Brand                   |        15.924 ms | name and brand trigram |
| Prefix                  |        15.182 ms | name and brand trigram |
| Misspelling/no result   | 0.614 / 0.293 ms | name and brand trigram |
| Rare two-character      |         0.699 ms | bigram GIN             |
| Selective two-character |         0.777 ms | ranking B-tree         |
| Common two-character    |         0.094 ms | ranking B-tree         |
| Exact barcode           |         0.101 ms | unique barcode         |

The candidate probe remained bounded at 1,001 rows. Warm probe times were 0.481 ms for the rare class, 3.070 ms for the selective class, and 14.133 ms for the common class. Semantic counts exactly matched the original `LIKE` baseline for all eight classes. Blocked products were absent, an oversized limit returned exactly 20 rows, and the ordered-result hash was stable over five runs.

The mixed cold-to-warm full-RPC load used eight clients, four threads, and ten seconds. It completed 4,821 samples at 481.357122 transactions/second: p50 13.533 ms, p95 41.689 ms, p99 47.769 ms, and maximum 148.385 ms. Raw, content-free latency samples remain in the canonical JSON report.

## Storage, Maintenance, And Write Cost

The concurrent two-character index build took 27,048.189 ms for 250,000 rows. Index sizes were 13,574,144 bytes for bigram GIN and 18,178,048 bytes for ranking B-tree, in addition to 10,805,248-byte name trigram, 6,987,776-byte brand trigram, and 7,905,280-byte barcode indexes. The complete products relation occupied 123,920,384 bytes.

Fresh-container maintenance state recorded 250,000 live rows, zero dead rows, two manual analyzes, and no autoanalyze or vacuum yet. Scan counters showed use of every intended search index.

The five-run 1,000-row insertion probe measured a trigram-only p50 of 22.776 ms and final-index p50 of 93.682 ms, a 4.1132× overhead. There is no approved write-overhead budget, so this is measurement-only P1 scale debt—not an accepted regression and not a reason to claim `verified`.

## Deployment And Rollback Boundary

`CREATE INDEX CONCURRENTLY` avoids holding a write-blocking index build, as recommended by the [Supabase index guide](https://supabase.com/docs/guides/database/postgres/indexes). The migration rejects invalid/unready or same-named definition-mismatched indexes before replacing the RPC. If a concurrent build fails, rollback/recovery is to drop the invalid partial index and retry before RPC replacement; the previous RPC remains intact until both index definitions pass their guards.

The evidence runner applied the migration through `psql` autocommit. Supabase CLI 2.109.0 fixed pipeline-incompatible statement handling including `CREATE INDEX CONCURRENTLY`, per the [official v2.109.0 release](https://github.com/supabase/cli/releases/tag/v2.109.0). The current staging deployer does not enforce that minimum and is pre-existing user-owned dirty work, so it was preserved rather than silently overwritten.

Open external/acceptance gates are:

- replay the migration, plans, and load against production-like hosted staging;
- pin or enforce Supabase CLI 2.109.0 or newer in the governed staging path;
- approve an indexed-write overhead budget and either accept or redesign the measured 4.1132× p50 cost.

Rollback triggers are any definition-guard failure, sequential products scan, missing required index, semantic count mismatch, unstable ordering, blocked product exposure, more than 20 results, or an approved write/latency budget breach.

## Verification Boundary

This is strong local PostgreSQL plan/load evidence, not hosted staging or production evidence. No absolute backend latency or write-amplification threshold was approved before the run. Therefore OPT-116 advances to `implemented`, not `verified`.

This slice changes only backend SQL and measurement tooling. It has no user-interface surface, so the repository's human-simulated UI E2E gate is not applicable. Static and behavioral checks passed: 9 focused Deno tests, root typecheck, zero-warning lint, and 344 files / 4,094 tests.
