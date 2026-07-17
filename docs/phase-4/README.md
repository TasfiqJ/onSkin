# Phase 4 Catalog Source and Curation Controls

Status: engineering source checkpoint; not production approved

Start with the
[CAT-01 catalog source release runbook](./catalog-source-release-runbook.md).
Then use the
[CAT-02 import/promotion/rollback runbook](./catalog-import-promotion-runbook.md)
for the independent record-review and database lifecycle.
The current checked-in trust registry, release scope, release-build evidence,
and source-approval templates are deliberately pending and cannot authorize an
import.

## Source decision packet

- [Machine-readable source policy](./catalog-source-policy.json)
- [Open Beauty Facts source-rights checkpoint](./catalog-source-memo-open-beauty-facts.md)
- [CosIng source-rights checkpoint](./catalog-source-memo-cosing.md)
- [ODbL compliance memo](./odbl-compliance-memo.md)
- [Pending external reviewer trust registry](./catalog-source-trust-registry.json)
- [Pending fixed US release scope](./catalog-release-scope.json)
- [Pending EAS/archive/App Store build evidence](./catalog-release-build-evidence.json)
- [Pending OBF approval template](./obf-source-approval.template.json)
- [Pending CosIng approval template](./cosing-source-approval.template.json)

## Operator and acceptance packet

- [First curated product batch](./first-curated-product-batch.md)
- [Ingredient-tag taxonomy](./ingredient-tag-taxonomy.md)
- [Curated product curation sheet](./curated-product-curation-sheet.md)
- [Catalog observability dashboard](./observability-dashboard.md)
- [Beta coverage report requirements](./beta-coverage-report.md)
- [Phase 4 exit review](./phase-4-exit-review.md)
- [CAT-02 catalog import, promotion, and rollback](./catalog-import-promotion-runbook.md)

The only launch source flow is: acquire offline source bytes; create a
non-promotable candidate from a clean committed transformer; obtain an active
externally root-signed and replay-pinned reviewer registry; approve the exact US
release scope; obtain distinct legal and engineering signatures over the exact
source approvals; create clean active/approved/pending build-candidate commit A;
build A in EAS; record signed archive/App Store evidence in evidence-only
descendant B (active/approved/verified); re-run the same transforms and
source-specific QA; then use CAT-02 staging, review, transactional promotion,
serving-gate verification, and rollback. The pending/pending/pending baseline is
the only other valid audit state; every mixed transition fails.

OBF/CosIng are not runtime recipients. Source images and external contribution
are excluded. Missing-product and wrong-match reports remain first-party, and
migration `0056` hides every source/product that lacks positive legal,
production, review, quality, eligibility, mapping, and correction evidence.
Migration `0057` adds the local source candidate for sealed, replay-safe
staging; per-record review; exact-key conflict detection; immutable lineage;
transactional insert-only promotion; and non-destructive batch rollback. It
also closes legacy broad ingredient/brand/category read paths and removes
direct API-role global-catalog mutation. Real approved artifacts, dedicated
CAT-08 operator identities, hosted concurrency/rollback evidence, and a
reviewed launch catalog are still absent.
Passing these source controls does not guarantee Apple acceptance, legal
compliance, product efficacy, or revenue.
