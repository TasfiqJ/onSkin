#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { installSignalCleanup } from './local-supabase-signal-cleanup.mjs';
import { assertLocalOnlyInvocation } from './local-supabase-target-guard.mjs';

const PINNED_CLI_VERSION = '2.109.1';
const EXPECTED_MIGRATION_COUNT = 53;
const EXPECTED_LATEST_MIGRATION = '20260715000054';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const SOURCE_SUPABASE_DIR = join(REPO_ROOT, 'supabase');
const CLI_ENTRYPOINT = join(REPO_ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');
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
const installedPackage = JSON.parse(
  await readFile(join(REPO_ROOT, 'node_modules', 'supabase', 'package.json'), 'utf8'),
);
if (sourcePackage.devDependencies?.supabase !== PINNED_CLI_VERSION) {
  throw new Error(`package.json must pin supabase exactly to ${PINNED_CLI_VERSION}.`);
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
  return String(value ?? '')
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/giu, '[redacted-local-database-url]')
    .replace(/https?:\/\/[^\s"']+/giu, '[redacted-local-url]')
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/gu, '[redacted-local-key]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[redacted-local-jwt]')
    .replace(
      /("(?:anon_key|api_url|db_url|jwt_secret|publishable_key|secret_key|service_role_key)"\s*:\s*")[^"]+("?)/giu,
      '$1[redacted]$2',
    )
    .split(/\r?\n/u)
    .slice(-120)
    .join('\n');
}

async function runLocalCli(label, args, { quiet = false } = {}) {
  assertLocalOnlyInvocation(label, args);

  if (!quiet) process.stdout.write(`[db05-local] ${label}...\n`);
  const child = spawn(
    process.execPath,
    [CLI_ENTRYPOINT, ...args, '--workdir', sandboxRoot, '--yes'],
    {
      cwd: sandboxRoot,
      env: childEnv,
      shell: false,
      windowsHide: true,
    },
  );
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
  child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
  const done = new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('close', resolveExit);
  });
  activeCliProcess = { child, done };
  const exitCode = await done.finally(() => {
    if (activeCliProcess?.child === child) activeCliProcess = undefined;
  });
  const output = Buffer.concat(stdout).toString('utf8');
  const errors = Buffer.concat(stderr).toString('utf8');
  if (exitCode !== 0) {
    throw new Error(
      `${label} failed (exit ${exitCode}).\n${sanitizedTail(`${output}\n${errors}`)}`,
    );
  }
  if (!quiet) process.stdout.write(`[db05-local] ${label}: PASS\n`);
  return { output, errors };
}

async function terminateActiveCliProcess() {
  const active = activeCliProcess;
  if (!active) return;
  active.child.kill('SIGTERM');
  await Promise.race([active.done.catch(() => {}), delay(5000)]);
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

    await runLocalCli('run structural pgTAP tests', [
      'test',
      'db',
      '--local',
      'supabase/tests/database',
    ]);
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
    await runLocalCli('compare local schema to migration shadow', [
      'db',
      'diff',
      '--local',
      '--schema',
      'public,auth,storage',
      '--output',
      driftPath,
    ]);
    const drift = await readFile(driftPath, 'utf8').catch(() => '');
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
