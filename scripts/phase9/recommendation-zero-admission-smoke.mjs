#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFile(join(root, path), 'utf8');
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

const [migration, databaseTest, upgradeTest, runner, localContract, databaseTypes] =
  await Promise.all([
    read('supabase/migrations/20260726000071_recommendation_zero_admission.sql'),
    read('supabase/tests/database/recommendation_zero_admission.test.sql'),
    read('supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql'),
    read('scripts/phase2/local-supabase-reset.mjs'),
    read('scripts/phase2/local-supabase-contract.mjs'),
    read('packages/types/src/database.types.ts'),
  ]);

const migrations = (await readdir(join(root, 'supabase', 'migrations')))
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/u.test(name))
  .sort((left, right) => left.localeCompare(right));

check(migrations.length === 71, 'CORE-06A requires the exact 71-migration source set.');
check(
  migrations.includes('20260726000071_recommendation_zero_admission.sql') &&
    migrations.at(-1) === '20260729000072_commerce_zero_admission.sql',
  'Migration 0071 must remain in the exact source chain through commerce head 0072.',
);
check(
  /^--[\s\S]*\nbegin;[\s\S]*\ncommit;\s*$/u.test(migration),
  'Migration 0071 must be one explicit transaction.',
);
check(
  /create table private\.recommendation_admission_control/u.test(migration) &&
    /check \(admission_state = 'closed'\)/u.test(migration) &&
    /check \(checkpoint = 'core06a_zero_admission'\)/u.test(migration) &&
    /recommendation_admission_control_immutable/u.test(migration) &&
    /enable row level security/u.test(migration) &&
    /force row level security/u.test(migration) &&
    /from public, anon, authenticated, service_role/u.test(migration),
  'The private singleton must be constrained closed, immutable, forced-RLS, and runtime-denied.',
);
check(
  /update public\.products[\s\S]*?recommendation_eligible = false/u.test(migration) &&
    /new\.recommendation_eligible := false/u.test(migration) &&
    /products_recommendation_eligibility_closed[\s\S]*?check \(recommendation_eligible is false\)/u.test(
      migration,
    ) &&
    /refresh_product_correction_count[\s\S]*?recommendation_eligible = false/u.test(migration),
  'Legacy rows and every refresh/import assignment must remain recommendation-ineligible.',
);
const servableDefinition =
  migration.match(
    /create or replace function private\.catalog_product_is_servable\([\s\S]*?\n\$\$;/u,
  )?.[0] ?? '';
check(
  servableDefinition.length > 0 &&
    !/recommendation_eligible/u.test(servableDefinition) &&
    /catalog_launch_curation_head_is_active/u.test(servableDefinition) &&
    /catalog_operator_product_holds/u.test(servableDefinition),
  'Shelf serving must stay independent from recommendation admission and retain CAT-03/hold gates.',
);
const projection =
  migration.match(
    /create view public\.recommendable_catalog_products[\s\S]*?grant select on public\.recommendable_catalog_products to service_role;/u,
  )?.[0] ?? '';
check(
  projection.length > 0 &&
    /product\.id,[\s\S]*?product\.ingredient_quality_score/u.test(projection) &&
    /control\.admission_state = 'open'/u.test(projection) &&
    !/(select product\.\*|commission|affiliate|partnership|order_attributions)/iu.test(
      projection,
    ) &&
    /revoke all on public\.recommendable_catalog_products[\s\S]*?authenticated/u.test(projection),
  'The service projection must use an exact non-commercial allowlist and remain closed to clients.',
);
check(
  /delete from public\.recommendations;/u.test(migration) &&
    /recommendations_catalog_product_closed[\s\S]*?catalog_product_id is null/u.test(migration) &&
    /RECOMMENDATION_ADMISSION_CLOSED/u.test(migration) &&
    /drop policy if exists "recommendations_insert_own"/u.test(migration) &&
    /revoke all on public\.recommendations[\s\S]*?service_role/u.test(migration) &&
    /grant select on public\.recommendations to authenticated, service_role/u.test(migration),
  'All unreceipted cache state must be purged and every unused table privilege removed.',
);
check(
  /drop policy if exists "recommendation_preferences_insert_own"/u.test(migration) &&
    /revoke all on public\.recommendation_preferences/u.test(migration) &&
    /grant select on public\.recommendation_preferences[\s\S]*?authenticated, service_role/u.test(
      migration,
    ) &&
    /create or replace function public\.set_recommendation_preferences/u.test(migration) &&
    /_assert_current_health_session/u.test(migration) &&
    /_assert_health_processing_active_locked/u.test(migration) &&
    /_account_access_allowed/u.test(migration) &&
    /grant execute on function public\.set_recommendation_preferences[\s\S]*?to authenticated/u.test(
      migration,
    ),
  'Direct preference DML must be replaced by the exact fenced owner RPC.',
);
check(
  /revoke all on public\.order_attributions[\s\S]*?authenticated/u.test(migration),
  'Commission/order storage must be explicitly denied to client roles.',
);
check(
  /RECOMMENDATION_CATALOG_VALIDATOR_PREDICATE_DRIFT/u.test(migration) &&
    /catalog_launch_curation_record_is_valid_v0058/u.test(migration) &&
    /catalog_launch_curation_campaign_record_validity/u.test(migration),
  'CAT-03 scalar and set-based serving validators must be decoupled from recommendation admission with an exact drift guard.',
);
check(
  /select plan\(35\)/u.test(databaseTest) &&
    /CAT-03 scalar and set-based live validators do not depend on recommendation admission/u.test(
      databaseTest,
    ) &&
    /the recommendation candidate projection has one exact column allowlist/u.test(databaseTest) &&
    /no privileged cache publisher can bypass closed admission/u.test(databaseTest) &&
    /an exact current owner can atomically persist bounded preferences/u.test(databaseTest),
  'The structural pgTAP suite must exercise projection, cache, and preference boundaries.',
);
check(
  /select plan\(19\)/u.test(upgradeTest) &&
    /@@INCLUDE_EXACT_0071_MIGRATION@@/u.test(upgradeTest) &&
    /0071 purges every catalog-linked recommendation cache row/u.test(upgradeTest) &&
    /0071 also purges unreceipted type-only free-text cache rows/u.test(upgradeTest) &&
    /0071 removes every unused table privilege from both recommendation relations/u.test(
      upgradeTest,
    ),
  'The 0070-to-0071 rehearsal must prove the loss-averse cache cutover.',
);
check(
  /reset through 0070 for the 0071 recommendation forward-upgrade rehearsal/u.test(runner) &&
    /recommendation_zero_admission_0071_upgrade\.generated\.test\.sql/u.test(runner) &&
    /recommendation_zero_admission\.test\.sql/u.test(runner) &&
    /recommendationZeroAdmissionMigration/u.test(localContract),
  'The exact local verifier and credential-free contract must execute CORE-06A DB coverage.',
);
check(
  /recommendation_preferences:[\s\S]*?Insert: never;[\s\S]*?Update: never;/u.test(databaseTypes) &&
    /recommendations:[\s\S]*?Insert: never;[\s\S]*?Update: never;/u.test(databaseTypes) &&
    /set_recommendation_preferences:[\s\S]*?p_values_filters: string\[\][\s\S]*?p_budget_band: string \| null[\s\S]*?p_format_prefs: string\[\]/u.test(
      databaseTypes,
    ) &&
    !/recommendation_admission_control/u.test(databaseTypes),
  'Client DB types must expose only the owner RPC, never direct writes or private control.',
);

if (errors.length > 0) {
  process.stderr.write(
    `CORE-06A recommendation DB contract: FAIL\n${errors
      .map((error) => `- ${error}`)
      .join('\n')}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write('CORE-06A recommendation DB contract: PASS (12 checks)\n');
}
