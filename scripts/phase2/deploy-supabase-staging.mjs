#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

import {
  DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS,
  DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS,
  Db06EvidenceError,
  assertCurrentSourceContract,
  assertEvidenceSafe,
  assertFreshStagingBoundary,
  assertFreshStagingTarget,
  assertRemoteMigrationPrefix,
  buildEvidenceManifest,
  buildSourceInventory,
  canonicalJson,
  emptyCronInventory,
  finalizeEvidenceDirectory,
  parseCronInventory,
  parseCronTableExists,
  parseAuthIngressFreeze,
  parseFunctionInventory,
  parseGitTreeInventory,
  parseLocalTypeSummary,
  parseMigrationHistoryExists,
  parseMigrationInventory,
  parseSchemaInventory,
  parseSecretInventory,
  parseSsoProviderFreeze,
  parseThirdPartyAuthFreeze,
  reserveEvidenceDirectory,
  sha256,
  summarizeGeneratedTypes,
  validateCompletedDeployment,
  validateCutoverRecord,
  validateEvidenceId,
  validateGitSnapshot,
  validateOperatorRole,
  validateRollbackRef,
} from './staging-deployment-evidence-lib.mjs';
import { ContainedCommandError, runContainedCommand } from './contained-command.mjs';
import { BoundedResponseBodyError, readBoundedResponseBody } from './bounded-response-body.mjs';
import { verifyStagingTrafficFreeze } from './staging-traffic-freeze-canary.mjs';
import { reportsPinnedEmptySchemaDiff } from './schema-diff-evidence.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const EVIDENCE_ROOT = join(REPO_ROOT, 'docs', 'hugeToDo', 'evidence', 'DB-06', 'staging');
const PINNED_CLI_VERSION = '2.109.1';
const PROJECT_REF = /^[a-z0-9]{20}$/u;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const INVENTORY_RETRY_ATTEMPTS = 6;
const INVENTORY_RETRY_DELAY_MS = 5_000;
const TAR_BINARY = process.platform === 'win32' ? 'tar.exe' : 'tar';
const POWERSHELL_BINARY = 'powershell.exe';

function resolvePinnedSupabaseBinary() {
  const packages = {
    darwin: { arm64: ['darwin-arm64'], x64: ['darwin-x64'] },
    linux: { arm64: ['linux-arm64', 'linux-arm64-musl'], x64: ['linux-x64', 'linux-x64-musl'] },
    win32: { arm64: ['windows-arm64'], x64: ['windows-x64'] },
  };
  const candidates = packages[process.platform]?.[process.arch] ?? [];
  const require = createRequire(import.meta.url);
  for (const suffix of candidates) {
    try {
      const packageRoot = dirname(require.resolve(`@supabase/cli-${suffix}/package.json`));
      const binary = join(
        packageRoot,
        'bin',
        process.platform === 'win32' ? 'supabase.exe' : 'supabase',
      );
      if (existsSync(binary)) return binary;
    } catch {
      // Try the next reviewed platform package.
    }
  }
  stableFailure('DB06_PINNED_CLI_BINARY_UNAVAILABLE');
}

const CLI_BINARY = resolvePinnedSupabaseBinary();
const CLI_BINARY_SHA256 = sha256(readFileSync(CLI_BINARY));

function assertPinnedCliBinaryUnchanged() {
  if (sha256(readFileSync(CLI_BINARY)) !== CLI_BINARY_SHA256) {
    stableFailure('DB06_PINNED_CLI_BINARY_CHANGED');
  }
}

function stableFailure(code) {
  throw new Db06EvidenceError(code);
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null || value.startsWith('--') || values.has(key)) {
      stableFailure('DB06_ARGUMENTS_INVALID');
    }
    values.set(key, value);
  }
  const allowed = new Set([
    '--project-ref',
    '--operator-role',
    '--rollback-ref',
    '--cutover-record',
    '--cutover-evidence-dir',
    '--evidence-id',
  ]);
  if ([...values.keys()].some((key) => !allowed.has(key))) stableFailure('DB06_ARGUMENTS_INVALID');
  for (const required of [
    '--project-ref',
    '--operator-role',
    '--rollback-ref',
    '--cutover-record',
    '--cutover-evidence-dir',
  ]) {
    if (!values.has(required)) stableFailure('DB06_ARGUMENTS_INVALID');
  }
  return Object.fromEntries([...values].map(([key, value]) => [key.slice(2), value]));
}

function evidenceIdFor(startedAt, gitCommit) {
  const stamp = startedAt
    .toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\.\d{3}/u, '');
  return `db06-staging-${stamp}-${gitCommit.slice(0, 10)}`;
}

function commandFailureCode(commandId, suffix = 'FAILED') {
  return `DB06_${commandId.replace(/[^a-z0-9]+/giu, '_').toUpperCase()}_${suffix}`;
}

function readJson(path, failureCode) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    stableFailure(failureCode);
  }
}

function semanticSql(value) {
  return String(value)
    .replace(/--[^\r\n]*/gu, '')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .trim();
}

const options = parseArgs(process.argv.slice(2));
if (!PROJECT_REF.test(options['project-ref'])) stableFailure('DB06_PROJECT_REF_INVALID');
validateOperatorRole(options['operator-role']);
validateRollbackRef(options['rollback-ref']);

const projectRef = options['project-ref'];
const projectRefLast4 = projectRef.slice(-4);
const projectRefFingerprint = sha256(`db06-project-ref-v1\0${projectRef}`);
if (process.env.APP_ENV?.trim().toLowerCase() !== 'staging') {
  stableFailure('DB06_APP_ENV_NOT_STAGING');
}
if (
  process.env.EXPO_PUBLIC_APP_ENV &&
  process.env.EXPO_PUBLIC_APP_ENV.trim().toLowerCase() !== 'staging'
) {
  stableFailure('DB06_PUBLIC_APP_ENV_CONFLICT');
}
if (process.env.PHASE9_EXPECTED_SUPABASE_PROJECT_REF !== projectRef) {
  stableFailure('DB06_EXPECTED_PROJECT_REF_MISMATCH');
}
if (!process.env.SUPABASE_ACCESS_TOKEN) stableFailure('DB06_ACCESS_TOKEN_NOT_CONFIGURED');

const started = new Date();
const runtimeRoot = mkdtempSync(join(tmpdir(), 'layerwell-db06-staging-'));
const deploymentRoot = join(runtimeRoot, 'source');
const deploymentScriptDir = join(deploymentRoot, 'scripts', 'phase2');
const steps = [];
let evidenceDirectory;
let evidenceFinalized = false;
let remoteMutationStarted = false;
let sourceInventory;
let gitCommit;
let cutover;
let cutoverArtifacts = {};
let retentionReviewAt;
let before;
let preMigration;
let after;
let types;
let linkedTypesText;
let runtime;
let sourceSnapshot;
let gitTreeEntries;
let gitObjectFormat;
let localTypes;
let repositoryTypesBeforeSha256;
let repositoryTypesPath;
let repositoryTypes;
let failureReadback;
let windowsJobRunnerPath;
let activeAbort;
let interruptionCode;
let preserveRuntimeRoot = false;
let containmentRecovery;

function requestInterruption(signal) {
  interruptionCode ??= `DB06_INTERRUPTED_${signal}`;
  activeAbort?.(interruptionCode);
}

const onSigint = () => requestInterruption('SIGINT');
const onSigterm = () => requestInterruption('SIGTERM');
process.on('SIGINT', onSigint);
process.on('SIGTERM', onSigterm);

function noteSummary(commandId, summary) {
  const step = [...steps].reverse().find((candidate) => candidate.commandId === commandId);
  if (step) step.retainedSummarySha256 = sha256(canonicalJson(summary));
}

async function runCommand(
  commandId,
  command,
  args,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputBytes = MAX_OUTPUT_BYTES,
    cwd = REPO_ROOT,
    environment = {},
    ignoreInterruption = false,
    useWindowsJob = true,
  } = {},
) {
  if (interruptionCode && !ignoreInterruption) stableFailure(interruptionCode);
  const startedAt = new Date();
  const step = {
    commandId,
    startedAt: startedAt.toISOString(),
    completedAt: null,
    result: 'fail',
    exitCode: null,
    redaction: 'raw stdout and stderr discarded after allowlisted parsing',
  };
  steps.push(step);
  process.stdout.write(`[db06-staging] ${commandId}...\n`);
  const controller = new AbortController();
  let requestedAbortCode;
  const abortCommand = (code) => {
    requestedAbortCode ??= code;
    controller.abort();
  };
  activeAbort = abortCommand;
  const jobContained =
    process.platform === 'win32' && useWindowsJob && typeof windowsJobRunnerPath === 'string';
  step.processContainment = 'pending';
  const cancellationPath = jobContained
    ? join(runtimeRoot, `job-cancel-${String(steps.length).padStart(4, '0')}.signal`)
    : undefined;
  try {
    const result = await runContainedCommand({
      command,
      args,
      cwd,
      environment: {
        ...process.env,
        ...environment,
        DO_NOT_TRACK: '1',
        SUPABASE_TELEMETRY_DISABLED: '1',
      },
      timeoutMs,
      maxOutputBytes,
      windowsJobRunnerPath: jobContained ? windowsJobRunnerPath : undefined,
      cancellationPath,
      signal: controller.signal,
    });
    step.completedAt = new Date().toISOString();
    step.exitCode = result.exitCode;
    step.processContainment = result.containment;
    if (interruptionCode && !ignoreInterruption) {
      throw new Db06EvidenceError(interruptionCode);
    }
    step.result = 'pass';
    process.stdout.write(`[db06-staging] ${commandId}: PASS\n`);
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    step.completedAt = new Date().toISOString();
    step.exitCode = error instanceof ContainedCommandError ? error.exitCode : null;
    step.processContainment =
      error instanceof ContainedCommandError ? error.containment : 'unconfirmed';
    if (error instanceof ContainedCommandError && error.reason === 'termination-unconfirmed') {
      preserveRuntimeRoot = true;
      containmentRecovery = {
        code: 'DB06_RUNTIME_CONTAINMENT_RECOVERY_REQUIRED',
        runtimeRootPathSha256: sha256(`db06-runtime-root-v1\0${runtimeRoot}`),
        cancellationSignalPathSha256: cancellationPath
          ? sha256(`db06-cancellation-path-v1\0${cancellationPath}`)
          : null,
      };
      step.containmentRecovery = containmentRecovery;
      process.stderr.write(
        `[db06-staging] ${containmentRecovery.code} ${containmentRecovery.runtimeRootPathSha256} ${runtimeRoot}\n`,
      );
    }
    if (error instanceof Db06EvidenceError) throw error;
    if (!(error instanceof ContainedCommandError)) {
      throw new Db06EvidenceError(commandFailureCode(commandId));
    }
    const originReason = error.originReason;
    const baseCode =
      (!ignoreInterruption && interruptionCode) ||
      requestedAbortCode ||
      (originReason === 'timeout'
        ? commandFailureCode(commandId, 'TIMEOUT')
        : originReason === 'output-limit'
          ? commandFailureCode(commandId, 'OUTPUT_LIMIT')
          : originReason === 'spawn-failed'
            ? commandFailureCode(commandId, 'SPAWN_FAILED')
            : originReason === 'aborted'
              ? commandFailureCode(commandId, 'ABORTED')
              : commandFailureCode(commandId));
    throw new Db06EvidenceError(
      error.reason === 'termination-unconfirmed' ? `${baseCode}_TERMINATION_UNCONFIRMED` : baseCode,
    );
  } finally {
    if (activeAbort === abortCommand) activeAbort = undefined;
  }
}

async function runGit(commandId, args, optionsOverride = {}) {
  return await runCommand(commandId, 'git', args, {
    ...optionsOverride,
    useWindowsJob: false,
  });
}

function assertLinkedProjectBinding() {
  const bindingPath = join(deploymentRoot, 'supabase', '.temp', 'project-ref');
  if (!existsSync(bindingPath) || readFileSync(bindingPath, 'utf8').trim() !== projectRef) {
    stableFailure('DB06_LINKED_PROJECT_BINDING_MISMATCH');
  }
}

async function runSupabase(commandId, args, optionsOverride = {}) {
  if (!existsSync(deploymentRoot)) stableFailure('DB06_SOURCE_SNAPSHOT_UNAVAILABLE');
  if (args.includes('--linked')) assertLinkedProjectBinding();
  assertPinnedCliBinaryUnchanged();
  return await runCommand(
    commandId,
    CLI_BINARY,
    [...args, '--workdir', deploymentRoot, '--yes', '--agent', 'no'],
    { cwd: deploymentRoot, ...optionsOverride },
  );
}

async function query(commandId, file, optionsOverride = {}) {
  return await runSupabase(
    commandId,
    ['db', 'query', '--linked', '--file', join(deploymentScriptDir, file), '--output', 'json'],
    optionsOverride,
  );
}

async function migrationInventory(prefix, optionsOverride = {}) {
  const probeId = `${prefix}-migration-history-probe`;
  const probe = await query(probeId, 'staging-migration-history-exists.sql', optionsOverride);
  const exists = parseMigrationHistoryExists(probe.stdout);
  noteSummary(probeId, { migrationHistoryExists: exists });
  if (!exists) return [];
  const inventoryId = `${prefix}-migration-inventory`;
  const inventory = await query(inventoryId, 'staging-migration-inventory.sql', optionsOverride);
  const result = parseMigrationInventory(inventory.stdout);
  noteSummary(inventoryId, result);
  return result;
}

async function functionInventory(
  prefix,
  requireComplete,
  { attempts = 1, commandOptions = {} } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const commandId = `${prefix}-function-inventory${attempts > 1 ? `-attempt-${attempt}` : ''}`;
    try {
      const output = await runSupabase(
        commandId,
        ['functions', 'list', '--project-ref', projectRef, '--output', 'json'],
        commandOptions,
      );
      const result = parseFunctionInventory(output.stdout, sourceInventory, { requireComplete });
      noteSummary(commandId, result);
      return result;
    } catch (error) {
      lastError = error;
      if (
        attempt === attempts ||
        String(error?.code ?? '').includes('TERMINATION_UNCONFIRMED') ||
        String(error?.code ?? '').startsWith('DB06_INTERRUPTED_')
      ) {
        throw error;
      }
      await delay(INVENTORY_RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

async function secretInventory(
  prefix,
  {
    attempts = 1,
    requireAppEnvironment = false,
    requireTrafficFreeze = false,
    commandOptions = {},
  } = {},
) {
  let lastResult;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const commandId = `${prefix}-secret-inventory${attempts > 1 ? `-attempt-${attempt}` : ''}`;
    const output = await runSupabase(
      commandId,
      ['secrets', 'list', '--project-ref', projectRef, '--output', 'json'],
      commandOptions,
    );
    const result = parseSecretInventory(output.stdout, sourceInventory);
    noteSummary(commandId, result);
    if (
      result.missingGroupIds.length === 0 &&
      (!requireAppEnvironment || result.appEnvironmentNamesPresent) &&
      (!requireTrafficFreeze || result.trafficFreezeNamePresent)
    ) {
      return result;
    }
    lastResult = result;
    if (attempt < attempts) await delay(INVENTORY_RETRY_DELAY_MS);
  }
  return lastResult;
}

async function runInProcessEvidenceStep(commandId, operation) {
  if (interruptionCode) stableFailure(interruptionCode);
  const startedAt = new Date();
  const step = {
    commandId,
    startedAt: startedAt.toISOString(),
    completedAt: null,
    result: 'fail',
    exitCode: null,
    redaction: 'raw network response discarded; retained only allowlisted aggregate facts',
    processContainment: 'in-process-bounded-https-no-child-process',
  };
  steps.push(step);
  process.stdout.write(`[db06-staging] ${commandId}...\n`);
  const controller = new AbortController();
  let requestedAbortCode;
  const abortStep = (code) => {
    requestedAbortCode ??= code;
    controller.abort();
  };
  activeAbort = abortStep;
  try {
    const summary = await operation(controller.signal);
    if (interruptionCode) stableFailure(interruptionCode);
    step.completedAt = new Date().toISOString();
    step.exitCode = 0;
    step.result = 'pass';
    step.retainedSummarySha256 = sha256(canonicalJson(summary));
    process.stdout.write(`[db06-staging] ${commandId}: PASS\n`);
    return summary;
  } catch (error) {
    step.completedAt = new Date().toISOString();
    if (requestedAbortCode) stableFailure(requestedAbortCode);
    if (error instanceof Db06EvidenceError) throw error;
    stableFailure(commandFailureCode(commandId));
  } finally {
    if (activeAbort === abortStep) activeAbort = undefined;
  }
}

async function authIngressFreezeInventory(prefix) {
  return await runInProcessEvidenceStep(`${prefix}-auth-ingress-freeze`, async (stepSignal) => {
    const controller = new AbortController();
    const onStepAbort = () => controller.abort();
    stepSignal.addEventListener('abort', onStepAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const readManagementPath = async (path) => {
        const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}${path}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
          },
          redirect: 'error',
          signal: controller.signal,
        });
        const body = await readBoundedResponseBody(response, {
          maxBytes: 1024 * 1024,
          abortController: controller,
        });
        return { status: response.status, body: body.toString('utf8') };
      };
      const configResponse = await readManagementPath('/config/auth');
      if (configResponse.status !== 200) {
        stableFailure('DB06_AUTH_INGRESS_FREEZE_READ_FAILED');
      }
      const config = parseAuthIngressFreeze(configResponse.body);
      const ssoResponse = await readManagementPath('/config/auth/sso/providers');
      const sso =
        ssoResponse.status === 404 && config.samlEnabled === false
          ? { ssoProviderCount: 0 }
          : ssoResponse.status === 200
            ? parseSsoProviderFreeze(ssoResponse.body)
            : stableFailure('DB06_AUTH_INGRESS_FREEZE_READ_FAILED');
      const thirdPartyResponse = await readManagementPath('/config/auth/third-party-auth');
      if (thirdPartyResponse.status !== 200) {
        stableFailure('DB06_AUTH_INGRESS_FREEZE_READ_FAILED');
      }
      const thirdParty = parseThirdPartyAuthFreeze(thirdPartyResponse.body);
      return {
        ...config,
        ...sso,
        ...thirdParty,
        observedAt: new Date().toISOString(),
        source: 'supabase-management-api-v1-read-only',
      };
    } catch (error) {
      if (error instanceof Db06EvidenceError) throw error;
      if (error instanceof BoundedResponseBodyError) {
        stableFailure('DB06_AUTH_INGRESS_FREEZE_READ_FAILED');
      }
      stableFailure('DB06_AUTH_INGRESS_FREEZE_READ_FAILED');
    } finally {
      clearTimeout(timeout);
      stepSignal.removeEventListener('abort', onStepAbort);
    }
  });
}

async function trafficFreezeCanary(prefix) {
  const publicFunctionSlugs = sourceInventory.functions
    .filter(({ verifyJwt }) => verifyJwt === false)
    .map(({ slug }) => slug);
  return await runInProcessEvidenceStep(
    `${prefix}-traffic-freeze-canary`,
    async (signal) =>
      await verifyStagingTrafficFreeze({
        projectRef,
        functionSlugs: publicFunctionSlugs,
        signal,
      }),
  );
}

async function schemaInventory(prefix, optionsOverride = {}) {
  const commandId = `${prefix}-schema-inventory`;
  const output = await query(commandId, 'staging-schema-inventory.sql', optionsOverride);
  const schema = parseSchemaInventory(output.stdout);
  noteSummary(commandId, schema);
  const cronProbeId = `${prefix}-cron-table-probe`;
  const cronProbe = await query(cronProbeId, 'staging-cron-table-exists.sql', optionsOverride);
  const cronTableExists = parseCronTableExists(cronProbe.stdout);
  noteSummary(cronProbeId, { cronTableExists });
  let cron = emptyCronInventory();
  if (cronTableExists) {
    const cronInventoryId = `${prefix}-cron-inventory`;
    const cronOutput = await query(
      cronInventoryId,
      'staging-cron-job-inventory.sql',
      optionsOverride,
    );
    cron = parseCronInventory(cronOutput.stdout);
    noteSummary(cronInventoryId, cron);
  }
  return { ...schema, ...cron };
}

async function deployManifest(prefix) {
  for (const { slug } of sourceInventory.functions) {
    await runSupabase(
      `${prefix}-${slug}`,
      ['functions', 'deploy', slug, '--project-ref', projectRef],
      { timeoutMs: 10 * 60_000 },
    );
  }
}

function sourceInventoryFingerprint(value) {
  return sha256(
    canonicalJson({
      migrationSetSha256: value.migrationSetSha256,
      functionSetSha256: value.functionSetSha256,
      functionManifestSha256: value.functionManifestSha256,
      denoLockSha256: value.denoLockSha256,
      deploymentInputSetSha256: value.deploymentInputSetSha256,
    }),
  );
}

function recordProcedureCheck(commandId, summary) {
  const now = new Date().toISOString();
  steps.push({
    commandId,
    startedAt: now,
    completedAt: now,
    result: 'pass',
    exitCode: 0,
    redaction: 'retained only an allowlisted aggregate summary',
    retainedSummarySha256: sha256(canonicalJson(summary)),
  });
  process.stdout.write(`[db06-staging] ${commandId}: PASS\n`);
}

function validateSnapshotAndSources(commandId, { allowSupabaseTemp }) {
  const snapshot = validateGitSnapshot(deploymentRoot, gitTreeEntries, gitObjectFormat, {
    allowSupabaseTemp,
  });
  if (
    snapshot.trackedFileCount !== sourceSnapshot.trackedFileCount ||
    snapshot.trackedFileSetSha256 !== sourceSnapshot.trackedFileSetSha256
  ) {
    stableFailure('DB06_SOURCE_SNAPSHOT_CHANGED');
  }
  const currentSource = buildSourceInventory(deploymentRoot);
  assertCurrentSourceContract(currentSource);
  if (sourceInventoryFingerprint(currentSource) !== sourceInventoryFingerprint(sourceInventory)) {
    stableFailure('DB06_SOURCE_SNAPSHOT_CHANGED');
  }
  recordProcedureCheck(commandId, {
    trackedFileCount: snapshot.trackedFileCount,
    trackedFileSetSha256: snapshot.trackedFileSetSha256,
    allowedRuntimeFileCount: snapshot.allowedRuntimeFileCount,
    runtimePathsSha256: snapshot.runtimePathsSha256,
    deploymentInputSetSha256: currentSource.deploymentInputSetSha256,
  });
  return snapshot;
}

async function assertSourceControlStillAtSnapshot() {
  const status = await runGit('git-clean-recheck-before-mutation', [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  if (status.stdout.trim()) stableFailure('DB06_GIT_WORKTREE_DIRTY');
  const branch = await runGit('git-branch-recheck-before-mutation', ['branch', '--show-current']);
  if (branch.stdout.trim() !== 'main') stableFailure('DB06_GIT_BRANCH_NOT_MAIN');
  await runGit('git-fetch-recheck-before-mutation', ['fetch', 'origin', 'main', '--quiet'], {
    timeoutMs: 60_000,
  });
  const head = await runGit('git-head-recheck-before-mutation', ['rev-parse', 'HEAD']);
  const origin = await runGit('git-origin-main-recheck-before-mutation', [
    'rev-parse',
    'origin/main',
  ]);
  if (head.stdout.trim() !== gitCommit || origin.stdout.trim() !== gitCommit) {
    stableFailure('DB06_GIT_NOT_EXACT_ORIGIN_MAIN');
  }
}

function validateCurrentCutover({
  requireFreshObservations = true,
  minimumCompletionBudgetMs = 0,
  now = new Date(),
} = {}) {
  const record = readJson(resolve(options['cutover-record']), 'DB06_CUTOVER_RECORD_INVALID');
  return validateCutoverRecord({
    record,
    pendingMigrationIds: sourceInventory.migrations.map(({ id }) => id),
    projectRefLast4,
    projectRefFingerprint,
    gitCommit,
    rollbackRef: options['rollback-ref'],
    operatorRole: options['operator-role'],
    evidenceDirectory: resolve(options['cutover-evidence-dir']),
    rawProjectRef: projectRef,
    now,
    requireFreshObservations,
    minimumCompletionBudgetMs,
  });
}

function currentRetainedArtifactNames() {
  return [
    'manifest.json',
    'deployment-log.jsonl',
    ...Object.keys(cutoverArtifacts),
    ...(linkedTypesText == null ? [] : ['database.types.linked.ts']),
  ];
}

async function captureFailureReadback() {
  const commandOptions = { timeoutMs: 60_000, ignoreInterruption: true };
  try {
    const schema = await schemaInventory('failure-readback', commandOptions);
    const migrationIds = await migrationInventory('failure-readback', commandOptions);
    const functions = await functionInventory('failure-readback', false, {
      commandOptions,
    });
    return {
      attempted: true,
      completed: true,
      capturedAt: new Date().toISOString(),
      schema,
      migrationCount: migrationIds.length,
      migrationIds,
      functions,
      interpretation: 'read-only snapshot only; containment is not inferred',
    };
  } catch (error) {
    return {
      attempted: true,
      completed: false,
      capturedAt: new Date().toISOString(),
      failureCode:
        error instanceof Db06EvidenceError ? error.code : 'DB06_FAILURE_READBACK_UNEXPECTED_ERROR',
      interpretation: 'remote state remains unknown',
    };
  }
}

try {
  const status = await runGit('git-clean-check', [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  if (status.stdout.trim()) stableFailure('DB06_GIT_WORKTREE_DIRTY');
  const branch = await runGit('git-branch-check', ['branch', '--show-current']);
  if (branch.stdout.trim() !== 'main') stableFailure('DB06_GIT_BRANCH_NOT_MAIN');
  await runGit('git-fetch-origin-main', ['fetch', 'origin', 'main', '--quiet'], {
    timeoutMs: 60_000,
  });
  const head = await runGit('git-head', ['rev-parse', 'HEAD']);
  const origin = await runGit('git-origin-main', ['rev-parse', 'origin/main']);
  gitCommit = head.stdout.trim();
  if (!/^[0-9a-f]{40}$/u.test(gitCommit) || origin.stdout.trim() !== gitCommit) {
    stableFailure('DB06_GIT_NOT_EXACT_ORIGIN_MAIN');
  }

  const installedPackage = readJson(
    join(REPO_ROOT, 'node_modules', 'supabase', 'package.json'),
    'DB06_CLI_PIN_INVALID',
  );
  if (installedPackage.version !== PINNED_CLI_VERSION) {
    stableFailure('DB06_CLI_PIN_INVALID');
  }
  const cliVersionResult = await runCommand('supabase-cli-version', CLI_BINARY, ['--version']);
  if (cliVersionResult.stdout.trim() !== PINNED_CLI_VERSION) {
    stableFailure('DB06_CLI_PIN_INVALID');
  }

  const objectFormatResult = await runGit('git-object-format', [
    'rev-parse',
    '--show-object-format',
  ]);
  gitObjectFormat = objectFormatResult.stdout.trim();
  const treeResult = await runGit(
    'git-source-tree-inventory',
    ['ls-tree', '-r', '-z', '--full-tree', gitCommit],
    { maxOutputBytes: 32 * 1024 * 1024 },
  );
  gitTreeEntries = parseGitTreeInventory(treeResult.stdout, gitObjectFormat);
  mkdirSync(deploymentRoot, { recursive: false });
  const archivePath = join(runtimeRoot, 'source.tar');
  await runGit(
    'git-source-snapshot-archive',
    ['archive', '--format=tar', '--output', archivePath, gitCommit],
    { timeoutMs: 2 * 60_000 },
  );
  await runCommand(
    'git-source-snapshot-extract',
    TAR_BINARY,
    ['-xf', archivePath, '-C', deploymentRoot],
    { timeoutMs: 2 * 60_000 },
  );
  rmSync(archivePath, { force: true });
  sourceSnapshot = {
    ...validateGitSnapshot(deploymentRoot, gitTreeEntries, gitObjectFormat),
    gitObjectFormat,
    materialization: 'git-archive-exact-commit-with-blob-verification',
  };
  recordProcedureCheck('git-source-snapshot-verify', sourceSnapshot);

  const sourcePackage = readJson(join(deploymentRoot, 'package.json'), 'DB06_CLI_PIN_INVALID');
  if (sourcePackage.devDependencies?.supabase !== PINNED_CLI_VERSION) {
    stableFailure('DB06_CLI_PIN_INVALID');
  }

  sourceInventory = buildSourceInventory(deploymentRoot);
  assertCurrentSourceContract(sourceInventory);
  if (process.platform === 'win32') {
    const runnerOutputPath = join(runtimeRoot, 'db06-windows-job-runner.exe');
    await runCommand(
      'windows-job-runner-build',
      POWERSHELL_BINARY,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        join(deploymentScriptDir, 'build-windows-job-runner.ps1'),
        '-SourcePath',
        join(deploymentScriptDir, 'windows-job-runner.cs'),
        '-OutputPath',
        runnerOutputPath,
      ],
      { timeoutMs: 2 * 60_000, useWindowsJob: false },
    );
    if (!existsSync(runnerOutputPath)) {
      stableFailure('DB06_WINDOWS_JOB_RUNNER_BUILD_FAILED');
    }
    windowsJobRunnerPath = runnerOutputPath;
  }
  await runCommand(
    'edge-manifest-source-check',
    process.execPath,
    [join(deploymentRoot, 'scripts', 'phase9', 'edge-function-manifest-check.mjs')],
    { cwd: deploymentRoot },
  );
  const localVerify = await runCommand(
    'local-database-verification',
    process.execPath,
    [join(deploymentScriptDir, 'local-supabase-reset.mjs'), '--verify'],
    {
      timeoutMs: 30 * 60_000,
      environment: {
        DB05_SOURCE_SUPABASE_DIR: join(deploymentRoot, 'supabase'),
        DB05_SUPABASE_CLI_BINARY: CLI_BINARY,
        DB05_INHERIT_PARENT_PROCESS_GROUP: '1',
      },
    },
  );
  localTypes = parseLocalTypeSummary(localVerify.stdout);
  noteSummary('local-database-verification', localTypes);

  repositoryTypesPath = join(deploymentRoot, 'packages', 'types', 'src', 'database.types.ts');
  repositoryTypesBeforeSha256 = sha256(readFileSync(repositoryTypesPath));
  repositoryTypes = summarizeGeneratedTypes(readFileSync(repositoryTypesPath, 'utf8'));
  if (repositoryTypes.sha256 !== localTypes.sha256) {
    stableFailure('DB08_REPOSITORY_TYPES_DIVERGED');
  }
  await runSupabase('link-staging-project', ['link', '--project-ref', projectRef], {
    timeoutMs: 2 * 60_000,
  });
  assertLinkedProjectBinding();
  validateSnapshotAndSources('source-snapshot-after-link', { allowSupabaseTemp: true });

  const beforeSchema = await schemaInventory('before');
  const beforeMigrationIds = await migrationInventory('before');
  const beforeFunctions = await functionInventory('before', false);
  const beforeSecrets = await secretInventory('before');
  const beforeAuthIngressFreeze = await authIngressFreezeInventory('before');
  assertRemoteMigrationPrefix(sourceInventory, beforeMigrationIds);
  assertFreshStagingTarget({
    schema: beforeSchema,
    migrationIds: beforeMigrationIds,
    functions: beforeFunctions,
  });
  if (beforeSecrets.missingGroupIds.length > 0) {
    stableFailure('DB06_REQUIRED_HOSTED_CONFIGURATION_MISSING');
  }

  before = {
    schema: beforeSchema,
    migrationCount: beforeMigrationIds.length,
    migrationIds: beforeMigrationIds,
    functions: beforeFunctions,
    secretConfiguration: beforeSecrets,
    authIngressFreeze: beforeAuthIngressFreeze,
  };

  await assertSourceControlStillAtSnapshot();
  validateSnapshotAndSources('source-snapshot-before-first-mutation', {
    allowSupabaseTemp: true,
  });
  const initialCutoverValidatedAt = new Date();
  const validatedCutover = validateCurrentCutover({
    minimumCompletionBudgetMs: DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS,
    now: initialCutoverValidatedAt,
  });
  cutoverArtifacts = validatedCutover.retainedArtifacts;
  cutover = {
    ...validatedCutover.summary,
    retainedArtifactsSha256: sha256(canonicalJson(cutoverArtifacts)),
    initialPreMutationValidation: {
      validatedAt: validatedCutover.completionWindow.validatedAt,
      freshObservations: true,
      minimumCompletionBudgetMs: validatedCutover.completionWindow.minimumCompletionBudgetMs,
      validityRemainingMs: validatedCutover.completionWindow.validityRemainingMs,
      holdRemainingMs: validatedCutover.completionWindow.holdRemainingMs,
    },
  };
  retentionReviewAt = cutover.retentionReviewAt;

  const evidenceId = options['evidence-id'] ?? evidenceIdFor(started, gitCommit);
  validateEvidenceId(evidenceId);
  evidenceDirectory = reserveEvidenceDirectory(EVIDENCE_ROOT, evidenceId, {
    schemaVersion: 1,
    evidenceId,
    result: 'in-progress',
    startedAt: started.toISOString(),
    gitCommit,
    operatorRole: options['operator-role'],
    projectRefLast4,
    projectRefFingerprint,
  });

  remoteMutationStarted = true;
  await runSupabase('set-staging-app-environment-and-traffic-freeze', [
    'secrets',
    'set',
    'APP_ENV=staging',
    'EXPO_PUBLIC_APP_ENV=staging',
    'DB06_TRAFFIC_FREEZE=frozen',
    '--project-ref',
    projectRef,
  ]);
  const preMigrationSecrets = await secretInventory('pre-migration', {
    attempts: INVENTORY_RETRY_ATTEMPTS,
    requireAppEnvironment: true,
    requireTrafficFreeze: true,
  });
  if (
    preMigrationSecrets.missingGroupIds.length > 0 ||
    !preMigrationSecrets.appEnvironmentNamesPresent ||
    !preMigrationSecrets.trafficFreezeNamePresent
  ) {
    stableFailure('DB06_REQUIRED_HOSTED_CONFIGURATION_MISSING');
  }

  await deployManifest('pre-migration-deploy');
  const preMigrationFunctions = await functionInventory('pre-migration', true, {
    attempts: INVENTORY_RETRY_ATTEMPTS,
  });
  const preMigrationTrafficFreezeCanary = await trafficFreezeCanary('pre-migration');
  preMigration = {
    functions: preMigrationFunctions,
    secretConfiguration: preMigrationSecrets,
    trafficFreezeCanary: preMigrationTrafficFreezeCanary,
    trafficFreezeState: 'frozen-and-retained-through-downstream-release-gate',
  };

  await runSupabase('migration-dry-run-before-push', ['db', 'push', '--linked', '--dry-run'], {
    timeoutMs: 10 * 60_000,
  });
  validateSnapshotAndSources('source-snapshot-before-migration-push', {
    allowSupabaseTemp: true,
  });
  assertLinkedProjectBinding();
  const immediatePreMigrationFunctions = await functionInventory('immediate-pre-migration', true);
  if (canonicalJson(immediatePreMigrationFunctions) !== canonicalJson(preMigrationFunctions)) {
    stableFailure('DB06_PRE_MIGRATION_FUNCTION_INVENTORY_CHANGED');
  }
  const immediatePreMigrationCanary = await trafficFreezeCanary('immediate-pre-migration');
  const immediatePreMigrationAuthFreeze =
    await authIngressFreezeInventory('immediate-pre-migration');
  const immediatePreMigrationIds = await migrationInventory('immediate-pre-migration');
  const immediatePreMigrationSchema = await schemaInventory('immediate-pre-migration');
  assertFreshStagingBoundary({
    schema: immediatePreMigrationSchema,
    migrationIds: immediatePreMigrationIds,
  });
  preMigration.immediateTargetRevalidation = {
    capturedAt: new Date().toISOString(),
    schema: immediatePreMigrationSchema,
    migrationCount: immediatePreMigrationIds.length,
    migrationIds: immediatePreMigrationIds,
    functions: immediatePreMigrationFunctions,
    authIngressFreeze: immediatePreMigrationAuthFreeze,
    trafficFreezeCanary: immediatePreMigrationCanary,
  };
  const immediateCutoverValidatedAt = new Date();
  const revalidatedCutover = validateCurrentCutover({
    requireFreshObservations: false,
    minimumCompletionBudgetMs: DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS,
    now: immediateCutoverValidatedAt,
  });
  if (
    revalidatedCutover.summary.recordSha256 !== cutover.recordSha256 ||
    sha256(canonicalJson(revalidatedCutover.retainedArtifacts)) !== cutover.retainedArtifactsSha256
  ) {
    stableFailure('DB06_CUTOVER_RECORD_CHANGED');
  }
  preMigration.immediateCutoverRevalidation = {
    validatedAt: revalidatedCutover.completionWindow.validatedAt,
    recordSha256: revalidatedCutover.summary.recordSha256,
    retainedArtifactsSha256: sha256(canonicalJson(revalidatedCutover.retainedArtifacts)),
    freshObservations: false,
    observationFreshnessBasis: 'initial-pre-mutation',
    currentValidityAndHold: true,
    minimumCompletionBudgetMs: revalidatedCutover.completionWindow.minimumCompletionBudgetMs,
    validityRemainingMs: revalidatedCutover.completionWindow.validityRemainingMs,
    holdRemainingMs: revalidatedCutover.completionWindow.holdRemainingMs,
    validUntil: revalidatedCutover.summary.validUntil,
    holdUntil: revalidatedCutover.summary.trafficProviderFreeze.holdUntil,
  };
  await runSupabase('migration-push', ['db', 'push', '--linked'], { timeoutMs: 20 * 60_000 });
  const afterPushMigrationIds = await migrationInventory('after-push');
  if (
    afterPushMigrationIds.length !== sourceInventory.migrationCount ||
    afterPushMigrationIds.some((id, index) => id !== sourceInventory.migrations[index].id)
  ) {
    stableFailure('DB06_AFTER_MIGRATION_HISTORY_INCOMPLETE');
  }

  await deployManifest('post-migration-deploy');
  await runSupabase('migration-dry-run-after-push', ['db', 'push', '--linked', '--dry-run'], {
    timeoutMs: 10 * 60_000,
  });
  await runSupabase(
    'linked-pgtap',
    ['test', 'db', '--linked', join(deploymentRoot, 'supabase', 'tests', 'database')],
    { timeoutMs: 20 * 60_000 },
  );
  await runSupabase(
    'linked-database-lint',
    ['db', 'lint', '--linked', '--schema', 'public', '--level', 'error', '--fail-on', 'error'],
    { timeoutMs: 10 * 60_000 },
  );
  const linkedDiffPath = join(runtimeRoot, 'linked-schema-diff.sql');
  const linkedDiffCommand = await runSupabase(
    'linked-schema-diff',
    ['db', 'diff', '--linked', '--schema', 'public,auth,storage', '--output', linkedDiffPath],
    { timeoutMs: 20 * 60_000 },
  );
  if (!existsSync(linkedDiffPath) && !reportsPinnedEmptySchemaDiff(linkedDiffCommand)) {
    stableFailure('DB06_LINKED_SCHEMA_DIFF_MISSING');
  }
  const linkedDiff = existsSync(linkedDiffPath) ? readFileSync(linkedDiffPath, 'utf8') : '';
  if (semanticSql(linkedDiff)) stableFailure('DB06_LINKED_SCHEMA_DRIFT');
  noteSummary('linked-schema-diff', { semanticDrift: false });

  const linkedTypesOutput = await runSupabase(
    'generate-linked-types',
    ['gen', 'types', '--linked', '--lang', 'typescript', '--schema', 'public'],
    { timeoutMs: 10 * 60_000 },
  );
  linkedTypesText = linkedTypesOutput.stdout;
  const linkedTypes = summarizeGeneratedTypes(linkedTypesText);
  noteSummary('generate-linked-types', linkedTypes);
  types = {
    localGenerated: localTypes,
    linkedGenerated: linkedTypes,
    repositoryGenerated: repositoryTypes,
    localAndLinkedIdentical: localTypes.sha256 === linkedTypes.sha256,
    repositoryLocalAndLinkedIdentical:
      repositoryTypes.sha256 === localTypes.sha256 && localTypes.sha256 === linkedTypes.sha256,
    repositoryTypesBeforeSha256,
    repositoryTypesAfterSha256: null,
    repositoryTypesReplaced: false,
    retainedArtifact: 'database.types.linked.ts',
  };

  const afterSchema = await schemaInventory('after');
  const afterMigrationIds = await migrationInventory('after');
  const afterFunctions = await functionInventory('after', true, {
    attempts: INVENTORY_RETRY_ATTEMPTS,
  });
  const postMigrationTrafficFreezeCanary = await trafficFreezeCanary('after');
  const afterAuthIngressFreeze = await authIngressFreezeInventory('after');
  const afterSecrets = await secretInventory('after', {
    attempts: INVENTORY_RETRY_ATTEMPTS,
    requireAppEnvironment: true,
    requireTrafficFreeze: true,
  });
  const repositoryTypesAfterSha256 = sha256(readFileSync(repositoryTypesPath));
  if (repositoryTypesAfterSha256 !== repositoryTypesBeforeSha256) {
    stableFailure('DB06_REPOSITORY_TYPES_CHANGED');
  }
  types.repositoryTypesAfterSha256 = repositoryTypesAfterSha256;
  after = {
    schema: afterSchema,
    migrationCount: afterMigrationIds.length,
    migrationIds: afterMigrationIds,
    functions: afterFunctions,
    secretConfiguration: afterSecrets,
    authIngressFreeze: afterAuthIngressFreeze,
    trafficFreezeCanary: postMigrationTrafficFreezeCanary,
    trafficFreezeState: 'frozen-and-retained-through-downstream-release-gate',
    linkedPgTap: 'pass',
    linkedDatabaseLint: 'pass',
    linkedSchemaDrift: 'empty',
    migrationDryRunAfterPush: 'no-pending-change',
  };
  validateCompletedDeployment({
    sourceInventory,
    beforeMigrationIds,
    preMigrationFunctions,
    afterMigrationIds,
    afterFunctions,
    afterSchema,
    afterSecrets,
    localTypes,
    linkedTypes,
    repositoryTypes,
  });
  if (interruptionCode) stableFailure(interruptionCode);
  validateSnapshotAndSources('source-snapshot-after-deployment', {
    allowSupabaseTemp: true,
  });
  const finalCutoverValidatedAt = new Date();
  const finalValidatedCutover = validateCurrentCutover({
    requireFreshObservations: false,
    now: finalCutoverValidatedAt,
  });
  const finalRetainedArtifactsSha256 = sha256(
    canonicalJson(finalValidatedCutover.retainedArtifacts),
  );
  if (
    finalValidatedCutover.summary.recordSha256 !== cutover.recordSha256 ||
    finalRetainedArtifactsSha256 !== cutover.retainedArtifactsSha256
  ) {
    stableFailure('DB06_CUTOVER_RECORD_CHANGED');
  }
  after.finalCutoverRevalidation = {
    validatedAt: finalValidatedCutover.completionWindow.validatedAt,
    recordSha256: finalValidatedCutover.summary.recordSha256,
    retainedArtifactsSha256: finalRetainedArtifactsSha256,
    validAtCompletion: true,
    observationRecencyValidatedAtInitialGate: true,
    finalGateRevalidatedCurrentValidityAndHold: true,
    minimumCompletionBudgetMs: finalValidatedCutover.completionWindow.minimumCompletionBudgetMs,
    validityRemainingMs: finalValidatedCutover.completionWindow.validityRemainingMs,
    holdRemainingMs: finalValidatedCutover.completionWindow.holdRemainingMs,
    observationFreshnessBasis: 'initial-pre-mutation',
    validUntil: finalValidatedCutover.summary.validUntil,
    holdUntil: finalValidatedCutover.summary.trafficProviderFreeze.holdUntil,
  };

  runtime = {
    operatingSystem: `${process.platform}-${process.arch}`,
    nodeVersion: process.version,
    supabaseCliVersion: PINNED_CLI_VERSION,
    supabaseCliBinarySha256: CLI_BINARY_SHA256,
    powershellVersion: process.env.DB06_POWERSHELL_VERSION ?? 'wrapper-not-reported',
  };
  const completedAt = new Date().toISOString();
  const manifest = buildEvidenceManifest({
    evidenceId,
    result: 'pass',
    gitCommit,
    startedAt: started.toISOString(),
    completedAt,
    operatorRole: options['operator-role'],
    projectRefLast4,
    projectRefFingerprint,
    rollbackRef: options['rollback-ref'],
    sourceInventory,
    sourceSnapshot,
    runtime,
    steps,
    cutover,
    before,
    preMigration,
    after,
    types,
    retentionReviewAt,
    retainedArtifactNames: currentRetainedArtifactNames(),
    remoteMutationStarted,
  });
  assertEvidenceSafe(manifest, projectRef);
  finalizeEvidenceDirectory(evidenceDirectory, manifest, steps, projectRef, {
    linkedTypes: linkedTypesText,
    additionalArtifacts: cutoverArtifacts,
  });
  evidenceFinalized = true;
  process.stdout.write(`[db06-staging] evidence finalized: ${evidenceId}\n`);
} catch (error) {
  const failureCode =
    error instanceof Db06EvidenceError
      ? error.code
      : 'DB06_UNEXPECTED_FAILURE_REMOTE_STATE_UNKNOWN';
  if (evidenceDirectory && !evidenceFinalized && sourceInventory && gitCommit) {
    try {
      if (
        remoteMutationStarted &&
        !interruptionCode &&
        !failureCode.includes('TERMINATION_UNCONFIRMED')
      ) {
        failureReadback = await captureFailureReadback();
      }
      runtime ??= {
        operatingSystem: `${process.platform}-${process.arch}`,
        nodeVersion: process.version,
        supabaseCliVersion: PINNED_CLI_VERSION,
        powershellVersion: process.env.DB06_POWERSHELL_VERSION ?? 'wrapper-not-reported',
      };
      const evidenceId = evidenceDirectory.split(/[\\/]/u).at(-1);
      const manifest = buildEvidenceManifest({
        evidenceId,
        result: 'fail',
        gitCommit,
        startedAt: started.toISOString(),
        completedAt: new Date().toISOString(),
        operatorRole: options['operator-role'],
        projectRefLast4,
        projectRefFingerprint,
        rollbackRef: options['rollback-ref'],
        sourceInventory,
        sourceSnapshot,
        runtime,
        steps,
        cutover: cutover ?? null,
        before: before ?? null,
        preMigration: preMigration ?? null,
        after: after ?? null,
        types: types ?? null,
        retentionReviewAt,
        retainedArtifactNames: currentRetainedArtifactNames(),
        failureReadback,
        remoteMutationStarted,
        failureCode,
      });
      finalizeEvidenceDirectory(evidenceDirectory, manifest, steps, projectRef, {
        linkedTypes: linkedTypesText,
        additionalArtifacts: cutoverArtifacts,
      });
      evidenceFinalized = true;
    } catch {
      process.stderr.write('[db06-staging] DB06_FAILURE_EVIDENCE_FINALIZATION_FAILED\n');
    }
  }
  process.stderr.write(`[db06-staging] ${failureCode}\n`);
  process.exitCode = 1;
} finally {
  process.off('SIGINT', onSigint);
  process.off('SIGTERM', onSigterm);
  if (!preserveRuntimeRoot) {
    rmSync(runtimeRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
  } else {
    process.stderr.write(
      `[db06-staging] ${containmentRecovery.code} PRESERVED ${containmentRecovery.runtimeRootPathSha256} ${runtimeRoot}\n`,
    );
  }
}
