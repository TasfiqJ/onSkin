# CAT-03 Catalog Curation Release Runbook

Date: 2026-07-17

Status: `in_progress` source checkpoint; no production catalog is activated

## 1. Purpose and decision boundary

CAT-03 converts independently sourced and CAT-02-promoted catalog rows into a
reviewed launch-catalog candidate. It does not acquire source rights, promote a
source import, collect beta consent, provide professional review, deploy a
hosted database, or prove launch quality by itself.

The beta input is a **defined beta-shelf coverage corpus**. It is not a
probability sample and must never be described as market-representative,
population-representative, or evidence of population prevalence. The U.S.
Census Bureau notes that response-rate treatment is generally inappropriate
for convenience or self-selected samples and requires conclusions from sample
data to carry appropriate statistical uncertainty. See
[Statistical Quality Standard D3](https://www.census.gov/about/policies/quality/standards/standardd3.html)
and
[Statistical Quality Standard E1](https://www.census.gov/about/policies/quality/standards/standarde1.html).
A market-representative claim would require a separately reviewed sampling
frame and probability-sampling design; CAT-03 does not create either.

Passing CAT-03 means only that the exact declared corpus, target policy,
source lineage, review evidence, database snapshot, and immutable activation
record agree. It does not guarantee Apple acceptance, legal compliance,
clinical correctness, commercial success, or any revenue outcome.

Apple's current review rules require accurate metadata, rights to used content,
and support for health-related accuracy/methodology claims; TestFlight builds
are also expected to comply with the review guidelines. These are continuing
release obligations, not a threshold that a CAT-03 report can certify. See the
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
including sections 1.4.1, 2.2, 2.3, 5.1, and 5.2.

## 2. Authority chain

The release chain is strictly additive:

1. **CAT-01 source authority** approves the exact OBF/CosIng artifacts,
   transformer, release identity, territory, attribution posture, and build
   evidence.
2. **CAT-02 import authority** seals, reviews, promotes, and, where required,
   retires exact independently sourced rows with immutable lineage.
3. **CAT-03 curation authority** binds a predeclared target policy, minimized
   beta-demand aggregates, a sealed holdout, exact CAT-01/CAT-02 receipts, and
   qualified row review to one immutable launch-curation activation. The full
   reviewed-record decision is independently witnessed before the holdout is
   opened; a self-declared timestamp or post-outcome signature is not proof of
   prospective commitment.
4. **Runtime serving authority** may serve a row only while its CAT-01 source,
   CAT-02 projection, corrections, dependencies, and active CAT-03 curation
   remain positively eligible.

No later layer repairs a missing earlier layer. Beta demand may prioritize
which independently sourced rows receive review; it is never product identity,
ingredient, category, safety, regulatory, efficacy, or recommendation fact.
No raw beta entry may be copied into a product row.

## 3. Governing artifacts

The local source controls are:

- `docs/phase-4/catalog-coverage-quality-targets.template.json`: deliberately
  non-authoritative target-policy template that must be completed and signed
  before outcome access;
- `docs/phase-4/beta-shelf-corpus.template.json`: deliberately blocked,
  privacy-minimized aggregate-corpus template;
- `docs/phase-4/catalog-curation-review.template.json`: deliberately blocked
  qualified-review template;
- `docs/phase-4/catalog-cat02-membership-proof.template.json`: deliberately
  blocked exact multi-batch/four-scope membership and independent database-
  observation template;
- `docs/phase-4/catalog-curation-database-readback.template.json`:
  deliberately blocked independent post-release campaign/readback template;
- `docs/phase-3/consent-matrix.md`, `docs/phase-3/data-inventory.md`, and
  `docs/store-privacy-inventory.md`: the separate optional beta-curation and
  professional reviewer/operator processing records;
- `scripts/phase4/catalog-curation-contract.mjs`: canonical parsing,
  cross-artifact binding, signature, privacy, lineage, and release checks;
- `scripts/phase4/catalog-curation-contract.test.mjs`: adversarial contract
  tests;
- `scripts/phase4/build-catalog-curation-envelope.mjs`: fail-closed envelope
  builder for the exact candidate;
- `scripts/phase4/catalog-coverage-quality-report.mjs`: deterministic quality
  decision over the predeclared policy and sealed holdout, followed by strict
  verification of the exact signed database release/readback receipt before a
  final-clear result is possible;
- `scripts/phase4/catalog-coverage-quality-report.test.mjs`: adversarial report
  tests;
- `supabase/migrations/20260717000058_catalog_launch_curation.sql`: sealed
  curation, activation, and retirement authority;
- `supabase/migrations/20260722000062_catalog_curation_statement_guard.sql`:
  three covered authority indexes, semantic-preserving staged-digest pushdown,
  and an `AFTER STATEMENT` overflow/expected-count completion-root guard layered
  on the exact per-row authority checks;
- `scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql`: an
  isolated PostgreSQL 15/17 mechanics rehearsal that constructs a minimal
  pre-`0062` authority fixture and includes the exact `0062` migration bytes;
  it is not an exact `0061`-schema or full-chain upgrade-equivalence proof;
- `supabase/tests/database/catalog_launch_curation.test.sql`: database
  authorization, immutability, replay, dependency, serving, and retirement
  contract.

The older `beta-coverage-report` output is a privacy-redacted operational
summary only. It cannot authorize a target, establish corpus consent, approve
a product, or activate a catalog.

All JSON consumed by the release path must be duplicate-key-safe, bounded,
canonicalized, and SHA-256-bound. Files kept as templates remain blocked until
real evidence replaces every placeholder and the strict contract succeeds.

## 4. Predeclare the target policy before outcomes

The decision owner and independent reviewers must freeze and sign the exact
target policy before anyone with target-setting authority can inspect curation
or holdout outcomes. At minimum, record:

- decision ID, policy version, creation time, signing time, and signer/key IDs;
- launch territory and catalog snapshot boundary;
- target population description and an explicit `self-selected beta` sampling
  limitation;
- eligibility, exclusion, duplicate, withdrawal, and late-arrival rules;
- the SKU unit: GTIN plus market plus formula/package revision;
- collection window, eligible app builds, source export hashes, and consent
  copy/version/hash;
- deterministic curation/holdout split rule and split seed/commitment;
- exact collection build, analysis plan, metric implementation, holdout query,
  and participant-level evaluation-unit definition hashes;
- required categories/strata and minimum participant, SKU, and observation
  counts for each reported gate;
- a floor of 2,000 independently sourced, reviewed, activation-eligible
  catalog records, explicit eligible-record minima for every required
  category, and a nonzero signed floor for demand-prioritized eligible rows;
- one-participant/one-SKU contribution cap and all suppression rules;
- metric definitions, confidence level, interval method, rounding, and exact
  pass/hold operators;
- one distinct participant per endpoint as every Wilson evaluation unit, with
  no participant repeated inside an aggregate endpoint and no participant
  repeated across that endpoint's category or operational strata; clustered
  attempt/token inputs are forbidden by this contract rather than treated as
  independent trials;
- required category strata for lookup, ingredient-token-presence evaluation,
  and recommendation safety, plus the fixed route/network strata for manual
  fallback and shelf completion;
- lower confidence-bound floors for desirable outcomes such as correct match;
- upper confidence-bound ceilings for harmful outcomes such as wrong match,
  unknown parser tokens, below-usable recommendation exposure, or unresolved
  severe issues;
- rules for missing strata, zero denominators, open P0/P1 issues, and any
  repeated look at results; and
- the expiry/revalidation rule for a later source, formula, territory, app
  build, consent, target-policy, or review change.

The exact full-record curation decision, every contributing CAT-02 membership
proof, and the candidate/eligible counts must also be committed before holdout
access. The decision owner signs that authority and an independent commitment-
ledger witness records it in an externally verifiable append-only log or
trusted timestamp service. A typed `committedAt` value, a local file mtime, or
two signatures over a self-authored timestamp is insufficient. NIST SP 800-102
explains that a purported signing time alone does not establish when a private
key was used; RFC 3161 defines a trusted timestamp protocol for proving that a
data imprint existed before a time. See
[NIST SP 800-102](https://www.nist.gov/publications/recommendation-digital-signature-timeliness)
and [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html).
The checked-in JSON contract validates a pinned independent signer over an
exact append-only-log receipt; that is a witnessed log attestation, not by
itself RFC 3161 proof. Describe it as RFC 3161 only when the retained token,
certificate chain, policy identifier, imprint, nonce, and validation result are
independently verified and bound into the release packet.

Point estimates alone cannot clear the release. Zero observed wrong matches is
not zero risk. The holdout decision must use the predeclared one-sided bounds,
minimum denominators, and fail-closed missing-stratum rules. Product thresholds
are product decision guardrails, not Apple, legal, scientific, or industry
standards.

Every reported Wilson bound is a **marginal one-sided 95%** bound, not a
simultaneous confidence region. The release rule is the predeclared
intersection-union rule: every gate must pass. Do not describe the individual
bounds as jointly or simultaneously 95% covered. A zero observed below-usable
recommendation count must satisfy both the exact zero-event gate and its
predeclared Wilson upper-bound ceiling. A zero denominator is unavailable
evidence with `null` bounds, never a synthetic one-trial estimate.

This v1 contract does not accept repeated-attempt or token-level pseudo-
replication and does not accept a post-hoc clustered analysis. A future
cluster-robust route requires a new signed schema/target revision with the
estimator, resampling/variance procedure, cluster unit, implementation hash,
and acceptance threshold fixed before outcomes.

A failed or opened holdout is not a tuning set. Remediation requires a new
versioned target/corpus/curation campaign and a newly assigned untouched
holdout; do not rerun variants against the same holdout until one passes.

Combinatorial test coverage can expose interactions across category, intake
path, data quality, and device state, but it complements rather than replaces
sampling and holdout evidence. See
[NIST SP 800-142](https://csrc.nist.gov/pubs/sp/800/142/final).

## 5. Consent, minimization, and Git boundary

A shelf may reveal or support inferences about acne, pregnancy, treatments,
allergies, or other health-adjacent circumstances. CAT-03 therefore requires a
separate, optional curation-use choice. Ordinary shelf use, support, analytics,
and beta curation must not be bundled into one permission.

Before collection, record approved copy covering the exact purpose, fields,
processors, retention, withdrawal, deletion, and consequence of declining.
Withdrawal must prevent future use and trigger the approved deletion path for
participant-level source data and affected re-build/release decisions. Obtain
qualified privacy/legal review for the actual territories and flows. Relevant
primary sources include:

- [Apple App Review Guidelines 5.1](https://developer.apple.com/app-store/review/guidelines/),
  which requires accurate privacy disclosure and purpose/consent handling;
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/),
  which treats user-provided health or medical data as Health data;
- [GDPR Articles 5 and 9](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04/eng),
  where applicable;
- the Canadian privacy regulator's
  [Guidelines for obtaining meaningful consent](https://www.priv.gc.ca/en/privacy-topics/business-privacy/collecting-personal-information/consent/gl_omc_201805/);
  and
- [Washington's My Health My Data Act](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true),
  whose definitions include inferred/derived consumer health data and whose
  consent, disclosure, withdrawal, deletion, and security rules require exact
  legal review.

The following never enter Git, a tracked report, general analytics, OBF,
CosIng, an AI provider, or an unapproved dashboard:

- raw user/account/device identifiers or stable cross-run pseudonyms;
- raw shelves, searches, barcodes, product names, ingredient lists, photos,
  notes, interview text, or support text;
- rare-product labels or small cells;
- row-level curation and holdout membership; or
- free text capable of disclosing a participant or health inference.

Only a purpose-approved restricted system may temporarily hold participant-
level intake. The tracked corpus contains bounded aggregate counts and
cryptographic commitments, not raw rows. Apply one-participant/one-SKU caps,
minimum-cell and complementary suppression, overlap/differencing defenses,
bounded categories/reason codes, and a documented retention/deletion job.
Hashing an identifier is not, by itself, anonymization. NIST cautions that
de-identified information can sometimes be re-identified; see
[NISTIR 8053](https://www.nist.gov/publications/de-identification-personal-information).

The release packet must include a separately signed privacy-execution receipt.
It binds the KMS/HMAC implementation, non-secret key epoch and receipt, exact
canonical input/domain definition, commitment output-set root, suppression
audit, overlap analysis, and append-only release-registry extension proof. It
must state that no secret key material is present. A 64-character value plus a
method string is not proof that KMS HMAC was used. The privacy verifier must
inspect the retained restricted execution/audit evidence before signing.

The public/minimized evidence contract rejects any nonzero aggregate cell below
the signed minimum-cell threshold. Zero denominators remain explicit unavailable
evidence with null point/bound fields. Do not publish a blocked diagnostic that
contains sub-threshold participant, outcome, category, or route/network cells;
keep any necessary restricted diagnostic inside the approved raw-evidence
system and issue only the privacy-minimized report.

## 6. Build and seal the corpus

1. Confirm the consent tuple and restricted data path are approved and live.
2. Freeze the eligible cohort/window/builds and target policy before outcome
   access.
3. Normalize each candidate to the declared SKU unit. Cap repeat observations
   from the same participant/SKU.
4. Assign curation versus holdout using the committed split rule. A participant
   and SKU observation must not leak across roles, and target setters/reviewers
   must not tune thresholds against holdout outcomes. The independent holdout
   custodian retains a signed access/evaluation receipt binding the access log,
   participant-set roots, zero pre-open reads, zero prior/reused participants,
   exactly one allowed build/query/analysis look, and no alternative looks.
5. Use the curation partition only to rank independently sourced CAT-02 rows
   for professional review and gap remediation.
6. Generate only the minimized aggregate corpus. Each Wilson denominator uses
   one distinct participant per endpoint, all endpoint strata reconcile exactly,
   and no participant is duplicated within an endpoint. Suppress cells according
   to the signed policy, including complementary suppression where totals could
   reconstruct a hidden cell.
7. Bind the restricted export, deletion/withdrawal status, query, aggregate,
   and split commitments without publishing raw inputs.
8. Seal the corpus. Any late record, withdrawal, correction, split change, or
   query change creates a new revision; it never edits the sealed revision.

Do not call the cohort representative. Describe observed results as applying
to the exact declared beta-shelf coverage corpus and holdout only.

## 7. Curate independently sourced products

For every selected SKU, reviewers must bind their decision to the exact CAT-01
approval and every contributing CAT-02 source, batch, staged-record,
projection, dependency, and QA receipt. The signed CAT-02 membership authority
must prove the complete, unique membership set for the exact record and each
required field scope: barcode identity, category, ingredients, and regulatory
classification. A list of syntactically valid artifact hashes is not proof of
membership; verification must read the retained artifact bytes or an
independently signed database membership receipt that binds those bytes and
rows.

Exactly one declared production artifact must match all four CAT-02 hashes in
the signed target-policy lineage: stage envelope, completed database receipt,
promotion receipt, and QA report. CAT-03 v1 treats that artifact as the sole
primary product-fact authority. Barcode identity, category, and regulatory
classification must bind its exact batch and artifact digest, and must be
projections of the same primary staged row, source approval, and QA authority.
The barcode membership's staged-record digest must equal the reviewed product-
record digest. A second full-lineage match or moving any of those three scopes
to a contributing batch blocks the release even when the replacement proof is
otherwise well formed and re-signed.

Every distinct mapped ingredient entity has its own membership row and must
resolve to its exact CosIng batch, staged record, review, promotion, effect, and
immutable projection revision. The ingredient-membership set must equal the
current mapped dependency graph exactly; an omitted, duplicate, extra, null-
lineage, or unreviewed ingredient blocks the record. Expanding product-fact
sourcing beyond the one primary product row requires a versioned evidence
contract and database migration; it cannot be introduced by changing an
artifact hash.

CAT-03 v1 authorizes only the product's reviewed primary barcode. Alternate or
alias barcodes are suppressed by both lookup and authenticated RLS even when a
CAT-02 alias row exists. Serving multiple aliases requires a future versioned
per-alias membership and activation contract; it is not implied by one barcode-
identity membership.

Product identity and label facts must come from those independently sourced
records or an approved additional source route, never beta demand.

Before outcome review, an independent database verifier must read the current
append-only mutation head for every candidate product. Each per-product
`servedStateMutationRootSha256` commits to the product ID, mutation generation,
and last chained mutation event (or the product-specific generation-zero
genesis). The signed CAT-02 database observation, review database snapshot, and
review records must reconcile to the same exact sorted
`servedStateMutationRootSetSha256`. The per-product root is reviewer-signed and
is included in the offline sealed-record authority, database-base hash,
reviewed-record mapping, activation request, final database record, and signed
readback. A typed digest without the independently signed observation is not
authority.

The review must positively establish, as applicable:

- exact GTIN, market, product/formula/package revision, brand, label-visible
  name, category, source snapshot, and per-field provenance;
- complete label ingredient text, deterministic parse, reviewed tokens, and
  complete ingredient mappings before any product-specific guidance;
- category and brand identity review;
- quality disposition of `verified`, `usable`, `limited`, `unverified`, or
  `blocked`, with recommendable rows restricted to `verified`/`usable`;
- zero independent product holds in `active` or `repair_attested` state and
  disposition of every source or natural-key conflict;
- PAO/expiry evidence where used; unknown stays unknown; and
- reviewer credentials, scope, decision, conditions, timestamp, signature, and
  exact evidence hashes.

The activation operator must be independent from every outcome reviewer and
prior evidence authority by reviewer identity, trust-registry key, public-key
digest, and independence group. A different display name is not separation of
duties. Signing is deliberately staged and non-circular:

1. the catalog-quality, data-quality, regulatory, and privacy reviewers sign
   the same review body, including each pre-observed served-state mutation
   root, activation intent, and planned time but excluding the later reviewer-
   signature-set root, database campaign plan, authorization-set root, and
   activation signature;
2. the exact ordered four-signature set is hashed as
   `curationOutcomeReviewerSignatureSetSha256`;
3. that root is included in the campaign authority, every sealed reviewed-row
   authority, every activation request, and the exact request-set root; and
4. only then may the independent activation operator sign the campaign root,
   four-reviewer root, request-set root, decision, and planned time.

The operator signature timestamp must be no earlier than the planned
activation instant and strictly later than every outcome-review signature.
Backdating an operator signature, inserting it before the last review, changing
one review signature, or changing the request-set root blocks activation.

CosIng is vocabulary/reference input only. The European Commission states that
the database is informative and has no legal value; it is not an ingredient or
product approval and does not establish product safety. See the
[CosIng database notice](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en)
and
[CosIng glossary](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database/cosing-glossary-ingredients_en).

OBF-derived data remains isolated under the CAT-01 ODbL decision and exact
snapshot/per-field provenance. Open Food Facts states that its database is
ODbL, database contents have a separate contents license, and images are CC
BY-SA with possible additional rights. The ODbL also excludes trademarks and
other rights from its grant. See the
[Open Food Facts license guide](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/)
and
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Do not ship OBF images in this launch path. Preserve the exact attribution,
share-alike, and machine-readable database/alteration-file implementation that
qualified counsel approves.

## 8. Sunscreen and OTC-adjacent review

Never infer regulatory classification globally from category, brand, CosIng,
or beta behavior. Bind classification and review to the exact market and label
revision. In the United States, intended use controls whether an item is a
cosmetic, drug, or both, and FDA identifies sunscreens and acne medications as
OTC categories. See
[FDA: Is It a Cosmetic, a Drug, or Both?](https://www.fda.gov/cosmetics/cosmetics-laws-regulations/it-cosmetic-drug-or-both-or-it-soap).
Health Canada applies its own cosmetic classification framework; see
[Health Canada: What is a cosmetic?](https://www.canada.ca/en/health-canada/services/cosmetics/what-is-cosmetic.html).

Current-source review must follow effective dates, conditions, and exclusivity,
not headlines. FDA issued Final Administrative Order OTC000039 on June 9, 2026,
adding bemotrizinol under specified conditions, but the order states an August
9, 2026 effective date unless the statutory dispute path changes it and also
describes an 18-month exclusivity period for the requestor/licensees. Before
activating any U.S. bemotrizinol sunscreen, the reviewer must bind the effective
order revision, concentration/form/dose/combination/label conditions, effective
date, and lawful manufacturer/licensee basis; a foreign-market listing or the
ingredient name alone is insufficient. See the
[FDA announcement](https://www.fda.gov/news-events/press-announcements/fda-expands-sunscreen-options-first-time-20-years)
and
[Final Administrative Order OTC000039](https://www.accessdata.fda.gov/drugsatfda_docs/omuf/order/supportDoc/OTC000039/Final_Administrative_Order.pdf).

For U.S. sunscreen, acne, or other OTC-adjacent rows, activation requires the
separate qualified review evidence named in the target policy. Record exact
territory, Drug Facts/label revision where applicable, classification,
expiry/storage evidence, allowed app behavior, prohibited claims, and reviewer
conditions. Missing, stale, or mismatched evidence blocks the row; it is not
downgraded into recommendable service.

## 9. Generate the release decision

Run the checked-in contract tests, then build the exact curation envelope and
pre-activation quality decision. That result may authorize database staging but
can never claim final clearance. Final clearance additionally requires an
independently signed database readback receipt for the exact atomically released
campaign. The current source-checkpoint commands are:

```bash
npm run phase4:curation-contract:test
npm run phase4:catalog-serving-contract:test

npm run phase4:curation-envelope -- \
  --target-policy path/to/signed-target-policy.json \
  --cat02-membership-proof path/to/signed-cat02-membership-proof.json \
  --corpus path/to/minimized-beta-shelf-corpus.json \
  --review path/to/signed-curation-review.json \
  --trust-registry docs/phase-4/catalog-source-trust-registry.json \
  --generated-at 2026-09-10T14:00:00.000Z \
  --output artifacts/phase4/catalog-curation-envelope.RELEASE_ID.DIGEST.json

npm run phase4:coverage-quality-report -- \
  --envelope artifacts/phase4/catalog-curation-envelope.RELEASE_ID.DIGEST.json \
  --preactivation \
  --trust-registry docs/phase-4/catalog-source-trust-registry.json \
  --output artifacts/phase4/catalog-coverage-quality-report.preactivation.RELEASE_ID.DIGEST.json

# Only after the preactivation report passes, stage every product authorization,
# atomically release the exact campaign, and obtain the independent signed readback.
npm run phase4:coverage-quality-report -- \
  --envelope artifacts/phase4/catalog-curation-envelope.RELEASE_ID.DIGEST.json \
  --database-readback path/to/independently-signed-database-readback.json \
  --trust-registry docs/phase-4/catalog-source-trust-registry.json \
  --output artifacts/phase4/catalog-coverage-quality-report.final.RELEASE_ID.DIGEST.json
```

Set the exact CAT-01 `CATALOG_TRUST_ROOT_KEY_ID`,
`CATALOG_TRUST_ROOT_PUBLIC_KEY_SPKI_BASE64`,
`CATALOG_TRUST_REGISTRY_EPOCH`, and `CATALOG_TRUST_REGISTRY_SHA256` values in
the operator environment. Replace example paths/timestamps with the real
retained artifacts. Outputs are no-clobber and restricted to
`artifacts/phase4`; use a new immutable path for a new revision. Do not hand-
edit generated results. `--preactivation` and `--database-readback` are mutually
exclusive and omitting both fails closed. Exit `0` means the explicitly
requested phase passed: in preactivation mode that is only
`approved_for_activation`, never `clear`; in final mode it means the signed
point-in-time readback and every prior gate agree. Exit `2` means structurally
valid evidence whose requested phase remains blocked, and `1` means invalid
evidence. Do not suppress or reinterpret any result.

The decision must bind:

- target-policy bytes/hash/signatures and proof it preceded outcome access;
- consent copy/version/hash, cohort/window/build, retention, withdrawal, and
  deletion evidence;
- curation/holdout split commitments, precommitted analysis/build/query/metric
  hashes, minimized aggregate-corpus bytes/hash, and the independently signed
  holdout-custodian access/evaluation receipt;
- exact participant-level endpoint/stratum set roots, contribution caps,
  reconciliation proof, zero-pre-open-access and one-look evidence;
- signed KMS/HMAC execution, commitment output-set, small-cell/complementary-
  suppression, overlap, and append-only release-registry extension evidence;
- exact CAT-01 policy, source approvals, artifact, transformer, QA, release
  scope, and build evidence;
- exact CAT-02 stage envelope, database receipts, source/batch/staged-record/
  projection/revision identities, and serving verification;
- exact database project/migration/snapshot identity;
- each product review and reviewer credential/signature;
- point estimates, distinct-participant denominators, marginal confidence
  bounds, explicit unavailable/null denominators, suppressed/missing category
  and route/network strata, open issues, and deterministic all-gates pass/hold
  result; and
- the database campaign, activation, and retirement receipts.

Dashboard URLs are navigation aids only. A URL, typed reviewer name,
`realBetaData` boolean, or self-authored hash string is never authority.

## 10. Database activation and retirement

Migration `0058` is the foundational positive curation authority. Treat its
campaign, records, per-product authorization events/heads, global campaign release
events/head, and lineage bindings as immutable. Only the migration-owner/
operator lane may register, seal, review, verify, stage authorizations,
atomically release, or retire a campaign. API roles cannot directly read or
mutate sealed curation authority.

The current CAT-03 artifact checkpoint ends at migration `0062`; the global
deployment chain continues through migration `0065`. Migration `0063`
establishes CAT-08 operator authority, `0064` adds exact output-only
skin-profile quiz provenance without raw answers or answer hashes, and `0065`
repairs the CAT-08 transition conflict targets plus the global function default
ACL. Three covered indexes bound
the batch/record digest, retained revision, and retained promotion-effect
authority lookups. The membership function pushes the already-required staged
record digest equality into the exact staged-record join without changing the
returned authority contract. Its `AFTER STATEMENT` trigger rejects campaign-
count overflow after every insert statement. Partial governed inserts remain
allowed; only when stored rows reach the expected count does it validate the
already-sealed complete root set. The per-row structural checks remain in force. Every
CAT-03 qualified-review and independent
database-readback artifact for this source candidate must record
`schemaMigrationVersion="20260722000062"`; an artifact naming only `0058` is
historical and cannot authorize the current candidate.

Each product authorization must be replay-safe and require the complete exact
evidence chain, but staging one authorization must never affect current
serving. The one territory-wide release transaction revalidates the exact
expected record count, eligible count, category floors, database record-set
root, and authorization-set root before flipping the global active-campaign
head. A successor campaign is scoped separately, so missing or changed products
appear or disappear together only at that atomic flip. Runtime serving must
positively find the active global campaign, campaign-scoped product authority,
and all CAT-01/CAT-02/dependency/correction gates. Mutable product quality flags
or an absence of correction reports cannot substitute for active CAT-03
authority.

The active authority seals the complete client-readable served state, not a
selected quality subset. Its deterministic hashes cover every readable product
field (including PAO), the exact primary barcode, source and brand rows,
category, full ingredient-list/token/link graph, mapped ingredient rows,
synonyms, tag assignments and tag definitions, safety/restriction/annex data,
recommendation bands, and every other relation in the CAT-03 product-serving
graph. Each collection is an exact, sorted row set. Independent API surfaces
such as generic affiliate links and community topic indexes are outside this
product authority; they require their own publication controls and cannot
alter product facts or ranking. A product-graph field mutation or row insertion,
deletion, or replacement after review invalidates the live hash and suppresses
serving until a new reviewed campaign is released.

The sealed database-base hash also contains the reviewer-supplied
`servedStateMutationRootSha256`, while the post-review
`curationOutcomeReviewerSignatureSetSha256` remains outside that pre-review
base hash. The final record and activation layers bind both at their proper
stages. The database eligibility-policy bridge must preserve two decimal places
for quality scores and four for confidence scores; the fixed 95.00/0.9800
golden vector must match byte-for-byte and by SHA-256 in JavaScript and
PostgreSQL.

The signed review accepts no opaque whole-database snapshot hash and no whole
correction-ledger hash. Those undefined preimages could fingerprint unrelated
account data, reporter identities, or user free text without adding a
reconcilable serving guarantee. The review snapshot retains only narrow catalog
digests: project binding, capture time and migration, active CAT-02 batch,
candidate set, served-state mutation-root set, source-approval set, and the
exact migration/test bytes. `cat03MigrationSha256` is the SHA-256 of the exact
checked-in `20260722000062_catalog_curation_statement_guard.sql` bytes;
`cat03DatabaseContractTestSha256` is the SHA-256 of the exact checked-in
`catalog_launch_curation.test.sql` bytes. The contract recomputes both from the
current source; `buildSourceGitSha` binds their foundational `0058` lineage and
the rest of the reviewed source revision. Current operator holds are bound per product only
through the database's bounded correction-serving projection inside the
dependency/database-base hash and monotonic mutation root.

Compute the two lowercase values from the same clean reviewed checkout before
signing. Do not copy a digest from an earlier revision:

```bash
sha256sum supabase/migrations/20260722000062_catalog_curation_statement_guard.sql \
  supabase/tests/database/catalog_launch_curation.test.sql
```

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath `
  'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql', `
  'supabase/tests/database/catalog_launch_curation.test.sql' |
  ForEach-Object { "{0}  {1}" -f $_.Hash.ToLowerInvariant(), $_.Path }
```

Record insertion and campaign release use the same global-then-campaign
transaction advisory-lock order. The insert guard rechecks release state only
after taking both locks, so a record cannot enter a campaign while or after its
immutable release snapshot is committed. Reversing the lock order or relying
on a pre-lock observation is not an acceptable substitute.

`service_role`/secret-key requests bypass Row-Level Security. Therefore direct
`SELECT`, mutation, and schema privileges on catalog base/child/curation tables
must be revoked from `PUBLIC`, `anon`, and `service_role`; authenticated users
retain only the explicitly reviewed base/child `SELECT` grants whose positive
RLS policies enforce the same serving authority. The service lane receives only
the narrow security-definer lookup and search RPCs. Supabase documents both the
RLS bypass and the need to use
PostgreSQL grants as the first API-access layer. See
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).
PostgreSQL's primary documentation likewise requires a trusted `search_path`
and selective `EXECUTE` grants for `SECURITY DEFINER` functions, defines
`REFERENCING NEW TABLE` as the statement's inserted-row transition relation,
and cautions that `INCLUDE` payloads trade index-only coverage for index size.
See [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html),
[CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html),
and [index-only scans and covering indexes](https://www.postgresql.org/docs/current/indexes-index-only-scans.html).

Retirement is append-only and fail closed. Source withdrawal, CAT-02 rollback,
formula revision, correction hold, review expiry/revocation, consent or corpus
integrity issue, target-policy error, failed quality bound, or evidence drift
must suppress affected serving immediately. Retirement does not delete catalog
identities referenced by user shelves or history, and it never rewrites the
prior activation record.

Served-state invalidation is monotonic per product and begins before any CAT-03
record exists. Every relevant product/child mutation, independent operator
product hold, withdrawal of a production-approved or legally approved source,
and retirement of a promoted primary/contributing CAT-02 batch appends a
chained mutation event and advances that product's generation/root. Accepting,
rejecting, closing, or deleting the correction cannot release its hold; restoring source
approval or bytes, or restoring byte-identical batch/product state appends or
retains the later root; it can never recreate an earlier root. A per-record
invalidation marker may be retained as defense in depth, but it cannot be the
sole authority because a withdrawal can precede record insertion. Record
insertion, root advancement, and campaign release share the global transaction
advisory-lock order, so they have one serial history. Recovery requires a fresh
independent root observation, a newly signed review and database-base record, a
newly sealed successor campaign, and a new independent post-release readback.

Any product or campaign retirement, successor release, dependency withdrawal,
or review-expiry transition makes the prior database readback historical. The
runtime stays fail-closed immediately; CAT-03 final-clear and the launch
inventory gate may be restored only by a newly reviewed exact campaign and a
new independent signed readback of its post-release state. Never reuse or
reinterpret the earlier receipt as current authority.

## 11. Required verification

Source verification must include:

- all CAT-03 Node contract/report tests and the lookup/search Deno serving
  contract;
- duplicate-key, malformed UTF-8/JSON, oversized input, type-confusion,
  non-finite/fractional/negative count, canonicalization, signature, replay,
  stale-policy, post-outcome-target, split-leakage, small-cell, missing-stratum,
  confidence-bound, lineage, and evidence-drift cases;
- exact Wilson reference/rounding, zero-denominator unavailable/null behavior,
  distinct-participant denominator caps, category/operational reconciliation,
  category ingredient/recommendation and route/network hidden-failure cases;
- zero observed below-usable recommendations failing a too-wide Wilson upper
  bound, while the independent exact-zero gate remains mandatory;
- pre-open access, prior/reused holdout, second build/query/look, evaluation-
  ledger, participant-set-root, and precommitted build/metric/query tampering;
- arbitrary non-HMAC digest, KMS execution receipt, output-set root, lone or
  ineffective complementary suppression, overlap audit, and release-registry
  extension-proof tampering;
- an isolated PostgreSQL 15/17 minimal pre-`0062` forward-upgrade mechanics
  rehearsal that includes the exact `0062` bytes and tests its three indexes,
  trigger/ACL metadata, zero/partial/exact/overflow/root/released-state guards,
  and rollback; this does not replace exact full-chain reset evidence;
- a clean migration reset through `0065` and execution of the current
  99-assertion CAT-03 pgTAP contract; and
- repository typecheck, lint, tests, and source-policy/worklist audits.

Release verification additionally requires retained hosted evidence from the
exact reviewed revision:

- clean migration history and schema drift/lint proof;
- no-session, authenticated-user, and service/owner authorization tests;
- two-connection register/seal/activate/replay/retire races;
- successor-campaign staging isolation, exact-set release, all-or-nothing
  supersession, omission removal, and concurrent global-release races;
- a true two-session record-insert-versus-release race proving the shared
  global-then-campaign lock order and post-lock release-state recheck;
- direct-table denial for `PUBLIC`, `anon`, and `service_role`, authenticated
  positive/negative RLS probes on each intentionally readable relation, and
  only the explicitly approved service serving RPCs executable;
- primary-barcode lookup/read success plus reviewed-alias lookup and direct-RLS
  denial under the v1 single-barcode authority;
- active-to-retired serving suppression across barcode, search, direct product,
  ingredient, synonym, recommendation, and child-reference reads;
- operator-reviewed hold then correction close/reapproval, source withdrawal
  then attempted source reapproval/byte restoration, and promoted-batch
  retirement then attempted equivalent-state restoration, proving that each
  mutation generation/root advances and every old review remains stale;
- withdrawal or served-state mutation before CAT-03 record insertion, followed
  by exact byte restoration, proving that the stale reviewer-supplied root is
  rejected by database-base hashing, record insertion, release, and serving;
- release/record-insert races against mutation-root advancement, followed by a
  fresh independent root observation and separately reviewed successor
  campaign that alone restores serving and receives a new signed readback;
- serving suppression after a mutation, insertion, or deletion in every
  client-readable field/row-set family sealed by the live product and
  dependency hashes;
- exact CAT-01/CAT-02/CAT-03 lineage reconstruction with zero orphaned rows;
- withdrawal/deletion and small-cell audit evidence with no raw beta data in
  Git or general analytics; and
- rollback/recovery evidence for source withdrawal, correction, review expiry,
  and bad target-policy cases.

Local source tests do not replace hosted pgTAP, concurrency, real beta,
physical-device, or professional evidence.

## 12. CAT-03 exit checklist

CAT-03 stays `in_progress` until all are true:

- CAT-01 exact source/legal/build approvals and zero-warning QA are real;
- CAT-02 exact reviewed batch and hosted lifecycle/race/rollback evidence pass;
- genuine beta participants provide separate valid consent and the restricted
  intake/deletion path is operational;
- the target policy is externally signed before outcomes;
- the curation corpus and untouched holdout are sealed and privacy-minimized,
  with the independent custodian proving zero pre-open access, zero reuse, and
  the single precommitted build/query/analysis look;
- every Wilson input is a distinct participant-level endpoint unit, every
  category and route/network stratum reconciles, and the signed privacy receipt
  verifies KMS HMAC, suppression, overlap, and registry-extension evidence;
- qualified catalog/cosmetic-chemistry and U.S. OTC-adjacent reviewers sign the
  exact rows and evidence;
- every activated row has complete CAT-01/CAT-02 lineage and reviewed
  dependency closure;
- at least 2,000 independently sourced, reviewed, activation-eligible records,
  every signed required-category floor, and at least 100 demand-prioritized
  eligible records are present in the exact released campaign;
- the holdout meets every predeclared confidence-bound and minimum-denominator
  gate, with zero open P0/P1 and zero below-usable recommendation exposure;
- the complete migration chain through `0065`, with `0058` as its foundational
  CAT-03 authority, passes clean local and hosted reset, pgTAP, race, serving,
  activation, retirement, and rollback verification; and
- an independent database verifier signs the exact readback receipt after the
  atomic campaign release, and a named release owner signs the complete packet.

Until then, the catalog remains launch-blocked and the manual/no-match path is
the honest product fallback.
