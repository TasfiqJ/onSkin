import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
const consentStagingMigration = await readFile(
  join(migrationsDir, '20260726000070_health_consent_draft_successor_staging.sql'),
  'utf8',
);
const consentStagingTests = await Promise.all(
  [
    'supabase/tests/database/health_consent_draft_successor_staging.test.sql',
    'supabase/tests/upgrade/health_consent_draft_successor_0070_upgrade.test.sql',
  ].map((path) => readFile(join(repoRoot, path), 'utf8')),
);
const migrationNames = (await readdir(migrationsDir))
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/u.test(name))
  .sort((a, b) => a.localeCompare(b));

test('DB05 reset source count and latest version bind the current chain', () => {
  assert.equal(migrationNames.length, 93);
  assert.equal(migrationNames.at(-1)?.slice(0, 14), '20260926000077');
  assert.match(source, /const EXPECTED_MIGRATION_COUNT = 93;/u);
  assert.match(source, /const EXPECTED_LATEST_MIGRATION = '20260926000077';/u);
});

test('0072 commerce rehearsal uses its exact migration, then restores 0077 for head resets', () => {
  assert.match(source, /const COMMERCE_UPGRADE_MIGRATION = '20260729000072';/u);
  assert.match(source, /await rename\(sandboxCommerceMigration, withheldCommerceMigration\);/u);
  assert.match(source, /await rename\(withheldCommerceMigration, sandboxCommerceMigration\);/u);
  assert.match(source, /readFile\(sandboxCommerceMigration, 'utf8'\)/u);
  const commerceRehearsal = source.indexOf('run 0071 to 0072 commerce zero-admission rehearsal');
  const restoreHead = source.indexOf('await rename(withheldHeadMigration, sandboxHeadMigration);');
  const finalReset = source.indexOf("await runLocalCli('reset 1 of 2 (migrations plus seed)'");
  assert.ok(commerceRehearsal > 0 && restoreHead > commerceRehearsal && finalReset > restoreHead);
});

test('the 0067-to-0072 rehearsals withhold every later migration until its prerequisites exist', () => {
  assert.match(
    source,
    /'20260921000073,20260921000074,20260921000075,20260921000076'/u,
  );
  assert.match(source, /laterRehearsalMigrationNames\.map\(\(name\) => name\.slice\(0, 14\)\)/u);
  const withholdLater = source.indexOf('await rename(migration.installed, migration.withheld);');
  const start = source.indexOf("await runLocalCli('start isolated credential-free stack'");
  const commerceRehearsal = source.indexOf('run 0071 to 0072 commerce zero-admission rehearsal');
  const restoreLater = source.indexOf('await rename(migration.withheld, migration.installed);');
  const restoreHead = source.indexOf('await rename(withheldHeadMigration, sandboxHeadMigration);');
  assert.ok(withholdLater > 0 && withholdLater < start);
  assert.ok(restoreLater > commerceRehearsal && restoreLater < restoreHead);
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

test('0070 draft-staging evidence is derived from the exact current UTF-8 tuple', () => {
  const hashDefinition = consentStagingMigration.match(
    /create or replace function public\._health_consent_copy_staging_evidence_hash\([\s\S]*?\n\$\$;/u,
  )?.[0];
  assert.ok(hashDefinition, 'the staging hash function must exist');
  assert.match(hashDefinition, /'health-consent-draft-successor:v1'/u);
  assert.match(hashDefinition, /extensions\.digest\([\s\S]*?'sha256'/u);
  assert.match(hashDefinition, /'hex'/u);
  for (const parameter of [
    'p_consent_type',
    'p_action',
    'p_previous_version',
    'p_previous_consent_text_hash',
    'p_successor_version',
    'p_successor_consent_text_hash',
    'p_staging_change_reference',
    'p_staged_by',
  ]) {
    assert.match(
      hashDefinition,
      new RegExp(
        `pg_catalog\\.octet_length\\(\\s*pg_catalog\\.convert_to\\(${parameter}, 'UTF8'\\)\\s*\\)::text \\|\\| ':' \\|\\| ${parameter}`,
        'u',
      ),
      `${parameter} must use UTF-8 byte length and value`,
    );
  }

  const call = consentStagingMigration.match(
    /do \$\$\s*begin\s*perform \*\s*from public\.stage_health_consent_copy_draft_successor\(([\s\S]*?)\)\s*;\s*end;/u,
  )?.[1];
  assert.ok(call, 'the migration-owned Ask staging call must exist');
  const tuple = [...call.matchAll(/'([^']*)'/gu)].map((match) => match[1]);
  assert.equal(tuple.length, 9, 'the staging call must have eight fields and one digest');
  const [consentType, , previousVersion, previousHash, successorVersion, successorHash] = tuple;
  assert.equal(consentType, 'ask_layerwell');
  const serialized =
    'health-consent-draft-successor:v1' +
    tuple
      .slice(0, 8)
      .map((value) => `|${Buffer.byteLength(value, 'utf8')}:${value}`)
      .join('');
  const expected = createHash('sha256').update(serialized, 'utf8').digest('hex');
  assert.equal(tuple[8], expected, 'the migration must supply the database-derived digest');

  for (const [index, source] of consentStagingTests.entries()) {
    const literalHashes = [...source.matchAll(/'([a-f0-9]{64})'/gu)].map((match) => match[1]);
    assert.ok(literalHashes.includes(expected), 'the test must assert the staged digest');
    if (index === 1) {
      assert.ok(
        literalHashes.every((hash) => [previousHash, successorHash, expected].includes(hash)),
        'the historical 0070 upgrade fixture must not borrow another consent digest',
      );
    } else {
      assert.ok(
        literalHashes.includes('50f4ef320dd7511dced84061726410b77a9d355ee083b59431544dc9c6beecbc'),
        'the current-head registry fixture must also assert the 0074 successor digest',
      );
    }
    assert.ok(source.includes(`'${previousVersion}'`));
    assert.ok(source.includes(`'${successorVersion}'`));
  }
});
