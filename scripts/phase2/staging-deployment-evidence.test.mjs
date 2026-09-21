import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

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
  assert.equal(source.migrationCount, 89);
  assert.equal(source.latestMigrationId, '20260921000073');
  assert.equal(source.functionCount, 17);
  assert.equal(source.migrationSetSha256, second.migrationSetSha256);
  assert.equal(source.functionSetSha256, second.functionSetSha256);
  assert.equal(new Set(source.migrations.map(({ sha256: hash }) => hash)).size, 89);
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
  assert.equal(parsed.length, 17);
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
      functionCount: 17,
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
      migrationCount: 89,
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
