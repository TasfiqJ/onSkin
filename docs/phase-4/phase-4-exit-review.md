# Phase 4 Exit Review

Date: 2026-07-17

## Implementation Status

Implemented locally:

- Phase 4 additive catalog schema and RLS.
- Source/license control docs for CosIng, Open Beauty Facts, and ODbL.
- Machine-readable source policy, deliberately pending fixed trust registry,
  release scope, release-build evidence, intentionally invalid approval
  templates, and an audit that keeps OBF/CosIng runtime requests, images, and
  external contribution disabled.
- Explicit fixture allowlisting and non-promotable candidate transforms plus
  production transforms bound to exact artifact bytes/hash, deterministic
  transformed payload, source/date, current policy and transformer tree,
  externally root-signed reviewer registry with replay-resistant epoch/hash
  pins, release identity/scope, projected fields, public attribution surface,
  source-specific legal determinations, operations evidence, and dual legal/
  engineering Ed25519 signatures.
- Exact signed release-build evidence contract covering production EAS
  build/Git/resolved Expo config, inspected IPA/Info.plist identity/hashes, App
  Store Connect app, and observed US availability.
- Ingredient parser, product quality model, OBF mapping, and fixture tests.
- OBF and CosIng fixture/candidate/production import and source-specific QA
  scripts; approved QA revalidates embedded approvals and current release
  evidence rather than checking output shape alone.
- Legacy beta coverage summary, now explicitly privacy-redacted and
  non-authoritative, plus CAT-03 target/corpus/review templates and strict
  contract/report source controls for a pre-outcome policy, consent boundary,
  minimized aggregates, curation/holdout split, witnessed full-record decision,
  confidence bounds, exact multi-batch/four-scope lineage, independent database
  readback, and cryptographic review authority.
- Product search, barcode lookup, and correction-report Edge Function scaffolds
  plus migration `0056`'s shared fail-closed serving gate for positive source,
  review, quality, eligibility, mapping, and live-correction evidence.
- CAT-02's local content-addressed stage-envelope contract and migration
  `0057`: sealed idempotent staging, owner-only review/promotion/rollback,
  exact-key conflict handling, immutable projection lineage, direct API-role
  catalog-DML denial, positive ingredient/reference read gates, and
  non-destructive batch retirement.
- CAT-03's local curation-envelope/quality-report contracts and migration
  `0058`: sealed curation campaigns, exact CAT-01/CAT-02 and database-snapshot
  bindings, a hard 2,000-record/category/priority floor, owner-only replay-safe
  non-serving product authorization, one exact-set atomic campaign release,
  signed readback, immutable retirement history, RPC-only `service_role` access, and a
  positive active-campaign requirement in the serving dependency chain.
  Beta demand can prioritize independently sourced rows but can never become a
  product fact.
- Mobile shelf source/quality disclosure, search fallback, parser-backed OCR, and report issue flow.
- Explicit exclusion of external contribution from the launch architecture;
  reports remain in the first-party correction operation, and restoring a
  source recipient would require a new privacy/legal/architecture decision.

## Launch Status

Not launch-cleared.

The implementation intentionally keeps production catalog use blocked until:

- final brand/support email/domain/attribution page exist;
- OBF and ODbL obligations are reviewed;
- CosIng reuse posture is reviewed;
- the active reviewer registry, approved US release scope, dual-signed source
  approvals, and signed exact EAS/archive/App Store evidence exist for the same
  release;
- curated launch batch is built from real approved sources;
- a target policy is signed before outcome access, the self-selected beta input
  is described only as a defined beta-shelf coverage corpus, and no market-
  representative claim is made;
- separate optional curation-use consent, restricted retention/deletion, and
  privacy-minimized aggregate evidence exist with no raw shelf data in Git,
  general analytics, OBF, CosIng, or AI providers;
- the curation partition and untouched holdout are sealed, and every
  predeclared minimum-denominator/confidence-bound gate passes;
- the complete reviewed-record decision and CAT-02 membership set were
  independently witnessed in an append-only/timestamped authority before the
  holdout was opened;
- at least 2,000 independently sourced, reviewed, activation-eligible records,
  every required-category floor, and at least 100 demand-prioritized eligible
  records pass the signed inventory policy;
- exact row-review overlays and dedicated CAT-08 operator identities exist;
- qualified catalog/cosmetic-chemistry review and separate current U.S.
  sunscreen/OTC-adjacent review bind every applicable row;
- the two-session hosted CAT-02 staging/promotion/serialization/rollback drill
  passes with complete redacted receipts and zero projection drift;
- clean local and hosted CAT-03 migration-`0058` reset, pgTAP, two-connection
  staging/release/supersession race, direct-service-role denial, serving,
  retirement, and rollback evidence passes;
- the authoritative CAT-03 coverage/quality report exists for the sealed
  holdout and exact independently signed database readback; the legacy beta
  summary or offline-only approval cannot satisfy this gate;
- no later retirement, successor release, dependency withdrawal, or review
  expiry has made that readback historical; any such transition requires a new
  reviewed campaign and independent post-release readback;
- clinical/legal/cosmetic-chemist review clears product guidance;
- native barcode/OCR camera work is verified on devices.

## Seven-Figure App Check

Phase 4 is necessary because it turns the app from a generic routine coach into a shelf system of record. It is still not sufficient by itself. The catalog must be accurate enough that users trust routine and conflict guidance on products they actually own.

The current build improves the seven-figure path by adding:

- real provenance and source disclosure;
- correction loop;
- quality gating before product-specific recommendations;
- manual fallback that does not break the V1 loop;
- import QA tooling instead of untracked data entry.

The unresolved commercial risk is coverage. A polished catalog architecture does not prove users will pay unless beta users can add real products and receive useful, trustworthy guidance.

The planned beta is self-selected. Its evidence can establish performance only
for the exact declared corpus and holdout; it cannot establish population or
market representativeness. Passing product guardrails does not establish legal,
clinical, Apple, or commercial approval.

## Exit Criteria Still Open

- Source/legal approval attached.
- The audit passes the exact pending/pending/pending baseline, then the
  active/approved/pending build-candidate commit A that EAS builds, then the
  active/approved/verified evidence-only descendant B. Every other mixed state
  fails, and B proves the approved transformer/config payload did not drift.
- Release-mode validation accepts the active external trust registry, approved
  fixed scope, signed build evidence, and exact dual-signed approvals; the
  checked-in pending templates alone cannot authorize import.
- Exact OBF/CosIng candidate hashes, source bytes, approvals, production
  transforms, and zero-warning source-specific QA reports are retained.
- First curated batch reviewed and promoted through CAT-02; no fixture,
  candidate, direct table write, or unresolved conflict is present.
- Pre-outcome signed target policy, independently witnessed full-record
  decision, separate consent, restricted deletion/retention evidence, privacy-
  minimized aggregate corpus, and deterministic curation/holdout split are
  retained without raw beta data in Git.
- Beta demand is used only for priority; all product facts retain independent
  CAT-01/CAT-02 provenance.
- Import QA report has zero blockers.
- Qualified reviewers sign exact product/dependency rows; U.S. sunscreen/
  OTC-adjacent rows carry separate current market/label/classification/expiry/
  claim evidence.
- The exact released campaign contains at least 2,000 eligible records, every
  signed required-category floor, and at least 100 prioritized eligible rows.
- Product recommendations use only active-curation, eligible, reviewed,
  dependency-complete products.
- Hosted database evidence through migration `0057` proves the import
  lifecycle, rollback/reference preservation, and barcode, search,
  recommendation, product, ingredient, synonym, and child reads fail closed
  for every held source/record.
- Hosted database evidence through migration `0058` proves immutable campaign
  scoped staging, exact-set atomic release/supersession/retirement, signed
  readback, exact lineage, replay/race handling, direct-table denial for
  `service_role`, authenticated RLS allow/deny proof, and immediate fail-closed
  serving after any retirement or dependency withdrawal.
- The untouched holdout meets every signed confidence-bound and minimum-
  denominator target with zero open P0/P1 and zero below-usable recommendation
  exposure; missing/suppressed required strata fail closed.
- App copy and attribution approved under final brand.
