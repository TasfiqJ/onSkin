import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const source = await readFile(join(scriptDir, 'local-supabase-reset.mjs'), 'utf8');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');
const migrationNames = (await readdir(migrationsDir))
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/u.test(name))
  .sort((a, b) => a.localeCompare(b));

test('DB05 reset source count and latest version bind the current chain', () => {
  assert.equal(migrationNames.length, 89);
  assert.equal(migrationNames.at(-1)?.slice(0, 14), '20260921000073');
  assert.match(source, /const EXPECTED_MIGRATION_COUNT = 89;/u);
  assert.match(source, /const EXPECTED_LATEST_MIGRATION = '20260921000073';/u);
});

test('0072 commerce rehearsal uses its exact migration, then restores 0073 for head resets', () => {
  assert.match(source, /const COMMERCE_UPGRADE_MIGRATION = '20260729000072';/u);
  assert.match(source, /await rename\(sandboxCommerceMigration, withheldCommerceMigration\);/u);
  assert.match(source, /await rename\(withheldCommerceMigration, sandboxCommerceMigration\);/u);
  assert.match(source, /readFile\(sandboxCommerceMigration, 'utf8'\)/u);
  const commerceRehearsal = source.indexOf('run 0071 to 0072 commerce zero-admission rehearsal');
  const restoreHead = source.indexOf('await rename(withheldHeadMigration, sandboxHeadMigration);');
  const finalReset = source.indexOf("await runLocalCli('reset 1 of 2 (migrations plus seed)'");
  assert.ok(commerceRehearsal > 0 && restoreHead > commerceRehearsal && finalReset > restoreHead);
});

test('the pinned CLI rejects exact concurrent DROP replay before starting a stack', () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('DB05_')),
  );
  const result = spawnSync(
    process.execPath,
    [join(scriptDir, 'local-supabase-reset.mjs'), '--reset-only'],
    { cwd: repoRoot, env, encoding: 'utf8', timeout: 15_000 },
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /DB05_PINNED_CLI_CONCURRENT_DROP_UNVERIFIED/u);
  assert.match(result.stderr, /20260725000054_catalog_import_identity_and_visibility\.sql/u);
  assert.match(result.stderr, /20260726000059_edge_rate_limit_cleanup_concurrent_index\.sql/u);
  assert.doesNotMatch(result.stdout, /start isolated credential-free stack/u);
});
