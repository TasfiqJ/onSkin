import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmdirSync, rmSync,
  symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { inflateSync } from 'node:zlib';

import {
  DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS,
  DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS,
  Db06EvidenceError,
  CRON_INVENTORY_FIELDS,
  SCHEMA_INVENTORY_FIELDS,
  assertCurrentSourceContract,
  assertPinnedMigrationRunnerCompatibility,
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
} from './staging-deployment-evidence-lib.mjs';

const repoRoot = process.cwd();
const source = buildSourceInventory(repoRoot);
const projectRef = 'abcdefghijklmnopqrst';
const projectRefLast4 = 'qrst';
const gitCommit = 'a'.repeat(40);
const rollbackRef = 'fresh-staging-discard-project';
const evidenceId = 'db06-staging-20260715T120000Z-aaaaaaa';
const fixedNow = new Date('2026-07-15T12:00:00.000Z');
const projectRefFingerprint = sha256(`db06-project-ref-v1\0${projectRef}`);

function errorCode(callback, expected) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof Db06EvidenceError);
    assert.equal(error.code, expected);
    return true;
  });
}

function schemaRow(count = 0) {
  return Object.fromEntries(SCHEMA_INVENTORY_FIELDS.map(([key]) => [key, count]));
}

function closedAuthConfig(overrides = {}) {
  const externalFields = [
    'external_anonymous_users_enabled',
    'external_apple_enabled',
    'external_azure_enabled',
    'external_bitbucket_enabled',
    'external_discord_enabled',
    'external_email_enabled',
    'external_facebook_enabled',
    'external_figma_enabled',
    'external_github_enabled',
    'external_gitlab_enabled',
    'external_google_enabled',
    'external_kakao_enabled',
    'external_keycloak_enabled',
    'external_linkedin_oidc_enabled',
    'external_notion_enabled',
    'external_phone_enabled',
    'external_slack_enabled',
    'external_slack_oidc_enabled',
    'external_spotify_enabled',
    'external_twitch_enabled',
    'external_twitter_enabled',
    'external_web3_ethereum_enabled',
    'external_web3_solana_enabled',
    'external_workos_enabled',
    'external_x_enabled',
    'external_zoom_enabled',
  ];
  const hookFields = [
    'hook_after_user_created_enabled',
    'hook_before_user_created_enabled',
    'hook_custom_access_token_enabled',
    'hook_mfa_verification_attempt_enabled',
    'hook_password_verification_attempt_enabled',
    'hook_send_email_enabled',
    'hook_send_sms_enabled',
  ];
  return {
    disable_signup: true,
    ...Object.fromEntries(externalFields.map((field) => [field, false])),
    ...Object.fromEntries(hookFields.map((field) => [field, false])),
    saml_enabled: false,
    oauth_server_enabled: false,
    custom_oauth_enabled: false,
    ...overrides,
  };
}

function functionRows(version = 1) {
  return source.functions.map((definition, index) => ({
    id: `ignored-${index}`,
    name: definition.slug,
    slug: definition.slug,
    status: 'ACTIVE',
    version,
    verify_jwt: definition.verifyJwt,
    ezbr_sha256: `${((index % 15) + 1).toString(16)}`.repeat(64),
    updated_at: 1_700_000_000_000 + index,
  }));
}

function configuredSecretRows({ includeAppEnvironment = true, includeTrafficFreeze = true } = {}) {
  const names = new Set(
    source.hostedSecretGroups.map(({ names: alternatives }) => alternatives[0]),
  );
  if (includeAppEnvironment) {
    names.add('APP_ENV');
    names.add('EXPO_PUBLIC_APP_ENV');
  }
  if (includeTrafficFreeze) names.add('DB06_TRAFFIC_FREEZE');
  return [...names].sort().map((name) => ({ name, value: 'digest-must-not-be-retained' }));
}

const boundaryFiles = {
  accountDeletion: 'account-deletion.json',
  publicationFence: 'publication-fence.json',
  entitlementAuthority: 'entitlement-authority.json',
  healthConsent: 'health-consent.json',
  appleAuth: 'apple-auth.json',
};

function cutoverFixture(overrides = {}, trafficFreezeOverrides = {}) {
  const pending = source.migrations.map(({ id }) => id);
  const evidenceDirectory = mkdtempSync(join(tmpdir(), 'db06-cutover-test-'));
  const boundaries = {};
  for (const [boundary, evidenceFile] of Object.entries(boundaryFiles)) {
    const artifact = {
      schemaVersion: 2,
      environment: 'staging',
      boundary,
      mode: 'zero-cohort',
      projectRefFingerprint,
      sourceGitCommit: gitCommit,
      observedAt: '2026-07-15T11:40:00.000Z',
      operatorRole: 'release-operator',
      assertion: 'operator-attests-no-preexisting-user-cohort',
      counts: {
        authUsers: 0,
        authIdentities: 0,
        appleIdentities: 0,
        authSessions: 0,
        storageBuckets: 0,
        storageObjects: 0,
        relevantCronJobs: 0,
        allCronJobs: 0,
      },
    };
    const retainedText = `${JSON.stringify(artifact, null, 2)}\n`;
    writeFileSync(join(evidenceDirectory, evidenceFile), retainedText, 'utf8');
    boundaries[boundary] = {
      mode: 'zero-cohort',
      evidenceFile,
      evidenceSha256: sha256(retainedText),
    };
  }
  const trafficFreezeControls = {
    mobileClientsTargetingStaging: false,
    webClientsTargetingStaging: false,
    otaChannelsTargetingStaging: false,
    projectApiKeysExternallyDistributed: false,
    authSignupEnabled: false,
    authAnonymousSignupEnabled: false,
    authExternalProviderCount: 0,
    authAdminCreationAutomationEnabled: false,
    edgeTrafficAdmission: 'frozen',
    signInWithAppleNotificationsTargetingStaging: false,
    appStoreServerNotificationsTargetingStaging: false,
    revenueCatWebhooksTargetingStaging: false,
    revenueCatPendingRetriesTargetingStaging: false,
    otherProviderCallbacksTargetingStaging: false,
    scheduledIngressConfigured: false,
    ...(trafficFreezeOverrides.controls ?? {}),
  };
  const trafficFreeze = {
    schemaVersion: 1,
    environment: 'staging',
    mode: 'closed-ingress-zero-cohort',
    projectRefFingerprint,
    sourceGitCommit: gitCommit,
    migrationPlanSha256: sha256(canonicalJson(pending)),
    rollbackRef,
    operatorRole: 'release-operator',
    changeLockRef: 'change-lock-db06-staging',
    activatedAt: '2026-07-15T11:30:00.000Z',
    observedAt: '2026-07-15T11:40:00.000Z',
    holdUntil: '2026-07-16T11:15:00.000Z',
    releaseCondition: 'db06-pass-and-separately-recorded-downstream-live-gate-release',
    assertion: 'operator-attests-all-listed-ingress-remains-closed-through-hold-until',
    controls: trafficFreezeControls,
    evidenceRefs: {
      releaseChannels: 'change-release-channels-closed',
      supabaseAuth: 'change-supabase-auth-closed',
      supabaseEdge: 'change-supabase-edge-frozen',
      apple: 'change-apple-callbacks-closed',
      revenueCat: 'change-revenuecat-webhooks-closed',
      scheduledIngress: 'change-scheduled-ingress-closed',
      ...(trafficFreezeOverrides.evidenceRefs ?? {}),
    },
    ...Object.fromEntries(
      Object.entries(trafficFreezeOverrides).filter(
        ([key]) => key !== 'controls' && key !== 'evidenceRefs',
      ),
    ),
  };
  const trafficFreezeText = `${JSON.stringify(trafficFreeze, null, 2)}\n`;
  writeFileSync(join(evidenceDirectory, 'traffic-provider-freeze.json'), trafficFreezeText, 'utf8');
  const record = {
    schemaVersion: 2,
    environment: 'staging',
    projectRefLast4,
    projectRefFingerprint,
    sourceGitCommit: gitCommit,
    rollbackRef,
    reviewedAt: '2026-07-15T11:50:00.000Z',
    validUntil: '2026-07-16T09:00:00.000Z',
    retentionReviewAt: '2027-01-15T12:00:00.000Z',
    migrationPlanSha256: sha256(canonicalJson(pending)),
    noDashboardSchemaMutation: true,
    rollbackPointOperatorAttested: true,
    attestationRoles: ['privacy-reviewer', 'release-owner', 'rollback-owner', 'security-reviewer'],
    trafficProviderFreeze: {
      mode: 'closed-ingress-zero-cohort',
      evidenceFile: 'traffic-provider-freeze.json',
      evidenceSha256: sha256(trafficFreezeText),
    },
    boundaries,
    ...overrides,
  };
  return { record, evidenceDirectory };
}

test('current reviewed source inventory is deterministic and exact', () => {
  assertCurrentSourceContract(source);
  const second = buildSourceInventory(repoRoot);
  assert.equal(source.migrationCount, 97);
  assert.equal(source.latestMigrationId, '20261010000081');
  assert.equal(source.functionCount, 18);
  assert.equal(source.migrationSetSha256, second.migrationSetSha256);
  assert.equal(source.functionSetSha256, second.functionSetSha256);
  assert.equal(new Set(source.migrations.map(({ sha256: hash }) => hash)).size, 97);
});

test('candidate CLI cannot reach staging before current-chain replay and type parity', () => {
  errorCode(
    () => assertPinnedMigrationRunnerCompatibility(repoRoot, '2.117.0'),
    'DB06_CURRENT_CHAIN_REPLAY_REQUIRED',
  );
  errorCode(
    () => assertPinnedMigrationRunnerCompatibility(repoRoot, '2.109.1'),
    'DB06_CLI_PIN_INVALID',
  );
});

test('schema parser accepts only one complete non-negative count row', () => {
  const parsed = parseSchemaInventory(JSON.stringify([schemaRow(2)]));
  assert.equal(parsed.publicTableCount, 2);
  const partial = schemaRow();
  delete partial.public_policies;
  errorCode(
    () => parseSchemaInventory(JSON.stringify([partial])),
    'DB06_SCHEMA_INVENTORY_MALFORMED',
  );
  errorCode(
    () => parseSchemaInventory(JSON.stringify([{ ...schemaRow(), public_tables: -1 }])),
    'DB06_SCHEMA_INVENTORY_MALFORMED',
  );
});

test('cron inventory is aggregate-only, exact, and internally consistent', () => {
  assert.equal(parseCronTableExists('[{"cron_job_table_exists":false}]'), false);
  const row = Object.fromEntries(CRON_INVENTORY_FIELDS.map(([key]) => [key, 0]));
  row.account_deletion_cron_jobs = 1;
  row.relevant_cron_jobs = 1;
  row.all_cron_jobs = 1;
  assert.equal(parseCronInventory(JSON.stringify([row])).relevantCronJobCount, 1);
  errorCode(
    () => parseCronInventory(JSON.stringify([{ ...row, relevant_cron_jobs: 2 }])),
    'DB06_CRON_INVENTORY_MALFORMED',
  );
});

test('git snapshot validation rejects changed, missing, and injected deployment bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'db06-snapshot-test-'));
  const content = Buffer.from('reviewed source\n');
  writeFileSync(join(root, 'source.txt'), content);
  const objectId = createHash('sha1')
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest('hex');
  const entries = parseGitTreeInventory(`100644 blob ${objectId}\tsource.txt\0`, 'sha1');
  const verified = validateGitSnapshot(root, entries, 'sha1');
  assert.equal(verified.trackedFileCount, 1);

  mkdirSync(join(root, 'supabase', '.temp'), { recursive: true });
  writeFileSync(join(root, 'supabase', '.temp', 'project-ref'), projectRef);
  errorCode(() => validateGitSnapshot(root, entries, 'sha1'), 'DB06_SNAPSHOT_INTEGRITY_FAILED');
  assert.equal(
    validateGitSnapshot(root, entries, 'sha1', { allowSupabaseTemp: true }).allowedRuntimeFileCount,
    1,
  );
  writeFileSync(join(root, 'injected.sql'), 'select dangerous_mutation();\n');
  errorCode(
    () => validateGitSnapshot(root, entries, 'sha1', { allowSupabaseTemp: true }),
    'DB06_SNAPSHOT_INTEGRITY_FAILED',
  );
});

test('migration probes and inventory reject ambiguous, duplicate, or unordered output', () => {
  assert.equal(parseMigrationHistoryExists('[{"migration_history_exists":false}]'), false);
  assert.deepEqual(
    parseMigrationInventory(
      '[{"migration_id":"20260701000001"},{"migration_id":"20260701000002"}]',
    ),
    ['20260701000001', '20260701000002'],
  );
  errorCode(
    () =>
      parseMigrationInventory(
        '[{"migration_id":"20260701000001"},{"migration_id":"20260701000001"}]',
      ),
    'DB06_MIGRATION_INVENTORY_MALFORMED',
  );
  errorCode(
    () => parseMigrationHistoryExists('[{"migration_history_exists":"unknown"}]'),
    'DB06_MIGRATION_HISTORY_PROBE_MALFORMED',
  );
});

test('remote migration history must be an exact source prefix', () => {
  const prefix = source.migrations.slice(0, 4).map(({ id }) => id);
  assert.equal(
    assertRemoteMigrationPrefix(source, prefix).length,
    source.migrationCount - prefix.length,
  );
  const divergent = [...prefix];
  divergent[2] = '20260701099999';
  errorCode(
    () => assertRemoteMigrationPrefix(source, divergent),
    'DB06_REMOTE_MIGRATION_HISTORY_DIVERGED',
  );
});

test('fresh-staging gate rejects any pre-existing schema, migration, or function', () => {
  assert.equal(
    assertFreshStagingTarget({
      schema: parseSchemaInventory(JSON.stringify([schemaRow()])),
      migrationIds: [],
      functions: [],
    }),
    true,
  );
  errorCode(
    () =>
      assertFreshStagingTarget({
        schema: parseSchemaInventory(JSON.stringify([{ ...schemaRow(), public_tables: 1 }])),
        migrationIds: [],
        functions: [],
      }),
    'DB06_TARGET_NOT_EMPTY_FRESH_STAGING',
  );
  errorCode(
    () =>
      assertFreshStagingTarget({
        schema: parseSchemaInventory(JSON.stringify([{ ...schemaRow(), public_other_objects: 1 }])),
        migrationIds: [],
        functions: [],
      }),
    'DB06_TARGET_NOT_EMPTY_FRESH_STAGING',
  );
  errorCode(
    () =>
      assertFreshStagingTarget({
        schema: parseSchemaInventory(JSON.stringify([schemaRow()])),
        migrationIds: ['20260701000001'],
        functions: [],
      }),
    'DB06_TARGET_NOT_EMPTY_FRESH_STAGING',
  );
});

test('immediate pre-migration gate rejects changed schema or migration history', () => {
  const emptySchema = parseSchemaInventory(JSON.stringify([schemaRow()]));
  assert.equal(assertFreshStagingBoundary({ schema: emptySchema, migrationIds: [] }), true);
  errorCode(
    () =>
      assertFreshStagingBoundary({
        schema: { ...emptySchema, authUserCount: 1 },
        migrationIds: [],
      }),
    'DB06_TARGET_CHANGED_BEFORE_MIGRATION',
  );
  errorCode(
    () =>
      assertFreshStagingBoundary({
        schema: emptySchema,
        migrationIds: ['20260701000001'],
      }),
    'DB06_TARGET_CHANGED_BEFORE_MIGRATION',
  );
});

test('function inventory requires exact manifest slugs, active status, versions, JWT posture, and hosted hashes', () => {
  const rows = functionRows();
  const parsed = parseFunctionInventory(JSON.stringify(rows), source, { requireComplete: true });
  assert.equal(parsed.length, 18);
  assert.equal(parsed[0].reviewedSourceSetSha256.length, 64);

  const missingHash = structuredClone(rows);
  delete missingHash[0].ezbr_sha256;
  errorCode(
    () => parseFunctionInventory(JSON.stringify(missingHash), source, { requireComplete: true }),
    'DB06_FUNCTION_INVENTORY_MALFORMED',
  );
  const wrongJwt = structuredClone(rows);
  wrongJwt[0].verify_jwt = !wrongJwt[0].verify_jwt;
  errorCode(
    () => parseFunctionInventory(JSON.stringify(wrongJwt), source, { requireComplete: true }),
    'DB06_FUNCTION_INVENTORY_MALFORMED',
  );
  errorCode(
    () => parseFunctionInventory(JSON.stringify(rows.slice(1)), source, { requireComplete: true }),
    'DB06_FUNCTION_INVENTORY_INCOMPLETE',
  );
  const extra = [...rows, { ...rows[0], slug: 'stale-function' }];
  errorCode(
    () => parseFunctionInventory(JSON.stringify(extra), source),
    'DB06_FUNCTION_INVENTORY_UNEXPECTED',
  );
});

test('secret inventory discards digests and fails closed on missing required groups', () => {
  const parsed = parseSecretInventory(JSON.stringify(configuredSecretRows()), source);
  assert.equal(parsed.missingGroupIds.length, 0);
  assert.equal(parsed.appEnvironmentNamesPresent, true);
  assert.equal(parsed.trafficFreezeNamePresent, true);
  assert.equal(JSON.stringify(parsed).includes('digest-must-not-be-retained'), false);

  const incomplete = parseSecretInventory(JSON.stringify(configuredSecretRows().slice(1)), source);
  assert.ok(incomplete.missingGroupIds.length > 0);
  const withoutEnvironment = parseSecretInventory(
    JSON.stringify(configuredSecretRows({ includeAppEnvironment: false })),
    source,
  );
  assert.equal(withoutEnvironment.appEnvironmentNamesPresent, false);
  const withoutFreeze = parseSecretInventory(
    JSON.stringify(configuredSecretRows({ includeTrafficFreeze: false })),
    source,
  );
  assert.equal(withoutFreeze.trafficFreezeNamePresent, false);
});

test('hosted Auth ingress freeze retains only aggregate closed-state facts', () => {
  assert.deepEqual(
    parseAuthIngressFreeze(JSON.stringify(closedAuthConfig({ smtp_pass: 'must-not-be-retained' }))),
    {
      newUserSignupDisabled: true,
      anonymousSignupDisabled: true,
      reviewedExternalEnabledFieldCount: 26,
      enabledExternalProviderCount: 0,
      reviewedAuthHookFieldCount: 7,
      enabledAuthHookCount: 0,
      samlEnabled: false,
      oauthServerEnabled: false,
      customOAuthEnabled: false,
    },
  );
  errorCode(
    () => parseAuthIngressFreeze(JSON.stringify(closedAuthConfig({ disable_signup: false }))),
    'DB06_AUTH_INGRESS_NOT_FROZEN',
  );
  errorCode(
    () =>
      parseAuthIngressFreeze(JSON.stringify(closedAuthConfig({ external_apple_enabled: true }))),
    'DB06_AUTH_INGRESS_NOT_FROZEN',
  );
  errorCode(
    () => parseAuthIngressFreeze(JSON.stringify({ disable_signup: true })),
    'DB06_AUTH_INGRESS_FREEZE_MALFORMED',
  );
  errorCode(
    () =>
      parseAuthIngressFreeze(
        JSON.stringify(closedAuthConfig({ external_new_provider_enabled: false })),
      ),
    'DB06_AUTH_INGRESS_FREEZE_REVIEW_REQUIRED',
  );
  assert.deepEqual(parseSsoProviderFreeze('{"items":[]}'), {
    ssoProviderCount: 0,
  });
  assert.deepEqual(parseThirdPartyAuthFreeze('[]'), {
    thirdPartyAuthIntegrationCount: 0,
  });
  errorCode(
    () => parseSsoProviderFreeze('{"items":[{"id":"present"}]}'),
    'DB06_AUTH_INGRESS_NOT_FROZEN',
  );
  errorCode(() => parseThirdPartyAuthFreeze('[{"id":"present"}]'), 'DB06_AUTH_INGRESS_NOT_FROZEN');
});

test('cutover record is exact, current, source-bound, and zero-cohort only', () => {
  const pendingMigrationIds = source.migrations.map(({ id }) => id);
  const fixture = cutoverFixture();
  const parsed = validateCutoverRecord({
    record: fixture.record,
    pendingMigrationIds,
    projectRefLast4,
    projectRefFingerprint,
    gitCommit,
    rollbackRef,
    operatorRole: 'release-operator',
    evidenceDirectory: fixture.evidenceDirectory,
    rawProjectRef: projectRef,
    now: fixedNow,
  });
  assert.equal(Object.keys(parsed.summary.boundaries).length, 5);
  assert.equal(parsed.summary.boundaries.appleAuth.mode, 'zero-cohort');
  assert.equal(
    parsed.summary.trafficProviderFreeze.edgeInvocationIngressDisabledOperatorAttested,
    true,
  );
  assert.equal(Object.keys(parsed.retainedArtifacts).length, 7);

  const frozen = cutoverFixture();
  frozen.record.boundaries.appleAuth.mode = 'frozen-reviewed';
  errorCode(
    () =>
      validateCutoverRecord({
        record: frozen.record,
        pendingMigrationIds,
        projectRefLast4,
        projectRefFingerprint,
        gitCommit,
        rollbackRef,
        operatorRole: 'release-operator',
        evidenceDirectory: frozen.evidenceDirectory,
        rawProjectRef: projectRef,
        now: fixedNow,
      }),
    'DB06_CUTOVER_RECORD_INVALID',
  );
  const openIngress = cutoverFixture({}, { controls: { authSignupEnabled: true } });
  errorCode(
    () =>
      validateCutoverRecord({
        record: openIngress.record,
        pendingMigrationIds,
        projectRefLast4,
        projectRefFingerprint,
        gitCommit,
        rollbackRef,
        operatorRole: 'release-operator',
        evidenceDirectory: openIngress.evidenceDirectory,
        rawProjectRef: projectRef,
        now: fixedNow,
      }),
    'DB06_TRAFFIC_FREEZE_NOT_CLOSED',
  );
  for (const unsafeTrafficReference of [
    { changeLockRef: 'https://tickets.example.test/DB06-123' },
    { evidenceRefs: { apple: 'https://developer.apple.com/account' } },
    { evidenceRefs: { revenueCat: 'abcdefghijklmnopqrstuvwx' } },
  ]) {
    const unsafeReference = cutoverFixture({}, unsafeTrafficReference);
    errorCode(
      () =>
        validateCutoverRecord({
          record: unsafeReference.record,
          pendingMigrationIds,
          projectRefLast4,
          projectRefFingerprint,
          gitCommit,
          rollbackRef,
          operatorRole: 'release-operator',
          evidenceDirectory: unsafeReference.evidenceDirectory,
          rawProjectRef: projectRef,
          now: fixedNow,
        }),
      'DB06_TRAFFIC_FREEZE_EVIDENCE_INVALID',
    );
  }
  const staleFreeze = cutoverFixture({}, { observedAt: '2026-07-15T11:20:00.000Z' });
  errorCode(
    () =>
      validateCutoverRecord({
        record: staleFreeze.record,
        pendingMigrationIds,
        projectRefLast4,
        projectRefFingerprint,
        gitCommit,
        rollbackRef,
        operatorRole: 'release-operator',
        evidenceDirectory: staleFreeze.evidenceDirectory,
        rawProjectRef: projectRef,
        now: fixedNow,
      }),
    'DB06_TRAFFIC_FREEZE_EVIDENCE_EXPIRED',
  );
  const longRunningDeployment = cutoverFixture();
  const finalRevalidation = validateCutoverRecord({
    record: longRunningDeployment.record,
    pendingMigrationIds,
    projectRefLast4,
    projectRefFingerprint,
    gitCommit,
    rollbackRef,
    operatorRole: 'release-operator',
    evidenceDirectory: longRunningDeployment.evidenceDirectory,
    rawProjectRef: projectRef,
    now: new Date('2026-07-15T12:45:00.000Z'),
    requireFreshObservations: false,
  });
  assert.equal(finalRevalidation.summary.validUntil, '2026-07-16T09:00:00.000Z');
  assert.equal(
    finalRevalidation.summary.trafficProviderFreeze.holdUntil,
    '2026-07-16T11:15:00.000Z',
  );
  const exactCompletionBudget = cutoverFixture({
    validUntil: '2026-07-16T00:00:00.000Z',
  });
  const exactCompletionBudgetResult = validateCutoverRecord({
    record: exactCompletionBudget.record,
    pendingMigrationIds,
    projectRefLast4,
    projectRefFingerprint,
    gitCommit,
    rollbackRef,
    operatorRole: 'release-operator',
    evidenceDirectory: exactCompletionBudget.evidenceDirectory,
    rawProjectRef: projectRef,
    now: fixedNow,
    minimumCompletionBudgetMs: DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS,
  });
  assert.equal(
    exactCompletionBudgetResult.completionWindow.validityRemainingMs,
    DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS,
  );
  const shortValidityBudget = cutoverFixture({
    validUntil: '2026-07-15T23:59:59.999Z',
  });
  errorCode(
    () =>
      validateCutoverRecord({
        record: shortValidityBudget.record,
        pendingMigrationIds,
        projectRefLast4,
        projectRefFingerprint,
        gitCommit,
        rollbackRef,
        operatorRole: 'release-operator',
        evidenceDirectory: shortValidityBudget.evidenceDirectory,
        rawProjectRef: projectRef,
        now: fixedNow,
        minimumCompletionBudgetMs: DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS,
      }),
    'DB06_CUTOVER_COMPLETION_BUDGET_INSUFFICIENT',
  );
  const exactPreMigrationBudget = cutoverFixture({
    validUntil: '2026-07-15T19:00:00.000Z',
  });
  assert.equal(
    validateCutoverRecord({
      record: exactPreMigrationBudget.record,
      pendingMigrationIds,
      projectRefLast4,
      projectRefFingerprint,
      gitCommit,
      rollbackRef,
      operatorRole: 'release-operator',
      evidenceDirectory: exactPreMigrationBudget.evidenceDirectory,
      rawProjectRef: projectRef,
      now: fixedNow,
      requireFreshObservations: false,
      minimumCompletionBudgetMs: DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS,
    }).completionWindow.validityRemainingMs,
    DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS,
  );
  const shortPreMigrationBudget = cutoverFixture({
    validUntil: '2026-07-15T18:59:59.999Z',
  });
  errorCode(
    () =>
      validateCutoverRecord({
        record: shortPreMigrationBudget.record,
        pendingMigrationIds,
        projectRefLast4,
        projectRefFingerprint,
        gitCommit,
        rollbackRef,
        operatorRole: 'release-operator',
        evidenceDirectory: shortPreMigrationBudget.evidenceDirectory,
        rawProjectRef: projectRef,
        now: fixedNow,
        requireFreshObservations: false,
        minimumCompletionBudgetMs: DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS,
      }),
    'DB06_CUTOVER_COMPLETION_BUDGET_INSUFFICIENT',
  );
  const unexpected = cutoverFixture();
  errorCode(
    () =>
      validateCutoverRecord({
        record: { ...unexpected.record, unexpected: true },
        pendingMigrationIds,
        projectRefLast4,
        projectRefFingerprint,
        gitCommit,
        rollbackRef,
        operatorRole: 'release-operator',
        evidenceDirectory: unexpected.evidenceDirectory,
        rawProjectRef: projectRef,
        now: fixedNow,
      }),
    'DB06_CUTOVER_RECORD_INVALID',
  );
  const expired = cutoverFixture({ validUntil: '2026-07-15T11:59:59.000Z' });
  errorCode(
    () =>
      validateCutoverRecord({
        record: expired.record,
        pendingMigrationIds,
        projectRefLast4,
        projectRefFingerprint,
        gitCommit,
        rollbackRef,
        operatorRole: 'release-operator',
        evidenceDirectory: expired.evidenceDirectory,
        rawProjectRef: projectRef,
        now: fixedNow,
      }),
    'DB06_CUTOVER_RECORD_EXPIRED',
  );

  const mismatched = cutoverFixture();
  writeFileSync(join(mismatched.evidenceDirectory, 'apple-auth.json'), '{"changed":true}\n');
  errorCode(
    () =>
      validateCutoverRecord({
        record: mismatched.record,
        pendingMigrationIds,
        projectRefLast4,
        projectRefFingerprint,
        gitCommit,
        rollbackRef,
        operatorRole: 'release-operator',
        evidenceDirectory: mismatched.evidenceDirectory,
        rawProjectRef: projectRef,
        now: fixedNow,
      }),
    'DB06_CUTOVER_EVIDENCE_INVALID',
  );
});

test('generated-type summaries require a real Database surface and an exact local summary', () => {
  const text = `export type Json = string\nexport type Database = {\n  public: {\n    Tables: {}\n    Views: {}\n    Functions: {}\n    Enums: {}\n    CompositeTypes: {}\n  }\n}\n${' '.repeat(100)}`;
  assert.match(summarizeGeneratedTypes(text).sha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(
    parseLocalTypeSummary(
      `[db05-local] temporary types: PASS (5000 lines, sha256 ${'a'.repeat(64)})\n`,
    ),
    { lineCount: 5000, sha256: 'a'.repeat(64) },
  );
  errorCode(
    () =>
      parseLocalTypeSummary(
        `[db05-local] temporary types: PASS (2 lines, sha256 ${'a'.repeat(64)})`,
      ),
    'DB06_LOCAL_TYPE_SUMMARY_MALFORMED',
  );
  errorCode(
    () => summarizeGeneratedTypes('export type SomethingElse = {};'),
    'DB06_LINKED_TYPES_INVALID',
  );
});

test('completed deployment requires source migrations, all functions, 82 historical RLS tables, config, and type parity', () => {
  const functions = parseFunctionInventory(JSON.stringify(functionRows()), source, {
    requireComplete: true,
  });
  const secrets = parseSecretInventory(JSON.stringify(configuredSecretRows()), source);
  const afterSchema = {
    ...parseSchemaInventory(JSON.stringify([schemaRow()])),
    ...emptyCronInventory(),
    publicTableCount: 82,
    publicRlsTableCount: 82,
    storageBucketCount: 1,
  };
  const migrationIds = source.migrations.map(({ id }) => id);
  assert.equal(
    validateCompletedDeployment({
      sourceInventory: source,
      beforeMigrationIds: [],
      preMigrationFunctions: functions,
      afterMigrationIds: migrationIds,
      afterFunctions: functions,
      afterSchema,
      afterSecrets: secrets,
      localTypes: { sha256: 'f'.repeat(64) },
      linkedTypes: { sha256: 'f'.repeat(64) },
      repositoryTypes: { sha256: 'f'.repeat(64) },
    }),
    true,
  );
  errorCode(
    () =>
      validateCompletedDeployment({
        sourceInventory: source,
        beforeMigrationIds: [],
        preMigrationFunctions: functions,
        afterMigrationIds: migrationIds,
        afterFunctions: functions,
        afterSchema: { ...afterSchema, publicTableCount: 79, publicRlsTableCount: 79 },
        afterSecrets: secrets,
        localTypes: { sha256: 'f'.repeat(64) },
        linkedTypes: { sha256: 'f'.repeat(64) },
        repositoryTypes: { sha256: 'f'.repeat(64) },
      }),
    'DB06_AFTER_SCHEMA_COUNTS_INVALID',
  );
  errorCode(
    () =>
      validateCompletedDeployment({
        sourceInventory: source,
        beforeMigrationIds: [],
        preMigrationFunctions: functions,
        afterMigrationIds: migrationIds,
        afterFunctions: functions,
        afterSchema,
        afterSecrets: secrets,
        localTypes: { sha256: 'f'.repeat(64) },
        linkedTypes: { sha256: 'e'.repeat(64) },
        repositoryTypes: { sha256: 'f'.repeat(64) },
      }),
    'DB06_LOCAL_LINKED_TYPES_DIVERGED',
  );
  errorCode(
    () =>
      validateCompletedDeployment({
        sourceInventory: source,
        beforeMigrationIds: [],
        preMigrationFunctions: functions,
        afterMigrationIds: migrationIds,
        afterFunctions: functions,
        afterSchema,
        afterSecrets: secrets,
        localTypes: { sha256: 'f'.repeat(64) },
        linkedTypes: { sha256: 'f'.repeat(64) },
        repositoryTypes: { sha256: 'e'.repeat(64) },
      }),
    'DB08_REPOSITORY_TYPES_DIVERGED',
  );
});

function authFreezeSummary() {
  return {
    newUserSignupDisabled: true,
    anonymousSignupDisabled: true,
    reviewedExternalEnabledFieldCount: 26,
    enabledExternalProviderCount: 0,
    reviewedAuthHookFieldCount: 7,
    enabledAuthHookCount: 0,
    samlEnabled: false,
    oauthServerEnabled: false,
    customOAuthEnabled: false,
    ssoProviderCount: 0,
    thirdPartyAuthIntegrationCount: 0,
    observedAt: '2026-07-15T12:20:00.000Z',
    source: 'supabase-management-api-v1-read-only',
  };
}

function trafficFreezeCanarySummary() {
  const publicSlugs = source.functions
    .filter(({ verifyJwt }) => verifyJwt === false)
    .map(({ slug }) => slug)
    .sort((left, right) => left.localeCompare(right));
  return {
    checkedFunctionCount: publicSlugs.length,
    allReturnedFrozenNoStore: true,
    functions: publicSlugs.map((slug) => ({
      slug,
      status: 503,
      errorCode: 'DB06_STAGING_TRAFFIC_FROZEN',
    })),
  };
}

function zeroLiveSchema() {
  return {
    ...parseSchemaInventory(JSON.stringify([schemaRow()])),
    ...emptyCronInventory(),
  };
}

function passManifestInput(steps) {
  const functions = parseFunctionInventory(JSON.stringify(functionRows()), source, {
    requireComplete: true,
  });
  const authIngressFreeze = authFreezeSummary();
  const trafficFreezeCanary = trafficFreezeCanarySummary();
  const zeroSchema = zeroLiveSchema();
  const afterSchema = {
    ...zeroSchema,
    publicTableCount: 82,
    publicRlsTableCount: 82,
    storageBucketCount: 1,
  };
  const validUntil = '2026-07-16T09:00:00.000Z';
  const holdUntil = '2026-07-16T11:15:00.000Z';
  const initialValidatedAt = '2026-07-15T12:10:00.000Z';
  const immediateValidatedAt = '2026-07-15T12:24:59.000Z';
  const finalValidatedAt = '2026-07-15T12:29:59.000Z';
  const remainingMs = (end, start) => Date.parse(end) - Date.parse(start);
  return {
    evidenceId,
    result: 'pass',
    gitCommit,
    startedAt: '2026-07-15T12:00:00.000Z',
    completedAt: '2026-07-15T12:30:00.000Z',
    operatorRole: 'release-operator',
    projectRefLast4,
    projectRefFingerprint: sha256(`db06-project-ref-v1\0${projectRef}`),
    rollbackRef,
    sourceInventory: source,
    sourceSnapshot: {
      trackedFileCount: 100,
      trackedFileSetSha256: '3'.repeat(64),
    },
    runtime: { nodeVersion: process.version },
    steps,
    cutover: {
      recordSha256: '1'.repeat(64),
      retainedArtifactsSha256: '4'.repeat(64),
      validUntil,
      initialPreMutationValidation: {
        validatedAt: initialValidatedAt,
        freshObservations: true,
        minimumCompletionBudgetMs: DB06_INITIAL_MUTATION_COMPLETION_BUDGET_MS,
        validityRemainingMs: remainingMs(validUntil, initialValidatedAt),
        holdRemainingMs: remainingMs(holdUntil, initialValidatedAt),
      },
      trafficProviderFreeze: {
        allIngressClosedOperatorAttested: true,
        holdUntil,
      },
    },
    before: {
      schema: zeroSchema,
      migrationCount: 0,
      migrationIds: [],
      functions: [],
      authIngressFreeze,
    },
    preMigration: {
      functionCount: 18,
      functions,
      trafficFreezeState: 'frozen-and-retained-through-downstream-release-gate',
      trafficFreezeCanary,
      immediateCutoverRevalidation: {
        validatedAt: immediateValidatedAt,
        recordSha256: '1'.repeat(64),
        retainedArtifactsSha256: '4'.repeat(64),
        freshObservations: false,
        observationFreshnessBasis: 'initial-pre-mutation',
        currentValidityAndHold: true,
        minimumCompletionBudgetMs: DB06_PRE_MIGRATION_COMPLETION_BUDGET_MS,
        validityRemainingMs: remainingMs(validUntil, immediateValidatedAt),
        holdRemainingMs: remainingMs(holdUntil, immediateValidatedAt),
        validUntil,
        holdUntil,
      },
      immediateTargetRevalidation: {
        capturedAt: '2026-07-15T12:25:00.000Z',
        schema: zeroSchema,
        migrationCount: 0,
        migrationIds: [],
        functions,
        authIngressFreeze,
        trafficFreezeCanary,
      },
    },
    after: {
      migrationCount: 97,
      migrationIds: source.migrations.map(({ id }) => id),
      functions,
      schema: afterSchema,
      secretConfiguration: {
        missingGroupIds: [],
        appEnvironmentNamesPresent: true,
        trafficFreezeNamePresent: true,
      },
      authIngressFreeze,
      trafficFreezeCanary,
      trafficFreezeState: 'frozen-and-retained-through-downstream-release-gate',
      finalCutoverRevalidation: {
        validatedAt: finalValidatedAt,
        recordSha256: '1'.repeat(64),
        retainedArtifactsSha256: '4'.repeat(64),
        validAtCompletion: true,
        observationRecencyValidatedAtInitialGate: true,
        finalGateRevalidatedCurrentValidityAndHold: true,
        minimumCompletionBudgetMs: 0,
        validityRemainingMs: remainingMs(validUntil, finalValidatedAt),
        holdRemainingMs: remainingMs(holdUntil, finalValidatedAt),
        observationFreshnessBasis: 'initial-pre-mutation',
        validUntil,
        holdUntil,
      },
    },
    types: {
      localGenerated: { sha256: '2'.repeat(64) },
      linkedGenerated: { sha256: '2'.repeat(64) },
      repositoryGenerated: { sha256: '2'.repeat(64) },
    },
    retentionReviewAt: '2027-01-15T12:00:00.000Z',
    retainedArtifactNames: ['manifest.json', 'deployment-log.jsonl', 'database.types.linked.ts'],
    remoteMutationStarted: true,
  };
}

function passManifest(steps) {
  return buildEvidenceManifest(passManifestInput(steps));
}

test('pass evidence contains all governance fields and never the raw target', () => {
  const steps = [
    {
      commandId: 'test-step',
      startedAt: '2026-07-15T12:00:00.000Z',
      completedAt: '2026-07-15T12:00:01.000Z',
      result: 'pass',
      exitCode: 0,
    },
  ];
  const manifest = passManifest(steps);
  for (const field of [
    'schemaVersion',
    'evidenceId',
    'workItemIds',
    'featureIds',
    'gatedSurfaceIds',
    'environment',
    'appVersion',
    'buildNumber',
    'gitCommit',
    'sourceHashes',
    'startedAt',
    'completedAt',
    'operatorRole',
    'deviceOrRuntime',
    'commandsOrProcedure',
    'result',
    'findings',
    'redactionsApplied',
    'retentionClass',
    'deleteOrReviewAt',
    'rollbackRef',
  ]) {
    assert.ok(Object.hasOwn(manifest, field), field);
  }
  assert.equal(JSON.stringify(manifest).includes(projectRef), false);
  assert.equal(manifest.featureIds.length, 19);
  assert.deepEqual(manifest.gatedSurfaceIds, []);
  assert.equal(manifest.sourceControl.cleanAtSnapshot, true);
  assertEvidenceSafe(manifest, projectRef);
});

test('redaction gate rejects project refs, credentials, email, URLs, JWTs, and private keys', () => {
  for (const value of [
    projectRef,
    'sb_secret_not-allowed',
    'person@example.com',
    'postgresql://user:password@host/db',
    'eyJheader.payload.signature',
    '-----BEGIN PRIVATE KEY-----',
  ]) {
    errorCode(() => assertEvidenceSafe(value, projectRef), 'DB06_EVIDENCE_REDACTION_FAILED');
  }
});

test('evidence directory is exclusive, traversal-safe, checksummed, and retains linked types', () => {
  const root = mkdtempSync(join(tmpdir(), 'db06-evidence-test-'));
  const steps = [
    {
      commandId: 'test-step',
      startedAt: '2026-07-15T12:00:00.000Z',
      completedAt: '2026-07-15T12:00:01.000Z',
      result: 'pass',
      exitCode: 0,
    },
  ];
  const target = reserveEvidenceDirectory(root, evidenceId, { result: 'in-progress' });
  const typesText = `export type Database = {};\n${' '.repeat(100)}`;
  const expectedLog = `${steps.map((step) => JSON.stringify(step)).join('\n')}\n`;
  writeFileSync(join(target, 'deployment-log.jsonl'), expectedLog, 'utf8');
  writeFileSync(join(target, 'database.types.linked.ts.pending'), 'stale pending', 'utf8');
  finalizeEvidenceDirectory(target, passManifest(steps), steps, projectRef, {
    linkedTypes: typesText,
  });
  assert.equal(existsSync(join(target, 'reservation.json')), false);
  assert.equal(readFileSync(join(target, 'database.types.linked.ts'), 'utf8'), typesText);
  const checksums = readFileSync(join(target, 'checksums.sha256'), 'utf8');
  assert.match(checksums, /database\.types\.linked\.ts/u);
  errorCode(
    () => reserveEvidenceDirectory(root, evidenceId, { result: 'in-progress' }),
    'DB06_EVIDENCE_DIRECTORY_EXISTS',
  );
  errorCode(() => validateEvidenceId('../escape'), 'DB06_EVIDENCE_ID_INVALID');
});

test('pass evidence cannot be emitted from a partial capture', () => {
  errorCode(
    () =>
      buildEvidenceManifest({
        evidenceId,
        result: 'pass',
        gitCommit,
        startedAt: '2026-07-15T12:00:00.000Z',
        completedAt: '2026-07-15T12:01:00.000Z',
        operatorRole: 'release-operator',
        projectRefLast4,
        projectRefFingerprint: 'a'.repeat(64),
        rollbackRef,
        sourceInventory: source,
        sourceSnapshot: {
          trackedFileCount: 100,
          trackedFileSetSha256: '3'.repeat(64),
        },
        runtime: {},
        steps: [{ commandId: 'one', result: 'pass' }],
        retentionReviewAt: '2027-01-15T12:00:00.000Z',
        retainedArtifactNames: ['manifest.json', 'deployment-log.jsonl'],
        before: null,
        preMigration: null,
        after: null,
        types: null,
      }),
    'DB06_PASS_EVIDENCE_INCOMPLETE',
  );
});

test('pass evidence rejects every omitted freeze and final-validity proof', () => {
  const steps = [
    {
      commandId: 'test-step',
      startedAt: '2026-07-15T12:00:00.000Z',
      completedAt: '2026-07-15T12:00:01.000Z',
      result: 'pass',
      exitCode: 0,
    },
  ];
  const cases = [
    (input) => {
      input.cutover.trafficProviderFreeze.allIngressClosedOperatorAttested = false;
    },
    (input) => {
      input.cutover.initialPreMutationValidation.minimumCompletionBudgetMs = 1;
    },
    (input) => {
      input.cutover.initialPreMutationValidation.validityRemainingMs -= 1;
    },
    (input) => {
      input.before.authIngressFreeze = null;
    },
    (input) => {
      input.preMigration.trafficFreezeState = 'open';
    },
    (input) => {
      input.preMigration.trafficFreezeCanary.allReturnedFrozenNoStore = false;
    },
    (input) => {
      input.preMigration.immediateCutoverRevalidation.currentValidityAndHold = false;
    },
    (input) => {
      input.preMigration.immediateCutoverRevalidation.holdRemainingMs -= 1;
    },
    (input) => {
      input.preMigration.functions[0].hostedBundleSha256 = 'invalid';
    },
    (input) => {
      input.preMigration.immediateTargetRevalidation.migrationCount = 1;
    },
    (input) => {
      input.after.authIngressFreeze = null;
    },
    (input) => {
      input.after.trafficFreezeCanary.functions[0].status = 200;
    },
    (input) => {
      input.after.schema.allCronJobCount = 1;
    },
    (input) => {
      input.after.migrationIds.pop();
    },
    (input) => {
      input.after.secretConfiguration.trafficFreezeNamePresent = false;
    },
    (input) => {
      input.after.finalCutoverRevalidation.validAtCompletion = false;
    },
    (input) => {
      input.after.finalCutoverRevalidation.validityRemainingMs -= 1;
    },
    (input) => {
      input.after.finalCutoverRevalidation.recordSha256 = '9'.repeat(64);
    },
    (input) => {
      input.after.finalCutoverRevalidation.holdUntil = '2026-07-15T12:45:00.000Z';
    },
    (input) => {
      input.steps[0].processContainment = 'unconfirmed';
    },
  ];
  for (const mutate of cases) {
    const input = passManifestInput(structuredClone(steps));
    mutate(input);
    errorCode(() => buildEvidenceManifest(input), 'DB06_PASS_EVIDENCE_INCOMPLETE');
  }
});

// Authority R1 N01-N25/N29-N33: only disposable source bytes and pure APIs.
// N26-N28/N35 require external frozen-postimage/tree review; N36 is packaging.
// Those external receipts belong to the evidence ZIP, never to an in-code approval.
let mutationRoot;
function sourceFixture() {
  if (mutationRoot) return mutationRoot;
  mutationRoot = mkdtempSync(join(tmpdir(), 'db06-source-mutations-'));
  const paths = new Set([
    ...source.migrations.map(({ file }) => `supabase/migrations/${file}`),
    ...source.functionPaths.filter((path) => !path.endsWith('/')).map((path) => `supabase/functions/${path}`),
    ...source.sourceInputs.map(({ path }) => path),
    ...source.expandedDeploymentInputs.map(({ path }) => path),
  ]);
  for (const path of paths) {
    const target = join(mutationRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(repoRoot, path)));
  }
  return mutationRoot;
}

function refused(id, detail, callback, codes = ['DB06_SOURCE_CONTRACT_REVIEW_REQUIRED']) {
  let observed;
  assert.throws(callback, (error) => {
    observed = error.code;
    assert.ok(error instanceof Db06EvidenceError, `${id}: ${detail}`);
    assert.ok(codes.includes(observed), `${id}: ${detail}: ${observed}`);
    return true;
  });
  console.log(JSON.stringify({ case: id, detail, observed, outcome: 'refused' }));
}

function editedSource(id, path, replacement, codes) {
  const target = join(sourceFixture(), path);
  const original = readFileSync(target);
  const changed = replacement ? replacement(original) : Buffer.concat([original, Buffer.from(' ') ]);
  assert.notDeepEqual(changed, original);
  try {
    writeFileSync(target, changed);
    refused(id, path, () => assertCurrentSourceContract(buildSourceInventory(sourceFixture())), codes);
  } finally {
    writeFileSync(target, original);
  }
}

function forgedInventory(id, detail, mutate) {
  const forged = structuredClone(source);
  mutate(forged);
  refused(id, detail, () => assertCurrentSourceContract(forged));
}

test('N01: reviewed immutable G leaves accept; no replay or candidate approval follows', () => {
  assert.equal(assertCurrentSourceContract(buildSourceInventory(sourceFixture())), true);
  assert.equal(source.migrationSetSha256, '5ee03b2032781512fe2ab893e46a3f28daf68ea55ba7b800393265256898c3d6');
  assert.equal(source.functionSetSha256, 'e4ef03705c00ef1f9a40874805fc5072d17fd5b6b8a37b6fbd2859dbecfb9e4e');
  assert.equal(new Set(Object.values(source.functionSources).flat().map(({ path }) => path)).size, 93);
  assert.equal(Object.values(source.functionSources).flat().length, 233);
  assert.equal(source.deploymentInputs.length, 30);
  assert.equal(source.stableDeploymentInputs.length, 33);
  assert.equal(source.expandedDeploymentInputs.length, 34);
});

test('N02: byte changes in every migration retain names/count/head and are refused', () => {
  for (const { file } of source.migrations) editedSource('N02', `supabase/migrations/${file}`);
});

const rejectedHistoricalHashes = Object.freeze({
    '20260718000046': 'bb315db3596edc232467255236398c493ca3967544a0d09836f608faf87de163',
    '20260718000047': '936beb5ca375a8e1e68e9bfbd940cbd47751fef17c7b020b55f82d35b67aa433',
    '20260718000048': '2696c78644ad3d58fcfbbd00ed3899b448fc2282d10868743fca8ec2dea67b81',
    '20260718000049': '5d1263227e6280abcad76680581f171b14068eba6a27d06cda6f4bc981d679ef',
    '20260718000050': 'fbe44e513c63840bdc67d6effa3ed0ad1439c3bf07be650ebf2d8821fe71b0e7',
    '20260718000051': 'e850deaa5db5ada2f12694c9983411650b9a2cd2d047a3c53adfa81287abcbf8',
    '20260718000052': '9cb42e283a831286dd694df53bcd1ac8b6c097e84e3e753b8b857b8ab7eecc3f',
    '20260718000053': 'c3c36f2a9de5c9cdd0e57baea4fcb5d021f9ac11d96ea6e1b5c9fa1ac6ea1fab',
    '20260718000059': '6caf62faca2d8c04147b8faceb7c170d9ee32c1416880afee6fdd7f66676b03f',
    '20260718000060': '6180173654b4aac8a15cf5d827acfcc74a1a07ba8ced797f6446b57a35dd2c47',
    '20260722000061': '56bcd9c296a93b4cb51638673a856a70d3caa52e8976f1e344028c6e97e05da1',
    '20260722000062': '15f39ce3da672d7d6bc92d680f0610d5954fbf2081f89b1db3c4ad426d352b5c',
});

test('N03: all twelve historical wrong row hashes fail despite the correct aggregate', () => {
  // These are rejected historical values from HISTORICAL_12_DISCREPANCIES.json.

  for (const [id, hash] of Object.entries(rejectedHistoricalHashes)) {
    forgedInventory('N03', id, (s) => { s.migrations.find((row) => row.id === id).sha256 = hash; });
  }
});

test('N04: historical 96-row pinsets and scalar digests have no fallback', () => {
  for (const digest of ['05983dc1f54cb02346a2512464139ff34e4e70cf0e173bf9ca1a60ceb4f3aec8', '9dfd88a77f973fe6b87b8360c1ddb11f2eeacf954b98e2734a42a2a31e5e41c2']) {
    forgedInventory('N04', digest, (s) => {
      s.migrations.pop(); s.migrationCount = 96; s.latestMigrationId = s.migrations.at(-1).id;
      if (digest.startsWith('05983dc1')) {
        for (const row of s.migrations) if (rejectedHistoricalHashes[row.id]) row.sha256 = rejectedHistoricalHashes[row.id];
      }
      assert.equal(sha256(canonicalJson(s.migrations)), digest);
      s.migrationSetSha256 = digest;
    });
  }
});

test('N05: the correct first96 prefix and a physically absent 0081 are refused', () => {
  forgedInventory('N05', 'correct prefix rows only', (s) => { s.migrations.pop(); });
  const path = join(sourceFixture(), 'supabase/migrations', source.migrations.at(-1).file);
  const original = readFileSync(path);
  try {
    unlinkSync(path);
    refused('N05', 'missing 0081', () => assertCurrentSourceContract(buildSourceInventory(sourceFixture())));
  } finally { writeFileSync(path, original); }
});

test('N06: an unchanged migration ID and bytes under a renamed file are refused', () => {
  const original = join(sourceFixture(), 'supabase/migrations', source.migrations[0].file);
  const renamed = join(dirname(original), `${source.migrations[0].id}_renamed.sql`);
  try {
    renameSync(original, renamed);
    refused('N06', 'same bytes and ID, different filename', () => assertCurrentSourceContract(buildSourceInventory(sourceFixture())));
  } finally { renameSync(renamed, original); }
});

test('N07: duplicate physical migration IDs and duplicate witness rows fail', () => {
  const duplicate = join(sourceFixture(), 'supabase/migrations', `${source.migrations[0].id}_duplicate.sql`);
  try {
    writeFileSync(duplicate, readFileSync(join(repoRoot, 'supabase/migrations', source.migrations[0].file)));
    refused('N07', 'duplicate physical ID', () => buildSourceInventory(sourceFixture()), ['DB06_SOURCE_MIGRATIONS_INVALID']);
  } finally { unlinkSync(duplicate); }
  forgedInventory('N07', 'duplicate inventory row', (s) => { s.migrations[1] = s.migrations[0]; });
});

test('N08: reordered migration witnesses cannot preserve approval with scalar count/head', () => {
  forgedInventory('N08', 'swap first two rows', (s) => { [s.migrations[0], s.migrations[1]] = [s.migrations[1], s.migrations[0]]; });
});

test('N09: invalid SQL names, hidden migration inputs and directories fail closed', () => {
  for (const name of ['unknown.sql', '.hidden.sql', 'hidden-input']) {
    const path = join(sourceFixture(), 'supabase/migrations', name);
    try {
      writeFileSync(path, '-- unapproved input\n');
      refused('N09', name, () => buildSourceInventory(sourceFixture()), ['DB06_SOURCE_MIGRATIONS_INVALID']);
    } finally { unlinkSync(path); }
  }
  const directory = join(sourceFixture(), 'supabase/migrations', 'extra-directory');
  try {
    mkdirSync(directory);
    refused('N09', 'directory input', () => buildSourceInventory(sourceFixture()), ['DB06_SOURCE_MIGRATIONS_INVALID']);
  } finally { rmdirSync(directory); }
});

test('N10: each successor 0079, 0080 and 0081 is individually pinned', () => {
  for (const { file } of source.migrations.slice(-3)) editedSource('N10', `supabase/migrations/${file}`);
});

test('N11: each of eighteen same-slug entrypoint byte edits is refused', () => {
  for (const { entrypoint } of source.functions) editedSource('N11', entrypoint);
});

test('N12: all transitive local sources are pinned, including every affected shared closure', () => {
  const paths = [...new Set(Object.values(source.functionSources).flat().map(({ path }) => path))];
  for (const path of paths.filter((path) => !path.endsWith('/index.ts'))) {
    const full = `supabase/functions/${path}`;
    const target = join(sourceFixture(), full), original = readFileSync(target);
    try {
      writeFileSync(target, Buffer.concat([original, Buffer.from(' ')]));
      const observed = buildSourceInventory(sourceFixture());
      const affected = source.functions.filter(({ slug }) => source.functionSources[slug].some((row) => row.path === path));
      assert.ok(affected.length > 0);
      for (const { slug, sourceSetSha256 } of affected) {
        assert.notEqual(observed.functions.find((f) => f.slug === slug).sourceSetSha256, sourceSetSha256);
      }
      refused('N12', `${path}: ${affected.map(({ slug }) => slug).join(',')}`, () => assertCurrentSourceContract(observed));
    } finally { writeFileSync(target, original); }
  }
});

test('N13: missing helpers, unresolved/escaping imports and junctions are refused', () => {
  const path = join(sourceFixture(), 'supabase/functions/_shared/env.ts'), original = readFileSync(path);
  try {
    unlinkSync(path);
    refused('N13', 'deleted helper', () => buildSourceInventory(sourceFixture()));
  } finally { writeFileSync(path, original); }
  editedSource('N13', source.functions[0].entrypoint,
    (bytes) => Buffer.concat([bytes, Buffer.from("\nimport './missing-helper.ts';\n")]),
    ['DB06_FUNCTION_IMPORT_UNRESOLVED']);
  const outside = join(sourceFixture(), 'outside.ts');
  try {
    writeFileSync(outside, '// source outside functions root\n');
    editedSource('N13', source.functions[0].entrypoint,
      (bytes) => Buffer.concat([bytes, Buffer.from("\nimport '../../../outside.ts';\n")]),
      ['DB06_FUNCTION_IMPORT_ESCAPES_ROOT']);
  } finally { unlinkSync(outside); }
  const directory = join(sourceFixture(), 'supabase/functions/_shared');
  const retained = `${directory}-retained`;
  renameSync(directory, retained);
  try {
    symlinkSync(retained, directory, process.platform === 'win32' ? 'junction' : 'dir');
    refused('N13', 'shared directory symlink/junction', () => buildSourceInventory(sourceFixture()), ['DB06_SOURCE_PATH_UNSAFE']);
  } finally {
    if (existsSync(directory)) unlinkSync(directory);
    renameSync(retained, directory);
  }
});

test('N14: undeclared directories, entrypoints and unreferenced local inputs fail', () => {
  for (const name of ['extra-function/index.ts', '_shared/extra/index.ts', '.hidden.ts']) {
    const path = join(sourceFixture(), 'supabase/functions', name);
    mkdirSync(dirname(path), { recursive: true });
    try {
      writeFileSync(path, '// unreviewed input\n');
      refused('N14', name, () => buildSourceInventory(sourceFixture()));
    } finally {
      unlinkSync(path);
      if (name.includes('/')) rmdirSync(dirname(path));
    }
  }
});

test('N15: deployByDefault changes, added defaults and duplicate manifest keys fail', () => {
  for (const mutate of [
    (m) => { m.functions['account-deletion'].deployByDefault = false; },
    (m) => { m.functions.extra = m.functions['account-deletion']; },
  ]) editedSource('N15', 'supabase/functions/manifest.json', (bytes) => {
    const m = JSON.parse(bytes); mutate(m); return Buffer.from(JSON.stringify(m));
  });
  editedSource('N15', 'supabase/functions/manifest.json', (bytes) =>
    Buffer.from(bytes.toString().replace('"schemaVersion": 1', '"schemaVersion": 1, "schemaVersion": 1')));
});

test('N16: each manifest JWT flag and each config JWT/entrypoint is immutable', () => {
  for (const { slug, verifyJwt } of source.functions) {
    editedSource('N16', 'supabase/functions/manifest.json', (bytes) => {
      const m = JSON.parse(bytes); m.functions[slug].verifyJwt = !verifyJwt; return Buffer.from(JSON.stringify(m));
    });
    for (const field of ['verify_jwt', 'entrypoint']) {
      editedSource('N16', 'supabase/config.toml', (bytes) => {
        const text = bytes.toString();
        const section = `[functions.${slug}]`, start = text.indexOf(section), next = text.indexOf('\n[', start + section.length);
        assert.ok(start >= 0);
        const end = next < 0 ? text.length : next;
        const part = text.slice(start, end).replace(new RegExp(`${field} = [^\\n]+`, 'u'), `${field} = ${field === 'verify_jwt' ? String(!verifyJwt) : '"./functions/wrong/index.ts"'}`);
        assert.notEqual(part, text.slice(start, end));
        return Buffer.from(text.slice(0, start) + part + text.slice(end));
      });
    }
  }
});

test('N17: full manifest metadata beyond selected scalar rows is immutable', () => {
  for (const key of ['optionalEnvironment', 'conditionalEnvironment', 'conditionalSecrets', 'requiredSecrets', 'auth', 'resourceLimits', 'resourceLimitSemantics']) {
    editedSource('N17', 'supabase/functions/manifest.json', (bytes) => {
      const m = JSON.parse(bytes);
      if (key === 'resourceLimitSemantics') m[key] += ' changed';
      else if (key === 'auth') m.functions['account-deletion'][key] += '-changed';
      else if (key === 'resourceLimits') m.functions['account-deletion'][key].memoryMb += 1;
      else m.functions['account-deletion'][key] = ['UNREVIEWED_METADATA'];
      return Buffer.from(JSON.stringify(m));
    });
  }
});

test('N18: deno.lock bytes cannot change alone', () => editedSource('N18', 'supabase/functions/deno.lock'));

test('N19: every generated type/client overlay is bound as raw bytes, independent of table counts', () => {
  for (const { path } of source.sourceInputs.filter(({ path }) => path.startsWith('packages/types/'))) editedSource('N19', path);
});

test('N20: each of thirty-three stable deployment inputs is independently bound', () => {
  for (const { path } of source.stableDeploymentInputs) editedSource('N20', path);
});

test('N21: actual archived C2 package-lock bytes cannot substitute for G', () => {
  // Compressed byte-offset delta from the independently archived C2 lock (not executed).
  const delta = JSON.parse(inflateSync(Buffer.from('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', 'base64')));
  editedSource('N21', 'package-lock.json', (bytes) => {
    assert.equal(sha256(bytes), '89c56be59f2f910f3ca16fb9cf720297d5452e7de6a6e1d5bd095b9e2387e2d5');
    const parts = []; let offset = 0;
    for (const [start, end, replacement] of delta) {
      parts.push(bytes.subarray(offset, start), Buffer.from(replacement, 'base64')); offset = end;
    }
    parts.push(bytes.subarray(offset));
    const substituted = Buffer.concat(parts);
    assert.equal(substituted.length, 574165);
    assert.equal(sha256(substituted), '83d8239b56fcc56a89b155a4ecd3e99949350ab35755aa4260192b9cc97601c1');
    return substituted;
  });
});

test('N22: seed and email template bytes cannot change alone', () => {
  for (const path of ['supabase/seed.sql', 'supabase/templates/email_change.html']) editedSource('N22', path);
});

test('N23: stale correct aggregate scalars cannot conceal row/hash/size/path/count edits', () => {
  for (const mutate of [
    (s) => { s.migrations[0].sha256 = '0'.repeat(64); },
    (s) => { s.migrations.pop(); },
    (s) => { s.stableDeploymentInputs[0].byteCount += 1; },
    (s) => { s.sourceInputs[0].path = '../outside'; },
    (s) => { s.functionSources[s.functions[0].slug][0].sha256 = '0'.repeat(64); },
    (inventory) => { inventory.deploymentInputs[0].sha256 = '0'.repeat(64); inventory.deploymentInputSetSha256 = sha256(canonicalJson(inventory.deploymentInputs)); },
    (s) => { s.expandedDeploymentInputs[0].byteCount += 1; },
  ]) forgedInventory('N23', mutate.toString(), mutate);
});

test('N24: missing/extra/malformed witness fields and caller expected-hash options fail closed', () => {
  for (const key of Object.keys(source)) {
    forgedInventory('N24', `missing ${key}`, (s) => { delete s[key]; });
  }
  for (const mutate of [
    (s) => { s.expectedHashes = {}; },
    (s) => { s.migrations = {}; },
    (s) => { s.functions = null; },
    (s) => { s.sourceInputs[0].extra = true; },
    (s) => { s.functionSources = []; },
    (s) => { s.sourceInputs[0].byteCount = '1'; },
  ]) forgedInventory('N24', mutate.toString(), mutate);
  const forged = structuredClone(source); forged.migrations[0].sha256 = '0'.repeat(64);
  refused('N24', 'caller expected-hash override ignored', () => assertCurrentSourceContract(forged, { expectedHashes: forged, approved: true }));
});

test('N25: environment and caller approval claims cannot bypass source or replay', () => {
  const keys = ['DB06_SOURCE_APPROVED', 'DB06_SKIP_SOURCE_CHECK', 'DB06_EXPECTED_MIGRATION_SHA256', 'DB06_REPLAY_APPROVED'];
  const prior = keys.map((key) => process.env[key]);
  try {
    for (const key of keys) process.env[key] = 'true';
    forgedInventory('N25', 'extra caller receipt', (s) => { s.approved = true; });
    const forged = structuredClone(source); forged.migrations[0].sha256 = '0'.repeat(64);
    refused('N25', 'environment does not choose expected pins', () => assertCurrentSourceContract(forged));
    refused('N25', 'environment does not approve replay', () => assertPinnedMigrationRunnerCompatibility(repoRoot, '2.117.0'), ['DB06_CURRENT_CHAIN_REPLAY_REQUIRED']);
  } finally {
    keys.forEach((key, i) => { if (prior[i] === undefined) delete process.env[key]; else process.env[key] = prior[i]; });
  }
});

test('N29: exact candidate source and pinned CLI still stop unconditionally', () => {
  assert.equal(assertCurrentSourceContract(source), true);
  refused('N29', 'correct source plus CLI2.117.0', () => assertPinnedMigrationRunnerCompatibility(repoRoot, '2.117.0'), ['DB06_CURRENT_CHAIN_REPLAY_REQUIRED']);
});

test('N30: wrong, absent and decorated CLI versions never select another runner', () => {
  for (const version of [undefined, null, '', '2.109.1', '2.117.1', 'v2.117.0', '2.117.0 extra', '2.117.0\n']) {
    refused('N30', String(version), () => assertPinnedMigrationRunnerCompatibility(repoRoot, version), ['DB06_CLI_PIN_INVALID']);
  }
});

test('N31: mocked pre-link order stops source/replay failures before any remote command', () => {
  // Inspect the untouched deployment source without importing or invoking the runner.
  const runner = readFileSync(join(repoRoot, 'scripts/phase2/deploy-supabase-staging.mjs'), 'utf8');
  const order = [runner.indexOf('assertCurrentSourceContract(sourceInventory)'), runner.indexOf('assertPinnedMigrationRunnerCompatibility(deploymentRoot, PINNED_CLI_VERSION)'), runner.indexOf("'local-database-verification'"), runner.indexOf("'link-staging-project'")];
  assert.ok(order.every((n) => n >= 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  for (const valid of [false, true]) {
    const calls = [];
    const s = structuredClone(source); if (!valid) s.migrations[0].sha256 = '0'.repeat(64);
    refused('N31', valid ? 'replay stop' : 'source stop', () => {
      assertCurrentSourceContract(s);
      assertPinnedMigrationRunnerCompatibility(repoRoot, '2.117.0');
      calls.push('link', 'sql', 'reset', 'deploy', 'hosted');
    }, [valid ? 'DB06_CURRENT_CHAIN_REPLAY_REQUIRED' : 'DB06_SOURCE_CONTRACT_REVIEW_REQUIRED']);
    assert.deepEqual(calls, []);
  }
});

test('N32: ninety-one generated names cannot replace the historical eighty-two-table check', () => {
  const input = passManifestInput([{ commandId: 'mock', result: 'pass', completedAt: fixedNow.toISOString() }]);
  input.after.schema.publicTableCount = 91;
  input.after.schema.publicRlsTableCount = 91;
  refused('N32', 'generated names are not runtime schema evidence', () => buildEvidenceManifest(input), ['DB06_PASS_EVIDENCE_INCOMPLETE']);
});

test('N33: retained freshness/cohort/Auth/freeze/boundary/secret/version/rollback/containment negatives stay active', () => {
  const functions = parseFunctionInventory(JSON.stringify(functionRows()), source, { requireComplete: true });
  const input = passManifestInput([{ commandId: 'mock', result: 'pass', completedAt: fixedNow.toISOString() }]);
  const common = {
    sourceInventory: source, beforeMigrationIds: [], preMigrationFunctions: functions,
    afterMigrationIds: source.migrations.map(({ id }) => id), afterFunctions: functions,
    afterSchema: input.after.schema, afterSecrets: input.after.secretConfiguration,
    localTypes: input.types.localGenerated, linkedTypes: input.types.linkedGenerated, repositoryTypes: input.types.repositoryGenerated,
  };
  for (const field of ['authUserCount', 'authIdentityCount', 'appleIdentityCount', 'authSessionCount', 'storageObjectCount', 'relevantCronJobCount', 'allCronJobCount']) {
    refused('N33', field, () => validateCompletedDeployment({ ...common, afterSchema: { ...common.afterSchema, [field]: 1 } }), ['DB06_AFTER_SCHEMA_COUNTS_INVALID']);
  }
  const higher = structuredClone(functions); higher[0].version = 2;
  refused('N33', 'function version regression', () => validateCompletedDeployment({ ...common, preMigrationFunctions: higher }), ['DB06_AFTER_FUNCTION_VERSION_REGRESSED']);
  for (const field of ['missingGroupIds', 'appEnvironmentNamesPresent', 'trafficFreezeNamePresent']) {
    const afterSecrets = { ...common.afterSecrets, [field]: field === 'missingGroupIds' ? ['missing'] : false };
    refused('N33', field, () => validateCompletedDeployment({ ...common, afterSecrets }), ['DB06_REQUIRED_HOSTED_CONFIGURATION_MISSING']);
  }
  const rollback = passManifestInput([{ commandId: 'mock', result: 'pass', completedAt: fixedNow.toISOString() }]);
  rollback.rollbackRef = '../';
  refused('N33', 'rollback reference', () => buildEvidenceManifest(rollback), ['DB06_ROLLBACK_REF_INVALID']);
  // The unchanged original tests above additionally exercise stale timestamps, five boundaries,
  // provider/Auth freezes, final validity, secrets/redaction and pending process containment.
});
