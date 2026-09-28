# DB-12 Production Database Release Procedure — Source-Only Draft

Status: **NOT APPROVED FOR EXECUTION**. This is the proposed source-only _shape_ of
the production procedure, not an executed release, peer-review signoff,
production deployment tool, backup, restore drill, or DB-12 completion record.
The current 91-migration chain through `0075` has not passed the current DB-05
full replay and DB-06 staging deployment. DB-11 hosted advisor, backup/restore,
RPO/RTO, resource, and load evidence is absent. No production Supabase project,
target-bound approval, or production mutation is authorized by this file.

## 1. Scope and non-negotiable boundary

This procedure governs both the first deployment to an **independently verified
empty** production project and every later incremental database release to a
non-empty production project. These are different execution modes. The
existing `scripts/phase2/deploy-supabase-staging.ps1` is fresh-staging-only;
changing its environment variables, copying it, or removing its guards does
not create a production procedure. There is currently no source-controlled
production deployment runner. Until one is implemented, tested, peer reviewed,
and bound to an exact approved target, the execution instruction is **STOP**.

All schema, grants, policies, functions, triggers, indexes, backfills, and
rollback/roll-forward changes must originate from versioned, reviewed source
in `supabase/migrations/` or a separately reviewed, source-controlled
operations script. Never make production schema changes in the Supabase SQL
Editor/Table Editor, run ad hoc SQL, edit migration history, invoke `migration
repair` to hide drift, run `db reset --linked`, include development seed data,
or run an unreviewed direct CLI `db push`. A dashboard may be used for a
provider-only setting or read-only evidence where no source-controlled API
exists; it is not a substitute for database migration history.

This document does not change the DB-06 traffic freeze, the Phase 9 deletion,
Apple, or health-consent cutover orders, or the store-only client-delivery
policy. A production migration may not weaken owner-scoped RLS, account
deletion/tombstones, consent withdrawal, payment truth, catalog publication,
or exact-session admission. The separate feature runbooks govern those
specialized transitions and must be attached to the release packet.

## 2. Gates before a release can even be scheduled

The release owner records a **no-go** if any row is missing, expired, from a
different source SHA, or merely historical local evidence.

| Gate                | Required evidence, bound to this candidate                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity and target | Final brand/account/region decision; distinct staging and production projects; authorized account owner; exact full production project ref and independent fingerprint verified by two operators, with raw ref kept out of public logs.                                                                                                                                                                            |
| Source              | Fetched clean `origin/main` candidate SHA, reviewed PR/commit, exact ordered migration IDs and Git blob/SHA-256 digests, target starting migration head and schema inventory, function-manifest/config/source digests, pinned toolchain and lockfile, mobile build compatibility matrix. Never rebuild deployment inputs from a mutable working tree.                                                              |
| Local               | Current complete DB-05 replay with migration history, pgTAP, lint, empty shadow drift, and checked-in/raw generated-type parity. Historical 71-migration/`0072` evidence is insufficient for the 91-migration/`0075` head.                                                                                                                                                                                         |
| Hosted staging      | Passing DB-06 packet on the exact chain, then DB-07 through DB-10 live auth/RLS/privacy/provider matrices and current generated types. Staging function/config and migration hashes must match this candidate; a DB-06 `pass` alone never unfreezes or signs off staging.                                                                                                                                          |
| DB-11 recovery      | Current Security/Performance Advisor exports and resolutions, TLS/network posture, alert/resource/spend/load ownership, approved quantitative RPO/RTO, recovery point and retention, a tested restore with elapsed time and integrity check, and coverage for Storage bytes, Edge/Auth/Vault/Cron/provider configuration and secrets.                                                                              |
| Change control      | Named release operator, independent technical reviewer, security/privacy reviewer for affected data, recovery owner, incident commander, support owner, and founder/authorized business owner for DB-13 production creation/release. Record exact approval IDs, UTC validity window, change lock, maintenance/traffic plan, rollback decision authority, and contact/coverage. Role labels alone are not signoffs. |

The free Supabase tier has no automatic daily backups or PITR. A free-tier
production plan must therefore demonstrate a separately secured, restorable
logical backup and Storage-object recovery path that **actually meets the
approved RPO/RTO**; otherwise this gate fails. Upgrading to a paid plan/PITR is
one possible choice, not assumed or silently authorized. Supabase database
backups do not restore Storage object bytes. A recent backup listing or a
successful `db dump` command without an isolated restore drill is not enough.
Never retain backup contents, credentials, raw user data, or project identifiers
in Git or a public CI artifact.

## 3. Release design: expand, migrate, contract

Design a separate release unit and acceptance/abort criteria for each phase.
Do not apply all three in one unattended production push.

1. **Expand:** Add compatible columns/tables/indexes/RPCs and dual-read or
   dual-write support without removing behavior used by any supported binary,
   old Edge function, scheduled worker, provider callback, or in-flight job.
   Classify lock level, table size, long transactions, rewrite risk, concurrent
   index requirements, and estimated duration. Use bounded lock/statement
   timeouts and separately reviewed nontransactional operations where needed;
   `CREATE INDEX CONCURRENTLY` cannot run in a PostgreSQL transaction block.
   Predeploy a fail-closed compatible handler only when the feature cutover
   runbook requires it. Keep ingress/feature gates closed until live canaries
   and owner-isolation checks pass.
2. **Migrate:** Backfill in small, resumable, idempotent batches with explicit
   cursor/checkpoint, row-count and error budgets, rate/load ceilings, and
   pause/resume behavior. Do not infer success from a command exit alone:
   compare source/target counts, invariants, checksums where suitable, and
   owner/consent/payment/deletion semantics. If data changes cross a provider
   boundary, reconcile RevenueCat/Apple or other external truth separately.
   Never log health, photo, auth, payment, or private row payloads.
3. **Contract:** Only after the expanded path and backfill have been proven in
   staging and production, telemetry is stable for the predeclared observation
   window, and **every still-supported store binary, Edge version, worker,
   callback, and queued request is compatible**, submit a new reviewed
   migration to remove legacy readers/writers/columns. Old App Store binaries
   can persist; absence of recent traffic is not proof of absence. Establish
   an enforceable mandatory-version fence or preserve compatibility. A
   destructive contract is never the default rollback of an expand failure.

Migration-specific cutover files must name old/new read/write authorities,
side-effect order, frozen ingress, 0-row/old-client checks, feature flags,
verification queries, and an exact roll-forward plan. `0048`-`0052` deletion,
`0054` health consent, `0055` Apple lifecycle, payments, catalog curation,
and recommendation/commerce authority require their own source runbooks; none
may be generalized away by this template.

## 4. Candidate and preflight record

Create a redacted, access-controlled release packet **outside the worktree**.
The packet schema and validator must be source-controlled before a production
runner exists. Bind every retained proof to the same immutable candidate SHA,
target fingerprint, mode (`empty-first-deploy` or `incremental`), and UTC
change window. At minimum record:

- Starting production migration ID list, ordered pending IDs, exact source
  digests, and a read-only schema/function/Auth/Storage/Cron/Vault inventory.
  Migration IDs alone do not prove deployed SQL bytes equal Git source.
- `supabase db push --dry-run`-equivalent pending plan from the **pinned CLI**
  and immutable snapshot, independently compared with the approved list. This
  is a read-only planning step, not permission to run `db push` interactively.
- The DB-11 backup/restore drill ID, verified pre-change recovery point,
  observed RPO/RTO, off-site retention owner, Storage-object backup/restore
  method, and whether PITR is actually enabled. Record recovery dependencies
  for Auth, keys, Vault, Edge, Cron, webhooks, and provider reconciliation.
- Before counts and redacted query results for RLS tables/policies, grants,
  active sessions/cohorts, deletion operations/barriers, subscriptions,
  catalog/consent authorities, jobs, queues, Storage, and relevant indexes.
- Approved baseline and abort thresholds for errors, lock waits, latency,
  resource use, spend, queue age, failed Auth, provider retries, RLS denials,
  privacy rights, and critical user flows. Name who watches each live signal.
- Production ingress/maintenance controls and provider callback/retry state.
  A fresh empty production project must have zero users, migration IDs,
  functions, public objects, Storage objects, and Cron jobs before any first
  mutation; an incremental release must **not** expect an empty project.

If remote history is ahead of source, contains unknown IDs, differs in
reviewed checksums/schema, or contains migration `0059` with unverified old
bytes, stop for forensic reconciliation. Do not use `migration repair`, a
replayed `db push`, or a later compensating migration as an automatic fix.
Production project ref, database URL, service key, and access token must never
appear in the packet or console transcript; use restricted, non-secret target
fingerprints and bounded logs.

## 5. Execution protocol once a production runner is built and approved

There is **no executable production command in this repository today**. The
future source-controlled runner/CI job must implement all of the following,
with tests that prove missing evidence and a staging ref fail **before linking
or remote mutation**:

1. Re-fetch and compare `origin/main` to the approved SHA; require a clean
   immutable export, exact dependency/CLI version, approved change window,
   signed candidate and target records, and exclusive release lock. Recheck
   two-person production target confirmation in a separate protected secret
   boundary. Never accept `APP_ENV=staging` or silently default environment.
2. Read current remote state and backup freshness; revalidate the exact
   pending migration list and input hashes immediately before first mutation.
   Check time remaining for the worst-case bounded run plus recovery hold.
   Reapply the ingress/feature freeze and verify it by live negative canary,
   including public/JWT-disabled Edge paths, Auth, callbacks, schedules, and
   still-distributed clients as relevant. Keep existing user access available
   only where the phase-specific compatibility plan proves it safe.
3. Deploy only the versioned, compatibility-ordered migrations/functions/
   source-controlled operations approved for **this phase**, serially and
   once. Never use `--include-seed`, `--include-all` to swallow unexplained
   history, `--db-url` targeting an unverified database, or a dashboard SQL
   mutation. A CI job must not automatically deploy to production merely
   because `main` changed; it needs this release packet and explicit gate.
4. After each migration or bounded batch, independently read back applied
   history and schema, exact function code/config/JWT posture, RLS/grants,
   advisor findings, locks, errors, data invariants, owner isolation, and
   privacy/payment/account-deletion canaries. Compare generated linked types
   with the reviewed source artifact without overwriting repository types.
   Run the full relevant DB-07 through DB-11 and phase-specific live matrices
   before opening ingress or advancing to the next phase.
5. Keep freeze/kill switches closed on interruption, timeout, missing output,
   uncertain process-tree containment, or inconclusive readback. Mark state
   `remote-state-unknown`, preserve the recovery fingerprint, and escalate to
   the named recovery owner. A green CI step is not enough if the hosted state
   or evidence packet is incomplete. Unfreeze/release only through a separate
   recorded go decision after monitoring and support are staffed.

The release packet retains the exact before/immediate-pre-change/after
inventories, migration plan and results, immutable source and tool hashes,
function readback, redacted logs, canaries, monitoring, incident/recovery
decisions, approver IDs, and signed final go/hold disposition. Retention and
access controls follow the privacy/security review; no raw secrets or user
rows are placed in source or general CI artifacts.

## 6. Failure and recovery decision table

| State                                       | Immediate action                                                                                                         | Permitted recovery                                                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-mutation gate fails                     | Do not link/apply; keep freeze; fix source/evidence and start a new approved candidate.                                  | No database rollback needed; no release claim.                                                                                                                                                                        |
| Expand/handler failed or timed out          | Stop further migrations, contain ingress/side effects, read back live state; treat interruption as remote-state-unknown. | Prefer reviewed compatible forward fix from new migration/function source. Do not assume a failed SQL file was atomic, particularly for concurrent indexes.                                                           |
| Backfill partial                            | Pause worker, retain cursor and original rows, verify invariants and provider state.                                     | Resume idempotently after new review; compensate only with source-controlled, tested transformations.                                                                                                                 |
| Contract incompatible with supported client | Halt rollout and keep feature closed; preserve evidence and client compatibility.                                        | New additive forward migration, compatible server build, or store-binary hotfix. Never restore a dropped authority without proving deletion/consent/payment isolation.                                                |
| Corruption or unrecoverable data loss       | Declare incident; freeze writes/providers; record exact last good point and current divergent side effects.              | Recovery owner may authorize the _tested_ restore path only after explicit data-loss/RPO/RTO, Storage, Auth/Vault/Cron, provider, and user-notification assessment. A database restore is not a one-command rollback. |

Never reverse deletion barriers/tombstones, re-admit withdrawn consent,
recreate erased private data, grant an unverified entitlement, silently
reopen old catalog/commerce authority, or recover by deploying an old mobile
binary through unavailable OTA. Database restore can invalidate newer Auth
state, Storage metadata, payment/webhook events, and deletion requests; the
reconciliation and legal/privacy decision is part of the incident, not an
afterthought.

## 7. DB-12 review and DB-13 handoff

DB-12 remains `in_progress` until independent peer review of this procedure,
an implemented fail-closed production runner and tests, successful staging
rehearsal for **both empty-first-deploy and non-empty incremental modes**,
DB-11 recovery evidence, and a target-bound approval packet exist. DB-13 is a
separate authorized hosted deployment and live release matrix. Source-only
tests or this document cannot mark either item complete.

The handoff must include signed owner/approver identities, exact approved SHA
and target, non-secret evidence locations, current backup recovery point,
measured RPO/RTO, migration/function/type inventory, old-client compatibility,
phase-specific cutover and forward-repair plans, live monitoring owners,
go/no-go decision, and post-release watch schedule. A second independent
reviewer must confirm that no production schema step requires a dashboard-only
mutation.

## Official design references

- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations): remote schema changes belong in migration files; direct production dashboard edits bypass history.
- [Supabase managing environments](https://supabase.com/docs/guides/deployment/managing-environments): separate staging/production projects and CI/CD release practice.
- [Supabase CLI `db push` reference](https://supabase.com/docs/reference/cli/supabase-db-schema-declarative): dry-run lists pending migrations; the command is not a target/approval control by itself.
- [Supabase backup and restore](https://supabase.com/docs/guides/platform/backups): free-tier backup limitation, PITR/restore behavior, and Storage-object exclusion.
- [Supabase advisors](https://supabase.com/docs/guides/database/database-advisors): security/performance lint evidence is a separate hosted gate.
- [PostgreSQL `CREATE INDEX`](https://www.postgresql.org/docs/current/sql-createindex.html): concurrent builds and transaction restrictions require phase-specific review.

These sources inform engineering controls; they do not guarantee recovery,
legal compliance, App Store acceptance, or profitability.
