# Phase 4 Catalog Source and Curation Controls

Status: engineering source checkpoint; not production approved

Start with the
[CAT-01 catalog source release runbook](./catalog-source-release-runbook.md).
Then use the
[CAT-02 import/promotion/rollback runbook](./catalog-import-promotion-runbook.md)
for the independent record-review and database lifecycle.
Then use the
[CAT-03 catalog curation release runbook](./catalog-curation-release-runbook.md)
to bind a predeclared quality policy, separately consented and minimized beta-
shelf coverage corpus, a prospectively witnessed full-record decision,
untouched holdout, qualified row review, non-serving product authorization,
atomic exact-set campaign release, signed point-in-time database readback, and immutable
retirement authority.
The current checked-in trust registry, release scope, release-build evidence,
source-approval templates, CAT-03 target/corpus/review/membership/readback templates, and blocked
generated reports are deliberately pending and cannot authorize an import or
catalog activation.

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
- [CAT-03 catalog curation and activation](./catalog-curation-release-runbook.md)
- [CAT-08 operator authority and correction runbook](./catalog-operator-authority-runbook.md)
- [CAT-08 aggregate source contract](../../scripts/phase4/catalog-operator-authority-contract.mjs)
- [Pending coverage/quality target policy](./catalog-coverage-quality-targets.template.json)
- [Pending minimized beta-shelf corpus](./beta-shelf-corpus.template.json)
- [Pending qualified curation review](./catalog-curation-review.template.json)
- [Pending exact CAT-02 membership proof](./catalog-cat02-membership-proof.template.json)
- [Pending signed database readback](./catalog-curation-database-readback.template.json)

The legacy beta aggregate remains non-authoritative for CAT-03. When it is
claimed as a Phase 9 upstream packet, generate it strictly from the ignored,
mounted aggregate input, commit its exact JSON/Markdown pair alone, and run
`npm run phase4:beta-coverage-report:check` from the later clean governed
checkout. That check proves deterministic committed publication and source
provenance; it does not convert dashboard presence or a typed signoff into
consent, legal, catalog, clinical, or reviewer authority.

The only launch source flow is: acquire offline source bytes; create a
non-promotable candidate from a clean committed transformer; obtain an active
externally root-signed and replay-pinned reviewer registry; approve the exact US
release scope; obtain distinct legal and engineering signatures over the exact
source approvals; create clean active/approved/pending build-candidate commit A;
build A in EAS; record signed archive/App Store evidence in evidence-only
descendant B (active/approved/verified); re-run the same transforms and
source-specific QA; then use CAT-02 staging, review, transactional promotion,
serving-gate verification, and rollback; then use CAT-03 curation, sealed
holdout quality evaluation and preactivation report, non-serving authorization
staging, atomic campaign release, independent point-in-time readback/final
report, and retirement. The
pending/pending/pending baseline is the only other valid CAT-01 audit state;
every mixed transition fails.

OBF/CosIng are not runtime recipients. Source images and external contribution
are excluded. Missing-product and wrong-match reports remain first-party, and
migration `0056` hides every source/product that lacks positive legal,
production, review, quality, eligibility, mapping, and correction evidence.
Migration `0057` plus forward migration `0061` add the local source candidate
for sealed, replay-safe staging; per-record review; exact-key conflict detection; immutable lineage;
transactional insert-only promotion; and non-destructive batch rollback. It
also adds `benzoyl_peroxide` to the database staging allowlist while the offline
v2 envelope, not the RPC, remains responsible for dual-review signatures,
repairs the clean/post-`0060` health-write guard, exposes only bounded product-
specific PAO evidence, closes legacy broad ingredient/brand/category read paths,
and removes direct API-role global-catalog mutation. Real approved artifacts,
hosted CAT-08 operator identities, deployment of the separate internal-console source,
named staffing, hosted concurrency/rollback evidence, and a reviewed launch
catalog are still absent.
Foundational migration `0058`, forward migration `0062`, and the CAT-03 offline
contracts add a local source candidate for pre-outcome target binding,
privacy-minimized beta-shelf demand, curation/
holdout separation, signed four-scope CAT-02 membership, qualified review, a
hard floor of 2,000 eligible records plus category/priority minima, campaign-
scoped non-serving authorization, one exact-set atomic release, independently
signed database readback, immutable retirement, and a positive serving
dependency on the active global campaign. Exactly one artifact may match the
target CAT-02 lineage, only its reviewed primary barcode is served, outcome
reviewers sign before their exact signature-set root is bound into the later
operator authorization, and every client-readable field and child-row set is
sealed. Every sealed served-state mutation appends an irreversible per-product
event under the release lock. Outcome reviewers bind the current product mutation
root and campaign root set; exact restoration, correction-hold closure, source
reapproval, or batch restoration cannot resurrect an old authorization.
Direct catalog-table access is denied
to `service_role`; service reads use guarded lookup/search RPCs, while
authenticated direct reads remain limited to explicitly granted positive-RLS
relations. `0062` adds three covered authority indexes, pushes the already-
required staged digest into the exact authority join, and adds the indexed
`AFTER STATEMENT` guard: it rejects count overflow after every insert statement and validates the already-sealed complete
root set only when stored rows reach expected count; partial governed inserts
remain allowed. Current review and database-readback artifacts must attest exact latest
migration `20260722000062`. The isolated PostgreSQL 15/17 rehearsal constructs a
minimal pre-`0062` fixture and includes the exact `0062` bytes; it is bounded
forward-upgrade mechanics proof, not exact `0061`-schema, full-chain, hosted, or
production evidence. Beta demand prioritizes review; it never becomes a
product fact. The current self-selected beta design cannot support a market-representative claim.
Real consented beta evidence, witnessed targets/decisions, signed reviews and
readback, exact CAT-01/CAT-02 lineage, clean local/hosted full-chain verification
through `0065`, and an activated launch catalog are absent, so CAT-03 remains `in_progress`.
Passing these source controls does not guarantee Apple acceptance, legal
compliance, product efficacy, or revenue.

CAT-08 now has an `in_progress`, identity-bound, nonanonymous `aal2` source
boundary with ten-minute work sessions, five-minute queue claims, capability-
separated triage/decision/repair/release, immutable audit, and reporter-
independent product holds. The authenticated operator surface is limited to six
bounded RPCs; the separate owner-bound correction-export RPC is not an operator
action. API roles do not receive raw operator/correction/hold table access, and
service-role raw correction review is revoked. A triaged hold survives reporter erasure and
cannot be released by accepting, rejecting, closing, or deleting a correction.
Repair attestation requires a third person and exact current CAT-02 plus signed
staged CAT-03 successor authority over the active-hold mutation root. A fourth
person releases the hold; release advances the root and cannot activate serving.
CAT-03 owners must complete a fresh post-release campaign/activation/readback.
See the linked runbook. The publishable-key-only console source candidate is
separate from the consumer app, but its deployment, real MFA/grants, named operators,
concurrency/deletion drills, human-simulated E2E, and professional review
remain open, so CAT-08 is not complete.
