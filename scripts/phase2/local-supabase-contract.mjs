#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasExactPostgresRehearsalBinding } from './quality-rehearsal-bindings.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};
const read = (path) => readFile(join(root, path), 'utf8');

const [
  packageSource,
  lockSource,
  config,
  runner,
  targetGuard,
  tests,
  catalogOperatorRevocationRehearsal,
  catalogImportLifecycleMigration,
  catalogScanMinimizationMigration,
  catalogCompatibilityMigration,
  catalogCurationStatementGuardMigration,
  catalogImportLifecycleTests,
  catalogLaunchCurationTests,
  catalogServingGateTests,
  freshnessTests,
  freshnessMigration,
  freshnessRehearsal,
  catalogCurationRehearsal,
  skinProfileUpgradeRehearsal,
  skinProfileSuccessorUpgradeRehearsal,
  catalogOperatorUpgradeRehearsal,
  clinicalContentUpgradeRehearsal,
  clinicalContentLegacySealTests,
  catalogReleaseLintUpgradeRehearsal,
  catalogReleaseLintContractTests,
  routineAdherenceMigration,
  routineAdherenceTests,
  routineAdherenceUpgradeRehearsal,
  routineCompletionSyncMigration,
  routineCompletionSyncTests,
  routineCompletionSyncUpgradeRehearsal,
  healthConsentDraftStagingMigration,
  healthConsentDraftStagingTests,
  healthConsentDraftStagingUpgradeRehearsal,
  healthConsentStatementTimeMigration,
  consentAndApiAccessFencesMigration,
  catalogOperatorPublicExecuteFenceMigration,
  healthConsentLifecycleTests,
  recommendationZeroAdmissionMigration,
  recommendationZeroAdmissionTests,
  recommendationZeroAdmissionUpgradeRehearsal,
  commerceZeroAdmissionMigration,
  commerceZeroAdmissionTests,
  commerceZeroAdmissionUpgradeRehearsal,
  catalogSearchPromotionBoundaryMigration,
  accountDeletionMigration,
  readme,
  workflow,
] = await Promise.all([
  read('package.json'),
  read('package-lock.json'),
  read('supabase/config.toml'),
  read('scripts/phase2/local-supabase-reset.mjs'),
  read('scripts/phase2/local-supabase-target-guard.mjs'),
  read('supabase/tests/database/schema_contract.test.sql'),
  read('supabase/tests/rehearsal/catalog_operator_revocation_race.test.sql'),
  read('supabase/migrations/20260717000057_catalog_import_lifecycle.sql'),
  read('supabase/migrations/20260718000059_catalog_scan_minimization.sql'),
  read('supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql'),
  read('supabase/migrations/20260722000062_catalog_curation_statement_guard.sql'),
  read('supabase/tests/database/catalog_import_lifecycle.test.sql'),
  read('supabase/tests/database/catalog_launch_curation.test.sql'),
  read('supabase/tests/database/catalog_serving_gate.test.sql'),
  read('supabase/tests/database/cat07_truthful_freshness.test.sql'),
  read('supabase/migrations/20260718000060_cat07_truthful_freshness.sql'),
  read('scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql'),
  read('scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql'),
  read('scripts/phase9/skin-profile-0064-upgrade-postgres-rehearsal.sql'),
  read('scripts/phase9/skin-profile-0075-upgrade-postgres-rehearsal.sql'),
  read('scripts/phase9/catalog-operator-0065-upgrade-postgres-rehearsal.sql'),
  read('scripts/phase9/clinical-content-0066-upgrade-postgres-rehearsal.sql'),
  read('supabase/tests/database/clinical_content_legacy_seal.test.sql'),
  read('scripts/phase9/catalog-release-0067-lint-contract-postgres-rehearsal.sql'),
  read('supabase/tests/database/catalog_release_temp_table_lint_contract.test.sql'),
  read('supabase/migrations/20260726000068_routine_adherence_authority.sql'),
  read('supabase/tests/database/routine_adherence_authority.test.sql'),
  read('supabase/tests/upgrade/routine_adherence_0068_upgrade.test.sql'),
  read('supabase/migrations/20260726000069_routine_completion_sync_bridge.sql'),
  read('supabase/tests/database/routine_completion_sync_bridge.test.sql'),
  read('supabase/tests/upgrade/routine_completion_sync_bridge_0069_upgrade.test.sql'),
  read('supabase/migrations/20260726000070_health_consent_draft_successor_staging.sql'),
  read('supabase/tests/database/health_consent_draft_successor_staging.test.sql'),
  read('supabase/tests/upgrade/health_consent_draft_successor_0070_upgrade.test.sql'),
  read('supabase/migrations/20260921000076_health_consent_statement_time.sql'),
  read('supabase/migrations/20260926000077_consent_and_api_access_fences.sql'),
  read('supabase/migrations/20260926000078_catalog_operator_public_execute_fence.sql'),
  read('supabase/tests/database/health_consent_lifecycle.test.sql'),
  read('supabase/migrations/20260726000071_recommendation_zero_admission.sql'),
  read('supabase/tests/database/recommendation_zero_admission.test.sql'),
  read('supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql'),
  read('supabase/migrations/20260729000072_commerce_zero_admission.sql'),
  read('supabase/tests/database/commerce_zero_admission.test.sql'),
  read('supabase/tests/upgrade/commerce_zero_admission_0072_upgrade.test.sql'),
  read('supabase/migrations/20260921000073_catalog_search_promotion_boundary.sql'),
  read(
    'supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql',
  ),
  read('supabase/README.md'),
  read('.github/workflows/quality.yml'),
]);
const packageJson = JSON.parse(packageSource);
const lockJson = JSON.parse(lockSource);
const migrations = (await readdir(join(root, 'supabase', 'migrations')))
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/u.test(name))
  .sort((a, b) => a.localeCompare(b));

function isCanonicalGtin(value) {
  if (!/^\d{8}$|^\d{12,14}$/u.test(value)) return false;
  if ((value.length === 13 || value.length === 14) && value.startsWith('0')) return false;
  const digits = [...value].map(Number);
  const actualCheckDigit = digits.pop();
  let weightedSum = 0;
  let weight = 3;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    weightedSum += digits[index] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return actualCheckDigit === (10 - (weightedSum % 10)) % 10;
}

check(packageJson.devDependencies?.supabase === '2.117.0', 'Pin Supabase CLI 2.117.0 exactly.');
check(
  lockJson.packages?.['node_modules/supabase']?.version === '2.117.0',
  'Lockfile Supabase CLI version must match the exact package pin.',
);
check(migrations.length === 94, `Expected 94 migration files; found ${migrations.length}.`);
check(
  migrations.at(-1)?.startsWith('20260926000078_'),
  'The latest migration must remain 20260926000078.',
);
check(
  /create or replace function public\.has_current_consent\(p_consent_type text\)/u.test(
    healthConsentStatementTimeMigration,
  ) &&
    /create or replace function public\.has_current_exact_consent\(/u.test(
      healthConsentStatementTimeMigration,
    ) &&
    (healthConsentStatementTimeMigration.match(/granted_at > pg_catalog\.statement_timestamp\(\)/gu)
      ?.length ?? 0) === 2 &&
    !/granted_at > (?:pg_catalog\.)?now\(\)/u.test(healthConsentStatementTimeMigration) &&
    /select plan\(222\)/u.test(healthConsentLifecycleTests) &&
    /a same-transaction grant is current for the next authenticated statement/u.test(
      healthConsentLifecycleTests,
    ) &&
    /a truly future-dated receipt cannot satisfy the exact consent helper/u.test(
      healthConsentLifecycleTests,
    ),
  '0076 must admit real same-transaction consent while preserving future-dated receipt denial.',
);
check(
  (consentAndApiAccessFencesMigration.match(/public\.account_access_allowed\(\)/gu)?.length ??
    0) === 2 &&
    /granted_at > pg_catalog\.statement_timestamp\(\)/u.test(
      consentAndApiAccessFencesMigration,
    ) &&
    /revoke all on function public\.apply_conflict_choice_outbox_batch\(jsonb\)/u.test(
      consentAndApiAccessFencesMigration,
    ) &&
    /revoke execute on all functions in schema public, private[\s\S]*?from catalog_operator_edge/u.test(
      consentAndApiAccessFencesMigration,
    ),
  '0077 must restore exact-session consent fencing and close the legacy clinical and catalog-operator API lanes.',
);
check(
  /revoke execute on all functions in schema public, private\s+from public, catalog_operator_edge;/u.test(
    catalogOperatorPublicExecuteFenceMigration,
  ) &&
    /alter default privileges for role postgres\s+revoke execute on functions from public;/u.test(
      catalogOperatorPublicExecuteFenceMigration,
    ) &&
    /alter default privileges for role postgres in schema public\s+revoke execute on functions from public;/u.test(
      catalogOperatorPublicExecuteFenceMigration,
    ) &&
    /alter default privileges for role postgres in schema private\s+revoke execute on functions from public;/u.test(
      catalogOperatorPublicExecuteFenceMigration,
    ),
  '0078 must close inherited PUBLIC execution for catalog_operator_edge and fail closed for future postgres-owned functions.',
);
check(
  /security definer/u.test(catalogSearchPromotionBoundaryMigration) &&
    /from public\.catalog_servable_products as product/u.test(
      catalogSearchPromotionBoundaryMigration,
    ) &&
    /drop function public\.promote_catalog_import\(uuid\);/u.test(
      catalogSearchPromotionBoundaryMigration,
    ) &&
    !/cascade/u.test(catalogSearchPromotionBoundaryMigration.replace(/^--[^\n]*$/gmu, '')),
  '0073 must restore governed CAT-03 search and remove the unreviewed one-argument promoter without CASCADE.',
);
check(
  new Set(migrations.map((name) => name.slice(0, 14))).size === migrations.length,
  'Migration versions must be unique.',
);
check(
  /or \(\s*p_correction_type = 'wrong_match'[\s\S]{0,220}?or \(p_barcode is null and v_product_name is null\)\s*\)\s*\)\s*\) then\s*raise exception 'CATALOG_REPORT_INPUT_INVALID'/u.test(
    catalogScanMinimizationMigration,
  ),
  'Migration 0059 must keep the submit_catalog_correction outer input-validation IF syntactically closed.',
);
check(
  !/enable_leaked_password_protection\s*=/u.test(config),
  'Remove the unsupported local HIBP key.',
);
check(
  /password_hibp_enabled/u.test(config) && /password_hibp_enabled/u.test(readme),
  'Keep the hosted leaked-password protection requirement documented.',
);
check(
  /\[db\.migrations\][\s\S]*?enabled\s*=\s*true/u.test(config),
  'Enable local migrations explicitly.',
);
check(
  /\[db\.seed\][\s\S]*?enabled\s*=\s*true[\s\S]*?\.\/seed\.sql/u.test(config),
  'Enable the reviewed local seed path explicitly.',
);

for (const command of [
  'db diff',
  'db lint',
  'db reset',
  'gen types',
  'migration list',
  'test db',
]) {
  check(targetGuard.includes(`'${command}'`), `The local runner must guard ${command}.`);
}
check(
  /FORBIDDEN_TARGET_FLAGS[\s\S]*?'--db-url'[\s\S]*?'--from'[\s\S]*?'--linked'[\s\S]*?'--project-id'[\s\S]*?'--to'/u.test(
    targetGuard,
  ) && targetGuard.includes('value === flag || value.startsWith(`${flag}=`)'),
  'The local runner must reject every remote-capable target flag.',
);
check(
  /ALLOWED_COMMAND_KEYS[\s\S]*?outside the local-only allowlist/u.test(targetGuard),
  'The local runner must reject commands outside its local-only allowlist.',
);
check(/mkdtemp/u.test(runner), 'The local runner must use a unique temporary workdir.');
check(/\.branches[\s\S]*?\.temp[\s\S]*?\.env/u.test(runner), 'Do not copy link or secret state.');
check(
  /sensitiveEnvironmentName[\s\S]*?includes\('SUPABASE'\)[\s\S]*?startsWith\('SB_'\)/u.test(runner),
  'Strip inherited hosted credentials from the local CLI environment.',
);
check(
  /'inbucket', 'port'[\s\S]*?'inbucket', 'smtp_port'[\s\S]*?'inbucket', 'pop3_port'/u.test(
    runner,
  ) && !/'local_smtp'/u.test(runner),
  'Every Inbucket host port must come from the isolated port block.',
);
check(
  /'analytics', 'port'[\s\S]*?'analytics', 'vector_port'[\s\S]*?'edge_runtime', 'inspector_port'/u.test(
    runner,
  ),
  'Every analytics and Edge inspector host port must be isolated.',
);
check(
  /stop', '--no-backup/u.test(runner),
  'The local runner must remove its isolated Docker volume.',
);
check(
  packageJson.scripts?.['phase2:db-local-contract']?.includes(
    'local-supabase-signal-cleanup.test.mjs',
  ) &&
    packageJson.scripts?.['phase2:db-local-contract']?.includes(
      'local-supabase-target-guard.test.mjs',
    ) &&
    packageJson.scripts?.['phase2:db-local-contract']?.includes(
      'database-types-contract.test.mjs',
    ) &&
    /installSignalCleanup\(\{ cleanup: cleanupSandbox \}\)/u.test(runner),
  'SIGINT/SIGTERM cleanup must be installed and exercised by the contract gate.',
);
check(/reset 1 of 2/u.test(runner) && /reset 2 of 2/u.test(runner), 'Verify two clean resets.');
check(
  /reset through 0067 for the 0068 forward-upgrade rehearsal/u.test(runner) &&
    /routine_adherence_0068_upgrade\.generated\.test\.sql/u.test(runner) &&
    /reset through 0068 for the 0069 forward-upgrade rehearsal/u.test(runner) &&
    /rename\(withheldSyncMigration, sandboxSyncMigration\)/u.test(runner) &&
    /syncUpgradeTemplate\.replace\(syncIncludeMarker, \(\) => exactSyncMigration\)/u.test(runner) &&
    /routine_completion_sync_bridge_0069_upgrade\.generated\.test\.sql/u.test(runner) &&
    /reset through 0069 for the 0070 consent-draft forward-upgrade rehearsal/u.test(runner) &&
    /rename\(sandboxConsentDraftMigration, withheldConsentDraftMigration\)/u.test(runner) &&
    /rename\(withheldConsentDraftMigration, sandboxConsentDraftMigration\)/u.test(runner) &&
    /health_consent_draft_successor_0070_upgrade\.generated\.test\.sql/u.test(runner) &&
    /reset through 0070 for the 0071 recommendation forward-upgrade rehearsal/u.test(runner) &&
    /rename\(withheldRecommendationMigration, sandboxRecommendationMigration\)/u.test(runner) &&
    /recommendation_zero_admission_0071_upgrade\.generated\.test\.sql/u.test(runner) &&
    /reset through 0071 for the 0072 commerce forward-upgrade rehearsal/u.test(runner) &&
    /'20260921000073,20260921000074,20260921000075,20260921000076'/u.test(runner) &&
    /rename\(migration\.installed, migration\.withheld\)/u.test(runner) &&
    /rename\(migration\.withheld, migration\.installed\)/u.test(runner) &&
    /rename\(withheldHeadMigration, sandboxHeadMigration\)/u.test(runner) &&
    /commerce_zero_admission_0072_upgrade\.generated\.test\.sql/u.test(runner),
  'The full local DB gate must execute 0068 against 0067, 0069 against 0068, 0070 against 0069, 0071 against 0070, and 0072 against 0071.',
);
check(
  /catalog-operator-dblink-target\.inc/u.test(runner) &&
    /host\.docker\.internal/u.test(runner) &&
    /test\.cat08_dblink_port[\s\S]*?ports\[2\]/u.test(runner) &&
    /run CAT-08 two-connection revocation rehearsal/u.test(runner) &&
    /'test', 'db', '--local', 'supabase\/tests\/rehearsal'/u.test(runner),
  'The full local DB gate must execute the committed CAT-08 two-connection rehearsal.',
);
check(
  /select plan\(10\)/u.test(catalogOperatorRevocationRehearsal) &&
    /extensions\.dblink_connect/u.test(catalogOperatorRevocationRehearsal) &&
    /catalog_operator_gateway\.catalog_operator_queue/u.test(catalogOperatorRevocationRehearsal) &&
    /pg_catalog\.pg_advisory_lock\(820801\)/u.test(catalogOperatorRevocationRehearsal) &&
    /pg_catalog\.pg_advisory_lock\(820802\)/u.test(catalogOperatorRevocationRehearsal) &&
    (
      catalogOperatorRevocationRehearsal.match(
        /pg_catalog\.pg_advisory_xact_lock\(p_latch_key\)/gu,
      ) ?? []
    ).length === 3 &&
    /p_latch_key is not null/u.test(catalogOperatorRevocationRehearsal) &&
    /pg_catalog\.pg_blocking_pids\(activity\.pid\)/u.test(catalogOperatorRevocationRehearsal) &&
    /'transactionid',[\s\S]*?'cat08_race_a'/u.test(catalogOperatorRevocationRehearsal) &&
    /'transactionid',[\s\S]*?'cat08_race_b'/u.test(catalogOperatorRevocationRehearsal) &&
    (
      catalogOperatorRevocationRehearsal.match(
        /pg_catalog\.array_agg\(result\)[\s\S]{0,100}dblink_get_result/gu,
      ) ?? []
    ).length === 4 &&
    (catalogOperatorRevocationRehearsal.match(/as drained\(result text\)/gu) ?? []).length === 4 &&
    (catalogOperatorRevocationRehearsal.match(/extensions\.dblink_get_result\(/gu) ?? []).length ===
      8 &&
    !/p_sleep_seconds/u.test(catalogOperatorRevocationRehearsal) &&
    !/hosted_verification_passed/u.test(catalogOperatorRevocationRehearsal) &&
    /'cat08_race_b',[\s\S]*?'Lock'/u.test(catalogOperatorRevocationRehearsal) &&
    /'cat08_race_a',[\s\S]*?'Lock'/u.test(catalogOperatorRevocationRehearsal) &&
    /42501:CATALOG_OPERATOR_CAPABILITY_DENIED/u.test(catalogOperatorRevocationRehearsal) &&
    /42501:CATALOG_OPERATOR_GRANT_REQUIRED/u.test(catalogOperatorRevocationRehearsal) &&
    /CAT08_REHEARSAL_EDGE_MEMBERSHIP_DRIFT/u.test(catalogOperatorRevocationRehearsal) &&
    /grant catalog_operator_edge to postgres/u.test(catalogOperatorRevocationRehearsal) &&
    /revoke catalog_operator_edge from postgres/u.test(catalogOperatorRevocationRehearsal) &&
    /CAT08_REHEARSAL_RUNNER_ROLE_INVALID/u.test(catalogOperatorRevocationRehearsal) &&
    /CAT08_REHEARSAL_DBLINK_TARGET_INVALID/u.test(catalogOperatorRevocationRehearsal) &&
    /CAT08_REHEARSAL_CONNECTION_ROLE_DRIFT/u.test(catalogOperatorRevocationRehearsal) &&
    /CAT08_REHEARSAL_CONNECTION_CALLER_INVALID/u.test(catalogOperatorRevocationRehearsal) &&
    /extensions\.gen_random_bytes\(32\)/u.test(catalogOperatorRevocationRehearsal) &&
    /create role cat08_rehearsal_connection login nosuperuser noinherit/u.test(
      catalogOperatorRevocationRehearsal,
    ) &&
    /test\.cat08_dblink_host/u.test(catalogOperatorRevocationRehearsal) &&
    /test\.cat08_dblink_port/u.test(catalogOperatorRevocationRehearsal) &&
    /\\ir generated\/catalog-operator-dblink-target\.inc/u.test(
      catalogOperatorRevocationRehearsal,
    ) &&
    /user=cat08_rehearsal_connection password=' \|\|[\s\S]*?test\.cat08_dblink_password/u.test(
      catalogOperatorRevocationRehearsal,
    ) &&
    /security definer[\s\S]*?session_user <> 'cat08_rehearsal_connection'/u.test(
      catalogOperatorRevocationRehearsal,
    ) &&
    /drop function[\s\S]*?cat08_rehearsal_revoke_then_latch\(uuid, bigint\)/u.test(
      catalogOperatorRevocationRehearsal,
    ) &&
    /drop role cat08_rehearsal_connection/u.test(catalogOperatorRevocationRehearsal) &&
    /set_config\('test\.cat08_dblink_password', '', false\)/u.test(
      catalogOperatorRevocationRehearsal,
    ) &&
    /set_config\('test\.cat08_dblink_host', '', false\)/u.test(
      catalogOperatorRevocationRehearsal,
    ) &&
    /set_config\('test\.cat08_dblink_port', '', false\)/u.test(
      catalogOperatorRevocationRehearsal,
    ) &&
    /dblink_disconnect\('cat08_race_a'\)/u.test(catalogOperatorRevocationRehearsal) &&
    /dblink_disconnect\('cat08_race_b'\)/u.test(catalogOperatorRevocationRehearsal),
  'CAT-08 rehearsal must prove action-first and session-revocation-first commit order with real independent sessions.',
);
check(
  /--types-check/u.test(runner) &&
    /--types-update/u.test(runner) &&
    /summarizeDatabaseTypes/u.test(runner) &&
    /mode === '--types-update' && repositoryBefore\.sha256 !== generated\.sha256/u.test(runner) &&
    !/LEGACY_HAND_AUTHORED_TYPES_SHA256/u.test(runner) &&
    /DB08_REPOSITORY_TYPES_STALE/u.test(runner) &&
    /\[db08-types\] repository parity: PASS/u.test(runner),
  'DB-08 must expose explicit local check/update modes and fail closed on repository drift.',
);

const cat02ProductFixtureGtins = [
  ...catalogImportLifecycleTests.matchAll(/pg_temp\.cat02_product\(\s*'(\d{8,14})'/gu),
].map((match) => match[1]);
check(
  !/'benzoyl_peroxide'/u.test(catalogImportLifecycleMigration) &&
    /v_record ->> 'category' not in \([\s\S]{0,180}'benzoyl_peroxide'/u.test(
      catalogCompatibilityMigration,
    ) &&
    /else 'benzoyl_peroxide'/u.test(catalogLaunchCurationTests),
  'Immutable migration 0057 must stay unchanged while forward migration 0061 admits signed benzoyl-peroxide candidates for later evidence-gated CAT-03 curation.',
);
check(
  /foreach v_relation in array array\['shelf_scans', 'catalog_corrections'\]/u.test(
    catalogCompatibilityMigration,
  ) &&
    /drop policy %I on public\.%I/u.test(catalogCompatibilityMigration) &&
    /to_jsonb\(old\) ->> 'catalog_product_id'/u.test(catalogCompatibilityMigration) &&
    /revoke all on table public\.shelf_scans[\s\S]*?service_role/u.test(
      catalogCompatibilityMigration,
    ) &&
    /grant select on table public\.catalog_corrections to service_role/u.test(
      catalogCompatibilityMigration,
    ) &&
    /freshness\.source_id = products\.source_id/u.test(catalogCompatibilityMigration) &&
    (
      catalogCompatibilityMigration.match(
        /pao_source in \('label', 'brand_label', 'catalog'\)/gu,
      ) ?? []
    ).length === 2 &&
    (catalogCompatibilityMigration.match(/pao_months between 1 and 120/gu) ?? []).length === 2 &&
    /parent_product\.source_id = product_pao_expiry\.source_id/u.test(
      catalogCompatibilityMigration,
    ) &&
    /^begin;[\s\S]*commit;\s*$/u.test(catalogCompatibilityMigration),
  'Forward migration 0061 must converge the stage enum, shared trigger, exact PAO parent-source provenance, residual-policy cleanup, and sealed relation privileges.',
);
check(
  /create index catalog_import_staged_records_batch_record_sha256_idx[\s\S]*?\(batch_id, record_sha256\)/u.test(
    catalogCurationStatementGuardMigration,
  ) &&
    /create index catalog_import_entity_revisions_membership_authority_idx[\s\S]*?batch_id,[\s\S]*?staged_record_id,[\s\S]*?entity_type,[\s\S]*?entity_id,[\s\S]*?revision_action[\s\S]*?include \(projection_sha256\)/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /create index catalog_import_batch_effects_membership_authority_idx[\s\S]*?staged_record_id,[\s\S]*?batch_id,[\s\S]*?promotion_event_id,[\s\S]*?entity_type,[\s\S]*?entity_id,[\s\S]*?effect_type[\s\S]*?include \(after_sha256\)/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /staged\.record_sha256 = target\.record_sha256[\s\S]*?staged\.record_sha256 = p_cat02_stage_record_sha256/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /revoke all on function[\s\S]*?catalog_launch_curation_membership_evidence_sha256\([\s\S]*?uuid,[\s\S]*?uuid,[\s\S]*?text,[\s\S]*?text,[\s\S]*?text,[\s\S]*?text,[\s\S]*?uuid,[\s\S]*?text,[\s\S]*?text,[\s\S]*?text,[\s\S]*?text,[\s\S]*?text[\s\S]*?public, anon, authenticated, service_role/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /create or replace function[\s\S]*?guard_catalog_launch_curation_record_insert_statement\(\)/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /referencing new table as inserted_catalog_curation_records/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /tg_op <> 'INSERT' or tg_level <> 'ROW'/u.test(catalogCurationStatementGuardMigration) &&
    /tg_op <> 'INSERT' or tg_level <> 'STATEMENT'/u.test(catalogCurationStatementGuardMigration) &&
    /select distinct inserted_record\.campaign_id[\s\S]*?order by inserted_record\.campaign_id/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /v_actual_record_count > v_expected_record_count/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /v_expected_mutation_root_set_sha256 is distinct from[\s\S]*?v_actual_mutation_root_set_sha256/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /revoke all on function[\s\S]*?guard_catalog_launch_curation_record_insert_statement\(\)[\s\S]*?public, anon, authenticated, service_role/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /campaign_authority as materialized/u.test(catalogCurationStatementGuardMigration) &&
    /approved_sources as materialized/u.test(catalogCurationStatementGuardMigration) &&
    /structurally_valid_records as materialized/u.test(catalogCurationStatementGuardMigration) &&
    /live_valid_records as materialized/u.test(catalogCurationStatementGuardMigration) &&
    /rename to catalog_launch_curation_record_is_structurally_valid_v0058/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /catalog_launch_curation_release_validation_cache/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /session_user = v_release_owner/u.test(catalogCurationStatementGuardMigration) &&
    /rename to release_catalog_launch_curation_campaign_v0058/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /catalog-launch-curation-global[\s\S]*?catalog-launch-curation-campaign:/u.test(
      catalogCurationStatementGuardMigration,
    ) &&
    /^begin;[\s\S]*commit;\s*$/u.test(catalogCurationStatementGuardMigration),
  'Forward migration 0062 must preserve per-row CAT-03 gates, validate each completed root once per statement, and reuse one owner-session-only materialized release validation pass.',
);
check(
  /\\ir \.\.\/\.\.\/supabase\/migrations\/20260722000062_catalog_curation_statement_guard\.sql/u.test(
    catalogCurationRehearsal,
  ) &&
    /catalog_import_staged_records_batch_record_sha256_idx/u.test(catalogCurationRehearsal) &&
    /catalog_import_entity_revisions_membership_authority_idx/u.test(catalogCurationRehearsal) &&
    /catalog_import_batch_effects_membership_authority_idx/u.test(catalogCurationRehearsal) &&
    /INSERT \.\.\. SELECT is a bounded statement-level no-op/u.test(catalogCurationRehearsal) &&
    /CATALOG_0062_OVERFLOW_NOT_ROLLED_BACK/u.test(catalogCurationRehearsal) &&
    /CATALOG_0062_ROOT_MISMATCH_NOT_ROLLED_BACK/u.test(catalogCurationRehearsal) &&
    /CATALOG_0062_SET_VALIDATION_WRAPPER_INVALID/u.test(catalogCurationRehearsal) &&
    /catalog-curation-0062-upgrade-postgres-rehearsal: pass/u.test(catalogCurationRehearsal) &&
    hasExactPostgresRehearsalBinding(
      workflow,
      'catalog_curation_upgrade_0062',
      'catalog-curation-0062-upgrade-postgres-rehearsal.sql',
    ),
  '0062 exact-byte PostgreSQL 15/17 rehearsal must cover indexed authority, statement boundaries, rollback, ACL, and trigger metadata.',
);
check(
  /\\ir \.\.\/\.\.\/supabase\/migrations\/20260726000064_skin_profile_quiz_provenance\.sql/u.test(
    skinProfileUpgradeRehearsal,
  ) &&
    /CORE01_0064_PREEXISTING_V2_ROW_NOT_PRESERVED/u.test(skinProfileUpgradeRehearsal) &&
    /CORE01_0064_UPGRADE_CONSTRAINT_VALIDATION_POSTURE_INVALID/u.test(
      skinProfileUpgradeRehearsal,
    ) &&
    /skin_profiles_quiz_v2_provenance_coherent/u.test(skinProfileUpgradeRehearsal) &&
    /skin_profiles_quiz_v2_scores_coherent/u.test(skinProfileUpgradeRehearsal) &&
    /skin_profiles_quiz_v2_profile_coherent/u.test(skinProfileUpgradeRehearsal) &&
    /skin_profiles_quiz_supported_version/u.test(skinProfileUpgradeRehearsal) &&
    /skin-profile-0064-upgrade-postgres-rehearsal: pass/u.test(skinProfileUpgradeRehearsal) &&
    hasExactPostgresRehearsalBinding(
      workflow,
      'skin_profile_upgrade_0064',
      'skin-profile-0064-upgrade-postgres-rehearsal.sql',
    ),
  '0064 exact-byte PostgreSQL 15/17 rehearsal must preserve a pre-existing v2 collision while enforcing every new check on later writes.',
);
check(
  /\\ir skin-profile-0064-upgrade-postgres-rehearsal\.sql/u.test(
    skinProfileSuccessorUpgradeRehearsal,
  ) &&
    /\\ir \.\.\/\.\.\/supabase\/migrations\/20260921000075_skin_profile_quiz_contract_successor\.sql/u.test(
      skinProfileSuccessorUpgradeRehearsal,
    ) &&
    /CORE01_0075_PRIOR_ROWS_CHANGED/u.test(skinProfileSuccessorUpgradeRehearsal) &&
    /CORE01_0075_INCOHERENT_NEW_ROW_ADMITTED/u.test(skinProfileSuccessorUpgradeRehearsal) &&
    /CORE01_0075_CURRENT_CLIENT_REJECTED/u.test(skinProfileSuccessorUpgradeRehearsal) &&
    /skin-profile-0075-upgrade-postgres-rehearsal: pass/u.test(
      skinProfileSuccessorUpgradeRehearsal,
    ) &&
    hasExactPostgresRehearsalBinding(
      workflow,
      'skin_profile_upgrade_0075',
      'skin-profile-0075-upgrade-postgres-rehearsal.sql',
    ),
  '0075 exact-byte PostgreSQL 15/17 rehearsal must preserve old rows and admit only coherent quiz client tuples.',
);
check(
  /\\ir \.\.\/\.\.\/supabase\/migrations\/20260726000065_catalog_operator_transition_conflict_target\.sql/u.test(
    catalogOperatorUpgradeRehearsal,
  ) &&
    /CORE01_0065_CONFLICT_TARGET_REPAIR_INVALID/u.test(catalogOperatorUpgradeRehearsal) &&
    /CORE01_0065_BOTH_TRANSITION_PATHS_NOT_EXECUTABLE/u.test(catalogOperatorUpgradeRehearsal) &&
    /CORE01_0065_TRANSITION_SECURITY_POSTURE_INVALID/u.test(catalogOperatorUpgradeRehearsal) &&
    /CORE01_0065_GLOBAL_FUNCTION_DEFAULT_ACL_INVALID/u.test(catalogOperatorUpgradeRehearsal) &&
    /catalog-operator-0065-upgrade-postgres-rehearsal: pass/u.test(
      catalogOperatorUpgradeRehearsal,
    ) &&
    hasExactPostgresRehearsalBinding(
      workflow,
      'catalog_operator_upgrade_0065',
      'catalog-operator-0065-upgrade-postgres-rehearsal.sql',
    ),
  '0065 exact-byte PostgreSQL 15/17 rehearsal must repair both transition conflict targets while preserving the Edge ACL and fail-closed function defaults.',
);
check(
  /\\ir \.\.\/\.\.\/supabase\/migrations\/20260726000066_legacy_clinical_content_immutability\.sql/u.test(
    clinicalContentUpgradeRehearsal,
  ) &&
    /CORE01_0066_UPGRADE_DATA_NOT_PRESERVED/u.test(clinicalContentUpgradeRehearsal) &&
    /CORE01_0066_API_TABLE_PRIVILEGE_SURVIVED/u.test(clinicalContentUpgradeRehearsal) &&
    /CORE01_0066_RLS_POSTURE_INVALID/u.test(clinicalContentUpgradeRehearsal) &&
    /CORE01_0066_TRIGGER_POSTURE_INVALID/u.test(clinicalContentUpgradeRehearsal) &&
    /CORE01_0066_GUARD_POSTURE_INVALID/u.test(clinicalContentUpgradeRehearsal) &&
    /clinical-content-0066-upgrade-postgres-rehearsal: pass/u.test(
      clinicalContentUpgradeRehearsal,
    ) &&
    hasExactPostgresRehearsalBinding(
      workflow,
      'clinical_content_upgrade_0066',
      'clinical-content-0066-upgrade-postgres-rehearsal.sql',
    ),
  '0066 exact-byte PostgreSQL rehearsal must preserve the historical fixtures while sealing every API-role and migration-owner mutation path.',
);
check(
  /select plan\(26\)/u.test(clinicalContentLegacySealTests) &&
    /94::bigint/u.test(clinicalContentLegacySealTests) &&
    /['"]20260926000078['"]::text/u.test(clinicalContentLegacySealTests) &&
    /the clinical legacy seal runs against the exact 94-migration source history/u.test(
      clinicalContentLegacySealTests,
    ) &&
    /the migration history includes the legacy seal and reaches the current quiz-contract successor/u.test(
      clinicalContentLegacySealTests,
    ) &&
    /all historical rule rows survive every denied owner and API mutation probe/u.test(
      clinicalContentLegacySealTests,
    ),
  '0066 pgTAP must bind the 94-migration current head and prove the legacy clinical fixtures survive denied owner and API-role mutations.',
);
check(
  /\\ir \.\.\/\.\.\/supabase\/migrations\/20260726000067_catalog_release_temp_table_lint_contract\.sql/u.test(
    catalogReleaseLintUpgradeRehearsal,
  ) &&
    /CORE02_0067_LINT_CONTRACT_INVALID/u.test(catalogReleaseLintUpgradeRehearsal) &&
    /CORE02_0067_RELEASE_ACL_DRIFT/u.test(catalogReleaseLintUpgradeRehearsal) &&
    /catalog-release-0067-lint-contract-postgres-rehearsal: pass/u.test(
      catalogReleaseLintUpgradeRehearsal,
    ) &&
    hasExactPostgresRehearsalBinding(
      workflow,
      'catalog_release_lint_contract_0067',
      'catalog-release-0067-lint-contract-postgres-rehearsal.sql',
    ),
  '0067 exact-byte PostgreSQL rehearsal must supply the checker-only runtime-temp-table shape while preserving the wrapper ACL and runtime path.',
);
check(
  /select plan\(7\)/u.test(catalogReleaseLintContractTests) &&
    /94::bigint/u.test(catalogReleaseLintContractTests) &&
    /['"]20260926000078['"]::text/u.test(catalogReleaseLintContractTests) &&
    /the catalog release lint contract runs against the exact 94-migration source history/u.test(
      catalogReleaseLintContractTests,
    ) &&
    /the migration history retains the temporary-table lint contract through the current quiz-contract successor/u.test(
      catalogReleaseLintContractTests,
    ) &&
    /only the exact temporary-table wrapper carries the checker shape/u.test(
      catalogReleaseLintContractTests,
    ),
  '0067 pgTAP must bind the 94-migration head and prove that exactly one known runtime-temp-table wrapper carries the checker-only ephemeral shape.',
);
check(
  /begin;/u.test(routineAdherenceMigration) &&
    routineAdherenceMigration.includes(
      'lock table public.routine_completions in access exclusive mode;',
    ) &&
    routineAdherenceMigration.includes('lock table public.profiles in access exclusive mode;') &&
    routineAdherenceMigration.includes(
      'lock table public.streak_freezes in access exclusive mode;',
    ) &&
    routineAdherenceMigration.indexOf(
      'lock table public.routine_completions in access exclusive mode;',
    ) < routineAdherenceMigration.indexOf('lock table public.profiles in access exclusive mode;') &&
    routineAdherenceMigration.indexOf('lock table public.profiles in access exclusive mode;') <
      routineAdherenceMigration.indexOf(
        'lock table public.streak_freezes in access exclusive mode;',
      ) &&
    /private\.routine_adherence_timezone_is_valid/u.test(routineAdherenceMigration) &&
    /completions\.step_id is null/u.test(routineAdherenceMigration) &&
    /drop policy if exists "streak_freezes_insert_own"/u.test(routineAdherenceMigration) &&
    /ROUTINE_ADHERENCE_CACHE_SERVER_OWNED/u.test(routineAdherenceMigration) &&
    /public\.set_routine_adherence_timezone/u.test(routineAdherenceMigration) &&
    /public\.refresh_routine_adherence/u.test(routineAdherenceMigration) &&
    /referencing new table as inserted_routine_completions/u.test(routineAdherenceMigration) &&
    /referencing old table as deleted_routine_completions/u.test(routineAdherenceMigration) &&
    /commit;/u.test(routineAdherenceMigration),
  '0068 must atomically bind exact local time, routine markers, server-owned cache/freezes, refresh, and statement-level recomputation.',
);
check(
  /select plan\(8\)/u.test(routineAdherenceUpgradeRehearsal) &&
    /@@INCLUDE_EXACT_0068_MIGRATION@@/u.test(routineAdherenceUpgradeRehearsal) &&
    /current_streak = 9/u.test(routineAdherenceUpgradeRehearsal) &&
    /legacy-client/u.test(routineAdherenceUpgradeRehearsal) &&
    /0068 atomically resets unverifiable legacy profile adherence/u.test(
      routineAdherenceUpgradeRehearsal,
    ) &&
    /the cutover preflight fails closed on a cross-owner legacy marker/u.test(
      routineAdherenceUpgradeRehearsal,
    ) &&
    /only the two preserved routine markers restore authoritative adherence/u.test(
      routineAdherenceUpgradeRehearsal,
    ),
  '0068 must prove its legacy cache/freeze cutover and marker-only restoration from head 0067.',
);
check(
  /select plan\(78\)/u.test(routineAdherenceTests) &&
    /94::bigint/u.test(routineAdherenceTests) &&
    /['"]20260926000078['"]::text/u.test(routineAdherenceTests) &&
    /CORE05_PARITY_CORPUS_SHA256: cbcfe0a13f1ef878f8769c875e9fb5b49fdcf667e723b4d918bc46889144fa00/u.test(
      routineAdherenceTests,
    ) &&
    /the hashed parity corpus matches the authoritative SQL projection/u.test(
      routineAdherenceTests,
    ) &&
    /exact 94-migration source history/u.test(routineAdherenceTests) &&
    /retains adherence authority through the current head/u.test(routineAdherenceTests) &&
    /two separated misses consume the total two-freeze budget/u.test(routineAdherenceTests) &&
    /a partial step completion cannot affect adherence/u.test(routineAdherenceTests) &&
    /an authenticated owner cannot directly insert a freeze/u.test(routineAdherenceTests) &&
    /deletion clears current\/freeze state without shrinking the personal best/u.test(
      routineAdherenceTests,
    ),
  '0068 pgTAP must bind the current head and exercise exact timezone, marker-only, freeze, cache, and delete truth.',
);
check(
  /begin;/u.test(routineCompletionSyncMigration) &&
    /create table public\.shelf_product_identities/u.test(routineCompletionSyncMigration) &&
    /create table private\.shelf_sync_operations/u.test(routineCompletionSyncMigration) &&
    /create table private\.routine_completion_sync_operations/u.test(
      routineCompletionSyncMigration,
    ) &&
    /public\.sync_shelf_product\(/u.test(routineCompletionSyncMigration) &&
    /public\.record_routine_completion\(/u.test(routineCompletionSyncMigration) &&
    /public\.export_shelf_product_identities_for_subject\(/u.test(routineCompletionSyncMigration) &&
    /public\.export_shelf_sync_receipts_for_subject\(/u.test(routineCompletionSyncMigration) &&
    /public\.export_routine_completion_sync_receipts_for_subject\(/u.test(
      routineCompletionSyncMigration,
    ) &&
    /HEALTH_SYNC_EXPORT_NONACTIVE_RESIDUE/u.test(routineCompletionSyncMigration) &&
    /COMPLETION_PRODUCT_RETRY_LATER/u.test(routineCompletionSyncMigration) &&
    /COMPLETION_AFTER_PRODUCT_DELETION/u.test(routineCompletionSyncMigration) &&
    !/COMPLETION_DEPENDENCY_TERMINAL/u.test(routineCompletionSyncMigration) &&
    /revoke insert, update, delete, truncate, references, trigger[\s\S]*?public\.user_products/u.test(
      routineCompletionSyncMigration,
    ) &&
    /commit;/u.test(routineCompletionSyncMigration),
  '0069 must atomically install minimized stable identity, replay ledgers, authenticated bridge RPCs, tombstones, and direct-DML seals.',
);
check(
  /select plan\(16\)/u.test(routineCompletionSyncUpgradeRehearsal) &&
    /@@INCLUDE_EXACT_0069_MIGRATION@@/u.test(routineCompletionSyncUpgradeRehearsal) &&
    /0069 backfills one minimal stable identity per legacy Shelf row/u.test(
      routineCompletionSyncUpgradeRehearsal,
    ) &&
    /the cutover preflight fails closed on a cross-owner legacy product/u.test(
      routineCompletionSyncUpgradeRehearsal,
    ) &&
    /the exact scalar completion RPC signature exists/u.test(routineCompletionSyncUpgradeRehearsal),
  '0069 must prove its exact 0068-to-0069 identity/FK/ACL cutover with production-shaped legacy rows.',
);
check(
  /select plan\(82\)/u.test(routineCompletionSyncTests) &&
    /94::bigint/u.test(routineCompletionSyncTests) &&
    /['"]20260926000078['"]::text/u.test(routineCompletionSyncTests) &&
    /exact 94-migration source history/u.test(routineCompletionSyncTests) &&
    /Shelf sync rejects an exact draft-blocked health grant before retention/u.test(
      routineCompletionSyncTests,
    ) &&
    /completion sync rejects an exact draft-blocked health grant before retention/u.test(
      routineCompletionSyncTests,
    ) &&
    /Shelf sync rejects a formerly active epoch after its exact grant closes/u.test(
      routineCompletionSyncTests,
    ) &&
    /completion sync rejects a formerly active epoch after its exact grant closes/u.test(
      routineCompletionSyncTests,
    ) &&
    /active subject export requires the exact current health-processing epoch/u.test(
      routineCompletionSyncTests,
    ) &&
    /second subject can export only that subject''s own minimized receipts/u.test(
      routineCompletionSyncTests,
    ) &&
    /withdrawn lifecycle fails closed if a sealed source has synthetic residue/u.test(
      routineCompletionSyncTests,
    ) &&
    /all sealed health-sync exports verify exact zero after canonical withdrawal purge/u.test(
      routineCompletionSyncTests,
    ) &&
    /a completion whose Shelf identity has not arrived is retryable/u.test(
      routineCompletionSyncTests,
    ) &&
    /orphan-marker rejection leaves timezone, profile cache, and freezes byte-stable/u.test(
      routineCompletionSyncTests,
    ) &&
    /semantic-conflict rejection cannot mutate adherence authority/u.test(
      routineCompletionSyncTests,
    ) &&
    /historical evidence exactly at the tombstone cutoff remains admissible/u.test(
      routineCompletionSyncTests,
    ) &&
    /zero-attestation proves stable identities and all relational health data erased/u.test(
      routineCompletionSyncTests,
    ),
  '0069 pgTAP must exercise exact JSON, delayed dependencies, conflict side-effect safety, tombstones, ACLs, and erasure.',
);
check(
  /create table public\.health_consent_copy_staging_events/u.test(
    healthConsentDraftStagingMigration,
  ) &&
    /stage_health_consent_copy_draft_successor/u.test(healthConsentDraftStagingMigration) &&
    /_health_consent_copy_staging_evidence_hash/u.test(healthConsentDraftStagingMigration) &&
    /HEALTH_CONSENT_COPY_DRAFT_STAGING_EVIDENCE_MISMATCH/u.test(
      healthConsentDraftStagingMigration,
    ) &&
    /4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc/u.test(
      healthConsentDraftStagingMigration,
    ) &&
    /HEALTH_CONSENT_COPY_NOT_RELEASED/u.test(healthConsentDraftStagingMigration) &&
    /from public, anon, authenticated, service_role/u.test(healthConsentDraftStagingMigration),
  '0070 must retain the historical Ask staging tuple as an unreleased migration-owned draft without runtime authority.',
);
check(
  /select plan\(25\)/u.test(healthConsentDraftStagingTests) &&
    /predecessor Ask tuple remains immutable noncurrent draft history/u.test(
      healthConsentDraftStagingTests,
    ) &&
    /draft alignment creates no Ask review, promotion, or supersession event/u.test(
      healthConsentDraftStagingTests,
    ) &&
    /staging evidence cannot be rewritten by the database owner/u.test(
      healthConsentDraftStagingTests,
    ) &&
    /one-byte staging-evidence mutation fails before replay or writes/u.test(
      healthConsentDraftStagingTests,
    ) &&
    /runtime service authority is not migration staging authority/u.test(
      healthConsentDraftStagingTests,
    ) &&
    /exact current Ask draft still cannot authorize a grant/u.test(healthConsentDraftStagingTests),
  '0070 pgTAP must prove exact retained history, immutable non-review evidence, runtime denial, and unreleased grant denial.',
);
check(
  /select plan\(13\)/u.test(healthConsentDraftStagingUpgradeRehearsal) &&
    /@@INCLUDE_EXACT_0070_MIGRATION@@/u.test(healthConsentDraftStagingUpgradeRehearsal) &&
    /0069 starts with the installed Ask predecessor as the current draft/u.test(
      healthConsentDraftStagingUpgradeRehearsal,
    ) &&
    /0070 invents no legal or privacy review event/u.test(
      healthConsentDraftStagingUpgradeRehearsal,
    ) &&
    /0070 leaves the exact updated Ask grant blocked pending genuine review/u.test(
      healthConsentDraftStagingUpgradeRehearsal,
    ),
  '0070 must prove its exact 0069-to-0070 draft-only consent-copy transition.',
);
check(
  /create table private\.recommendation_admission_control/u.test(
    recommendationZeroAdmissionMigration,
  ) &&
    /check \(admission_state = 'closed'\)/u.test(recommendationZeroAdmissionMigration) &&
    /products_recommendation_eligibility_closed/u.test(recommendationZeroAdmissionMigration) &&
    /new\.recommendation_eligible := false/u.test(recommendationZeroAdmissionMigration) &&
    /drop view public\.recommendable_catalog_products/u.test(
      recommendationZeroAdmissionMigration,
    ) &&
    /grant select on public\.recommendable_catalog_products to service_role/u.test(
      recommendationZeroAdmissionMigration,
    ) &&
    /RECOMMENDATION_CATALOG_VALIDATOR_PREDICATE_DRIFT/u.test(
      recommendationZeroAdmissionMigration,
    ) &&
    /catalog_launch_curation_record_is_valid_v0058/u.test(recommendationZeroAdmissionMigration) &&
    /catalog_launch_curation_campaign_record_validity/u.test(
      recommendationZeroAdmissionMigration,
    ) &&
    /recommendations_catalog_product_closed/u.test(recommendationZeroAdmissionMigration) &&
    /RECOMMENDATION_ADMISSION_CLOSED/u.test(recommendationZeroAdmissionMigration) &&
    /set_recommendation_preferences/u.test(recommendationZeroAdmissionMigration) &&
    /revoke all on public\.order_attributions/u.test(recommendationZeroAdmissionMigration),
  '0071 must close product/cached recommendation admission, preserve Shelf serving, expose only an exact service projection, and retain one owner preference RPC.',
);
check(
  /select plan\(35\)/u.test(recommendationZeroAdmissionTests) &&
    /the control is exactly one constrained closed checkpoint/u.test(
      recommendationZeroAdmissionTests,
    ) &&
    /every import or refresh assignment is coerced back to false/u.test(
      recommendationZeroAdmissionTests,
    ) &&
    /Shelf serving remains independently CAT-03 and hold gated/u.test(
      recommendationZeroAdmissionTests,
    ) &&
    /CAT-03 scalar and set-based live validators do not depend on recommendation admission/u.test(
      recommendationZeroAdmissionTests,
    ) &&
    /the recommendation candidate projection has one exact column allowlist/u.test(
      recommendationZeroAdmissionTests,
    ) &&
    /no privileged cache publisher can bypass closed admission/u.test(
      recommendationZeroAdmissionTests,
    ) &&
    /an exact current owner can atomically persist bounded preferences/u.test(
      recommendationZeroAdmissionTests,
    ) &&
    /commission\/order storage has no client privilege or policy/u.test(
      recommendationZeroAdmissionTests,
    ),
  '0071 pgTAP must prove exact zero admission, ACLs, Shelf independence, and owner-only preference publication.',
);
check(
  /select plan\(19\)/u.test(recommendationZeroAdmissionUpgradeRehearsal) &&
    /@@INCLUDE_EXACT_0071_MIGRATION@@/u.test(recommendationZeroAdmissionUpgradeRehearsal) &&
    /0071 purges every catalog-linked recommendation cache row/u.test(
      recommendationZeroAdmissionUpgradeRehearsal,
    ) &&
    /0071 also purges unreceipted type-only free-text cache rows/u.test(
      recommendationZeroAdmissionUpgradeRehearsal,
    ) &&
    /0071 removes every unused table privilege from both recommendation relations/u.test(
      recommendationZeroAdmissionUpgradeRehearsal,
    ) &&
    /legacy refresh\/import reopen attempt closed/u.test(
      recommendationZeroAdmissionUpgradeRehearsal,
    ) &&
    /Shelf product serving is independent from recommendation admission/u.test(
      recommendationZeroAdmissionUpgradeRehearsal,
    ),
  '0071 must prove its exact 0070-to-0071 loss-averse cache and admission cutover.',
);
check(
  /create table private\.commerce_admission_control/u.test(commerceZeroAdmissionMigration) &&
    /check \(admission_state = 'closed'\)/u.test(commerceZeroAdmissionMigration) &&
    /revoke all on table public\.affiliate_links\s+from public, anon, authenticated, service_role/u.test(
      commerceZeroAdmissionMigration,
    ) &&
    /revoke all on table public\.creator_stacks\s+from public, anon, authenticated, service_role/u.test(
      commerceZeroAdmissionMigration,
    ) &&
    /revoke all on table public\.creator_stack_items\s+from public, anon, authenticated, service_role/u.test(
      commerceZeroAdmissionMigration,
    ) &&
    /revoke all on table public\.commerce_click_events\s+from public, anon, authenticated, service_role/u.test(
      commerceZeroAdmissionMigration,
    ) &&
    /grant select, delete on table public\.commerce_click_events\s+to authenticated, service_role/u.test(
      commerceZeroAdmissionMigration,
    ) &&
    /revoke all on table public\.order_attributions/u.test(commerceZeroAdmissionMigration) &&
    /grant update \(click_token\) on table public\.order_attributions/u.test(
      commerceZeroAdmissionMigration,
    ) &&
    /create trigger order_attributions_admission_closed/u.test(commerceZeroAdmissionMigration) &&
    /COMMERCE_ADMISSION_CLOSED/u.test(commerceZeroAdmissionMigration) &&
    /COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED/u.test(commerceZeroAdmissionMigration),
  '0072 must close commerce publication, catalog reads, click writes, and stale-poller attribution writes while retaining exact data-rights cleanup.',
);
check(
  /select plan\(23\)/u.test(commerceZeroAdmissionTests) &&
    /owner read\/delete policies remain/u.test(commerceZeroAdmissionTests) &&
    /service data-rights deletion and attribution detachment remain/u.test(
      commerceZeroAdmissionTests,
    ) &&
    /even a privileged publisher cannot mint a click while commerce is closed/u.test(
      commerceZeroAdmissionTests,
    ) &&
    /privileged stale poller cannot publish a new order attribution/u.test(
      commerceZeroAdmissionTests,
    ) &&
    /token detachment cannot camouflage a business-field update/u.test(
      commerceZeroAdmissionTests,
    ) &&
    /installed-base attribution deletion remains available/u.test(commerceZeroAdmissionTests),
  '0072 pgTAP must prove exact zero commerce admission, revoked publication ACLs, stale-poller closure, and retained cleanup.',
);
check(
  /select plan\(21\)/u.test(commerceZeroAdmissionUpgradeRehearsal) &&
    /@@INCLUDE_EXACT_0072_MIGRATION@@/u.test(commerceZeroAdmissionUpgradeRehearsal) &&
    /insert into public\.commerce_click_events\s*\([\s\S]{0,300}?health_processing_epoch,\s*data_sharing_generation\s*\) values \([\s\S]{0,300}?true,\s*1,\s*1\s*\)/u.test(
      commerceZeroAdmissionUpgradeRehearsal,
    ) &&
    /alter table public\.order_attributions disable trigger user;\s*insert into public\.order_attributions\s*\([\s\S]{0,700}?\);\s*alter table public\.order_attributions enable trigger user;/u.test(
      commerceZeroAdmissionUpgradeRehearsal,
    ) &&
    /clean 0071 retains affiliate and click publication policies but already sealed stacks/u.test(
      commerceZeroAdmissionUpgradeRehearsal,
    ) &&
    /grant select, insert, update, delete\s+on table public\.commerce_click_events\s+to authenticated, service_role;/u.test(
      commerceZeroAdmissionUpgradeRehearsal,
    ) &&
    /the fixture installs representative legacy ambient commerce DML before 0072/u.test(
      commerceZeroAdmissionUpgradeRehearsal,
    ) &&
    /0072 removes legacy commerce publication DML from every runtime role/u.test(
      commerceZeroAdmissionUpgradeRehearsal,
    ) &&
    /0072 returns only owner and service click read-delete cleanup authority/u.test(
      commerceZeroAdmissionUpgradeRehearsal,
    ) &&
    /retains the legacy affiliate row without publishing it/u.test(
      commerceZeroAdmissionUpgradeRehearsal,
    ) &&
    /preserves deletion of an installed-base click/u.test(commerceZeroAdmissionUpgradeRehearsal) &&
    /leaves no permissive commerce publication policy/u.test(
      commerceZeroAdmissionUpgradeRehearsal,
    ) &&
    /post-upgrade attribution insert guard/u.test(commerceZeroAdmissionUpgradeRehearsal) &&
    /preserves exact installed-base attribution detachment/u.test(
      commerceZeroAdmissionUpgradeRehearsal,
    ) &&
    /preserves installed-base attribution deletion/u.test(commerceZeroAdmissionUpgradeRehearsal),
  '0072 must prove its exact 0071-to-0072 loss-averse commerce and stale-poller cutover from a schema-valid health-authority fixture.',
);
check(
  /select plan\(218\)/u.test(catalogImportLifecycleTests) &&
    /latest forward migration admits the signed benzoyl-peroxide category override/u.test(
      catalogImportLifecycleTests,
    ) &&
    /service staging RPC accepts an evidence-reviewed benzoyl-peroxide candidate/u.test(
      catalogImportLifecycleTests,
    ) &&
    /staging RPC still rejects every unsupported category value/u.test(
      catalogImportLifecycleTests,
    ) &&
    /p_category text default 'moisturiser_tube'/u.test(catalogImportLifecycleTests) &&
    cat02ProductFixtureGtins.length > 0 &&
    cat02ProductFixtureGtins.every(isCanonicalGtin),
  'CAT-02 positive product fixtures must use the signed category taxonomy and canonical checksum-valid GTINs.',
);
check(
  /select plan\(58\)/u.test(catalogServingGateTests) &&
    catalogServingGateTests.includes("'56000000000016'") &&
    !catalogServingGateTests.includes("'05600000000010'") &&
    isCanonicalGtin('56000000000016') &&
    /otherwise eligible product remains hidden without an exact active CAT-03 product and campaign head/u.test(
      catalogServingGateTests,
    ) &&
    /product without CAT-03 serving authority cannot leak freshness evidence/u.test(
      catalogServingGateTests,
    ) &&
    /authenticated PAO RLS excludes wrong-source, category-default, unknown, null, and out-of-range evidence/u.test(
      catalogServingGateTests,
    ) &&
    !/from public\.recommendable_catalog_products/u.test(catalogServingGateTests),
  'The legacy serving fixture must use a canonical GTIN and explicitly prove no-head fail-closed behavior without direct legacy-view reads.',
);
check(
  /select plan\(102\)/u.test(catalogLaunchCurationTests) &&
    /exact migration-owner session consumes only its keyed transaction-local release cache/u.test(
      catalogLaunchCurationTests,
    ) &&
    /SET ROLE retains the migration-owner session and therefore cannot model a distinct runtime service_role session/u.test(
      catalogLaunchCurationTests,
    ) &&
    /\{"aliasLookup":0,"lookup":1,"search":1\}/u.test(catalogLaunchCurationTests) &&
    /exact bounded row and source-attribution shape/u.test(catalogLaunchCurationTests) &&
    /only reviewed same-territory freshness from an approved source/u.test(
      catalogLaunchCurationTests,
    ) &&
    /authenticated RLS exposes only same-source live freshness/u.test(catalogLaunchCurationTests),
  'CAT-03 must own positive active-head serving, exact payload-shape, attribution, and same-territory/same-source freshness coverage.',
);

check(/select plan\(52\)/u.test(tests), 'The structural pgTAP plan must remain explicit.');
check(
  /select plan\(53\)/u.test(freshnessTests) &&
    (
      freshnessTests.match(
        /^select (?:cmp_ok|is|isnt|lives_ok|matches|ok|results_eq|throws_ok|unlike)\(/gmu,
      ) ?? []
    ).length === 53 &&
    /20260718000060/u.test(freshnessTests) &&
    /user_products_pao_source_coherent/u.test(freshnessTests) &&
    /user_products_expiry_source_coherent/u.test(freshnessTests) &&
    /user_products_opened_state_coherent/u.test(freshnessTests) &&
    /USER_PRODUCT_CATALOG_PAO_EVIDENCE_INVALID/u.test(freshnessTests) &&
    /trg_user_products_catalog_pao_snapshot/u.test(freshnessTests) &&
    /trg_user_products_category_default_evidence/u.test(freshnessTests) &&
    /stale product relink from a mobile mirror replay is coerced back to NULL/u.test(
      freshnessTests,
    ) &&
    /stale source relink from a mobile mirror replay is coerced back to NULL/u.test(freshnessTests),
  'The CAT-07 pgTAP truth table must remain explicit and migration-bound.',
);
check(
  !/pg_catalog\.coalesce/u.test(freshnessMigration) &&
    /delete from public\.ingredient_pao_defaults;[\s\S]*ingredient_pao_defaults_legacy_empty check \(false\)/u.test(
      freshnessMigration,
    ) &&
    /alter table public\.ingredient_pao_defaults force row level security/u.test(
      freshnessMigration,
    ) &&
    /product_categories has no named reviewer, source snapshot, or retained[\s\S]*category-evidence identity/u.test(
      freshnessMigration,
    ) &&
    /private\.resolve_catalog_pao_snapshot/u.test(freshnessMigration) &&
    /statement_timestamp\(\) at time zone 'UTC'/u.test(freshnessMigration) &&
    /freshness\.review_status = 'reviewed'/u.test(freshnessMigration) &&
    /nullif\(pg_catalog\.btrim\(freshness\.reviewed_by\), ''\) is not null/u.test(
      freshnessMigration,
    ) &&
    /source\.source_key = product\.source/u.test(freshnessMigration) &&
    /snapshot\.match_count = 1/u.test(freshnessMigration) &&
    /attempted category claim[\s\S]*?unknown/u.test(freshnessMigration) &&
    /trg_user_products_category_default_evidence/u.test(freshnessMigration) &&
    /trg_user_products_catalog_pao_snapshot/u.test(freshnessMigration) &&
    !/trg_products_category_default_evidence/u.test(freshnessMigration) &&
    !/trg_product_categories_category_default_evidence/u.test(freshnessMigration) &&
    !/trg_product_categories_category_default_delete/u.test(freshnessMigration) &&
    /legacy_unverified_expiry_date/u.test(freshnessMigration) &&
    /disable trigger trg_user_products_health_write/u.test(freshnessMigration) &&
    /enable trigger trg_user_products_health_write/u.test(freshnessMigration) &&
    /^begin;[\s\S]*commit;\s*$/u.test(freshnessMigration),
  'CAT-07 migration must require exact reviewed product PAO evidence, quarantine category defaults, and UTC-bound local-date tolerance.',
);
check(
  /\\ir \.\.\/\.\.\/supabase\/migrations\/20260718000060_cat07_truthful_freshness\.sql/u.test(
    freshnessRehearsal,
  ) &&
    /CAT07_TRUTHFUL_FRESHNESS_POSTGRES_REHEARSAL_PASS/u.test(freshnessRehearsal) &&
    /CAT07_LEGACY_DEFAULT_RELATION_NOT_EMPTY/u.test(freshnessRehearsal) &&
    /CAT07_LEGACY_DEFAULT_RELATION_NOT_SEALED/u.test(freshnessRehearsal) &&
    /CAT07_LEGACY_DEFAULT_REPOPULATION_ACCEPTED/u.test(freshnessRehearsal) &&
    /CAT07_CATEGORY_DEFAULT_NOT_QUARANTINED/u.test(freshnessRehearsal) &&
    /CAT07_CATALOG_PAO_SNAPSHOT_NOT_BACKFILLED/u.test(freshnessRehearsal) &&
    /CAT07_CATALOG_SOURCE_DELETE_PINNED/u.test(freshnessRehearsal) &&
    /CAT07_STALE_SOURCE_REPLAY_RELINKED/u.test(freshnessRehearsal) &&
    /CAT07_STALE_PRODUCT_REPLAY_RELINKED/u.test(freshnessRehearsal) &&
    /CAT07_LEGACY_QUARANTINE_NOT_EXCLUSIVE/u.test(freshnessRehearsal) &&
    /CAT07_ARBITRARY_FUTURE_OPENING_ACCEPTED/u.test(freshnessRehearsal),
  'CAT-07 PostgreSQL rehearsal must execute the real migration and isolate product PAO, quarantine, lifecycle, stale replay, and date failures.',
);
check(
  !/public\.(?:digest|gen_random_bytes)\s*\(/u.test(accountDeletionMigration),
  'pgcrypto functions must use the pinned image extension namespace.',
);
check(
  /supabase_migrations\.schema_migrations/u.test(tests),
  'pgTAP must verify migration history.',
);
check(
  /91::bigint/u.test(tests) && /relrowsecurity/u.test(tests),
  'pgTAP must verify the RLS table inventory.',
);
check(
  /auth', 'users/u.test(tests) && /storage', 'objects/u.test(tests),
  'pgTAP must cover Auth and Storage.',
);
check(/phase2:db-local-verify/u.test(workflow), 'Quality CI must run the full local DB gate.');
check(
  /cat07_truthful_freshness_0060/u.test(workflow) &&
    /cat07-truthful-freshness-postgres-rehearsal\.sql/u.test(workflow),
  'Quality CI must run the CAT-07 legacy upgrade rehearsal.',
);

if (errors.length > 0) {
  process.stderr.write(`DB-05 local Supabase contract: FAIL\n- ${errors.join('\n- ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('DB-05 local Supabase contract: PASS\n');
}
