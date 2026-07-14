# Durable Account-Deletion Operations Runbook

Date: 2026-07-13
Status: bounded source checkpoint; live staging, production, provider,
physical-iPhone, privacy/security-review, and App Review evidence is still
required. The preflight-to-session/provider publication fence described below
is also an open source release blocker, so this document does not claim the
overall lifecycle is race-free or source-complete.

This runbook operates the durable account-deletion lifecycle introduced by
migrations `20260713000048` through `20260713000051`. It does not establish
legal compliance, vendor acceptance, Apple approval, or production readiness.

## Runtime model

The `account-deletion` Edge Function has four mutually exclusive POST actions:

| Action      | Caller proof                                                            | Response boundary                                                       |
| ----------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `begin`     | Supabase bearer JWT plus caller-created idempotency/status capabilities | `202` after durable operation creation; provider work is asynchronous   |
| `preflight` | Supabase bearer JWT; Auth-derived owner only                            | Exact `clear` or `active`, always plus that authenticated owner subject |
| `status`    | 256-bit status capability in the exact JSON body                        | Opaque operation/receipt state; no JWT or account identifier            |
| `work`      | Exact `x-account-deletion-worker-secret` header                         | Bounded worker report; no user JWT                                      |

`preflight` is the mobile session-publication boundary, not a status API. The
Edge runtime resolves the bearer to a still-live Auth subject and calls the
service-role-only `get_account_deletion_barrier_state(uuid)` RPC. The Edge
runtime validates the canonical subject before that lookup, and every exact
`clear` or `active` response carries the same authenticated UUID; anonymous and
authenticated database roles cannot execute the RPC directly. The iOS client keeps
every restored or newly authenticated candidate session unpublished until an
exact owner-bound `clear`, rejects a cached `session.user.id` mismatch, and uses
the response subject as the local/vendor publication target. The authenticated
`active` response itself carries cleanup authority, so Auth deletion after the
barrier lookup cannot destroy the proof.

### Mobile owner proof and forced-sign-out crash recovery

Every local cleanup, retention, or adoption decision reads one canonical
four-record owner-proof tuple in a single ordered storage batch:

| Tuple component        | Canonical state                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Cleanup-required       | Absent or exact `1`; a destructive local boundary already started and must finish before publication      |
| Owner binding          | Absent or one canonical lowercase 64-hex domain-separated owner binding                                   |
| Retained-owner binding | Absent or the exact same canonical binding as the owner; preserves a foreign owner across forced sign-out |
| Ownerless quarantine   | Absent or exact `1`; mutually exclusive with owner and retained bindings and prevents later data adoption |

No caller may authorize cleanup from the owner record alone. A malformed
marker/hash, a retained/owner mismatch, quarantine combined with an owner,
missing or reordered batch entries, or any unreadable/unavailable storage
result makes the whole tuple unknown. The candidate session remains
unpublished behind retry, and no sign-out, cleanup, or ownership claim proceeds.

Absent an already-committed cleanup-required marker, registered private
records, encrypted local photos/keys, and generated plaintext cache are erased
only when the server-attested canonical subject's domain-separated binding
exactly matches the tuple's owner binding. A cleanup-required tuple resumes its
already-started destructive boundary before any claim or publication; it is not
authority for a later account to adopt retained data. A valid foreign owner is
copied to the retained-owner field before the foreign candidate session is
removed. Signed-out cold restore then preserves the records, exact-owner
reauthentication consumes the retained marker, and a different login performs
the normal pre-publication wipe. Ownerless data is never adopted: an exact
ownerless-quarantine marker is committed before forced sign-out, and every
later account must complete the destructive boundary before it can claim local
ownership. Every exact-match cleanup stage is attempted, and any partial
failure keeps the retry boundary closed.

A separate AsyncStorage control,
`routinekind.authDerivedCleanupRequired.v1`, protects the forced-session
invalidation sequence itself. It accepts only exact `1`, is written before any
local or global Auth sign-out, and survives ordinary private-data cleanup as a
control key. Session removal, persisted-session removal, in-flight
account/private/photo write settling, any authorized owner-data cleanup, and
query/notification/analytics/image-memory/vendor resets are attempted; the
control is cleared only after every required reset succeeds. On cold restore,
the client reads this control before reading or publishing a Supabase session
and retries the forced cleanup when it is present. A malformed control or
storage failure is not treated as absent and leaves the pre-Auth gate closed.
This control does not itself authorize owner-bound record deletion.

Only an exact `401 {"error":"ACCOUNT_DELETION_SESSION_REJECTED"}` means the
candidate bearer itself is rejected: the client preserves the canonical owner
or commits the ownerless quarantine, then runs the durable auth-derived cleanup
and finishes signed out without inferring an active deletion or erasing
unattested owner-bound records. Unavailable, malformed, `5xx`, and other unknown
results remain behind retry. Deletion-recovery Auth proof follows the same
distinction: exact verified foreign, authoritative local absence, or Auth
`401`/`403` consumes retry authority; `getSession`/`getUser` transport, storage,
malformed, or unclassified failures retain the encrypted retry session and
durable record behind the pre-Auth gate. No operation ID, capability, provider
state, or timestamp is returned. Do not release a mobile build using this
contract before the Edge function and migration `0048` RPC are deployed
coherently.

### Open session-publication fence

The current authenticated `preflight` is a fail-closed check, but its database
transaction and account advisory lock end before the client publishes the
Supabase session and configures or logs in to RevenueCat. Deletion can begin in
that interval. A stale `clear` result therefore cannot prove that provider
publication is still admitted, and a late RevenueCat SDK request could recreate
a customer after the worker observed absence. This is a release blocker, not a
live-evidence omission.

The next bounded source slice must add a two-phase, server-serialized
publication lease under the same per-account lock:

1. reserve a short-lived, owner-authenticated publication capability;
2. activate it immediately before session publication;
3. require the active lease for every RevenueCat operation and renew only while
   no deletion barrier exists;
4. have deletion intake cancel reservations and drain active leases without
   allowing their deadline to extend;
5. release only after local provider work has stopped and identity reset has
   completed; and
6. keep the worker and finalization blocked through lease expiry plus a
   provider settling interval, with repeated absence checks before completion.

The lease table must be sealed behind narrow service-role RPCs, retain drain
evidence across Auth hard deletion, store only a digest of a client-generated
256-bit in-memory capability, and expose no user, operation, provider, or timing
details to the client. Deterministic PostgreSQL concurrency tests must cover
reserve/begin/activate and renew/begin lock order, multi-device drain, hard
deletion, finalization denial, privilege denial, and retention. Mobile tests
must cover backgrounding, process death, configure-in-flight, reset failure,
lost release, and every RevenueCat wrapper failing closed without a matching
lease.

Even that protocol governs only updated compliant clients. RevenueCat's public
SDK accepts caller-selected App User IDs, so old or tampered binaries may still
recreate a deleted identifier. A finite settling interval cannot be described
as mathematical prevention without a documented provider bound. Provider-side
blocking or a continuing detect-and-redelete control requires written
RevenueCat approval, privacy/legal review, and sandbox evidence before it can be
accepted as the production residual-risk control.

`EdgeRuntime.waitUntil` starts a best-effort worker after accepted intake, but
it is only a latency optimization. Supabase documents runtime ceilings and
local instance termination after a response; therefore the separately
authenticated Cron `work` lane is authoritative. Each invocation has a
20-second application budget, at most 20 claims, a 20-row finalization batch,
and a 100-row maintenance batch. Database leases and account advisory locks,
not the scheduler, prevent unsafe concurrent mutation.

## Exact Edge environment contract

All secret values belong in Supabase Edge Function secrets, never source,
mobile/EAS public variables, shell history, logs, or evidence. Supabase provides
`SUPABASE_URL` and secret-key material to hosted Edge Functions; the deployed
function uses the privileged key only inside the server runtime.

### Required before deployment

The Phase 2 strict gate requires every row below. The runtime rejects missing
or malformed payload, receipt, worker, RevenueCat V2, and tombstone values at
module startup. `APP_ENV` is operationally mandatory so the PostHog-required
decision cannot depend on an omitted server-stage label.

| Name                                                 | Exact contract                                                                                                     | Rotation/ownership note                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `APP_ENV`                                            | `development`, `staging`, or `production`; must match `EXPO_PUBLIC_APP_ENV` when the latter is set                 | Environment configuration, not a secret                                      |
| `ACCOUNT_DELETION_PAYLOAD_KEY_HEX`                   | Exactly 64 lowercase hex characters (32 independent random bytes)                                                  | AES-256-GCM payload key; no online multi-key decrypt support exists          |
| `ACCOUNT_DELETION_RECEIPT_HMAC_KEY_HEX`              | Exactly 64 lowercase hex characters, independent of every other key                                                | HMAC-SHA-256 subject pseudonym key                                           |
| `ACCOUNT_DELETION_RECEIPT_HMAC_KEY_VERSION`          | Decimal integer `1`-`32767`, no sign or leading zero                                                               | Advance with the receipt key                                                 |
| `ACCOUNT_DELETION_WORKER_SECRET`                     | Exactly 64 lowercase hex characters, independent of every other key                                                | Copy the same value privately into Vault as `account_deletion_worker_secret` |
| `REVENUECAT_PROJECT_ID`                              | Trimmed, nonempty RevenueCat project identifier, at most 255 characters                                            | Bind the provider project into tombstone HMAC inputs                         |
| `REVENUECAT_V2_SECRET_API_KEY`                       | Trimmed server-only RevenueCat **V2** secret, at most 1,000 characters                                             | V1 keys do not work with REST API v2; legacy key names are not substitutes   |
| `REVENUECAT_IDENTITY_TOMBSTONE_HMAC_KEYS`            | `version=<64 lowercase hex>` entries separated by `;`; 1-4 entries, strictly increasing versions, unique key bytes | Shared by deletion and webhook; independent key material                     |
| `REVENUECAT_IDENTITY_TOMBSTONE_HMAC_CURRENT_VERSION` | Decimal integer `1`-`32767` naming an entry in the keyring                                                         | New tombstones use this version                                              |

The RevenueCat V2 key must be scoped to the exact project and only the
permissions used by preflight/reconciliation/deletion:
`project_configuration:projects:read`,
`customer_information:customers:read`, and
`customer_information:customers:read_write`. RevenueCat's current V2 docs say
V1 keys do not work with V2 and identify
`customer_information:customers:read_write` for deleting a customer.

### Conditional Apple contract

For automatic revocation on an Apple-linked account, configure all of:

- `APPLE_TEAM_ID`
- `APPLE_SIWA_KEY_ID`
- `APPLE_SIWA_CLIENT_ID`
- `APP_IOS_BUNDLE_IDENTIFIER`
- `APPLE_SIWA_PRIVATE_KEY`

`APPLE_SIWA_CLIENT_ID` must exactly equal `APP_IOS_BUNDLE_IDENTIFIER`. The
private key is the `.p8` signing material. The exchanged token response must be
cryptographically bound to the authenticated account's exact Apple subject
before its token can be selected for revocation; an HTTP success alone is not
identity proof. Revocation success requires Apple's exact `200` response and
the expected no-body contract. Missing/unusable configuration or an unusable
fresh authorization code must produce the durable manual-revocation notice; it
must never be represented as automatic success.

Automatic and manual branches still require a real Sign in with Apple account
on a physical iPhone before release. The mobile source registers Expo's native
revoke listener and validates the authenticated Apple subject before publishing
a restored session and again at foreground. Unknown/error results stay behind a
retryable session gate. Confirmed invalid credentials enter a durable quarantine,
stop refresh/account activity, clear auth-derived ephemeral state, and preserve
owner-bound local-first records until a fresh owner boundary succeeds. Retain
physical-iPhone evidence for the notification/state path, retry/relaunch,
same-owner recovery, and different/unprovable-owner cleanup. Apple's
server-to-server `consent-revoked` endpoint and delivery evidence also remain
external gates wherever selected or required. This runbook does not claim those
live paths are complete.

### Conditional PostHog contract

PostHog deletion is required whenever either app environment is not
`development`, or any of `EXPO_PUBLIC_POSTHOG_KEY`, `POSTHOG_PROJECT_ID`, or
`POSTHOG_PERSONAL_API_KEY` is configured. In that state all of these are
required:

| Name                                | Exact contract                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `POSTHOG_API_HOST`                  | `https://eu.posthog.com`                                                                                                  |
| `POSTHOG_PROJECT_ID`                | Trimmed project identifier                                                                                                |
| `POSTHOG_PERSONAL_API_KEY`          | Trimmed server-only personal key                                                                                          |
| `POSTHOG_CAPTURE_SHUTDOWN_AT`       | Canonical UTC ISO-8601 instant, not future                                                                                |
| `POSTHOG_ABSENCE_INTERVAL_SECONDS`  | Explicit integer `1`-`86400`; runtime default is `60`, but deploy validation does not permit an implicit production value |
| `POSTHOG_NO_RECORDINGS_EVIDENCE`    | Exact literal `production_capture_disabled_and_storage_audited`                                                           |
| `POSTHOG_NO_RECORDINGS_VERIFIED_AT` | Canonical UTC ISO-8601 instant at/after capture shutdown and not future                                                   |

Do not set the evidence literal merely to satisfy validation. Production
capture must actually be stopped and project storage must be audited. This is
an external privacy/security evidence gate.

### Bounded optional settings

- `EDGE_EXTERNAL_FETCH_TIMEOUT_MS`: `1000`-`30000`, default `5000`.
- `USER_EDGE_BODY_MAX_BYTES`: `1024`-`65536`, default `16384`.

Invalid values fall back to the runtime default; the Phase 2 validator rejects
them so staging and production never depend on that fallback.
`EDGE_EXTERNAL_RESPONSE_MAX_BYTES` is a shared Edge setting but is not the
account-deletion provider-body limit; deletion responses are independently
capped at 16,384 bytes in source.

## Key generation and secret loading

Generate every 32-byte value independently in an approved secret manager or a
private operator terminal. Never reuse the payload, receipt, worker, or
tombstone key. Never retain command output in CI logs or evidence.

Use an ignored, access-restricted temporary environment file with
`supabase secrets set --env-file <private-path> --project-ref <ref>`, or set
individual secrets through the Supabase Dashboard. `supabase secrets list`
may be retained only as redacted name/status evidence; it does not prove the
values are correct. Supabase says updated Edge secrets become available without
a function redeploy, but this runbook still requires a post-rotation boot and
work-lane probe.

## Coherent deployment order

Run this sequence on staging first from one frozen clean revision. Production
requires a separate authorization and evidence set.

1. Record the revision, project ref, existing function versions, migration
   state, backup/PITR posture, incident owner, and rollback owner. Confirm all
   required Edge secrets by **name only**.
2. Run local Deno checks/tests, migrations 0048-0051 rehearsals on supported
   PostgreSQL versions, the Phase 2 env smoke, Edge manifest checks, policy
   lint, and the account-deletion work-lane smoke.
3. Deploy the new `account-deletion` function **before** migration 0048. Until
   its RPCs exist it fails intake/work closed with `503`; this short maintenance
   error is safer than allowing the old synchronous function to run against the
   new lifecycle schema.
4. Apply, without reordering or skipping:
   `20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql`,
   `20260713000049_revenuecat_deletion_barrier_guard.sql`,
   `20260713000050_service_writer_deletion_barriers.sql`, then
   `20260713000051_revenuecat_identity_tombstones.sql`.
5. Immediately deploy every `deployByDefault` function from the same revision.
   At minimum this coherently updates `account-deletion`,
   `revenuecat-webhook`, `subscription-grants`, `catalog-report`, and the
   rate-limit-owning user functions. Revoked direct writer privileges make old
   writer code fail closed during this bounded window.
6. Re-run function boot, negative auth, RLS/policy, provider-shape, and database
   rehearsal checks against staging. Do not provision Cron while boot or auth
   is failing.
7. In the private Supabase Vault UI, create exactly one secret named
   `account_deletion_project_url` containing the exact hosted project origin,
   and exactly one `account_deletion_worker_secret` containing the same value
   as the Edge worker secret. Do not put either value in the SQL file.
8. Run `supabase/ops/account-deletion-work-lane.sql` as the project Postgres
   owner. It validates Vault, replaces only the canonical named job, and
   schedules `{"action":"work"}` every minute with a 30-second `pg_net`
   timeout.
9. Prove a missing and a fake worker header return `401`, then observe a
   Vault-backed run return `200` with `status=worked`. Never paste the real
   worker secret into a retained transcript.
10. Execute an authorized disposable staging deletion through `begin`,
    authenticated `preflight`, and capability-only `status`, including clear
    before intake, active after intake, direct-RPC privilege denial, stale Auth
    rejection, provider delay/reconciliation, second-device relaunch, terminal
    receipt, expired capability, late webhook, and stale-session writer
    attempts. Verify no candidate session or RevenueCat identity publishes
    while the barrier is active, plus zero database, Storage, provider, and
    account-derived rate-limit residue.

The existing staging wrapper pushes all pending migrations before deploying
functions. For this lifecycle cutover, step 3 is a mandatory manual predeploy;
do not run the wrapper alone against an old account-deletion deployment.

## Scheduler verification

The source-controlled SQL is environment-neutral and deliberately contains no
secret value. Its stored `cron.job.command` references Vault by name and does
not contain a general Supabase secret/publishable key. `verify_jwt=false` is
required because `status` and `work` use custom high-entropy capabilities; the
handler performs the action-specific authentication itself.

Use these non-secret checks after provisioning:

```sql
select jobid, jobname, schedule, active
  from cron.job
 where jobname = 'account-deletion-work-lane';

select status, start_time, end_time, return_message
  from cron.job_run_details
 where jobid = (
   select jobid from cron.job where jobname = 'account-deletion-work-lane'
 )
 order by start_time desc
 limit 20;

select status_code, error_msg, created,
       case
         when content::text like '%"status":"worked"%' then 'worked'
         else 'other'
       end as response_kind
  from net._http_response
 where created > now() - interval '6 hours'
 order by created desc
 limit 50;
```

`cron.job_run_details` proves the SQL job ran; it does not prove the asynchronous
HTTP request succeeded. Correlate with `net._http_response` and the Edge
Function invocation/log view. Supabase documents that `pg_net` requests start
after transaction commit and response rows are retained for about six hours by
default.

## Monitoring and operator response

Dashboards and alerts must use counts, stable result codes, operation age, and
function status. Do not export user IDs, capabilities, claim digests, encrypted
payloads, Vault values, provider bodies, aliases, or free-form errors.

Initial thresholds below are conservative operating proposals, not approved
production SLOs:

- page immediately on any scheduler `401`, repeated function boot error, or
  missing/inactive canonical Cron job;
- page when no successful `work` invocation is observed for three minutes;
- page on repeated `503`, `504`, `546`, or `pg_net` timeout/error responses;
- page on any operation within 24 hours of expiry, or any expired operation
  that remains after maintenance;
- queue immediate operator review for `action_required`, exhausted attempts,
  or an ambiguous/request-started provider step that exceeds its expected
  provider window;
- alert on expired RevenueCat tombstones or rate-limit rows surviving repeated
  maintenance invocations; and
- reconcile Edge invocation counts, Cron runs, active operations, terminal
  receipts, provider result codes, and support tickets daily during launch.

The database-side dashboard may aggregate these service-only tables without
selecting account IDs, capabilities, digests, or encrypted payloads:

```sql
select state, count(*) as operations,
       max(now() - created_at) as oldest_age,
       min(expires_at) as next_expiry
  from public.account_deletion_operations
 group by state
 order by state;

select step_name, status, coalesce(result_code, 'NONE') as result_code,
       count(*) as steps,
       min(next_attempt_at) as next_attempt,
       min(lease_expires_at) as next_lease_expiry
  from public.account_deletion_steps
 group by step_name, status, coalesce(result_code, 'NONE')
 order by step_name, status, result_code;

select count(*) filter (
         where status in ('leased', 'request_started')
           and lease_expires_at < now()
       ) as expired_leases,
       count(*) filter (
         where status in ('ambiguous', 'action_required')
       ) as operator_review_steps
  from public.account_deletion_steps;

select count(*) filter (where expires_at <= now()) as expired_tombstones,
       min(expires_at) as next_tombstone_expiry
  from public.revenuecat_identity_tombstones;
```

Retain only the aggregates and query timestamp in monitoring evidence. A
dashboard must not gain direct end-user access merely to make these queries
convenient.

Operator recovery must use the guarded recovery RPC with a unique
high-entropy command token, an allowlisted reason, and evidence that determines
`dispatch` versus `reconcile`. Never redispatch a provider mutation merely
because its response was lost.

## Rotation

### RevenueCat V2 API key

The encrypted RevenueCat executor state contains a one-way binding to the exact
configured V2 credential. The runtime supports one active V2 key, not an
old/new keyring. Changing the configured key while an operation retains
RevenueCat state deliberately moves that step to configuration-required rather
than processing old evidence under a new authority.

For a planned rotation, first put an operator-owned intake freeze in force,
unschedule Cron, and prove there are zero unfinished RevenueCat steps. Create a
new V2 key for the same exact project with only project read, customer read,
and customer read/write; set `REVENUECAT_V2_SECRET_API_KEY`; run boot,
wrong-project, read, and disposable-customer deletion/reconciliation canaries;
then restore Cron and intake. Revoke the old key only after the zero-old-state
assertion and canary evidence are reviewed. If no reliable intake freeze is
available, do not attempt a planned live rotation. A suspected compromise is
an incident-specific recovery: contain dispatch, preserve encrypted state, and
use the guarded recovery process; never edit the stored credential binding or
blindly redispatch a request.

### RevenueCat tombstone HMAC keyring

This is the only current online overlap mechanism:

1. Generate a new independent key and append its greater version to the
   keyring while leaving `CURRENT_VERSION` unchanged.
2. Update both account-deletion and webhook environments and verify both boot
   and compute lookups across every configured version.
3. Switch `REVENUECAT_IDENTITY_TOMBSTONE_HMAC_CURRENT_VERSION` to the new
   version, redeploy both functions from one revision, and run staging
   delete/late-webhook probes.
4. Keep every prior key until no unexpired tombstone with that version exists.
   The current runtime creates tombstones for 824 days; migration 0051 allows at
   most 825 days. That engineering retention is **not** an approved privacy
   policy: RevenueCat must confirm alias/recreation behavior and privacy counsel
   must approve the finite duration before production.
5. Remove an old key only after the database proves zero unexpired rows for its
   version, there is no rollback target that requires it, and the privacy and
   incident owners sign off. The keyring supports at most four simultaneous
   versions, so rotation cadence must preserve the required overlap.

Removing an old key early can allow a deleted alias to evade the webhook
barrier. Treat that as a release-blocking privacy incident.

### Payload key

`ACCOUNT_DELETION_PAYLOAD_KEY_HEX` has no key version or multi-key decrypt path.
Do not rotate it while any operation or encrypted provider step exists. A
planned rotation requires stopped intake, drained/finalized operations, a
zero-active-state assertion, a retained rollback decision, then a boot/status
probe. An emergency compromise requires an incident-specific code/data
migration; simply replacing the key makes active encrypted payloads unreadable.

### Receipt key

Rotate the receipt HMAC key and version together. Existing capability receipts
remain capability-addressed; new receipts use the new version. Retain old key
material only if an approved audit process truly requires it, never in source.

### Worker secret

There is no dual-secret overlap. Unschedule the job, change the Edge secret,
change the Vault value privately, prove fake/missing headers still fail and the
Vault-backed call succeeds, then reschedule. A short fail-closed pause is
expected; active operations remain durable.

## Containment and rollback

- To stop new worker activity, unschedule only
  `account-deletion-work-lane`. This does not undo provider mutations or erase
  durable state.
- A missing/wrong worker secret, invalid startup configuration, unavailable
  provider, or failed RPC returns `401`/`503` or records a retry/action-required
  state. It must never return deletion success.
- Do not drop migrations 0048-0051, barriers, operations, receipts, recovery
  audit, or RevenueCat tombstones during rollback. Do not restore the old
  synchronous account-deletion function after migration 0048.
- Preserve the status endpoint and mobile recovery capability. If the function
  must be replaced, roll forward with a compatible build that can reconcile
  every existing step state.
- Preserve RevenueCat webhook tombstone checks even if entitlement processing
  is otherwise contained. An entitlement pause needs finance/engineering
  approval and a reconciliation plan.
- Never retry an ambiguous Apple, RevenueCat, PostHog, or Auth mutation by hand.
  Inspect durable state and use the guarded recovery path.
- After repair, redeploy the coherent function set, run one manual Vault-backed
  work call, restore Cron, and verify every pre-incident operation reaches an
  honest terminal or action-required state.

## External live gates

Code, static smoke, and local PostgreSQL rehearsals do not close these gates:

### Protected staging evidence workflow

Use the GitHub `Security` workflow's manual dispatch on the exact candidate
revision. The `live-supabase-adversarial` job is permitted to run only when the
operator explicitly checks `confirm_destructive_account_deletion` and the
protected `staging-security` environment review approves the job. That reviewed
job alone supplies `PHASE9_ALLOW_DESTRUCTIVE_ACCOUNT_DELETION=true`; pull
requests, pushes, scheduled jobs, and unconfirmed dispatches never receive the
authorization. The deletion account must be a disposable staging fixture with
no real user or provider data.

Configure the non-secret `STAGING_SUPABASE_PROJECT_REF` variable on that
protected environment from an independently reviewed staging project. It must
be the project's 20-character lowercase alphanumeric Reference ID. The
workflow maps it to `PHASE9_EXPECTED_SUPABASE_PROJECT_REF` and supplies exact
`APP_ENV=staging`. Both destructive-account harnesses stop before creating a
Supabase client or making a request unless `SUPABASE_URL` is exactly
`https://<reviewed-project-ref>.supabase.co`: ports, credentials, paths, query
strings, fragments, case changes, trailing slashes, and project-ref mismatches
all fail closed. The evidence stores only the validated expected/actual project
refs and parsed safe host, never the raw URL or credentials.

Supply the optional iOS EAS build UUID or `expo.dev` build URL when the live run
is intended to support a particular TestFlight candidate. The redacted Edge-auth
and data-rights artifacts record the exact Git SHA, workflow run ID and attempt,
Git ref, actor, repository, workflow/event identity, and supplied iOS build ID.
For reruns, the packet records both the original `github.actor` and the
`github.triggering_actor` that initiated the rerun.
The workflow removes tracked/stale copies before running, writes a secret-free
step-outcome manifest, and uploads the account-deletion evidence even when a
harness fails. Artifact retention is bounded to 30 days; copy the reviewed
artifact link into the immutable RC packet before expiry. A generated artifact
must never contain JWTs, capabilities, temporary emails, raw response bodies,
provider/database messages, or secret values.

For an explicitly authorized local staging investigation, set the exact
40-character `PHASE9_EVIDENCE_SOURCE_SHA`, exact `APP_ENV=staging` and
`EXPO_PUBLIC_APP_ENV=staging`, the reviewed
`PHASE9_EXPECTED_SUPABASE_PROJECT_REF`, and its exact canonical `SUPABASE_URL`.
Then run
`phase9:live-edge-auth:strict`, and set both
`PHASE9_RUN_LIVE_DATA_RIGHTS=true` and
`PHASE9_ALLOW_DESTRUCTIVE_ACCOUNT_DELETION=true` only for the
`phase9:live-data-rights:strict` process. This local path does not replace the
protected workflow review or archived workflow evidence. Any cleanup failure or
strict warning blocks the run and the generated artifact must not claim pass.

The live Edge-auth packet must include an authenticated `preflight` returning
only exact `{ "status": "clear", "ownerSubject": "<authenticated UUID>" }` for a fresh live session, an active-barrier
case returning only `{ "status": "active", "ownerSubject": "<authenticated UUID>" }`, exact
`401 {"error":"ACCOUNT_DELETION_SESSION_REJECTED"}` for missing/invalid bearer credentials, and that exact `401` after the
synthetic Auth user is deleted while its old token is replayed. Unknown fields,
operation identifiers, capabilities, phases, and timestamps are forbidden in
the response. The destructive data-rights run separately proves active-barrier
and terminal lifecycle behavior. It cannot close the open
preflight-to-publication source race; the publication-lease implementation must
land first, after which reviewed multi-device race evidence remains an external
gate.

- hosted Supabase reset/migration, RLS, Storage, Cron/Vault, lease concurrency,
  function limit, and failure-injection evidence in staging and production;
- a real RevenueCat V2 key (not a V1 key) with the exact project and least
  permissions; sandbox preflight, `200` and `202` delete handling,
  reconciliation, alias/transfer, restore/recreation, late webhook, renewal,
  and tombstone-retention evidence;
- PostHog EU production-project capture shutdown, no-recordings audit, person
  lookup, async deletion status, double-absence, and no-reappearance evidence;
- Sign in with Apple fresh-code exchange/revocation and manual-notice recovery
  on a supported physical iPhone, including authenticated-subject binding and
  an exact `200`/no-body revoke response;
- Apple credential-revoked notification/state handling on a supported physical
  iPhone through the implemented native listener, including quarantine,
  relaunch, retry, same-owner recovery, and different-owner cleanup; plus the
  server-to-server `consent-revoked` event path wherever selected or required;
- Supabase Auth one-hard-delete/read-only-reconciliation behavior and stale JWT
  writer rejection against the hosted project;
- mobile accepted/lost-response/relaunch/delayed/invalid/expired/completed/manual
  recovery branches on the exact TestFlight build;
- named privacy/security/legal review of scope, retention, operator access,
  incident handling, policy copy, and vendor terms; and
- Apple review and founder release authorization.

## Primary sources checked

- [Supabase: Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase: Background Tasks](https://supabase.com/docs/guides/functions/background-tasks)
- [Supabase: Environment Variables and secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase: Cron](https://supabase.com/docs/guides/cron)
- [Supabase: Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase: pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Supabase: Edge Function logging](https://supabase.com/docs/guides/functions/logging)
- [Supabase: Edge Function limits](https://supabase.com/docs/guides/functions/limits)
- [RevenueCat: Identifying customers](https://www.revenuecat.com/docs/customers/identifying-customers)
- [RevenueCat: SDK configuration](https://www.revenuecat.com/docs/getting-started/configuring-sdk)
- [RevenueCat: Blocking customers](https://www.revenuecat.com/docs/customers/blocking-customers)
- [RevenueCat: Customer-profile deletion](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile)
- [RevenueCat: REST API v2](https://www.revenuecat.com/docs/api-v2)
- [RevenueCat: REST API v2](https://www.revenuecat.com/docs/api-v2)
- [Apple TN3194: Account deletion and Sign in with Apple token revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
