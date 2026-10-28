#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { installSignalCleanup } from './local-supabase-signal-cleanup.mjs';
import {
  assertCanonicalPostgres24,
  isCanonicalPostgresQuota24,
  prepareCanonicalPostgresMirror24,
} from './canonical-postgres-mirror24.mjs';
import {
  runWithCanonicalPostgresPullRetry,
  runWithSinglePreMigrationContainerRetry,
} from './local-supabase-reset-retry.mjs';
import { assertLocalOnlyInvocation } from './local-supabase-target-guard.mjs';
import {
  ContainedCommandError,
  runContainedCommand,
  sanitizeBoundedCommandDiagnostic,
} from './contained-command.mjs';
import { reportsPinnedEmptySchemaDiff } from './schema-diff-evidence.mjs';
import {
  DATABASE_TYPES_RELATIVE_PATH,
  summarizeCanonicalDatabaseTypes,
  summarizeDatabaseTypes,
} from './database-types-contract-lib.mjs';

const PINNED_CLI_VERSION = '2.117.0';
const EXPECTED_MIGRATION_COUNT = 97;
const EXPECTED_LATEST_MIGRATION = '20261010000081';
const COMMERCE_UPGRADE_MIGRATION = '20260729000072';
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

if (
  !['--reset-only', '--verify', '--types-check', '--types-update'].includes(mode) ||
  process.argv.length > 3
) {
  throw new Error(
    'Usage: node scripts/phase2/local-supabase-reset.mjs [--reset-only|--verify|--types-check|--types-update]',
  );
}
const FULL_VERIFY = mode === '--verify';
const TYPES_MODE = mode === '--types-check' || mode === '--types-update';

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
// Preserve the pinned CLI's non-database registry fallback after the scrub.
// PostgreSQL alone is prepared and bound to canonical ECR below.

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

const EXPECTED_MIGRATION_SET_SHA256 =
  '5ee03b2032781512fe2ab893e46a3f28daf68ea55ba7b800393265256898c3d6';
const { canonicalJson, sha256 } = await import('./staging-deployment-evidence-lib.mjs');

async function assertReviewedMigrationSource(supabaseDir, expectedInventory) {
  const directory = join(supabaseDir, 'migrations');
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile() || !/^\d{14}_[a-z0-9_]+\.sql$/u.test(entry.name))) {
    throw new Error('DB06_ACL_R2A_SOURCE_INTEGRITY: unexpected migration input.');
  }
  const inventory = await Promise.all(
    entries.sort((a, b) => a.name.localeCompare(b.name)).map(async ({ name }) => ({
      id: name.slice(0, 14),
      file: name,
      sha256: sha256(await readFile(join(directory, name))),
    })),
  );
  const versions = inventory.map(({ id }) => id);
  if (
    new Set(versions).size !== versions.length ||
    (expectedInventory
      ? canonicalJson(inventory) !== canonicalJson(expectedInventory)
      : inventory.length !== EXPECTED_MIGRATION_COUNT ||
        versions.at(-1) !== EXPECTED_LATEST_MIGRATION ||
        sha256(canonicalJson(inventory)) !== EXPECTED_MIGRATION_SET_SHA256)
  ) {
    throw new Error('DB06_ACL_R2A_SOURCE_INTEGRITY: migration inventory or bytes differ from the reviewed identity.');
  }
  return inventory;
}

const reviewedMigrationInventory = await assertReviewedMigrationSource(SOURCE_SUPABASE_DIR);
const migrationFiles = reviewedMigrationInventory.map(({ file }) => file);
const expectedVersions = reviewedMigrationInventory.map(({ id }) => id);
const commerceMigrationName = migrationFiles.find((name) =>
  name.startsWith(`${COMMERCE_UPGRADE_MIGRATION}_`),
);
if (!commerceMigrationName || commerceMigrationName === migrationFiles.at(-1)) {
  throw new Error('The exact 0072 commerce upgrade migration must precede the current head.');
}
const laterRehearsalMigrationNames = migrationFiles.filter((name) => {
  const version = name.slice(0, 14);
  return version > COMMERCE_UPGRADE_MIGRATION && version < EXPECTED_LATEST_MIGRATION;
});
if (
  laterRehearsalMigrationNames.map((name) => name.slice(0, 14)).join(',') !==
  '20260921000073,20260921000074,20260921000075,20260921000076,20260926000077,20260926000078,20261007000079,20261008000080'
) {
  throw new Error('The post-0072 rehearsal migration inventory changed without review.');
}

// This pin is an unproven current-chain trial. The 2.116.0 concurrent DROP
// fix is present, but 2.115.0–2.116.0 regressed LOCK TABLE in migration
// pipelines; 2.117.0 has not been proven against this repository's complete
// chain. Only a clean PostgreSQL replay and exact type/schema checks can
// promote DB05. Never rewrite the checked-in migrations in this sandbox.

bindLocalHistoryEngine(childEnv, process.platform);

const sandboxRoot = await mkdtemp(join(tmpdir(), 'layerwell-db05-local-'));
// Image acquisition is public and credential-free even on a signed-in desktop.
// Never read the user's Docker auth store or inherited registry auth settings.
const publicDockerConfig = join(sandboxRoot, '.docker-public');
await mkdir(publicDockerConfig);
await writeFile(join(publicDockerConfig, 'config.json'), '{"auths":{}}\n', { mode: 0o600 });
childEnv.DOCKER_CONFIG = publicDockerConfig;
delete childEnv.DOCKER_AUTH_CONFIG;
const sandboxSupabaseDir = join(sandboxRoot, 'supabase');
const sandboxProjectId = `layerwell_db05_${randomBytes(8).toString('hex')}`;
let historyDatabase;
let historyDockerIdentity;
let canonicalPostgresIdentity;
const CANONICAL_POSTGRES_IMAGE = 'public.ecr.aws/supabase/postgres:15.8.1.085';
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
    retryPreMigrationContainerExit125 = false,
  } = {},
) {
  assertLocalOnlyInvocation(label, args);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes <= 0 ||
    typeof retryPreMigrationContainerExit125 !== 'boolean'
  ) {
    throw new Error('Local Supabase CLI bounds are invalid.');
  }

  if (!quiet) process.stdout.write(`[db05-local] ${label}...\n`);
  const executeOnce = async () => {
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
    try {
      return await done;
    } finally {
      if (activeCliProcess?.done === done) activeCliProcess = undefined;
    }
  };
  let result;
  try {
    result = retryPreMigrationContainerExit125
      ? await runWithSinglePreMigrationContainerRetry({
          operation: executeOnce,
          onRetry: () =>
            process.stdout.write(
              `[db05-local] ${label}: transient pre-migration container exit 125; retrying once...\n`,
            ),
        })
      : await executeOnce();
  } catch (error) {
    if (error instanceof ContainedCommandError) {
      const diagnostic = error.diagnostic
        ? `\nSanitized CLI output tail:\n${error.diagnostic}`
        : '';
      throw new Error(`Local Supabase CLI ${error.originReason}.${diagnostic}`);
    }
    throw error;
  }
  const output = result.stdout;
  const errors = result.stderr;
  if (!quiet) process.stdout.write(`[db05-local] ${label}: PASS\n`);
  return { output, errors };
}

async function runLocalReset(label) {
  return await runLocalCli(label, ['db', 'reset', '--local'], {
    retryPreMigrationContainerExit125: true,
  });
}

async function terminateActiveCliProcess() {
  const active = activeCliProcess;
  if (!active) return;
  const timeout = new AbortController();
  const confirmed = new Set([
    'posix-process-group-empty', 'windows-job-object-empty', 'windows-process-tree-terminated',
  ]);
  try {
    active.abort();
    await Promise.race([
      active.done.then(
        (result) => {
          if (!confirmed.has(result?.containment)) {
            throw new Error('C01_CHILD_CONTAINMENT_UNPROVED');
          }
        },
        (error) => {
          if (!confirmed.has(error?.containment)) throw error;
        },
      ),
      delay(35_000, undefined, { signal: timeout.signal }).then(() => {
        throw new Error('C01_CHILD_CLEANUP_BOUND_EXCEEDED');
      }),
    ]);
  } finally {
    timeout.abort();
  }
}

function cleanupSandbox() {
  cleanupPromise ??= (async () => {
    const failures = [];
    let processContained = false;
    try {
      await terminateActiveCliProcess();
      processContained = true;
    } catch (error) {
      failures.push(error);
    }
    if (processContained && stackMayExist) {
      try {
        await runLocalCli('remove isolated stack and volumes', ['stop', '--no-backup'], {
          quiet: true,
        });
        for (const args of [
          ['ps', '--all', '--filter', `label=com.supabase.cli.project=${sandboxProjectId}`, '--format', '{{.ID}}'],
          ['volume', 'ls', '--filter', `label=com.supabase.cli.project=${sandboxProjectId}`, '--format', '{{.Name}}'],
        ]) {
          const result = await runHistoryDocker(args);
          if (typeof result.stdout !== 'string' || result.stdout.trim()) {
            throw new Error('C01_OWNED_RESOURCE_REMOVAL_UNPROVED');
          }
        }
      } catch (error) {
        failures.push(error);
      }
    }
    // Retain the run-owned workdir when containment/stop is unproved: its config
    // and forensic artifacts are required for an independent cleanup decision.
    if (failures.length === 0) {
      try {
        await rm(sandboxRoot, { recursive: true, force: true });
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) {
      for (const error of failures) {
        process.stderr.write(`${sanitizedTail(error instanceof Error ? error.message : error)}\n`);
      }
      throw new AggregateError(failures, 'C01_CLEANUP_FAILED: run-owned evidence retained.', {
        cause: failures[0],
      });
    }
  })();
  return cleanupPromise;
}

const signalCleanup = installSignalCleanup({ cleanup: cleanupSandbox });

function assertExactMigrationHistory(rawOutput, versions = expectedVersions) {
  let parsed;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    throw new Error(`Local migration history did not return JSON: ${sanitizedTail(rawOutput)}`);
  }
  // CLI 2.117.0: remote is the connected database, even with --local.
  // local and time are filename/display metadata, never installation evidence.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
      Object.keys(parsed).length !== 2 || parsed.message !== 'Migrations listed' ||
      !Array.isArray(parsed.migrations)) {
    throw new Error('Local migration history has malformed payload fields.');
  }
  const actualVersions = [];
  for (const row of parsed.migrations) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        Object.keys(row).length !== 3 ||
        typeof row.local !== 'string' || typeof row.remote !== 'string' ||
        typeof row.time !== 'string' || !/^\d{14}$/u.test(row.remote) ||
        (row.local !== '' && row.local !== row.remote)) {
      throw new Error('Local migration history has malformed installed-version fields.');
    }
    const timestamp = row.remote.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/u,
      '$1-$2-$3 $4:$5:$6');
    const date = new Date(`${timestamp.replace(' ', 'T')}Z`);
    const displayTime = !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 19).replace('T', ' ') === timestamp ? timestamp : row.remote;
    if (row.time !== displayTime) {
      throw new Error('Local migration history has incorrect display-time metadata.');
    }
    actualVersions.push(row.remote);
  }
  // Compare the original database order; never filter, sort, or deduplicate it.
  if (actualVersions.length !== versions.length ||
      actualVersions.some((version, index) => version !== versions[index])) {
    throw new Error(`Local migration history does not match the exact ${versions.length}-migration source prefix through ${versions.at(-1)}.`);
  }
  console.log('[db05-local] verified installed-history JSON begin');
  process.stdout.write(rawOutput);
  console.log('[db05-local] verified installed-history JSON end');
}


function bindLocalHistoryEngine(environment, platform) {
  const host = platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock';
  if ((environment.DOCKER_HOST && environment.DOCKER_HOST !== host) ||
      (environment.DOCKER_CONTEXT && environment.DOCKER_CONTEXT !== 'default') ||
      environment.DOCKER_TLS_VERIFY || environment.DOCKER_CERT_PATH) {
    throw new Error('H01_UNSAFE_DOCKER_TARGET: a local default engine is required.');
  }
  delete environment.DOCKER_CONTEXT;
  environment.DOCKER_HOST = host;
}

async function runHistoryDocker(args) {
  if (!historyDockerIdentity) {
    const executable = process.platform === 'win32' ? 'docker.exe' : 'docker';
    for (const directory of (childEnv.PATH ?? childEnv.Path ?? '').split(delimiter)) {
      if (!isAbsolute(directory)) continue;
      const path = await realpath(join(directory, executable)).catch(() => null);
      if (!path || !(await stat(path)).isFile()) continue;
      historyDockerIdentity = { path, sha256: sha256(await readFile(path)) };
      break;
    }
    if (!historyDockerIdentity) throw new Error('H01_DOCKER_EXECUTABLE: Docker is unavailable.');
    console.log(`[db05-local] history Docker identity: ${JSON.stringify(historyDockerIdentity)}`);
  }
  if (sha256(await readFile(historyDockerIdentity.path)) !== historyDockerIdentity.sha256) {
    throw new Error('H01_DOCKER_EXECUTABLE: Docker bytes changed during this run.');
  }
  const controller = new AbortController();
  const done = runContainedCommand({
    command: historyDockerIdentity.path, args, cwd: sandboxRoot, environment: childEnv,
    timeoutMs: LOCAL_CLI_TIMEOUT_MS, maxOutputBytes: LOCAL_CLI_MAX_OUTPUT_BYTES,
    signal: controller.signal, inheritParentProcessGroup: INHERIT_PARENT_PROCESS_GROUP,
    retainSanitizedFailureDiagnostic: true,
  });
  activeCliProcess = { abort: () => controller.abort(), done };
  try {
    return await done;
  } catch (error) {
    if (error instanceof ContainedCommandError) {
      throw new Error(`H01_SQL_PROBE_FAILED: ${error.originReason}. ${error.diagnostic ?? ''}`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    if (activeCliProcess?.done === done) activeCliProcess = undefined;
  }
}

async function prepareCanonicalPostgresImage() {
  // CLI 2.117.0 checks ALL candidate caches before pulling. Seed its first
  // candidate explicitly, even when only GHCR PostgreSQL was already cached.
  // Never retag a fallback image or globally disable non-DB registry fallback.
  const architecture = { x64: 'amd64', arm64: 'arm64' }[process.arch];
  if (historyDatabase?.major !== 15 || !architecture) {
    throw new Error('H01_CANONICAL_POSTGRES: unsupported pinned image platform or major.');
  }
  const pulled = await runWithCanonicalPostgresPullRetry({
    signal: signalCleanup.signal,
    operation: () => runHistoryDocker([
      'pull', '--platform', `linux/${architecture}`, CANONICAL_POSTGRES_IMAGE,
    ]),
    onRetry: attempt => console.log(
      `[db05-local] canonical PostgreSQL registry throttled; retry ${attempt}/3`,
    ),
  });
  const digests = [...`${pulled.stdout}\n${pulled.stderr}`.matchAll(
    /^Digest: (sha256:[a-f0-9]{64})\s*$/gmu,
  )];
  if (digests.length !== 1) {
    throw new Error('H01_CANONICAL_POSTGRES: missing or ambiguous pull digest.');
  }
  const digest = digests[0][1];
  let entries;
  try {
    entries = JSON.parse((await runHistoryDocker([
      'image', 'inspect', CANONICAL_POSTGRES_IMAGE,
    ])).stdout);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('H01_CANONICAL_POSTGRES: malformed image inspection.');
    }
    throw error;
  }
  const image = Array.isArray(entries) && entries.length === 1 ? entries[0] : null;
  if (!image || !/^sha256:[a-f0-9]{64}$/u.test(image.Id ?? '') ||
      image.Os !== 'linux' || image.Architecture !== architecture ||
      !Array.isArray(image.RepoTags) || !image.RepoTags.includes(CANONICAL_POSTGRES_IMAGE) ||
      !Array.isArray(image.RepoDigests) ||
      !image.RepoDigests.includes(`public.ecr.aws/supabase/postgres@${digest}`)) {
    throw new Error('H01_CANONICAL_POSTGRES: pull, registry, immutable image or platform mismatch.');
  }
  canonicalPostgresIdentity = { id: image.Id, digest, architecture };
  console.log(`[db05-local] canonical PostgreSQL identity: ${JSON.stringify(canonicalPostgresIdentity)}`);
}

async function prepareCanonicalPostgresImage24() {
  try {
    await prepareCanonicalPostgresImage();
    // A moved upstream tag also fails before any database container starts.
    assertCanonicalPostgres24(canonicalPostgresIdentity);
  } catch (error) {
    if (!isCanonicalPostgresQuota24(error)) throw error;
    canonicalPostgresIdentity = await prepareCanonicalPostgresMirror24({
      runDocker: runHistoryDocker,
      architecture: { x64: 'amd64', arm64: 'arm64' }[process.arch],
      signal: signalCleanup.signal,
    });
    console.log(`[db05-local] canonical identical-mirror identity: ${JSON.stringify(canonicalPostgresIdentity)}`);
  }
}

function assertHistoryDatabaseTarget(rawOutput) {
  let entries;
  try { entries = JSON.parse(rawOutput); } catch {
    throw new Error('H01_DATABASE_TARGET: malformed container inspection.');
  }
  const target = Array.isArray(entries) && entries.length === 1 ? entries[0] : null;
  const labels = target?.Config?.Labels;
  const port = target?.HostConfig?.PortBindings?.['5432/tcp'];
  if (!target || !historyDatabase || !/^[a-f0-9]{64}$/u.test(target.Id ?? '') ||
      target.Name !== `/supabase_db_${sandboxProjectId}` || target.State?.Running !== true ||
      labels?.['com.supabase.cli.project'] !== sandboxProjectId ||
      labels?.['com.docker.compose.project'] !== sandboxProjectId ||
      labels?.['com.supabase.cli.workdir'] !== sandboxRoot ||
      !new RegExp(`^public\\.ecr\\.aws/supabase/postgres:${historyDatabase.major}\\.`, 'u').test(target.Config?.Image ?? '') ||
      !/^sha256:[a-f0-9]{64}$/u.test(target.Image ?? '') ||
      !Array.isArray(port) || port.length !== 1 || port[0].HostPort !== String(historyDatabase.port) ||
      !['', '127.0.0.1', '0.0.0.0'].includes(port[0].HostIp)) {
    // Fixed keys and booleans only: never echo inspect values or sandbox paths.
    const checks = {
      singleContainer: Boolean(target), runOwnership: Boolean(historyDatabase),
      containerId: /^[a-f0-9]{64}$/u.test(target?.Id ?? ''),
      containerName: target?.Name === `/supabase_db_${sandboxProjectId}`,
      running: target?.State?.Running === true,
      cliProject: labels?.['com.supabase.cli.project'] === sandboxProjectId,
      composeProject: labels?.['com.docker.compose.project'] === sandboxProjectId,
      cliWorkdir: labels?.['com.supabase.cli.workdir'] === sandboxRoot,
      imageMajor: new RegExp(`^public\\.ecr\\.aws/supabase/postgres:${historyDatabase?.major}\\.`, 'u').test(target?.Config?.Image ?? ''),
      imageDigest: /^sha256:[a-f0-9]{64}$/u.test(target?.Image ?? ''),
      portCount: Array.isArray(port) && port.length === 1,
      portNumber: port?.[0]?.HostPort === String(historyDatabase?.port),
      portHost: ['', '127.0.0.1', '0.0.0.0'].includes(port?.[0]?.HostIp),
      portBinding: Array.isArray(port) && port.length === 1 &&
        port[0]?.HostPort === String(historyDatabase?.port) &&
        ['', '127.0.0.1', '0.0.0.0'].includes(port[0]?.HostIp),
    };
    const diagnostic = {
      schema: 1, checks,
      runtime: {
        cli: '2.117.0',
        node: typeof process === 'object' && /^v\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(process.version ?? '')
          ? process.version : null,
        platform: typeof process === 'object' && ['linux', 'win32', 'darwin'].includes(process.platform)
          ? process.platform : null,
      },
      observed: {
        cliProjectLabelPresent: Object.hasOwn(labels ?? {}, 'com.supabase.cli.project'),
        composeProjectLabelPresent: Object.hasOwn(labels ?? {}, 'com.docker.compose.project'),
        workdirLabelPresent: Object.hasOwn(labels ?? {}, 'com.supabase.cli.workdir'),
        portBindingPresent: Object.hasOwn(target?.HostConfig?.PortBindings ?? {}, '5432/tcp'),
      },
    };
    throw new Error(`H01_DATABASE_TARGET: inspected database is not the exact run-owned target. ${JSON.stringify(diagnostic)}`);
  }
  if (!canonicalPostgresIdentity || target.Config.Image !== CANONICAL_POSTGRES_IMAGE ||
      target.Image !== canonicalPostgresIdentity.id) {
    throw new Error('H01_DATABASE_TARGET: database differs from the canonical pulled image.');
  }
  return { id: target.Id, image: target.Image, project: sandboxProjectId,
    workdir: sandboxRoot, port: historyDatabase.port, major: historyDatabase.major };
}

const COMPLETE_HISTORY_SQL = `
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SELECT pg_catalog.json_build_object(
  'database', pg_catalog.current_database(), 'current_user', current_user,
  'session_user', session_user, 'server_version_num', pg_catalog.current_setting('server_version_num'),
  'port', pg_catalog.current_setting('port'), 'read_only', pg_catalog.current_setting('transaction_read_only'),
  'count', pg_catalog.count(*),
  'versions', COALESCE(pg_catalog.json_agg(version ORDER BY version COLLATE "C"), '[]'::json)
) FROM supabase_migrations.schema_migrations;
COMMIT;
`;

function assertCompleteSqlHistory(rawOutput, versions = expectedVersions) {
  let observed;
  try { observed = JSON.parse(rawOutput); } catch {
    throw new Error('H01_SQL_OUTPUT: history probe did not return one complete JSON document.');
  }
  if (!observed || typeof observed !== 'object' || Array.isArray(observed) ||
      observed.database !== 'postgres' ||
      observed.current_user !== 'postgres' || observed.session_user !== 'postgres' ||
      typeof observed.server_version_num !== 'string' || !/^\d{6}$/u.test(observed.server_version_num) ||
      Number(observed.server_version_num.slice(0, 2)) !== historyDatabase?.major ||
      observed.port !== '5432' || observed.read_only !== 'on') {
    throw new Error('H01_SQL_IDENTITY: SQL database/session/server/read-only provenance is invalid.');
  }
  if (Object.keys(observed).length !== 8 || !Number.isSafeInteger(observed.count) || !Array.isArray(observed.versions) ||
      observed.count !== observed.versions.length || observed.count !== versions.length ||
      observed.versions.some((version, index) => typeof version !== 'string' ||
        !/^\d{14}$/u.test(version) || version !== versions[index])) {
    throw new Error(`H01_SQL_HISTORY: unfiltered installed history does not match the exact ${versions.length}-migration prefix through ${versions.at(-1)}.`);
  }
}

async function assertCompleteMigrationHistory(rawCliOutput, versions = expectedVersions) {
  const before = assertHistoryDatabaseTarget((await runHistoryDocker([
    'inspect', '--type', 'container', `supabase_db_${sandboxProjectId}`,
  ])).stdout);
  // No shell, ambient PG settings, password prompt or psqlrc. Explicit local
  // socket in the bound immutable container, database postgres and role postgres.
  const sql = await runHistoryDocker([
    'exec', '--user', 'postgres', before.id, '/usr/bin/env', '-i',
    'PATH=/usr/bin:/bin', '/usr/bin/psql', '-X', '-qAt', '--no-password',
    '--host=/var/run/postgresql', '--port=5432', '--username=postgres', '--dbname=postgres',
    '--set=ON_ERROR_STOP=1', '--command', COMPLETE_HISTORY_SQL,
  ]);
  console.log('[db05-local] observed unfiltered SQL history begin');
  process.stdout.write(sql.stdout);
  console.log('[db05-local] observed unfiltered SQL history end');
  assertCompleteSqlHistory(sql.stdout, versions);
  const after = assertHistoryDatabaseTarget((await runHistoryDocker([
    'inspect', '--type', 'container', `supabase_db_${sandboxProjectId}`,
  ])).stdout);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('H01_DATABASE_TARGET: database container changed during observation.');
  }
  // Both observations must equal the same ordered reviewed prefix. CLI JSON is
  // corroboration only; it cannot hide rows omitted by its legacy formatter.
  assertExactMigrationHistory(rawCliOutput, versions);
  console.log(`[db05-local] verified SQL/CLI database binding: ${JSON.stringify(after)}`);
}

let verificationFailure;
try {
  await cp(SOURCE_SUPABASE_DIR, sandboxSupabaseDir, {
    recursive: true,
    filter: (sourcePath) => !isExcludedSourcePath(sourcePath),
  });

  await assertReviewedMigrationSource(sandboxSupabaseDir, reviewedMigrationInventory);

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
  const configuredMajor = config.match(/^major_version\s*=\s*(\d+)\s*$/mu)?.[1];
  if (!configuredMajor) throw new Error('H01_DATABASE_TARGET: database major version is missing.');
  historyDatabase = { port: ports[2], major: Number(configuredMajor) };
  await writeFile(configPath, config, 'utf8');

  await stat(join(sandboxSupabaseDir, 'seed.sql'));
  await stat(join(sandboxSupabaseDir, 'tests', 'database', 'schema_contract.test.sql'));
  await stat(
    join(
      sandboxSupabaseDir,
      'tests',
      'upgrade',
      'routine_completion_sync_bridge_0069_upgrade.test.sql',
    ),
  );
  await stat(
    join(
      sandboxSupabaseDir,
      'tests',
      'upgrade',
      'health_consent_draft_successor_0070_upgrade.test.sql',
    ),
  );
  await stat(
    join(
      sandboxSupabaseDir,
      'tests',
      'upgrade',
      'recommendation_zero_admission_0071_upgrade.test.sql',
    ),
  );
  await stat(
    join(sandboxSupabaseDir, 'tests', 'upgrade', 'commerce_zero_admission_0072_upgrade.test.sql'),
  );
  await stat(
    join(sandboxSupabaseDir, 'tests', 'upgrade', 'routine_adherence_0068_upgrade.test.sql'),
  );

  const sandboxHeadMigration = join(sandboxSupabaseDir, 'migrations', migrationFiles.at(-1));
  const sandboxCommerceMigration = join(sandboxSupabaseDir, 'migrations', commerceMigrationName);
  const sandboxRecommendationMigration = join(
    sandboxSupabaseDir,
    'migrations',
    migrationFiles.find((name) => name.startsWith('20260726000071_')),
  );
  const sandboxAdherenceMigration = join(
    sandboxSupabaseDir,
    'migrations',
    migrationFiles.find((name) => name.startsWith('20260726000068_')),
  );
  const sandboxSyncMigration = join(
    sandboxSupabaseDir,
    'migrations',
    migrationFiles.find((name) => name.startsWith('20260726000069_')),
  );
  const sandboxConsentDraftMigration = join(
    sandboxSupabaseDir,
    'migrations',
    migrationFiles.find((name) => name.startsWith('20260726000070_')),
  );
  const laterRehearsalMigrations = laterRehearsalMigrationNames.map((name) => ({
    installed: join(sandboxSupabaseDir, 'migrations', name),
    withheld: join(sandboxRoot, name),
  }));
  const withheldHeadMigration = join(sandboxRoot, migrationFiles.at(-1));
  const withheldCommerceMigration = join(sandboxRoot, commerceMigrationName);
  const withheldRecommendationMigration = join(
    sandboxRoot,
    migrationFiles.find((name) => name.startsWith('20260726000071_')),
  );
  const withheldSyncMigration = join(
    sandboxRoot,
    migrationFiles.find((name) => name.startsWith('20260726000069_')),
  );
  const withheldConsentDraftMigration = join(
    sandboxRoot,
    migrationFiles.find((name) => name.startsWith('20260726000070_')),
  );
  const withheldAdherenceMigration = join(
    sandboxRoot,
    migrationFiles.find((name) => name.startsWith('20260726000068_')),
  );
  if (FULL_VERIFY) {
    await rename(sandboxHeadMigration, withheldHeadMigration);
    for (const migration of laterRehearsalMigrations) {
      await rename(migration.installed, migration.withheld);
    }
    await rename(sandboxCommerceMigration, withheldCommerceMigration);
    await rename(sandboxRecommendationMigration, withheldRecommendationMigration);
    await rename(sandboxConsentDraftMigration, withheldConsentDraftMigration);
    await rename(sandboxSyncMigration, withheldSyncMigration);
    await rename(sandboxAdherenceMigration, withheldAdherenceMigration);
  }

  if (FULL_VERIFY) {
    await assertReviewedMigrationSource(
      sandboxSupabaseDir,
      reviewedMigrationInventory.filter((entry) => entry.id <= '20260726000067'),
    );
  }

  await prepareCanonicalPostgresImage24();
  stackMayExist = true;
  await runLocalCli('start isolated credential-free stack', ['start']);
  if (FULL_VERIFY) {
    await assertReviewedMigrationSource(
      sandboxSupabaseDir,
      reviewedMigrationInventory.filter((entry) => entry.id <= '20260726000067'),
    );
    await runLocalReset('reset through 0067 for the 0068 forward-upgrade rehearsal');
    const history20260726000067 = await runLocalCli(
      'verify installed history through 20260726000067',
      ['migration', 'list', '--local', '--output-format', 'json'],
    );
    await assertCompleteMigrationHistory(
      history20260726000067.output,
      expectedVersions.filter((id) => id <= '20260726000067'),
    );
    await rename(withheldAdherenceMigration, sandboxAdherenceMigration);
    const adherenceUpgradeTemplatePath = join(
      sandboxSupabaseDir,
      'tests',
      'upgrade',
      'routine_adherence_0068_upgrade.test.sql',
    );
    const generatedUpgradeDir = join(sandboxSupabaseDir, 'tests', 'upgrade', 'generated');
    const generatedAdherenceUpgradePath = join(
      generatedUpgradeDir,
      'routine_adherence_0068_upgrade.generated.test.sql',
    );
    const [adherenceUpgradeTemplate, exactAdherenceMigration] = await Promise.all([
      readFile(adherenceUpgradeTemplatePath, 'utf8'),
      readFile(sandboxAdherenceMigration, 'utf8'),
    ]);
    const adherenceIncludeMarker = '-- @@INCLUDE_EXACT_0068_MIGRATION@@';
    if (adherenceUpgradeTemplate.split(adherenceIncludeMarker).length !== 2) {
      throw new Error('The 0068 upgrade rehearsal include marker is invalid.');
    }
    await mkdir(generatedUpgradeDir, { recursive: true });
    await writeFile(
      generatedAdherenceUpgradePath,
      adherenceUpgradeTemplate.replace(adherenceIncludeMarker, () => exactAdherenceMigration),
      'utf8',
    );
    await runLocalCli(
      'run 0067 to 0068 adherence data-cutover rehearsal',
      [
        'test',
        'db',
        '--local',
        'supabase/tests/upgrade/generated/routine_adherence_0068_upgrade.generated.test.sql',
      ],
      {
        failureDiagnosticProfile: 'tap',
        failureDiagnosticMaxBytes: STRUCTURAL_TEST_DIAGNOSTIC_MAX_BYTES,
        failureDiagnosticMaxLines: STRUCTURAL_TEST_DIAGNOSTIC_MAX_LINES,
      },
    );
    await assertReviewedMigrationSource(
      sandboxSupabaseDir,
      reviewedMigrationInventory.filter((entry) => entry.id <= '20260726000068'),
    );
    await runLocalReset('reset through 0068 for the 0069 forward-upgrade rehearsal');
    const history20260726000068 = await runLocalCli(
      'verify installed history through 20260726000068',
      ['migration', 'list', '--local', '--output-format', 'json'],
    );
    await assertCompleteMigrationHistory(
      history20260726000068.output,
      expectedVersions.filter((id) => id <= '20260726000068'),
    );
    await rename(withheldSyncMigration, sandboxSyncMigration);
    const syncUpgradeTemplatePath = join(
      sandboxSupabaseDir,
      'tests',
      'upgrade',
      'routine_completion_sync_bridge_0069_upgrade.test.sql',
    );
    const generatedSyncUpgradePath = join(
      generatedUpgradeDir,
      'routine_completion_sync_bridge_0069_upgrade.generated.test.sql',
    );
    const [syncUpgradeTemplate, exactSyncMigration] = await Promise.all([
      readFile(syncUpgradeTemplatePath, 'utf8'),
      readFile(sandboxSyncMigration, 'utf8'),
    ]);
    const syncIncludeMarker = '-- @@INCLUDE_EXACT_0069_MIGRATION@@';
    if (syncUpgradeTemplate.split(syncIncludeMarker).length !== 2) {
      throw new Error('The 0069 upgrade rehearsal include marker is invalid.');
    }
    await writeFile(
      generatedSyncUpgradePath,
      syncUpgradeTemplate.replace(syncIncludeMarker, () => exactSyncMigration),
      'utf8',
    );
    await runLocalCli(
      'run 0068 to 0069 sync-bridge data-cutover rehearsal',
      [
        'test',
        'db',
        '--local',
        'supabase/tests/upgrade/generated/routine_completion_sync_bridge_0069_upgrade.generated.test.sql',
      ],
      {
        failureDiagnosticProfile: 'tap',
        failureDiagnosticMaxBytes: STRUCTURAL_TEST_DIAGNOSTIC_MAX_BYTES,
        failureDiagnosticMaxLines: STRUCTURAL_TEST_DIAGNOSTIC_MAX_LINES,
      },
    );
    await assertReviewedMigrationSource(
      sandboxSupabaseDir,
      reviewedMigrationInventory.filter((entry) => entry.id <= '20260726000069'),
    );
    await runLocalReset('reset through 0069 for the 0070 consent-draft forward-upgrade rehearsal');
    const history20260726000069 = await runLocalCli(
      'verify installed history through 20260726000069',
      ['migration', 'list', '--local', '--output-format', 'json'],
    );
    await assertCompleteMigrationHistory(
      history20260726000069.output,
      expectedVersions.filter((id) => id <= '20260726000069'),
    );
    await rename(withheldConsentDraftMigration, sandboxConsentDraftMigration);
    const consentDraftUpgradeTemplatePath = join(
      sandboxSupabaseDir,
      'tests',
      'upgrade',
      'health_consent_draft_successor_0070_upgrade.test.sql',
    );
    const generatedConsentDraftUpgradePath = join(
      generatedUpgradeDir,
      'health_consent_draft_successor_0070_upgrade.generated.test.sql',
    );
    const [consentDraftUpgradeTemplate, exactConsentDraftMigration] = await Promise.all([
      readFile(consentDraftUpgradeTemplatePath, 'utf8'),
      readFile(sandboxConsentDraftMigration, 'utf8'),
    ]);
    const consentDraftIncludeMarker = '-- @@INCLUDE_EXACT_0070_MIGRATION@@';
    if (consentDraftUpgradeTemplate.split(consentDraftIncludeMarker).length !== 2) {
      throw new Error('The 0070 upgrade rehearsal include marker is invalid.');
    }
    await writeFile(
      generatedConsentDraftUpgradePath,
      consentDraftUpgradeTemplate.replace(
        consentDraftIncludeMarker,
        () => exactConsentDraftMigration,
      ),
      'utf8',
    );
    await runLocalCli(
      'run 0069 to 0070 consent-draft staging rehearsal',
      [
        'test',
        'db',
        '--local',
        'supabase/tests/upgrade/generated/health_consent_draft_successor_0070_upgrade.generated.test.sql',
      ],
      {
        failureDiagnosticProfile: 'tap',
        failureDiagnosticMaxBytes: STRUCTURAL_TEST_DIAGNOSTIC_MAX_BYTES,
        failureDiagnosticMaxLines: STRUCTURAL_TEST_DIAGNOSTIC_MAX_LINES,
      },
    );
    await assertReviewedMigrationSource(
      sandboxSupabaseDir,
      reviewedMigrationInventory.filter((entry) => entry.id <= '20260726000070'),
    );
    await runLocalReset('reset through 0070 for the 0071 recommendation forward-upgrade rehearsal');
    const history20260726000070 = await runLocalCli(
      'verify installed history through 20260726000070',
      ['migration', 'list', '--local', '--output-format', 'json'],
    );
    await assertCompleteMigrationHistory(
      history20260726000070.output,
      expectedVersions.filter((id) => id <= '20260726000070'),
    );
    await rename(withheldRecommendationMigration, sandboxRecommendationMigration);
    const recommendationUpgradeTemplatePath = join(
      sandboxSupabaseDir,
      'tests',
      'upgrade',
      'recommendation_zero_admission_0071_upgrade.test.sql',
    );
    const generatedRecommendationUpgradePath = join(
      generatedUpgradeDir,
      'recommendation_zero_admission_0071_upgrade.generated.test.sql',
    );
    const [recommendationUpgradeTemplate, exactRecommendationMigration] = await Promise.all([
      readFile(recommendationUpgradeTemplatePath, 'utf8'),
      readFile(sandboxRecommendationMigration, 'utf8'),
    ]);
    const recommendationIncludeMarker = '-- @@INCLUDE_EXACT_0071_MIGRATION@@';
    if (recommendationUpgradeTemplate.split(recommendationIncludeMarker).length !== 2) {
      throw new Error('The 0071 upgrade rehearsal include marker is invalid.');
    }
    await writeFile(
      generatedRecommendationUpgradePath,
      recommendationUpgradeTemplate.replace(
        recommendationIncludeMarker,
        () => exactRecommendationMigration,
      ),
      'utf8',
    );
    await runLocalCli(
      'run 0070 to 0071 recommendation zero-admission rehearsal',
      [
        'test',
        'db',
        '--local',
        'supabase/tests/upgrade/generated/recommendation_zero_admission_0071_upgrade.generated.test.sql',
      ],
      {
        failureDiagnosticProfile: 'tap',
        failureDiagnosticMaxBytes: STRUCTURAL_TEST_DIAGNOSTIC_MAX_BYTES,
        failureDiagnosticMaxLines: STRUCTURAL_TEST_DIAGNOSTIC_MAX_LINES,
      },
    );
    await assertReviewedMigrationSource(
      sandboxSupabaseDir,
      reviewedMigrationInventory.filter((entry) => entry.id <= '20260726000071'),
    );
    await runLocalReset('reset through 0071 for the 0072 commerce forward-upgrade rehearsal');
    const history20260726000071 = await runLocalCli(
      'verify installed history through 20260726000071',
      ['migration', 'list', '--local', '--output-format', 'json'],
    );
    await assertCompleteMigrationHistory(
      history20260726000071.output,
      expectedVersions.filter((id) => id <= '20260726000071'),
    );
    await rename(withheldCommerceMigration, sandboxCommerceMigration);
    const commerceUpgradeTemplatePath = join(
      sandboxSupabaseDir,
      'tests',
      'upgrade',
      'commerce_zero_admission_0072_upgrade.test.sql',
    );
    const generatedCommerceUpgradePath = join(
      generatedUpgradeDir,
      'commerce_zero_admission_0072_upgrade.generated.test.sql',
    );
    const [commerceUpgradeTemplate, exactCommerceMigration] = await Promise.all([
      readFile(commerceUpgradeTemplatePath, 'utf8'),
      readFile(sandboxCommerceMigration, 'utf8'),
    ]);
    const commerceIncludeMarker = '-- @@INCLUDE_EXACT_0072_MIGRATION@@';
    if (commerceUpgradeTemplate.split(commerceIncludeMarker).length !== 2) {
      throw new Error('The 0072 upgrade rehearsal include marker is invalid.');
    }
    await writeFile(
      generatedCommerceUpgradePath,
      commerceUpgradeTemplate.replace(commerceIncludeMarker, () => exactCommerceMigration),
      'utf8',
    );
    await runLocalCli(
      'run 0071 to 0072 commerce zero-admission rehearsal',
      [
        'test',
        'db',
        '--local',
        'supabase/tests/upgrade/generated/commerce_zero_admission_0072_upgrade.generated.test.sql',
      ],
      {
        failureDiagnosticProfile: 'tap',
        failureDiagnosticMaxBytes: STRUCTURAL_TEST_DIAGNOSTIC_MAX_BYTES,
        failureDiagnosticMaxLines: STRUCTURAL_TEST_DIAGNOSTIC_MAX_LINES,
      },
    );
    // Preserve the exact 0067-to-0072 predecessor states. The 0073 catalog
    // boundary and 0074 consent correction cannot run before 0070 exists;
    // 0075 quiz provenance follows only after the earlier chain is restored.
    // restore all later migrations only after the exact 0072 rehearsal.
    for (const migration of laterRehearsalMigrations) {
      await rename(migration.withheld, migration.installed);
    }
    await rename(withheldHeadMigration, sandboxHeadMigration);
  }
  await assertReviewedMigrationSource(
  sandboxSupabaseDir,
  reviewedMigrationInventory.filter((entry) => entry.id <= '20261010000081'),
  );
  await runLocalReset('reset 1 of 2 (migrations plus seed)');
  const history20261010000081 = await runLocalCli(
    'verify installed history through 20261010000081',
    ['migration', 'list', '--local', '--output-format', 'json'],
  );
  await assertCompleteMigrationHistory(
    history20261010000081.output,
    expectedVersions.filter((id) => id <= '20261010000081'),
  );

  if (FULL_VERIFY) {
    await assertReviewedMigrationSource(
      sandboxSupabaseDir,
      reviewedMigrationInventory.filter((entry) => entry.id <= '20261010000081'),
    );
    await runLocalReset('reset 2 of 2 (repeatability)');
    const historyRepeat20261010000081 = await runLocalCli(
      'verify installed history through 20261010000081',
      ['migration', 'list', '--local', '--output-format', 'json'],
    );
    await assertCompleteMigrationHistory(
      historyRepeat20261010000081.output,
      expectedVersions.filter((id) => id <= '20261010000081'),
    );
  }

  if (FULL_VERIFY || TYPES_MODE) {
    const history = await runLocalCli(
      'read exact local migration history',
      ['migration', 'list', '--local', '--output-format', 'json'],
      { quiet: true },
    );
    await assertCompleteMigrationHistory(history.output);
    process.stdout.write(
      `[db05-local] migration history: PASS (${EXPECTED_MIGRATION_COUNT}, latest ${EXPECTED_LATEST_MIGRATION})\n`,
    );
  }

  if (FULL_VERIFY) {
    await runLocalCli(
      'run focused CORE-05 structural regressions',
      [
        'test',
        'db',
        '--local',
        'supabase/tests/database/health_consent_lifecycle.test.sql',
        'supabase/tests/database/routine_adherence_authority.test.sql',
        'supabase/tests/database/routine_completion_sync_bridge.test.sql',
        'supabase/tests/database/recommendation_zero_admission.test.sql',
        'supabase/tests/database/commerce_zero_admission.test.sql',
      ],
      {
        failureDiagnosticProfile: 'tap',
        failureDiagnosticMaxBytes: STRUCTURAL_TEST_DIAGNOSTIC_MAX_BYTES,
        failureDiagnosticMaxLines: STRUCTURAL_TEST_DIAGNOSTIC_MAX_LINES,
      },
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

  if (FULL_VERIFY || TYPES_MODE) {
    const types = await runLocalCli(
      'generate canonical local database types',
      ['gen', 'types', '--local', '--lang', 'typescript', '--schema', 'public'],
      { quiet: true },
    );
    const generated = summarizeDatabaseTypes(types.output);
    const typesPath = join(sandboxRoot, 'database.types.temporary.ts');
    await writeFile(typesPath, generated.text, 'utf8');
    process.stdout.write(
      `[db05-local] temporary types: PASS (${generated.lineCount} lines, sha256 ${generated.sha256})\n`,
    );

    // Preserve the exact locally generated public-schema types when a CI
    // parity failure follows. This is a diagnostic artifact, not an approval
    // or a substitute for the clean replay and checked-in type comparison.
    if (FULL_VERIFY && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_TEMP) {
      const diagnosticTypesPath = join(process.env.RUNNER_TEMP, 'db05-generated-public-types.ts');
      await writeFile(diagnosticTypesPath, generated.text, { encoding: 'utf8', flag: 'wx' });
      process.stdout.write(
        `[db05-local] CI diagnostic types: ${basename(diagnosticTypesPath)} sha256 ${generated.sha256}\n`,
      );
    }

    const repositoryTypesPath = join(REPO_ROOT, DATABASE_TYPES_RELATIVE_PATH);
    const repositoryBefore = summarizeCanonicalDatabaseTypes(
      await readFile(repositoryTypesPath, 'utf8'),
    );
    if (mode === '--types-update' && repositoryBefore.sha256 !== generated.sha256) {
      const pendingTypesPath = `${repositoryTypesPath}.db08-${process.pid}.pending`;
      try {
        await writeFile(pendingTypesPath, generated.text, { encoding: 'utf8', flag: 'wx' });
        const pending = summarizeDatabaseTypes(await readFile(pendingTypesPath, 'utf8'));
        if (pending.sha256 !== generated.sha256) {
          throw new Error('DB08_PENDING_TYPES_WRITE_MISMATCH');
        }
        await rename(pendingTypesPath, repositoryTypesPath);
      } finally {
        await rm(pendingTypesPath, { force: true });
      }
    }
    const repositoryAfter = summarizeDatabaseTypes(await readFile(repositoryTypesPath, 'utf8'));
    if (repositoryAfter.sha256 !== generated.sha256) {
      throw new Error(
        `DB08_REPOSITORY_TYPES_STALE: generated ${generated.sha256}, repository ${repositoryAfter.sha256}`,
      );
    }
    process.stdout.write(
      `[db08-types] repository parity: PASS (${repositoryAfter.lineCount} lines, sha256 ${repositoryAfter.sha256}, ${
        repositoryBefore.sha256 === repositoryAfter.sha256 ? 'already-current' : 'updated'
      })\n`,
    );
  }
} catch (error) {
  verificationFailure = error;
  throw error;
} finally {
  try {
    await cleanupSandbox();
  } catch (cleanupFailure) {
    if (verificationFailure) {
      throw new AggregateError([verificationFailure, cleanupFailure],
        'C01_VERIFICATION_AND_CLEANUP_FAILED', { cause: verificationFailure });
    }
    throw cleanupFailure;
  } finally {
    signalCleanup.dispose();
  }
}

if (!signalCleanup.signal) {
  const label =
    mode === '--verify'
      ? 'full local verification'
      : mode === '--types-check'
        ? 'generated types check'
        : mode === '--types-update'
          ? 'generated types update'
          : 'local reset';
  process.stdout.write(`[db05-local] ${label}: PASS\n`);
}
