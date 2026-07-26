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
| Decide individual records and approve a batch           | migration owner; CAT-08 records recommendations only          | denied to every API role           |
| Promote or roll back a batch                            | migration owner by explicit CAT-08 decision                   | denied to every API role           |
| Read runtime products                                   | bounded service lookup/search plus positive authenticated RLS | no unreviewed/withdrawn source row |

The shared service credential is transport authority, not review or release
authority. Do not grant owner-only functions to `service_role`, expose the
`private` schema, or restore direct catalog DML to make an operator workflow
more convenient. CAT-08 introduces distinct, auditable operator identities for
recommendations but intentionally does not replace the migration-owner approval,
promotion, rollback, or CAT-03 activation lane.

## Required Inputs

Retain these exact, non-symlink files outside the checked-in generated fixture
directory:

1. the production transform manifest;
2. its fresh QA JSON report;
3. an exact row-review overlay in which every transformed record has one final
   disposition and independent review evidence;
4. the CAT-01 source approval, trust-registry, release-scope, and signed build
   evidence already embedded and hash-bound by the transform;
5. a clean `origin/main` source revision containing migration `0057` and the
   full forward chain through `0067`, plus this runbook.

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
- Do not infer `benzoyl_peroxide` from product names, ingredient text, or OBF
  category tags. As reviewed on 2026-07-22, the upstream Open Food Facts
  [beauty category taxonomy](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/beauty/categories.txt)
  contains no `benzoyl`, `acne`, or `anti-acne` category entry. An absent or
  fuzzy upstream category is not regulated-product evidence.
- The only CAT-02 exception is an OBF row with disposition `accepted`, reason
  `accepted_with_category_override`, `categoryOverride` exactly
  `benzoyl_peroxide`, a retained HTTPS `categoryOverrideEvidenceUri`, and its
  exact lowercase SHA-256 in `categoryOverrideEvidenceSha256`. The evidence
  URI must be a canonical HTTPS URL with no credentials, query, fragment,
  whitespace, IP literal, or exact/subdomain match for a name in the
  [IANA special-use domain](https://www.iana.org/assignments/special-use-domain-names/special-use-domain-names.xhtml)
  registry (including its reverse-DNS entries), or the additional conservative
  non-public names `.home` and `.internal`. IANA states that a special-use
  designation covers the listed name and its subdomains. These structural rules
  exclude credentials in the URL authority, every query and fragment, IP
  literals, and known special-use/non-public hosts. They cannot prove that an
  otherwise valid path segment contains no secret. Reviewers must verify that
  the retained path is a stable, public, non-secret evidence location and that
  no access token or other secret appears in any path segment. This is a retained
  reference check, not DNS resolution or network reachability proof; the
  promotion contract never fetches the URI. The URL or hash alone does not
  authorize the override; both independent
  reviewers must sign the complete v2 overlay and its post-override database
  candidate digest.
- Sunscreen and OTC-adjacent product review remains separate professional and
  CAT-03 work. CAT-02 must not infer market legality, safety, efficacy, or
  recommendation eligibility. FDA OTC Monograph M006 identifies benzoyl
  peroxide at 2.5% to 10% as an acne active ingredient, so ingredient-name
  presence alone cannot prove that a particular formula and label satisfy the
  monograph. CAT-03 must still bind independent product-level OTC/regulatory
  evidence before any serving authorization. See the
  [FDA OTC Monograph M006](https://www.accessdata.fda.gov/drugsatfda_docs/omuf/monographs/OTC%20Monograph_M006-Topical%20Acne%20drug%20products%20for%20OTC%20Human%20Use%2011.23.2021.pdf).

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

The review overlay is exclusively `catalog-row-review-overlay-v2` with schema
version 2, signature envelope `catalog-row-review-signature-v2`, and signing
domain `routinekind.catalog-row-review-overlay.v2`. Every record contains the
three category-override fields, using explicit `null` values when there is no
override. It must contain exactly two current, independent Ed25519 reviewers
from the trust registry. Both signatures cover the complete unsigned overlay,
including every row assignment, override category, evidence URI and digest,
the exact 20-field batch-provenance descriptor hash, and the database candidate
digest computed after any override. Neither reviewer may be a CAT-01 source
approver. The later promote/rollback operator must be a third identity and
differs from both reviewers case-insensitively.

This is an explicit pre-production v2 cutover. Repository evidence records no
production transform/review artifact, hosted CAT-02 deployment, or promoted
production catalog, so legacy v1 review overlays, signature domains, stage
envelopes, and `offline-reviewed-transform-record-v1` hashes are invalidated
rather than ambiguously upgraded. Regenerate and re-sign them as v2. The stage
envelope is `catalog-stage-envelope-v2`, schema version 2, and every audit row
uses `offline-reviewed-transform-record-v2`. No v1 artifact is accepted even
when all override fields would be null.

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
Supabase or select staging versus production. Before applying this migration
chain to any project, capture and retain the approved read-only remote migration
history. **Stop** if migration `0059` is already present, if the remote history
differs from the reviewed source chain, or if the remote history cannot be
verified; do not deploy until the discrepancy has an approved forward-remediation
plan. After an approved clean-chain deployment, an operator verifies migrations
`0057` through `0067` are present and submits only the exact RPC plan emitted in
`databasePlan`. Do not hand-edit that plan.

Migration `0057` remains byte-stable. Migration `0061` replaces only the exact
stage RPC to add the new database enum member, repairs the shared health trigger
for both clean-install and already-applied-`0060` environments, and removes any
historically named policies from sealed scan/correction relations before
reasserting privileges. Migration `0062` preserves those per-row curation
decisions while adding three bounded authority lookup indexes and a deterministic
statement-level count/root-set guard for governed bulk curation inserts. The
forward `0065` repair makes both `0063` operator-transition paths executable by
targeting the work-state primary-key constraint explicitly and revokes the
global default `PUBLIC` function-execution grant; it does not delegate CAT-02
promotion authority. The additional `0066` migration seals the unreviewed
legacy conflict/sequencing fixtures and likewise does not delegate CAT-02
promotion authority. Migration `0067` supplies a checker-only ephemeral table
shape for the known runtime-temporary-table release wrapper so all remaining
statements stay linted, with no extension dependency or runtime/security
behavior change. The unrelated `0064` chain member adds minimized,
output-only skin-profile quiz provenance and stores no raw answers or answer
hashes. The sole historical-file exception is migration `0059`:
the repository contains no retained hosted evidence that it was applied, but
that absence does not prove remote state. The file contained a missing closing
parenthesis that prevented a clean migration chain from parsing at all. Its
source fix is exactly that one parenthesis; an additive migration cannot repair
SQL that PostgreSQL cannot first parse. No other historical migration file is
changed by this correction.

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
