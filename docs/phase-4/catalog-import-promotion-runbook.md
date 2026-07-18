# CAT-02 Catalog Import, Promotion, And Rollback Runbook

Date: 2026-07-17

Status: local source-control candidate; no production catalog has been staged or promoted

## Purpose

This runbook starts only after the CAT-01 source release runbook has produced
an exact `approved_transform` and a fresh source-specific QA report with zero
blockers, zero warnings, and a clean Git binding. Source approval authorizes
the exact offline data route; it does **not** approve any product or ingredient
row. CAT-02 adds the independent record review, dedupe, provenance,
transactional promotion, verification, and rollback boundary.

The launch path remains offline. It never enables runtime OBF/CosIng requests,
source images, or external contribution.

## Authority Boundary

| Operation                                               | Current authority                                             | Direct table access                |
| ------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| Build transform, QA, review overlay, and stage envelope | offline operator on a clean reviewed checkout                 | none                               |
| Begin, chunk-stage, finalize, and verify a sealed batch | `service_role` through exact RPC grants                       | denied                             |
| Decide individual records and approve a batch           | migration owner pending CAT-08 operator roles                 | denied to every API role           |
| Promote or roll back a batch                            | migration owner pending CAT-08 operator roles                 | denied to every API role           |
| Read runtime products                                   | bounded service lookup/search plus positive authenticated RLS | no unreviewed/withdrawn source row |

The shared service credential is transport authority, not review or release
authority. Do not grant owner-only functions to `service_role`, expose the
`private` schema, or restore direct catalog DML to make an operator workflow
more convenient. CAT-08 must introduce distinct, auditable operator identities
before a production admin UI can replace the migration-owner lane.

## Required Inputs

Retain these exact, non-symlink files outside the checked-in generated fixture
directory:

1. the production transform manifest;
2. its fresh QA JSON report;
3. an exact row-review overlay in which every transformed record has one final
   disposition and independent review evidence;
4. the CAT-01 source approval, trust-registry, release-scope, and signed build
   evidence already embedded and hash-bound by the transform;
5. a clean `origin/main` source revision containing migration `0057` and this
   runbook.

Never copy a fixture or candidate into a differently named file and treat it as
production. The transform status, import mode, known fixture hashes, source
component, approval snapshots, US territory, QA input hash, per-record content,
and reviewer overlay are all independently checked.

## Record Review Rules

- Every record is explicitly `accepted`, `rejected`, or identified as a
  duplicate/conflict. There is no implicit acceptance and no pending record can
  enter an approved batch.
- Source approval and row review use different evidence. Reviewers must not
  turn the transform's `unreviewed` status into `reviewed`, `usable`, or
  `verified` merely because the source route was approved.
- OBF product identity is the exact canonical 8-14 digit barcode/source
  reference. Name or brand similarity can raise a conflict but cannot merge a
  row.
- Every accepted OBF record has a strict calendar-valid source modification
  date no later than the signed source snapshot. Missing, malformed, fractional,
  or post-snapshot `last_modified_t` provenance is rejected before promotion;
  it is never converted to a current/import date.
- CosIng identity is the NFKC/case-normalized INCI name plus exact source
  reference; CAS, EC, and synonym collisions are secondary hard conflicts.
- A CosIng annex value outside the database's reviewed enum is rejected for
  this projection. It is never truncated or silently coerced.
- Existing catalog keys and cross-batch collisions require an explicit future
  merge/precedence workflow. Migration `0057` is intentionally insert-only.
- Sunscreen and OTC-adjacent product review remains separate professional and
  CAT-03 work. CAT-02 must not infer market legality, safety, efficacy, or
  recommendation eligibility.

## Build The Content-Addressed Stage Envelope

Use the repository command documented by
`scripts/phase4/build-catalog-stage-envelope.mjs`. The generator reads strict
UTF-8 JSON with duplicate-key detection, rechecks every transform/QA/review
binding, derives source-specific natural keys and per-record SHA-256 values,
and writes a no-clobber envelope only below `artifacts/phase4/`.

```powershell
npm run phase4:stage-envelope -- `
  --transform artifacts/phase4/<approved-transform>.json `
  --qa artifacts/phase4/<zero-warning-qa>.json `
  --reviews artifacts/phase4/<dual-signed-row-review>.json `
  --output artifacts/phase4/<source>-stage-envelope.json
```

The review overlay must contain exactly two current, independent Ed25519
reviewers from the trust registry. Both signatures cover the complete unsigned
overlay, including every row assignment, the exact 20-field batch-provenance
descriptor hash, and the database candidate digest. Neither reviewer may be a
CAT-01 source approver. The later promote/rollback operator must be a third
identity and differs from both reviewers case-insensitively.

The candidate digest is
`SHA-256(concat(SHA-256(canonicalJson(candidate_i))))` in record order under
contract `catalog-database-candidates-leaf-aggregate-v2`. This keeps the
aggregate bounded while preserving exact candidate bytes and order. PostgreSQL
recomputes it; an offline digest is never trusted by itself. The builder also
rejects envelopes over 128 MiB and batches whose projected expanded database
receipts exceed 256 MiB. Split such an input into separately approved batches;
never weaken the limits.

The QA generator and promotion consumer share one exact ordered source-hash
inventory. At promotion-envelope time every listed policy, transformer,
review, migration, pgTAP, serving, and runbook file must be clean, tracked, and
byte-equal to its blob at the QA report's current `HEAD`; a claimed empty Git
status is not trusted on its own. Missing, extra, reordered, untracked, or
working-tree-only authority bytes fail closed.

The envelope's operation key and records digest are deterministic. An exact
response-loss retry must reproduce the same request; reusing an operation or
chunk key with different bytes is an incident, not an update mechanism. Live
receipts stay outside Git. Commit only redacted, hash-bound summaries when a
release evidence contract explicitly requires them.

Every exact retry returns the original operation receipt plus
`replayed=true`, even if the batch later advanced or was retired. A replay is
not a current-status query; reread the sealed batch through the separately
approved operator evidence path before deciding the next operation.

The generator is deliberately target- and credential-free. It does not contact
Supabase or select staging versus production. An operator chooses one already
approved project, verifies migration `0057` is deployed there, and submits only
the exact RPC plan emitted in `databasePlan`. Do not hand-edit that plan.

## Database Sequence

Run the lifecycle in this order against a reviewed **staging** project first:

1. Start the batch with the envelope's exact source, artifact, manifest,
   approval, transform, QA, operation, territory, snapshot, parser, count, and
   request hashes.
2. Stage `databasePlan.stage.chunks` in ordinal order. Each RPC request contains
   no more than 500 records and 8 MiB of canonical JSON. Keep each exact request
   and response receipt. Chunk receipts include the source and PostgreSQL-
   normalized payload only so the offline completion tool can validate database
   normalization; do not retain those expanded payloads in the final evidence
   bundle. Exact retries return the original semantic receipt with
   `replayed=true`; a changed retry fails.
3. Finalize only after all ordinals are contiguous, counts reconcile, the
   aggregate record digest matches, and no duplicate natural key remains
   unresolved. The finalize receipt contains only record identity, digest,
   kind, key, and disposition.
4. Save the raw RPC outputs in one strict receipt file:

   ```json
   {
     "schemaVersion": 1,
     "contractId": "catalog-database-rpc-receipts-v1",
     "batchId": "<begin_catalog_import batch_id>",
     "chunkReceipts": ["<exact stage_catalog_import_chunk results>"],
     "finalizeReceipt": "<exact finalize_catalog_import result>"
   }
   ```

   The shown strings are placeholders for JSON objects, not literal strings.
   Keep the file below `artifacts/phase4/` and out of Git, then materialize the
   database-authoritative verification and review requests without clobbering
   an existing output:

   ```powershell
   npm run phase4:complete-database-receipts -- `
     --envelope artifacts/phase4/<source>-stage-envelope.json `
     --receipts artifacts/phase4/<source>-database-rpc-receipts.json `
     --output artifacts/phase4/<source>-database-receipt-completion.json
   ```

   The completion tool independently re-derives every normalized product or
   ingredient field from the signed candidate, compares the complete database
   payload, and recomputes the record digest as
   `SHA-256(UTF-8 canonicalJson(normalizedPayload))`. Migration `0057` uses the
   same recursive canonicalizer and explicit `C`/UTF-8 synonym ordering. Any
   semantic field, ordering, contract, or hash drift blocks decision
   materialization; matching only the record kind or natural key is
   insufficient.

5. Submit `verificationRequest` from the completion artifact and require the
   sealed batch to reach `verified`. Its evidence hash covers the exact chunk
   and finalize receipts, candidate digest, batch-provenance digest, source,
   operation namespace, and batch ID; replay flags are excluded as transport
   state.
6. Through the owner-only lane, submit the completion artifact's exact
   nine-argument `reviewRequest`. It binds every decision to PostgreSQL's
   record hash and independently checks the candidate, batch-provenance, and
   post-receipt verification-evidence digests. A preflight envelope cannot
   fabricate the latter.
7. Promote once. The function takes the deliberately stronger global catalog
   promotion advisory lock, locks the batch, rechecks live source approval and conflicts, writes projection
   rows plus immutable revisions/effects in the same transaction, and leaves
   imported rows `needs_review`/non-recommendable for CAT-03 curation.
8. Re-run verification and all barcode, search, recommendation, direct product,
   ingredient, synonym, and child-table serving probes. Any held or unapproved
   row returned is a P0 containment event.

Review approval is an immutable prerequisite recorded by its owner-only RPC.
Within the later promotion RPC, do not split projection, revision, effect, and
event writes into separate transactions. If PostgreSQL returns serialization
failure `40001` or deadlock `40P01`, discard the whole transaction result,
reread the batch, and retry the complete operation with the same exact
idempotency request. Never retry an individual projection statement.

## Promotion Acceptance Gate

All conditions are mandatory:

- exact CAT-01 production transform; no fixture or candidate marker;
- US territory and current production/legal-approved source;
- zero source-QA blockers and zero warnings;
- complete contiguous staging with exact count and digest reconciliation;
- zero unresolved natural-key or existing-catalog conflicts;
- zero pending record reviews and immutable evidence for every disposition;
- no automatic elevation of row review, quality, recommendation, or clinical
  status;
- 100% lineage from every inserted projection to staged record, batch, source
  artifact, transform, approval, QA, and review hashes;
- zero direct API-role catalog mutation grants;
- zero ineligible result from every serving path.

## Non-Destructive Rollback

Rollback is a withdrawal, not deletion:

1. freeze further promotion work for the source/territory and record the
   incident/review decision;
2. call the owner-only rollback operation with a new exact operation key,
   request hash, ticket, evidence hash, actor alias, and reason;
3. in one locked transaction, mark only that batch's projection ownership
   retired/blocked, set products non-recommendable, preserve immutable
   revisions/effects, clear the withdrawn product source reference, and append
   the rollback event;
4. prove referenced `user_products`, corrections, and lookup history still
   point to the same canonical catalog identity; no row may silently become a
   manual/unknown shelf item because rollback detached a foreign key;
5. prove a later independent batch remains intact, and every runtime serving
   path now returns the same no-match/manual fallback for the withdrawn rows;
6. retain before/after aggregate hashes and the complete redacted receipt set.

A rolled-back batch is terminal. Correct data enters through a new reviewed
batch with new catalog identities; old IDs and foreign keys remain historical
and are never silently repointed. Do not edit staged bytes, review events,
revisions, effects, or promotion history in place.

Product eligibility is dependency-closed. A product imported by an active
batch still fails closed if any linked ingredient, non-null parsed ingredient
token, or active ingredient-band dependency is withdrawn or no longer has an
approved child source. Barcode, search, direct product, ingredient, synonym,
and relationship reads all use the same import-aware serving helpers. An
unrelated product must remain servable; rollback is not a global catalog kill
switch.

## Hosted Drill Matrix

Before production, execute and retain a two-connection staging drill for:

- exact begin/chunk/finalize response-loss retries;
- changed operation/chunk replay rejection;
- partial chunks, gaps, count/hash mismatch, and injected mid-promotion
  failure with zero projection residue;
- two batches claiming the same barcode, INCI, source reference, CAS, EC, or
  synonym;
- source withdrawal racing promotion;
- correction review racing promotion;
- rollback racing a new shelf reference and a later batch;
- full-transaction retry after serialization failure;
- source withdrawal and rollback parity across barcode, search,
  recommendation, direct reads, and ingredient/reference reads.

Local pgTAP and a single-connection reset cannot prove those hosted concurrency
properties.

## Remaining Launch Gates

This source architecture does not populate or clear the production catalog.
CAT-02 remains externally gated by CAT-01's real approvals/build evidence and
by hosted staging verification. CAT-03 still requires a defined, separately
consented beta-shelf coverage corpus and sealed untouched holdout (with no
market-representative claim), pre-outcome signed coverage/quality targets,
product and ingredient curation,
and sunscreen/OTC/clinical/cosmetic-chemistry review. Final brand, attribution,
privacy/legal, physical-iPhone, TestFlight, operational staffing, and App
Review gates also remain open. No part of this runbook guarantees legal
compliance, Apple approval, product outcomes, or revenue.
