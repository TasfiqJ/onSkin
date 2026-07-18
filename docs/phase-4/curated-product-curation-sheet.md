# Phase 4 Curated Product Curation Sheet

Date: 2026-07-17

Status: operator field map; not a review, approval, or production batch

Use this field map only with the
[CAT-03 catalog curation release runbook](./catalog-curation-release-runbook.md)
and the machine-validated curation envelope. A completed Markdown row is not
authority and must never be used to bypass the signed artifacts or migration
`0058`.

## Catalog objective

Curate at least 2,000 independently sourced, reviewed, activation-eligible
records while also meeting the predeclared per-category inventory, coverage,
and quality policy for the exact defined beta-shelf coverage corpus and
untouched holdout. The 2,000-record floor is now a launch acceptance gate, but
count never substitutes for quality, provenance, dependency closure, or honest
coverage.

This self-selected beta corpus must not be called market-representative.
Observed demand prioritizes review only; it never establishes a product fact.

## Prioritization order

1. Independently sourced CAT-02 rows observed in the consented curation
   partition, ranked using privacy-minimized aggregate demand.
2. Predeclared launch categories and strata with holdout coverage gaps.
3. Rows with exact GTIN, market, formula/package revision, and complete label
   ingredient evidence.
4. Barcode/search/manual fallback gaps that block the shelf-to-routine loop.
5. Products requiring separate qualified review because the U.S. label is
   sunscreen, acne, or otherwise OTC-adjacent.
6. Products with common conflicts or duplicate actives, after professional
   review and without using beta input as ingredient/safety evidence.

Do not inspect the sealed holdout to tune this order, the target policy, or a
row's factual content.

## Required identity and lineage

| Field                    | Requirement                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Curation campaign/record | Exact immutable CAT-03 IDs and revision                                                                                                                    |
| SKU                      | GTIN + market + formula/package revision; no cross-market inference                                                                                        |
| Brand/name/category      | Positively reviewed against the exact label/source revision                                                                                                |
| CAT-01 lineage           | Source policy, approval, artifact, transform, QA, scope, and build hashes                                                                                  |
| CAT-02 lineage           | Every contributing batch and signed barcode/category/ingredient/regulatory membership, staged record, promotion, projection, revision, and receipt ID/hash |
| Per-field provenance     | Exact source/ref/snapshot for every served fact                                                                                                            |
| Source snapshot          | Required, immutable, and territory/revision-bound                                                                                                          |
| Correction state         | Zero live operator-reviewed `triaged`/`accepted` serving holds                                                                                             |

## Required product/dependency review

| Field                      | Requirement                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw label ingredient text  | Complete and exact before product guidance; never copied from beta demand                                                                                |
| Parse/tokens/mappings      | Parser version and confidence plus complete reviewed tokens and ingredient mappings                                                                      |
| Category/brand             | Reviewed; no mutable flag alone can authorize service                                                                                                    |
| Quality                    | `verified`, `usable`, `limited`, `unverified`, or `blocked`                                                                                              |
| Recommendation eligibility | Only `verified`/`usable`, reviewed, dependency-complete, active-curation rows                                                                            |
| PAO/expiry                 | Evidence-bound where used; unknown remains unknown                                                                                                       |
| CosIng                     | Informative vocabulary/reference only; never product approval or safety proof                                                                            |
| OBF                        | Exact CAT-01 ODbL/per-field provenance; images excluded from this launch path                                                                            |
| Sunscreen/OTC-adjacent     | Separate U.S.-market qualified review, exact label revision, classification, expiry/storage, allowed behavior, and prohibited claims                     |
| Bemotrizinol sunscreen     | Bind FDA OTC000039 conditions, effective date, and lawful manufacturer/licensee basis; do not activate from the ingredient name or foreign listing alone |
| Reviewer evidence          | Credential, scope, decision, conditions, timestamp, signature, and exact artifact hashes                                                                 |

## Coverage evidence fields

The tracked sheet may contain only bounded aggregate result codes and hashes.
Do not place participant IDs, stable pseudonyms, raw shelves, barcodes, product
names, searches, ingredients, photos, notes, interview text, support text,
small cells, or curation/holdout membership in Git.

For each predeclared stratum, bind:

- eligible participant, SKU, and capped observation denominators;
- suppressed/missing status;
- correct-match lower confidence bound;
- wrong-match upper confidence bound;
- parser-unknown upper confidence bound;
- below-usable recommendation exposure upper confidence bound;
- open severity counts and exact issue-system commitment; and
- deterministic pass/hold decision under the pre-outcome target policy.

Point estimates are informational. Zero observed errors is not zero risk.

## Activation checklist

- [ ] CAT-01 exact source/legal/build evidence is active and zero-warning.
- [ ] CAT-02 exact rows are reviewed/promoted and the hosted lifecycle drill
      passed.
- [ ] Separate curation-use consent and restricted retention/deletion path are
      approved and operating.
- [ ] Target policy and full reviewed-record decision were independently
      witnessed before holdout access.
- [ ] Curation and holdout partitions are sealed without leakage.
- [ ] Tracked evidence contains minimized aggregates only.
- [ ] Qualified review covers every product and dependency.
- [ ] U.S. sunscreen/OTC-adjacent rows carry separate current evidence.
- [ ] At least 2,000 eligible records, every signed category floor, and at least
      100 demand-prioritized eligible records are in the exact campaign.
- [ ] Every required confidence-bound/minimum-denominator gate passes.
- [ ] No open P0/P1, source withdrawal, review condition, or correction hold
      remains.
- [ ] Migration `0058` passed clean local and hosted pgTAP, non-serving staging,
      exact-set release/supersession race, direct-service-role denial, serving,
      retirement, and rollback verification.
- [ ] An independent database verifier signed the exact atomic-release readback
      and the named release owner accepted the complete packet.

Until every item is evidenced, keep the batch launch-blocked and preserve the
manual/no-match fallback.
