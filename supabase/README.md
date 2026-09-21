# Supabase - schema, RLS, and Edge Functions

Source of truth: `docs/01-auth-onboarding.md`, `BLOCKERS.md`, and
`docs/phase-2-production-infrastructure-runbook.md`. Sign in with Apple
deployment and operations are governed by
`docs/phase-9/apple-auth-lifecycle-operations-runbook.md`.

## Migrations

The migrations define the app's owner-scoped profile, health profile, shelf,
routine, photo, entitlement, consent, notification, intelligence, commerce,
community, trend, Ask, and Phase 4 catalog tables. Data that affects health
guidance remains launch-blocked until clinical review, source/legal review,
catalog seeding, and import QA clear.

## RLS Invariants

- RLS stays enabled on every private/public user table.
- Owner policies use `(select auth.uid())` and `with check` on writes.
- Cross-table ownership checks use `security definer` helpers with empty
  `search_path`.
- Client roles do not write entitlement mirrors or raw subscription event logs.
- Append-only ledgers remain append-only.

## Credential-Free Local Reset (DB-05)

The repository pins Supabase CLI `2.117.0` as an exact development dependency
for a current-chain local replay trial; a full clean replay with this version
has not yet passed.
Use the checked-in scripts instead of a global or floating CLI:

```powershell
npm ci
npm run phase2:db-local-contract
npm run phase2:db-local-reset
npm run phase2:db-local-verify
npm run phase2:db-types:update
npm run phase2:db-types:check
```

`phase2:db-local-verify` copies `supabase/` to a uniquely named temporary
workdir, excludes `.temp`, `.branches`, every `.env` variant, inherited hosted
credentials, and every linked-project input, allocates an isolated local port
block, and uses explicit
`--local` targets. It starts the Auth/Storage-aware Docker stack, resets all 91
migrations through `20260921000075_skin_profile_quiz_contract_successor.sql` plus `seed.sql`
twice, verifies exact migration history, runs the
structural pgTAP suite and database lint, requires an empty local-vs-migrations
schema diff, generates canonical database types in the temporary workdir,
requires exact repository parity, then removes the containers, volumes, and
temporary files. It never links, pushes, or accepts a database URL.

`phase2:db-types:update` performs the same credential-free isolated replay and
atomically replaces `packages/types/src/database.types.ts` only after generated
shape and hash validation. `phase2:db-types:check` performs the isolated replay
without replacing the repository file and fails on any mismatch. At historical
clean commit `e5588ae69`, the full `phase2:db-local-verify` gate exited 0 in
2,200.4 seconds across the then-current 71-migration/`0072` chain. That
historical local and repository artifact is 6,770 lines with SHA-256
`2c14252f882294d2ca42832405fb0fe157f855a85a9d3fc5d47999457be9b1d3`.
It does not prove the current 91-migration/`0075` chain or current generated-type
parity.

That raw generated file describes schema shape, not publishable-key authority.
The mobile client separately imports the reviewed capability overlay from
`packages/types/src/client-database.types.ts`, which narrows exposed tables,
RPCs, and direct-write shapes without hand-editing the generated artifact.
PostgreSQL grants and RLS remain the runtime security boundary.

DB-08 remains `in_progress`: a reviewed hosted run must still prove exact
repository/local/linked type parity and retain the linked artifact. No linked
type artifact or hosted DB-06 packet exists yet.

The empty diff proves only that a freshly replayed local schema matches the
repository migration shadow. It does not compare, mutate, or attest hosted
staging/production schemas, migration checksums, or migration history. The
historical SQL repairs made for deterministic fresh replay likewise make no
claim about an already-hosted project. DB-06 remains the reviewed hosted
reconciliation/deployment gate. The reproducible 2026-07-14 local evidence is
recorded in
[`docs/hugeToDo/DB-05-LOCAL-RESET-2026-07-14.md`](../docs/hugeToDo/DB-05-LOCAL-RESET-2026-07-14.md).

Supabase's local CLI config reference does not define a leaked-password
protection field, so `config.toml` intentionally contains no
`enable_leaked_password_protection` setting. This does not relax the hosted
security gate: staging and production must enable Auth's
`password_hibp_enabled` control through the dashboard or Management API on a
supported plan, and retain redacted configuration evidence before launch.

Official references reviewed for this gate:

- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/guides/local-development/cli/config
- https://supabase.com/docs/guides/local-development/testing/overview
- https://supabase.com/docs/guides/local-development/cli/testing-and-linting
- https://supabase.com/docs/guides/deployment/ci/testing
- https://supabase.com/docs/reference/cli/supabase-projects-create
- https://supabase.com/docs/guides/auth/password-security
- https://supabase.com/docs/reference/api/management
- https://github.com/supabase/cli

## Applying To Staging

```powershell
npm run phase2:check-env:strict
.\scripts\phase2\deploy-supabase-staging.ps1
npm run phase2:rls-smoke
```

The DB-06 wrapper is fresh-staging-only; it is not an incremental or production
deployment path. It requires a clean fetched `origin/main`, exports and verifies
an immutable Git snapshot, and refuses any pre-existing public object, migration
ID, deployed function, Auth cohort, Storage bucket/object, or Cron job. It
deploys the complete migration and default-function inventory from that
snapshot. The historical 2026-07-15 source checkpoint covered 54 migrations
through `0055` and 16 default functions; it is not current hosted evidence.
The current source inventory is 91 migrations through `0075` and 17 default
functions. The wrapper blocks before linking until current-chain local replay
and generated-type parity are proven; no current hosted deployment is claimed.
Before linking, the current wrapper requires repository/local canonical type
parity. After deployment, it requires repository/local/linked hash parity,
retains `database.types.linked.ts`, and does **not** replace the repository type
file.

Before execution, prepare the main cutover attestation, one
`traffic-provider-freeze.json`, and five schema-v2 zero-cohort boundary files as
documented in
`docs/hugeToDo/DB-06-STAGING-DEPLOYMENT-SOURCE-CHECKPOINT-2026-07-15.md`.
Observations must be no more than 30 minutes old at the initial pre-mutation
gate. Both cutover `validUntil` and the covering freeze `holdUntil` must have at
least 12 hours remaining before the first mutation and seven hours immediately
before migration push; the freeze spans at most 24 hours and retains at least
one hour at completion. It records closed staging client/key distribution, Auth
signup and every
reviewed provider/hook/integration, provider callbacks/retries, Apple
notifications, schedules, and Edge ingress. Retained traffic references accept
only approved-prefix local non-secret ticket/artifact IDs; URLs, email-like
values, and provider/account/project identifiers fail closed.

The wrapper sets `DB06_TRAFFIC_FREEZE=frozen`, and every one of the 17 Edge
entrypoints checks the shared freeze guard before request business logic. The
exact eight `verifyJwt: false` functions must return HTTP `503`, exact
`DB06_STAGING_TRAFFIC_FROZEN`, and `Cache-Control: no-store`. Immediately before
migration push, the runner revalidates cutover bytes and rereads the exact
function inventory, public freeze responses, hosted Auth freeze, migrations,
schema, Storage, and all Cron jobs. A passing packet cannot omit those proofs.
The runner revalidates cutover hashes at completion and never unfreezes the
target; release requires a separately recorded downstream live gate. No hosted
DB-06 run or live acceptance evidence exists yet because ACCT-03 remains open.

The first durable account-deletion cutover is an exception: predeploy the new
fail-closed `account-deletion` function before applying migrations 0048-0051,
then immediately deploy the complete manifest function set from the same
revision. Migration 0052 is a second hard cutover: freeze deletion intake and
every legacy/unfenced session or RevenueCat publication producer, prove zero
active operations/barriers and zero in-flight bypasses, deploy the compatible
Edge/mobile contract, and reopen only after the reviewed canary. Follow
`docs/phase-9/account-deletion-operations-runbook.md`; never run migration 0048
against the old synchronous deletion entrypoint.

Migration 0055 is another coherent auth cutover. It denies ordinary account
access for an Apple-linked user until a fresh native authorization has been
verified, its one-use code exchanged by `apple-auth-lifecycle`, and its refresh
token sealed. Freeze Apple sign-in/publication, configure secrets, deploy the
three Apple functions plus every account-access-fenced authenticated function,
apply the migration through the reviewed path, install the worker, and run the
hosted/device canary before reopening. Existing Apple accounts need a fresh
capture or an enforced compatible-version recovery path; do not backfill a
lifecycle or bypass the access fence manually.

Verified terminal Apple events are also closed before vault capture. The event
RPC can transiently exact-match one Apple Auth identity without persisting the
raw subject. If the signed event predates the Auth identity, it stores only
audience-bound keyed evidence; `begin_apple_auth_capture` reconciles that event
under the owner lock and returns `blocked` before the authorization code is
marked or exchanged. This no-retry recovery path must remain intact during
deployment; duplicate Apple delivery is opportunistic only.

The historical local 0055 gate passed two clean resets, exact 54-migration history,
the full structural pgTAP suite plus 114/114 Apple assertions, database lint,
an empty migration shadow diff, temporary type generation, 20/20 focused
event/lifecycle Edge tests, and the 47-test Apple auth work lane. Hosted
migration history and live service behavior remain separate evidence gates.

## Launch Gate

Run Supabase Security Advisor and Performance Advisor before every release.
Treat disabled RLS, missing policies on private tables, unindexed policy columns,
or failed `phase2:rls-smoke` as launch blockers.

## Edge Functions

`functions/manifest.json` is the deployment inventory and extended governance
source for every Edge Function. `config.toml` is the Supabase CLI source for
each entrypoint and `verify_jwt` value. Run these before a staging deployment:

```powershell
npm run phase9:edge-manifest-check
npm run phase9:edge-manifest-smoke
```

The manifest distinguishes Supabase-user-JWT functions, provider/scheduler
authentication, and truly public rate-limited forms. External provider calls
still require live account secrets and provider verification before launch.

Durable account-deletion work is scheduled separately from request-scoped
`EdgeRuntime.waitUntil`. After the coherent migration/function cutover and
negative-auth checks pass, create the two named Vault values privately and run
`supabase/ops/account-deletion-work-lane.sql`. The checked-in SQL contains no
credential values and stores only Vault lookups in the Cron command. Verify it
with:

```powershell
node scripts/phase9/account-deletion-work-lane-smoke.mjs
```

Durable health-consent withdrawal cleanup uses the same request-independent
pattern with a distinct credential boundary. After deploying the compatible
migration and `health-consent-worker` function, create exactly one active Vault
value for each of `health_consent_worker_secret` and
`health_consent_project_url`, then run
`supabase/ops/health-consent-work-lane.sql`. The worker secret must match the
64-character lowercase-hex `HEALTH_CONSENT_WORKER_SECRET` Edge secret and must
not be reused for account deletion. The checked-in operations SQL contains no
credential values. Verify its one-minute, Vault-backed route with:

```powershell
npm run phase9:health-consent-work-lane-smoke
```

Sign in with Apple uses three separate Edge boundaries:

- `apple-auth-lifecycle` requires a verified Supabase user JWT and serves exact
  native capture/credential-invalidation requests;
- `apple-account-events` has gateway JWT verification disabled only because it
  verifies Apple's signed compact JWS itself; and
- `apple-auth-worker` has gateway JWT verification disabled only for its
  independent constant-time scheduler secret.

After migration 0055 and the compatible functions pass negative-auth probes,
create exactly one active Vault value for each of `apple_auth_project_url` and
`apple_auth_worker_secret`, then run
`supabase/ops/apple-auth-work-lane.sql`. The worker secret must match the
64-character lowercase-hex `APPLE_AUTH_WORKER_SECRET` Edge secret and must not
be reused by either deletion worker. Verify the one-minute Vault-backed lane
with:

```powershell
npm run phase9:apple-auth-work-lane-smoke
```

Register
`https://<reviewed-project-ref>.supabase.co/functions/v1/apple-account-events`
on the intended primary Sign in with Apple App ID only after the deployed
endpoint is ready. Apple permits one absolute endpoint per app grouping/key;
staging and production require intentional identifier isolation or a reviewed
relay. Vault and subject-HMAC keyrings allow up to three overlapping versions.
Every successful daily validation advances the subject digest and freshly seals
the token under the current vault key; dormant, deferred, or failing rows do not
advance from configuration alone. Follow the Phase 9 runbook for rotation,
zero-row/recapture evidence, unresolved terminal-event key-version handling,
monitoring,
containment, and forward-only rollback.

Catalog lookup/search/report functions are Phase 4 infrastructure. They query
only promoted Layerwell catalog rows; no user barcode, search, OCR text, or report
is sent to Open Beauty Facts (OBF). OBF/CosIng candidate data may be transformed
only from separately acquired offline artifacts whose exact SHA-256, source URL,
snapshot date, permitted fields, and review decision are bound by an approval
manifest. The import scripts perform no network I/O. `OBF_API_ENABLED`,
`OBF_USER_AGENT`, and contribution flags have no runtime authority; OBF is not a
recipient and correction reports remain inside Layerwell. Product Opener's
[current API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)
identifies v3 as current and v2 as deprecated, but Layerwell calls neither.
Counsel must classify the exact OBF component and approve any ODbL attribution,
share-alike, or offer-of-data duties before production promotion.
