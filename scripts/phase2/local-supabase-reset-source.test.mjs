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
  assert.equal(migrationNames.length, 97);
  assert.equal(migrationNames.at(-1)?.slice(0, 14), '20261010000081');
  assert.match(source, /const EXPECTED_MIGRATION_COUNT = 97;/u);
  assert.match(source, /const EXPECTED_LATEST_MIGRATION = '20261010000081';/u);
});

test('0072 commerce rehearsal uses its exact migration, then restores the 0081 head for resets', () => {
  assert.match(source, /const COMMERCE_UPGRADE_MIGRATION = '20260729000072';/u);
  assert.match(source, /await rename\(sandboxCommerceMigration, withheldCommerceMigration\);/u);
  assert.match(source, /await rename\(withheldCommerceMigration, sandboxCommerceMigration\);/u);
  assert.match(source, /readFile\(sandboxCommerceMigration, 'utf8'\)/u);
  const commerceRehearsal = source.indexOf('run 0071 to 0072 commerce zero-admission rehearsal');
  const restoreHead = source.indexOf('await rename(withheldHeadMigration, sandboxHeadMigration);');
  const finalReset = source.indexOf("await runLocalReset('reset 1 of 2 (migrations plus seed)'");
  assert.ok(commerceRehearsal > 0 && restoreHead > commerceRehearsal && finalReset > restoreHead);
});

test('the 0067-to-0072 rehearsals withhold every later migration until its prerequisites exist', () => {
  assert.match(
    source,
    /'20260921000073,20260921000074,20260921000075,20260921000076,20260926000077,20260926000078,20261007000079,20261008000080'/u,
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

test('every local reset uses the precise single-retry wrapper', () => {
  const resetCalls = [...source.matchAll(/await runLocalReset\(/gu)];
  assert.equal(resetCalls.length, 7);
  assert.equal(source.split("runLocalCli(label, ['db', 'reset', '--local'], {").length - 1, 1);
  assert.match(source, /retryPreMigrationContainerExit125: true/u);
  assert.match(source, /runWithSinglePreMigrationContainerRetry/u);
  assert.match(source, /transient pre-migration container exit 125; retrying once/u);
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


test('the fixed reviewed source identity rejects altered normal and override inputs before stack creation', async (t) => {
  const { cp, lstat, mkdtemp, mkdir, realpath, rename, rm, symlink, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const installedTypeScriptPath = await realpath(join(repoRoot, 'node_modules', 'typescript'));
  assert.equal(dirname(installedTypeScriptPath), await realpath(join(repoRoot, 'node_modules')));
  assert.ok((await lstat(installedTypeScriptPath)).isDirectory());
  const lock = JSON.parse(await readFile(join(repoRoot, 'package-lock.json'), 'utf8'));
  const installedTypeScript = JSON.parse(await readFile(join(installedTypeScriptPath, 'package.json'), 'utf8'));
  assert.equal(installedTypeScript.name, 'typescript');
  assert.equal(installedTypeScript.version, lock.packages['node_modules/typescript'].version);
  const cli = process.env.DB05_SUPABASE_CLI_BINARY ??
    join(repoRoot, 'node_modules', '@supabase', `cli-${process.platform}-${process.arch}`, 'bin',
      process.platform === 'win32' ? 'supabase.exe' : 'supabase');
  const middle = migrationNames[Math.floor(migrationNames.length / 2)];
  const head = migrationNames.at(-1);
  assert.match(source, /const EXPECTED_MIGRATION_SET_SHA256 =\s*'5ee03b2032781512fe2ab893e46a3f28daf68ea55ba7b800393265256898c3d6';/u);
  assert.ok(source.indexOf('await assertReviewedMigrationSource(SOURCE_SUPABASE_DIR)') <
    source.indexOf('const sandboxRoot = await mkdtemp'));
  const controls = [
    ['missing head', async (dir) => rm(join(dir, head))],
    ['extra migration', async (dir) => writeFile(join(dir, '20261010000082_unreviewed.sql'), '-- unreviewed\n')],
    ['duplicate version', async (dir) => rename(join(dir, middle), join(dir, `${migrationNames[0].slice(0, 14)}_duplicate.sql`))],
    ['renamed middle with identical count and head', async (dir) => rename(join(dir, middle), join(dir, `${middle.slice(0, 14)}_renamed.sql`))],
    ['changed middle bytes with identical count and head', async (dir) => writeFile(join(dir, middle), (await readFile(join(dir, middle), 'utf8')) + '\n')],
    ['changed proposal bytes', async (dir) => writeFile(join(dir, head), (await readFile(join(dir, head), 'utf8')) + '\n')],
    ['unexpected SQL filename', async (dir) => writeFile(join(dir, 'unversioned.sql'), '-- unreviewed\n')],
    ['unexpected directory', async (dir) => mkdir(join(dir, 'unreviewed'))],
  ];
  for (const useOverride of [false, true]) {
    for (const [label, alter] of controls) {
      await t.test(`${useOverride ? 'override' : 'normal'}: ${label}`, async () => {
        const fixture = await mkdtemp(join(tmpdir(), 'db06-acl-source-negative-'));
        try {
          const fixtureRepo = join(fixture, 'repo');
          await mkdir(join(fixtureRepo, 'scripts'), { recursive: true });
          await cp(scriptDir, join(fixtureRepo, 'scripts', 'phase2'), { recursive: true });
          await cp(join(repoRoot, 'package.json'), join(fixtureRepo, 'package.json'));
          await mkdir(join(fixtureRepo, 'node_modules'));
          const fixtureTypeScriptPath = join(fixtureRepo, 'node_modules', 'typescript');
          await symlink(installedTypeScriptPath, fixtureTypeScriptPath,
            process.platform === 'win32' ? 'junction' : 'dir');
          assert.ok((await lstat(fixtureTypeScriptPath)).isSymbolicLink());
          assert.equal(await realpath(fixtureTypeScriptPath), installedTypeScriptPath);
          const { stdout: dependencyProof } = await run(process.execPath, [
            '--input-type=module', '-e',
            "await import('./scripts/phase2/database-types-contract-lib.mjs'); console.log('DB06_ACL_R2A_FIXTURE_DEPENDENCIES_READY');",
          ], { cwd: fixtureRepo, timeout: 30_000, maxBuffer: 1024 * 1024 });
          assert.equal(dependencyProof.trim(), 'DB06_ACL_R2A_FIXTURE_DEPENDENCIES_READY');
          const fixtureSupabase = useOverride ? join(fixture, 'override', 'supabase') : join(fixtureRepo, 'supabase');
          await cp(join(repoRoot, 'supabase', 'migrations'), join(fixtureSupabase, 'migrations'), { recursive: true });
          await alter(join(fixtureSupabase, 'migrations'));
          const env = { ...process.env, DB05_SUPABASE_CLI_BINARY: cli };
          delete env.DB05_SOURCE_SUPABASE_DIR;
          if (useOverride) env.DB05_SOURCE_SUPABASE_DIR = fixtureSupabase;
          await assert.rejects(
            run(process.execPath, [join(fixtureRepo, 'scripts', 'phase2', 'local-supabase-reset.mjs'), '--verify'],
              { env, timeout: 30_000, maxBuffer: 1024 * 1024 }),
            (error) => {
              assert.equal(error.code, 1);
              assert.match(error.stderr, /DB06_ACL_R2A_SOURCE_INTEGRITY/u);
              assert.doesNotMatch(error.stdout, /\[db05-local\]/u);
              return true;
            },
          );
        } finally {
          await rm(fixture, { recursive: true, force: true });
        }
      });
    }
  }
});

test('exact installed history uses the captured CLI 2.117.0 database column and rejects corrupted histories', async (t) => {
  const { runInNewContext } = await import('node:vm');
  const { createHash } = await import('node:crypto');
  const start = source.indexOf('function assertExactMigrationHistory(');
  const end = source.indexOf('\ntry {\n  await cp(SOURCE_SUPABASE_DIR', start);
  assert.ok(start > 0 && end > start);
  assert.doesNotMatch(source, /function collectMigrationVersions\(/u);
  const versions = migrationNames.map((name) => name.slice(0, 14));
  const rawReceipts = [];
  const checkHistory = runInNewContext(
    `${source.slice(start, end)}\nassertExactMigrationHistory;`,
    { expectedVersions: versions, sanitizedTail: (value) => value,
      console: { log: () => {} }, process: { stdout: { write: (value) => rawReceipts.push(value) } } },
  );
  const capturedRaw = "{\"migrations\":[{\"local\":\"20260612000001\",\"remote\":\"20260612000001\",\"time\":\"2026-06-12 00:00:01\"},{\"local\":\"20260612000002\",\"remote\":\"20260612000002\",\"time\":\"2026-06-12 00:00:02\"},{\"local\":\"20260612000003\",\"remote\":\"20260612000003\",\"time\":\"2026-06-12 00:00:03\"},{\"local\":\"20260612000004\",\"remote\":\"20260612000004\",\"time\":\"2026-06-12 00:00:04\"},{\"local\":\"20260612000005\",\"remote\":\"20260612000005\",\"time\":\"2026-06-12 00:00:05\"},{\"local\":\"20260612000006\",\"remote\":\"20260612000006\",\"time\":\"2026-06-12 00:00:06\"},{\"local\":\"20260612000007\",\"remote\":\"20260612000007\",\"time\":\"2026-06-12 00:00:07\"},{\"local\":\"20260612000008\",\"remote\":\"20260612000008\",\"time\":\"2026-06-12 00:00:08\"},{\"local\":\"20260612000009\",\"remote\":\"20260612000009\",\"time\":\"2026-06-12 00:00:09\"},{\"local\":\"20260612000010\",\"remote\":\"20260612000010\",\"time\":\"2026-06-12 00:00:10\"},{\"local\":\"20260612000011\",\"remote\":\"20260612000011\",\"time\":\"2026-06-12 00:00:11\"},{\"local\":\"20260612000012\",\"remote\":\"20260612000012\",\"time\":\"2026-06-12 00:00:12\"},{\"local\":\"20260612000013\",\"remote\":\"20260612000013\",\"time\":\"2026-06-12 00:00:13\"},{\"local\":\"20260612000014\",\"remote\":\"20260612000014\",\"time\":\"2026-06-12 00:00:14\"},{\"local\":\"20260612000015\",\"remote\":\"20260612000015\",\"time\":\"2026-06-12 00:00:15\"},{\"local\":\"20260613000016\",\"remote\":\"20260613000016\",\"time\":\"2026-06-13 00:00:16\"},{\"local\":\"20260613000017\",\"remote\":\"20260613000017\",\"time\":\"2026-06-13 00:00:17\"},{\"local\":\"20260613000018\",\"remote\":\"20260613000018\",\"time\":\"2026-06-13 00:00:18\"},{\"local\":\"20260613000019\",\"remote\":\"20260613000019\",\"time\":\"2026-06-13 00:00:19\"},{\"local\":\"20260613000020\",\"remote\":\"20260613000020\",\"time\":\"2026-06-13 00:00:20\"},{\"local\":\"20260613000021\",\"remote\":\"20260613000021\",\"time\":\"2026-06-13 00:00:21\"},{\"local\":\"20260613000022\",\"remote\":\"20260613000022\",\"time\":\"2026-06-13 00:00:22\"},{\"local\":\"20260613000023\",\"remote\":\"20260613000023\",\"time\":\"2026-06-13 00:00:23\"},{\"local\":\"20260613000024\",\"remote\":\"20260613000024\",\"time\":\"2026-06-13 00:00:24\"},{\"local\":\"20260614000025\",\"remote\":\"20260614000025\",\"time\":\"2026-06-14 00:00:25\"},{\"local\":\"20260614000026\",\"remote\":\"20260614000026\",\"time\":\"2026-06-14 00:00:26\"},{\"local\":\"20260615000027\",\"remote\":\"20260615000027\",\"time\":\"2026-06-15 00:00:27\"},{\"local\":\"20260616000028\",\"remote\":\"20260616000028\",\"time\":\"2026-06-16 00:00:28\"},{\"local\":\"20260705000029\",\"remote\":\"20260705000029\",\"time\":\"2026-07-05 00:00:29\"},{\"local\":\"20260705000030\",\"remote\":\"20260705000030\",\"time\":\"2026-07-05 00:00:30\"},{\"local\":\"20260705000031\",\"remote\":\"20260705000031\",\"time\":\"2026-07-05 00:00:31\"},{\"local\":\"20260705000032\",\"remote\":\"20260705000032\",\"time\":\"2026-07-05 00:00:32\"},{\"local\":\"20260705000033\",\"remote\":\"20260705000033\",\"time\":\"2026-07-05 00:00:33\"},{\"local\":\"20260705000034\",\"remote\":\"20260705000034\",\"time\":\"2026-07-05 00:00:34\"},{\"local\":\"20260707000035\",\"remote\":\"20260707000035\",\"time\":\"2026-07-07 00:00:35\"},{\"local\":\"20260710000036\",\"remote\":\"20260710000036\",\"time\":\"2026-07-10 00:00:36\"},{\"local\":\"20260710000037\",\"remote\":\"20260710000037\",\"time\":\"2026-07-10 00:00:37\"},{\"local\":\"20260711000038\",\"remote\":\"20260711000038\",\"time\":\"2026-07-11 00:00:38\"},{\"local\":\"20260711000039\",\"remote\":\"20260711000039\",\"time\":\"2026-07-11 00:00:39\"},{\"local\":\"20260712000040\",\"remote\":\"20260712000040\",\"time\":\"2026-07-12 00:00:40\"},{\"local\":\"20260713000041\",\"remote\":\"20260713000041\",\"time\":\"2026-07-13 00:00:41\"},{\"local\":\"20260713000042\",\"remote\":\"20260713000042\",\"time\":\"2026-07-13 00:00:42\"},{\"local\":\"20260713000043\",\"remote\":\"20260713000043\",\"time\":\"2026-07-13 00:00:43\"},{\"local\":\"20260713000044\",\"remote\":\"20260713000044\",\"time\":\"2026-07-13 00:00:44\"},{\"local\":\"20260713000045\",\"remote\":\"20260713000045\",\"time\":\"2026-07-13 00:00:45\"},{\"local\":\"20260713000046\",\"remote\":\"20260713000046\",\"time\":\"2026-07-13 00:00:46\"},{\"local\":\"20260713000047\",\"remote\":\"20260713000047\",\"time\":\"2026-07-13 00:00:47\"},{\"local\":\"20260713000048\",\"remote\":\"20260713000048\",\"time\":\"2026-07-13 00:00:48\"},{\"local\":\"20260713000049\",\"remote\":\"20260713000049\",\"time\":\"2026-07-13 00:00:49\"},{\"local\":\"20260713000050\",\"remote\":\"20260713000050\",\"time\":\"2026-07-13 00:00:50\"},{\"local\":\"20260713000051\",\"remote\":\"20260713000051\",\"time\":\"2026-07-13 00:00:51\"},{\"local\":\"20260713000052\",\"remote\":\"20260713000052\",\"time\":\"2026-07-13 00:00:52\"},{\"local\":\"20260714000053\",\"remote\":\"20260714000053\",\"time\":\"2026-07-14 00:00:53\"},{\"local\":\"20260715000054\",\"remote\":\"20260715000054\",\"time\":\"2026-07-15 00:00:54\"},{\"local\":\"20260715000055\",\"remote\":\"20260715000055\",\"time\":\"2026-07-15 00:00:55\"},{\"local\":\"20260717000056\",\"remote\":\"20260717000056\",\"time\":\"2026-07-17 00:00:56\"},{\"local\":\"20260717000057\",\"remote\":\"20260717000057\",\"time\":\"2026-07-17 00:00:57\"},{\"local\":\"20260717000058\",\"remote\":\"20260717000058\",\"time\":\"2026-07-17 00:00:58\"},{\"local\":\"20260718000044\",\"remote\":\"20260718000044\",\"time\":\"2026-07-18 00:00:44\"},{\"local\":\"20260718000045\",\"remote\":\"20260718000045\",\"time\":\"2026-07-18 00:00:45\"},{\"local\":\"20260718000046\",\"remote\":\"20260718000046\",\"time\":\"2026-07-18 00:00:46\"},{\"local\":\"20260718000047\",\"remote\":\"20260718000047\",\"time\":\"2026-07-18 00:00:47\"},{\"local\":\"20260718000048\",\"remote\":\"20260718000048\",\"time\":\"2026-07-18 00:00:48\"},{\"local\":\"20260718000049\",\"remote\":\"20260718000049\",\"time\":\"2026-07-18 00:00:49\"},{\"local\":\"20260718000050\",\"remote\":\"20260718000050\",\"time\":\"2026-07-18 00:00:50\"},{\"local\":\"20260718000051\",\"remote\":\"20260718000051\",\"time\":\"2026-07-18 00:00:51\"},{\"local\":\"20260718000052\",\"remote\":\"20260718000052\",\"time\":\"2026-07-18 00:00:52\"},{\"local\":\"20260718000053\",\"remote\":\"20260718000053\",\"time\":\"2026-07-18 00:00:53\"},{\"local\":\"20260718000059\",\"remote\":\"20260718000059\",\"time\":\"2026-07-18 00:00:59\"},{\"local\":\"20260718000060\",\"remote\":\"20260718000060\",\"time\":\"20260718000060\"},{\"local\":\"20260722000061\",\"remote\":\"20260722000061\",\"time\":\"20260722000061\"},{\"local\":\"20260722000062\",\"remote\":\"20260722000062\",\"time\":\"20260722000062\"},{\"local\":\"20260722000063\",\"remote\":\"20260722000063\",\"time\":\"20260722000063\"},{\"local\":\"20260725000054\",\"remote\":\"20260725000054\",\"time\":\"2026-07-25 00:00:54\"},{\"local\":\"20260726000055\",\"remote\":\"20260726000055\",\"time\":\"2026-07-26 00:00:55\"},{\"local\":\"20260726000056\",\"remote\":\"20260726000056\",\"time\":\"2026-07-26 00:00:56\"},{\"local\":\"20260726000057\",\"remote\":\"20260726000057\",\"time\":\"2026-07-26 00:00:57\"},{\"local\":\"20260726000058\",\"remote\":\"20260726000058\",\"time\":\"2026-07-26 00:00:58\"},{\"local\":\"20260726000059\",\"remote\":\"20260726000059\",\"time\":\"2026-07-26 00:00:59\"},{\"local\":\"20260726000064\",\"remote\":\"20260726000064\",\"time\":\"20260726000064\"},{\"local\":\"20260726000065\",\"remote\":\"20260726000065\",\"time\":\"20260726000065\"},{\"local\":\"20260726000066\",\"remote\":\"20260726000066\",\"time\":\"20260726000066\"},{\"local\":\"20260726000067\",\"remote\":\"20260726000067\",\"time\":\"20260726000067\"}],\"message\":\"Migrations listed\"}\n";
  assert.equal(createHash('sha256').update(capturedRaw).digest('hex'), '54951043f41d655bd92bf6a4c6c5480c48f0b42a6c1df63ccd277d0176b974db');
  const captured = JSON.parse(capturedRaw);
  const predecessor = versions.filter((version) => version <= '20260726000067');
  assert.equal(captured.migrations.length, 83);
  assert.deepEqual(captured.migrations.map(({ remote }) => remote), predecessor);
  assert.doesNotThrow(() => checkHistory(capturedRaw, predecessor));
  assert.equal(rawReceipts.at(-1), capturedRaw, 'the successful CLI payload is retained without transformation');
  const rowFor = (version) => {
    const timestamp = version.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/u,
      '$1-$2-$3 $4:$5:$6');
    const date = new Date(`${timestamp.replace(' ', 'T')}Z`);
    const time = !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 19).replace('T', ' ') === timestamp ? timestamp : version;
    return { local: version, remote: version, time };
  };
  const payloadFor = (list) => ({ migrations: list.map(rowFor), message: 'Migrations listed' });
  assert.doesNotThrow(() => checkHistory(JSON.stringify(payloadFor(versions))));
  for (const head of ['20260726000067', '20260726000068', '20260726000069', '20260726000070', '20260726000071', '20260729000072']) {
    const prefix = versions.filter((version) => version <= head);
    assert.equal(prefix.at(-1), head);
    assert.doesNotThrow(() => checkHistory(JSON.stringify(payloadFor(prefix)), prefix));
  }
  const remoteOnly = structuredClone(captured);
  remoteOnly.migrations.forEach((row) => { row.local = ''; });
  assert.doesNotThrow(() => checkHistory(JSON.stringify(remoteOnly), predecessor),
    'installation is proved by the database column, including rows without local filename metadata');
  const middle = Math.floor(captured.migrations.length / 2);
  const controls = [
    ['missing installed migration', (value) => value.migrations.splice(middle, 1)],
    ['extra installed migration', (value) => value.migrations.push(rowFor('20261010000082'))],
    ['substituted installed migration', (value) => { value.migrations[middle] = rowFor('20260713000099'); }],
    ['duplicate replacing middle', (value) => { value.migrations[middle] = value.migrations[0]; }],
    ['extra duplicate', (value) => value.migrations.push(value.migrations[0])],
    ['wrong ordering', (value) => { [value.migrations[0], value.migrations[1]] = [value.migrations[1], value.migrations[0]]; }],
    ['missing remote with truthful local', (value) => { delete value.migrations[middle].remote; }],
    ['local-only entry is not installed', (value) => { value.migrations[middle].remote = ''; }],
    ['all local-only is not installed', (value) => value.migrations.forEach((row) => { row.remote = ''; })],
    ['expected version elsewhere cannot repair remote', (value) => { value.migrations[middle].remote = '20260713000099'; }],
    ['nested timestamp cannot repair remote', (value) => { value.migrations[middle].remote = { version: predecessor[middle] }; }],
    ['numeric remote', (value) => { value.migrations[middle].remote = Number(predecessor[middle]); }],
    ['invalid remote', (value) => { value.migrations[middle].remote = 'malformed'; }],
    ['short remote', (value) => { value.migrations[middle].remote = '123'; }],
    ['whitespace remote', (value) => { value.migrations[middle].remote += ' '; }],
    ['missing local', (value) => { delete value.migrations[middle].local; }],
    ['incorrect local', (value) => { value.migrations[middle].local = predecessor[0]; }],
    ['numeric local', (value) => { value.migrations[middle].local = 1; }],
    ['missing time', (value) => { delete value.migrations[middle].time; }],
    ['incorrect time', (value) => { value.migrations[middle].time = 'incorrect'; }],
    ['numeric time', (value) => { value.migrations[middle].time = 1; }],
    ['extra version field', (value) => { value.migrations[middle].version = predecessor[middle]; }],
    ['null row', (value) => { value.migrations[middle] = null; }],
    ['array row', (value) => { value.migrations[middle] = [value.migrations[middle]]; }],
    ['missing migrations', (value) => { delete value.migrations; }],
    ['non-array migrations', (value) => { value.migrations = { versions: predecessor }; }],
    ['missing message', (value) => { delete value.message; }],
    ['incorrect message', (value) => { value.message = 'incorrect'; }],
    ['extra envelope field', (value) => { value.versions = predecessor; }],
  ];
  for (const [label, alter] of controls) {
    await t.test(label, () => {
      const changed = structuredClone(captured);
      alter(changed);
      assert.throws(() => checkHistory(JSON.stringify(changed), predecessor), /Local migration history/u);
    });
  }
  for (const value of [null, [], captured.migrations, { data: captured }, predecessor, predecessor.map((version) => ({ version }))]) {
    assert.throws(() => checkHistory(JSON.stringify(value), predecessor), /Local migration history/u);
  }
  assert.throws(() => checkHistory('not JSON'), /did not return JSON/u);
  assert.throws(() => checkHistory(capturedRaw.slice(0, -5)), /did not return JSON/u);
  assert.throws(() => checkHistory(`${capturedRaw}${capturedRaw}`), /did not return JSON/u);
});

test('the local contract requires the exact eight-version withholding list through 0080', async () => {
  const contract = await readFile(join(scriptDir, 'local-supabase-contract.mjs'), 'utf8');
  const guards = [...contract.matchAll(/\/(\x2720260921000073,[^\x27]+\x27)\/u\.test\(\s*runner/gu)];
  assert.equal(guards.length, 1, 'one actual withholding-list contract guard must exist');
  const guard = new RegExp(guards[0][1], 'u');
  assert.ok(guard.test(source), 'the frozen runner satisfies the amended actual guard');
  assert.equal(guard.test(source.replace(',20261008000080', '')), false,
    'deleting 0080 must fail the actual contract guard');
  assert.equal(guard.test(source.replace('20261007000079,20261008000080', '20261008000080,20261007000079')), false,
    'reordering 0080 must fail the actual contract guard');
});

test('H01 complete SQL history is authoritative and cannot accept lossy CLI evidence', async (t) => {
  const { runInNewContext } = await import('node:vm');
  const start = source.indexOf('function assertExactMigrationHistory(');
  const end = source.indexOf('\ntry {\n  await cp(SOURCE_SUPABASE_DIR', start);
  const versions = migrationNames.map((name) => name.slice(0, 14));
  const context = { expectedVersions: versions, historyDatabase: { major: 15, port: 54122 },
    sandboxProjectId: 'owned_project', sandboxRoot: '/owned/sandbox',
    CANONICAL_POSTGRES_IMAGE: 'public.ecr.aws/supabase/postgres:15.8.1.085',
    canonicalPostgresIdentity: { id: `sha256:${'b'.repeat(64)}` },
    console: { log: () => {} }, process: { stdout: { write: () => {} } },
    sanitizedTail: (value) => value };
  const helpers = runInNewContext(`${source.slice(start, end)}\n({assertCompleteSqlHistory, assertHistoryDatabaseTarget, bindLocalHistoryEngine, COMPLETE_HISTORY_SQL});`, context);
  const validSql = (list = versions) => ({ database: 'postgres', current_user: 'postgres',
    session_user: 'postgres', server_version_num: '150008', port: '5432', read_only: 'on',
    count: list.length, versions: list });
  for (const head of ['20260726000067', '20260726000068', '20260726000069', '20260726000070', '20260726000071', '20260729000072', '20261010000081']) {
    const prefix = versions.filter((version) => version <= head);
    await t.test(`complete SQL positive through ${head}`, () =>
      assert.doesNotThrow(() => helpers.assertCompleteSqlHistory(JSON.stringify(validSql(prefix)), prefix)));
  }
  const middle = Math.floor(versions.length / 2);
  const controls = [
    ['reviewer SQL98/CLI97 hidden nonnumeric row', (v) => { v.versions.push('not_a_migration'); v.count++; }],
    ['hidden int64-overflow row', (v) => { v.versions.push('999999999999999999999999999'); v.count++; }],
    ['missing middle row', (v) => { v.versions.splice(middle, 1); v.count--; }],
    ['extra valid row', (v) => { v.versions.push('20261010000082'); v.count++; }],
    ['duplicate middle row', (v) => { v.versions[middle] = v.versions[0]; }],
    ['duplicate extra row', (v) => { v.versions.push(v.versions[0]); v.count++; }],
    ['substituted middle row', (v) => { v.versions[middle] = '20260713000099'; }],
    ['swapped ordering', (v) => { [v.versions[0], v.versions[1]] = [v.versions[1], v.versions[0]]; }],
    ['null version', (v) => { v.versions[middle] = null; }],
    ['numeric version', (v) => { v.versions[middle] = Number(v.versions[middle]); }],
    ['whitespace in version', (v) => { v.versions[middle] += ' '; }],
    ['incomplete aggregate with unchanged count', (v) => { v.versions.pop(); }],
    ['missing count', (v) => { delete v.count; }],
    ['false count', (v) => { v.count++; }],
    ['string count', (v) => { v.count = String(v.count); }],
    ['missing versions', (v) => { delete v.versions; }],
  ];
  for (const [label, alter] of controls) {
    await t.test(label, () => {
      const value = structuredClone(validSql()); alter(value);
      assert.throws(() => helpers.assertCompleteSqlHistory(JSON.stringify(value)), /H01_SQL_HISTORY/u);
    });
  }
  for (const field of ['database', 'current_user', 'session_user', 'server_version_num', 'port', 'read_only']) {
    await t.test(`reject wrong or absent SQL ${field}`, () => {
      for (const replacement of [null, 'wrong', undefined]) {
        const value = validSql(); value[field] = replacement;
        assert.throws(() => helpers.assertCompleteSqlHistory(JSON.stringify(value)), /H01_SQL_IDENTITY/u);
      }
    });
  }
  for (const raw of ['', 'null', '[]', '{}', JSON.stringify(validSql()).slice(0, -2), `${JSON.stringify(validSql())}\n${JSON.stringify(validSql())}`]) {
    assert.throws(() => helpers.assertCompleteSqlHistory(raw), /H01_SQL_(?:OUTPUT|IDENTITY)/u);
  }
  const target = { Id: 'a'.repeat(64), Name: '/supabase_db_owned_project', Image: `sha256:${'b'.repeat(64)}`,
    State: { Running: true }, Config: { Image: 'public.ecr.aws/supabase/postgres:15.8.1.085', Labels: {
      'com.supabase.cli.project': 'owned_project', 'com.docker.compose.project': 'owned_project',
      'com.supabase.cli.workdir': '/owned/sandbox' } },
    HostConfig: { PortBindings: { '5432/tcp': [{ HostIp: '', HostPort: '54122' }] } } };
  assert.doesNotThrow(() => helpers.assertHistoryDatabaseTarget(JSON.stringify([target])));
  for (const [label, alter] of [
    ['wrong container', (v) => { v.Name = '/supabase_db_other'; }],
    ['wrong project', (v) => { v.Config.Labels['com.supabase.cli.project'] = 'other'; }],
    ['wrong workdir', (v) => { v.Config.Labels['com.supabase.cli.workdir'] = '/other'; }],
    ['wrong database port', (v) => { v.HostConfig.PortBindings['5432/tcp'][0].HostPort = '54322'; }],
    ['wrong image', (v) => { v.Config.Image = 'postgres:15'; }],
    ['wrong server major', (v) => { v.Config.Image = 'public.ecr.aws/supabase/postgres:17.1'; }],
    ['missing identity', (v) => { delete v.Id; }],
    ['stopped container', (v) => { v.State.Running = false; }],
  ]) {
    await t.test(label, () => { const changed = structuredClone(target); alter(changed);
      assert.throws(() => helpers.assertHistoryDatabaseTarget(JSON.stringify([changed])), /H01_DATABASE_TARGET/u); });
  }
  for (const raw of ['', 'null', '[]', JSON.stringify([target, target])]) {
    assert.throws(() => helpers.assertHistoryDatabaseTarget(raw), /H01_DATABASE_TARGET/u);
  }
  for (const environment of [{ DOCKER_HOST: 'tcp://remote:2375' }, { DOCKER_CONTEXT: 'production' },
    { DOCKER_TLS_VERIFY: '1' }, { DOCKER_CERT_PATH: '/credentials' }]) {
    assert.throws(() => helpers.bindLocalHistoryEngine(environment, 'linux'), /H01_UNSAFE_DOCKER_TARGET/u);
  }
  for (const platform of ['linux', 'darwin', 'win32']) {
    const environment = {}; helpers.bindLocalHistoryEngine(environment, platform);
    assert.equal(environment.DOCKER_HOST, platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock');
  }
  assert.match(helpers.COMPLETE_HISTORY_SQL, /REPEATABLE READ READ ONLY/u);
  assert.match(helpers.COMPLETE_HISTORY_SQL, /json_agg\(version ORDER BY version COLLATE "C"\)/u);
  assert.doesNotMatch(helpers.COMPLETE_HISTORY_SQL, /\b(?:WHERE|LIMIT|DISTINCT)\b/iu);
  assert.equal([...source.matchAll(/await assertCompleteMigrationHistory\(/gu)].length, 8);
  assert.match(source, /'exec', '--user', 'postgres', before\.id, '\/usr\/bin\/env', '-i'/u);
  assert.match(source, /'--host=\/var\/run\/postgresql', '--port=5432', '--username=postgres', '--dbname=postgres'/u);
  assert.match(source, /timeoutMs: LOCAL_CLI_TIMEOUT_MS, maxOutputBytes: LOCAL_CLI_MAX_OUTPUT_BYTES/u);
});

test('H01 contained SQL probe failures stop before successful CLI corroboration', async (t) => {
  const { runInNewContext } = await import('node:vm');
  const start = source.indexOf('function assertExactMigrationHistory(');
  const end = source.indexOf('\ntry {\n  await cp(SOURCE_SUPABASE_DIR', start);
  class ProbeError extends Error { constructor(reason) { super(reason); this.originReason = reason; } }
  for (const reason of ['nonzero_exit', 'timeout', 'output_limit', 'aborted']) {
    await t.test(reason, async () => {
      const context = { historyDockerIdentity: { path: '/docker', sha256: 'known' },
        readFile: async () => Buffer.from('known'), sha256: () => 'known',
        sandboxRoot: '/owned/sandbox', childEnv: {}, LOCAL_CLI_TIMEOUT_MS: 900000,
        LOCAL_CLI_MAX_OUTPUT_BYTES: 8388608, INHERIT_PARENT_PROCESS_GROUP: false,
        AbortController, activeCliProcess: undefined, ContainedCommandError: ProbeError,
        runContainedCommand: async () => { throw new ProbeError(reason); } };
      const probe = runInNewContext(`${source.slice(start, end)}\nrunHistoryDocker;`, context);
      await assert.rejects(probe(['inspect', 'owned']), new RegExp(`H01_SQL_PROBE_FAILED: ${reason}`, 'u'));
      assert.equal(context.activeCliProcess, undefined, 'active-child tracking is released on failure');
    });
  }
});

// C01 exercises the real runner functions and its final success/failure path.
async function c01Fixture(overrides = {}) {
  const { runInNewContext } = await import('node:vm');
  const { mkdtemp, rm, stat } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { setTimeout: delay } = await import('node:timers/promises');
  const directory = await mkdtemp(join(tmpdir(), 'c01-cleanup-'));
  const calls = [];
  const output = [];
  const begin = source.indexOf('async function terminateActiveCliProcess() {');
  const end = source.indexOf('\nconst signalCleanup =', begin);
  assert.ok(begin > 0 && end > begin);
  const context = {
    AggregateError, Error, AbortController, Promise, delay,
    activeCliProcess: undefined, stackMayExist: true,
    sandboxRoot: directory, sandboxProjectId: 'c01-owned-fixture',
    runLocalCli: async () => { calls.push('stop'); },
    runHistoryDocker: async (args) => { calls.push(args[0]); return { stdout: '' }; },
    rm: async (...args) => { calls.push('remove'); await rm(...args); },
    sanitizedTail: (value) => String(value),
    process: { stderr: { write: (text) => output.push(text) }, stdout: { write: (text) => output.push(text) } },
    signalCleanup: { signal: undefined, dispose: () => calls.push('dispose') },
    mode: '--verify', work: async () => {}, ...overrides,
  };
  const cleanup = runInNewContext(`let cleanupPromise;\n${source.slice(begin, end)}\ncleanupSandbox;`, context);
  context.cleanupSandbox = cleanup;
  const newBoundary = source.lastIndexOf('\n} catch (error) {\n  verificationFailure = error;');
  const oldBoundary = source.lastIndexOf('\n} finally {\n  await cleanupSandbox();');
  const boundary = newBoundary >= 0 ? newBoundary : oldBoundary;
  assert.ok(boundary > end);
  const finish = runInNewContext(`(async () => { let verificationFailure; try { await work();${source.slice(boundary)}\n});`, context);
  return { cleanup, finish, context, calls, output, directory,
    exists: async () => !!(await stat(directory).catch(() => null)),
    dispose: () => rm(directory, { recursive: true, force: true }) };
}

test('C01 successful proved cleanup is idempotent and permits final PASS', async () => {
  const fixture = await c01Fixture();
  try {
    assert.equal(fixture.cleanup(), fixture.cleanup());
    await fixture.finish();
    assert.equal(await fixture.exists(), false);
    assert.equal(fixture.calls.filter((v) => v === 'stop').length, 1);
    assert.equal(fixture.calls.filter((v) => v === 'remove').length, 1);
    assert.ok(fixture.calls.includes('ps') && fixture.calls.includes('volume'));
    assert.match(fixture.output.join(''), /full local verification: PASS/u);
  } finally { await fixture.dispose(); }
});

test('C01 failed stop rejects, retains evidence and suppresses final PASS', async () => {
  const failure = new Error('C01_INJECTED_STOP_FAILURE');
  const fixture = await c01Fixture({ runLocalCli: async () => { throw failure; } });
  try {
    const promise = fixture.cleanup();
    await assert.rejects(promise, (error) => error.errors?.includes(failure));
    assert.equal(fixture.cleanup(), promise);
    await assert.rejects(fixture.finish());
    assert.equal(await fixture.exists(), true);
    assert.equal(fixture.calls.includes('remove'), false);
    assert.doesNotMatch(fixture.output.join(''), /: PASS/u);
    assert.match(fixture.output.join(''), /C01_INJECTED_STOP_FAILURE/u);
  } finally { await fixture.dispose(); }
});

test('C01 failed directory removal rejects after successful owned stack removal', async () => {
  const failure = new Error('C01_INJECTED_REMOVAL_FAILURE');
  const fixture = await c01Fixture({ rm: async () => { throw failure; } });
  try {
    await assert.rejects(fixture.finish(), (error) => error.errors?.includes(failure));
    assert.equal(await fixture.exists(), true);
    assert.doesNotMatch(fixture.output.join(''), /: PASS/u);
    assert.ok(fixture.calls.includes('ps') && fixture.calls.includes('volume'));
  } finally { await fixture.dispose(); }
});

test('C01 primary and cleanup failures retain both origins and dispose signals', async () => {
  const primary = new Error('C01_PRIMARY_VERIFICATION_FAILURE');
  const secondary = new Error('C01_SECONDARY_STOP_FAILURE');
  const fixture = await c01Fixture({ work: async () => { throw primary; }, runLocalCli: async () => { throw secondary; } });
  try {
    await assert.rejects(fixture.finish(), (error) => error.cause === primary &&
      error.errors?.[0] === primary && error.errors?.[1]?.errors?.includes(secondary));
    assert.ok(fixture.calls.includes('dispose'));
    assert.doesNotMatch(fixture.output.join(''), /: PASS/u);
  } finally { await fixture.dispose(); }
});

test('C01 primary failure remains the original error when cleanup succeeds', async () => {
  const primary = new Error('C01_PRIMARY_ONLY');
  const fixture = await c01Fixture({ work: async () => { throw primary; } });
  try {
    await assert.rejects(fixture.finish(), (error) => error === primary);
    assert.equal(await fixture.exists(), false);
    assert.doesNotMatch(fixture.output.join(''), /: PASS/u);
  } finally { await fixture.dispose(); }
});

for (const command of ['ps', 'volume']) {
  test(`C01 surviving ${command} resources or absent proof blocks cleanup`, async () => {
    const fixture = await c01Fixture({ runHistoryDocker: async (args) =>
      args[0] === command ? { stdout: 'surviving-owned-resource\n' } : { stdout: '' } });
    try {
      await assert.rejects(fixture.finish(), /C01_CLEANUP_FAILED/u);
      assert.equal(await fixture.exists(), true);
      assert.doesNotMatch(fixture.output.join(''), /: PASS/u);
    } finally { await fixture.dispose(); }
  });
}

test('C01 unknown child containment blocks stop and preserves the sandbox', async () => {
  const fixture = await c01Fixture({ activeCliProcess: { abort() {}, done: Promise.resolve({ containment: 'unconfirmed' }) } });
  try {
    await assert.rejects(fixture.finish(), /C01_CLEANUP_FAILED/u);
    assert.equal(fixture.calls.includes('stop'), false);
    assert.equal(await fixture.exists(), true);
  } finally { await fixture.dispose(); }
});

test('C01 the unchanged 35-second cleanup deadline fails closed when a child never settles', async () => {
  const durations = [];
  const fixture = await c01Fixture({
    activeCliProcess: { abort() {}, done: new Promise(() => {}) },
    delay: async (ms) => { durations.push(ms); },
  });
  try {
    await assert.rejects(fixture.finish(), /C01_CLEANUP_FAILED/u);
    assert.deepEqual(durations, [35_000]);
    assert.equal(fixture.calls.includes('stop'), false);
    assert.equal(await fixture.exists(), true);
  } finally { await fixture.dispose(); }
});

for (const origin of ['timeout', 'output-limit', 'aborted']) {
  test(`C01 actual contained ${origin} stop failure cannot produce PASS or leak a process`, async () => {
    const { runContainedCommand } = await import('./contained-command.mjs');
    const { mkdtemp, rm, readFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { setTimeout: delay } = await import('node:timers/promises');
    const dir = await mkdtemp(join(tmpdir(), 'c01-contained-'));
    const pidPath = join(dir, 'pid');
    const controller = new AbortController();
    const fixture = await c01Fixture({ runLocalCli: async () => {
      const pending = runContainedCommand({ command: process.execPath,
        args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(pidPath)},String(process.pid)); ${origin === 'output-limit' ? "process.stdout.write('x'.repeat(4096));" : ''} setInterval(()=>{},1000);`],
        cwd: repoRoot, timeoutMs: 250, maxOutputBytes: 1024, signal: controller.signal });
      if (origin === 'aborted') {
        for (let i=0; i<100 && !(await readFile(pidPath).catch(()=>null)); i+=1) await delay(5);
        controller.abort();
      }
      return await pending;
    } });
    try {
      await assert.rejects(fixture.finish(), (error) => error.errors?.some((nested) =>
        nested.originReason === origin && nested.containment === 'posix-process-group-empty'));
      const pid = Number(await readFile(pidPath, 'utf8'));
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
      assert.equal(await fixture.exists(), true);
      assert.doesNotMatch(fixture.output.join(''), /: PASS/u);
    } finally { await fixture.dispose(); await rm(dir, { recursive: true, force: true }); }
  });
}

test('C01 SIGTERM retains exit 143 on actual cleanup rejection', async () => {
  const { EventEmitter } = await import('node:events');
  const { installSignalCleanup } = await import('./local-supabase-signal-cleanup.mjs');
  const source = new EventEmitter();
  const exits = [];
  const fixture = await c01Fixture({ runLocalCli: async () => { throw new Error('signal-stop-failure'); } });
  const signal = installSignalCleanup({ cleanup: fixture.cleanup, signalSource: source,
    exit: (code) => exits.push(code), log: () => {} });
  try {
    source.emit('SIGTERM'); source.emit('SIGINT');
    await signal.pending;
    assert.deepEqual(exits, [143]);
    assert.equal(await fixture.exists(), true);
    assert.doesNotMatch(fixture.output.join(''), /: PASS/u);
  } finally { signal.dispose(); await fixture.dispose(); }
});

test('H01 identity diagnostics are allowlisted and every owner field remains mandatory', async (t) => {
  const { runInNewContext } = await import('node:vm');
  const start = source.indexOf('function assertHistoryDatabaseTarget(');
  const end = source.indexOf('\nconst COMPLETE_HISTORY_SQL', start);
  const context = { historyDatabase: { major: 15, port: 54122 },
    sandboxProjectId: 'owned_project', sandboxRoot: '/owned/sandbox',
    CANONICAL_POSTGRES_IMAGE: 'public.ecr.aws/supabase/postgres:15.8.1.085',
    canonicalPostgresIdentity: { id: `sha256:${'b'.repeat(64)}` } };
  const check = runInNewContext(`${source.slice(start, end)}\nassertHistoryDatabaseTarget;`, context);
  const target = { Id: 'a'.repeat(64), Name: '/supabase_db_owned_project', Image: `sha256:${'b'.repeat(64)}`,
    State: { Running: true }, Config: { Image: 'public.ecr.aws/supabase/postgres:15.8.1.085', Labels: {
      'com.supabase.cli.project': 'owned_project', 'com.docker.compose.project': 'owned_project',
      'com.supabase.cli.workdir': '/owned/sandbox' } },
    HostConfig: { PortBindings: { '5432/tcp': [{ HostIp: '', HostPort: '54122' }] } } };
  assert.doesNotThrow(() => check(JSON.stringify([target])));
  const controls = [
    ['containerId', (v) => { v.Id = 'a'.repeat(63); }],
    ['containerName', (v) => { v.Name = '/supabase_db_foreign'; }],
    ['running', (v) => { v.State.Running = false; }],
    ['cliProject', (v) => { delete v.Config.Labels['com.supabase.cli.project']; }],
    ['composeProject', (v) => { v.Config.Labels['com.docker.compose.project'] = 'foreign'; }],
    ['cliWorkdir', (v) => { delete v.Config.Labels['com.supabase.cli.workdir']; }],
    ['cliWorkdir', (v) => { v.Config.Labels['com.supabase.cli.workdir'] = '/owned/sandbox/../foreign'; }],
    ['imageMajor', (v) => { v.Config.Image = 'public.ecr.aws/supabase/postgres:17.8'; }],
    ['imageMajor', (v) => { v.Config.Image = 'publicXecrXaws/supabase/postgres:15X8'; }],
    ['imageDigest', (v) => { v.Image = 'sha256:invalid'; }],
    ['portBinding', (v) => { v.HostConfig.PortBindings['5432/tcp'][0].HostPort = '54123'; }],
    ['portBinding', (v) => { v.HostConfig.PortBindings['5432/tcp'].push({HostIp:'',HostPort:'54122'}); }],
    ['portBinding', (v) => { v.HostConfig.PortBindings['5432/tcp'][0].HostIp = '192.0.2.1'; }],
    ['portBinding', (v) => { delete v.HostConfig; }],
  ];
  for (const [field, alter] of controls) await t.test(`reject ${field}`, () => {
    const v=structuredClone(target); alter(v);
    assert.throws(() => check(JSON.stringify([v])), (error) => {
      assert.match(error.message, /H01_DATABASE_TARGET/u);
      const diagnostic=JSON.parse(error.message.slice(error.message.indexOf('{')));
      assert.equal(diagnostic.checks[field], false);
      assert.equal(diagnostic.observed.workdirLabelPresent, Object.hasOwn(v.Config.Labels, 'com.supabase.cli.workdir'));
      assert.ok(Object.values(diagnostic.checks).every(value => typeof value === 'boolean'));
      assert.equal(JSON.stringify(diagnostic).includes('/owned/sandbox'), false);
      return true;
    });
  });
  for (const raw of ['', 'null', '{}', '[]', JSON.stringify([target,target]), JSON.stringify([target]).slice(0,-2)]) {
    assert.throws(() => check(raw), /H01_DATABASE_TARGET/u);
  }
  const secret='SENSITIVE_SENTINEL_DO_NOT_LOG';
  const contaminated=structuredClone(target);
  contaminated.Name=secret; contaminated.Config.Image=secret;
  contaminated.Config.Labels['com.supabase.cli.workdir']=secret;
  contaminated.Config.Env=[secret]; contaminated.Mounts=[{Source:secret}];
  assert.throws(() => check(JSON.stringify([contaminated])), error => {
    assert.doesNotMatch(error.message, /SENSITIVE_SENTINEL_DO_NOT_LOG/u);
    assert.match(error.message, /"cliWorkdir":false/u);
    return true;
  });
  context.historyDatabase=undefined;
  assert.throws(() => check(JSON.stringify([target])), /H01_DATABASE_TARGET/u);
});

test('H01 SQL observation rejects swapped immutable IDs and image digests before CLI acceptance', async (t) => {
  const { runInNewContext } = await import('node:vm');
  const start=source.indexOf('async function assertCompleteMigrationHistory(');
  const end=source.indexOf('\nlet verificationFailure;',start);
  for (const field of ['id','image','workdir','port','project','major']) await t.test(field, async () => {
    const before={id:'a'.repeat(64),image:`sha256:${'b'.repeat(64)}`,workdir:'/owned',port:54122,project:'owned'};
    const after={...before,[field]:'foreign'};
    const observations=[before,after]; const calls=[];
    const context={sandboxProjectId:'owned',COMPLETE_HISTORY_SQL:'read-only fixture',
      runHistoryDocker:async args=>{calls.push(args);return {stdout:'{}'};},
      assertHistoryDatabaseTarget:()=>observations.shift(), assertCompleteSqlHistory:()=>{},
      assertExactMigrationHistory:()=>{throw new Error('CLI_MUST_NOT_ACCEPT');},
      console:{log:()=>{}},process:{stdout:{write:()=>{}}}};
    const check=runInNewContext(`${source.slice(start,end)}\nassertCompleteMigrationHistory;`,context);
    await assert.rejects(check('{}',[]), /H01_DATABASE_TARGET: database container changed/u);
    assert.equal(calls[1][0],'exec'); assert.equal(calls[1][3],before.id);
  });
});

test('H01 diagnostic has a fixed bounded schema even for long sensitive inspect and expected values', async () => {
  const { runInNewContext } = await import('node:vm');
  const start = source.indexOf('function assertHistoryDatabaseTarget(');
  const end = source.indexOf('\nconst COMPLETE_HISTORY_SQL', start);
  const sentinel = 'SENSITIVE_SENTINEL_DO_NOT_LOG';
  const long = sentinel.repeat(40_000);
  const context = { historyDatabase: { major: 15, port: 54122 },
    sandboxProjectId: long, sandboxRoot: long,
    process: { version: long, platform: long } };
  const check = runInNewContext(`${source.slice(start, end)}\nassertHistoryDatabaseTarget;`, context);
  const target = { Id: long, Name: long, Image: long, State: { Running: false },
    Config: { Image: long, Labels: { 'com.supabase.cli.project': long,
      'com.docker.compose.project': long, 'com.supabase.cli.workdir': long, arbitrary: long }, Env: [long] },
    HostConfig: { PortBindings: { '5432/tcp': [{ HostIp: long, HostPort: long }] } },
    Mounts: [{ Source: long }] };
  assert.throws(() => check(JSON.stringify([target])), error => {
    assert.match(error.message, /^H01_DATABASE_TARGET:/u);
    assert.doesNotMatch(error.message, /SENSITIVE_SENTINEL_DO_NOT_LOG/u);
    assert.ok(error.message.length < 1500);
    const data = JSON.parse(error.message.slice(error.message.indexOf('{')));
    assert.deepEqual(Object.keys(data).sort(), ['checks', 'observed', 'runtime', 'schema']);
    assert.ok(Object.values(data.checks).every(v => typeof v === 'boolean'));
    assert.ok(Object.values(data.observed).every(v => typeof v === 'boolean'));
    assert.equal(data.runtime.node, null);
    assert.equal(data.runtime.platform, null);
    assert.equal(data.runtime.cli, '2.117.0');
    return true;
  });
  for (const raw of [sentinel, `[${long}`, JSON.stringify([null]), JSON.stringify([{}])]) {
    assert.throws(() => check(raw), error => {
      assert.match(error.message, /H01_DATABASE_TARGET/u);
      assert.doesNotMatch(error.message, /SENSITIVE_SENTINEL_DO_NOT_LOG/u);
      return true;
    });
  }
});

test('successful pgTAP commands never echo summary suffixes or arbitrary output', async () => {
  const { runInNewContext } = await import('node:vm');
  const start = source.indexOf('async function runLocalCli(');
  const end = source.indexOf('\nasync function runLocalReset(', start);
  const sentinel = 'SENSITIVE_SENTINEL_DO_NOT_LOG';
  for (const stdout of [`Files=20, Tests=2015 ${sentinel}\n`, `Files=20, Tests=2015, ${sentinel.repeat(40_000)}\n`,
    'Files=999999999999999999999999, Tests=999999999999999999999999\n']) {
    const logs = [];
    const context = { LOCAL_CLI_TIMEOUT_MS: 900000, LOCAL_CLI_MAX_OUTPUT_BYTES: 8388608,
      CLI_COMMAND: '/owned/node', CLI_ARGUMENT_PREFIX: [], sandboxRoot: '/owned/sandbox',
      childEnv: {}, INHERIT_PARENT_PROCESS_GROUP: false, AbortController,
      assertLocalOnlyInvocation: () => {}, activeCliProcess: undefined,
      runContainedCommand: async () => ({ stdout, stderr: sentinel }),
      process: { stdout: { write: text => logs.push(text) } } };
    const run = runInNewContext(`${source.slice(start, end)}\nrunLocalCli;`, context);
    const result = await run('fixed-test-label', ['test', 'db', '--local'], { quiet: true });
    assert.equal(result.output, stdout);
    assert.doesNotMatch(logs.join(''), /SENSITIVE_SENTINEL_DO_NOT_LOG|Files=|Tests=/u);
    assert.equal(context.activeCliProcess, undefined);
  }
});

test('H01 changed Docker executable bytes reject before any command can run', async () => {
  const { runInNewContext } = await import('node:vm');
  const start = source.indexOf('async function runHistoryDocker(');
  const end = source.indexOf('\nfunction assertHistoryDatabaseTarget(', start);
  let spawned = false;
  const context = { historyDockerIdentity: { path: '/owned/docker', sha256: 'original' },
    readFile: async () => Buffer.from('swapped'), sha256: () => 'swapped',
    runContainedCommand: async () => { spawned = true; } };
  const run = runInNewContext(`${source.slice(start, end)}\nrunHistoryDocker;`, context);
  await assert.rejects(run(['inspect', 'owned']), /H01_DOCKER_EXECUTABLE: Docker bytes changed/u);
  assert.equal(spawned, false);
});

test('H01 producer scrubs inherited registry overrides and secrets while preserving non-DB fallback', async () => {
  const { runInNewContext } = await import('node:vm');
  const start = source.indexOf('const childEnv = { ...process.env };');
  const end = source.indexOf('\nconst sourcePackage =', start);
  assert.ok(start >= 0 && end > start);
  for (const inherited of [
    { PATH: '/owned/bin' },
    { PATH: '/owned/bin', SUPABASE_INTERNAL_IMAGE_REGISTRY: 'ghcr.io',
      SUPABASE_USE_SLIM_IMAGES: 'true', SUPABASE_ACCESS_TOKEN: 'SENSITIVE_SENTINEL_DO_NOT_LOG',
      DATABASE_URL: 'SENSITIVE_SENTINEL_DO_NOT_LOG', PGPASSWORD: 'SENSITIVE_SENTINEL_DO_NOT_LOG',
      SB_PROJECT_REF: 'SENSITIVE_SENTINEL_DO_NOT_LOG' },
    { PATH: '/owned/bin', SUPABASE_INTERNAL_IMAGE_REGISTRY: 'https://foreign.invalid',
      supabase_internal_image_registry: 'docker.io', SUPABASE_USE_SLIM_IMAGES: '1' },
  ]) {
    const original = { ...inherited };
    const env = runInNewContext(`${source.slice(start, end)}\nchildEnv;`, {
      process: { env: inherited },
    });
    assert.equal(env.SUPABASE_INTERNAL_IMAGE_REGISTRY, undefined);
    assert.equal(env.PATH, '/owned/bin');
    assert.equal(env.DO_NOT_TRACK, '1');
    assert.equal(env.SUPABASE_TELEMETRY_DISABLED, '1');
    assert.deepEqual(Object.keys(env).sort(), [
      'DO_NOT_TRACK', 'PATH', 'SUPABASE_TELEMETRY_DISABLED',
    ]);
    assert.deepEqual(inherited, original);
    assert.doesNotMatch(JSON.stringify(env), /SENSITIVE_SENTINEL_DO_NOT_LOG|ghcr|foreign|docker\.io/u);
  }
});

test('H01 canonical PostgreSQL preparation precedes startup without constraining non-DB registries', () => {
  const prepare = source.indexOf('await prepareCanonicalPostgresImage();');
  const start = source.indexOf("await runLocalCli('start isolated credential-free stack'");
  assert.ok(prepare > 0 && prepare < start);
  assert.doesNotMatch(source, /childEnv\.SUPABASE_INTERNAL_IMAGE_REGISTRY\s*=/u);
  assert.match(source, /const CANONICAL_POSTGRES_IMAGE = 'public\.ecr\.aws\/supabase\/postgres:15\.8\.1\.085';/u);
});

async function canonicalImageFixture(overrides = {}) {
  const { runInNewContext } = await import('node:vm');
  const start = source.indexOf('async function prepareCanonicalPostgresImage(');
  const end = source.indexOf('\nfunction assertHistoryDatabaseTarget(', start);
  assert.ok(start > 0 && end > start);
  const image = 'public.ecr.aws/supabase/postgres:15.8.1.085';
  const digest = `sha256:${'d'.repeat(64)}`;
  const inspected = { Id: `sha256:${'b'.repeat(64)}`, Os: 'linux', Architecture: 'amd64',
    RepoTags: [image], RepoDigests: [`public.ecr.aws/supabase/postgres@${digest}`] };
  const calls = [];
  const logs = [];
  const context = { process: { arch: 'x64' }, historyDatabase: { major: 15 },
    CANONICAL_POSTGRES_IMAGE: image, canonicalPostgresIdentity: undefined,
    runHistoryDocker: async args => {
      calls.push(Array.from(args));
      return args[0] === 'pull' ? { stdout: `Digest: ${digest}\n`, stderr: '' }
        : { stdout: JSON.stringify([inspected]) };
    }, console: { log: text => logs.push(text) }, ...overrides };
  const prepare = runInNewContext(`${source.slice(start, end)}\nprepareCanonicalPostgresImage;`, context);
  return { prepare, context, calls, logs, image, digest, inspected };
}

test('H01 canonical preparation uses a bounded Docker pull of only the ECR PG image and binds its immutable identity', async () => {
  const fixture = await canonicalImageFixture();
  await fixture.prepare();
  assert.deepEqual(fixture.calls, [
    ['pull', '--platform', 'linux/amd64', fixture.image],
    ['image', 'inspect', fixture.image],
  ]);
  assert.equal(fixture.context.canonicalPostgresIdentity.id, fixture.inspected.Id);
  assert.equal(fixture.context.canonicalPostgresIdentity.digest, fixture.digest);
  assert.doesNotMatch(fixture.logs.join(''), /SENSITIVE_SENTINEL/u);
});

test('H01 canonical preparation rejects unsupported major or architecture before a pull', async () => {
  for (const overrides of [{ historyDatabase: { major: 17 } }, { process: { arch: 'unknown' } }]) {
    const fixture = await canonicalImageFixture(overrides);
    await assert.rejects(fixture.prepare(), /H01_CANONICAL_POSTGRES/u);
    assert.equal(fixture.calls.length, 0);
  }
});

test('H01 canonical preparation explicitly pulls the native arm64 platform', async () => {
  const fixture = await canonicalImageFixture({ process: { arch: 'arm64' } });
  fixture.inspected.Architecture = 'arm64';
  await fixture.prepare();
  assert.equal(fixture.calls[0][2], 'linux/arm64');
});

test('H01 unavailable canonical ECR PostgreSQL never falls back or continues', async () => {
  for (const reason of ['429', 'auth', 'network', 'cancelled', 'timeout', 'output-limit']) {
    let calls = 0;
    const failure = new Error(reason);
    const fixture = await canonicalImageFixture({ runHistoryDocker: async () => { calls++; throw failure; } });
    await assert.rejects(fixture.prepare(), error => error === failure);
    assert.equal(calls, 1);
    assert.equal(fixture.context.canonicalPostgresIdentity, undefined);
  }
});

test('H01 canonical image admission rejects malformed, foreign, mismatched-digest and wrong-platform responses without disclosure', async () => {
  const controls = [
    () => 'SENSITIVE_SENTINEL', () => '{}', () => '[]',
    row => JSON.stringify([row, row]),
    row => JSON.stringify([{ ...row, Id: 'SENSITIVE_SENTINEL' }]),
    row => JSON.stringify([{ ...row, Os: 'windows' }]),
    row => JSON.stringify([{ ...row, Architecture: 'arm64' }]),
    row => JSON.stringify([{ ...row, RepoTags: ['ghcr.io/supabase/postgres:15.8.1.085'] }]),
    row => JSON.stringify([{ ...row, RepoDigests: [`ghcr.io/supabase/postgres@sha256:${'d'.repeat(64)}`] }]),
    row => JSON.stringify([{ ...row, RepoDigests: [`public.ecr.aws/supabase/postgres@sha256:${'e'.repeat(64)}`] }]),
    row => JSON.stringify([{ ...row, RepoDigests: null }]),
  ];
  for (const mutate of controls) {
    const fixture = await canonicalImageFixture();
    fixture.context.runHistoryDocker = async args => args[0] === 'pull'
      ? { stdout: `Digest: ${fixture.digest}\n`, stderr: '' }
      : { stdout: mutate(fixture.inspected) };
    await assert.rejects(fixture.prepare(), error =>
      /H01_CANONICAL_POSTGRES/u.test(error.message) && !/SENSITIVE_SENTINEL|ghcr/u.test(error.message));
    assert.equal(fixture.context.canonicalPostgresIdentity, undefined);
  }
  for (const stdout of ['', 'Digest: SENSITIVE_SENTINEL\n', `Digest: sha256:${'d'.repeat(64)}\nDigest: sha256:${'e'.repeat(64)}\n`]) {
    const fixture = await canonicalImageFixture({ runHistoryDocker: async () => ({ stdout, stderr: '' }) });
    await assert.rejects(fixture.prepare(), /H01_CANONICAL_POSTGRES/u);
    assert.equal(fixture.context.canonicalPostgresIdentity, undefined);
  }
});

test('H01 rejects an ECR-named foreign or stale image and missing preparation before SQL', async () => {
  const { runInNewContext } = await import('node:vm');
  const start = source.indexOf('function assertHistoryDatabaseTarget(');
  const end = source.indexOf('\nconst COMPLETE_HISTORY_SQL', start);
  const image = 'public.ecr.aws/supabase/postgres:15.8.1.085';
  const context = { historyDatabase: { major: 15, port: 54122 },
    sandboxProjectId: 'owned_project', sandboxRoot: '/owned/sandbox',
    CANONICAL_POSTGRES_IMAGE: image, canonicalPostgresIdentity: { id: `sha256:${'b'.repeat(64)}` } };
  const check = runInNewContext(`${source.slice(start, end)}\nassertHistoryDatabaseTarget;`, context);
  const target = { Id: 'a'.repeat(64), Name: '/supabase_db_owned_project', Image: `sha256:${'b'.repeat(64)}`,
    State: { Running: true }, Config: { Image: image, Labels: {
      'com.supabase.cli.project': 'owned_project', 'com.docker.compose.project': 'owned_project',
      'com.supabase.cli.workdir': '/owned/sandbox' } },
    HostConfig: { PortBindings: { '5432/tcp': [{ HostIp: '', HostPort: '54122' }] } } };
  assert.doesNotThrow(() => check(JSON.stringify([target])));
  for (const change of [v => { v.Image = `sha256:${'c'.repeat(64)}`; },
    v => { v.Config.Image = 'public.ecr.aws/supabase/postgres:15.8.1.084'; },
    () => { context.canonicalPostgresIdentity = undefined; }]) {
    const changed = structuredClone(target); change(changed);
    assert.throws(() => check(JSON.stringify([changed])), /H01_DATABASE_TARGET: database differs from the canonical pulled image/u);
  }
});
