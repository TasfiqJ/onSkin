#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  freshnessTests,
  freshnessMigration,
  freshnessRehearsal,
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
  read('supabase/tests/database/cat07_truthful_freshness.test.sql'),
  read('supabase/migrations/20260718000060_cat07_truthful_freshness.sql'),
  read('scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql'),
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

check(packageJson.devDependencies?.supabase === '2.109.1', 'Pin Supabase CLI 2.109.1 exactly.');
check(
  lockJson.packages?.['node_modules/supabase']?.version === '2.109.1',
  'Lockfile Supabase CLI version must match the exact package pin.',
);
check(migrations.length === 59, `Expected 59 migration files; found ${migrations.length}.`);
check(
  migrations.at(-1)?.startsWith('20260718000060_'),
  'The latest migration must remain 20260718000060.',
);
check(
  new Set(migrations.map((name) => name.slice(0, 14))).size === migrations.length,
  'Migration versions must be unique.',
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
    /installSignalCleanup\(\{ cleanup: cleanupSandbox \}\)/u.test(runner),
  'SIGINT/SIGTERM cleanup must be installed and exercised by the contract gate.',
);
check(/reset 1 of 2/u.test(runner) && /reset 2 of 2/u.test(runner), 'Verify two clean resets.');
check(/DB-08 remains open/u.test(runner), 'Temporary type output must not close DB-08.');

check(/select plan\(50\)/u.test(tests), 'The structural pgTAP plan must remain explicit.');
check(
  /select plan\(46\)/u.test(freshnessTests) &&
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
    /stale source relink from a mobile mirror replay is coerced back to NULL/u.test(
      freshnessTests,
    ),
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
  /80::bigint/u.test(tests) && /relrowsecurity/u.test(tests),
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
