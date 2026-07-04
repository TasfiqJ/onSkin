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

## Applying To Staging

```powershell
npm run phase2:check-env:strict
.\scripts\phase2\deploy-supabase-staging.ps1
npm run phase2:rls-smoke
```

The deploy wrapper links the project, pushes migrations, deploys required Edge
Functions, and regenerates `packages/types/src/database.types.ts`.

## Launch Gate

Run Supabase Security Advisor and Performance Advisor before every release.
Treat disabled RLS, missing policies on private tables, unindexed policy columns,
or failed `phase2:rls-smoke` as launch blockers.

## Edge Functions

- `revenuecat-webhook`
- `account-deletion`
- `data-export`
- `order-report-poll`
- `catalog-lookup`
- `catalog-search`
- `catalog-report`

These are service-role functions. External provider calls still require live
account secrets and provider verification before launch.

Catalog lookup/search/report functions are Phase 4 infrastructure. Bulk product
imports must use approved export artifacts and `scripts/phase4/*`, not API
crawling. Open Beauty Facts live lookup stays disabled unless `OBF_API_ENABLED`
and a final `OBF_USER_AGENT` are configured.
