# CAT-01 CosIng Engineering Source-Rights Checkpoint

Date: 2026-07-17
Status: engineering research recorded; production legal approval pending

## Source

CosIng is the European Commission cosmetic ingredient database:

- Source URL: https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en
- CosIng glossary: https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database/cosing-glossary-ingredients_en
- Commission reuse decision: https://eur-lex.europa.eu/eli/dec/2011/833/oj/eng
- Intended use in OnSkin: ingredient dictionary baseline, INCI names, synonyms where allowed, regulatory-reference flags, and reviewer workflow support.

## Primary-Source Findings (Not Legal Approval)

- CosIng is maintained by the European Commission for cosmetic substances and ingredients in the EU cosmetics framework.
- The Commission describes CosIng as informative. It is not a substitute for legal review.
- An ingredient appearing in CosIng must not be presented as "approved", "safe", or "recommended" by OnSkin.
- Annex status for colorants, preservatives, and UV filters is not equivalent to product-level safety or legality in every market.
- The Commission says the glossary is not an authorized list, is not exhaustive, and is updated over time. The applicable cosmetics regulation/annexes and a product safety assessment remain authoritative.
- The Commission reuse framework generally permits reuse subject to conditions, but excludes third-party intellectual property and industrial property; counsel must review the exact export, fields, notices, and attribution before production use.

## Engineering Preparation and Gated Candidate Transform

The following actions are not production promotion. Candidate mode computes the
deterministic exact hashes reviewers need and is always non-promotable.
Production mode requires a completed exact-artifact approval manifest, active
externally anchored trust registry, approved fixed release scope, and the exact
production environment; fixture and metadata preparation do not:

- Store source metadata and review status.
- Import a fixture-sized dictionary for parser tests if the source path and reuse posture are documented.
- Create a hash-only candidate under ignored `artifacts/phase4/` from a clean committed transformer tree.
- Transform an approved offline snapshot only when a detached approval manifest binds the source URL/date, exact SHA-256, attribution surface, allowed uses, forbidden claims, and named legal/engineering review.
- Preserve unknown tokens and low-confidence matches.
- Show ingredient names as data, not as safety claims.

Production gates and claim prohibitions:

- Production bulk promotion remains blocked pending legal/compliance signoff.
- Any "CosIng-approved" wording is prohibited.
- Any safety, pregnancy, medical, or product-recommendation claim based only on CosIng presence is prohibited.
- Treating EU regulatory data as U.S. product clearance is prohibited.

## Implementation Notes

Schema support exists in `catalog_sources`, `ingredients`, `ingredient_synonyms`, `ingredient_tag_assignments`, and `catalog_import_batches`.

The seeded `cosing` source is `production_approved=false` and `review_status=pending`.

`docs/phase-4/catalog-source-policy.json` is the machine-readable fail-closed
control. `import-cosing-dictionary.mjs` accepts only checked-in fixture files
under explicit `--fixture`, a non-promotable `--candidate`, or `--production`
with a current approval bound to the exact artifact bytes/hash, policy, active
trust registry, fixed release scope, current transformer, and deterministic
transformed payload. The legacy `COSING_IMPORT_APPROVED` environment flag has
no authority. Every transformed row carries the CosIng reference-component ID,
snapshot date, and artifact hash; the manifest fixes the claim authority to
`informative_reference_only`.

The import manifest also declares `catalog-transformed-payload-v1`. Its canonical digest covers the exact records before `sourceSnapshotDate` enrichment, and the digest helper rejects pre-enriched records. The detached production approval separately signs the exact transformed digest and artifact snapshot date. Production import copies that signed date into the manifest and every row; QA rejects a missing/changed contract or any digest/date-binding mismatch.

The operator follows
`docs/phase-4/catalog-source-release-runbook.md` and starts from
`cosing-source-approval.template.json`. Distinct active legal and engineering
Ed25519 identities sign the same canonical approval. Production mode rejects
the untouched template, checked-in fixtures, missing or expired decisions,
changed artifact/transformer, stale or replayed trust registries, unapproved
identity/fields/territories, placeholder or non-independent reviewers, absent
operations/evidence, and any attempt to enable images or runtime requests.
Source-specific QA revalidates the embedded approval, exact CosIng schema and
status/glossary fields, deterministic payload, and signed exact EAS/archive/App
Store evidence from `catalog-release-build-evidence.json`.

For App Review and U.S. claims, the current operator packet must cross-check
[Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
sections 1.4.1, 1.5, 2.1, 2.3, and 5.1; the
[FDA cosmetics-claims guidance](https://www.fda.gov/cosmetics/cosmetics-labeling/cosmetics-labeling-claims);
and the
[FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance).
Those sources reinforce heightened scrutiny for inaccurate health information,
supporting-data/methodology disclosure for health-measurement accuracy claims,
accurate support/live review surfaces, truthful non-misleading claims, privacy,
drug-claim boundaries, and prior claim substantiation. Neither CosIng presence
nor this engineering packet guarantees Apple or legal acceptance.

## Exit Criteria

- Counsel records reuse/attribution obligations.
- Cosmetic-chemist reviewer signs the ingredient-tag taxonomy.
- The external root-signed reviewer registry, separately pinned epoch/raw hash,
  approved US release scope, dual-signed exact CosIng approval, and signed
  EAS/archive/App Store build evidence all validate for the same release.
- Import artifact hash, snapshot date, parser version, and QA report are attached to a `catalog_import_batches` record.
- CosIng production QA has zero blockers/warnings and the approved component is
  promoted only through the CAT-02 staging/review/rollback path.
- Product UI copy continues to describe CosIng as a source, not as an endorsement.
