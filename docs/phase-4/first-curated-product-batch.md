# Phase 4 First Curated Product Batch

Date: 2026-07-17

## Status

Not production populated.

The repository includes `scripts/phase4/fixtures/curated-products.sample.json` as a structure-only fixture. It is not a reviewed launch batch and must not be used as production product data.

## Why This Is Blocked

A real first batch requires:

- approved source routes;
- brand/legal attribution decisions;
- separately consented, privacy-minimized input from a defined beta-shelf
  coverage corpus, with a sealed holdout and no market-representative claim;
- a signed coverage/quality target policy fixed before outcome access;
- an externally witnessed full-record decision fixed before holdout access;
- product identity review;
- ingredient-list review;
- separate U.S.-market sunscreen/OTC-adjacent qualified review;
- import QA with zero blockers or warnings;
- complete CAT-01/CAT-02 lineage across every contributing batch and required
  field scope; and
- immutable CAT-03 non-serving authorization, exact-set atomic campaign
  release, signed database readback, and retirement evidence.

Creating 2,000 unverified rows locally would make the product look complete while lowering trust. That is the opposite of the Phase 4 requirement.

The launch gate requires at least 2,000 independently sourced, reviewed,
dependency-complete, activation-eligible records and the signed per-category
floors, plus at least 100 demand-prioritized eligible records. Ineligible,
rejected, fixture, duplicate, or merely imported rows do not count toward that
inventory floor.

## Batch Acceptance Criteria

Each production row must have:

- SKU identity bound to GTIN, market, and formula/package revision;
- source and source reference plus exact CAT-01 approval/artifact/QA lineage;
- exact CAT-02 membership for barcode identity, category, ingredients, and
  regulatory classification across every contributing batch, plus staged-
  record/projection/revision/receipt lineage;
- snapshot date;
- reviewed brand/name/category;
- barcode when available;
- raw ingredient text if the row can drive product-level guidance;
- parser version and confidence plus complete reviewed token/mapping
  dependencies;
- quality grade;
- qualified review status, signature, conditions, and exact evidence hashes;
- unresolved operator correction holds of zero for recommendable rows;
- separate current U.S. evidence for sunscreen/OTC-adjacent behavior where
  applicable; and
- an active exact-set CAT-03 campaign and campaign-scoped product authority.

Beta demand can determine review priority only. It cannot populate or correct
brand, name, barcode, category, ingredients, safety, regulatory status,
efficacy, expiry, or recommendation facts.

## Fixture-only toolchain check

These commands validate the checked-in fixture and importer/QA mechanics only.
They do not consume an approved source artifact and cannot produce or authorize
a launch batch:

```bash
npm run phase4:import-obf-fixture
npm run phase4:import-cosing-fixture
npm run phase4:qa-report
npm run phase4:qa-report-cosing
```

## Production candidate transform (not promotion)

Follow the complete
[CAT-01 catalog source release runbook](./catalog-source-release-runbook.md).
The commands below are a compact operator sequence, not a substitute for its
trust, release-scope, build-evidence, serving-gate, and retained-evidence
requirements.

Use the beta shelf intake list and separately acquired offline source artifacts
to create hash-only OBF and CosIng candidates from a clean, committed source
tree. Candidate mode performs the deterministic bounded transform, records the exact artifact,
transformer-bundle, Git tree, and transformed-payload hashes, and is explicitly
non-promotable:

```bash
node scripts/phase4/import-obf-snapshot.mjs --candidate path/to/source-products.jsonl artifacts/phase4/obf-candidate.json
node scripts/phase4/import-cosing-dictionary.mjs --candidate path/to/cosing.csv artifacts/phase4/cosing-candidate.json
```

Preliminary candidates may expose malformed input, but the approval-bound
candidates must be regenerated from clean active-registry/approved-scope/
pending-build-evidence commit A. Reviewers sign only A's exact transformer,
artifact, and deterministic transformed-payload bindings.

Every candidate and production manifest declares
`catalog-transformed-payload-v1`. Its canonical SHA-256 covers the exact
pre-enrichment records, rejects records that already contain
`sourceSnapshotDate`, and allows no undeclared digest exclusion. The date is
bound separately to avoid a circular approval flow: the detached approval
signature covers both `artifact.snapshotDate` and the candidate's exact
`transformationRecordSha256`; production import then copies that signed date to
`sourceSnapshot.date` and every record's `sourceSnapshotDate`. QA requires the
declared contract and exact equality across those signed/manifest/record paths.

Independent legal and engineering reviewers then populate the OBF and CosIng
source-approval templates with those exact hashes, the fixed release scope,
current externally root-signed trust registry, and source-specific retained
terms/acquisition/attribution/operations evidence. OBF also binds the
conservative ODbL classification and deployed machine-readable-delivery
implementation; CosIng binds the exact reuse, third-party-rights, glossary, and
informative-only posture. Both reviewers sign each canonical approval payload
with distinct active Ed25519 identities. Only after that detached evidence
exists may the exact same committed transformer and source artifact run
production mode:

```bash
node scripts/phase4/import-obf-snapshot.mjs --production path/to/source-products.jsonl artifacts/phase4/obf-approved-transform.json --approval-manifest path/to/signed-obf-approval.json
node scripts/phase4/catalog-qa-report.mjs artifacts/phase4/obf-approved-transform.json artifacts/phase4/obf-catalog-qa-report.json
node scripts/phase4/import-cosing-dictionary.mjs --production path/to/cosing.csv artifacts/phase4/cosing-approved-transform.json --approval-manifest path/to/signed-cosing-approval.json
node scripts/phase4/catalog-qa-report.mjs artifacts/phase4/cosing-approved-transform.json artifacts/phase4/cosing-catalog-qa-report.json
```

The production environment must also provide the external catalog trust-root
key ID/public key, pinned current registry epoch/raw-file hash, and exact
production identity, EAS build ID/Git commit, iOS build number, US territory,
final host, and support-email values that match `catalog-release-scope.json`.
The clean active/approved/pending commit A is the commit EAS builds. Signed
`catalog-release-build-evidence.json` is then recorded in evidence-only
active/approved/verified descendant B and must bind A's resolved production Expo
config, EAS metadata, inspected IPA/Info.plist hashes and identity, App Store
Connect app, and observed US availability without transformer/config drift.
Before A, the operator must manually advance the reviewed
`CATALOG_RELEASE_IOS_BUILD_NUMBER`; production app config embeds it and EAS
auto-increment remains disabled. A dirty
tree, stale source snapshot, changed runtime/transformer, copied fixture, expired
or revoked key, missing deployed attribution/data surface, or warning-bearing
production QA packet fails closed. A missing or changed transformed-payload
contract, digest mismatch, or snapshot-date binding mismatch also fails closed.

The transform performs no network I/O and is not a database promotion. The
local CAT-02 source candidate now provides a content-addressed review envelope,
sealed transactional staging, exact-key conflict review, immutable lineage,
insert-only promotion, verification, and non-destructive rollback through
migration `0057`. Follow the
[CAT-02 runbook](./catalog-import-promotion-runbook.md). No real approved
artifact or reviewed row overlay exists in this repository, no hosted drill
has run, and no production row has been promoted. OBF
database classification and the resulting attribution/share-alike/offer-of-data
operations remain counsel decisions; no runtime source lookup, image import, or
external contribution is authorized by this command. Migration `0056` then
keeps every source that lacks production/legal approval, and every unreviewed,
below-usable, ineligible, or operator-held product, out of barcode, search,
recommendation, and direct authenticated serving paths.

## CAT-03 curation and activation

After CAT-01 and CAT-02 are real, follow the
[CAT-03 catalog curation release runbook](./catalog-curation-release-runbook.md).
The checked-in target, beta-corpus, and curation-review files are deliberately
blocked templates. The CAT-03 contract must bind a target policy signed before
outcomes, separate consent, minimized aggregate demand, curation/holdout split,
an externally witnessed full-record decision before holdout access, confidence-
bound quality decision, hard 2,000-record/category/priority inventory gates,
exact CAT-01/CAT-02 memberships, qualified review, and the exact database
snapshot. Dashboard URLs, a typed signoff name, or a `realBetaData` flag cannot
authorize a release.

Foundational migration `0058` adds local campaign-scoped non-serving product
authorization, one exact-set atomic global campaign release, independent signed
readback, immutable retirement, and RPC-only `service_role` access, and makes
the active global CAT-03 campaign a positive serving dependency. It does not
create a real batch.
Forward migration `0062` adds three covered authority indexes, semantic-
preserving staged-digest pushdown, and the indexed `AFTER STATEMENT` overflow
and expected-count completion-root guard while allowing partial governed inserts;
current review and readback artifacts must attest exact latest
migration `20260722000062`.
Its isolated PostgreSQL 15/17 rehearsal uses a minimal pre-`0062` authority
fixture and includes the exact `0062` bytes; it is not exact full-chain or hosted
evidence.
No consented beta corpus, witnessed target/decision, qualified product review,
2,000-record launch campaign, signed database readback, clean hosted full-chain
evidence through `0067`,
lifecycle evidence, or active launch campaign exists yet. CAT-03 therefore
remains `in_progress`, and no production row is launch-authorized.
