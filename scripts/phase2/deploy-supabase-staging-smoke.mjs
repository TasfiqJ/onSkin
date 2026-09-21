#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const wrapper = readFileSync('scripts/phase2/deploy-supabase-staging.ps1', 'utf8');
const orchestrator = readFileSync('scripts/phase2/deploy-supabase-staging.mjs', 'utf8');
const evidenceLibrary = readFileSync('scripts/phase2/staging-deployment-evidence-lib.mjs', 'utf8');
const containedCommand = readFileSync('scripts/phase2/contained-command.mjs', 'utf8');
const boundedResponseBody = readFileSync('scripts/phase2/bounded-response-body.mjs', 'utf8');
const trafficFreezeCanary = readFileSync(
  'scripts/phase2/staging-traffic-freeze-canary.mjs',
  'utf8',
);
const trafficFreezeHelper = readFileSync(
  'supabase/functions/_shared/stagingTrafficFreeze.ts',
  'utf8',
);
const localReset = readFileSync('scripts/phase2/local-supabase-reset.mjs', 'utf8');
const schemaDiffEvidence = readFileSync('scripts/phase2/schema-diff-evidence.mjs', 'utf8');
const cutoverPreparation = readFileSync('scripts/phase2/prepare-staging-cutover.mjs', 'utf8');
const windowsJobRunner = readFileSync('scripts/phase2/windows-job-runner.cs', 'utf8');
const schemaInventorySql = readFileSync('scripts/phase2/staging-schema-inventory.sql', 'utf8');
const cronInventorySql = readFileSync('scripts/phase2/staging-cron-job-inventory.sql', 'utf8');
const cliHelper = readFileSync('scripts/phase2/read-edge-app-environment.ts', 'utf8');
const edgeHelper = readFileSync('supabase/functions/_shared/env.ts', 'utf8');
const manifest = JSON.parse(readFileSync('supabase/functions/manifest.json', 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  cliHelper.includes("from '../../supabase/functions/_shared/env.ts'") &&
    cliHelper.includes('readEdgeAppEnvironment()'),
  'The deployment wrapper must use the same environment resolver as Edge Functions.',
);
assert(
  wrapper.includes('read-edge-app-environment.ts') &&
    wrapper.includes('--allow-env=APP_ENV,EXPO_PUBLIC_APP_ENV'),
  'The wrapper must invoke the shared resolver with only the app-environment permissions.',
);
assert(
  wrapper.indexOf('$appEnv = Read-AppEnvironment') < wrapper.indexOf('& node @arguments'),
  'Environment validation must run before the deployment orchestrator.',
);
assert(
  wrapper.includes("$ProjectRef -notmatch '^[a-z0-9]{20}$'") &&
    wrapper.includes('EXPECTED_SUPABASE_PROJECT_REF_MISMATCH'),
  'The wrapper must validate and independently bind the staging project ref.',
);
assert(
  wrapper.includes('DB06_OPERATOR_ROLE_REQUIRED') &&
    wrapper.includes('DB06_ROLLBACK_REF_REQUIRED') &&
    wrapper.includes('DB06_CUTOVER_RECORD_REQUIRED') &&
    wrapper.includes('DB06_CUTOVER_EVIDENCE_DIRECTORY_REQUIRED'),
  'The wrapper must require operator, rollback, and retained cutover-attestation inputs.',
);
assert(
  wrapper.includes('if ($appEnv -ne "staging")') &&
    wrapper.includes('STAGING_DEPLOY_REQUIRES_APP_ENV_STAGING') &&
    !wrapper.includes('PHASE2_ALLOW_PRODUCTION_DEPLOY'),
  'The wrapper must reject every non-staging environment without an override.',
);
assert(
  !wrapper.includes('Write-Host "Linking Supabase project $ProjectRef"') &&
    !wrapper.includes('supabase link --project-ref'),
  'The wrapper must not print the raw target or invoke an unpinned PATH Supabase CLI.',
);

assert(
  orchestrator.includes("const PINNED_CLI_VERSION = '2.117.0'") &&
    orchestrator.includes('`@supabase/cli-${suffix}/package.json`') &&
    orchestrator.includes('const CLI_BINARY = resolvePinnedSupabaseBinary()') &&
    orchestrator.includes('const CLI_BINARY_SHA256 = sha256(readFileSync(CLI_BINARY))') &&
    orchestrator.includes('assertPinnedCliBinaryUnchanged()') &&
    orchestrator.includes('runContainedCommand') &&
    orchestrator.includes("'windows-job-runner-build'") &&
    containedCommand.includes('await terminateProcessTree(child') &&
    containedCommand.includes('await waitForCloseOrNull') &&
    windowsJobRunner.includes('JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE') &&
    windowsJobRunner.includes('WaitForEmptyJob(job)') &&
    windowsJobRunner.includes('File.Exists(cancellationPath)') &&
    containedCommand.includes("preserveCancellation: containment === 'unconfirmed'") &&
    orchestrator.includes('DB06_RUNTIME_CONTAINMENT_RECOVERY_REQUIRED') &&
    orchestrator.includes('if (!preserveRuntimeRoot)') &&
    !orchestrator.includes("'node_modules', 'supabase', 'dist', 'supabase.js'") &&
    orchestrator.includes('sourcePackage.devDependencies?.supabase !== PINNED_CLI_VERSION') &&
    orchestrator.includes('installedPackage.version !== PINNED_CLI_VERSION'),
  'The orchestrator must execute the pinned native Supabase binary and prove complete process containment before settlement.',
);
assert(
  orchestrator.includes('DB06_GIT_WORKTREE_DIRTY') &&
    orchestrator.includes('DB06_GIT_BRANCH_NOT_MAIN') &&
    orchestrator.includes('DB06_GIT_NOT_EXACT_ORIGIN_MAIN'),
  'A deployment must originate from a clean revision exactly matching origin/main.',
);
assert(
  orchestrator.includes(
    'assertPinnedMigrationRunnerCompatibility(deploymentRoot, PINNED_CLI_VERSION)',
  ) &&
    orchestrator.indexOf(
      'assertPinnedMigrationRunnerCompatibility(deploymentRoot, PINNED_CLI_VERSION)',
    ) < orchestrator.indexOf("'link-staging-project'") &&
    evidenceLibrary.includes('DB06_CURRENT_CHAIN_REPLAY_REQUIRED'),
  'The unproven current migration chain must be rejected before staging is linked or mutated.',
);
assert(
  orchestrator.includes("'git-source-snapshot-archive'") &&
    orchestrator.includes('validateGitSnapshot(') &&
    orchestrator.includes("'source-snapshot-before-first-mutation'") &&
    orchestrator.includes("'source-snapshot-before-migration-push'") &&
    orchestrator.includes("'source-snapshot-after-deployment'") &&
    orchestrator.includes("'--workdir', deploymentRoot"),
  'Every deployment input must come from a blob-verified immutable Git snapshot that is rechecked around mutations.',
);
assert(
  orchestrator.includes('DB05_SUPABASE_CLI_BINARY: CLI_BINARY') &&
    orchestrator.includes("DB05_INHERIT_PARENT_PROCESS_GROUP: '1'") &&
    orchestrator.includes('DB05_SOURCE_SUPABASE_DIR: join(deploymentRoot') &&
    localReset.includes('DB05_SUPABASE_CLI_BINARY') &&
    localReset.includes('DB05_INHERIT_PARENT_PROCESS_GROUP') &&
    containedCommand.includes('inherited-parent-process-group') &&
    containedCommand.includes('delegated-to-parent-process-group') &&
    containedCommand.includes('detached: !inheritParentProcessGroup') &&
    localReset.includes("join(REPO_ROOT, 'package.json')") &&
    localReset.includes('CLI_COMMAND = canonicalBinary') &&
    localReset.includes('Local schema diff artifact is missing.') &&
    localReset.includes('LOCAL_CLI_MAX_OUTPUT_BYTES') &&
    localReset.includes('LOCAL_CLI_TIMEOUT_MS') &&
    localReset.includes('runContainedCommand({') &&
    localReset.includes('maxOutputBytes,') &&
    localReset.includes('timeoutMs,') &&
    !localReset.includes("readFile(driftPath, 'utf8').catch(() => '')"),
  'The snapshot local replay must consume snapshot sources with the separately hash-bound pinned CLI runtime.',
);
assert(
  orchestrator.includes('assertFreshStagingTarget({') &&
    evidenceLibrary.includes('DB06_TARGET_NOT_EMPTY_FRESH_STAGING'),
  'DB-06 automation must refuse non-empty or incremental staging targets.',
);
assert(
  cutoverPreparation.includes('sha256(`db06-project-ref-v1\\0${projectRef}`)') &&
    cutoverPreparation.includes('sha256(canonicalJson(migrationIds))') &&
    cutoverPreparation.includes('rawProjectRefRetained: false') &&
    cutoverPreparation.includes('DB06_PREPARATION_REQUIRES_CLEAN_ORIGIN_MAIN'),
  'The operator preparation helper must derive the exact credential-safe target and migration hashes only from clean origin/main.',
);
assert(
  schemaInventorySql.includes('from auth.users') &&
    schemaInventorySql.includes('from auth.identities') &&
    schemaInventorySql.includes("provider = 'apple'") &&
    schemaInventorySql.includes('from auth.sessions') &&
    schemaInventorySql.includes('from storage.buckets') &&
    schemaInventorySql.includes('from storage.objects') &&
    schemaInventorySql.includes('as public_other_objects') &&
    cronInventorySql.includes("'account-deletion-work-lane'") &&
    cronInventorySql.includes("'health-consent-work-lane'") &&
    cronInventorySql.includes("'apple-auth-work-lane'") &&
    cronInventorySql.includes('as all_cron_jobs'),
  'Fresh staging must prove zero public objects, Auth, Storage, and every Cron job with aggregate-only queries.',
);
assert(
  orchestrator.includes("secretInventory('before')") &&
    orchestrator.includes('DB06_REQUIRED_HOSTED_CONFIGURATION_MISSING') &&
    orchestrator.indexOf('beforeSecrets.missingGroupIds.length') <
      orchestrator.indexOf('remoteMutationStarted = true'),
  'Required hosted configuration names must be checked before remote mutation.',
);
assert(
  orchestrator.includes("'APP_ENV=staging'") &&
    orchestrator.includes("'EXPO_PUBLIC_APP_ENV=staging'") &&
    orchestrator.includes("'DB06_TRAFFIC_FREEZE=frozen'") &&
    !orchestrator.includes("'DB06_TRAFFIC_FREEZE=open'") &&
    orchestrator.indexOf("'set-staging-app-environment-and-traffic-freeze'") <
      orchestrator.indexOf("await deployManifest('pre-migration-deploy')"),
  'The staging environment and closed traffic fence must be synchronized before function deployment and never released by DB-06.',
);
assert(
  orchestrator.includes("'/config/auth'") &&
    orchestrator.includes("'/config/auth/sso/providers'") &&
    orchestrator.includes("'/config/auth/third-party-auth'") &&
    orchestrator.includes('readBoundedResponseBody(response') &&
    boundedResponseBody.includes('reader.cancel()') &&
    boundedResponseBody.includes('BOUNDED_RESPONSE_TOO_LARGE'),
  'Hosted Auth closure must be read from every reviewed Management API surface with bounded response bodies.',
);
assert(
  trafficFreezeCanary.includes('response.status !== 503') &&
    trafficFreezeCanary.includes("includes('no-store')") &&
    trafficFreezeCanary.includes('DB06_STAGING_TRAFFIC_FROZEN') &&
    trafficFreezeCanary.includes('readBoundedResponseBody(response') &&
    trafficFreezeHelper.includes("freeze === 'frozen'") &&
    trafficFreezeHelper.includes("appEnvironment === 'staging' && freeze !== 'open'"),
  'The public canary and Edge helper must fail closed and accept only the exact 503/no-store freeze response.',
);
assert(
  orchestrator.indexOf("await deployManifest('pre-migration-deploy')") <
    orchestrator.indexOf("'migration-push'") &&
    orchestrator.indexOf("'migration-push'") <
      orchestrator.indexOf("await deployManifest('post-migration-deploy')"),
  'The complete compatible manifest must be deployed before protected migrations and again afterward.',
);
assert(
  orchestrator.includes('minimumCompletionBudgetMs: DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS') &&
    orchestrator.includes('minimumCompletionBudgetMs: DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS') &&
    orchestrator.includes('const revalidatedCutover = validateCurrentCutover({') &&
    orchestrator.includes('const finalValidatedCutover = validateCurrentCutover({') &&
    orchestrator.includes('requireFreshObservations: false') &&
    orchestrator.includes('after.finalCutoverRevalidation = {') &&
    orchestrator.indexOf('const revalidatedCutover = validateCurrentCutover({') <
      orchestrator.indexOf("await runSupabase('migration-push'") &&
    orchestrator.indexOf('const finalValidatedCutover = validateCurrentCutover({') <
      orchestrator.indexOf('const completedAt = new Date().toISOString()'),
  'The source-bound cutover attestation must be current before mutation, immediately before migration push, and again at successful completion.',
);
assert(
  orchestrator.includes('assertFreshStagingBoundary({') &&
    /trafficFreezeCanary\(\s*'immediate-pre-migration'\s*\)/u.test(orchestrator) &&
    /authIngressFreezeInventory\(\s*'immediate-pre-migration'\s*\)/u.test(orchestrator) &&
    /migrationInventory\(\s*'immediate-pre-migration'\s*\)/u.test(orchestrator) &&
    /schemaInventory\(\s*'immediate-pre-migration'\s*\)/u.test(orchestrator) &&
    orchestrator.includes('preMigration.immediateCutoverRevalidation = {') &&
    orchestrator.includes("observationFreshnessBasis: 'initial-pre-mutation'") &&
    orchestrator.includes('currentValidityAndHold: true') &&
    orchestrator.includes('validityRemainingMs: revalidatedCutover.completionWindow') &&
    orchestrator.includes('holdRemainingMs: revalidatedCutover.completionWindow') &&
    orchestrator.indexOf('preMigration.immediateTargetRevalidation = {') <
      orchestrator.indexOf('const revalidatedCutover = validateCurrentCutover({') &&
    orchestrator.indexOf('const revalidatedCutover = validateCurrentCutover({') <
      orchestrator.indexOf("await runSupabase('migration-push'"),
  'The exact function set, traffic freeze, Auth closure, migration history, public schema, Storage, and all Cron jobs must be re-read immediately before migration 0055.',
);
assert(
  orchestrator.includes("'linked-pgtap'") &&
    orchestrator.includes("'linked-database-lint'") &&
    orchestrator.includes("'linked-schema-diff'") &&
    orchestrator.includes('DB06_LINKED_SCHEMA_DRIFT'),
  'The hosted schema must pass pgTAP, error lint, and an empty linked diff.',
);
assert(
  orchestrator.includes('DB06_LINKED_SCHEMA_DIFF_MISSING') &&
    orchestrator.includes('reportsPinnedEmptySchemaDiff(linkedDiffCommand)') &&
    /const linkedDiffCommand\s*=\s*await runSupabase\(\s*'linked-schema-diff'/u.test(
      orchestrator,
    ) &&
    !/const linkedDiffCommand\s*=\s*await runSupabase\(\s*'linked-pgtap'/u.test(orchestrator) &&
    localReset.includes('stdout: driftCommand.output') &&
    localReset.includes('stderr: driftCommand.errors') &&
    schemaDiffEvidence.includes("const expected = 'No schema changes found'") &&
    schemaDiffEvidence.includes('stderrMatches === 1 && stdoutMatches === 0'),
  'A missing diff artifact must fail closed unless the hash-bound pinned CLI emits its exact singular stderr-only empty-diff signal.',
);
assert(
  orchestrator.includes('localTypes.sha256 === linkedTypes.sha256') &&
    orchestrator.includes('repositoryTypes.sha256 === localTypes.sha256') &&
    orchestrator.includes("stableFailure('DB08_REPOSITORY_TYPES_DIVERGED')") &&
    orchestrator.includes('repositoryGenerated: repositoryTypes') &&
    orchestrator.includes('repositoryTypesAfterSha256 !== repositoryTypesBeforeSha256') &&
    orchestrator.includes('repositoryTypesReplaced: false') &&
    !orchestrator.includes('Move-Item -LiteralPath'),
  'DB-06 must prove repository/local/linked type parity without mutating the repository artifact.',
);
assert(
  orchestrator.includes('MAX_OUTPUT_BYTES') &&
    orchestrator.includes('DEFAULT_TIMEOUT_MS') &&
    orchestrator.includes("'OUTPUT_LIMIT'") &&
    orchestrator.includes("'TIMEOUT'"),
  'Every child command must have bounded output, a timeout, and an exit-code gate.',
);
assert(
  orchestrator.includes('reserveEvidenceDirectory(') &&
    orchestrator.includes('finalizeEvidenceDirectory(') &&
    evidenceLibrary.includes("flag: 'wx'") &&
    evidenceLibrary.indexOf("writeFinalFile('checksums.sha256'") <
      evidenceLibrary.indexOf("writeFinalFile('manifest.json'") &&
    evidenceLibrary.includes('DB06_EVIDENCE_DIRECTORY_EXISTS'),
  'Evidence must be reserved exclusively, support partial recovery, write the manifest last, and never overwrite mismatched bytes.',
);
assert(
  evidenceLibrary.includes('discarded raw CLI stdout and stderr') &&
    evidenceLibrary.includes('DB06_EVIDENCE_REDACTION_FAILED') &&
    evidenceLibrary.includes('database.types.linked.ts'),
  'The evidence contract must retain only redacted structured results and the linked type artifact.',
);

assert(
  edgeHelper.includes("read('APP_ENV')") &&
    edgeHelper.includes("read('EXPO_PUBLIC_APP_ENV')") &&
    edgeHelper.includes('APP_ENV_NOT_CONFIGURED') &&
    edgeHelper.includes('APP_ENV_CONFLICT'),
  'The Edge resolver must require APP_ENV and reject contradictory public configuration.',
);
for (const [name, definition] of Object.entries(manifest.functions)) {
  const appEnvGroups = definition.requiredEnvironment.filter(
    (group) => Array.isArray(group) && group.length === 1 && group[0] === 'APP_ENV',
  );
  assert(appEnvGroups.length === 1, `${name} must require exactly one APP_ENV group.`);
  assert(
    definition.optionalEnvironment.includes('EXPO_PUBLIC_APP_ENV'),
    `${name} must declare the optional public consistency value.`,
  );
  const freezeGroups = definition.requiredEnvironment.filter(
    (group) => Array.isArray(group) && group.length === 1 && group[0] === 'DB06_TRAFFIC_FREEZE',
  );
  assert(freezeGroups.length === 1, `${name} must require exactly one DB06_TRAFFIC_FREEZE group.`);
  const functionSource = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8');
  const serveIndex = functionSource.indexOf('Deno.serve');
  const freezeGuardIndex = functionSource.indexOf('stagingTrafficFreezeResponse()', serveIndex);
  assert(
    serveIndex >= 0 && freezeGuardIndex > serveIndex,
    `${name} must invoke the staging traffic freeze at the request entrypoint.`,
  );
}

const publicFunctionCount = Object.values(manifest.functions).filter(
  ({ verifyJwt }) => verifyJwt === false,
).length;
assert(
  publicFunctionCount === 8 &&
    orchestrator.includes('.filter(({ verifyJwt }) => verifyJwt === false)'),
  'Live unauthenticated canaries must cover the exact eight gateway-public functions; static guards cover all sixteen.',
);

console.log('PASS Phase 2 staging deployment and evidence source contract');
