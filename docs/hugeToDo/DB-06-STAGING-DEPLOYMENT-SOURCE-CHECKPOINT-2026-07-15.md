# DB-06 Staging Deployment Source Checkpoint

Date: 2026-07-15
Updated: 2026-07-26 for the 66-migration chain through `0067`

Status: `in_progress`, blocked by `ACCT-03`; source procedure and evidence
contract implemented; no hosted staging deployment or live DB-06 acceptance
evidence exists

## Outcome

The repository now has a fail-closed, fresh-staging-only deployment procedure
for DB-06. It cannot run against a non-empty or incrementally migrated project.
It does not turn the unavailable hosted Supabase project into a local pass and
does not mark DB-06 complete.

The procedure is intentionally narrower than a general migration tool. Current
account-deletion, publication, entitlement, health-consent, and Sign in with
Apple migrations contain forward-only security boundaries. A generic
"migrations first, functions later" wrapper would violate their reviewed
ordering. Incremental staging and production changes require their dedicated
freeze/state proofs and a separately reviewed DB-12 procedure; this DB-06
wrapper refuses that scope.

## Implemented Contract

The user-facing command remains
`scripts/phase2/deploy-supabase-staging.ps1`. It validates the shared Edge
`APP_ENV` resolver and delegates command execution and evidence handling to the
Node orchestrator. The orchestrator:

1. requires `APP_ENV=staging`, a separately bound expected project ref, a
   non-personal operator-role label, a reviewed rollback reference, an
   unexpired cutover record plus its traffic/provider-freeze artifact and five
   schema-v2 redacted boundary files, and a configured Supabase access token;
2. requires a clean `main` checkout whose commit exactly equals freshly fetched
   `origin/main`, exports that exact commit to a temporary Git snapshot,
   verifies every extracted regular file against its Git blob ID, and deploys
   only from that snapshot;
3. executes the repository-pinned native Supabase CLI `2.109.1`, rejecting both
   a package pin or installed-version mismatch, and uses confirmed process-tree
   settlement before recording a timeout, interruption, or output-limit
   failure. On Windows, an unconfirmed job-object shutdown preserves the
   cancellation signal and runtime root and emits a stable redacted recovery
   fingerprint;
4. derives and hashes the exact 66 ordered migration files through
   `20260726000067`, the 17 `deployByDefault` functions, each function's
   transitive local source set, the function manifest, the Deno lockfile, and
   every deployment/evidence procedure input;
5. runs the complete credential-free local DB-05 replay and retains its
   generated-type hash as the local side of the parity check;
6. links only after local/source preflight, then captures allowlisted before
   counts, migration history, hosted function inventory, hosted Auth freeze,
   and hosted configuration-name coverage;
7. refuses the target unless it has zero public schema objects, remote migration
   IDs, deployed functions, Auth users/identities/sessions, Apple identities,
   Storage buckets/objects, and **all** Cron jobs;
8. validates a full-target-fingerprint/source/SHA/rollback-bound cutover record
   for the `0048`, `0052`, `0053`, `0054`, and `0055` zero-cohort boundaries,
   plus a separately hashed closed-ingress traffic/provider-freeze artifact.
   At the initial pre-mutation gate, the five boundary observations and freeze
   observation must be no more than 30 minutes old. The freeze must cover
   `validUntil` and span no more than 24 hours. Both `validUntil` and
   `holdUntil` must have at least 12 hours remaining at the initial gate and at
   least seven hours at the immediate pre-push gate; completion requires current
   validity and at least one hour of hold. Required role labels describe the
   attestation context; they are not
   represented as independent legal, privacy, or security approvals;
9. requires the freeze artifact to record no staging-targeted mobile, web, or
   OTA clients; no externally distributed project API keys; disabled Auth
   signup and anonymous signup; zero enabled providers across all 26 reviewed
   `external_*_enabled` fields; zero enabled hooks across all seven reviewed
   `hook_*_enabled` fields; disabled SAML, OAuth server, and custom OAuth; zero
   SSO providers and third-party Auth integrations; no Auth admin-creation
   automation; no Apple/App Store server notifications, RevenueCat delivery or
   pending retries, other provider
   callbacks, or scheduled ingress; and frozen Edge traffic admission. A newly
   returned, unreviewed provider or hook enablement field fails closed for
   source review rather than being silently ignored;
10. sets the two staging app-environment names and
    `DB06_TRAFFIC_FREEZE=frozen`, confirms every required hosted configuration
    group by name only, and discards provider digests. Every one of the 17 Edge
    entrypoints checks the shared freeze guard before request business logic;
11. deploys the complete 17-function manifest before any migration, reads back
    each hosted function's active status, version, `verify_jwt` posture, and
    hosted `ezbr_sha256`, and canaries the exact eight `verifyJwt: false`
    endpoints for HTTP `503`, exact JSON error code
    `DB06_STAGING_TRAFFIC_FROZEN`, and `Cache-Control: no-store`, with bounded
    reads and read-after-write retries;
12. immediately before migration push, reparses the exact unchanged cutover
    bytes/hashes, proves the current `validUntil` and `holdUntil`, and rereads
    the complete function inventory, public freeze canaries, Auth freeze, empty
    migration inventory, public schema and Storage inventory, and all Cron
    jobs. This validates current artifact/hold state, a seven-hour remaining
    completion budget on both timestamps, and fresh hosted reads; it does not
    misstate the initial operator observations as newly captured. The
    migration push begins only after this final zero-cohort boundary passes;
13. runs a migration dry run, applies the exact ordered migrations, proves the
    exact 66-ID history through `0067`, redeploys the same complete manifest, and proves a
    second dry run has no pending source change;
14. runs linked pgTAP, error-level database lint, and an empty linked schema
    diff for `public`, `auth`, and `storage`;
15. generates linked public-schema types, requires their SHA-256 to equal the
    clean local generation, and retains the linked type file without modifying
    `packages/types/src/database.types.ts`; and
16. verifies the final schema has exactly 80 public tables and all 80 have RLS,
    one reviewed `photos` Storage bucket, and still no Auth cohort, Storage
    object, or Cron job; captures the complete final
    migration/function/configuration/Auth/freeze inventories; rechecks the
    immutable source and exact cutover artifact hashes; records the required and
    actual remaining validity/hold milliseconds at all three gates; requires
    every mandatory proof before a `pass`; and finalizes a recoverable,
    non-overwritable evidence directory with the manifest written last.

The runner never sets `DB06_TRAFFIC_FREEZE` back to open. It remains frozen
after success, failure, or interruption. Reopening staging requires a separately
recorded downstream live-gate release; DB-06 success is not itself release
authorization.

Hosted function `ezbr_sha256` and the reviewed local source-set hash are retained
as different fields. They are not described as the same algorithm. Migration
SHA-256 values are hashes of the exact reviewed source files; the hosted
migration table supplies ordered IDs, not file checksums.

For an empty schema diff, pinned Supabase CLI `2.109.1` can emit the exact sole
stderr line `No schema changes found` without creating its requested output
file. The runner accepts a missing diff artifact only for that hash-bound CLI
binary and exact singular signal; every other missing, mixed, or ambiguous
output fails closed.

## Evidence Boundary

An actual run reserves:

```text
docs/hugeToDo/evidence/DB-06/staging/<evidence-id>/
  manifest.json
  deployment-log.jsonl
  database.types.linked.ts
  cutover-attestation.json
  cutover-traffic-provider-freeze.json
  cutover-boundary-account-deletion.json
  cutover-boundary-publication-fence.json
  cutover-boundary-entitlement-authority.json
  cutover-boundary-health-consent.json
  cutover-boundary-apple-auth.json
  checksums.sha256
```

The final manifest satisfies the required fields in
`docs/hugeToDo/evidence-governance.json`. It stores only the last four project
ref characters plus a domain-separated fingerprint. Raw CLI stdout/stderr,
secret values/digests, credentials, URLs, database rows, auth/user identifiers,
and personal operator identity are discarded. The freeze artifact accepts only
local non-secret ticket/artifact IDs beginning with `ticket-`, `artifact-`,
`change-`, `evidence-`, `checkpoint-`, or `review-` for `changeLockRef` and all
`evidenceRefs`; URLs, email-like values, and provider/account/project identifiers
fail closed. Each retained artifact is hashed after redaction. Existing evidence
IDs cannot be traversed or overwritten.

Every child process has an exit-code check, timeout, total-output bound, and
confirmed process-tree shutdown gate. After evidence reservation, a command
failure produces a `fail` record with a stable failure code, the last completed
step, and—when shutdown is confirmed—a best-effort read-only remote snapshot.
Any post-mutation failure remains `remote-state-unknown` and requires
containment/readback; the procedure never infers containment. On Windows,
unconfirmed containment preserves the cancellation signal and runtime root and
emits a stable recovery fingerprint rather than deleting the recovery state. A
hard process/host loss can leave the truthful `reservation.json` plus pending or
supporting artifacts. The manifest is the last finalized artifact and removal
of the reservation is the completion marker.

No live directory was generated for this source checkpoint because no approved,
accessible hosted staging project exists. A template is not live evidence.

## Operator Procedure

1. Create an isolated, empty staging project only after the brand/account,
   region, budget, data-map, owner, MFA, and recovery gates are approved.
2. Configure all manifest-required environment/secret names in the hosted
   project. Never put their values in the repository, cutover record, evidence,
   terminal transcript, issue, or chat.
3. Copy `docs/phase-2/staging-cutover-attestation.template.json`,
   `docs/phase-2/staging-traffic-provider-freeze-attestation.template.json`, and
   five copies of
   `docs/phase-2/staging-zero-cohort-boundary-attestation.template.json` to an
   access-controlled temporary directory. Name the traffic file
   `traffic-provider-freeze.json` and the boundary files exactly as the main
   template requires, fill every `null`, and compute each `evidenceSha256` from
   the exact redacted file bytes (for example,
   `(Get-FileHash -Algorithm SHA256 <file>).Hash.ToLowerInvariant()`). Capture
   the five boundary and freeze observations within 30 minutes of execution;
   give both `validUntil` and the covering freeze `holdUntil` at least 12 hours
   remaining at initial validation, and keep the total activation-to-hold
   interval at or below 24 hours. The runner will require seven hours remaining
   on both again immediately before push and one hour of hold at completion.
   Use only the
   approved local ticket/artifact prefixes above in `changeLockRef` and
   `evidenceRefs`; never paste a dashboard URL or external identifier. These are
   operator attestations, not professional approvals. Set `retentionReviewAt`
   to an explicit reviewed checkpoint after `validUntil`; review/reschedule it
   while the applicable app release remains supported.
4. From a freshly fetched, clean `main` equal to `origin/main`, run
   `npm run phase2:prepare-staging-cutover` to obtain the redacted target
   fingerprint and ordered migration-plan hash. After filling the six external
   artifact files, run
   `npm run phase2:prepare-staging-cutover -- --evidence-dir <absolute-directory>`
   to obtain their exact hashes. The helper reads the raw project ref only from
   the environment and never prints it. Its formulas are
   `sha256(utf8("db06-project-ref-v1\0" + fullProjectRef))` and
   `sha256(utf8(canonical-json(ordered-migration-id-array)))`.
5. Set the required environment variables in the controlled shell:

```powershell
$env:APP_ENV = "staging"
$env:EXPO_PUBLIC_APP_ENV = "staging"
$env:SUPABASE_PROJECT_REF = "<reviewed-20-character-staging-ref>"
$env:PHASE9_EXPECTED_SUPABASE_PROJECT_REF = $env:SUPABASE_PROJECT_REF
$env:SUPABASE_ACCESS_TOKEN = "<access-restricted-token>"
$env:DB06_OPERATOR_ROLE = "release-operator"
$env:DB06_ROLLBACK_REF = "<reviewed-fresh-staging-rollback-reference>"
$env:DB06_CUTOVER_RECORD = "<absolute-path-to-reviewed-record>"
$env:DB06_CUTOVER_EVIDENCE_DIR = "<absolute-path-to-redacted-boundary-directory>"
```

6. Run:

```powershell
.\scripts\phase2\deploy-supabase-staging.ps1
```

7. If it passes, independently inspect the seven retained cutover artifacts and
   all mandatory before/pre-migration/after proofs, then run the downstream
   live RLS/auth/privacy/provider matrices. Keep
   `DB06_TRAFFIC_FREEZE=frozen`; only a separately recorded downstream live gate
   may release it. Commit only approved redacted evidence artifacts. If it
   fails, keep all traffic and provider callbacks closed, preserve the failure
   record and any containment-recovery root, and use the forward-compatible
   containment procedure. Do not reverse migrations `0048`-`0067` or repair
   migration history manually. An unused fresh project may be discarded only
   under the recorded rollback/owner decision after required evidence is
   retained.

## Credential-Free Verification

`npm run phase2:deploy-env-smoke` currently proves focused behavior tests,
including real descendant process-tree settlement on normal, timeout, and
output-limit paths, plus the static wrapper/orchestrator contract. The fixtures
cover deterministic
62-migration/17-function source hashing; partial and malformed schema output;
Git snapshot mutation/injection rejection; aggregate Auth/Storage/all-Cron
parsing and forward-safe Auth configuration-field review;
divergent migration history; non-empty-target rejection; missing, inactive,
extra, wrong-JWT, or un-hashed functions; secret-digest minimization; strict
zero-cohort cutover file/fingerprint/hash/expiry binding; active shared freeze
guards across all 17 functions; exact frozen-response canaries across the eight
public-gateway functions; type validation/parity; exact 80-table/RLS and
one-bucket/no-cohort/no-Cron acceptance; evidence governance fields; redaction;
traversal/overwrite denial; partial-finalization recovery; checksums; retained
linked types; completion-time cutover revalidation; and rejection of a `pass`
that omits any mandatory proof.

These are local source tests only. DB-06 stays `in_progress` and blocked by
ACCT-03 until the reviewed hosted run creates a valid live packet and its
downstream staging checks pass.

The current database tail is bound by
`supabase/migrations/20260718000060_cat07_truthful_freshness.sql`,
`supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql`,
`supabase/migrations/20260722000062_catalog_curation_statement_guard.sql`,
`supabase/migrations/20260722000063_catalog_operator_authority.sql`,
`supabase/migrations/20260726000064_skin_profile_quiz_provenance.sql`,
`supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql`,
`supabase/migrations/20260726000066_legacy_clinical_content_immutability.sql`,
`supabase/migrations/20260726000067_catalog_release_temp_table_lint_contract.sql`,
`supabase/tests/database/cat07_truthful_freshness.test.sql`,
`supabase/tests/database/catalog_import_lifecycle.test.sql`,
`supabase/tests/database/catalog_launch_curation.test.sql`,
`supabase/tests/database/catalog_operator_authority.test.sql`,
`supabase/tests/database/skin_profile_quiz_provenance.test.sql`,
`scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql`,
`scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql`,
`scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql`,
`scripts/phase9/skin-profile-0064-upgrade-postgres-rehearsal.sql`,
`scripts/phase9/catalog-operator-0065-upgrade-postgres-rehearsal.sql`,
`scripts/phase9/clinical-content-0066-upgrade-postgres-rehearsal.sql`,
`supabase/tests/database/clinical_content_legacy_seal.test.sql`,
`scripts/phase9/catalog-release-0067-lint-contract-postgres-rehearsal.sql`,
`supabase/tests/database/catalog_release_temp_table_lint_contract.test.sql`,
`scripts/phase2/local-supabase-contract.mjs`, and the structural
`supabase/tests/database/schema_contract.test.sql`. These remain source/local
contracts, not evidence that an approved hosted target was mutated.

## Primary References

- [Supabase CLI reference](https://supabase.com/docs/reference/cli/introduction)
- [Supabase Management API OpenAPI](https://api.supabase.com/api/v1-json)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Edge Function JWT verification](https://supabase.com/docs/guides/functions/auth)
- [Supabase network restrictions and scope](https://supabase.com/docs/guides/platform/network-restrictions)
- [RevenueCat webhook delivery and retries](https://www.revenuecat.com/docs/integrations/webhooks)
- [Apple App Store Server Notifications](https://developer.apple.com/documentation/appstoreservernotifications)
- [Pinned Supabase CLI v2.109.1 source](https://github.com/supabase/cli/tree/v2.109.1)
- `docs/phase-9/account-deletion-operations-runbook.md`
- `docs/phase-9/apple-auth-lifecycle-operations-runbook.md`
- `docs/hugeToDo/evidence-governance.json`

These references support the engineering procedure. They do not establish
legal compliance, security approval, provider acceptance, or App Store approval.
