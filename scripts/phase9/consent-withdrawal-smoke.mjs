#!/usr/bin/env node
import {
  block,
  command,
  evidenceFlagEnabled,
  exists,
  gitStatusExcludingGeneratedEvidence,
  HEALTH_PURPOSE_READ_FENCED_TABLES,
  hash,
  printResult,
  read,
  warn,
} from './lib.mjs';
import {
  HEALTH_CONSENT_SCHEMA_PATH,
  LIVE_CONSENT_WITHDRAWAL_EVIDENCE_CONTRACT_PATH,
  LIVE_CONSENT_WITHDRAWAL_HARNESS_PATH,
  LIVE_HEALTH_CONSENT_COPY,
  REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS,
  validateLiveConsentWithdrawalArtifact,
} from './consent-withdrawal-evidence.mjs';

const errors = [];
const warnings = [];
const packageJson = JSON.parse(read('package.json'));

const settings = read('apps/mobile/src/features/settings/actions.ts');
const you = read('apps/mobile/src/app/(tabs)/you.tsx');
const trend = read('apps/mobile/src/features/trend/consent.ts');
const trendStore = read('apps/mobile/src/features/trend/store.ts');
const community = read('apps/mobile/src/features/community/consent.ts');
const commerce = read('apps/mobile/src/features/commerce/consent.ts');
const commerceStore = read('apps/mobile/src/features/commerce/store.ts');
const ask = read('apps/mobile/src/features/ask/consent.ts');
const photoConsent = read('apps/mobile/src/features/photos/consent.ts');
const consentClient = read('apps/mobile/src/lib/consent/consent.ts');
const consentClientTest = read('apps/mobile/src/lib/consent/consent.test.ts');
const withdrawalClient = read('apps/mobile/src/lib/consent/withdrawal.ts');
const withdrawalClientTest = read('apps/mobile/src/lib/consent/withdrawal.test.ts');
const dependentConsentLifecycle = read('apps/mobile/src/lib/consent/dependentConsentLifecycle.ts');
const dependentConsentLifecycleTest = read(
  'apps/mobile/src/lib/consent/dependentConsentLifecycle.test.ts',
);
const dependentConsentLease = read('apps/mobile/src/lib/consent/dependentConsentLease.ts');
const dependentConsentLeaseTest = read('apps/mobile/src/lib/consent/dependentConsentLease.test.ts');
const dependentConsentCopy = read('apps/mobile/src/lib/consent/dependentConsentContract.ts');
const baseConsentCopy = read('apps/mobile/src/features/onboarding/consentCopy.ts');
const edgeFunction = read('supabase/functions/consent-withdrawal/index.ts');
const edgeHealthConsentContract = read(
  'supabase/functions/consent-withdrawal/healthConsentContract.ts',
);
const healthLifecycleCore = read('supabase/functions/consent-withdrawal/healthLifecycleCore.ts');
const granularWithdrawalCore = read(
  'supabase/functions/consent-withdrawal/granularWithdrawalCore.ts',
);
const dependentCleanupRuntime = read(
  'supabase/functions/consent-withdrawal/dependentCleanupRuntime.ts',
);
const healthWorker = read('supabase/functions/health-consent-worker/index.ts');
const healthWorkerCore = read('supabase/functions/health-consent-worker/workerCore.ts');
const dependentHealthWorkerCore = read(
  'supabase/functions/health-consent-worker/dependentWorkerCore.ts',
);
const healthWorkerHandler = read('supabase/functions/health-consent-worker/httpHandler.ts');
const dataExport = read('supabase/functions/data-export/index.ts');
const edgeManifest = JSON.parse(read('supabase/functions/manifest.json'));
const supabaseConfig = read('supabase/config.toml');
const storagePathHelper = read('supabase/functions/_shared/storagePath.ts');
const storagePathHelperTest = read('supabase/functions/_shared/storagePath.test.ts');
const liveHarness = read('scripts/phase9/live-consent-withdrawal.mjs');
const liveEvidenceContract = read('scripts/phase9/consent-withdrawal-evidence.mjs');
const liveArtifactPath = 'docs/phase-9/generated/live-consent-withdrawal.json';
let liveArtifact = null;
let liveArtifactParseFailed = false;
if (exists(liveArtifactPath)) {
  try {
    liveArtifact = JSON.parse(read(liveArtifactPath));
  } catch {
    liveArtifactParseFailed = true;
  }
}
const currentSourceSha = command('git', ['rev-parse', 'HEAD']).trim();
const liveArtifactValidation = validateLiveConsentWithdrawalArtifact(liveArtifact, {
  nowMs: Date.now(),
  sourceSha: currentSourceSha,
  currentSourceTreeClean: gitStatusExcludingGeneratedEvidence() === '',
  expectedProjectRef: String(process.env.PHASE9_EXPECTED_SUPABASE_PROJECT_REF ?? '').trim(),
  schemaSha256: hash(HEALTH_CONSENT_SCHEMA_PATH),
  harnessSha256: hash(LIVE_CONSENT_WITHDRAWAL_HARNESS_PATH),
  evidenceContractSha256: hash(LIVE_CONSENT_WITHDRAWAL_EVIDENCE_CONTRACT_PATH),
});
const migrations =
  read('supabase/migrations/20260613000023_community.sql') +
  read('supabase/migrations/20260614000025_ask_layerwell.sql');
const phase9ConsentMigration = read(
  'supabase/migrations/20260705000032_phase9_consent_withdrawal.sql',
);
const commerceZeroAdmissionMigration = read(
  'supabase/migrations/20260729000072_commerce_zero_admission.sql',
);
const healthLifecycleMigration = read(
  'supabase/migrations/20260715000054_health_consent_withdrawal_lifecycle.sql',
);
const healthConsentCopyMigrations =
  healthLifecycleMigration +
  read('supabase/migrations/20260726000070_health_consent_draft_successor_staging.sql') +
  read('supabase/migrations/20260921000074_ask_consent_rebrand_hash_alignment.sql');
const routineAdherenceMigration = read(
  'supabase/migrations/20260726000068_routine_adherence_authority.sql',
);
const routineCompletionSyncMigration = read(
  'supabase/migrations/20260726000069_routine_completion_sync_bridge.sql',
);
const catalogScanMinimizationMigration = read(
  'supabase/migrations/20260718000059_catalog_scan_minimization.sql',
);
const healthLifecyclePgTap = read('supabase/tests/database/health_consent_lifecycle.test.sql');
const dependentConsentRpc =
  healthLifecycleMigration.match(
    /create or replace function public\.record_health_dependent_consent\([\s\S]*?\n\$\$;/,
  )?.[0] ?? '';
function exportedAsyncFunction(source, name) {
  return (
    source.match(
      new RegExp(`export async function ${name}\\([^)]*\\): Promise<void> \\{[\\s\\S]*?\\n\\}`),
    )?.[0] ?? ''
  );
}
const trendRevocation = exportedAsyncFunction(trend, 'revokeTrendInsightsConsent');
const communityRevocation = exportedAsyncFunction(community, 'withdrawCommunityConsent');
const commerceDecline = exportedAsyncFunction(commerce, 'declineCommerceConsent');
const askRevocation = exportedAsyncFunction(ask, 'revokeAskConsent');
const retiredReadFenceTargets = new Set(
  [
    ...catalogScanMinimizationMigration.matchAll(
      /drop policy if exists "health_processing_read_fence" on (public|storage)\.([a-z_]+)/g,
    ),
  ].map((match) => `${match[1]}.${match[2]}`),
);
const installedReadFenceTargets = [
  ...healthLifecycleMigration.matchAll(
    /create policy "health_processing_read_fence" on (public|storage)\.([a-z_]+)/g,
  ),
  ...routineCompletionSyncMigration.matchAll(
    /create policy "shelf_product_identities_health_read_fence"\s+on (public|storage)\.([a-z_]+)/g,
  ),
]
  .map((match) => `${match[1]}.${match[2]}`)
  .filter((target) => !retiredReadFenceTargets.has(target));
const readFencedOwnershipHelpers = Object.fromEntries(
  ['owns_routine', 'owns_user_product', 'owns_cycle', 'owns_photo', 'owns_ask_turn_audit'].map(
    (name) => [
      name,
      healthLifecycleMigration.match(
        new RegExp(`create or replace function public\\.${name}\\([^)]*\\)[\\s\\S]*?\\$\\$;`),
      )?.[0] ?? '',
    ],
  ),
);

block(
  errors,
  /withdrawHealthDataConsent/.test(settings),
  'Health-data consent withdrawal action is missing.',
);
block(
  errors,
  /withdrawHealthDataConsent/.test(settings),
  'Health-data withdrawal must retain a dedicated non-destructive action.',
);
block(
  errors,
  /recordConsent/.test(you) &&
    !/(?:grantCommerceConsent|declineCommerceConsent|commerceConsent|isCommerceConsented|type:\s*['"]data_sharing['"])/.test(
      you,
    ),
  'Settings/privacy may preserve purpose-specific non-commerce consent writes but must not read, resolve, or write a positive commerce cache under COM-01A.',
);

block(
  errors,
  /revokeTrendInsightsConsent/.test(trend),
  'Trend consent revocation function is missing.',
);
block(
  errors,
  /clearTrendStore/.test(trend) &&
    /multiRemovePrivateItems\(\[CONSENT_KEY, STATE_KEY\]\)/.test(trendStore),
  'Trend consent revocation must delete local trend state.',
);
block(
  errors,
  /withdrawHealthDependentConsent\(\{[\s\S]*type:\s*'photo_trend_insights',[\s\S]*deleteLocal:\s*clearTrendStore/.test(
    trendRevocation,
  ) && /const attestation = await withdrawConsent\(\{/.test(dependentConsentLifecycle),
  'Trend consent revocation must call the server withdrawal path.',
);

block(
  errors,
  /withdrawCommunityConsent/.test(community),
  'Community consent withdrawal function is missing.',
);
block(
  errors,
  /withdrawHealthDependentConsent\(\{[\s\S]*type:\s*'community_participation',[\s\S]*deleteLocal:\s*clearCommunityState/.test(
    communityRevocation,
  ) && /const attestation = await withdrawConsent\(\{/.test(dependentConsentLifecycle),
  'Community consent withdrawal must call the server withdrawal path.',
);
block(
  errors,
  /community_questions.*on delete cascade/s.test(migrations),
  'Community questions must cascade on account deletion.',
);
block(
  errors,
  /community_reactions.*on delete cascade/s.test(migrations),
  'Community reactions must cascade on account deletion.',
);

block(errors, /data_sharing/.test(commerce), 'Commerce must use the data_sharing consent type.');
block(
  errors,
  /withdrawHealthDependentConsent\(\{[\s\S]*type:\s*'data_sharing',[\s\S]*deleteLocal:\s*clearCommerceState/.test(
    commerceDecline,
  ) && /removePrivateItem\(CONSENT_KEY\)/.test(commerceStore),
  'Commerce decline must relock local paid-link affordance.',
);
block(
  errors,
  /withdrawHealthDependentConsent/.test(commerceDecline) &&
    /const attestation = await withdrawConsent\(\{/.test(dependentConsentLifecycle),
  'Commerce consent withdrawal must call the server withdrawal path.',
);

block(errors, /revokeAskConsent/.test(ask), 'Ask consent revocation function is missing.');
block(errors, /clearAskStore/.test(ask), 'Ask consent revocation must clear local Ask state.');
block(
  errors,
  /withdrawHealthDependentConsent\(\{[\s\S]*type:\s*'ask_layerwell',[\s\S]*deleteLocal:\s*clearAskStore/.test(
    askRevocation,
  ) && /const attestation = await withdrawConsent\(\{/.test(dependentConsentLifecycle),
  'Ask consent revocation must call the server withdrawal path.',
);
block(
  errors,
  /ask_safety_audit.*on delete cascade/s.test(migrations),
  'Ask safety audit must cascade on account deletion.',
);
block(
  errors,
  /PHOTO_CLOUD_BACKUP_AVAILABLE\s*=\s*false/.test(photoConsent) &&
    /clearUnavailableCloudBackupPreference/.test(photoConsent) &&
    !/setCloudBackupEnabled/.test(photoConsent) &&
    /case 'photo_cloud_backup':\s*return await withdrawPhotoCloudBackup/.test(
      dependentCleanupRuntime,
    ),
  'Unavailable cloud backup must expose no grant setter, clear stale local preference, and retain server-side legacy cleanup.',
);

block(
  errors,
  /supabase\.functions\.invoke\('consent-withdrawal'/.test(withdrawalClient),
  'Mobile withdrawal helper must invoke consent-withdrawal.',
);
block(
  errors,
  /HEALTH_DEPENDENT_CONSENT_COPY_REVIEW_STATUS/.test(dependentConsentCopy) &&
    /action === 'grant'/.test(dependentConsentCopy) &&
    /HEALTH_DEPENDENT_CONSENT_COPY_REVIEW_STATUS\[type\]\.grant !== 'approved'/.test(
      dependentConsentCopy,
    ) &&
    /HEALTH_DATA_CONSENT_COPY_REVIEW_STATUS/.test(baseConsentCopy) &&
    /action === 'grant'/.test(baseConsentCopy) &&
    /HEALTH_DATA_CONSENT_COPY_REVIEW_STATUS\.collection !== 'approved'/.test(baseConsentCopy) &&
    (granularWithdrawalCore.match(/^[ ]{4}reviewStatus: 'draft_blocked'/gm)?.length ?? 0) === 6 &&
    /reviewStatus: 'draft_blocked'/.test(edgeHealthConsentContract) &&
    /copyIsApproved/.test(granularWithdrawalCore) &&
    /healthRequest\?\.action === 'reconsent'/.test(edgeFunction) &&
    /assertBaseHealthGrantCopyEnvironment\(appEnvironment\)/.test(edgeFunction) &&
    !/assertBaseHealthGrantCopyEnvironment/.test(healthWorker),
  'Base and dependent copy contracts must carry explicit review status; new grants are blocked while withdrawal and scheduled erasure stay available.',
);
block(
  errors,
  /const canonical = await assertConsentCopyIntegrity\(dependentType, 'withdrawal'\)/.test(
    withdrawalClient,
  ) &&
    /consentTextHash:\s*canonical\.sha256/.test(withdrawalClient) &&
    /Crypto\.digestStringAsync\(Crypto\.CryptoDigestAlgorithm\.SHA256, text\)/.test(
      dependentConsentCopy,
    ),
  'Mobile withdrawal helper must send a SHA-256 consent text hash.',
);

block(
  errors,
  /caller\.auth\.getUser\(\)/.test(edgeFunction) &&
    /verifiedAuthSessionClaimsFromJwt\(token, userId\)/.test(edgeFunction),
  'consent-withdrawal must validate the caller bearer and exact session claims.',
);
block(
  errors,
  /req\.method === 'OPTIONS'/.test(edgeFunction),
  'consent-withdrawal must handle CORS preflight early.',
);
block(
  errors,
  /req\.method !== 'POST'/.test(edgeFunction),
  'consent-withdrawal must reject non-POST methods.',
);
block(
  errors,
  edgeFunction.indexOf("req.method !== 'POST'") !== -1 &&
    edgeFunction.indexOf('caller.auth.getUser()') !== -1 &&
    edgeFunction.indexOf("req.method !== 'POST'") < edgeFunction.indexOf('caller.auth.getUser()'),
  'consent-withdrawal method check must run before caller auth resolution.',
);
block(
  errors,
  /parseGranularWithdrawalRequest/.test(edgeFunction) &&
    /exactKeys\(value/.test(granularWithdrawalCore) &&
    /INVALID_BODY/.test(edgeFunction),
  'consent-withdrawal must reject unknown or invalid body fields.',
);
block(
  errors,
  /begin_health_dependent_consent_withdrawal/.test(edgeFunction) &&
    /insert into public\.consents[\s\S]*false/.test(healthLifecycleMigration) &&
    !/from\('consents'\)/.test(edgeFunction),
  'consent-withdrawal must delegate the false ledger receipt to the atomic database authority.',
);
block(
  errors,
  /runAuthenticatedHealthDependentCleanup/.test(edgeFunction) &&
    !/runHealthDependentCleanup\(admin, operation\)/.test(edgeFunction) &&
    /operation\.consentType === 'photo_capture'/.test(dependentCleanupRuntime) &&
    /operation\.consentType === 'photo_cloud_backup'/.test(dependentCleanupRuntime) &&
    /DependentPhotoCleanupRequiresWorkerError/.test(dependentCleanupRuntime) &&
    /list_health_dependent_consent_storage_work/.test(healthWorker) &&
    /!await prepareDependentPhotoStorage\(/.test(dependentHealthWorkerCore) &&
    /HEALTH_DEPENDENT_STORAGE_WORK_PATH_INVALID/.test(healthLifecycleMigration) &&
    /HEALTH_DEPENDENT_STORAGE_WORK_BOUND_EXCEEDED/.test(healthLifecycleMigration) &&
    /withdrawPhotoCloudBackup/.test(dependentCleanupRuntime) &&
    /runGranularPhotoCloudCleanup/.test(dependentCleanupRuntime) &&
    /healthPhotoPathSafeForWithdrawal/.test(dependentHealthWorkerCore) &&
    /dependencies\.removeStorage\(batch\)/.test(granularWithdrawalCore),
  'Photo Storage deletion must be worker-only, database ownership-attested, path-safe, and bounded.',
);
block(
  errors,
  /SAFE_STORAGE_PATH_SEGMENT/.test(storagePathHelper) &&
    /segment !== '\.'/.test(storagePathHelper) &&
    /segment !== '\.\.'/.test(storagePathHelper),
  'Shared photo storage path helper must reject unsafe object path segments.',
);
block(
  errors,
  /photo storage path contract rejects cross-user or malformed paths/.test(storagePathHelperTest) &&
    /%2e%2e/.test(storagePathHelperTest) &&
    /token=secret/.test(storagePathHelperTest),
  'Shared photo storage path helper test must cover traversal and signed-token path probes.',
);
block(
  errors,
  /local_only:\s*true/.test(dependentCleanupRuntime) &&
    /storage_path:\s*null/.test(dependentCleanupRuntime),
  'Photo cloud withdrawal must relocalize photo metadata.',
);
block(
  errors,
  /withdrawAskLayerwell/.test(dependentCleanupRuntime) &&
    /ask_safety_audit/.test(dependentCleanupRuntime),
  'Ask withdrawal must delete server-side safety audit content.',
);
block(
  errors,
  /withdrawTrendInsights/.test(dependentCleanupRuntime) &&
    /photo_trend/.test(dependentCleanupRuntime),
  'Trend withdrawal must delete server-side trend rows.',
);
block(
  errors,
  /withdrawCommunityParticipation/.test(dependentCleanupRuntime) &&
    /community_questions/.test(dependentCleanupRuntime) &&
    /community_reactions/.test(dependentCleanupRuntime),
  'Community withdrawal must delete user community questions and reactions.',
);
block(
  errors,
  /withdrawDataSharing/.test(dependentCleanupRuntime) &&
    /order_attributions/.test(dependentCleanupRuntime) &&
    /commerce_click_events/.test(dependentCleanupRuntime),
  'Data-sharing withdrawal must preserve installed-base order detachment and commerce-click deletion.',
);
block(
  errors,
  !/error:\s*.*\.message/.test(edgeFunction),
  'consent-withdrawal must not return raw error messages.',
);
block(
  errors,
  /console\.error\('\[consent-withdrawal\]',\s*'CONSENT_WITHDRAWAL_FAILED'\)/.test(edgeFunction),
  'consent-withdrawal must log only a stable cleanup failure code.',
);
block(
  errors,
  !/error\s+instanceof\s+Error\s*\?\s*error\.message/.test(edgeFunction),
  'consent-withdrawal must not log raw exception messages.',
);
block(
  errors,
  /expectedProcessingEpoch/.test(healthLifecycleCore) &&
    /validActiveEpoch\(value\.expectedProcessingEpoch\)/.test(healthLifecycleCore) &&
    /p_expected_epoch:\s*request\.expectedProcessingEpoch/.test(edgeFunction) &&
    /begin_health_data_consent_withdrawal/.test(edgeFunction),
  'Health withdrawal intake must bind the idempotency key to the caller expected processing epoch.',
);
block(
  errors,
  /receipt_capability_xid pg_catalog\.xid8/.test(healthLifecycleMigration) &&
    /receipt_capability_backend_pid integer/.test(healthLifecycleMigration) &&
    /create or replace function public\._issue_health_consent_receipt_capability\(/.test(
      healthLifecycleMigration,
    ) &&
    /states\.receipt_capability_xid\s*= pg_catalog\.pg_current_xact_id\(\)/.test(
      healthLifecycleMigration,
    ) &&
    /states\.receipt_capability_backend_pid\s*= pg_catalog\.pg_backend_pid\(\)/.test(
      healthLifecycleMigration,
    ) &&
    /states\.receipt_capability_consent_type = new\.consent_type/.test(healthLifecycleMigration) &&
    /states\.receipt_capability_granted = new\.granted/.test(healthLifecycleMigration) &&
    /states\.receipt_capability_version = new\.version/.test(healthLifecycleMigration) &&
    /states\.receipt_capability_text_hash = new\.consent_text_hash/.test(
      healthLifecycleMigration,
    ) &&
    /HEALTH_CONSENT_RECEIPT_CAPABILITY_REQUIRED/.test(healthLifecycleMigration) &&
    /revoke all on function public\._issue_health_consent_receipt_capability\([\s\S]*?from public, anon, authenticated, service_role/.test(
      healthLifecycleMigration,
    ),
  'Dependent grants must require a sealed transaction/backend capability that direct authenticated and service callers cannot forge.',
);
block(
  errors,
  /public\._assert_current_health_session\(v_user_id\)/.test(dependentConsentRpc) &&
    /public\._assert_health_processing_epoch_locked\([\s\S]*v_user_id,[\s\S]*p_expected_epoch/.test(
      dependentConsentRpc,
    ) &&
    /v_state\.generation <> p_expected_generation/.test(dependentConsentRpc) &&
    /public\._assert_health_consent_copy_for_type\([\s\S]*p_consent_type, 'grant', p_version, p_consent_text_hash/.test(
      dependentConsentRpc,
    ) &&
    /public\._issue_health_consent_receipt_capability\([\s\S]*'dependent_grant'/.test(
      dependentConsentRpc,
    ) &&
    /public\._assert_health_consent_capability_cleared\(v_user_id\)/.test(dependentConsentRpc) &&
    !/set_config\(\s*'app\.health_consent_rpc'/.test(dependentConsentRpc) &&
    /revoke all on function public\.record_health_dependent_consent\(\s*bigint, bigint, text, text, text, text\s*\)\s+from public, anon, service_role/.test(
      healthLifecycleMigration,
    ) &&
    /grant execute on function public\.record_health_dependent_consent\(\s*bigint, bigint, text, text, text, text\s*\)\s+to authenticated/.test(
      healthLifecycleMigration,
    ),
  'The dependent-consent RPC must bind current session, exact active epoch/current base copy, clear its sealed guard, and remain authenticated-only.',
);
block(
  errors,
  /beginHealthDependentConsentGrant\(type\)/.test(dependentConsentLifecycle) &&
    /runAccountGenerationOperation/.test(dependentConsentLifecycle) &&
    /healthEpoch:\s*number/.test(dependentConsentLease) &&
    /healthGeneration:\s*number/.test(dependentConsentLease) &&
    /signal:\s*AbortSignal/.test(dependentConsentLease) &&
    /assertCurrent:\s*\(\) => void/.test(dependentConsentLease) &&
    (dependentConsentLifecycle.match(/assertAccountMatches\(accountLease, dependentLease\)/g)
      ?.length ?? 0) >= 4 &&
    /createConsentIdempotencyKey\(\)/.test(dependentConsentLifecycle) &&
    /expectedUserId:\s*dependentLease\.ownerUserId/.test(dependentConsentLifecycle) &&
    /runCurrentHealthDataOperation/.test(consentClient) &&
    /userData\.user\?\.id !== lease\.ownerUserId/.test(consentClient) &&
    /record_health_dependent_consent/.test(consentClient) &&
    /p_expected_epoch: lease\.epoch/.test(consentClient) &&
    /abortSignal\(lease\.signal\)/.test(consentClient) &&
    (consentClient.match(/lease\.assertCurrent\(\)/g)?.length ?? 0) >= 4,
  'Mobile dependent grants must retain one owner/epoch lease across hashing, persisted-owner verification, RPC dispatch, abort, and result reassertion.',
);
block(
  errors,
  /service role cannot spoof the legacy GUC/.test(healthLifecyclePgTap) &&
    /a downstream insert failure rolls the sealed dependent-grant capability back/.test(
      healthLifecyclePgTap,
    ) &&
    /exception leaves no reusable dependent-grant capability/.test(healthLifecyclePgTap) &&
    /the exact dependent grant can be retried after transaction rollback/.test(
      healthLifecyclePgTap,
    ) &&
    /account-deletion barrier prevents a new dependent grant/.test(healthLifecyclePgTap) &&
    /stale base-health disclosure copy cannot authorize/.test(healthLifecyclePgTap) &&
    /closes before the first withdrawal await and persists pending before deletion/.test(
      dependentConsentLifecycleTest,
    ) &&
    /keeps a 202 response durably pending and visibly unsuccessful/.test(
      dependentConsentLifecycleTest,
    ) &&
    /does not let a queued grant publish after a later withdrawal/.test(
      dependentConsentLeaseTest,
    ) &&
    /never lets A dependent authority cross into B/.test(dependentConsentLeaseTest) &&
    /aborts an in-flight invocation across an A→B account boundary/.test(withdrawalClientTest) &&
    /rejects every protected direct granted=false write before hashing or network/.test(
      consentClientTest,
    ),
  'Dependent-consent tests must cover service spoofing, lifecycle contention, rollback/retry, deletion and copy fences, owner changes, abort, and closed-state revocation.',
);
block(
  errors,
  /action:\s*'decline'/.test(healthLifecycleCore) &&
    /value\.expectedProcessingEpoch !== 0/.test(healthLifecycleCore) &&
    /decline_initial_health_data_consent/.test(edgeFunction),
  'Initial health decline must require epoch zero and use the owner-derived append-only RPC.',
);
block(
  errors,
  /healthPhotoPathBelongsToEpoch/.test(healthLifecycleCore) &&
    /`e\$\{epoch\}`/.test(healthLifecycleCore),
  'Health Storage cleanup must attest both owner and processing epoch.',
);
block(
  errors,
  /admin\.rpc\(\s*['"]claim_health_consent_withdrawal_for_owner['"]/.test(edgeFunction) &&
    !/caller\.rpc\(\s*['"]claim_health_consent_withdrawal_for_owner['"]/.test(edgeFunction) &&
    /p_user_id:\s*userId[\s\S]*p_operation_id:\s*operationId[\s\S]*p_claim_token:\s*claimToken/.test(
      edgeFunction.slice(
        edgeFunction.indexOf('claim_health_consent_withdrawal_for_owner'),
        edgeFunction.indexOf('claim_health_consent_withdrawal_for_owner') + 500,
      ),
    ) &&
    /revoke all on function public\.claim_health_consent_withdrawal_for_owner\(uuid, uuid, text\)\s+from public, anon, authenticated/.test(
      healthLifecycleMigration,
    ) &&
    /grant execute on function public\.claim_health_consent_withdrawal_for_owner\(uuid, uuid, text\)\s+to service_role/.test(
      healthLifecycleMigration,
    ),
  'Owner-lane cleanup claims must be JWT-verified, explicitly owner-bound, and service-only.',
);
block(
  errors,
  (healthLifecycleMigration.match(/_health_relational_data_exists\(v_operation\.user_id\)/g)
    ?.length ?? 0) >= 2 &&
    /public\._health_relational_data_exists\(p_user_id\)[\s\S]*from storage\.objects/.test(
      healthLifecycleMigration,
    ) &&
    /HEALTH_WITHDRAWAL_DATABASE_RESIDUAL/.test(healthLifecycleMigration),
  'Database cleanup and terminal completion must independently attest the canonical relational inventory is empty.',
);
block(
  errors,
  (healthLifecycleMigration.match(/on delete set null/g)?.length ?? 0) >= 2 &&
    /community_reports[\s\S]*alter column question_id drop not null/.test(
      healthLifecycleMigration,
    ) &&
    /pg_catalog\.pg_trigger_depth\(\) > 1/.test(healthLifecycleMigration) &&
    /pg_catalog\.to_jsonb\(old\) - 'question_id'/.test(healthLifecycleMigration),
  'Community author erasure must preserve detached cross-owner report and moderation evidence through a narrow FK-only trigger path.',
);
block(
  errors,
  HEALTH_PURPOSE_READ_FENCED_TABLES.length === 26 &&
    JSON.stringify([...installedReadFenceTargets].sort()) ===
      JSON.stringify(
        [
          ...HEALTH_PURPOSE_READ_FENCED_TABLES.map((table) => `public.${table}`),
          'storage.objects',
        ].sort(),
      ) &&
    !installedReadFenceTargets.some((target) =>
      ['public.profiles', 'public.consents', 'public.entitlements'].includes(target),
    ),
  'The restrictive health read fence must cover the exact 26 health-purpose tables plus photo Storage while preserving account, policy, and billing lanes.',
);
block(
  errors,
  /create schema if not exists private/.test(healthLifecycleMigration) &&
    /revoke all on schema private from public, anon, authenticated, service_role/.test(
      healthLifecycleMigration,
    ) &&
    /private\.health_processing_read_allowed/.test(healthLifecycleMigration) &&
    !/schemas\s*=\s*\[[^\]]*['"]private['"]/.test(supabaseConfig) &&
    /_health_read_barrier_context_active/.test(healthLifecycleMigration) &&
    /set current_streak = 0,[\s\S]*longest_streak = 0/.test(healthLifecycleMigration) &&
    /clear_routine_adherence_on_withdrawal/.test(routineAdherenceMigration) &&
    /adherence_timezone = null/.test(routineAdherenceMigration) &&
    /streak_reference_day = null/.test(routineAdherenceMigration) &&
    /streak_algorithm_version = 0/.test(routineAdherenceMigration) &&
    /delete from private\.shelf_sync_operations/.test(routineCompletionSyncMigration) &&
    /delete from private\.routine_completion_sync_operations/.test(
      routineCompletionSyncMigration,
    ) &&
    /shelf_product_identities/.test(routineCompletionSyncMigration),
  'The predicate must remain outside PostgREST and begin must synchronously clear every mixed-purpose profile adherence authority field.',
);
block(
  errors,
  Object.keys(readFencedOwnershipHelpers).length === 5 &&
    ['owns_routine', 'owns_user_product', 'owns_cycle'].every((name) =>
      /private\.health_processing_read_allowed/.test(readFencedOwnershipHelpers[name]),
    ) &&
    /private\.health_dependent_read_allowed\([\s\S]*'photo_capture'/.test(
      readFencedOwnershipHelpers.owns_photo,
    ) &&
    /private\.health_dependent_read_allowed\([\s\S]*'photo_cloud_backup'/.test(
      readFencedOwnershipHelpers.owns_photo,
    ) &&
    /private\.health_dependent_read_allowed\([\s\S]*'ask_layerwell'/.test(
      readFencedOwnershipHelpers.owns_ask_turn_audit,
    ),
  'Authenticated SECURITY DEFINER ownership helpers must not expose residual health-row existence across the read barrier.',
);
block(
  errors,
  /readExportHealthLifecycle\(supabase, userId\)/.test(dataExport) &&
    /const healthReadEpoch = healthReadEpochForExport\(initialHealthLifecycle\)/.test(dataExport) &&
    /const healthSupabase = createClient\(supabaseUrl, publishableKey,[\s\S]*'x-health-processing-epoch': String\(healthReadEpoch\)/.test(
      dataExport,
    ) &&
    /item\.clientKind === 'caller' \? healthSupabase : admin/.test(dataExport) &&
    /const photoBucket = admin\.storage\.from\('photos'\)/.test(dataExport) &&
    /HEALTH_DATA_WITHDRAWAL_IN_PROGRESS/.test(read('supabase/functions/data-export/exportCore.ts')),
  'Data export must retain authenticated active reads, service-filtered/admin sources, and a stable retry response during withdrawal.',
);
const healthWorkerManifest = edgeManifest.functions?.['health-consent-worker'];
block(
  errors,
  healthWorkerManifest?.access === 'scheduled' &&
    healthWorkerManifest?.auth === 'scheduler-secret' &&
    healthWorkerManifest?.verifyJwt === false &&
    healthWorkerManifest?.public === false &&
    healthWorkerManifest?.requiredSecrets?.some(
      (group) =>
        Array.isArray(group) && group.length === 1 && group[0] === 'HEALTH_CONSENT_WORKER_SECRET',
    ) &&
    /\[functions\.health-consent-worker\][\s\S]*verify_jwt = false[\s\S]*health-consent-worker\/index\.ts/.test(
      supabaseConfig,
    ),
  'Health withdrawal worker must be a private scheduled function with a dedicated secret and gateway JWT disabled.',
);
block(
  errors,
  /x-health-consent-worker-secret/.test(healthWorkerHandler) &&
    /constantTimeEqual/.test(healthWorkerHandler) &&
    /HEALTH_CONSENT_WORKER_UNAVAILABLE/.test(healthWorkerHandler) &&
    !/error\.message/.test(healthWorkerHandler),
  'Health withdrawal worker must authenticate the scheduler secret in constant time and redact failures.',
);
block(
  errors,
  /claim_due_health_consent_withdrawals/.test(healthWorker) &&
    /prepare_health_data_consent_withdrawal/.test(healthWorker) &&
    /list_health_consent_storage_work/.test(healthWorker) &&
    /storage\.from\('photos'\)\.remove/.test(healthWorker) &&
    /complete_health_data_consent_withdrawal/.test(healthWorker) &&
    /defer_health_consent_withdrawal/.test(healthWorker),
  'Scheduled health withdrawal must use the durable claim/prepare/list/remove/complete/defer service flow.',
);
block(
  errors,
  /HEALTH_WORKER_MAX_STORAGE_BATCHES/.test(healthWorkerCore) &&
    /HEALTH_WORKER_MAX_CLAIM_LIMIT = 25/.test(healthWorkerCore) &&
    /HEALTH_WORKER_MIN_RETRY_AFTER_SECONDS = 5/.test(healthWorkerCore) &&
    /HEALTH_WORKER_MAX_RETRY_AFTER_SECONDS = 86_400/.test(healthWorkerCore) &&
    /HEALTH_WORKER_BUDGET_EXHAUSTED/.test(healthWorkerCore) &&
    /HEALTH_STORAGE_ATTESTATION_INVALID/.test(healthWorkerCore) &&
    /deferredAttestation/.test(healthWorkerCore),
  'Scheduled health withdrawal work must match database bounds, be deadline-aware, and fail closed on Storage and deferral attestation.',
);
block(
  errors,
  Boolean(packageJson.scripts?.['phase9:live-consent-withdrawal']),
  'package.json is missing phase9:live-consent-withdrawal.',
);
block(
  errors,
  /phase9:live-consent-withdrawal/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'phase9:verify must include phase9:live-consent-withdrawal.',
);
block(
  errors,
  /PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL/.test(liveHarness) &&
    /appEnv === 'staging'/.test(liveHarness) &&
    /resolveHostedSupabaseProjectTarget/.test(liveHarness) &&
    /gitStatusExcludingPaths\(outputPaths\)/.test(liveHarness) &&
    !/gitStatusExcludingGeneratedEvidence/.test(liveHarness) &&
    /sourceTreeClean/.test(liveHarness) &&
    /docs\/phase-9\/generated\/live-consent-withdrawal\.json/.test(liveHarness),
  'Live consent-withdrawal harness must be explicit-flagged, clean-revision staging-only, target-bound, and write evidence artifacts.',
);
block(
  errors,
  /grant_health_data_consent/.test(liveHarness) &&
    /record_health_dependent_consent/.test(liveHarness) &&
    /get_health_dependent_consent_status/.test(liveHarness) &&
    !/from\(['"]consents['"]\)\s*\.insert/.test(liveHarness) &&
    !/insertOne\([^\n]*['"]consents['"]/.test(liveHarness),
  'Live fixtures must use the 0054 base/dependent grant and status RPCs without direct protected consent inserts.',
);
block(
  errors,
  /const request = \{[\s\S]*?consentType,[\s\S]*?version: copy\.version,[\s\S]*?consentTextHash: copy\.hash,[\s\S]*?idempotencyKey: randomToken\(\),[\s\S]*?expectedProcessingEpoch: epoch,[\s\S]*?expectedConsentGeneration: generation,[\s\S]*?\};/.test(
    liveHarness,
  ) && /body: request/.test(liveHarness),
  'Every dependent withdrawal must send the exact six-field 0054 Edge protocol.',
);
block(
  errors,
  /x-health-processing-epoch/.test(liveHarness) &&
    /health-consent-generation=\$\{type\}:\$\{generation\}/.test(liveHarness) &&
    /e\$\{epoch\}\/phase9-consent-/.test(liveHarness) &&
    /response\?\.status === 200/.test(liveHarness) &&
    (liveHarness.match(/withdrawal\.status === 202/g)?.length ?? 0) === 2 &&
    (liveHarness.match(/withdrawal\.status === 200/g)?.length ?? 0) === 4 &&
    /waitForDependentWithdrawal/.test(liveHarness) &&
    /storageObjectMissing/.test(liveHarness) &&
    /replayWithdrawal/.test(liveHarness) &&
    /stableErrorCode\(blockedCommerceWrite\.error\) === '42501'/.test(liveHarness) &&
    /commerce_click_events_deleted === 0/.test(liveHarness) &&
    /order_attributions_detached === 0/.test(liveHarness),
  'Live fixtures must bind epoch/generation headers and prove exact HTTP completion states, scheduled photo cleanup, exact replay, Storage absence, and truthful COM-01A zero cleanup.',
);
block(
  errors,
  REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS.length === 8 &&
    /LIVE_CONSENT_WITHDRAWAL_EVIDENCE_SCHEMA_VERSION/.test(liveHarness) &&
    /schemaRevision/.test(liveHarness) &&
    /harnessRevision/.test(liveHarness) &&
    /evidenceContractRevision/.test(liveHarness) &&
    /checkManifest/.test(liveHarness) &&
    /sourceSha/.test(liveHarness) &&
    /ranAt/.test(liveHarness) &&
    /validateLiveConsentWithdrawalArtifact/.test(liveEvidenceContract) &&
    /LIVE_CONSENT_WITHDRAWAL_EVIDENCE_MAX_AGE_MS/.test(liveEvidenceContract) &&
    /reviewed_host_missing/.test(liveEvidenceContract),
  'Strict live evidence must be schema-, revision-, host-, timestamp-, and exact-check-manifest-bound.',
);
block(
  errors,
  /harnessErrorDetail\(error\)/.test(liveHarness) &&
    !/function resultError|error\.message|response\.text/.test(liveHarness) &&
    /Synthetic cleanup did not attest complete removal/.test(liveHarness),
  'Live evidence must redact provider failures and treat synthetic cleanup failure as blocking.',
);
block(
  errors,
  edgeHealthConsentContract.includes(LIVE_HEALTH_CONSENT_COPY.baseGrant.version) &&
    edgeHealthConsentContract.includes(LIVE_HEALTH_CONSENT_COPY.baseGrant.hash) &&
    healthConsentCopyMigrations.includes(LIVE_HEALTH_CONSENT_COPY.baseGrant.version) &&
    healthConsentCopyMigrations.includes(LIVE_HEALTH_CONSENT_COPY.baseGrant.hash),
  'The live base-grant fixture must match the Edge and database release-copy registries.',
);
for (const [consentType, contract] of Object.entries(LIVE_HEALTH_CONSENT_COPY.dependent)) {
  for (const [action, copy] of Object.entries(contract)) {
    const databaseAction = action === 'withdrawal' ? 'withdraw' : action;
    block(
      errors,
      dependentConsentCopy.includes(copy.version) &&
        dependentConsentCopy.includes(copy.hash) &&
        new RegExp(`'${consentType}'\\s*,\\s*'${databaseAction}'\\s*,\\s*'${copy.version}'`).test(
          healthConsentCopyMigrations,
        ) &&
        healthConsentCopyMigrations.includes(`'${copy.hash}'`) &&
        (action === 'grant' ||
          (granularWithdrawalCore.includes(copy.version) &&
            granularWithdrawalCore.includes(copy.hash))),
      `The live ${consentType} ${action} fixture must match mobile, Edge, and database copy registries.`,
    );
  }
}

for (const [type, policy] of [
  ['photo_cloud_backup', 'photos_cloud_backup_consent_insert'],
  ['photo_trend_insights', 'photo_trend_consent_insert'],
  ['community_participation', 'community_reactions_consent_insert'],
  ['ask_layerwell', 'ask_sessions_consent_insert'],
]) {
  block(
    errors,
    phase9ConsentMigration.includes(`has_current_consent('${type}')`) &&
      phase9ConsentMigration.includes(policy),
    `RLS must enforce current ${type} consent for sensitive writes.`,
  );
}
block(
  errors,
  commerceZeroAdmissionMigration.includes(
    'drop policy if exists "commerce_click_events_consent_insert"',
  ) &&
    /revoke all on table public\.commerce_click_events[\s\S]*grant select, delete on table public\.commerce_click_events\s+to authenticated/.test(
      commerceZeroAdmissionMigration,
    ) &&
    /create trigger commerce_click_events_admission_closed[\s\S]*before insert or update/.test(
      commerceZeroAdmissionMigration,
    ) &&
    /raise exception 'COMMERCE_ADMISSION_CLOSED'[\s\S]*errcode = '55000'/.test(
      commerceZeroAdmissionMigration,
    ),
  'COM-01A must remove consent-authorized publication while preserving installed-base owner reads/deletion and a fail-closed database guard.',
);

warn(
  warnings,
  evidenceFlagEnabled(process.env.PHASE9_CONSENT_WITHDRAWAL_PASS),
  'Missing reviewed live consent-withdrawal signoff flag: PHASE9_CONSENT_WITHDRAWAL_PASS=true.',
);
warn(
  warnings,
  liveArtifactValidation.valid,
  `Hosted live consent-withdrawal artifact is unavailable or invalid (${
    [...(liveArtifactParseFailed ? ['parse'] : []), ...liveArtifactValidation.reasons].join(', ') ||
    'unknown'
  }); a boolean pass flag cannot replace the bound staging artifact.`,
);

printResult('Phase 9 consent withdrawal smoke', errors, warnings);
