# CAT-08 Catalog Operator Authority and Correction Runbook

Date: 2026-07-22

Status: `in_progress` source candidate; the separate internal-console source is
not deployed or E2E-proven, and no hosted authority, named staffing, or
production acceptance evidence exists

## 1. Decision and boundary

CAT-08 replaces direct catalog-database administration with a narrow,
identity-bound correction workflow. Authorized operators may read a minimized
queue, claim one allowlisted item under a short lease, record a bounded disposition, and
request release of an independent product hold only through reviewed RPC/Edge
surfaces. They receive no general table editor, SQL console, database password,
shared credential, caller-selected identity, or browser-visible service-role
secret.

These source candidates do not complete CAT-08. They do not prove that the
internal console, migration, or Edge Function is deployed; that real operators
are enrolled; that hosted concurrency and revocation work; or that Apple, a
regulator, counsel, or a security reviewer accepts the result. CAT-07 remains
an upstream dependency.

## 2. Why this boundary exists

The existing report flow accepts first-party correction intake. An unreviewed
`open` report is not global takedown authority. Once an authorized operator
triages a credible issue, however, the serving hold must no longer depend on
retaining the reporting person's correction row. Deleting or withdrawing the
reporter's personal data must not make a known catalog issue disappear and must
not silently restore a product to search, barcode, recommendation, product, or
child-evidence reads.

The resulting separation is deliberate:

- a correction report is purpose-limited personal intake;
- an operator decision is attributable workforce activity;
- a product hold is a non-reporter-derived catalog safety state;
- a CAT-02/CAT-03 repair proof is product publication authority; and
- a hold release is a new, independently authorized serving transition.

No one object is allowed to perform all five jobs.

## 3. Primary-source control basis

These sources inform the engineering controls. They are not a legal opinion and
do not determine which law applies to a particular launch territory.

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
  including 1.4.1 and 5.1, make accuracy, privacy, purpose, consent, retention,
  and deletion continuing product obligations. A source contract cannot
  guarantee App Review.
- [Supabase MFA guidance](https://supabase.com/docs/guides/auth/auth-mfa)
  documents the `aal2` session claim and verified-factor enforcement model.
- [Supabase Edge Function database connections](https://supabase.com/docs/guides/functions/connect-to-postgres)
  recommends a transaction-mode pooler for transient Edge connections.
- [Supabase database roles](https://supabase.com/docs/guides/database/postgres/roles)
  documents custom Postgres roles and role-level settings.
- [Supabase `getClaims`](https://supabase.com/docs/reference/javascript/auth-getclaims)
  and [`getUser`](https://supabase.com/docs/reference/javascript/auth-getuser)
  document locally verified JWT claims and the separate authoritative Auth
  server user lookup used together at admission.
- [Supabase Edge secrets](https://supabase.com/docs/guides/functions/secrets)
  documents server-only Function secrets and the managed
  `DENO_DEPLOYMENT_ID` deployment identifier.
- [Supabase Row Level Security guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
  warns that service keys and `bypassrls` roles bypass ordinary RLS. Neither is
  an acceptable browser or operator identity.
- [Supabase API security guidance](https://supabase.com/docs/guides/api/securing-your-api)
  describes combining grants, RLS, schemas, and request checks rather than
  relying on a public Data API alone.
- [NIST SP 800-63-4](https://csrc.nist.gov/pubs/sp/800/63/4/final) is used as
  security guidance for authenticator and session design; it is not claimed as
  a certification.
- [GDPR Article 5](https://eur-lex.europa.eu/legal-content/EN/TXT/?qid=1517389523241&uri=CELEX%3A32016R0679),
  the [PIPEDA fair-information principles](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/),
  and the [California Attorney General's CCPA overview](https://oag.ca.gov/privacy/ccpa)
  support the fail-closed minimization, purpose, access, retention, correction,
  and erasure review. Qualified counsel must approve the exact territory,
  notice, legal basis, retention schedule, and deletion exceptions.

## 4. Threat model

### Protected assets

- reporter identity, account state, barcode, free text, and supplied evidence;
- source approvals, CAT-02 projection lineage, CAT-03 campaign authority, and
  current served-state mutation roots;
- product availability across every serving path;
- operator grants, MFA state, active sessions, queue leases, and decisions;
- immutable audit events and release attestations; and
- the absence of hidden or unaudited catalog changes.

### Adversaries and failure modes

1. **Ordinary account takedown abuse.** A reporter attempts to suppress products
   globally by filing many reports.
2. **Compromised operator account.** A stolen password or stale JWT attempts to
   read reports, forge an actor, or release a product.
3. **Shared or overpowered credentials.** A team uses one service key, database
   role, or shared login, destroying attribution and bypassing RLS.
4. **Self-review.** One person triages, decides, repairs, and releases the same
   issue.
5. **Lost update or double handling.** Two operators act on a stale queue item
   or an expired claim and overwrite one another.
6. **Erasure resurrects risk.** Reporter deletion removes the only row that was
   suppressing a known-bad product.
7. **Disposition equals publication.** A `rejected`, `accepted`, or `closed`
   label is treated as sufficient to restore serving without current catalog
   evidence.
8. **Audit tampering.** A privileged client edits or deletes history, or stores
   sensitive report payloads in a permanent product mutation chain.
9. **Public-console exposure.** The operator surface ships inside the consumer
   app, is indexed publicly, or embeds a service secret.
10. **Unbounded reads and exports.** Queue endpoints permit enumeration,
    arbitrary filters, offset scans, or cross-owner personal-data exports.
11. **Receipt substitution.** A release references stale, different-product,
    pre-hold, retired, or fixture CAT-02/CAT-03 evidence.
12. **Emergency bypass becomes normal.** An incident path can release or edit a
    product outside the normal authority chain.

### Explicit non-goals

- CAT-08 does not approve source rights, product facts, health claims, or U.S.
  OTC/sunscreen classifications.
- It does not let operators promote arbitrary rows or edit catalog tables.
- It does not make a self-selected beta corpus representative.
- It does not replace account deletion, data export, privacy, incident,
  security, or professional-review programs.

## 5. Identity and session contract

Every operator action must derive its actor from the exact live Supabase Auth
session independently admitted by Edge. The request body may not supply an
actor ID, reviewer alias, role, email, grant, MFA state, or session identity.

The database authority check fails unless all of the following are current in
the same transaction:

1. Edge verifies the exact presented bearer with Supabase Auth `getClaims` and
   `getUser`, requires a nonanonymous `authenticated` subject at `aal2`, and
   binds its signed UUID `session_id` to the same verified subject;
2. only the constrained `catalog_operator_edge` login may use the
   non-Data-API `catalog_operator_gateway` schema and execute its six exact
   functions; `public`, `anon`, `authenticated`, and `service_role` have no
   execute grant;
3. the exact factor challenged by that session is still a verified TOTP factor
   belonging to that user;
4. Postgres takes only that signed Auth-session selector, derives the actor from
   `auth.sessions.user_id`, and confirms the exact Auth session is live and not
   revoked or expired;
5. an active, unexpired operator grant contains the exact requested
   capability;
6. the bounded operator work session is active; and
7. any sensitive detail read or item mutation has the exact live item claim,
   owned by that operator/session and presented with the current server-issued
   version/token.

Every call also carries a server-only runtime tuple: environment, exact
40-character source commit, Edge deployment ID, and monotonic control
generation. The database locks and matches that tuple against the singleton
runtime-control row in the same transaction. Admission is seeded `frozen` and
fails with no queue/detail/mutation side effect unless the row is explicitly
opened for that exact deployed tuple. A mismatched revision, deployment,
environment, or generation fails closed even when Auth, MFA, and grants are
otherwise valid.

The schema-v1 bounds are a ten-minute operator work session and a five-minute
claim lease. Both are measured by the database clock.

Revoking an operator grant, TOTP factor, or Auth session must deny the next
request. The immutable operator work session has no end/revoke RPC in schema v1:
it expires within ten minutes, while the underlying Auth/factor/grant fences
still apply on every request. The live Auth session's `factor_id` must resolve to
that same user's verified `totp` factor; a browser refresh token, JWT with an
old grant, unrelated verified factor, or an `aal1` session is not enough. Grant,
binding, attestation, and revocation records are append-only/hash-bound, but
schema v1 exposes no operator grant-management or audit-export action.

## 6. Least-privilege capability model

| Capability | May do | Must not do |
| --- | --- | --- |
| Queue reader (`correction_queue_read`, `source_queue_read`) | Read bounded minimized summaries | Read raw tables, reporter identity, or arbitrary payloads |
| Correction claimant (`correction_claim`) | Take a five-minute lease on one correction report | Claim a product hold or source/import item |
| Hold claimant (`catalog_hold_claim`) | Take a five-minute lease on one reporter-free product hold | Claim or reopen personal correction intake |
| Source claimant (`source_claim`) | Take a five-minute lease on one source/import item | Claim correction intake or a product hold |
| Triage operator (`correction_triage`) | Move `open` to `triaged`, creating an independent hold | Accept/reject or release that hold |
| Decision reviewer (`correction_disposition`, `source_review_record`) | Record `accepted` or `rejected` or an immutable source-review recommendation | Rewrite intake, invoke owner-only CAT-02/CAT-03 authority, or release |
| Catalog repair attestor (`correction_queue_read`, `catalog_hold_claim`, `catalog_repair_attest`) | Claim a reporter-free hold and bind reviewed CAT-02/CAT-03 repair receipts | Reopen personal report detail, edit correction decisions, call migration-owner authority functions, or release its resulting hold |
| Release operator (`correction_queue_read`, `catalog_hold_claim`, `catalog_hold_release`) | Claim a reporter-free hold, verify the exact current repair receipt, and release it | Triage/decide the same issue or attest its repair |

Schema v1 intentionally exposes no operator audit-reader or grant-administrator
capability. Redacted audit review and grant lifecycle administration stay on a
separate, migration-owner-controlled governance path until a comparably bounded
interface and contract exist. Immutable operator sessions, operation receipts,
and workforce-linked audit records also need a privacy/employment-reviewed
retention, archival, deprovisioning, and deletion contract before launch.

Named access must be provisioned as a reviewed, parameterized deployment
artifact, never as an ad hoc dashboard or SQL-console edit. Each grant binds one
named Auth user to an independently signed attestation, a distinct issuer, the
smallest exact capability set, and a maximum 90-day validity window. Revocation
is append-only and must take effect on the next RPC even if a browser still has
an older JWT or operator work session. Production onboarding, periodic access
review, and deprovisioning remain hosted evidence gates because no real operator
or production grant is present in this source candidate.

For every held product, the triage actor, decision actor, and release actor are
three distinct people. The release actor is also distinct from every actor who
authored or approved the referenced repair authority. If staffing cannot
satisfy that separation, the product stays held. An incident path may add or
extend a hold; it has no release bypass.

## 7. Correction and hold state machines

### Correction state

```text
open --triage--> triaged --decision--> accepted
                          `-----------> rejected
```

- `open` is untrusted intake and does not globally suppress a product.
- `triaged` is the only transition that opens the independent product hold.
- `accepted` means the reported issue was substantiated.
- `rejected` means the report was not substantiated under the recorded review
  policy.
- Neither `accepted` nor `rejected` releases a hold or grants serving.
- Intake text is not editable after submission. Corrections use append-only
  decisions rather than overwriting history.

### Product hold state

```text
active --third-person current repair attestation--> repair_attested
repair_attested --fourth-person release-----------> released
repair_attested --new triage or invalidated proof-> active
```

The active hold is keyed to the catalog product and a bounded reason category,
not to a retained reporter identity. It contains no reporter ID, account ID,
barcode, free text, arbitrary JSON, or copied evidence. It survives report
withdrawal, consent withdrawal, account deletion, and deletion of reporter
payloads.

Reporter erasure must remove or de-identify the personal correction material
under the approved deletion contract while preserving the independent
nonpersonal product hold and its served-state mutation event. An erasure job
must never close a hold as a cascade side effect.

Pre-`0063` operator-reviewed `triaged`/`accepted` rows are backfilled only into
reporter-free legacy holds. Their origin is hash-bound, but the migration does
not invent a named triager or four-person history and schema v1 exposes no
adoption RPC. They therefore stay fail-closed and cannot use the normal release
path. Before hosted cutover, prove that no such hold exists or deploy a
separately reviewed migration-owner remediation with retained evidence. Never
repair that history through a dashboard or ad hoc SQL-console edit.

## 8. Claim lease and concurrency contract

- Queue reads use a deterministic bounded cursor, allowlisted filters, stable
  ordering, and a hard server limit. Offset pagination and arbitrary SQL-like
  filters are forbidden.
- Claiming an item creates one short, expiring lease and returns an opaque
  claim token plus a monotonic version.
- Detail, transition, and release calls require the matching operator session,
  live lease, token, and expected version.
- Every mutation uses compare-and-swap semantics. A stale version, expired
  lease, replaced claim, duplicated idempotency key, or response-loss retry
  returns a bounded conflict/current-state result; it never overwrites newer
  work.
- Claim acquisition and transition are serialized at the report/hold boundary.
  The database, not the browser clock, decides lease validity.
- A crashed operator may lose the lease without losing the report or decision.
  Reclaim appends an audit event.
- A queue item cannot be removed from view merely because one client failed
  after receiving a response.

The five-minute lease and ten-minute work-session bounds are migration-owned
constants pinned by the source and database contracts. Production values still
require an operational load and usability review; changing them is a reviewed
contract revision.

## 9. Audit contract

Successful claim, transition, and release mutations receive immutable
idempotency receipts. Successful claimed-detail reads, workflow transitions,
repair attestations, and releases append the specific immutable audit/hold
events implemented by their RPCs. API roles, operators, and the service role
have no `UPDATE`, `DELETE`, or `TRUNCATE` path to those relations. The retained
records are deliberately split:

- an operation receipt stores the UUIDv4 operation ID, derived operator,
  reviewed RPC name, exact request hash, bounded response, and server time;
- an audit event stores a server event ID, bounded subject type and permitted
  subject/product reference, derived operator and operator session, event type,
  bounded reason/evidence code, server time, minimal state/hold/receipt context,
  and its hash-chain link;
- a hold event stores the product/hold, sequence, prior/new hold state, bounded
  reason, derived operator/session, optional repair receipt, server time, and
  its hash-chain link; and
- a repair receipt binds the exact current publication proof described below.

Correction audit deliberately omits correction/report ID and reporter identity,
so permanent audit cannot reconstruct which erased report produced an event.
Rejected authorization, lease, version, idempotency-conflict, and validation
requests raise and roll back; they are not falsely described as durable database
audit events. Production denial/conflict-rate monitoring therefore remains an
external, privacy-reviewed observability gate.

The permanent product mutation chain excludes reporter identity, barcode, free
text, arbitrary JSON, uploaded evidence, queue assignment notes, and deletion-
request content. Workforce identifiers in the private audit are access- and
retention-controlled and require privacy/employment review; calling the product
hold nonpersonal does not make all operator audit data nonpersonal.

Schema v1 enforces a database-authoritative, per-actor fixed-window budget. A
separate committed Edge preflight spends the 120-request global budget before
every action, including session establishment, so rejected and ungranted
action transactions still consume global capacity. The preflight requires the
exact live AAL2/account/runtime identity but creates no operator session and
needs no grant. A successful action transaction then spends only its class
budget: session and release 12, transition 30, and queue/detail/claim 60 per 15
minutes. Buckets become ineligible and purgeable one hour after their window
and contain only operator UUID, class, window, count, and expiry—never report,
product, claim, payload, IP, or session data. Each admitted request performs a
bounded opportunistic purge; a scheduled hosted idle-period purge and retained
deletion transcript remain launch gates. HTTP 429
returns a conservative 900-second `Retry-After`. Local source and pgTAP prove
the deterministic boundary; hosted concurrent load, threshold tuning,
monitoring, and privacy-reviewed workforce abuse operations remain launch
evidence gates.

## 10. Repair and release contract

Opening a reviewed hold advances the product's served-state mutation root and
invalidates the old CAT-03 authority. Closing or deleting the correction cannot
restore that authority.

A release request must bind all of the following to the exact held product:

1. the current hold/version and the disposition decision;
2. the current, non-fixture CAT-02 promoted projection and immutable review/
   provenance receipts;
3. current CAT-01 source authority and no source/batch withdrawal;
4. a newly reviewed product authority over the current post-hold served-state
   mutation root;
5. an immutable, structurally valid `approve_activation` CAT-03 successor record
   with signed activation authorization, sealed against the exact current
   active-hold dependency snapshot and served-state mutation root;
6. all required dependencies and market-specific reviews;
7. no other active hold for the product; and
8. a release attestation from the distinct authorized release operator after
   all referenced evidence was created.

That CAT-03 successor is deliberately staged, not live: the active hold keeps
the product ineligible. A third person, distinct from triage and disposition,
attests the repair and creates a maximum-30-minute immutable receipt. A fourth
person, also distinct from the attestor, performs release. The database
rechecks the receipt under the item/hold and shared mutation-ledger
serialization boundaries. A hash-shaped string, client assertion, stale
record, old campaign, different product, fixture, retired batch, or pre-hold
mutation root fails closed. `accepted`, `rejected`, `closed`, or “fixed” text is
not repair proof.

Release advances the served-state mutation root and never activates the staged
record. CAT-03 owners must subsequently review, release, activate, and obtain
the independent readback for a fresh post-release record/campaign sealed
against the new root before the product can serve again. Operators receive none
of that migration-owner authority.

## 11. API and internal-console boundary

The operator API exposes only session establishment plus bounded queue, detail,
claim, transition, and release operations. Schema v1 exposes no audit-export or
grant-administration action. It returns explicit schemas and rejects unknown
keys, oversized bodies, unsupported filters, caller-selected actors, and
unbounded exports. Responses use `Cache-Control: no-store` and do not echo
secrets or raw database errors.

The checked-in `apps/catalog-operator-console/` source candidate is a separate
internal web surface, not an Expo route. It uses a Supabase publishable key,
email OTP followed by mandatory verified TOTP, an in-memory operator session,
the Edge API only, and no telemetry. It must remain separately deployable with a
separate origin, access policy, build, release gate, and incident switch; it
must not be linked or bundled into the consumer iOS app. A service-role key,
database password, receipt-verifier secret, shared credential, durable browser
session, or analytics/telemetry SDK is forbidden in client source, storage,
logs, or network responses.

The console clears its in-memory browser session after 15 minutes of inactivity
or one hour absolute. That client-side reduction does not extend the separate
ten-minute database operator work session; every RPC still rechecks current
server authority.

Schema v1 exposes exactly six backend-only functions in
`catalog_operator_gateway`. Every signature starts with the signed Auth
`session_id`, Edge environment, exact source revision, Edge deployment ID, and
runtime-control generation; none accepts a user ID:

- `catalog_operator_session(uuid, text, text, text, bigint, text)`;
- `catalog_operator_queue(uuid, text, text, text, bigint, text, timestamptz, uuid, integer)`;
- `catalog_operator_detail(uuid, text, text, text, bigint, text, uuid, uuid, bigint)`;
- `catalog_operator_claim(uuid, text, text, text, bigint, uuid, text, uuid, bigint)`;
- `catalog_operator_transition(uuid, text, text, text, bigint, uuid, text, uuid, uuid, bigint, text, text, text)`;
  and
- `catalog_operator_release_hold(uuid, text, text, text, bigint, uuid, uuid, uuid, bigint, uuid, text)`.

Migration `0063` also exposes
`export_catalog_corrections_for_subject(uuid, timestamptz, uuid, integer)` to
authenticated subjects for their own data-portability export. It derives and
matches `auth.uid()`, is not an operator action, and is not executable by
`service_role`.

The `catalog-operator` Edge Function has one `POST` endpoint and an exact
production-HTTPS origin allowlist from `CATALOG_OPERATOR_ALLOWED_ORIGINS`;
loopback HTTP is accepted only in local/development/test environments. It
accepts a user bearer JWT, verifies the exact token's signed claims with a
publishable-key Auth client, rechecks the same subject's account-access snapshot
before and after the operation, and invokes only the six hardcoded,
schema-qualified functions through Postgres.js and the transaction-mode
Supabase pooler. The local connection username must be exactly
`catalog_operator_edge`; hosted usernames must be
`catalog_operator_edge.<20-character-lowercase-project-ref>`, with that ref
exactly matching the standard
`https://<project-ref>.supabase.co` `SUPABASE_URL`. Custom or mismatched hosted
domains fail closed. Production/staging TLS uses full CA and hostname
verification; dynamic SQL/function names are forbidden, and the browser never receives
`CATALOG_OPERATOR_DATABASE_URL`.
Its actions and payloads are exact:

- `session`;
- `queue` with `queueKind`, optional `{createdAt, itemId}` cursor, and optional
  integer limit from 1 through 50;
- `detail` with `itemKind`, `itemId`, live `leaseId`, and
  `expectedVersion` matching the claimed item;
- `claim` with `itemKind`, `itemId`, `expectedVersion`, and UUIDv4
  `operationId`;
- `transition` with `itemKind`, `itemId`, `leaseId`, `expectedVersion`, UUIDv4
  `operationId`, `decision`, and `reasonCode`. `evidenceSha256` is required as
  an exact lowercase SHA-256 only for a `product_hold` `attest_repair` /
  `cat02_cat03_repair_verified` transition; it is omitted and rejected for
  correction, source, and import transitions; and
- `release_hold` with `holdId`, `leaseId`, `expectedVersion`, UUIDv4
  `operationId`, `repairReceiptId`, and literal reason
  `repair_verified_current`.

Unknown actions/keys, non-HTTPS/unlisted origins, non-POST requests, missing or
non-bearer authorization, invalid cursors/UUIDs/hashes, and out-of-range limits
fail before RPC dispatch. Responses are projected through an allowlist; raw RPC
payloads and request bodies are not logged.

The private authority is split across `catalog_operator_*` grants, capability
bindings, grant revocations, sessions, ephemeral per-actor rate buckets, work
states, claims, UUIDv4 idempotent operation receipts, audit events, product
holds, hold events, repair-authority receipts, runtime control, and immutable
runtime-control history.
API roles have no raw access to those relations. Migration
`20260722000063_catalog_operator_authority.sql` also revokes the legacy
service-role correction `SELECT` and review-execution lanes. The constrained
`LOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS` role has a connection limit, short
statement/lock/idle transaction timeouts, empty search path, no memberships or
owned database objects, gateway-schema usage, and execute on only the six
application gateway functions. Reusing a drifted role fails migration. It has no Auth-schema
usage or direct table, sequence, Auth,
grant-management, runtime-control, or CAT-02/CAT-03 owner grant. The Edge source
contains no service-role or secret-key transport.

The migration deliberately does not store a database password. A production
operator must generate a high-entropy credential in the approved secret
manager, set/rotate the role password over an administrator-only database
channel, and store the exact transaction-pooler URL only as
`CATALOG_OPERATOR_DATABASE_URL`. Rotation is fail-closed: freeze admission,
deploy the new Function secret/revision/generation, verify the new pooler
connection and grants, atomically open the exact runtime tuple with a retained
change-receipt hash, revoke the old credential, and prove the old connection
fails. Never put the URL in Vite, mobile/EAS configuration, CI logs, source,
screenshots, or browser storage.

A server-side verifier may hold the minimum secret needed to validate external
repair receipts. That secret is not operator authority, and successful receipt
verification still executes the database transition under the derived operator
identity and separation rules.

## 12. Operator procedure

This procedure is the production acceptance target, not an executable claim
about the current console source. The current candidate displays the normalized
confirmed Auth email, database-derived operator UUID, exact effective
capabilities, expiry, database-confirmed environment, exact source revision,
Edge deployment ID, open admission state, and runtime-control generation.
Incident disablement is enforced by the database admission path; once frozen,
renewal and every operation fail closed. Hosted evidence is still required
before a shift may start.

### Start a shift

1. Use the dedicated internal-console origin on a managed device.
2. Sign in with the named operator account and complete MFA.
3. Confirm the console shows the current operator, capabilities, session expiry,
   environment, and source/build revision.
4. Confirm production versus staging visually and verify the authority receipt
   says `open` with the approved control generation and deployment ID.
5. Open only the bounded queue for the assigned capability.

### Triage

1. Claim the report; never copy it to chat, tickets, spreadsheets, or local
   files.
2. Inspect the minimized report and approved catalog/source evidence.
3. If the issue is credible under the triage policy, transition to `triaged`.
   Confirm that the independent hold is active and all serving probes fail
   closed.
4. If evidence is insufficient, leave the report `open` or record the bounded
   escalation path. Do not improvise a disposition.

### Decide

1. A different authorized reviewer claims the triaged report.
2. Record `accepted` or `rejected` with the allowlisted reason/evidence codes.
3. Confirm the product remains held after either decision.
4. Route accepted issues through CAT-02/CAT-03 repair. A rejected report still
   cannot reuse the invalidated pre-hold authority.

### Release

1. A repair attestor, distinct from triage and disposition, claims the
   reporter-free product hold—not the accepted/rejected personal report—then
   verifies current source, CAT-02, mutation-root, and signed staged CAT-03
   successor authority and creates the short-lived repair receipt.
2. A fourth authorized person opens the exact hold and receipt, not the original
   report alone, and remains distinct from the triager, disposition reviewer,
   and repair attestor.
3. Submit the expected hold version and idempotency key.
4. Confirm the release event and new version; serving must remain closed because
   release advances the mutation root and does not activate CAT-03 authority.
5. If any proof is missing, stale, ambiguous, or mismatched, stop; the product
   remains held.
6. Hand the new post-release root to CAT-03 owners for a fresh review, campaign
   release/activation, signed readback, and serving probes.

### End a shift

1. Release or allow claims to expire; never transfer a claim token.
2. Sign out and clear local console state. The immutable database work session
   has no end RPC and expires within ten minutes; an administrator must revoke
   the Auth session, TOTP factor, or grant when immediate server-side fencing is
   required.
3. Escalate unresolved high-severity holds and record no sensitive details in
   an unapproved channel.

## 13. Incident and recovery rules

- **Suspected credential compromise:** revoke the operator grant, Auth session,
  and challenged TOTP factor; allow immutable work-session records to expire,
  retain immutable audit; rotate affected verifier
  secrets; review every action since the last trusted login. Do not mass-release
  holds.
- **Queue/API outage:** intake remains available only if its existing safety and
  deletion boundaries remain healthy; active holds continue suppressing serving.
  Operators do not fall back to SQL edits.
- **Lease conflict:** refresh the item and current version. Never retry a stale
  transition by changing the request to force success.
- **Audit/storage failure:** authority-changing operations fail closed.
- **Bad release:** open a new hold immediately, advance mutation authority, and
  use CAT-02/CAT-03 rollback/successor procedures. Do not edit the old event.
- **Reporter erasure backlog:** block deletion completion claims until the
  approved personal-data steps finish, but keep the independent product hold.
- **Console exposure:** disable the console/API admission path, revoke sessions
  and grants, preserve holds, investigate access, and follow the reviewed breach
  response process.

## 14. Verification and acceptance evidence

### Deterministic local source gates

The CAT-08 source contract and database/Edge tests must prove at least:

- no API role can directly read or mutate protected operator, correction,
  hold, receipt, grant, session, or audit tables;
- browser roles cannot directly execute any operator RPC; Edge admits only an
  exact signature/expiry-verified AAL2 bearer and injects its signed Auth
  session ID, while Postgres derives the operator user/factor from Auth tables
  and never accepts a user ID;
- anonymous, `aal1`, stale/revoked-session, no-factor, expired-grant,
  wrong-capability, and expired-work-session requests fail;
- the committed all-action global preflight rejects request 121 in a 15-minute
  window without creating a work session or requiring an operator grant, class
  limits reject N+1, actors remain isolated, expired ephemeral buckets purge,
  and direct rate-table/helper access is denied;
- revocation time is derived immediately by Postgres, and the common
  current-Auth, per-actor advisory-lock, ordered grant-row-lock, fresh
  wall-clock validation sequence makes action/session authorization linearize
  against grant issuance, renewal, and revocation rather than trusting a cached
  session;
- the isolated two-reset database gate runs two real `dblink` connections
  against the actual gateway and proves two commit orders: an authorized
  action that owns the grant lock completes before a waiting revocation, while
  a revocation that owns the lock commits before and denies the waiting
  session-establishment request. Controller-held advisory latches make both
  schedules deterministic without wall-clock sleeps, while the competing
  request must show a `transactionid` lock whose blocking backend is the
  intended winner rather than the controller latch;
- bounded cursor queues exclude reporter identity; purpose-limited correction
  detail is field-allowlisted and visible only under the exact live claim/
  version, while logs, metrics, and permanent mutation evidence exclude it;
- lease/CAS, stale version, response-loss retry, expiry/reclaim, and two-session
  races are deterministic;
- `open` does not hold, `triaged` opens an independent hold, and accepted/
  rejected decisions do not release it;
- reporter withdrawal/deletion removes personal intake without removing the
  hold;
- audit history is append-only and the product mutation chain excludes personal
  report payloads;
- repair/release rejects self-review, any reuse among the four people, stale/
  different-product/fixture/retired/pre-hold evidence, missing dependencies,
  another active hold, and a non-current staged CAT-03 successor; release also
  leaves CAT-03 activation closed pending a fresh post-release review; and
- no consumer route or client bundle contains the operator surface or a service
  secret.

The local rehearsal is deterministic PostgreSQL evidence, not hosted evidence.
It does not prove the hosted transaction pooler, deployed credentials, network
transport, concurrent load, or independent production sessions.

### Hosted and human gates still required

Before CAT-08 can be complete, retain reviewed evidence for:

- fresh deployment of the complete migration chain and operator Edge surface to
  the approved hosted project;
- hosted creation and secret-manager rotation of the constrained
  `catalog_operator_edge` login, plus catalog proof that only the six gateway
  functions are executable; that the role is nonsuperuser,
  membership/ownership-free, and unable to `SET ROLE`; and that no raw
  table/sequence/Auth/control access or service-role environment secret remains;
- an exact hosted extension/schema function inventory proving no unsafe
  executable inherited through `PUBLIC`; the six-function statement covers the
  application gateway, not an uninspected hosted extension set;
- a hosted transaction-pooler connection proving CA and hostname verification
  with `verify-full`, plus negative certificate/hostname tests and retained
  transport evidence;
- independent-session RLS, MFA enrollment/revocation, stale-JWT, lease/CAS race,
  renewal-versus-action-versus-revocation ordering, retry, deletion, audit,
  backup/restore, incident-switch, and server-side request-rate-control drills;
- the separately deployed internal console and its exact source/build/origin;
- freeze/open/mismatch/rollback drills for the server-authoritative runtime
  control, including history/change receipt and visible normalized confirmed
  email, UUID, exact capabilities, deployment ID, source revision, environment,
  control generation, and expiry; a client-only banner does not count;
- human-simulated E2E for sign-in/MFA, denied access, queue empty/loading/error,
  claim/reclaim, stale conflict, triage hold, accept/reject, repair handoff,
  separate repair attestation, fourth-person release, post-release non-serving,
  report erasure, relaunch, and sign-out;
- named trained operators, capability approvals, shift/coverage plan, SLA,
  escalation policy, access review, and deprovisioning evidence;
- privacy/security/legal review of report fields, operator monitoring,
  employment/access notices, retention, deletion, breach response, and launch
  territories; and
- production/TestFlight catalog probes, privacy-policy/App Privacy
  reconciliation, and App Review materials for the exact release candidate.

Passing local tests is only source evidence. It does not establish legal
compliance, production safety, App Store acceptance, product-market fit, or a
revenue outcome.
