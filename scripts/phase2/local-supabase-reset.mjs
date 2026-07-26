#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { installSignalCleanup } from './local-supabase-signal-cleanup.mjs';
import { assertLocalOnlyInvocation } from './local-supabase-target-guard.mjs';
import {
  ContainedCommandError,
  runContainedCommand,
  sanitizeBoundedCommandDiagnostic,
} from './contained-command.mjs';
import { reportsPinnedEmptySchemaDiff } from './schema-diff-evidence.mjs';

const PINNED_CLI_VERSION = '2.109.1';
const EXPECTED_MIGRATION_COUNT = 66;
const EXPECTED_LATEST_MIGRATION = '20260726000067';
const LOCAL_CLI_TIMEOUT_MS = 15 * 60_000;
// CAT-03 proves the exact 2,001-reviewed / 2,000-eligible launch corpus and
// recomputes every sealed membership root. Keep ordinary CLI operations tightly
// bounded while allowing that intentionally exhaustive structural suite to run.
const STRUCTURAL_TEST_TIMEOUT_MS = 60 * 60_000;
const LOCAL_CLI_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const STRUCTURAL_TEST_DIAGNOSTIC_MAX_BYTES = 256 * 1024;
const STRUCTURAL_TEST_DIAGNOSTIC_MAX_LINES = 4_000;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const sourceSupabaseOverride = process.env.DB05_SOURCE_SUPABASE_DIR?.trim();
if (sourceSupabaseOverride && !isAbsolute(sourceSupabaseOverride)) {
  throw new Error('DB05_SOURCE_SUPABASE_DIR must be an absolute path when provided.');
}
const SOURCE_SUPABASE_DIR = sourceSupabaseOverride
  ? resolve(sourceSupabaseOverride)
  : join(REPO_ROOT, 'supabase');
if (sourceSupabaseOverride) {
  const sourceMetadata = await lstat(SOURCE_SUPABASE_DIR).catch(() => null);
  const canonicalSource = await realpath(SOURCE_SUPABASE_DIR).catch(() => null);
  if (
    !sourceMetadata?.isDirectory() ||
    sourceMetadata.isSymbolicLink() ||
    !canonicalSource ||
    basename(canonicalSource).toLowerCase() !== 'supabase'
  ) {
    throw new Error('DB05_SOURCE_SUPABASE_DIR must resolve to a regular supabase directory.');
  }
}
const cliBinaryOverride = process.env.DB05_SUPABASE_CLI_BINARY?.trim();
const inheritParentProcessGroupValue = process.env.DB05_INHERIT_PARENT_PROCESS_GROUP?.trim() ?? '';
if (!['', '1'].includes(inheritParentProcessGroupValue)) {
  throw new Error('DB05_INHERIT_PARENT_PROCESS_GROUP is invalid.');
}
const INHERIT_PARENT_PROCESS_GROUP = inheritParentProcessGroupValue === '1';
if (cliBinaryOverride && !isAbsolute(cliBinaryOverride)) {
  throw new Error('DB05_SUPABASE_CLI_BINARY must be an absolute path when provided.');
}
let CLI_COMMAND = process.execPath;
let CLI_ARGUMENT_PREFIX = [join(REPO_ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js')];
const mode = process.argv[2] ?? '--verify';

if (!['--reset-only', '--verify'].includes(mode) || process.argv.length > 3) {
  throw new Error('Usage: node scripts/phase2/local-supabase-reset.mjs [--reset-only|--verify]');
}

const childEnv = { ...process.env };
const sensitiveEnvironmentName =
  /(?:^|_)(?:ACCESS_TOKEN|ANON_KEY|CLIENT_SECRET|DATABASE_URL|DB_PASSWORD|DIRECT_URL|PASSWORD|POSTGRES_URL|PRIVATE_KEY|PROJECT_REF|PUBLISHABLE_KEY|SECRET|SECRET_KEY|SERVICE_ROLE_KEY|TOKEN)(?:$|_)/u;
for (const name of Object.keys(childEnv)) {
  const normalizedName = name.toUpperCase();
  if (
    normalizedName.includes('SUPABASE') ||
    normalizedName.startsWith('SB_') ||
    sensitiveEnvironmentName.test(normalizedName) ||
    /^(?:PGDATABASE|PGHOST|PGPASSFILE|PGPASSWORD|PGPORT|PGSERVICE|PGSERVICEFILE|PGUSER)$/u.test(
      normalizedName,
    )
  ) {
    delete childEnv[name];
  }
}
childEnv.DO_NOT_TRACK = '1';
childEnv.SUPABASE_TELEMETRY_DISABLED = '1';

const sourcePackage = JSON.parse(await readFile(join(REPO_ROOT, 'package.json'), 'utf8'));
if (sourcePackage.devDependencies?.supabase !== PINNED_CLI_VERSION) {
  throw new Error(`package.json must pin supabase exactly to ${PINNED_CLI_VERSION}.`);
}
let installedPackage;
if (cliBinaryOverride) {
  const binaryMetadata = await lstat(cliBinaryOverride).catch(() => null);
  const canonicalBinary = await realpath(cliBinaryOverride).catch(() => null);
  if (
    !binaryMetadata?.isFile() ||
    binaryMetadata.isSymbolicLink() ||
    !canonicalBinary ||
    !['supabase', 'supabase.exe'].includes(basename(canonicalBinary).toLowerCase())
  ) {
    throw new Error('DB05_SUPABASE_CLI_BINARY must resolve to a regular Supabase CLI binary.');
  }
  const binaryPackageRoot = resolve(dirname(canonicalBinary), '..');
  installedPackage = JSON.parse(await readFile(join(binaryPackageRoot, 'package.json'), 'utf8'));
  if (!/^@supabase\/cli-[a-z0-9-]+$/u.test(String(installedPackage.name ?? ''))) {
    throw new Error('DB05_SUPABASE_CLI_BINARY package identity is invalid.');
  }
  CLI_COMMAND = canonicalBinary;
  CLI_ARGUMENT_PREFIX = [];
} else {
  installedPackage = JSON.parse(
    await readFile(join(REPO_ROOT, 'node_modules', 'supabase', 'package.json'), 'utf8'),
  );
}
if (installedPackage.version !== PINNED_CLI_VERSION) {
  throw new Error(
    `Installed Supabase CLI ${installedPackage.version ?? 'unknown'} does not match ${PINNED_CLI_VERSION}. Run npm ci.`,
  );
}

const migrationFiles = (await readdir(join(SOURCE_SUPABASE_DIR, 'migrations')))
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/u.test(name))
  .sort((a, b) => a.localeCompare(b));
const expectedVersions = migrationFiles.map((name) => name.slice(0, 14));
if (
  migrationFiles.length !== EXPECTED_MIGRATION_COUNT ||
  expectedVersions.at(-1) !== EXPECTED_LATEST_MIGRATION ||
  new Set(expectedVersions).size !== expectedVersions.length
) {
  throw new Error(
    `Expected ${EXPECTED_MIGRATION_COUNT} unique migrations through ${EXPECTED_LATEST_MIGRATION}; found ${migrationFiles.length} through ${expectedVersions.at(-1) ?? 'none'}.`,
  );
}

const sandboxRoot = await mkdtemp(join(tmpdir(), 'routinekind-db05-local-'));
const sandboxSupabaseDir = join(sandboxRoot, 'supabase');
const sandboxProjectId = `routinekind_db05_${randomBytes(8).toString('hex')}`;
let stackMayExist = false;
let activeCliProcess;
let cleanupPromise;

function isExcludedSourcePath(sourcePath) {
  const rel = relative(SOURCE_SUPABASE_DIR, sourcePath);
  if (!rel || rel === '.') return false;
  return rel
    .split(sep)
    .some(
      (segment) =>
        segment === '.branches' ||
        segment === '.temp' ||
        segment === '.env' ||
        segment.startsWith('.env.'),
    );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function setTomlValue(source, section, key, literal) {
  const header = `[${section}]`;
  const headerIndex = source.indexOf(header);
  if (headerIndex < 0) return `${source.trimEnd()}\n\n${header}\n${key} = ${literal}\n`;

  const bodyStart = source.indexOf('\n', headerIndex) + 1;
  const nextHeader = source.indexOf('\n[', bodyStart);
  const bodyEnd = nextHeader < 0 ? source.length : nextHeader + 1;
  const body = source.slice(bodyStart, bodyEnd);
  const keyPattern = new RegExp(`(^|\\n)${escapeRegExp(key)}\\s*=\\s*[^\\r\\n]*`, 'u');
  if (keyPattern.test(body)) {
    const updatedBody = body.replace(keyPattern, `$1${key} = ${literal}`);
    return `${source.slice(0, bodyStart)}${updatedBody}${source.slice(bodyEnd)}`;
  }
  return `${source.slice(0, bodyStart)}${key} = ${literal}\n${source.slice(bodyStart)}`;
}

async function isPortAvailable(port) {
  return await new Promise((resolvePort) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolvePort(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close(() => resolvePort(true));
    });
  });
}

async function allocatePortBlock() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const base = 55000 + (randomBytes(2).readUInt16BE(0) % 7000);
    const ports = Array.from({ length: 10 }, (_, index) => base + index);
    if (ports.at(-1) > 65535) continue;
    if ((await Promise.all(ports.map(isPortAvailable))).every(Boolean)) return ports;
  }
  throw new Error('Could not reserve an available local-only port block for the Supabase sandbox.');
}

function sanitizedTail(value) {
  return sanitizeBoundedCommandDiagnostic({ stderr: value });
}

async function runLocalCli(
  label,
  args,
  {
    quiet = false,
    timeoutMs = LOCAL_CLI_TIMEOUT_MS,
    maxOutputBytes = LOCAL_CLI_MAX_OUTPUT_BYTES,
    failureDiagnosticProfile = 'tail',
    failureDiagnosticMaxBytes,
    failureDiagnosticMaxLines,
  } = {},
) {
  assertLocalOnlyInvocation(label, args);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes <= 0
  ) {
    throw new Error('Local Supabase CLI bounds are invalid.');
  }

  if (!quiet) process.stdout.write(`[db05-local] ${label}...\n`);
  const controller = new AbortController();
  const done = runContainedCommand({
    command: CLI_COMMAND,
    args: [...CLI_ARGUMENT_PREFIX, ...args, '--workdir', sandboxRoot, '--yes'],
    cwd: sandboxRoot,
    environment: childEnv,
    timeoutMs,
    maxOutputBytes,
    signal: controller.signal,
    inheritParentProcessGroup: INHERIT_PARENT_PROCESS_GROUP,
    retainSanitizedFailureDiagnostic: true,
    failureDiagnosticProfile,
    ...(failureDiagnosticMaxBytes === undefined ? {} : { failureDiagnosticMaxBytes }),
    ...(failureDiagnosticMaxLines === undefined ? {} : { failureDiagnosticMaxLines }),
  });
  activeCliProcess = { abort: () => controller.abort(), done };
  let result;
  try {
    result = await done;
  } catch (error) {
    if (error instanceof ContainedCommandError) {
      const diagnostic = error.diagnostic
        ? `\nSanitized CLI output tail:\n${error.diagnostic}`
        : '';
      throw new Error(`Local Supabase CLI ${error.originReason}.${diagnostic}`);
    }
    throw error;
  } finally {
    if (activeCliProcess?.done === done) activeCliProcess = undefined;
  }
  const output = result.stdout;
  const errors = result.stderr;
  if (!quiet) process.stdout.write(`[db05-local] ${label}: PASS\n`);
  return { output, errors };
}

async function terminateActiveCliProcess() {
  const active = activeCliProcess;
  if (!active) return;
  active.abort();
  await Promise.race([active.done.catch(() => {}), delay(35_000)]);
}

function cleanupSandbox() {
  cleanupPromise ??= (async () => {
    await terminateActiveCliProcess();
    if (stackMayExist) {
      await runLocalCli('remove isolated stack and volumes', ['stop', '--no-backup'], {
        quiet: true,
      }).catch((error) =>
        process.stderr.write(`${sanitizedTail(error instanceof Error ? error.message : error)}\n`),
      );
    }
    await rm(sandboxRoot, { recursive: true, force: true });
  })();
  return cleanupPromise;
}

const signalCleanup = installSignalCleanup({ cleanup: cleanupSandbox });

function collectMigrationVersions(value, target = []) {
  if (typeof value === 'string') {
    if (/^\d{14}$/u.test(value)) target.push(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) collectMigrationVersions(entry, target);
  } else if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectMigrationVersions(entry, target);
  }
  return target;
}

function assertExactMigrationHistory(rawOutput) {
  let parsed;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    throw new Error(`Supabase migration history did not return JSON.\n${sanitizedTail(rawOutput)}`);
  }
  const actual = [...new Set(collectMigrationVersions(parsed))].sort((a, b) => a.localeCompare(b));
  if (
    actual.length !== expectedVersions.length ||
    actual.some((value, index) => value !== expectedVersions[index])
  ) {
    throw new Error(
      `Local migration history mismatch: expected ${expectedVersions.length} through ${EXPECTED_LATEST_MIGRATION}; found ${actual.length} through ${actual.at(-1) ?? 'none'}.`,
    );
  }
}

try {
  await cp(SOURCE_SUPABASE_DIR, sandboxSupabaseDir, {
    recursive: true,
    filter: (sourcePath) => !isExcludedSourcePath(sourcePath),
  });

  const ports = await allocatePortBlock();
  const configPath = join(sandboxSupabaseDir, 'config.toml');
  let config = await readFile(configPath, 'utf8');
  config = config.replace(/^project_id\s*=\s*"[^"]*"/mu, `project_id = "${sandboxProjectId}"`);
  config = setTomlValue(config, 'db', 'shadow_port', String(ports[0]));
  config = setTomlValue(config, 'api', 'port', String(ports[1]));
  config = setTomlValue(config, 'db', 'port', String(ports[2]));
  config = setTomlValue(config, 'studio', 'port', String(ports[3]));
  config = setTomlValue(config, 'inbucket', 'enabled', 'true');
  config = setTomlValue(config, 'inbucket', 'port', String(ports[4]));
  config = setTomlValue(config, 'inbucket', 'smtp_port', String(ports[5]));
  config = setTomlValue(config, 'inbucket', 'pop3_port', String(ports[6]));
  config = setTomlValue(config, 'db.pooler', 'enabled', 'false');
  config = setTomlValue(config, 'analytics', 'enabled', 'true');
  config = setTomlValue(config, 'analytics', 'port', String(ports[7]));
  config = setTomlValue(config, 'analytics', 'vector_port', String(ports[8]));
  config = setTomlValue(config, 'analytics', 'backend', '"postgres"');
  config = setTomlValue(config, 'edge_runtime', 'enabled', 'true');
  config = setTomlValue(config, 'edge_runtime', 'inspector_port', String(ports[9]));
  config = setTomlValue(config, 'auth.external.apple', 'enabled', 'false');
  config = setTomlValue(config, 'auth.external.google', 'enabled', 'false');
  config = setTomlValue(config, 'auth.captcha', 'enabled', 'false');
  await writeFile(configPath, config, 'utf8');

  await stat(join(sandboxSupabaseDir, 'seed.sql'));
  await stat(join(sandboxSupabaseDir, 'tests', 'database', 'schema_contract.test.sql'));

  stackMayExist = true;
  await runLocalCli('start isolated credential-free stack', ['start']);
  await runLocalCli('reset 1 of 2 (migrations plus seed)', ['db', 'reset', '--local']);

  if (mode === '--verify') {
    await runLocalCli('reset 2 of 2 (repeatability)', ['db', 'reset', '--local']);

    const history = await runLocalCli(
      'read exact local migration history',
      ['migration', 'list', '--local', '--output-format', 'json'],
      { quiet: true },
    );
    assertExactMigrationHistory(history.output);
    process.stdout.write(
      `[db05-local] migration history: PASS (${EXPECTED_MIGRATION_COUNT}, latest ${EXPECTED_LATEST_MIGRATION})\n`,
    );

    await runLocalCli(
      'run structural pgTAP tests',
      ['test', 'db', '--local', 'supabase/tests/database'],
      {
        timeoutMs: STRUCTURAL_TEST_TIMEOUT_MS,
        failureDiagnosticProfile: 'tap',
        failureDiagnosticMaxBytes: STRUCTURAL_TEST_DIAGNOSTIC_MAX_BYTES,
        failureDiagnosticMaxLines: STRUCTURAL_TEST_DIAGNOSTIC_MAX_LINES,
      },
    );
    await runLocalCli('lint migrated public schema', [
      'db',
      'lint',
      '--local',
      '--schema',
      'public',
      '--level',
      'error',
      '--fail-on',
      'error',
    ]);

    const driftPath = join(sandboxRoot, 'db05-drift.sql');
    const driftCommand = await runLocalCli('compare local schema to migration shadow', [
      'db',
      'diff',
      '--local',
      '--schema',
      'public,auth,storage',
      '--output',
      driftPath,
    ]);
    const driftMetadata = await stat(driftPath).catch(() => null);
    if (
      !driftMetadata?.isFile() &&
      !reportsPinnedEmptySchemaDiff({
        stdout: driftCommand.output,
        stderr: driftCommand.errors,
      })
    ) {
      throw new Error('Local schema diff artifact is missing.');
    }
    const drift = driftMetadata?.isFile() ? await readFile(driftPath, 'utf8') : '';
    const semanticDrift = drift
      .replace(/--[^\r\n]*/gu, '')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .trim();
    if (semanticDrift)
      throw new Error(`Schema drift is not empty.\n${sanitizedTail(semanticDrift)}`);
    process.stdout.write('[db05-local] migration/schema drift: PASS (empty)\n');

    const types = await runLocalCli(
      'generate temporary local database types',
      ['gen', 'types', '--local', '--lang', 'typescript', '--schema', 'public'],
      { quiet: true },
    );
    if (!types.output.includes('export type Database')) {
      throw new Error('Temporary local type generation did not produce the Database type.');
    }
    const typesPath = join(sandboxRoot, 'database.types.temporary.ts');
    await writeFile(typesPath, types.output, 'utf8');
    const typeHash = createHash('sha256').update(types.output).digest('hex');
    process.stdout.write(
      `[db05-local] temporary types: PASS (${types.output.split(/\r?\n/u).length} lines, sha256 ${typeHash})\n`,
    );
    process.stdout.write('[db05-local] DB-08 remains open; repository types were not replaced.\n');

    const rehearsalTargetDir = join(sandboxSupabaseDir, 'tests', 'rehearsal', 'generated');
    await mkdir(rehearsalTargetDir, { recursive: true });
    await writeFile(
      join(rehearsalTargetDir, 'catalog-operator-dblink-target.inc'),
      `\\set ON_ERROR_STOP on
select pg_catalog.set_config(
  'test.cat08_dblink_host',
  'host.docker.internal',
  false
);
select pg_catalog.set_config(
  'test.cat08_dblink_port',
  '${ports[2]}',
  false
);
`,
      'utf8',
    );
    await runLocalCli(
      'run CAT-08 two-connection revocation rehearsal',
      ['test', 'db', '--local', 'supabase/tests/rehearsal'],
      {
        timeoutMs: LOCAL_CLI_TIMEOUT_MS,
        failureDiagnosticProfile: 'tap',
        failureDiagnosticMaxBytes: STRUCTURAL_TEST_DIAGNOSTIC_MAX_BYTES,
        failureDiagnosticMaxLines: STRUCTURAL_TEST_DIAGNOSTIC_MAX_LINES,
      },
    );
  }
} finally {
  await cleanupSandbox();
  signalCleanup.dispose();
}

if (!signalCleanup.signal) {
  process.stdout.write(
    `[db05-local] ${mode === '--verify' ? 'full local verification' : 'local reset'}: PASS\n`,
  );
}
