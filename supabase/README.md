# Supabase - schema, RLS, and Edge Functions

Source of truth: `docs/01-auth-onboarding.md`, `BLOCKERS.md`, and
`docs/phase-2-production-infrastructure-runbook.md`.

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

The repository pins Supabase CLI `2.109.1` as an exact development dependency.
Use the checked-in scripts instead of a global or floating CLI:

```powershell
npm ci
npm run phase2:db-local-contract
npm run phase2:db-local-reset
npm run phase2:db-local-verify
```

`phase2:db-local-verify` copies `supabase/` to a uniquely named temporary
workdir, excludes `.temp`, `.branches`, every `.env` variant, inherited hosted
credentials, and every linked-project input, allocates an isolated local port
block, and uses explicit
`--local` targets. It starts the Auth/Storage-aware Docker stack, resets all 51
migrations plus `seed.sql` twice, verifies exact migration history, runs the
structural pgTAP suite and database lint, requires an empty local-vs-migrations
schema diff, generates database types only into the temporary workdir, then
removes the containers, volumes, and temporary files. It never links, pushes,
or accepts a database URL. DB-08 remains open until local output is reconciled
with reviewed staging and the repository type file is deliberately replaced.

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

The deploy wrapper links the project, pushes migrations, deploys required Edge
Functions, and regenerates `packages/types/src/database.types.ts`.

The first durable account-deletion cutover is an exception: predeploy the new
fail-closed `account-deletion` function before applying migrations 0048-0051,
then immediately deploy the complete manifest function set from the same
revision. Migration 0052 is a second hard cutover: freeze deletion intake and
every legacy/unfenced session or RevenueCat publication producer, prove zero
active operations/barriers and zero in-flight bypasses, deploy the compatible
Edge/mobile contract, and reopen only after the reviewed canary. Follow
`docs/phase-9/account-deletion-operations-runbook.md`; never run migration 0048
against the old synchronous deletion entrypoint.

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

Catalog lookup/search/report functions are Phase 4 infrastructure. Bulk product
imports must use approved export artifacts and `scripts/phase4/*`, not API
crawling. Open Beauty Facts live lookup stays disabled unless `OBF_API_ENABLED`
and a final `OBF_USER_AGENT` are configured.
