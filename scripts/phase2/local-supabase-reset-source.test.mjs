import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const source = await readFile(join(scriptDir, 'local-supabase-reset.mjs'), 'utf8');
const qualityWorkflow = await readFile(
  join(repoRoot, '.github', 'workflows', 'quality.yml'),
  'utf8',
);
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

test('the pinned trial CLI retains exact current-chain SQL for a local replay', () => {
  assert.match(source, /const PINNED_CLI_VERSION = '2\.117\.0';/u);
  assert.doesNotMatch(source, /DB05_PINNED_CLI_CONCURRENT_DROP_UNVERIFIED/u);
  assert.match(source, /const SOURCE_SUPABASE_DIR = sourceSupabaseOverride/u);
  assert.match(source, /await cp\(SOURCE_SUPABASE_DIR, sandboxSupabaseDir/u);
});

test('CI retains generated types only as a bounded parity diagnostic', () => {
  assert.match(source, /FULL_VERIFY && process\.env\.GITHUB_ACTIONS === 'true'/u);
  assert.match(source, /join\(process\.env\.RUNNER_TEMP, 'db05-generated-public-types\.ts'\)/u);
  assert.match(
    source,
    /writeFile\(diagnosticTypesPath, generated\.text, \{ encoding: 'utf8', flag: 'wx' \}\)/u,
  );
  assert.match(
    qualityWorkflow,
    /if: \$\{\{ failure\(\) \}\}[\s\S]*?path: \$\{\{ runner\.temp \}\}\/db05-generated-public-types\.ts/u,
  );
  assert.match(qualityWorkflow, /if-no-files-found: ignore/u);
});
