# Supabase Concurrent-Index Deployment Closure

Date: 2026-07-26 (America/Toronto)

Branch: `optimization`

Implementation commit:
`95274596fb302477e6c1aceb8f763b9f02585e5c`

Plan items: `OPT-116`, `OPT-119`

## Finding

The prior local checkpoint still had two safe repository-local deployment
gaps:

1. The staging wrapper did not enforce the Supabase CLI version required by
   concurrent-index migrations.
2. The rate-limit cleanup index had originally been built through a blocking
   `CREATE INDEX`, with no forward nonblocking replacement.

Independent review found and rejected an initial incomplete solution. Supabase
CLI `2.109.0` added pipeline-incompatible statement handling to
`migration up`/`down`, while the `db push` path at that tag still proxied to an
implicitly transactional Go batch. The final wrapper therefore uses
`supabase migration up --linked`, not `supabase db push`.

Upstream references:

- [Supabase CLI v2.109.0 release](https://github.com/supabase/cli/releases/tag/v2.109.0)
- [v2.109.0 `migration up` handler](https://github.com/supabase/cli/blob/v2.109.0/apps/cli/src/legacy/commands/migration/up/up.handler.ts)
- [v2.109.0 standalone pipeline-incompatible statement handling](https://github.com/supabase/cli/blob/v2.109.0/apps/cli/src/legacy/shared/legacy-migration-apply.ts)

## `OPT-116`: Exact Runner Contract

`scripts/phase2/supabase-cli-version-gate.ps1` now:

- accepts only a stable semantic version at or above `2.109.0`;
- rejects malformed, prerelease, multiline, unavailable, failed, and older
  version output with fixed content-free error codes;
- resolves only a PowerShell `Application`, not a function or alias;
- returns one absolute executable path; and
- version-checks that exact path.

`scripts/phase2/deploy-supabase-staging.ps1` retains that path for the entire
deployment and invokes link, migration, function deployment, and type
generation through `& $supabaseCliPath`. A PowerShell function or alias named
`supabase` cannot intercept a later call after a different executable was
validated.

The migration command is exactly:

```text
supabase migration up --linked
```

The catalog plan/load report contract records the same minimum and command,
while explicitly keeping exact linked-staging runner replay false and external.

## `OPT-119`: Forward Concurrent Replacement

`20260726000059_edge_rate_limit_cleanup_concurrent_index.sql`:

1. Rejects an existing invalid or unready replacement index with SQLSTATE
   `55000`, a stable message, and an exact concurrent-drop/retry hint.
2. Creates `edge_rate_limits_window_start_concurrent_idx` with
   `CREATE INDEX CONCURRENTLY`.
3. Verifies that it is a valid, ready, nonunique, nonpartial, nonexpression
   B-tree whose sole key is
   `public.edge_rate_limits(window_start)`.
4. Rejects a wrong same-named definition with SQLSTATE `55000` and the same
   recovery contract.
5. Drops historical
   `edge_rate_limits_window_start_idx` with `DROP INDEX CONCURRENTLY` only
   after the replacement passes the exact guard.

The deterministic PostgreSQL harness proves:

- byte-identical safe reapplication;
- live DML forward progress during the replacement migration;
- zero concurrent-writer errors;
- exact SQLSTATE/message/HINT for both wrong-definition and invalid/unready
  failures;
- unchanged legacy-index OID after both rejected attempts;
- explicit concurrent-drop/retry recovery;
- final absence of the legacy index; and
- planner use of the replacement index.

## Verification

```text
& scripts/phase2/supabase-cli-version-gate-smoke.ps1
npm.cmd --workspace apps/mobile exec vitest run src/lib/optimization/supabaseConcurrentMigrationContract.test.ts
npm.cmd run phase9:rate-limit-index-smoke
node scripts/optimization/rate-limit-cleanup-plan-load-smoke.mjs
node scripts/optimization/catalog-search-plan-load-smoke.mjs
node scripts/optimization/rate-limit-cleanup-plan-load.mjs --strict
npm.cmd --workspace apps/mobile run typecheck
git diff --check
```

Results:

- PowerShell version/identity/runtime smoke: PASS.
- Persistent Vitest source contract: 1 file / 3 tests PASS.
- Both rate-limit index/plan-load smokes: PASS.
- Catalog plan/load smoke: PASS.
- Mobile type-check: PASS.
- Strict PostgreSQL 15 run: PASS with zero validation failures at 250,000
  rows.
- Concurrent writer: 6,915 transactions, zero failures, including 235 commits
  during the 177.536 ms replacement interval.
- Wrong-definition and invalid/unready exact recovery contracts: PASS.
- Safe reapply, final legacy absence, and replacement-index planner use: PASS.

The content-free canonical report is
`docs/optimization/reports/2026-07-18_rate-limit-cleanup-plan-load-report.json`.
It identifies implementation commit
`95274596fb302477e6c1aceb8f763b9f02585e5c`.

Two independent read-only re-reviews found no remaining must-fix after the
runner-identity and database-harness corrections.

## External Boundary

No hosted state was mutated. The exact CLI runner still needs replay in an
authorized disposable linked Supabase staging project with credentials,
including migration-history insertion and idempotent rerun. `OPT-116` also
retains the unapproved catalog write-cost budget. `OPT-119` retains approved
abuse/retention/global-window policy, batch size, scheduler/alert/rollback
ownership, latency/reject/growth budgets, and hosted runner replay. No cleanup
schedule or operational policy was invented.
