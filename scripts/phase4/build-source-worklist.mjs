#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { command, gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');
const outJson =
  process.env.PHASE4_SOURCE_WORKLIST_JSON ?? 'docs/phase-4/generated/source-worklist.json';
const outMd = process.env.PHASE4_SOURCE_WORKLIST_MD ?? 'docs/phase-4/generated/source-worklist.md';
const outputPaths = [outJson, outMd].map((path) => normalizeRepoPath(path));
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.sql']);

const workItems = [
  {
    id: 'source-identity',
    domain: 'sourceReview',
    area: 'Final catalog release identity, trust, build, and attribution surface',
    status: 'blocked',
    launchGate: 'B-CATALOG-SOURCE-REVIEW',
    owner: 'Founder + counsel + engineering',
    requiredEvidence: [
      'Final cleared app name, production version, support email, and attribution URL.',
      '`phase4:check-source-env:strict` passes with production values.',
      'Counsel-approved public source/attribution copy under the final brand domain.',
      'The fixed release scope is approved for the exact display name, bundle ID, version, iOS build number, final host, support email, US territory, and attribution surface.',
      'The reviewed positive-decimal iOS build number is manually advanced before commit A, embedded by production app config, and never delegated to EAS auto-increment.',
      'The current reviewer registry is signed by the external trust root and matches the separately pinned epoch and raw-file SHA-256.',
      'Signed build evidence binds the exact EAS production iOS build ID/Git commit/resolved Expo config, IPA and Info.plist hashes, App Store Connect app, and US availability evidence.',
      '`phase4:source-policy-audit` passes in exactly three coherent states: pending/pending/pending baseline; active/approved/pending build candidate; and active/approved/verified release. Every other trust/scope/build mix fails.',
      'Clean commit A is the EAS build candidate; evidence-only descendant B records verified build evidence bound to A without changing the approved transformer/config payload.',
    ],
    sources: [
      '.env.example',
      'scripts/phase4/check-source-env.mjs',
      'docs/phase-4/catalog-source-memo-open-beauty-facts.md',
      'docs/phase-4/catalog-source-memo-cosing.md',
      'docs/phase-4/README.md',
      'docs/phase-4/catalog-source-policy.json',
      'docs/phase-4/catalog-source-trust-registry.json',
      'docs/phase-4/catalog-release-scope.json',
      'docs/phase-4/catalog-release-build-evidence.json',
      'docs/phase-4/catalog-source-release-runbook.md',
      'scripts/phase4/catalog-source-policy-audit.mjs',
      'scripts/phase4/source-policy.mjs',
      'docs/phase-4/phase-4-exit-review.md',
      'docs/FOR_TAS_TO_DO.md',
    ],
  },
  {
    id: 'obf-odbl-posture',
    domain: 'sourceReview',
    area: 'Open Beauty Facts and ODbL launch posture',
    status: 'blocked',
    launchGate: 'B-ODBL-REVIEW',
    owner: 'Counsel + engineering',
    requiredEvidence: [
      'Counsel records whether OBF data can be used for the launch catalog and under what attribution/share-alike obligations.',
      'Product images remain disabled unless image rights are separately approved.',
      'Bulk import uses approved export artifacts, not API crawling or search-as-you-type scraping.',
      'A detached approval based on `obf-source-approval.template.json` records the exact artifact bytes/SHA-256, transformed-payload hash, source snapshot, current policy/trust/scope/transformer hashes, territories/fields, database-combination/share-alike/offer-of-data decisions, operations evidence, and public attribution/data-delivery evidence.',
      'The current filtering/normalization transformer uses only the conservative derivative-database plus entire-derivative-or-alterations machine-readable delivery path; a collective-component conclusion requires a new reviewed transformer/policy revision.',
      'Distinct active legal and engineering Ed25519 identities sign the same canonical approval payload; neither checked-in pending template nor a single reviewer can authorize production.',
    ],
    sources: [
      'docs/phase-4/catalog-source-memo-open-beauty-facts.md',
      'docs/phase-4/odbl-compliance-memo.md',
      'docs/phase-4/catalog-source-policy.json',
      'docs/phase-4/obf-source-approval.template.json',
      'docs/phase-4/catalog-source-trust-registry.json',
      'docs/phase-4/catalog-release-scope.json',
      'docs/phase-4/catalog-release-build-evidence.json',
      'docs/phase-4/catalog-source-release-runbook.md',
      'scripts/phase4/import-obf-snapshot.mjs',
      'scripts/phase4/source-policy.mjs',
      'scripts/phase4/source-policy.test.mjs',
      'scripts/phase4/catalog-qa-report.mjs',
      'supabase/migrations/20260614000026_phase4_catalog.sql',
      'supabase/functions/catalog-lookup/index.ts',
      'supabase/functions/catalog-search/index.ts',
      'supabase/functions/catalog-report/index.ts',
      'supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql',
    ],
  },
  {
    id: 'cosing-reuse-taxonomy',
    domain: 'sourceReview',
    area: 'CosIng reuse and ingredient-tag taxonomy',
    status: 'blocked',
    launchGate: 'B-CATALOG-SOURCE-REVIEW',
    owner: 'Counsel + cosmetic chemist',
    requiredEvidence: [
      'Counsel records CosIng reuse and attribution obligations.',
      'Cosmetic chemist signs the ingredient-tag taxonomy and confirms CosIng is not presented as product-level approval.',
      'Parser import artifact records exact artifact bytes/SHA-256, snapshot date, parser/transformer bundle, transformed-payload hash, and CosIng QA output hash.',
      'A detached approval based on `cosing-source-approval.template.json` records exact policy/trust/scope/transformer hashes, fields/territories, reuse/attribution/third-party-rights decisions, glossary decision, evidence, and owners.',
      'Distinct active legal and engineering Ed25519 identities sign the same canonical approval payload; neither checked-in pending template nor a single reviewer can authorize production.',
    ],
    sources: [
      'docs/phase-4/catalog-source-memo-cosing.md',
      'docs/phase-4/ingredient-tag-taxonomy.md',
      'docs/phase-4/catalog-source-policy.json',
      'docs/phase-4/cosing-source-approval.template.json',
      'docs/phase-4/catalog-source-trust-registry.json',
      'docs/phase-4/catalog-release-scope.json',
      'docs/phase-4/catalog-release-build-evidence.json',
      'docs/phase-4/catalog-source-release-runbook.md',
      'scripts/phase4/import-cosing-dictionary.mjs',
      'scripts/phase4/source-policy.mjs',
      'scripts/phase4/source-policy.test.mjs',
      'apps/mobile/src/features/catalog/ingredientParser.ts',
      'apps/mobile/src/features/catalog/ingredientParser.test.ts',
      'apps/mobile/src/features/intelligence/tags.ts',
      'apps/mobile/src/features/intelligence/tags.test.ts',
      'scripts/phase4/catalog-qa-report.mjs',
    ],
  },
  {
    id: 'curated-first-batch',
    domain: 'curation',
    area: 'First curated launch product batch',
    status: 'blocked',
    launchGate: 'B-CURATED-CATALOG',
    owner: 'Founder + catalog operator + clinical reviewers',
    requiredEvidence: [
      'Approval-bound hash-only OBF and CosIng candidates are regenerated under ignored `artifacts/phase4/` from clean active/approved/pending build-candidate commit A; candidates are never promotable.',
      'Approved exact source artifacts drive product facts; a separately consented, privacy-minimized beta-shelf coverage corpus may prioritize records but cannot authorize or alter a product field.',
      'A pre-outcome signed target policy splits a curation corpus from an untouched holdout and defines denominators, minimum samples, suppression, confidence bounds, and priority-category gates.',
      'Recommendable rows are `verified` or `usable`, independently reviewed, correction-free, provenance-complete, and bound to the exact active global CAT-03 campaign plus product authorization.',
      'Sunscreen/US-OTC-adjacent rows bind a dated market-classification source, label/expiry evidence, and a distinct qualified regulatory review.',
      'CAT-02 promotion and CAT-03 preactivation authorization require exact source approvals, build evidence, QA, lineage, reviewer-role separation, and holdout/inventory gates; product authorizations remain non-serving until one exact-set atomic campaign release, after which an independent signed database readback can establish point-in-time final-clear.',
    ],
    sources: [
      'docs/phase-4/curated-product-curation-sheet.md',
      'docs/phase-4/first-curated-product-batch.md',
      'docs/phase-4/catalog-curation-release-runbook.md',
      'docs/phase-4/catalog-coverage-quality-targets.template.json',
      'docs/phase-4/beta-shelf-corpus.template.json',
      'docs/phase-4/catalog-curation-review.template.json',
      'docs/phase-4/catalog-cat02-membership-proof.template.json',
      'docs/phase-4/catalog-curation-database-readback.template.json',
      'docs/phase-3/consent-matrix.md',
      'docs/phase-3/data-inventory.md',
      'docs/store-privacy-inventory.md',
      'docs/phase-4/catalog-source-release-runbook.md',
      'scripts/phase4/catalog-curation-contract.mjs',
      'scripts/phase4/catalog-curation-contract.test.mjs',
      'scripts/phase4/build-catalog-curation-envelope.mjs',
      'scripts/phase4/catalog-coverage-quality-report.mjs',
      'scripts/phase4/catalog-coverage-quality-report.test.mjs',
      'scripts/phase4/import-obf-snapshot.mjs',
      'scripts/phase4/import-cosing-dictionary.mjs',
      'supabase/migrations/20260717000058_catalog_launch_curation.sql',
      'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
      'supabase/tests/database/catalog_launch_curation.test.sql',
    ],
  },
  {
    id: 'import-qa',
    domain: 'curation',
    area: 'Import QA and generated catalog evidence',
    status: 'local-scaffold',
    launchGate: 'B-CATALOG-SEED',
    owner: 'Engineering + catalog operator',
    requiredEvidence: [
      'Production import artifact hash, source snapshot date, and parser version are archived.',
      '`catalog-qa-report.mjs` has zero blockers/warnings when run separately against the approved OBF and CosIng artifacts; the `phase4:qa-report*` package scripts remain fixture conveniences.',
      'QA revalidates the embedded exact approval bytes, current trust/scope/transformer/release identity, signed EAS/archive/App Store evidence, source-specific schema, provenance, and deterministic transformed payload.',
      'Generated packet status audit reports no dirty packet text and no stale source hashes.',
    ],
    sources: [
      'scripts/phase4/catalog-qa-report.mjs',
      'scripts/phase4/catalog-qa-report-smoke.mjs',
      'scripts/phase4/import-obf-snapshot.mjs',
      'scripts/phase4/import-cosing-dictionary.mjs',
      'scripts/phase4/catalog-source-policy-audit.mjs',
      'scripts/phase4/source-policy.mjs',
      'scripts/phase4/source-policy.test.mjs',
      'docs/phase-4/catalog-source-policy.json',
      'docs/phase-4/catalog-source-trust-registry.json',
      'docs/phase-4/catalog-release-scope.json',
      'docs/phase-4/catalog-release-build-evidence.json',
      'docs/phase-4/catalog-source-release-runbook.md',
      'scripts/docs/generated-packet-status-audit.mjs',
    ],
  },
  {
    id: 'beta-coverage',
    domain: 'betaEvidence',
    area: 'Closed-beta catalog coverage and correction loop',
    status: 'blocked',
    launchGate: 'B-CATALOG-COVERAGE',
    owner: 'Founder + engineering + support',
    requiredEvidence: [
      '50-100 consented target users add at least three products each; the cohort is described as the defined beta-shelf coverage corpus, never as statistically market-representative.',
      'Barcode, search, OCR, and manual fallback are exercised with participant-capped aggregates, small-cell plus complementary suppression, and an overlapping-release/differencing guard.',
      'The fixed holdout meets predeclared minimum samples and one-sided confidence-bound gates for wrong matches, parser unknowns, recognition, shelf completion, manual fallback, every priority category, and zero open P0/P1/correction/recommendation-safety failures.',
      '`phase4:beta-coverage-report` remains informational; the signed CAT-03 contract may authorize only non-serving staging before one atomic campaign release, and only an independent signed post-release database readback can establish point-in-time final-clear.',
    ],
    sources: [
      'docs/phase-4/beta-coverage-report.md',
      'docs/phase-4/beta-shelf-corpus.template.json',
      'docs/phase-4/catalog-coverage-quality-targets.template.json',
      'docs/phase-4/catalog-curation-release-runbook.md',
      'docs/phase-4/catalog-cat02-membership-proof.template.json',
      'docs/phase-4/catalog-curation-database-readback.template.json',
      'docs/phase-3/consent-matrix.md',
      'docs/phase-3/data-inventory.md',
      'docs/store-privacy-inventory.md',
      'scripts/phase4/beta-coverage-report.mjs',
      'scripts/phase4/beta-coverage-report-smoke.mjs',
      'scripts/phase4/catalog-curation-contract.mjs',
      'scripts/phase4/catalog-curation-contract.test.mjs',
      'scripts/phase4/catalog-coverage-quality-report.mjs',
      'scripts/phase4/catalog-coverage-quality-report.test.mjs',
      'docs/phase-10/catalog-beta-report.md',
      'docs/phase-10/support-beta-report.md',
      'docs/phase-10/retention-activation-report.md',
      'docs/FOR_TAS_TO_DO.md',
    ],
  },
  {
    id: 'catalog-promotion-lifecycle',
    domain: 'curation',
    area: 'Reviewed catalog staging, promotion, lineage, and rollback',
    status: 'local-scaffold',
    launchGate: 'B-CATALOG-SEED',
    owner: 'Engineering + catalog operator + database reviewer',
    requiredEvidence: [
      'A content-addressed CAT-02 stage envelope binds an approved transform, zero-warning source QA, exact per-record reviews, source/build evidence, natural keys, record hashes, and the US territory.',
      'Fixture/candidate records, incomplete reviews, changed idempotent replays, duplicate natural keys, and existing-catalog conflicts fail closed before promotion.',
      'Migration `0057` plus forward migrations `0061` and `0062` stage the signed v2 category vocabulary through sealed service RPCs and retain bounded statement-level curation integrity. Migration `0063` gives CAT-08 operators immutable recommendation authority only, and `0065` repairs both operator-transition conflict targets plus the global function default ACL while preserving the exact gateway grants. Migration `0066` additionally seals the unreviewed legacy clinical-content fixtures against every API-role table privilege and migration-owner mutation. Migration `0067` gives `plpgsql_check` a checker-only ephemeral table shape for the known runtime-temporary-table release wrapper. Migration `0069` preserves catalog provenance while moving owner Shelf projection behind an exact replay RPC and stable identity/tombstone boundary. Migration `0070` stages the exact current Ask grant tuple only as an unreleased `draft_blocked` successor without inventing review or approval. Migration `0071` then forces literal zero product-specific recommendation admission, seals the legacy recommendation cache, and makes preference mutation owner-derived through one health-fenced RPC; approval, promotion, rollback, CAT-03 activation, recommendation-mode opening, and any future reviewed clinical publication intentionally require separate authority.',
      'Every promoted projection traces through its immutable staged record and batch to source artifact, transform, approval, QA, and reviewer hashes.',
      'A reviewed hosted two-session drill proves atomic promotion, full retry on serialization failure, source-withdrawal containment, exact verification, and non-destructive rollback with shelf/correction references preserved.',
    ],
    sources: [
      'scripts/phase4/catalog-promotion-contract.mjs',
      'scripts/phase4/catalog-promotion-contract.test.mjs',
      'scripts/phase4/build-catalog-stage-envelope.mjs',
      'scripts/phase4/complete-catalog-database-receipts.mjs',
      'supabase/migrations/20260717000057_catalog_import_lifecycle.sql',
      'supabase/migrations/20260718000059_catalog_scan_minimization.sql',
      'supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
      'supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql',
      'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
      'supabase/migrations/20260722000063_catalog_operator_authority.sql',
      'supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql',
      'supabase/migrations/20260726000066_legacy_clinical_content_immutability.sql',
      'supabase/migrations/20260726000067_catalog_release_temp_table_lint_contract.sql',
      'supabase/migrations/20260726000068_routine_adherence_authority.sql',
      'supabase/migrations/20260726000069_routine_completion_sync_bridge.sql',
      'supabase/migrations/20260726000070_health_consent_draft_successor_staging.sql',
      'supabase/migrations/20260726000071_recommendation_zero_admission.sql',
      'supabase/tests/database/catalog_operator_authority.test.sql',
      'supabase/tests/database/clinical_content_legacy_seal.test.sql',
      'supabase/tests/database/catalog_release_temp_table_lint_contract.test.sql',
      'supabase/tests/database/routine_adherence_authority.test.sql',
      'supabase/tests/database/routine_completion_sync_bridge.test.sql',
      'supabase/tests/database/health_consent_draft_successor_staging.test.sql',
      'supabase/tests/database/recommendation_zero_admission.test.sql',
      'supabase/tests/upgrade/routine_completion_sync_bridge_0069_upgrade.test.sql',
      'supabase/tests/upgrade/health_consent_draft_successor_0070_upgrade.test.sql',
      'supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql',
      'scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql',
      'scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql',
      'scripts/phase9/catalog-operator-0065-upgrade-postgres-rehearsal.sql',
      'scripts/phase9/clinical-content-0066-upgrade-postgres-rehearsal.sql',
      'scripts/phase9/catalog-release-0067-lint-contract-postgres-rehearsal.sql',
      'scripts/phase9/recommendation-zero-admission-smoke.mjs',
      'supabase/tests/database/catalog_import_lifecycle.test.sql',
      'supabase/tests/database/catalog_serving_gate.test.sql',
      'supabase/tests/database/cat07_truthful_freshness.test.sql',
      'docs/phase-4/catalog-import-promotion-runbook.md',
      'docs/phase-4/first-curated-product-batch.md',
    ],
  },
  {
    id: 'catalog-launch-curation-lifecycle',
    domain: 'curation',
    area: 'Signed launch curation, positive serving authority, and retirement',
    status: 'local-scaffold',
    launchGate: 'B-CURATED-CATALOG',
    owner: 'Catalog operator + independent reviewers + activation operator',
    requiredEvidence: [
      'A strict content-addressed CAT-03 envelope binds a pre-outcome target policy, minimized beta aggregate, untouched holdout, exact CAT-01 approvals, exact CAT-02 promoted projections, per-field provenance, and independent role-qualified reviews.',
      'Beta demand is prioritization evidence only and cannot create or change a brand, GTIN, category, INCI token, ingredient mapping, concentration, expiry, regulatory classification, quality fact, or recommendation authorization.',
      'Migration `0058` keeps target, campaign, record, per-product authorization, global release, and retirement authority immutable and migration-owner-only; API roles cannot mutate or forge curation state.',
      'Every catalog serving path positively requires the exact active global CAT-03 campaign plus campaign-scoped product authorization, exact CAT-02 lineage, complete reviewed dependencies, zero correction hold, and any required sunscreen/US-OTC review.',
      'A reviewed hosted two-session drill proves replay safety, non-serving successor staging, one exact-set atomic campaign release/supersession, concurrent correction/source-withdrawal containment, immediate retirement, signed post-release readback, and zero partial eligibility.',
    ],
    sources: [
      '.gitignore',
      'package.json',
      '.github/workflows/quality.yml',
      'docs/phase-4/catalog-curation-release-runbook.md',
      'docs/phase-4/catalog-coverage-quality-targets.template.json',
      'docs/phase-4/beta-shelf-corpus.template.json',
      'docs/phase-4/catalog-curation-review.template.json',
      'docs/phase-4/catalog-cat02-membership-proof.template.json',
      'docs/phase-4/catalog-curation-database-readback.template.json',
      'docs/phase-3/consent-matrix.md',
      'docs/phase-3/data-inventory.md',
      'docs/store-privacy-inventory.md',
      'scripts/phase4/catalog-curation-contract.mjs',
      'scripts/phase4/catalog-curation-contract.test.mjs',
      'scripts/phase4/build-catalog-curation-envelope.mjs',
      'scripts/phase4/catalog-coverage-quality-report.mjs',
      'scripts/phase4/catalog-coverage-quality-report.test.mjs',
      'supabase/migrations/20260717000058_catalog_launch_curation.sql',
      'supabase/tests/database/catalog_launch_curation.test.sql',
      'supabase/migrations/20260717000057_catalog_import_lifecycle.sql',
      'supabase/migrations/20260718000059_catalog_scan_minimization.sql',
      'supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
      'supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql',
      'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
      'supabase/tests/database/catalog_import_lifecycle.test.sql',
      'supabase/tests/database/catalog_serving_gate.test.sql',
      'supabase/tests/database/cat07_truthful_freshness.test.sql',
    ],
  },
  {
    id: 'mobile-catalog-disclosure',
    domain: 'productSurface',
    area: 'Mobile catalog source, quality, and report-issue disclosure',
    status: 'local-scaffold',
    launchGate: 'B-CATALOG-SEED',
    owner: 'Engineering + counsel',
    requiredEvidence: [
      'Product detail and shelf flows show source/quality without implying completeness or endorsement.',
      'Wrong-match reporting stays route-owned and privacy-safe.',
      'Product-specific recommendations remain blocked for below-usable, unreviewed, or correction-open rows.',
    ],
    sources: [
      'apps/mobile/src/features/catalog/*',
      'apps/mobile/src/features/shelf/*',
      'apps/mobile/src/app/shelf/[id].tsx',
      'apps/mobile/src/app/shelf/search.tsx',
      'apps/mobile/src/app/shelf/manual.tsx',
      'apps/mobile/src/features/recommendations/*',
      'supabase/functions/catalog-report/index.ts',
      'supabase/functions/catalog-report/privacy.ts',
      'supabase/functions/catalog-report/privacy.test.ts',
    ],
  },
  {
    id: 'recommendation-zero-admission',
    domain: 'productSurface',
    area: 'Fail-closed product-specific recommendation admission',
    status: 'local-scaffold',
    launchGate: 'B-CURATED-CATALOG',
    owner: 'Engineering + clinical reviewers + regulatory counsel + database reviewer',
    requiredEvidence: [
      'CORE-06A remains a zero-product-admission checkpoint: only type-first and existing-Shelf context provenance can exist, and neither provenance can render or fetch commerce.',
      'Goal-active output requires the exact current feature flag, consent, quiz/profile/goal provenance, and positive review clearance; the current clearance is closed and empty.',
      'Migration `0071` forces every catalog row recommendation-ineligible, returns a zero-row service-only recommendation projection, seals the legacy recommendation cache, and exposes only an owner-derived health-fenced preference RPC.',
      'The aggregate source contract, static database gate, exact pgTAP contract, and forward-upgrade contract all pass before any product-specific mode-opening change can be reviewed.',
      'This checkpoint does not establish reviewed products, professional clearance, hosted or physical-device behavior, App Review acceptance, legal compliance, product safety, product-market fit, or revenue.',
    ],
    sources: [
      'docs/09-personalized-recommendations.md',
      'docs/hugeToDo/CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26.md',
      'scripts/core06/recommendation-admission-source-contract.test.mjs',
      'apps/mobile/src/features/recommendations/admission.ts',
      'apps/mobile/src/features/recommendations/admission.test.ts',
      'apps/mobile/src/features/recommendations/goalAdmission.ts',
      'apps/mobile/src/features/recommendations/goalAdmission.test.ts',
      'apps/mobile/src/features/recommendations/goalProvenance.ts',
      'apps/mobile/src/features/recommendations/catalog.ts',
      'apps/mobile/src/features/recommendations/engine.ts',
      'apps/mobile/src/features/recommendations/engine.test.ts',
      'apps/mobile/src/features/recommendations/useRecommendations.ts',
      'apps/mobile/src/features/commerce/WhereToBuy.tsx',
      'apps/mobile/src/app/recommendations/[id].tsx',
      'supabase/migrations/20260726000071_recommendation_zero_admission.sql',
      'supabase/tests/database/recommendation_zero_admission.test.sql',
      'supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql',
      'scripts/phase9/recommendation-zero-admission-smoke.mjs',
    ],
  },
  {
    id: 'catalog-freshness-provenance',
    domain: 'productSurface',
    area: 'Catalog-backed Shelf freshness and provenance contract',
    status: 'local-scaffold',
    launchGate: 'B-CATALOG-SEED',
    owner: 'Engineering + catalog operator + device QA',
    requiredEvidence: [
      'Catalog lookup/search expose the source UUID separately and admit only reviewed, region-compatible PAO and printed-expiry evidence; external candidates do not fabricate provenance.',
      'Shelf intake requires a coherent opened state and exact non-future local date, records `label` PAO provenance only after explicit open-jar confirmation, and surfaces the source of the winning expiry date.',
      'Re-add archives the prior unit and creates a fresh unit without inheriting its printed expiry; automatic replenishment uses only supported signals and alerts remain explicit opt-in.',
    ],
    sources: [
      'docs/04-smart-shelf.md',
      'docs/USER_FLOW_TREE.md',
      'apps/mobile/src/app/onboarding/products.tsx',
      'apps/mobile/src/app/shelf/[id].tsx',
      'apps/mobile/src/app/shelf/opened.tsx',
      'apps/mobile/src/app/shelf/replenish.tsx',
      'apps/mobile/src/app/shelf/scan.tsx',
      'apps/mobile/src/app/shelf/search.tsx',
      'apps/mobile/src/features/catalog/client.ts',
      'apps/mobile/src/features/catalog/client.test.ts',
      'apps/mobile/src/features/intelligence/pao.ts',
      'apps/mobile/src/features/intelligence/pao.test.ts',
      'apps/mobile/src/features/notifications/store.ts',
      'apps/mobile/src/features/notifications/store.test.ts',
      'apps/mobile/src/features/notifications/replenishmentOptInMigration.test.ts',
      'apps/mobile/src/features/recommendations/replenishment.ts',
      'apps/mobile/src/features/recommendations/replenishment.test.ts',
      'apps/mobile/src/features/shelf/freshness.ts',
      'apps/mobile/src/features/shelf/freshness.test.ts',
      'apps/mobile/src/features/shelf/freshnessMigration.test.ts',
      'apps/mobile/src/features/shelf/limits.ts',
      'apps/mobile/src/features/shelf/paoProvenance.ts',
      'apps/mobile/src/features/shelf/paoProvenance.test.ts',
      'apps/mobile/src/features/shelf/store.ts',
      'apps/mobile/src/features/shelf/store.test.ts',
      'apps/mobile/src/lib/offline/shelfMirrorQueue.ts',
      'apps/mobile/src/lib/offline/shelfMirrorQueue.test.ts',
      'apps/mobile/src/lib/offline/OfflineSync.tsx',
      'apps/mobile/src/lib/offline/OfflineSync.test.ts',
      'supabase/functions/catalog-lookup/index.ts',
      'supabase/functions/catalog-lookup/catalogContract.ts',
      'supabase/functions/catalog-lookup/catalogContract.test.ts',
      'supabase/functions/catalog-search/index.ts',
      'supabase/functions/catalog-search/catalogContract.ts',
      'supabase/functions/catalog-search/catalogContract.test.ts',
      'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
      'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
      'supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql',
      'supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
      'supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql',
      'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
      'supabase/migrations/20260726000069_routine_completion_sync_bridge.sql',
      'supabase/tests/database/catalog_serving_gate.test.sql',
      'supabase/tests/database/cat07_truthful_freshness.test.sql',
      'supabase/tests/database/routine_completion_sync_bridge.test.sql',
      'supabase/tests/upgrade/routine_completion_sync_bridge_0069_upgrade.test.sql',
    ],
  },
  {
    id: 'catalog-serving-gate',
    domain: 'productSurface',
    area: 'Fail-closed production catalog serving boundary',
    status: 'local-scaffold',
    launchGate: 'B-CATALOG-SEED',
    owner: 'Engineering + catalog operator + database reviewer',
    requiredEvidence: [
      'The complete 71-migration chain through `0072`, including catalog migrations `0056` through `0063`, `0064` exact output-only skin-profile quiz provenance, the `0065` CAT-08 transition/default-ACL repair, the additional `0066` legacy clinical-content immutability seal, the narrow `0067` checker-only runtime-temporary-table shape, the `0068` authoritative routine-adherence boundary, the `0069` owner-derived Shelf/completion replay bridge, the `0070` unreleased draft-only health-consent-copy successor staging boundary, the `0071` recommendation zero-admission/cache-seal/preference-RPC boundary, and the `0072` COM-01A literal-zero commerce admission boundary, passes with the catalog, profile-provenance, CAT-07, CAT-08, clinical-content-seal, lint-contract, adherence, sync-bridge, consent-draft-staging, recommendation-zero-admission, and commerce-zero-admission pgTAP contracts on the exact hosted staging revision before promotion, curation authorization, clinical publication, recommendation-mode opening, commerce admission, or campaign release.',
      'Barcode and search use service-role-only RPCs over the same positive source/product/correction/CAT-03 eligibility relation; `service_role` has no direct catalog-table read, while explicitly safe authenticated reads retain positive RLS.',
      'Only rows in the exact active global CAT-03 campaign with active campaign-scoped product authorization, reviewed `verified` or `usable` quality, recommendation eligibility, production/legal-approved sources, and zero independent product holds in `active` or `repair_attested` state can be served; untrusted open intake remains owner-scoped, and accepting, rejecting, closing, or deleting a report cannot release its hold.',
      'Barcode mappings are independently reviewed, direct authenticated reads cannot bypass source withdrawal, and every held/unknown reason returns the same no-match/manual fallback.',
    ],
    sources: [
      'supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql',
      'supabase/migrations/20260717000057_catalog_import_lifecycle.sql',
      'supabase/migrations/20260717000058_catalog_launch_curation.sql',
      'supabase/migrations/20260718000059_catalog_scan_minimization.sql',
      'supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
      'supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql',
      'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
      'supabase/migrations/20260722000063_catalog_operator_authority.sql',
      'supabase/migrations/20260726000064_skin_profile_quiz_provenance.sql',
      'supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql',
      'supabase/migrations/20260726000066_legacy_clinical_content_immutability.sql',
      'supabase/migrations/20260726000067_catalog_release_temp_table_lint_contract.sql',
      'supabase/migrations/20260726000068_routine_adherence_authority.sql',
      'supabase/migrations/20260726000069_routine_completion_sync_bridge.sql',
      'supabase/migrations/20260726000070_health_consent_draft_successor_staging.sql',
      'supabase/migrations/20260726000071_recommendation_zero_admission.sql',
      'supabase/migrations/20260729000072_commerce_zero_admission.sql',
      'supabase/tests/database/catalog_serving_gate.test.sql',
      'supabase/tests/database/catalog_import_lifecycle.test.sql',
      'supabase/tests/database/catalog_launch_curation.test.sql',
      'supabase/tests/database/cat07_truthful_freshness.test.sql',
      'supabase/tests/database/catalog_operator_authority.test.sql',
      'supabase/tests/database/skin_profile_quiz_provenance.test.sql',
      'supabase/tests/database/clinical_content_legacy_seal.test.sql',
      'supabase/tests/database/catalog_release_temp_table_lint_contract.test.sql',
      'supabase/tests/database/routine_adherence_authority.test.sql',
      'supabase/tests/database/routine_completion_sync_bridge.test.sql',
      'supabase/tests/database/health_consent_draft_successor_staging.test.sql',
      'supabase/tests/database/recommendation_zero_admission.test.sql',
      'supabase/tests/database/commerce_zero_admission.test.sql',
      'supabase/tests/upgrade/routine_completion_sync_bridge_0069_upgrade.test.sql',
      'supabase/tests/upgrade/health_consent_draft_successor_0070_upgrade.test.sql',
      'supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql',
      'supabase/tests/upgrade/commerce_zero_admission_0072_upgrade.test.sql',
      'supabase/tests/database/schema_contract.test.sql',
      'scripts/phase9/catalog-operator-0065-upgrade-postgres-rehearsal.sql',
      'scripts/phase9/clinical-content-0066-upgrade-postgres-rehearsal.sql',
      'scripts/phase9/catalog-release-0067-lint-contract-postgres-rehearsal.sql',
      'scripts/phase9/recommendation-zero-admission-smoke.mjs',
      'supabase/functions/catalog-lookup/index.ts',
      'supabase/functions/catalog-lookup/catalogContract.ts',
      'supabase/functions/catalog-lookup/catalogContract.test.ts',
      'supabase/functions/catalog-search/index.ts',
      'supabase/functions/catalog-search/catalogContract.ts',
      'supabase/functions/catalog-search/catalogContract.test.ts',
      'docs/phase-4/catalog-source-release-runbook.md',
      'docs/phase-4/catalog-curation-release-runbook.md',
      'docs/phase-2-production-infrastructure-runbook.md',
    ],
  },
  {
    id: 'first-party-correction-report',
    domain: 'operations',
    area: 'First-party missing-product and wrong-match operation',
    status: 'blocked',
    launchGate: 'B-SHELF-CONTRIB',
    owner: 'Support + catalog operator + privacy/security + engineering',
    requiredEvidence: [
      "Owner-scoped missing-product and wrong-match reports enter only the app's first-party correction workflow with active health-data authority and bounded, minimized fields.",
      'Deletion and consent-withdrawal paths cover report data. Untrusted open intake remains owner-scoped; operator triage creates an independent reporter-free product hold, and only unreleased holds in `active` or `repair_attested` state suppress global catalog serving and recommendation eligibility. Accepting, rejecting, closing, or deleting the report cannot release that hold.',
      'Named support/catalog owners operate the seven-day triage SLA and retain correction-runbook evidence.',
      'No report, shelf/profile field, or user lookup is sent to OBF, CosIng, or another source; the legacy contribution queue and flag remain inert.',
    ],
    sources: [
      'docs/phase-4/odbl-compliance-memo.md',
      'docs/04-smart-shelf.md',
      'supabase/migrations/20260614000026_phase4_catalog.sql',
      'supabase/functions/catalog-report/index.ts',
      'supabase/functions/catalog-report/privacy.ts',
      'supabase/functions/catalog-report/privacy.test.ts',
      'supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql',
      'supabase/migrations/20260722000063_catalog_operator_authority.sql',
      'supabase/migrations/20260726000065_catalog_operator_transition_conflict_target.sql',
      'supabase/tests/database/catalog_operator_authority.test.sql',
      'apps/mobile/src/features/catalog/client.ts',
      'apps/mobile/src/features/catalog/client.test.ts',
      'docs/FOR_TAS_TO_DO.md',
    ],
  },
  {
    id: 'observability-support',
    domain: 'operations',
    area: 'Catalog dashboards, alerts, and support feedback loop',
    status: 'blocked',
    launchGate: 'B-CATALOG-COVERAGE',
    owner: 'Founder + support + engineering',
    requiredEvidence: [
      'Production catalog, analytics, and support dashboards exist under the final brand/account setup.',
      'Catalog miss, wrong-match, correction status, parser unknown-token, and support-ticket metrics are reviewed weekly during beta.',
      'Open P0/P1 catalog trust issues are zero before public launch.',
    ],
    sources: [
      'docs/phase-4/observability-dashboard.md',
      'docs/phase-4/beta-coverage-report.md',
      'docs/phase-10/support-operations.md',
      'docs/phase-10/support-beta-report.md',
      'scripts/phase4/beta-coverage-report.mjs',
      'supabase/functions/catalog-report/privacy.ts',
      'supabase/functions/catalog-report/privacy.test.ts',
      'docs/FOR_TAS_TO_DO.md',
    ],
  },
];

function abs(path) {
  return resolve(root, path);
}

function normalizeRepoPath(path) {
  return String(path).replaceAll('\\', '/').replace(/^\.\//, '');
}

function exists(path) {
  return existsSync(abs(path));
}

function read(path) {
  return readFileSync(abs(path), 'utf8');
}

function hashFile(path) {
  const bytes = readFileSync(abs(path));
  return {
    path: normalizeRepoPath(path),
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function fileRecord(path) {
  return exists(path) ? hashFile(path) : { path: normalizeRepoPath(path), exists: false };
}

function walk(dir, files = []) {
  if (!exists(dir)) return files;
  for (const entry of readdirSync(abs(dir), { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(child, files);
    if (entry.isFile() && sourceExtensions.has(extname(entry.name))) {
      files.push(normalizeRepoPath(child));
    }
  }
  return files;
}

function expandSourcePath(path) {
  const normalized = normalizeRepoPath(path);
  if (normalized.endsWith('/*'))
    return walk(normalized.slice(0, -2)).sort((a, b) => a.localeCompare(b));
  return [normalized];
}

function markdownTable(headers, rows) {
  const allRows = [headers, ...rows];
  const widths = headers.map((_, index) =>
    Math.max(...allRows.map((row) => String(row[index] ?? '').length), 3),
  );
  const render = (row) =>
    `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  return [
    render(headers),
    render(widths.map((width) => '-'.repeat(width))),
    ...rows.map(render),
  ].join('\n');
}

function sourceLine(source) {
  if (!source.exists) return `- \`${source.path}\` - missing`;
  return `- \`${source.path}\` - ${source.bytes} bytes - sha256 \`${source.sha256}\``;
}

function itemDetailMarkdown(item) {
  return [
    `### ${item.id} - ${item.area}`,
    '',
    `- Domain: ${item.domain}`,
    `- Status: ${item.status}`,
    `- Launch gate: ${item.launchGate}`,
    `- Owner: ${item.owner}`,
    '',
    'Required evidence:',
    '',
    ...item.requiredEvidence.map((entry) => `- ${entry}`),
    '',
    'Sources:',
    '',
    ...item.sourcePaths.map(sourceLine),
    '',
  ].join('\n');
}

function gitStatusExcludingGeneratedWorklist() {
  return gitStatusExcludingGeneratedEvidence(outputPaths);
}

function normalizeGeneratedMarkdown(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^Generated: .+$/m, 'Generated: <ignored>')
    .replace(/^Git SHA: .+$/m, 'Git SHA: <ignored>')
    .trimEnd();
}

function normalizeGeneratedJson(text) {
  const parsed = JSON.parse(text);
  delete parsed.generatedAt;
  delete parsed.gitSha;
  delete parsed.strict;
  return JSON.stringify(parsed, null, 2);
}

function checkGeneratedFile(path, expectedContent, normalize) {
  if (!exists(path)) {
    console.error(`FAIL Missing ${path}. Run npm run phase4:source-worklist.`);
    return false;
  }
  if (normalize(read(path)) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run phase4:source-worklist.`);
    return false;
  }
  return true;
}

const blockers = [];
const warnings = [];
let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedWorklist();
} catch {
  warnings.push('Git SHA/status could not be captured.');
}
if (gitStatus.length > 0) {
  warnings.push(
    'Phase 4 source worklist generated with a dirty Git worktree; do not use it as final catalog-source evidence.',
  );
}

const items = workItems.map((item) => {
  const sourcePaths = item.sources.flatMap(expandSourcePath).map(fileRecord);
  for (const source of sourcePaths.filter((source) => !source.exists)) {
    blockers.push(`${item.id} references missing source ${source.path}.`);
  }
  if (item.requiredEvidence.length === 0) {
    blockers.push(`${item.id} has no required evidence entries.`);
  }
  return { ...item, sourcePaths };
});

const domainCounts = items.reduce((acc, item) => {
  acc[item.domain] = (acc[item.domain] ?? 0) + 1;
  return acc;
}, {});
const statusCounts = items.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] ?? 0) + 1;
  return acc;
}, {});
const sourcePathCount = items.reduce((total, item) => total + item.sourcePaths.length, 0);
const missingSourcePathCount = items.reduce(
  (total, item) => total + item.sourcePaths.filter((source) => !source.exists).length,
  0,
);

const worklist = {
  generatedAt: new Date().toISOString(),
  purpose:
    'Machine-readable Phase 4 catalog source, curation, beta coverage, and operations worklist.',
  strict,
  gitSha,
  gitStatus,
  summary: {
    itemCount: items.length,
    domainCounts,
    statusCounts,
    sourcePathCount,
    missingSourcePathCount,
    blockerCount: blockers.length,
    warningCount: warnings.length,
  },
  items,
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(worklist, null, 2)}\n`;
const mdContent = [
  '# Phase 4 Catalog Source Worklist',
  '',
  `Generated: ${worklist.generatedAt}`,
  `Status: ${blockers.length === 0 ? 'pass' : 'blocked'}`,
  `Git SHA: ${worklist.gitSha}`,
  `Git status: ${worklist.gitStatus ? 'DIRTY' : 'clean'}`,
  '',
  'This generated worklist is an operator handoff for the catalog/source launch',
  'gate. It does not approve any catalog source, product batch, beta metric, or',
  'recommendation use. It records the evidence Tas/counsel/reviewers/operators',
  'must attach before Phase 4 can stop blocking launch.',
  '',
  '## Summary',
  '',
  `- Work items: ${worklist.summary.itemCount}`,
  `- Source files hashed: ${worklist.summary.sourcePathCount}`,
  `- Missing source files: ${worklist.summary.missingSourcePathCount}`,
  `- Blockers: ${worklist.summary.blockerCount}`,
  `- Warnings: ${worklist.summary.warningCount}`,
  '',
  '## Items',
  '',
  markdownTable(
    ['ID', 'Domain', 'Area', 'Status', 'Launch gate', 'Sources', 'Missing sources'],
    items.map((item) => [
      item.id,
      item.domain,
      item.area,
      item.status,
      item.launchGate,
      item.sourcePaths.filter((source) => source.exists).length,
      item.sourcePaths.filter((source) => !source.exists).length,
    ]),
  ),
  '',
  '## Item Details',
  '',
  ...items.map(itemDetailMarkdown),
  '## Blockers',
  '',
  ...(blockers.length > 0 ? blockers.map((blocker) => `- ${blocker}`) : ['- None.']),
  '',
  '## Warnings',
  '',
  ...(warnings.length > 0 ? warnings.map((warning) => `- ${warning}`) : ['- None.']),
  '',
].join('\n');

if (check) {
  const jsonCurrent = checkGeneratedFile(outJson, jsonContent, normalizeGeneratedJson);
  const mdCurrent = checkGeneratedFile(outMd, mdContent, normalizeGeneratedMarkdown);
  if (blockers.length > 0) {
    for (const blocker of blockers) console.error(`FAIL ${blocker}`);
    process.exit(1);
  }
  if (!jsonCurrent || !mdCurrent) process.exit(1);
  if (strict && warnings.length > 0) {
    for (const warning of warnings) console.warn(`WARN ${warning}`);
  }
  console.log('Phase 4 source worklist is current.');
  console.log('Phase 4 source worklist passed.');
  process.exit(0);
}

mkdirSync(dirname(abs(outJson)), { recursive: true });
writeFileSync(abs(outJson), jsonContent);
writeFileSync(abs(outMd), mdContent);

console.log(`Wrote ${relative(root, abs(outJson)).replaceAll('\\', '/')}`);
console.log(`Wrote ${relative(root, abs(outMd)).replaceAll('\\', '/')}`);
if (blockers.length > 0) {
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
  process.exit(1);
}
if (strict && warnings.length > 0) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
}
console.log('Phase 4 source worklist passed.');
