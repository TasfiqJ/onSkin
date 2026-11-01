# Campaign38 owner-confirmed bottle history candidate

Authority: BRAIN-M1X-MASTERV2-OWNED-FORMULA-VERSION38-SOURCE-CANDIDATE-01.
Parent PR40 is immutable at 530da5d8af8c3b74a1675a4cfdffc03dca2ec9c1,
tree 034cd0b1708362f377a88dbef24e6fe0ddfbd1e3. The first-child plan is
619679d8774743176d9c59d2e68561b27f7765b6; its bytes never change.

This is a local V2-C02 source implementation candidate for independent Brain
review. It does not complete C02, qualify a catalog, authorize M2, or admit
native, clinical, provider, paid, Security, database or public release gates.

## Actual user behavior

Shelf's existing product card still opens product detail. **Bottle & formula
history** opens the private history route for that exact unit. A bottle without
an observation starts unknown. Manual ingredient text, parser status and catalog
quality remain identity metadata; none creates a confirmed formula.

**Record label observation** creates a memory-only draft. The owner explicitly
chooses a printed label or deliberately retains unknown, enters observed
market/variant/date where available, then taps **Confirm this bottle
observation**. The label must be supplied for a label confirmation; unknown
cannot carry invented ingredient text. Cancel/Back discards the draft. Corrections
append an immutable version; prior factual records remain visible. The route
discloses that user confirmation is neither scientific nor clinical validation
and that ingredient order does not show concentration.

The route exposes loading, unknown, draft, cancellation, outdated revision,
private-storage refusal, offline operation and verified local readback. Feedback
is fixed below the header so it remains visible after a scrolled confirmation.
Record/error/refresh actions retain accessible names and scrollable phone targets.

## Source and durability boundary

ProductIdentity38, FormulaVersion38 and OwnedProductVersion38 are separate
immutable records. They carry schema version, stable content-derived ID,
owner/unit, actor, provenance/basis, recorded time, observed date where available,
SHA-256 content identity and predecessor references. The owned version chain binds
the distinct identity and formula records to one physical unit. Canonical sorted
UTF-8 JSON is hashed synchronously with the existing locked noble SHA-256
implementation and checked independently against node:crypto in tests. A hash
identifies content; it is not a signature, catalog qualification or truth proof.

Opt-in Shelf envelope v4 adds history and its revision/current pointer inside
the existing encrypted `layerwell.shelf.v1` value. The existing privateKV
serialized read/transform/write, authenticated encryption, exact ciphertext
rollback, account-generation and health-data leases remain the transaction
boundary. No second history key, plaintext browser persistence or remote formula
contract is added. Unconfirmed canonical v3 reads retain their bytes; v1/v2/v3
history opt-in retains the exact input string in the same encrypted envelope.
That archive represents bytes at first history opt-in, not a recovered history
of earlier ordinary lifecycle migrations. Existing legacy unknown states stay
unknown. Malformed/future envelopes fail unavailable without reset.

Confirmation compares expected product update time, product identity hash,
revision and current version ID inside the transaction. Overlapping changed
payloads fail stale. Reconfirmation of the current identical observation and an
immediate identical uncertain retry return the existing version. Readback from
canonical encrypted source is mandatory before success. History reads compare a
second canonical source snapshot so a delayed read cannot publish a record from
before a concurrent source change/deletion. These are client/local guarantees;
native process-death, physical power-loss and signed-device storage qualification
are not supplied by browser or synthetic storage ports.

The new route remounts private memory on unit or health-generation changes.
`useShelf` renders authority from its subscribed health snapshot, closing the
real browser stale-display defect reproduced during C38: storage correctly
refused a closed epoch while the old independent getter left UI visible. Cold
browser evidence is distinct from the unit tests of render-time callbacks.

## Privacy and existing lifecycle

Formula content never becomes product ingredients, engine inputs, mirror
columns, analytics, support, commerce or network data. Existing `user_products`
payload/FIFO schema and replay behavior remain unchanged. Only existing v2
mirror migration work is retained if history opt-in first migrates v2 source.
There is no new provider or paid authority.

Archive preserves the original unit's history. Re-add/replenishment creates a
new owned unit without inherited bottle confirmation. Remove filters its history
in the same transaction and drops the retained original-byte archive when that
archive contains a removed unit. A queued mirror replay carries no formula
content and cannot restore local history. Existing local private-data cleanup
already removes the Shelf key.

History is local-only with respect to cloud sync. The existing owner-requested
local-device export generically includes the Shelf envelope, potentially
including this history and retained legacy bytes. It is not a new portable
formula-history format, and no import/cloud-restore contract is implemented.
Export's existing recursive owner-field redaction does not parse a retained
legacy JSON string; no blanket sanitization claim is made for those old bytes.

Input limits are 8,000 UTF-16 label characters / 24,000 UTF-8 bytes, 80 market
characters and 160 variant characters, with unsafe controls/surrogates/bidi
formatting rejected. The local envelope is bounded, with up to 64 versions per
unit and 1,000 histories. Capacity refusal preserves existing bytes, never prunes
the past. At a unit's limit the UI explains why another record cannot be added.

## Evidence and permanent limits

The hash-bound TASK ledger records actual commands/exits/log hashes. The return
packet carries exact changed source, per-commit patches, full tracked raw
inventory/index/modes, browser screenshots/DOM/console/network, genuine failures
and source/run identities. Synthetic native-storage port tests exercise real
privateKV encryption/rollback but are not native process relaunch proof. Actual
Chrome document reload and Back/Forward evidence has its own qualification.

Current38 source/event/ref/service-merge integrity is independent. Original37
current-source programs execute only at exact PR40 in a fresh full historical
checkout, including authentic nested36-to29 replay. Only Quality's first
governance step changes; its later steps, database/export jobs, original Security
workflows, old validators, policies and provider/database source remain protected.
Historical scope source references are authenticated at their declared snapshot;
changed current references require new review and never renew old assessment.

All 38 full-app/J01 obligations remain complete=false and all 18 owner gates
admitted=false. acceptanceGranted=false; release=NO_GO; G97 FAIL/NO_GO; original
Security FAILED; DB06/DB08/R2B NOT_ACCEPTED; M1-03 BLOCKED_EXTERNAL_CUSTODY /
NOT_ACCEPTED; M2 NOT_AUTHORIZED. J01 is one candidate only; G1/G2/G3/G5 optical
and G4 longitudinal remain NOT_ACCEPTED. F18/J02-J27 including J05 stay deferred.
F09 encrypted private photos/diary/history/manual comparison stays preserved.
Physical signed iPhone/VoiceOver, clinical/chemistry/rights/IP, StoreKit/
RevenueCat, real providers/Ask, professional billing/permissions, staffed
moderation/operations, Apple and public release remain closed and unqualified.
No merge, deployment, spending, real owner/photo/provider use or positive advice
is authorized by this source candidate.
