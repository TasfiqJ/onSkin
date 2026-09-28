# Durable Account Deletion Research And Implementation Contract

Date: 2026-07-13

Status: accepted engineering direction; implementation and live evidence in
progress. This memo is not legal advice, an App Review approval, or proof that a
vendor has erased production data. Privacy counsel, vendor confirmations, live
staging/production rehearsals, physical-iPhone evidence, and Apple review remain
separate launch gates.

## Outcome Required

Layerwell must let every account holder, including a signed-anonymous user, start
whole-account deletion inside the app. The request must immediately stop new
account writes, survive client and worker crashes, continue after the Auth user
is hard-deleted, expose a privacy-minimized status channel, verify first-party
and processor erasure, and provide a completion or action-required result.

Apple permits deletion to take time, but requires a straightforward in-app
initiation, clear timing/status communication, whole-account deletion, billing
guidance, and completion confirmation. Apple also expects Sign in with Apple
tokens to be revoked. These are product contracts, not optional polish:

- [Apple account-deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- [Apple account-management HIG](https://developer.apple.com/design/human-interface-guidelines/managing-accounts)
- [App Review Guidelines 5.1.1](https://developer.apple.com/app-store/review/guidelines/)
- [TN3194: Sign in with Apple deletion and revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [Sign in with Apple token revocation](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens)

The same design supports, but does not by itself prove, compliance with the
GDPR erasure right and Washington's My Health My Data Act. Washington expressly
requires covered health data to be deleted from the regulated entity's systems
and requires deletion notices to processors and other recipients, subject to
the statute's exceptions and backup timing rule:

- [GDPR, including Article 17](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)
- [Washington RCW Chapter 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)

The founder must obtain counsel's written scope, retention, backup, identity
verification, appeals, and geographic-launch decisions. Engineering must not
invent a retention basis or silently preserve data because it may be useful.

## Why The Request Must Become Asynchronous

The current providers do not share one atomic transaction. PostHog queues event
and recording deletion, RevenueCat can return an asynchronously accepted v2
customer deletion, Apple revocation is a separate network operation, Supabase
Storage must be emptied before Auth deletion, and provider calls can time out
after the provider has already acted.

An Edge Function instance is not a durable job owner. Supabase documents bounded
wall-clock/CPU limits and notes that background tasks stop at runtime limits;
local instances also terminate after the request unless specially configured.
The supported durable primitives are a Postgres-backed queue/work table plus a
scheduled consumer:

- [Supabase background tasks](https://supabase.com/docs/guides/functions/background-tasks)
- [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Queues / PGMQ](https://supabase.com/docs/guides/queues/pgmq)

`EdgeRuntime.waitUntil` may reduce latency, but correctness must come from
committed state, leases, compare-and-swap transitions, and scheduled retry.

## Durable State Contract

The public operation states are:

1. `accepted`
2. `sessions_revoked`
3. `provider_dispatched`
4. `local_erasing`
5. `local_verified`
6. `auth_deleted`
7. `provider_verifying`
8. `quiescence_verifying`
9. `completed`
10. `action_required`

Internal provider steps must distinguish at least `pending`, `leased`,
`request_started`, `ambiguous`, `retryable`, `succeeded`, and
`action_required`. The worker commits `request_started` before any external
network call. If it crashes or times out after that commit but before recording
the response, the step becomes `ambiguous`; it must never be treated as a clean
undispatched retry. This is especially important for RevenueCat, where a later
404 cannot prove that an earlier DELETE did not succeed.

The intake transaction must:

- authenticate the live caller and take the per-user advisory lock;
- validate a client-generated 256-bit idempotency token and independent
  256-bit status capability;
- atomically create or return the one active deletion operation;
- install the account-write barrier before returning;
- delete all account-owned rate-limit counters while holding the same lock;
- create the ordered provider/local/Auth verification steps; and
- return HTTP 202 without waiting for provider completion.

The durable tables are service-only. An active operation may retain the minimum
subject reference needed to finish deletion, with a hard expiry and stated
erasure purpose. After completion, it is replaced by a finite-lived receipt
keyed only by a versioned HMAC of the deleted subject and the hash of the random
status capability. A receipt contains no raw user UUID, email, provider handle,
request body, free-text error, or provider response.

## Write And Recreation Barrier

Supabase documents that deleting a user does not invalidate already-issued
JWTs; they remain valid until expiry. It also documents that an Auth user cannot
be deleted while that user owns Storage objects:

- [Supabase user deletion](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase sign-out scopes](https://supabase.com/docs/reference/javascript/auth-signout)
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)

Therefore all owner-table writes and photo Storage writes need an enforceable
database policy/trigger that requires both a live Auth row and no deletion
barrier. Service-role mutations, the deletion intake, finalization, and
RevenueCat webhook projection must use the same per-user advisory-lock domain.
Checking state only in the mobile client or Edge handler is insufficient.

Account rate limiting is split from public IP/user-agent limiting. Authenticated
scopes store an explicit cascading owner column and take the user advisory lock;
public scopes retain only a keyed hash and a fixed maximum TTL. Migration must
purge legacy authenticated-scope hashes because a rotated HMAC secret makes
exact account matching impossible.

## Provider-Specific Verification

### PostHog

Lookup must cover both the current pseudonymous distinct ID and the legacy raw
UUID, deduplicate returned person UUIDs, and delete by those person UUIDs. A
typed 202 only proves queue acceptance. The worker must poll
`/persons/deletion_status/?person_uuid=...&status=all` until the event-deletion
record is `completed` with a non-null verification timestamp, then repeat the
person lookup and require absence.

The status endpoint covers queued event deletion. PostHog's recording workflow
is separate and does not provide the same documented terminal status. Because
the app disables session replay, production still needs a live no-recordings
attestation and vendor/privacy approval. PostHog also states in source that only
events already captured are queued, so direct identified mobile capture must be
disabled or replaced with a barrier-aware backend path before launch.

- [PostHog API schema](https://eu.posthog.com/api/schema/)
- [Pinned PostHog person API source](https://github.com/PostHog/posthog/blob/f93c4d03c07d15da42e93cd05eb75204137f120d/posthog/api/person.py)
- [Pinned PostHog bulk-delete source](https://github.com/PostHog/posthog/blob/f93c4d03c07d15da42e93cd05eb75204137f120d/posthog/models/person/bulk_delete.py)

### RevenueCat

The current v1 path may report success only for its exact documented 200 body.
A v1 GET must never be used as an absence probe because RevenueCat documents
that subscriber GET can create a customer. The preferred production contract is
the v2 customer mapping plus GET/DELETE flow, whose DELETE documents 200, 202,
and 404 outcomes. Production still needs RevenueCat's written confirmation of
alias-family deletion, terminal verification, sandbox/production mapping, and
whether later App Store renewals recreate a deleted customer.

The implemented v2 worker applies a database-global provider budget keyed by a
one-way binding of the exact v2 credential. RevenueCat currently documents
per-minute, per-key/developer domain limits of 480 requests for Customer
Information and 60 for Project Configuration. The deletion lane uses fixed UTC
minute budgets of 225 and 25 respectively; even two adjacent full local buckets
remain below those documented domain limits (450 and 50). The only Project
Configuration call in this workflow is `GET /v2/projects`; mapping, customer
reads, and customer deletion are Customer Information calls. A missing quota
decision fails closed, defers the exact claim by 65 seconds, restores the claim's
attempt count, and stops the invocation from claiming more work.

Provider `Retry-After` and valid `backoff_ms` values are combined by taking the
maximum of the local 60-second floor and every response in the current parallel
batch, with a seven-day safety cap. Malformed retry metadata becomes durable
operator action instead of an immediate retry. The external-fetch deadline
remains active through the bounded response-body read or cancellation, not just
until headers arrive, so a stalled body cannot hold the worker indefinitely.

Full-family reconciliation accepts at most 64 aliases as a local fail-closed
bound, adds the lookup and canonical customer identities, and probes up to 14
identities concurrently behind the distributed quota. The maximum locally
accepted encoded family completes in 60 seconds in the deterministic harness
when every RevenueCat network wave consumes the enforced ten-second maximum,
within the 90-second worker budget. The number 64 is **not** represented as a
RevenueCat-supported alias
maximum: an overflow becomes `action_required`, and launch still needs written
provider confirmation or an approved operator procedure. Write-ahead probe state
also forces database absence observations to reset after an interrupted read;
no partial or pre-crash family scan can count as a complete absence round.

- [RevenueCat API v1](https://www.revenuecat.com/docs/api-v1)
- [RevenueCat API v2](https://www.revenuecat.com/docs/api-v2)
- [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks)
- [RevenueCat event fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)

Webhook processing must normalize every candidate Auth UUID, lock them in
sorted order, discard deleting/deleted candidates, and avoid storing their raw
IDs in event/audit rows. If all candidates are barred, suppress the event. If a
transfer contains a barred A and active B, persist only B and strip A from every
scalar, alias, and transfer field.

#### Session publication and late recreation

An authenticated `preflight=clear` response is not a durable admission grant.
Its transaction ends before the app publishes the Auth session or calls the
RevenueCat SDK, so deletion can begin in that interval. Supabase documents that
each user access token carries a `session_id` corresponding to
`auth.sessions`, and that checking this row is the stronger way to reject a JWT
after sign-out. The publication protocol therefore binds a memory-only random
capability to both the verified JWT subject and that verified session ID:

- [Supabase sessions and post-sign-out session checks](https://supabase.com/docs/guides/auth/sessions)
- [Supabase JWT claims](https://supabase.com/docs/guides/auth/jwt-fields)

Reservation, activation, renewal, release, and deletion intake serialize only
their database transitions under the same transaction-scoped account advisory
lock. No database lock is held across a provider request. Deletion closes new
reservations, freezes active lease deadlines, waits for every cooperating
client to release or expire, then applies a deterministic settling interval and
requires two fresh full-family absence rounds separated by database time:

- [PostgreSQL advisory-lock semantics](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [Supabase database-function security](https://supabase.com/docs/guides/database/functions)

This fence controls current cooperating Layerwell clients and the deletion worker;
it is not a RevenueCat-side tombstone. RevenueCat documents that configuring
without an App User ID creates an anonymous customer, `logIn()` can create a
missing custom identity, `logOut()` creates a new anonymous identity, cached or
offline work can later upload, and a deleted customer may be recreated. Its
documented permanent blocking control is dashboard-oriented, limited, and
warned against for legitimate subscribers. Consequently, neither the source
lease nor a five-minute settling value proves permanent non-reappearance:

- [RevenueCat customer identification](https://www.revenuecat.com/docs/customers/identifying-customers)
- [RevenueCat caching behavior](https://www.revenuecat.com/docs/test-and-launch/debugging/caching)
- [RevenueCat offline entitlements](https://www.revenuecat.com/docs/customers/customer-info#offline-entitlements)
- [RevenueCat account-deletion engineering guidance](https://www.revenuecat.com/blog/engineering/app-store-account-deletion)
- [RevenueCat customer blocking](https://www.revenuecat.com/docs/customers/blocking-customers)

Release still requires written RevenueCat confirmation or an approved
continuing detect-and-redelete control for stale/tampered binaries, queued store
activity, aliases, and anonymous identities. Privacy/legal review must approve
the retention and operational treatment. The code and this memo do not claim
that provider approval, legal compliance, or App Review acceptance has occurred.

### Sign in with Apple

The preferred path securely stores the refresh token at account creation on the
server and revokes it during deletion. The revoke endpoint's exact 200 outcome
is retry-safe, including an already-invalid token. Until that credential path is
implemented and proven, unavailable credentials or a failed automatic attempt
produce a durable `manual_revocation_required` outcome; they cannot hold the
whole account hostage. The app must surface Apple's settings instructions after
Auth deletion and preserve them across relaunch.

### Sentry

No stable account pseudonym should be sent to Sentry. Keep `sendDefaultPii`
false, retain the strict event scrubber, approve the shortest operationally
useful retention, and document issue-level deletion/DSAR operations. Sentry's
API documentation states that events are immutable and deletion occurs at the
whole-issue level, so a stable per-account event identifier creates an erasure
promise the app cannot reliably fulfill:

- [Sentry API permissions and deletion scope](https://docs.sentry.io/api/permissions/)

## Mobile Status Contract

Before intake, the app stores the random idempotency token and status capability
in SecureStore. On HTTP 202 it enters a deletion-pending root gate, stops product
navigation, RevenueCat login, PostHog identification/capture, and account writes;
clears local private data; performs global Supabase sign-out; and resets vendor
identities without flushing identified analytics.

After Auth disappears, status uses only the opaque capability:

- HTTP 202: pending with a non-sensitive phase and next poll floor;
- HTTP 200: completed with any durable manual Apple instruction;
- HTTP 409: action required;
- HTTP 404: invalid capability;
- HTTP 410: expired receipt/capability; and
- HTTP 429: rate limited.

Startup must resolve a stored pending deletion before mounting product routes or
identifying to vendors. A normal authenticated startup must verify both live Auth
and `account_is_active` before RevenueCat login or PostHog identification.

## Evidence Required Before Closing DB-10

- Disposable PostgreSQL 15 and 17 migration rehearsals covering idempotency,
  leases, ambiguous dispatch, expiry, advisory-lock races, write barriers,
  rate-limit cleanup, Auth deletion, and unlinkable receipts.
- Deno unit/contract tests for every provider response and status transition.
- Complete Supabase reset and RLS/storage adversarial tests in staging.
- Fault injection at every provider-call boundary, including crash after
  dispatch and before response persistence.
- Live RevenueCat sandbox deletion, alias/transfer webhook race, renewal after
  deletion, and written vendor semantics.
- Live PostHog lookup/delete/status/absence proof and no-recordings proof.
- Live Sign in with Apple refresh-token capture/revoke and credential-revoked
  notification proof on a supported physical iPhone.
- Human-simulated pending, relaunch, completion, action-required, offline,
  subscription-warning, and expired-capability flows with evidence.
- Privacy/legal approval of retention, terminal receipts, backups, processor
  notices, Sentry handling, and user-facing timing/copy.

No source test, memo, simulator run, or vendor documentation can guarantee App
Store acceptance, legal compliance, or revenue. They reduce identifiable risk;
only the named external authorities can close their respective gates.
