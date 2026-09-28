# Phase 2 Status

> 2026-09-21 DB-05 trial: exact Supabase CLI `2.117.0` is pinned so the full
> 91-migration source chain through `0075` can be attempted locally. Its
> concurrent-index-drop fix is available. The repository also contains
> migrations with `LOCK TABLE`, which may hit an upstream pipeline regression;
> no current replay is claimed. DB-06 still fails before project linking or mutation.
> Historical 71-migration/82-table results below are not current proof.

Historical checkpoint: 2026-08-05

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
- The historical DB-06 fresh-staging source procedure binds a clean
  `origin/main` SHA and expected target, deploys only a Git-blob-verified
  immutable snapshot, refuses pre-existing public/migration/function/Auth/
  Storage/Cron state, and retains target-bound cutover, freeze, and
  before/pre-migration/after evidence. Its 71-migration/`0072` and Supabase CLI
  `2.109.1` contract is not deployable for the current 91-migration/`0075`
  source. The runner now rejects the unproven current chain before project
  linking or remote mutation; the `2.117.0` pin is a local DB-05 replay trial.
- DB-06 actively closes ingress: the runner sets
  `DB06_TRAFFIC_FREEZE=frozen`; all 17 Edge handlers have a first-request freeze
  guard; and the exact eight `verifyJwt: false` functions must return HTTP 503,
  exact `DB06_STAGING_TRAFFIC_FROZEN`, and `Cache-Control: no-store`. The
  hosted Auth gate requires signup, anonymous signup, all 26 reviewed external
  providers, seven reviewed hooks, SAML, OAuth server, custom OAuth, SSO, and
  third-party integrations to remain disabled.
- In the historical procedure, immediately before migration push, DB-06
  revalidates the cutover bytes and rereads the exact function inventory,
  public freeze responses, Auth freeze, empty migration inventory, schema,
  Storage, and all Cron jobs. That historical final-pass contract rejects
  omitted proof, requires 82 public/82 RLS tables, one
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
  and never changes repository types during a hosted run. The historical local
  DB-08 canonical replacement/drift gate passed: the authoritative clean
  verifier at commit `e5588ae69` exited 0 in 2,200.4 seconds and accepted the
  repository replacement with the exact raw CLI-generated
  `packages/types/src/database.types.ts` artifact at 6,770 lines with SHA-256
  `2c14252f882294d2ca42832405fb0fe157f855a85a9d3fc5d47999457be9b1d3`.
  Client write restrictions are not hand edits to that generated artifact;
  they live in the separate client overlay. This proves only the historical
  71-migration local parity; DB-08 remains open until the complete current
  chain and reviewed hosted target prove repository/local/linked parity.
- The historical local DB gate defined exact
  `0067 -> 0068 -> 0069 -> 0070 -> 0071 -> 0072` forward rehearsals plus two
  clean 71-migration head resets. Those five
  transitions cover the adherence cutover, Shelf/completion replay bridge,
  draft-only consent-copy staging, recommendation zero admission, and commerce
  zero-admission ACL convergence.
  The `0067 -> 0068` fixture includes legacy nonzero adherence caches,
  client-authored freezes, partial steps, and marker rows and requires the
  locked cutover to clear unverifiable projections, preserve completion
  evidence, and restore adherence only after exact-timezone configuration.
  The exact full current-head command is not a pass until every phase exits and
  teardown completes. On 2026-08-05 that command exited 0 at clean commit
  `57da25f63`: all five forward cutovers including commerce 21/21, both clean
  resets, exact 71-version history, the focused five-file lane / 433 assertions,
  16 structural pgTAP files / 1,222 assertions, error-level lint, empty
  migration-shadow drift, temporary 6,771-line type generation, CAT-08 10/10,
  and awaited teardown plus removal of that run's own sandbox passed. Historical
  roots were excluded. At that historical checkpoint, repository types had not
  yet been replaced. This remains disposable local source evidence only; it
  does not satisfy any hosted gate.
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

DB-06 remains `in_progress` and `blockedBy: ["DB-05", "ACCT-03"]`. Its current
runner fails before project linking or mutation. No approved hosted staging
target was used and no live evidence directory was created.

DB-08 local canonical replacement/drift passed for the historical 71-migration
checkpoint at clean commit `e5588ae69`, but current-chain local parity and
the DB-06 hosted packet remain open. No staging parity is claimed.

No-go for public launch. The repository retains a historically reviewed first
empty-staging procedure, but the current source chain has not passed its local
gate and that procedure has not been executed against a hosted target. Launch
readiness still depends on brand clearance, external accounts, a real hosted
DB-06 packet and downstream live matrices, production secrets, physical-iPhone
QA, legal/privacy/security/clinical review, catalog rights/data, and closed-beta
demand proof.
