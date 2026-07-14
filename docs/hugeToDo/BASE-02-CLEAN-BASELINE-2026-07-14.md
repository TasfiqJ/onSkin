# BASE-02 Clean-Worktree Launch Baseline

- Date: 2026-07-14 (America/Toronto)
- Run completed: 2026-07-14 18:02 EDT
- Work item: `BASE-02`
- Status: baseline-report acceptance met; product launch remains blocked

## Scope and evidence boundary

This is a non-live, non-mutating launch-baseline audit of the exact current
`main` source state requested for `BASE-02`.

| Field                   | Value                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Commit                  | `f392576dbbe7a66a42d86be66942839bd5fccaa4`                                              |
| Commit subject          | `feat: add credential-free Supabase reset gate`                                         |
| Isolated worktree       | `C:\Users\jasim\Desktop\onSkin-base02-clean-baseline`                                   |
| Isolated branch         | `codex/base02-clean-baseline`                                                           |
| Source refs at start    | worktree `HEAD`, local `main`, and `origin/main` all resolved to the exact commit above |
| Original dirty worktree | not modified                                                                            |
| Main delivery worktree  | not modified                                                                            |
| Windows                 | Windows 11 Home                                                                         |
| PowerShell              | 5.1.26100.8655                                                                          |
| Node.js / npm           | v24.14.0 / 11.9.0                                                                       |
| Deno                    | 2.7.5                                                                                   |
| Supabase CLI            | 2.109.1, from the repository lockfile                                                   |
| Git                     | 2.50.1.windows.1                                                                        |

`npm ci` installed the exact `package-lock.json` dependency graph in this
isolated worktree: 1,019 packages were added, the audit reported zero known
vulnerabilities, and `npm ls --depth=0 --json` exited zero. The Supabase CLI's
optional WASM packages appear as extraneous in the human-readable tree even
after a clean install; this did not change the lockfile or tracked source.

No evidence environment variable was set. No generated packet builder was run.
No live Supabase, Apple, RevenueCat, PostHog, EAS, TestFlight, production, or
App Store action was attempted. No credential was read or invented. Android
release evidence remained correctly not applicable under the launch contract.

Before the evidence document and status-reference update, `git status` was
clean after all audit commands. The only intended tracked changes from this
worktree are this report and the `BASE-02` status/reference update.

## BASE-02 acceptance verdict

The `BASE-02` deliverable is a baseline report that records every observed
failure without changing evidence flags. That reporting acceptance is met by
this document. It does **not** mean that the launch sweep passes, that a feature
is production-real, or that any live/device/reviewer/production/store gate is
closed.

## Repository verification

Turbo was forced to bypass its shared worktree cache for the three repository
quality commands.

| Command                                      | Exit | Result                                                               |
| -------------------------------------------- | ---: | -------------------------------------------------------------------- |
| `npm ci`                                     |    0 | 1,019 packages installed; zero vulnerabilities                       |
| `npm ls --depth=0 --json`                    |    0 | root/workspace dependency graph resolved                             |
| `$env:TURBO_FORCE='true'; npm run typecheck` |    0 | 2 of 2 tasks passed; 0 cached                                        |
| `$env:TURBO_FORCE='true'; npm run lint`      |    0 | 2 of 2 tasks passed; 0 cached; mobile ESLint used `--max-warnings=0` |
| `$env:TURBO_FORCE='true'; npm test`          |    0 | 227 test files and 2,430 tests passed; 0 failed; 0 cached            |

The tests emitted expected development-fixture warnings that Supabase URL and
publishable-key values were absent. The relevant tests passed because they
verify the fail-closed placeholder behavior; the warnings are not live
Supabase evidence.

## Documentation, identity, and baseline audits

| Command                                            | Exit | Result                                                                          |
| -------------------------------------------------- | ---: | ------------------------------------------------------------------------------- |
| `npm run launch:contract:check`                    |    0 | valid iOS-only all-features contract; 20 features and 14 Phase 7/8 surface keys |
| `npm run launch:contract:smoke`                    |    0 | contract smoke passed                                                           |
| `npm run launch:execution-baseline:check`          |    0 | 202 plan items, 20 features, and all grouped gated surfaces validated           |
| `npm run launch:execution-baseline:smoke`          |    0 | omission, addition, duplicate, feature, and surface guards passed               |
| `npm run docs:source-packet-audit:check`           |    1 | four failures; see below                                                        |
| `npm run docs:tas-todo-audit:check`                |    0 | founder touchpoint audit current                                                |
| `npm run docs:readiness-status-audit:check`        |    1 | three failures; see below                                                       |
| `npm run brand:audit:strict`                       |    1 | 0 public-launch-risk findings, but 22 review-needed references remain           |
| `npm run docs:device-support-policy-audit:check`   |    1 | two stale generated outputs                                                     |
| `npm run docs:performance-readiness-audit:check`   |    0 | audit contract current; this is not physical-device performance evidence        |
| `npm run docs:generated-packet-status-audit:check` |    1 | 170 stale-reference failures across 16 generated artifacts                      |
| `npm run e2e:human:manifest:check`                 |    1 | manifest predates 61 committed source/evidence paths                            |

### Source-packet audit failures

All four reported failures:

1. `docs/generated/source-packet-audit.json` is stale.
2. `docs/generated/source-packet-audit.md` is stale.
3. `docs/ARCHITECTURE.md` differs from
   `04_repo_docs/docs/ARCHITECTURE.md` (58 insertions and 24 deletions in the
   active file relative to the mirror).
4. `docs/DECISIONS.md` differs from `04_repo_docs/docs/DECISIONS.md` (12
   insertions and 3 deletions in the active file relative to the mirror).

The audit did not rewrite either source. The active documents contain newer
account-deletion/publication-fence decisions, so a reviewed source-of-truth
reconciliation is required rather than a blind overwrite.

### Readiness-status audit failures

All three reported failures:

1. `docs/generated/readiness-status-audit.json` is stale.
2. `docs/generated/readiness-status-audit.md` is stale.
3. The readiness contract expects 211 mobile test files while this clean run
   found 227.

The test-count constant and source-of-truth claims must be updated only after
the new count and current source set are intentionally accepted.
`LAUNCH_READINESS.md` and `BLOCKERS.md` still contain retained 211-file / 2,262
test baseline claims; those claims are stale for this exact commit's clean run.

### Strict brand-audit failures

Strict mode found zero public-launch-risk references and 22 review-needed
lowercase legacy identity/domain-separation strings. Every reported reference
is listed here:

1. `supabase/functions/account-deletion/durableDeletionCore.ts:6`
2. `supabase/functions/account-deletion/durableDeletionCore.ts:7`
3. `supabase/functions/account-deletion/durableDeletionCrypto.ts:8`
4. `supabase/functions/account-deletion/durableDeletionRuntimeCore.ts:10`
5. `supabase/functions/account-deletion/durableDeletionRuntimeCore.ts:12`
6. `supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts:251`
7. `supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts:272`
8. `supabase/functions/_shared/revenueCatIdentityTombstone.ts:4`
9. `supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql:227`
10. `supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql:263`
11. `supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql:280`
12. `supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql:295`
13. `supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql:312`
14. `supabase/migrations/20260713000051_revenuecat_identity_tombstones.sql:51`
15. `supabase/migrations/20260713000052_account_publication_fence.sql:256`
16. `scripts/phase9/account-publication-fence-postgres-rehearsal.sql:120`
17. `scripts/phase9/account-publication-fence-postgres-rehearsal.sql:144`
18. `scripts/phase9/live-data-rights.mjs:767`
19. `scripts/phase9/revenuecat-deletion-barrier-postgres-rehearsal.sql:83`
20. `scripts/phase9/revenuecat-identity-tombstones-postgres-rehearsal.sql:109`
21. `scripts/phase9/revenuecat-identity-tombstones-postgres-rehearsal.sql:123`
22. `scripts/phase9/service-writer-deletion-barriers-postgres-rehearsal.sql:97`

These strings participate in cryptographic/domain-separation or migration
compatibility contracts. They require an explicit reviewed classification or
versioned migration; they must not be mechanically renamed merely to make the
audit green.

`LAUNCH_READINESS.md` and `BLOCKERS.md` also retain statements that strict
brand audit passed with zero review-needed references. The exact clean run
above supersedes those statements for this commit: strict mode is red until
the 22 references are reviewed and intentionally classified or migrated.

### Device-support-policy audit failures

Both reported failures:

1. `docs/generated/device-support-policy-audit.json` is stale.
2. `docs/generated/device-support-policy-audit.md` is stale.

The underlying local device-support contract check did not report a source
policy contradiction. No physical-iPhone conclusion follows from that fact.

### Generated-packet-status audit failures

The command reported 170 stale-hash/output failures across these 16 artifacts:

1. `docs/generated/generated-packet-status-audit.json`
2. `docs/generated/generated-packet-status-audit.md`
3. `docs/phase-3/generated/review-operator-queue.json`
4. `docs/phase-3/generated/review-packet-manifest.json`
5. `docs/phase-3/generated/review-worklist.json`
6. `docs/phase-4/generated/beta-coverage-report.json`
7. `docs/phase-4/generated/catalog-qa-report.json`
8. `docs/phase-4/generated/source-worklist.json`
9. `docs/phase-5/generated/device-qa-packet.json`
10. `docs/phase-6/generated/payments-qa-packet.json`
11. `docs/phase-7/generated/core-loop-qa-packet.json`
12. `docs/phase-8/generated/growth-store-qa-packet.json`
13. `docs/phase-9/generated/release-engineering-qa-packet.json`
14. `docs/phase-10/generated/closed-beta-packet.json`
15. `docs/phase-10/generated/support-handoff-packet.json`
16. `docs/phase-11/generated/public-launch-packet.json`

The individual failures are stale source hashes or stale generated audit
outputs, not proof that the referenced source is wrong. Packet builders were
intentionally not run during this non-mutating audit. Refresh must occur in the
documented dependency order after the current source set is coherent, followed
by the strict generated-packet audit.

### Human-E2E manifest failure

The checked-in human-E2E manifest predates these 61 committed paths:

- `.github/workflows/quality.yml`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/hugeToDo/DB-01-11-GAP-MATRIX-2026-07-13.md`
- `docs/hugeToDo/DB-05-LOCAL-RESET-2026-07-14.md`
- `docs/hugeToDo/DURABLE_ACCOUNT_DELETION_RESEARCH_2026-07-13.md`
- `docs/hugeToDo/README.md`
- `docs/hugeToDo/execution-status.json`
- `docs/hugeToDo/feature-inventory.json`
- `docs/phase-2-production-infrastructure-runbook.md`
- `docs/phase-9/account-deletion-operations-runbook.md`
- `docs/phase-9/data-inventory.md`
- `docs/phase-9/incident-response-plan.md`
- `docs/phase-9/rollout-rollback-plan.md`
- `docs/phase-9/source-of-truth.md`
- `package-lock.json`
- `package.json`
- `scripts/launch/execution-baseline-smoke.mjs`
- `scripts/launch/execution-baseline.mjs`
- `scripts/phase2/local-supabase-contract.mjs`
- `scripts/phase2/local-supabase-reset.mjs`
- `scripts/phase2/local-supabase-signal-cleanup.mjs`
- `scripts/phase2/local-supabase-signal-cleanup.test.mjs`
- `scripts/phase2/local-supabase-target-guard.mjs`
- `scripts/phase2/local-supabase-target-guard.test.mjs`
- `scripts/phase9/account-deletion-lifecycle-postgres-rehearsal.sql`
- `scripts/phase9/account-deletion-work-lane-smoke.mjs`
- `scripts/phase9/account-publication-fence-postgres-rehearsal.sql`
- `scripts/phase9/build-release-qa-packet.mjs`
- `scripts/phase9/data-rights-smoke.mjs`
- `scripts/phase9/edge-auth-smoke.mjs`
- `scripts/phase9/lib.mjs`
- `scripts/phase9/live-supabase-adversarial.mjs`
- `scripts/phase9/release-smoke.mjs`
- `scripts/phase9/rls-adversarial-smoke.mjs`
- `scripts/phase9/rls-adversarial.mjs`
- `scripts/phase9/supabase-policy-lint.mjs`
- `supabase/README.md`
- `supabase/config.toml`
- `supabase/functions/_shared/fetch.test.ts`
- `supabase/functions/_shared/fetch.ts`
- `supabase/functions/account-deletion/deletionProviderNetwork.test.ts`
- `supabase/functions/account-deletion/deletionProviderNetwork.ts`
- `supabase/functions/account-deletion/durableDeletionDatabaseGateway.test.ts`
- `supabase/functions/account-deletion/durableDeletionDatabaseGateway.ts`
- `supabase/functions/account-deletion/durableDeletionHttpHandler.test.ts`
- `supabase/functions/account-deletion/durableDeletionHttpHandler.ts`
- `supabase/functions/account-deletion/durableDeletionRuntime.test.ts`
- `supabase/functions/account-deletion/durableDeletionRuntime.ts`
- `supabase/functions/account-deletion/durableDeletionRuntimeCore.test.ts`
- `supabase/functions/account-deletion/durableDeletionRuntimeCore.ts`
- `supabase/functions/account-deletion/durableDeletionWorker.test.ts`
- `supabase/functions/account-deletion/durableDeletionWorker.ts`
- `supabase/functions/account-deletion/durableProviderDeletion.ts`
- `supabase/functions/account-deletion/revenueCatV2DeletionExecutor.test.ts`
- `supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts`
- `supabase/migrations/20260616000028_phase8_growth.sql`
- `supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql`
- `supabase/migrations/20260713000052_account_publication_fence.sql`
- `supabase/ops/account-deletion-work-lane.sql`
- `supabase/tests/database/schema_contract.test.sql`

The manifest must be regenerated after relevant human-simulated flows are
rerun or explicitly reclassified. Regeneration alone is not fresh UI evidence.

## Remaining non-live launch-sweep checks

The checks below were run individually so a failure early in `launch:verify`
could not hide later code-gate results.

| Command                                              | Exit | Result                                                                   |
| ---------------------------------------------------- | ---: | ------------------------------------------------------------------------ |
| `npm run phase3:review-signoff-template:smoke`       |    0 | 8 fail-closed template/operator checks passed                            |
| `npm run phase5:performance-evidence:template:check` |    0 | template current                                                         |
| `npm run phase5:check-native-config`                 |    0 | baseline source present; 6 warnings and 1 Android N/A; launch blocked    |
| `npm run phase5:performance-evidence`                |    0 | warning: no supported-device evidence path; externally blocked           |
| `npm run phase7:check-core-loop`                     |    0 | code gates present; 36 warnings; strict launch blocked                   |
| `npm run phase8:check-growth-store`                  |    0 | code gates present; 16 warnings and 1 Android N/A; strict launch blocked |
| `npm run phase9:release-smoke`                       |    0 | code gates passed; 33 warnings and 1 Android N/A; strict release blocked |
| `npm run phase9:rls-adversarial-smoke`               |    0 | 10 contract checks passed                                                |
| `npm run phase9:rls-adversarial`                     |    0 | code gates passed; staging and production live evidence absent           |
| `npm run phase9:supabase-policy-lint`                |    0 | source policy lint passed                                                |
| `npm run phase9:data-rights-smoke`                   |    0 | code gates passed; live export/delete evidence absent                    |
| `npm run phase9:data-export-contract-smoke`          |    0 | 13 Deno tests passed                                                     |
| `npm run phase9:account-provider-deletion-smoke`     |    0 | 12 Deno tests passed                                                     |
| `npm run phase9:account-service-scrub-smoke`         |    0 | 5 Deno tests passed                                                      |
| `npm run phase9:account-deletion-durable-smoke`      |    0 | 215 Deno tests passed                                                    |
| `npm run phase9:account-deletion-work-lane-smoke`    |    0 | durable work-lane smoke passed                                           |
| `npm run phase9:order-attribution-integrity-smoke`   |    0 | 12 Deno tests passed                                                     |
| `npm run phase10:beta-readiness`                     |    0 | code gates passed; 23 warnings and 1 Android N/A; beta blocked           |
| `npm run phase10:beta-analytics-audit`               |    0 | code gates passed; dashboard and privacy evidence absent                 |
| `npm run phase11:launch-readiness`                   |    0 | code gates passed; 27 warnings and 1 Android N/A; launch blocked         |
| `npm run phase11:ring-gates`                         |    0 | code gates passed; 14 warnings and 1 Android N/A; launch rings blocked   |

### Exact blocked evidence groups

The non-strict commands intentionally return zero when code contracts are
present, while warnings preserve the actual release boundary. They must not be
reported as launch passes.

- Phase 5 native: native OCR is disabled in development, staging, and
  production; production lacks final identity values
  (`BRAND_LEGAL_CLEARANCE`, `APP_DISPLAY_NAME`, `APP_SLUG`, `APP_SCHEME`,
  `APP_IOS_BUNDLE_IDENTIFIER`), `PHASE3_RELEASE_CLEARANCE=cleared`, and reviewed
  export classification/clearance. Physical-device performance evidence is
  absent because `PHASE5_PERFORMANCE_EVIDENCE_PATH` is unset.
- Phase 7: final domain and six policy/support/export URLs are absent; six
  consent/privacy copy surfaces remain placeholders; starter conflict and
  recommendation records remain unreviewed. All Phase 7 external evidence
  flags and the named signoff are absent: brand, Supabase RLS, clinical review,
  catalog beta import, device QA, RevenueCat QA, privacy export/delete, beta
  dashboard, onboarding consent, shelf intake, reviewed guidance, routine
  builder, Today check-off, photo privacy, reminders, payment lifecycle,
  privacy controls, share card, deferred-surface, analytics, and
  `PHASE7_SIGNED_OFF_BY`.
- Phase 8: final domain, marketing URL, support email, App Store URL, Apple Team
  ID/AASA evidence, and every Phase 8 evidence/signoff value are absent: brand
  source, DNS, iOS Universal Links, share-card device QA, attribution privacy,
  App Store packet, creator compliance, support response, launch dashboard, dry
  run, and `PHASE8_SIGNED_OFF_BY`.
- Phase 9: ten production public identity/policy/store values are absent. The
  live Supabase check was not requested and all Phase 9 release evidence is
  absent: final identity, live Supabase, staging/production RLS, Edge auth,
  public forms, catalog rate limit, order polling, export/delete, consent
  withdrawal, observability payload, RevenueCat webhook/native QA, iOS
  TestFlight/privacy report, App Store packet, device QA, rollback, incident
  response, dependency audit, beta evidence, and named signoff.
- Phase 10: the Phase 9 generated packet is blocked; nine final beta
  identity/policy values are absent; candidate, identity, TestFlight,
  recruiting, beta terms, dashboards, support desk, privacy payload, payment
  QA, catalog beta, retention, launch decision, and named signoff are absent.
- Phase 11: the Phase 10 generated packet and go/limited decision are absent;
  ten final public values are absent; Phase 10 exit, Phase 9 RC signoff, store
  approval, production environment, RevenueCat production, monitoring,
  support, incident/rollback, Ring 0, Ring 1 72-hour report, ASO, creator
  disclosure, revenue reconciliation, week-one decision, and named signoff are
  absent.

These remain work-item or external evidence gates. This audit did not set any
of their environment flags.

## Composite launch sweep

`npm run launch:verify` exited 1. It passed the launch contract and execution
baseline checks, then stopped at `docs:source-packet-audit:check` with the four
source-packet failures recorded above. Because the command is joined with
`&&`, this composite result alone does not describe later gates; the individual
runs in this report provide that missing coverage.

## Remaining blockers and next actions

1. Reconcile the active architecture/decision docs with their strategy mirrors
   and regenerate the source-packet audit.
2. Reconcile the clean 227-file test count with the readiness contract and
   regenerate readiness outputs.
3. Classify the 22 brand references under a reviewed compatibility/migration
   decision; do not rename cryptographic domains or historical migrations
   blindly.
4. Refresh generated Phase 3-11 packets in dependency order only after their
   source set is coherent, then rerun the strict packet-status audit.
5. Rerun or reclassify the affected human UI flows and regenerate the human-E2E
   manifest without treating regeneration as interaction evidence.
6. Close the listed live service, physical-iPhone, professional-review,
   production, beta, operational, App Store, and founder-authorization gates
   with genuine retained evidence.
7. Rerun this clean baseline after those coherent checkpoints. Until then,
   `launch:verify` is red and the app is not launch-ready.
