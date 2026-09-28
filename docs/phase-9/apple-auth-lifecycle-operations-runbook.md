# Phase 9 Sign in with Apple Lifecycle Operations Runbook

Date: 2026-07-15
Status: locally verified source; hosted, device, professional, and Apple evidence open

This runbook covers migration `20260715000055_apple_auth_lifecycle.sql`, the
`apple-auth-lifecycle`, `apple-account-events`, and `apple-auth-worker` Edge
Functions, and `supabase/ops/apple-auth-work-lane.sql`. It is an operations
contract, not a claim of legal compliance, App Review acceptance, or production
readiness.

## Local Source Evidence

The current migration-0055 candidate passed two clean disposable resets, exact
54-migration history through 0055, the full structural pgTAP suite plus 114/114
Apple lifecycle assertions, schema lint, an empty migration shadow diff, and
temporary database type generation. The focused Apple event/lifecycle Edge
suite passed 20/20; the complete Apple auth work-lane command below passed
47/47. These are source and disposable-database results only. They do not prove
the hosted secret values, registered Apple endpoint, genuine Apple delivery,
Vault/Cron continuity, stale-JWT denial, or physical-device behavior.

## Security And Evidence Boundary

- The native request creates independent 32-byte CSPRNG `state` and raw
  `nonce` values. Apple receives `SHA-256(raw nonce)`; the app requires an exact
  state echo and gives Supabase and the lifecycle server the raw nonce.
- Apple's identity token, one-use authorization code, and Apple user subject
  are bounded and tied to one composite remote-admission permit. The
  authorization code is not sent to Supabase Auth; the lifecycle function is
  the only component allowed to exchange it for a refresh token.
- The newly authenticated or linked Supabase session is not publishable until
  the server verifies the identity token and nonce, matches the exact Apple
  identity on the exact Supabase user/session, consumes the capture operation,
  exchanges the code, and stores the refresh token in the encrypted vault.
- Cancellation is a neutral user choice. Missing, reused, expired, mismatched,
  or ambiguously exchanged credentials fail closed and require a fresh native
  authorization; never retry a one-use code blindly.
- Apple-backed accounts require an `active` lifecycle with a validation no
  older than 72 hours. The database checks the exact `auth.jwt().session_id`
  against `auth.sessions`, applies restrictive read policies to owner data and
  photo Storage, and extends the existing write fence. Authenticated Edge
  Functions recheck the same account-access state at their request and response
  boundaries. Non-Apple accounts do not require an Apple lifecycle row.
- Sealed lifecycle, capture, and server-event tables deny direct access to
  `anon`, `authenticated`, and `service_role`. Operators use narrow RPCs or an
  audited database-owner session; no raw code, token, JWS, subject, relay email,
  or session identifier belongs in logs or evidence.
- Only a verified terminal event may pass its signed Apple subject transiently
  into the service-only database RPC to match an exact Apple Auth identity.
  Nonterminal events pass no raw subject to the RPC, and no raw subject is
  persisted. Database statement/error logging must not capture service-RPC
  parameters.

Apple documents that the authorization grant code is single-use and that a
refresh token should be validated no more than once per day. See
[Authenticating users](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple),
[Receiving a user's identity token](https://developer.apple.com/documentation/signinwithapple/receiving-a-users-identity-token),
and
[Verifying a user](https://developer.apple.com/documentation/signinwithapple/verifying-a-user).

## Coherent Hosted Cutover

Do not apply migration 0055 as an isolated dashboard change. It intentionally
blocks an Apple-linked account that has no successfully captured lifecycle.

1. Freeze new Apple sign-in/linking and account publication. Establish either
   a zero-installed-cohort proof or an enforced compatible-version/recovery
   plan for every existing Apple-linked account. Existing accounts cannot be
   backfilled from an old identity token; they need fresh user-authorized
   capture.
2. Configure the reviewed Apple identifiers and secrets through the hosted
   secret manager. `APPLE_SIWA_CLIENT_ID` must equal the native bundle
   identifier used by this flow. Never put server secrets in EAS public values,
   the app bundle, the repository, tickets, evidence, or chat.
3. Deploy the complete manifest from one revision, including all three Apple
   functions and every authenticated function carrying the account-access
   fence. Confirm the configured `verify_jwt` posture before migration:
   `apple-auth-lifecycle=true`, `apple-account-events=false`, and
   `apple-auth-worker=false`.
4. Apply migration 0055 through the reviewed migration path. Prove its exact
   history, table/function ACLs, RLS policies, Storage fence, and stale-session
   denials; do not mutate the schema by hand.
5. Run negative-auth probes before accepting traffic: missing/invalid Supabase
   bearer on lifecycle capture, malformed/unsigned Apple event JWS, and
   missing/wrong worker secret must all fail before privileged work.
6. Register the signed Apple event endpoint and provision the one-minute worker
   only after their deployed handlers and database RPCs pass canaries.
7. On a supported physical iPhone, capture a fresh Apple authorization, verify
   that the composite session becomes active only after lifecycle success, and
   test relaunch, foreground state checks, invalid/revoked/transferred state,
   account switching, and deletion. Reopen Apple sign-in only after the exact
   hosted build and rollback owner are recorded.

The source checks are:

```powershell
npm run phase9:edge-manifest-check
npm run phase9:edge-manifest-smoke
npm run phase9:supabase-policy-lint
npm run phase9:rls-adversarial-smoke
npm run phase9:apple-auth-work-lane-smoke
```

They do not replace the hosted or physical-device matrix.

## Server Secret Inventory And Rotation

| Boundary                             | Configuration                                                                                                       | Rotation truth                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple client authentication          | `APPLE_TEAM_ID`, `APPLE_SIWA_KEY_ID`, `APPLE_SIWA_PRIVATE_KEY`, `APPLE_SIWA_CLIENT_ID`, `APP_IOS_BUNDLE_IDENTIFIER` | Rotate through the Apple Developer account and deploy the matching key ID/private key together. Retain the old Apple key until canaries prove the new client-secret path.                                                                                                             |
| Apple-subject pseudonym              | `APPLE_SIWA_SUBJECT_HMAC_CURRENT_VERSION`, `APPLE_SIWA_SUBJECT_HMAC_KEYS`                                           | JSON keyring of one to three named 32-byte lowercase-hex keys. New captures use the current version; event matching and validation can use retained versions.                                                                                                                         |
| Refresh-token vault                  | `APPLE_SIWA_VAULT_CURRENT_VERSION`, `APPLE_SIWA_VAULT_KEYS`                                                         | JSON keyring of one to three named 32-byte lowercase-hex AES-256 keys. New captures use the current version. Every successful daily validation freshly seals the token under the current key; dormant, deferred, or failing rows do not advance merely because configuration changed. |
| Capture replay digest                | `APPLE_SIWA_CODE_HMAC_KEY_HEX`                                                                                      | One 32-byte lowercase-hex key, not a versioned keyring. Rotate only in a capture freeze after nonterminal captures expire and retained capture artifacts are reconciled/purged.                                                                                                       |
| Event replay and relay-email digests | `APPLE_SIWA_EVENT_HMAC_KEY_HEX`                                                                                     | One 32-byte lowercase-hex key, not a versioned keyring. Stored JTI/payload digests have no key version, so routine independent rotation is unsafe without a reviewed versioned migration and replay analysis.                                                                         |
| Worker authentication                | `APPLE_AUTH_WORKER_SECRET`                                                                                          | Independent 64-character lowercase-hex value. It must exactly match the Vault value named `apple_auth_worker_secret`; no dual-secret overlap exists.                                                                                                                                  |

Generate random values only inside an approved secret manager or private
operator session. Record key versions and change references, never secret
values or secret-derived samples. Apple currently permits at most two Sign in
with Apple private keys per primary app, so introduce and prove the replacement
before revoking the old key; see Apple's
[environment configuration](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple).

For subject/vault keyring rotation:

1. In an audited database-owner session, aggregate active references by
   `subject_hmac_key_version` and `vault_key_version`, plus nonterminal capture
   references and unresolved terminal `unknown_subject` event references by
   subject version. Do not export row identifiers.
2. Add the new version while retaining every referenced old version, set it as
   current, update all dependent Apple/deletion functions from the same secret
   revision, and deploy them together.
3. Run new-capture, daily-validation, signed-event, credential-invalidation,
   and account-deletion canaries. On every successful validation, confirm the
   CAS atomically writes the current subject digest/version and a fresh
   owner/subject/client-bound vault envelope/current vault version together
   with the validation time and next schedule. Confirm old rows remain readable
   during overlap.
4. Retire an old subject or vault key only after zero-row evidence exists for
   every table that needs it. Healthy due rows advance through successful daily
   validation, but dormant, deferred, or failing rows still require successful
   validation, account recapture/reauthorization, lifecycle retirement, or a
   separately reviewed rewrap migration. An old subject key must also remain
   while any terminal `unknown_subject` event depends on it for capture-time
   reconciliation; reconcile or disposition that evidence under the reviewed
   retention/deletion procedure before retirement. Removing a referenced key
   deliberately causes fail-closed reauthentication; it is not a seamless
   rotation.
5. If canaries fail, restore the prior current version while keeping both keys,
   redeploy the coherent function set, and investigate before any key removal.

Rotate the single code/event HMACs only under an incident-specific or separately
reviewed maintenance plan. Never replace an event HMAC merely to satisfy a
calendar: doing so loses cross-key duplicate recognition for retained event
digests. Worker-secret rotation requires a short worker freeze, setting the
same new value in Edge secrets and Vault, rerunning the work-lane SQL, negative
old/new-secret probes, and immediate schedule restoration. Keep the outage well
inside the 72-hour access ceiling.

## Apple Server-To-Server Endpoint

Register this exact absolute endpoint on the primary Sign in with Apple App ID
for the intended grouping:

```text
https://<reviewed-project-ref>.supabase.co/functions/v1/apple-account-events
```

Apple permits one absolute notification URL per Sign in with Apple grouping and
key, requires registration on the primary App ID, and requires TLS 1.2 or
later. Staging and production therefore need intentionally isolated identifiers
or a separately reviewed relay; do not point two environments at one grouping
and assume both receive events. Follow Apple's current
[server-to-server notification setup](https://developer.apple.com/help/account/capabilities/enabling-server-to-server-notifications/).

The endpoint is public at the Supabase gateway because Apple cannot present a
Supabase JWT. Public routing is not public authorization. It accepts only
`POST application/json` with the exact outer object `{ "payload": "<compact
JWS>" }`, verifies Apple's RS256 signature against bounded JWKS, exact issuer
and client audience, clocks, JTI, event schema, and subject, then stores keyed
digests rather than the raw JWS. Unknown signed event types are quarantined as
`ignored_unknown`; signature or verified-claim failures return the uniform
`INVALID_NOTIFICATION` rejection.

For `consent-revoked` or `account-deleted`, a unique exact Apple identity can be
closed even when its lifecycle row does not exist yet: the service-only RPC
acquires the account-deletion lock, creates a no-vault terminal lifecycle,
maps the keyed event, deletes sessions, and queues the six-step deletion graph.
If Auth has not inserted that identity yet, the endpoint retains only immutable
keyed event evidence plus the verified client audience as `unknown_subject`.
The first later capture submits current and retained subject aliases and, under
the same owner lock, reconciles a matching terminal event before the one-use
code is marked or sent to Apple. It creates/updates the no-vault terminal
lifecycle, maps the event, deletes sessions, queues deletion, and returns
`blocked`. An exact duplicate can opportunistically promote prior unknown
evidence after the identity appears, but recovery does not depend on that
duplicate arriving.

Retain redacted live evidence for `email-enabled`, `email-disabled`,
`consent-revoked`, and `account-deleted` where Apple makes each scenario
available. These spellings match Apple's current
[account-change processing contract](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts).
Source verification cannot prove Apple registered the URL, delivered an event,
or associated the intended App ID grouping. Duplicate delivery is possible, but
recovery must not depend on Apple replaying a notification missed during an
outage; reconcile through an approved account/provider procedure.

## Private Email Relay Domain Compatibility

Apple announced that new Sign in with Apple private-relay addresses transition
from `privaterelay.appleid.com` to `private.icloud.com` beginning June 15, 2026,
while existing legacy addresses continue to work. Before release, every email
validator, sender allowlist, suppression/bounce processor, support workflow,
and routing rule must accept and preserve both domains without assuming either
one identifies a different user. Retain exact provider-console and end-to-end
delivery/bounce evidence for both domains.

The source HMAC test proves this repository can normalize and digest addresses
from both domains without retaining plaintext. It does not prove that an email
vendor, DNS configuration, Apple relay registration, suppression list, or live
delivery path is configured. See Apple's
[Private Email Relay domain update](https://developer.apple.com/news/?id=sus6t6ab).

## One-Minute Validation Worker

After the compatible migration and function deployment:

1. Through a private operator path, create exactly one Vault secret named
   `apple_auth_project_url` with the canonical hosted project origin and one
   named `apple_auth_worker_secret` with the exact independent worker secret.
2. Run `supabase/ops/apple-auth-work-lane.sql` as the project Postgres owner.
   The transaction validates both Vault values, removes any prior job named
   `apple-auth-work-lane`, and creates one `* * * * *` `pg_cron` job that calls
   `/functions/v1/apple-auth-worker` with `{ "action": "work" }` through
   `pg_net` and a 55-second timeout.
3. Confirm exactly one active job, a recent successful run, and a successful
   bounded worker response. Prove missing and wrong worker secrets return 401
   before claims or service-role work.
4. Alert on a missing/disabled job, repeated job failures, no successful run in
   five minutes, growing due/expired leases, and validation age approaching 48
   hours. At 72 hours the database fails access closed; do not extend or bypass
   that ceiling to hide a worker outage.

The worker claims at most 25 rows per invocation and processes five at a time.
It validates a stored refresh token no more than once in the rolling day,
rechecks the current Auth Apple subject and keyed subject binding, and either
validates, defers a network/rate-limit ambiguity for one day, or invalidates the
lifecycle on terminal token/subject/vault failure.

One source-controlled job per minute times the 25-claim cap is a nominal ceiling
of 36,000 validations per day, before failures, retries, execution overlap,
Apple throttling, or hosted resource limits. It is not arbitrary-scale proof.
Alert on oldest due-row age and sustained queue growth. Increase capacity only
after reviewed hosted Apple/Supabase latency, rate-limit, concurrency, and cost
evidence, with an updated load and failure model.

## Monitoring And Incident Triage

Use aggregate, redacted telemetry only. Alert on:

- capture `failed`/`expired` growth or repeated stable capture failure codes;
- lifecycle states by count, validation age buckets, due work, expired leases,
  and `action_required`/`revoked` transitions;
- worker `blocked`, `deferred`, and `stale` spikes or sustained zero
  `validated` results while due work exists;
- signed-event HTTP `401`/`503` rates and `unknown_subject`, `stale`,
  `ignored_unknown`, or duplicate-disposition spikes; include unresolved
  `unknown_subject` age and subject-key-version buckets;
- exact-session access denials, especially after a deployment or secret
  change;
- terminal Apple events that do not create/reuse the durable account-deletion
  operation and deletion barriers that do not progress; and
- data-export photo URL expiry checks that remain downloadable beyond 60
  seconds.

Never log or include in evidence authorization codes, identity/access/refresh
tokens, compact JWS payloads, private keys, worker secrets, raw Apple subjects,
relay email addresses, Supabase access JWTs, or raw user/session IDs. Stable
error/disposition codes, counts, finite timestamps, key-version labels, build
IDs, deployment IDs, and hashes are sufficient.

## Account Deletion And Data Export

In-app deletion may reuse the owner/session-bound encrypted Apple refresh token.
The deletion runtime opens it only in memory, immediately seals it under the
separate deletion-step key, begins the durable six-step deletion operation, and
then clears the reusable lifecycle vault. If the vault is absent, corrupt, or
not safely attributable, account erasure still proceeds and records the
truthful manual Apple-revocation outcome; token revocation never becomes a
precondition for deleting app-held data.

A verified Apple `consent-revoked` or `account-deleted` event invalidates the
lifecycle, deletes active Supabase sessions, and atomically creates or reuses
the same durable deletion coordinator. Its Apple step is terminal because Apple
has already ended authorization. `email-enabled` and `email-disabled` update
only keyed relay-email state. A terminal event that precedes the Auth identity
is reconciled at first capture before code exchange, so a missing provider retry
cannot reactivate the account. Duplicate and stale events do not repeat deletion.

`data-export` now issues caller-owned photo signed URLs for 60 seconds by
default and enforces a 60-second maximum (`DATA_EXPORT_PHOTO_URL_TTL_SECONDS`,
allowed range 30-60). The authenticated account-access fence is checked before
and after assembly. Already issued URLs cannot be retroactively revoked, so the
short TTL bounds residual exposure; hosted evidence must download before
expiry and fail after expiry.

## Containment And Rollback

- Freeze Apple sign-in/linking and new session publication first. Preserve the
  exact database and provider evidence; never delete lifecycle rows or clear
  failure codes to make a canary pass.
- Migration 0055 is a forward-only security boundary. Do not drop its tables,
  disable its RLS/policies, restore broad grants, or bypass
  `account_access_allowed()`. Roll forward with a compatible function/mobile
  fix.
- A pre-0055 client cannot satisfy capture or the server access fence. Do not
  roll back to it unless Apple auth is disabled and an approved
  mandatory-version/zero-cohort control prevents publication.
- If the worker is harmful, unschedule the named job and contain the function,
  but repair and restore it before validation ages reach the fail-closed
  ceiling. Do not mark accounts validated manually.
- If signed-event processing is harmful, keep invalid input rejected, contain
  the handler, preserve provider/deployment logs, and reconcile missed events
  through an approved procedure before reopening. Do not accept unsigned
  callbacks or infer Apple delivery.
- For a failed rotation, restore the previous key/version set without removing
  the new key, redeploy all dependent functions coherently, and rerun old/new
  row canaries. Never edit ciphertext, HMAC columns, generation counters, or
  worker claim state by hand.

## Gates That Remain Open

This source checkpoint does not close:

- reviewed hosted migration and complete function deployment;
- live Apple identifier/key configuration and actual server-event delivery;
- Vault/Cron continuity, rotation, outage, and rollback drills;
- existing-Apple-account recapture and mandatory-version cutover evidence;
- physical-iPhone and exact TestFlight tests for sign-in/linking, cancellation,
  relaunch, foreground checks, revoked/not-found/transferred states, account
  switching, and deletion;
- live stale-JWT/RLS/Storage/Edge denial, two-device and provider-outage tests;
- hosted terminal-before-identity/lifecycle capture blocking and deliberate
  fresh-reconsent recovery after terminal history;
- final privacy inventory, retention decisions, policy/support/privacy-report
  URLs, and non-expiring App Review access;
- named privacy, security, and legal review, including server-event retention,
  key rotation, transfer policy, and deletion claims; or
- Apple App Review, TestFlight approval, founder submission authorization, or
  public-release authorization.
