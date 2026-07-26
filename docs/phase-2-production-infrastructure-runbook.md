# Phase 2 Production Infrastructure Runbook

Date: 2026-07-15
Updated: 2026-07-26 for the 66-migration chain through `0067`

Phase 2 is now scaffolded in code, but it is not externally complete. Do not
create irreversible production accounts under `OnSkin` until
`docs/brand-decision-memo.md` records counsel/founder clearance.

## Implemented Locally

- `apps/mobile/app.config.js`: dev/staging/prod app variants with env-overridable
  name, slug, scheme, iOS bundle ID, and Android package.
- `apps/mobile/eas.json`: EAS development, staging, and production build profiles.
- `react-native-purchases`, `posthog-react-native`, `@sentry/react-native`,
  `expo-dev-client`, `expo-application`, and `expo-localization` installed.
- RevenueCat runtime wiring in `apps/mobile/src/lib/iap/revenuecat.ts`, bound to
  the Supabase user ID and guarded so local dev can still navigate the paywall.
- PostHog runtime wiring in `apps/mobile/src/lib/analytics/track.ts`, with
  JSON-safe event properties and no session replay.
- Sentry startup wiring in `apps/mobile/src/lib/observability/sentry.ts`, with no
  default PII, screenshots, view hierarchy, or failed-request capture.
- Supabase Edge Functions now prefer Supabase publishable/secret key names with
  legacy key fallback.
- `scripts/phase2/check-env.mjs`: validates the Phase 2 env contract and blocks
  accidental public secret naming.
- `scripts/phase2/supabase-rls-smoke.mjs`: two-user plus anonymous RLS smoke
  test for profiles, skin profiles, shelf, routines, consents, and entitlements.
- `scripts/phase2/deploy-supabase-staging.ps1` plus the Node orchestrator and
  evidence contract: fresh-staging-only deployment of 66 migrations through
  `0067` and all 17 default functions with pre-migration compatibility deploy,
  exact before/after inventories, hosted pgTAP/lint/drift checks, local/linked
  type parity, Git-blob-verified immutable deployment inputs, bounded redacted
  logs/process trees, active closed-ingress enforcement, and manifest-last
  non-overwritable evidence. The runner sets `DB06_TRAFFIC_FREEZE=frozen`, all
  17 Edge entrypoints refuse admitted handler traffic while frozen, and the
  exact eight `verifyJwt: false` endpoints are live-canary checked for the
  frozen response.
  The current chain adds `0064`'s exact output-only skin-profile quiz provenance
  without raw-answer retention, `0065`'s CAT-08 transition-conflict plus global
  function-default-ACL repair, and `0066`'s additional fail-closed seal over the
  unreviewed legacy conflict/sequencing fixtures. Migration `0067` adds only a
  checker-only ephemeral table shape for the catalog-release wrapper's
  runtime-created temporary validation table; all other wrapper statements
  remain linted with no extension dependency or runtime/security change.
- `supabase/ops/account-deletion-work-lane.sql`: credential-free, fail-closed
  Cron/Vault provisioning for the durable account-deletion worker.
- `docs/phase-9/account-deletion-operations-runbook.md`: exact deletion
  environment, cutover, monitoring, rotation, containment, and live-gate
  contract.

## Required Sequence

1. Resolve the brand/account-owner, region, budget, DPA/data-map, MFA, recovery,
   and access gates. Do not create an irreversible production identity under an
   uncleared brand.
2. Create a new isolated **empty** Supabase staging project. This procedure
   rejects any public schema object, remote migration ID, deployed function,
   Auth user/identity/session, Storage bucket/object, or Cron job; it is not an
   incremental migration path.

   **Stop on remote `0059`:** the checked-in
   `20260718000059_catalog_scan_minimization.sql` contains the single required
   parser repair that closes its correction-intake validation `if`. If the
   target reports migration `20260718000059` in remote history, stop before any
   push. Do not assume its previously issued bytes match, do not repair it with
   a later migration, and do not continue this fresh-only procedure. Preserve
   the readback for incident review and use a newly verified empty target or a
   separately approved forensic reconciliation plan.

3. Fill `.env` from `.env.example` with staging values and run
   `npm run phase2:check-env:strict`.
4. Configure every manifest-required hosted environment/secret name before the
   deployment. Durable deletion requires independent payload, receipt, worker,
   and tombstone material plus a RevenueCat **V2** key. A V1/legacy key cannot
   satisfy that contract. Never retain values or provider digests in evidence.
5. Produce the unexpired cutover record from
   `docs/phase-2/staging-cutover-attestation.template.json`, one exact
   `traffic-provider-freeze.json` from
   `docs/phase-2/staging-traffic-provider-freeze-attestation.template.json`,
   and five schema-v2 zero-cohort boundary files from
   `docs/phase-2/staging-zero-cohort-boundary-attestation.template.json` in one
   access-controlled directory outside the worktree. The traffic/provider
   artifact must attest that no mobile, web, or OTA client targets staging; no
   project API key is externally distributed; Auth signup, anonymous signup,
   all 26 reviewed external-provider flags and seven reviewed hook flags, SAML,
   OAuth server, custom OAuth, SSO, and third-party Auth integrations are
   closed; Auth admin-creation automation is disabled; provider callbacks and
   pending retries, Apple and App Store server notifications, and scheduled
   ingress are absent; and Edge admission is frozen. Bind every artifact to the
   full domain-separated target fingerprint, clean `origin/main` SHA, exact
   migration-plan hash where required, rollback reference where required, and
   explicit retention-review checkpoint. Role labels state attestation context;
   they are not independent legal, privacy, or security approvals.
6. Capture the cutover observations no more than 30 minutes before the runner's
   initial pre-mutation validation. The freeze must already be active, must
   cover the cutover record's `validUntil`, and must span no more than 24 hours
   from activation through `holdUntil`. Both `validUntil` and `holdUntil` must
   have at least 12 hours remaining at this initial gate. The immediate
   pre-migration gate requires at least seven hours remaining on both, and the
   completion gate retains the existing current-validity plus one-hour-hold
   requirement. These 12-hour/seven-hour budgets conservatively exceed the
   current bounded success envelopes of approximately 10 hours 20 minutes and
   five hours 50 minutes, including both sequential 17-function deploy loops,
   maximum inventory retries/delays, migrations, canaries, and hosted checks.
   Supply evidence references for release channels, Supabase Auth and Edge,
   Apple, RevenueCat, and scheduled ingress. `changeLockRef` and every
   `evidenceRefs` value must be a local non-secret ticket/artifact ID beginning
   with `ticket-`, `artifact-`, `change-`, `evidence-`, `checkpoint-`, or
   `review-`. URLs, email-like values, dashboard/account/project identifiers,
   secret values, and raw user/provider data are rejected and must never be
   copied into these retained fields.
7. Run the fresh-staging wrapper. It sets `DB06_TRAFFIC_FREEZE=frozen` with the
   staging environment before predeploy, predeploys and reads back the complete
   compatible 17-function manifest before migrations `0048`-`0067`, and proves
   all 17 entrypoints contain the first-request freeze guard. It live-canaries
   the exact eight `verifyJwt: false` endpoints for HTTP `503`, exact
   `DB06_STAGING_TRAFFIC_FROZEN` JSON error, and `Cache-Control: no-store`.
8. Immediately before migration push, the runner reparses the exact unchanged
   cutover bytes/hashes, proves the current `validUntil` and `holdUntil`, and
   rereads the exact function inventory, public freeze canaries, hosted Auth
   freeze, empty migration inventory, public schema and Storage inventory, and
   **all** Cron jobs. This is a current live-state/hold gate, not a claim that
   the initial operator observations were recaptured. Only then does it apply
   all 66 migrations in source order, redeploy the same manifest, and retain
   the complete redacted evidence package. Completion repeats the immutable
   artifact/current-validity/current-hold checks. The evidence records the
   required and actual remaining milliseconds at the initial, immediate, and
   final gates. A `pass` manifest cannot omit any of these proofs. Do not use
   this path for a non-empty target.
9. Review the resulting `docs/hugeToDo/evidence/DB-06/staging/<evidence-id>/`
   packet. A template, reservation, failed record, or local test is not live
   staging acceptance. The runner revalidates the cutover artifacts at
   completion and never changes the freeze back to open.
10. Keep staging ingress frozen after DB-06. Release requires a separate,
    recorded downstream live-gate decision; DB-06 success alone is not release
    authorization. A failed or interrupted run also leaves the freeze active.
11. Provision the named Vault entries and canonical Cron jobs only after their
    handlers, schema, negative-auth probes, and live canaries pass through the
    downstream procedure.
12. Run `npm run phase2:rls-smoke` plus the full Phase 9 Apple, deletion,
    health-consent, export, auth, provider, and adversarial live matrices.
13. Configure Apple, RevenueCat, PostHog, Sentry, Turnstile, and policy URLs
    under the cleared identity, then build the iOS staging candidate through
    EAS and run the physical-device QA matrix.
14. Use a separately reviewed incremental/production DB-12 procedure for later
    changes. Never mutate schema in the dashboard or reuse this fresh-only path
    as a production authorization.

## Commands

```bash
npm run phase2:check-env
npm run phase2:check-env:strict
npm run phase2:prepare-staging-cutover
npm run phase2:prepare-staging-cutover -- --evidence-dir <absolute-evidence-dir>
npm run phase2:rls-smoke
```

The preparation helper requires a freshly fetched, clean `main` equal to
`origin/main`. It reads the full 20-character project ref only from the
environment and prints only its last four characters plus
`sha256(utf8("db06-project-ref-v1\0" + fullProjectRef))`, the ordered 61
migration IDs, `sha256(utf8(canonical-json(ordered-migration-id-array)))`, and,
when `--evidence-dir` is supplied, SHA-256 values for the exact six external
artifact bytes. It never prints the raw project ref.

PowerShell staging deploy:

```powershell
$env:APP_ENV = "staging"
$env:EXPO_PUBLIC_APP_ENV = "staging"
$env:PHASE9_EXPECTED_SUPABASE_PROJECT_REF = $env:SUPABASE_PROJECT_REF
$env:DB06_OPERATOR_ROLE = "release-operator"
$env:DB06_ROLLBACK_REF = "<reviewed-rollback-reference>"
$env:DB06_CUTOVER_RECORD = "<absolute-path-to-reviewed-cutover-record>"
$env:DB06_CUTOVER_EVIDENCE_DIR = "<absolute-path-to-redacted-boundary-directory>"
.\scripts\phase2\deploy-supabase-staging.ps1
```

Read `docs/hugeToDo/DB-06-STAGING-DEPLOYMENT-SOURCE-CHECKPOINT-2026-07-15.md`,
`docs/phase-9/account-deletion-operations-runbook.md`, and
`docs/phase-9/apple-auth-lifecycle-operations-runbook.md` first. The wrapper
requires their zero-cohort ordering evidence and leaves repository DB types
unchanged; DB-08 owns any later deliberate replacement.

Expo config checks:

```powershell
cd apps/mobile
$env:APP_VARIANT="staging"; npx expo config --type public; Remove-Item Env:\APP_VARIANT
```

EAS builds:

```bash
cd apps/mobile
eas build --profile development --platform ios
eas build --profile staging --platform android
eas build --profile production --platform all
```

## RevenueCat Contract

- Product IDs are read from
  `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID`,
  and `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID`. The committed defaults are
  local placeholders only; replace them with final App Store/RevenueCat IDs
  after brand clearance. The no-card reverse trial is an app-granted Supabase
  entitlement with `product_id=null`, `offering_id=null`, and `package_id=null`;
  it is not a Store product and must not be configured as one.
- Entitlement defaults to `pro`; override with
  `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` only if the dashboard uses another ID.
- `appUserID` is the Supabase user ID, including the anonymous user ID.
- A configured native build never returns the local `stub` purchase result.

## Supabase Verification

The RLS smoke test creates two disposable users, signs in with the publishable
key, verifies owner-only read/write behavior, verifies anonymous private reads
are blocked, and deletes the users through the admin API.

It refuses production unless `PHASE2_ALLOW_PRODUCTION_SMOKE=1` is set. The
expected target is staging.

## DB-06 Evidence And Failure Semantics

A successful live DB-06 directory retains the manifest, bounded structured log,
linked generated types, checksums, the main cutover attestation, the
traffic/provider-freeze artifact, and all five boundary artifacts. The expected
post-migration inventory is 80 public tables with RLS on all 80, one `photos`
bucket, zero Auth users/identities/sessions, zero Storage objects, and zero Cron
jobs. Linked types are retained only after exact local/linked parity; this
procedure does not replace repository types.

On Windows, commands run in a job object whose confirmed settlement includes
descendant shutdown. If containment cannot be confirmed, the procedure keeps
the cancellation signal and runtime root available for recovery and emits a
stable, redacted recovery fingerprint; it does not report a pass or infer that
remote state is contained. Any post-mutation failure remains
`remote-state-unknown` and requires operator containment and readback.

## Still Blocked Externally

- Brand/legal clearance.
- Approved and accessible staging/production Supabase projects plus the real
  DB-06 hosted evidence packet.
- Apple Developer and App Store Connect records.
- RevenueCat products, offerings, sandbox testers, and webhooks.
- PostHog/Sentry projects and deletion/source-map verification.
- Hosted Cron/Vault worker proof, provider interruption/reconciliation, and
  account-deletion concurrency/fault-injection evidence.
- Turnstile site and secret configuration.
- Final privacy, terms, support, data export, and account deletion URLs.
- Physical-iPhone QA for auth, purchases, notifications, camera, share card,
  and release builds.

## Official References Checked

- [Supabase Management API OpenAPI](https://api.supabase.com/api/v1-json), used
  for the read-only hosted Auth freeze inventory.
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets),
  including runtime availability of configured function secrets.
- [Supabase Edge Function JWT verification](https://supabase.com/docs/guides/functions/auth),
  which is why live unauthenticated freeze canaries target the eight functions
  whose manifest explicitly sets `verifyJwt: false`; all 17 handlers are also
  statically guarded.
- [Supabase network restrictions](https://supabase.com/docs/guides/platform/network-restrictions),
  whose documented scope does not replace the API, Auth, Edge, callback, and
  scheduler freeze controls above.
- [RevenueCat webhook delivery and retries](https://www.revenuecat.com/docs/integrations/webhooks),
  which is why both new delivery and pending staging retries must be closed.
- [Apple App Store Server Notifications](https://developer.apple.com/documentation/appstoreservernotifications),
  whose configured endpoint is an external ingress path and therefore must not
  target this fresh staging project during DB-06.
- [Supabase CLI reference](https://supabase.com/docs/reference/cli/introduction)
  and [pinned CLI source](https://github.com/supabase/cli/tree/v2.109.1) for
  linked queries, migration push/dry-run, function/secret inventories, pgTAP,
  lint, diff, and linked type generation.

These references support the source-controlled procedure; they do not establish
legal compliance, security approval, provider acceptance, or App Store approval.
