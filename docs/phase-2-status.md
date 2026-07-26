# Phase 2 Status

Date: 2026-07-15

## Done In Repo

- EAS app variants and build profiles are scaffolded.
- Native infrastructure SDKs are installed for RevenueCat, PostHog, Sentry, and
  custom dev builds.
- RevenueCat purchase/restore code is wired behind real keys and native platform
  support, while preserving the local dev stub only when RevenueCat is absent.
- PostHog event names/properties are sanitized, but direct mobile capture and identify are intentionally disabled until consent, deletion-barrier, regional configuration, retention, and live payload gates pass.
- Sentry initializes at app startup with privacy-conservative defaults.
- Supabase Edge Functions prefer publishable/secret key env names.
- Phase 2 env audit and Supabase RLS smoke test are added.
- The DB-06 fresh-staging deploy path is source-complete: it binds a clean
  `origin/main` SHA and expected target, deploys only a Git-blob-verified
  immutable snapshot through the native pinned Supabase CLI `2.109.1`, refuses
  public/migration/function/Auth/Storage/all-Cron state, validates and retains a
  full-target-bound cutover record, one traffic/provider-freeze artifact, and
  five schema-v2 boundary files, predeploys all 17 functions before 67
  migrations through `0068`, retains before/pre-migration/after
  schema/migration/function/type evidence, and fails closed without retaining
  raw CLI output or provider digests.
- DB-06 actively closes ingress: the runner sets
  `DB06_TRAFFIC_FREEZE=frozen`; all 17 Edge handlers have a first-request freeze
  guard; and the exact eight `verifyJwt: false` functions must return HTTP 503,
  exact `DB06_STAGING_TRAFFIC_FROZEN`, and `Cache-Control: no-store`. The
  hosted Auth gate requires signup, anonymous signup, all 26 reviewed external
  providers, seven reviewed hooks, SAML, OAuth server, custom OAuth, SSO, and
  third-party integrations to remain disabled.
- Immediately before migration push, DB-06 revalidates the cutover bytes and
  rereads the exact function inventory, public freeze responses, Auth freeze,
  empty migration inventory, schema, Storage, and all Cron jobs. The final pass
  contract rejects omitted proof, requires 80 public/80 RLS tables, one
  `photos` bucket, zero Auth cohort/Storage objects/Cron jobs, and revalidates
  the cutover artifacts at completion. DB-06 never unfreezes staging; release
  belongs to a separate recorded downstream live gate.
- DB-06 timeout/interruption/output-limit handling terminates the complete child
  process tree before finalizing evidence. When Windows containment is
  unconfirmed, it preserves the cancellation signal and runtime root and emits
  a stable recovery fingerprint. Every post-mutation failure remains
  remote-state-unknown and, when safe, carries a best-effort read-only snapshot;
  no failure is mislabeled as contained.
- DB-06 retains linked generated types only after exact local/linked hash parity
  and deliberately leaves repository type replacement to DB-08.
- The local DB gate now rehearses the exact `0067` -> `0068` forward cutover
  with legacy nonzero adherence caches, client-authored freezes, partial steps,
  and marker rows before its two clean 67-migration head resets. It proves the
  locked cutover clears unverifiable projections, preserves completion
  evidence, and restores adherence from markers only after exact-timezone
  configuration.
- Store/privacy inventory and production infrastructure runbook are documented.

## Not Done Because It Requires External Accounts

- Supabase staging/production projects are not approved, created, or linked; no
  DB-06 hosted evidence packet exists.
- Edge Functions are not deployed to a live project.
- RLS smoke tests have not run against a live Supabase project.
- Apple/Google app records, OAuth clients, and store metadata are not created.
- RevenueCat project, products, offerings, sandbox testers, and webhook endpoint
  are not configured.
- PostHog and Sentry projects are not configured under a final brand.
- Turnstile is not configured.
- Final legal/support/account deletion/data export URLs are not live.
- EAS builds have not been run with real credentials.

## Current Go/No-Go

DB-06 remains `in_progress` and `blockedBy: ["ACCT-03"]`. No approved hosted
staging target was used and no live evidence directory was created.

No-go for public launch. The repo now has a reviewed source contract for a first
empty staging deployment, but that contract is not a deployment. Launch
readiness still depends on brand clearance, external accounts, a real hosted
DB-06 packet and downstream live matrices, production secrets, physical-iPhone
QA, legal/privacy/security/clinical review, catalog rights/data, and closed-beta
demand proof.
