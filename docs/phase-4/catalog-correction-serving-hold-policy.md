# Catalog correction serving-hold policy

## Decision

A caller-created correction with status `open` is untrusted intake and does not
globally suppress an otherwise reviewed catalog product. A product is held from
barcode lookup, search, recommendation/direct reads, and child-evidence reads
only when a CAT-08-authorized `aal2` operator moves an `open` report to
`triaged` and atomically creates an independent product hold. The transition
records all of the following:

- status `triaged`;
- a database-generated review timestamp that is not in the future;
- an actor derived by Postgres from the exact Edge-verified live Auth session
  and verified TOTP factor, with the exact `correction_triage` capability; and
- a non-empty operator review note.

`accepted` and `rejected` are distinct report dispositions; neither releases an
existing product hold. The hold remains independent of the report. A third
person, separate from triage and disposition, may attest only an exact current
CAT-02 projection plus a signed, structurally valid staged CAT-03 successor
record over the active-hold mutation root. A fourth person must consume that
short-lived receipt to release the hold. Release advances the mutation root and
does not activate serving; CAT-03 owners must complete a fresh post-release
record/campaign, activation, and signed readback before serving can recover.
Closing, deleting, or erasing the correction cannot grant serving.

## Threat model and tradeoff

Treating every open report as a global hold gives one ordinary account a
cross-user product-takedown primitive. Even with a per-account rate limit, one
account could suppress up to 20 products per 15-minute window, and account
farming could multiply the effect. The selected policy removes that availability
authority from user input: authenticated and service API roles have no direct
`INSERT`, `UPDATE`, or `DELETE` privilege on correction rows, intake is fixed to
`open`, and only the audited review RPC can create a hold.

The safety tradeoff is that a genuine new report does not immediately withdraw a
previously source-approved product for every user. This is preferable to letting
unverified user content override reviewed catalog evidence. Operations must
triage safety-relevant reports promptly; once verified, the database fails closed
across every serving lane even if the denormalized product counter is stale.

## Abuse and privacy controls

- Correction intake is bound to the caller's exact active health-processing
  epoch and current account state.
- Intake accepts only bounded, allowlisted, minimized fields and fixes workflow
  and operator fields server-side.
- Intake is account-serialized and limited to 20 rows per 15 minutes.
- Review uses the bounded CAT-08 RPCs, follows constrained status transitions,
  and is bound to a nonanonymous `aal2` identity, the live Auth session's exact
  verified TOTP `factor_id`, active immutable grant/capability binding, ten-minute operator
  session, and five-minute claim lease.
- Triage, disposition, repair attestation, and release are separated across four
  people for a held product. The release actor is distinct from the triager,
  decision reviewer, and repair attestor and cannot author or approve repair
  evidence.
- Queue mutations use database-clock leases, advisory locks, UUIDv4
  idempotency receipts, and compare-and-swap versions. Stale or replayed work
  fails closed.
- The independent hold contains no reporter ID, account ID, barcode, free text,
  or arbitrary report JSON. Reporter withdrawal/erasure purges personal intake
  and ephemeral claims without removing the hold or permanent nonpersonal
  served-state event.
- Pre-`0063` operator-reviewed `triaged`/`accepted` rows are copied once into
  reporter-free legacy holds with a hash-bound origin and no invented named
  triager. Those holds fail closed and cannot use the operator release path.
  Hosted cutover must prove there are none or carry a separately reviewed,
  migration-owner-controlled remediation; an operator or dashboard must never
  assign their missing history by direct edit.
- Database tests cover open-report non-suppression, independent audited-hold
  suppression, erasure survival, stale projection/repair defense, MFA/session/
  capability denial, separation of duties, lease/CAS races, RPC ACLs, immutable
  audit, and denial of direct table mutation.

Migration `0063`, its `0065` operator-transition/default-ACL repair, and the
CAT-08 source contract are local source candidates.
They do not replace the launch requirement for a separately deployed internal
console, named operators, alerting, queue SLAs, hosted race/revocation/deletion
evidence, human-simulated E2E, or professional review. Those remain launch
gates; the database boundary prevents the future tool from relying on direct
table edits.
