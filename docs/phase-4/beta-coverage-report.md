# Phase 4 Beta Coverage Report

Date: 2026-07-17

Status: no real consented beta coverage evidence; launch-blocked

## Authority boundary

The legacy `npm run phase4:beta-coverage-report` output is a privacy-redacted
operational summary only. It cannot establish consent, approve quality targets,
prove source lineage, approve a product, or activate a catalog. A boolean such
as `realBetaData`, an ordinary URL, a typed reviewer name, or a self-authored
hash string is never release authority.

For a selected release candidate, the same deterministic summary may be used as
a Phase 9 upstream packet only through the governed committed-output contract.
The ignored `docs/phase-4/beta-coverage-input.json` must be mounted as one
bounded regular file. The report records its exact path, byte length, and
SHA-256 without committing its dashboard URLs or detailed rows. Its `evidence`
object is an exact six-key inventory: `realBetaDataClaimed`,
`dashboardEvidencePresent`, `supportDashboardEvidencePresent`,
`analyticsDashboardEvidencePresent`, `sourceExportDigestPresent`, and
`namedSignoffPresent`. A claimed pass requires every value to be `true`, plus
empty code-error, blocker, and warning arrays. Extra or missing keys fail
closed. This shape check still does not authenticate the named person, the
dashboards, consent, or the export.

Generate the strict packet at a clean governed pre-publication prefix `P`, then
commit exactly the JSON/Markdown pair as `P`'s sole child. From the later clean
governed checkout, run:

```text
npm run phase4:beta-coverage-report:check
```

The check is non-writing. It treats both outputs as pinned `HEAD` inputs,
requires canonical JSON and one exact ISO `generatedAt`, replays the report from
the exact mounted aggregate bytes and every source blob at `P`, proves that the
pair is the complete diff of the unique direct publication child, rejects any
later edit to either output, and finishes by rechecking the worktree, complete
index, source snapshot, governed ledger, and direct evidence identities. A
backward prefix, split/JSON-only/widened commit, edited whitespace, replaced
input, or late source/index drift is invalid.

The CAT-03 release decision must instead use the signed, cross-bound artifact
chain in the
[catalog curation release runbook](./catalog-curation-release-runbook.md):

- target policy and full reviewed-record decision independently witnessed before
  holdout access;
- separately consented, privacy-minimized beta-shelf coverage corpus;
- deterministic curation/holdout split with an untouched holdout;
- exact CAT-01/CAT-02 source, every contributing batch, four required field-
  scope memberships, projection, QA, and receipt lineage;
- qualified row and U.S. sunscreen/OTC-adjacent review;
- confidence-bound quality report plus hard 2,000-record/category/priority
  inventory gates; and
- immutable foundational migration-`0058` non-serving authorization, forward-
  `0062` covered authority indexes, staged-digest pushdown, and overflow/
  completion-root curation guard, exact-set atomic campaign release,
  independently signed readback, and retirement evidence.

Generated CAT-03 JSON is a no-clobber retained artifact under
`artifacts/phase4/`; it is not a raw-data or Markdown publishing lane. A
missing-input run must stay blocked. A generated file is evidence only when the
strict contract validates every exact input, signature, lineage binding, and
database receipt.

## Honest corpus description

Call the input a **defined beta-shelf coverage corpus**. The planned beta is
self-selected and cannot support a market-representative or population-
representative claim. Report only observations for the exact declared
participants, window, builds, territory, SKUs, intake paths, and holdout.

The U.S. Census Bureau states that response-rate treatment is generally
inappropriate for convenience or self-selected samples, and that conclusions
from sample data need measures of statistical uncertainty. See
[Standard D3](https://www.census.gov/about/policies/quality/standards/standardd3.html)
and
[Standard E1](https://www.census.gov/about/policies/quality/standards/standarde1.html).

## Consent and privacy boundary

A user's shelf may reveal or support health inferences. Curation use must be a
separate, optional purpose with approved copy/version/hash, retention,
withdrawal, deletion, processor, and territory evidence. Ordinary shelf use,
analytics, support, and curation consent must not be bundled.

Do not write raw participants, account/device identifiers, pseudonyms,
shelves, searches, barcodes, product names, ingredient lists, photos, notes,
interview/support text, rare labels, small cells, or curation/holdout membership
to Git, general analytics, OBF, CosIng, or an AI provider. The tracked corpus
contains bounded aggregate counts and commitments only, with one-participant/
one-SKU caps, minimum-cell and complementary suppression, overlap/differencing
defenses, and no free text.

Hashing an identifier is not sufficient anonymization. NIST notes that some
de-identified data can be re-identified; see
[NISTIR 8053](https://www.nist.gov/publications/de-identification-personal-information).
Apple also requires accurate privacy disclosure and treats user-provided
health or medical data as Health data in its
[App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).

## Required predeclared inputs

Before anyone with target-setting authority inspects outcomes, sign and freeze:

- cohort eligibility/exclusion, collection window, territory, eligible builds,
  consent tuple, retention/deletion rule, and source-export commitments;
- SKU definition: GTIN + market + formula/package revision;
- deterministic curation/holdout split and anti-leakage rule;
- required categories/strata and minimum participant/SKU/observation
  denominators;
- at least 2,000 independently sourced/reviewed/eligible records, explicit
  required-category floors, and at least 100 demand-prioritized eligible rows;
- metric formulas, confidence level/method, rounding, and exact pass/hold
  operators;
- lower-bound floors for desirable outcomes and upper-bound ceilings for
  harmful outcomes;
- small-cell/complementary suppression and contribution caps; and
- missing-stratum, zero-denominator, repeated-look, late-arrival, correction,
  and withdrawal handling.

Before opening the holdout, also commit the complete reviewed-record bytes/root,
exact CAT-02 membership authority, candidate and eligible counts, and every
curation disposition to an independently observed append-only or trusted-
timestamp receipt. A self-declared timestamp or post-outcome signature is not
prospective evidence.

Product thresholds are product guardrails, not Apple, legal, clinical,
scientific, or industry standards.

## Required reported results

For the sealed holdout and each required predeclared stratum, report only
privacy-safe aggregates for:

- barcode/search/OCR/manual attempts and exact denominators;
- correct match, no match, and wrong match;
- parser unknown-token observations;
- manual-fallback completion and shelf-to-routine completion;
- below-usable recommendation exposure;
- unresolved correction and open P0/P1 counts;
- point estimates plus the predeclared one-sided confidence bounds;
- suppressed, missing, and insufficient-denominator states; and
- deterministic pass/hold result.

Point estimates alone cannot pass. Zero observed errors is not zero risk.
Missing required strata or insufficient denominators fail closed.

Use the curation partition to prioritize review of independently sourced CAT-02
rows. Do not tune thresholds, product facts, mappings, or row decisions against
the holdout. Beta demand never becomes brand, name, barcode, category,
ingredient, safety, efficacy, regulatory, expiry, or recommendation evidence.

## Current blockers

- no genuine consented beta corpus or restricted retention/deletion operation;
- no pre-outcome signed target or independently witnessed full-record decision;
- no sealed curation/holdout split or privacy-minimized aggregate artifact;
- no source-cleared CAT-01 and hosted-verified CAT-02 production batch;
- no qualified product/cosmetic-chemistry or U.S. OTC-adjacent reviews;
- no 2,000-record/category/priority inventory or CAT-03 confidence-bound report
  over an untouched holdout; and
- no clean local/hosted full-chain pgTAP through `0067`, staging/release/supersession
  race, direct-service-role denial, signed readback, serving, retirement, or
  rollback evidence.

Related launch blockers remain `B-CLOSED-BETA`, `B-CATALOG-SOURCE-REVIEW`,
`B-ODBL-REVIEW`, `B-CURATED-CATALOG`, and `B-CATALOG-COVERAGE`. CAT-03 remains
`in_progress`; no App Store, legal-clearance, product-quality, or revenue claim
follows from the local source controls.
