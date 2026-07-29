# Phase 2 Readiness Checklist

Date: 2026-07-15
Updated: 2026-07-29 for the 70-migration chain through `0071`

Phase 2 should not start until naming, account ownership, environments, and
secret handling are clear enough that production infrastructure will not need to
be torn down.

Update: the local Phase 2 scaffolding now exists. Use
`docs/phase-2-production-infrastructure-runbook.md`,
`docs/phase-2-status.md`, and `docs/store-privacy-inventory.md` before creating
external accounts.

## Required Before Infrastructure Setup

| Item                  | Decision needed                                                                             | Current Phase 1 state                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Brand name            | Reject conflicted `OnSkin`; select only after written counsel decision and founder approval | Sequence for counsel review is `RoutineKind`, `Ritunera`, then lower-confidence `Ritualoom`; `Rituvia` is suspended                   |
| Domain                | Final policy, support, app link, and fallback domain                                        | Provisional first-candidate order is `routinekind.com`, then `routinekind.app`; authenticated reservation and legal decision required |
| iOS bundle ID         | Final App Store identifier                                                                  | Candidate `com.routinekind.app` if rebrand clears                                                                                     |
| Android package       | Final Play package identifier                                                               | Candidate `com.routinekind.app` if rebrand clears                                                                                     |
| URL scheme            | Final deep link scheme                                                                      | Candidate `routinekind` if rebrand clears                                                                                             |
| Environment split     | Naming for dev/staging/prod                                                                 | Use `development`, `staging`, `production`                                                                                            |
| Supabase projects     | Project names and region                                                                    | Create separate staging and production projects after brand decision                                                                  |
| RevenueCat project    | App and entitlement naming                                                                  | Create after final app identity; entitlement `pro` remains stable unless pricing changes                                              |
| Apple account owner   | Human owner and billing                                                                     | Founder to assign                                                                                                                     |
| Google account owner  | Human owner and billing                                                                     | Founder to assign                                                                                                                     |
| Secret storage        | Where `.env` and server secrets live                                                        | Use local `.env` for dev only; production secrets in provider dashboards/CI secret store                                              |
| Account owner email   | Durable admin email                                                                         | Founder to assign before account creation                                                                                             |
| Billing owner         | Card/account for paid services                                                              | Founder to assign                                                                                                                     |
| Branch/release policy | How release candidates are cut                                                              | Keep docs/code on main; create release branches only after RC checklist exists                                                        |

## Environment Naming

Use exactly:

- `development`
- `staging`
- `production`

Do not create production service accounts under the `OnSkin` name unless counsel
clears the brand.

## Supabase Start Order

1. After account/brand/data-map approval, create a new isolated empty staging
   project. DB-06 refuses any public/migration/function state plus any Auth,
   Storage, or Cron state.
2. Fill `SUPABASE_PROJECT_REF`, `PHASE9_EXPECTED_SUPABASE_PROJECT_REF`,
   `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for
   staging; the two project refs must match exactly.
3. Run `npm run phase2:check-env:strict` and configure every required hosted
   manifest secret/environment **name** without retaining any value in source or
   evidence.
4. Produce the main operator-attestation record, one exact
   `traffic-provider-freeze.json`, and five schema-v2 redacted zero-cohort
   boundary files for migrations `0048`/`0052`/`0053`/`0054`/`0055`. Bind them
   to the clean `origin/main` SHA, full target fingerprint, rollback point,
   exact 62-migration plan hash where required, and explicit future
   retention-review checkpoint. At the initial pre-mutation gate, all
   observations must be no more than 30 minutes old. The freeze must cover the
   main record's `validUntil` and span no more than 24 hours. Both `validUntil`
   and `holdUntil` must have at least 12 hours remaining at this initial gate
   and at least seven hours at the immediate pre-push gate; completion retains
   current validity and at least one hour of hold. Use only local non-secret
   ticket/artifact IDs with an
   approved prefix for `changeLockRef` and `evidenceRefs`; URLs, email-like
   values, and provider/account/project identifiers are rejected. Attestation
   role labels do not substitute for independent legal, privacy, or security
   review.
5. Before execution, prove closed ingress: no staging-targeted mobile, web, or
   OTA client; no externally distributed staging key; no provider callbacks or
   pending retries; no Apple/App Store server notifications; no schedules; and
   hosted Auth signup, anonymous signup, all 26 reviewed external providers,
   all seven reviewed hooks, SAML, OAuth server, custom OAuth, SSO, and
   third-party integrations disabled, with Auth admin-creation automation off.
6. Run `npm run phase2:db-local-verify` and require the committed
   `0067` -> `0068` rehearsal to pass against nonzero legacy caches,
   client-authored freezes, partial steps, and routine markers before either
   repeatable head reset is accepted. Then run
   `scripts/phase2/deploy-supabase-staging.ps1`. The pinned procedure
   creates and repeatedly verifies an immutable Git snapshot, sets
   `DB06_TRAFFIC_FREEZE=frozen`, predeploys all 17 guarded default functions,
   and canaries the exact eight `verifyJwt: false` endpoints for HTTP `503`,
   exact `DB06_STAGING_TRAFFIC_FROZEN`, and `Cache-Control: no-store`.
7. Require the immediate pre-push gate to revalidate cutover bytes and reread
   the exact function inventory, public freeze canaries, Auth freeze, empty
   migration inventory, schema, Storage, and all Cron jobs before applying the
   70 migrations through `0071`. The local acceptance lane separately rehearses
   `0067 -> 0068 -> 0069 -> 0070 -> 0071` before its two clean head resets.
   That gate reparses the unchanged artifact
   bytes/hashes and
   proves their current `validUntil`/`holdUntil` plus the seven-hour remaining
   completion budget; it does not pretend the initial operator observations
   were recaptured. The procedure redeploys the
   complete manifest and retains exact before/pre-migration/after evidence plus
   seven cutover artifacts. A `pass` packet cannot omit these proofs.
8. Require hosted pgTAP, error-level lint, empty linked drift, exact function
   versions/JWT posture/hosted hashes, exact migration IDs/source checksums, and
   local/linked generated-type parity. DB-06 retains linked types but does not
   replace repository types; DB-08 owns that later decision.
9. Confirm the final DB-06 inventory is exactly 82 public tables with 82 RLS
   tables, one `photos` bucket, zero Auth users/identities/sessions, zero
   Storage objects, and zero Cron jobs. Confirm the final cutover revalidation
   matches the original retained hashes.
10. Keep `DB06_TRAFFIC_FREEZE=frozen` after success or failure. Reopening
    staging requires a separately recorded downstream live-gate release; DB-06
    never performs that release.
11. Run Security Advisor, Performance Advisor, backup/restore, and the full live
    RLS/auth/privacy/provider matrices. A local pass is not hosted acceptance.
12. Repeat for production only through the separately reviewed DB-12/DB-13
    procedure after staging signoff; never mutate schema in the dashboard.

## Payment Start Order

1. Finalize brand/app identity.
2. Create the App Store Connect record for the current iOS-only launch scope.
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
- first Phase 2 task is clear: create an approved empty Supabase staging project
  and execute the reviewed DB-06 evidence procedure
