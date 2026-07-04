# Phase 2 Readiness Checklist

Date: 2026-07-04

Phase 2 should not start until naming, account ownership, environments, and
secret handling are clear enough that production infrastructure will not need to
be torn down.

Update: the local Phase 2 scaffolding now exists. Use
`docs/phase-2-production-infrastructure-runbook.md`,
`docs/phase-2-status.md`, and `docs/store-privacy-inventory.md` before creating
external accounts.

## Required Before Infrastructure Setup

| Item | Decision needed | Current Phase 1 state |
| --- | --- | --- |
| Brand name | Keep `OnSkin` only with counsel clearance; otherwise rebrand | Default path is rebrand; `RoutineKind` is the working candidate for clearance |
| Domain | Final policy, support, app link, and fallback domain | Target candidate `routinekind.app`; registrar and legal clearance required |
| iOS bundle ID | Final App Store identifier | Candidate `com.routinekind.app` if rebrand clears |
| Android package | Final Play package identifier | Candidate `com.routinekind.app` if rebrand clears |
| URL scheme | Final deep link scheme | Candidate `routinekind` if rebrand clears |
| Environment split | Naming for dev/staging/prod | Use `development`, `staging`, `production` |
| Supabase projects | Project names and region | Create separate staging and production projects after brand decision |
| RevenueCat project | App and entitlement naming | Create after final app identity; entitlement `pro` remains stable unless pricing changes |
| Apple account owner | Human owner and billing | Founder to assign |
| Google account owner | Human owner and billing | Founder to assign |
| Secret storage | Where `.env` and server secrets live | Use local `.env` for dev only; production secrets in provider dashboards/CI secret store |
| Account owner email | Durable admin email | Founder to assign before account creation |
| Billing owner | Card/account for paid services | Founder to assign |
| Branch/release policy | How release candidates are cut | Keep docs/code on main; create release branches only after RC checklist exists |

## Environment Naming

Use exactly:

- `development`
- `staging`
- `production`

Do not create production service accounts under the `OnSkin` name unless counsel
clears the brand.

## Supabase Start Order

1. Create staging project.
2. Fill `SUPABASE_PROJECT_REF`, `EXPO_PUBLIC_SUPABASE_URL`, and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for staging.
3. Run `npm run phase2:check-env:strict`.
4. Apply all migrations in `supabase/migrations`.
5. Generate fresh database types into `packages/types/src/database.types.ts`.
6. Deploy Edge Functions: `revenuecat-webhook`, `account-deletion`,
   `data-export`, and `order-report-poll`.
7. Configure Edge Function secrets.
8. Run Security Advisor and Performance Advisor.
9. Run `npm run phase2:rls-smoke`.
10. Repeat for production only after staging passes.

## Payment Start Order

1. Finalize brand/app identity.
2. Create App Store Connect and Play Console records.
3. Create RevenueCat project.
4. Define products and offerings.
5. Bind RevenueCat app user IDs to Supabase user IDs.
6. Wire purchase, restore, intro eligibility, cancellation/manage links, and
   webhook reconciliation.
7. Test fresh purchase, trial, reverse trial, renewal, grace period, billing
   failure, restore, refund, upgrade/downgrade, account deletion, and
   anonymous-to-social linking.

## Exit Criteria

Phase 2 can begin when:

- brand path is written in `docs/brand-decision-memo.md`
- final or temporary app identifiers are chosen intentionally
- account owner email and billing owner are assigned
- staging/production environment names are fixed
- secret storage policy is documented
- first Phase 2 task is clear: create Supabase staging project
