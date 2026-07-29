#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  block,
  blockPublicEnvSecrets,
  command,
  envFile,
  envSnapshot,
  evidenceFlagEnabled,
  exists,
  generatedEvidenceOutputPaths,
  has,
  hash,
  normalizeNamedSignoff,
  placeholderEnvValue,
  printResult,
  productionDomain,
  productionSupportEmail,
  productionUrl,
  read,
  requiredPhase9EvidenceKeys,
  strict,
  warn,
} from './lib.mjs';
import { isReleasePlatformRequired, loadLaunchContract } from '../launch/contract.mjs';
import { auditReleaseCandidateGitContract } from './release-candidate-git-contract.mjs';
import { auditVerificationWiring } from './verification-wiring-contract.mjs';
import { PHASE9_CAT07_BOUND_INPUT_PATHS } from './release-qa-integrity.mjs';
import { GOVERNED_POST_F_COMMANDS } from '../launch/governed-publication-coverage.mjs';
import {
  auditPhoto05aTrendAdmission,
  PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS,
} from '../photo05/trend-admission-source-contract.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const exampleEnv = envFile('.env.example');
const launchContract = loadLaunchContract();
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);

for (const error of auditPhoto05aTrendAdmission(process.cwd())) {
  block(errors, false, `PHOTO-05A Trend-admission source contract: ${error}`);
}

const phase7EvidenceKeys = [
  'PHASE7_BRAND_READY',
  'PHASE7_SUPABASE_RLS_PASS',
  'PHASE7_CLINICAL_REVIEW_PASS',
  'PHASE7_CATALOG_BETA_IMPORT_PASS',
  'PHASE7_DEVICE_QA_PASS',
  'PHASE7_REVENUECAT_QA_PASS',
  'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
  'PHASE7_BETA_DASHBOARD_READY',
  'PHASE7_SIGNED_OFF_BY',
];

const liveHarnessFiles = [
  'scripts/phase9/live-supabase-adversarial.mjs',
  'scripts/phase9/live-edge-auth.mjs',
  'scripts/phase9/live-public-forms.mjs',
  'scripts/phase9/live-catalog-rate-limit.mjs',
  'scripts/phase9/live-order-report-poll.mjs',
  'scripts/phase9/live-revenuecat-webhook.mjs',
  'scripts/phase9/live-data-rights.mjs',
  'scripts/phase9/live-consent-withdrawal.mjs',
];

const localVerifierFiles = [
  'scripts/cat05/native-label-ocr-source-contract.test.mjs',
  'scripts/phase5/check-native-ocr-evidence.mjs',
  'scripts/phase5/native-ocr-evidence-contract.mjs',
  'scripts/phase5/native-ocr-evidence-smoke.mjs',
  'scripts/postinstall.mjs',
  'scripts/phase5/patch-expo-widgets-lifecycle.mjs',
  'scripts/phase5/patch-expo-widgets-lifecycle.test.mjs',
  'scripts/phase5/expo-widgets-lifecycle-source.test.mjs',
  'scripts/phase5/expo-widgets-56.0.23/RoutineKindWidgetLifecycleStore.swift',
  'scripts/phase5/expo-widgets-56.0.23/AppIntent.swift',
  'scripts/phase5/expo-widgets-56.0.23/EntryView.swift',
  'scripts/phase5/expo-widgets-56.0.23/ExpoWidgets.podspec',
  'scripts/phase5/expo-widgets-56.0.23/LiveActivity.swift',
  'scripts/phase5/expo-widgets-56.0.23/LiveActivityFactory.swift',
  'scripts/phase5/expo-widgets-56.0.23/TimelineProvider.swift',
  'scripts/phase5/expo-widgets-56.0.23/Utils.swift',
  'scripts/phase5/expo-widgets-56.0.23/WidgetLiveActivity.swift',
  'scripts/phase5/expo-widgets-56.0.23/WidgetObject.swift',
  'scripts/phase5/expo-widgets-56.0.23/WidgetsModule.swift',
  'scripts/phase9/release-contact-smoke.mjs',
  'scripts/phase9/evidence-normalization-smoke.mjs',
  'scripts/phase9/release-smoke.mjs',
  'scripts/phase9/release-qa-integrity.mjs',
  'scripts/phase9/release-qa-integrity.test.mjs',
  'scripts/launch/governed-evidence-chain.mjs',
  'scripts/launch/governed-evidence-chain.test.mjs',
  'scripts/launch/governed-publication-coverage.mjs',
  'scripts/launch/governed-publication-coverage.test.mjs',
  'scripts/phase9/git-status-exclusion.test.mjs',
  'scripts/docs/device-support-policy-audit.test.mjs',
  'scripts/phase9/dependency-sbom-contract.mjs',
  'scripts/phase9/dependency-sbom-contract.test.mjs',
  'scripts/e2e/human-e2e-manifest-contract.test.mjs',
  'scripts/phase7/core-loop-qa-packet-contract.test.mjs',
  'scripts/phase9/build-evidence-chain-ledger.mjs',
  'scripts/phase9/build-evidence-chain-ledger.test.mjs',
  'scripts/phase9/rls-adversarial-smoke.mjs',
  'scripts/phase9/rls-adversarial.mjs',
  'scripts/phase9/edge-auth-smoke.mjs',
  'scripts/phase9/edge-function-manifest-check.mjs',
  'scripts/phase9/edge-function-manifest-lib.mjs',
  'scripts/phase9/edge-function-manifest-smoke.mjs',
  'scripts/phase9/edge-functions-check.mjs',
  'scripts/phase9/data-rights-smoke.mjs',
  'scripts/phase9/account-deletion-lifecycle-postgres-rehearsal.sql',
  'scripts/phase9/account-service-scrub-postgres-rehearsal.sql',
  'scripts/phase9/revenuecat-deletion-barrier-postgres-rehearsal.sql',
  'scripts/phase9/revenuecat-identity-tombstones-postgres-rehearsal.sql',
  'scripts/phase9/account-publication-fence-postgres-rehearsal.sql',
  'scripts/phase9/service-writer-deletion-barriers-postgres-rehearsal.sql',
  'scripts/phase9/entitlement-authority-lanes-postgres-rehearsal.sql',
  'scripts/phase9/catalog-scan-minimization-postgres-rehearsal.sql',
  'scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql',
  'scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql',
  'scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql',
  'scripts/phase9/consent-withdrawal-smoke.mjs',
  'scripts/phase9/consent-withdrawal-evidence.mjs',
  'scripts/phase9/consent-withdrawal-evidence.test.mjs',
  'scripts/phase9/supabase-policy-lint.mjs',
  'scripts/phase9/security-ci-smoke.mjs',
  'scripts/phase9/privacy-payload-audit.mjs',
  'scripts/phase9/dependency-sbom.mjs',
  'scripts/phase9/store-build-inspect.mjs',
  'scripts/phase9/patch-react-native-view-shot-privacy.mjs',
  'scripts/phase9/patch-react-native-view-shot-privacy.test.mjs',
  'scripts/phase9/ios-privacy-contract.mjs',
  'scripts/phase9/ios-privacy-source-audit.mjs',
  'scripts/phase9/ios-privacy-source-audit.test.mjs',
  'scripts/phase9/ios-archive-privacy-evidence.mjs',
  'scripts/phase9/ios-archive-privacy-evidence.test.mjs',
  'scripts/phase9/ios-release-candidate-cross-binding.mjs',
  'scripts/phase9/release-candidate-git-contract.mjs',
  'scripts/phase9/release-candidate-git-contract.test.mjs',
  'scripts/phase9/verification-wiring-contract.mjs',
  'scripts/phase9/verification-wiring-contract.test.mjs',
];

const requiredFiles = [
  'package.json',
  'package-lock.json',
  'apps/mobile/package.json',
  'docs/hugeToDo/launch-contract.json',
  'docs/hugeToDo/PAY-06-ENTITLEMENT-AUTHORITY-LANES-2026-07-14.md',
  'docs/hugeToDo/IOS-02-WIDGET-LIFECYCLE-SOURCE-CHECKPOINT-2026-07-16.md',
  'docs/hugeToDo/IOS-09-IOS-PRIVACY-SOURCE-CHECKPOINT-2026-07-16.md',
  'scripts/launch/contract.mjs',
  'docs/phase-9/source-of-truth.md',
  'docs/phase-9/data-inventory.md',
  'docs/phase-9/edge-function-auth-matrix.md',
  'docs/phase-9/observability-payload-audit.md',
  'docs/phase-9/security-scanner-evidence.md',
  'docs/phase-9/rollout-rollback-plan.md',
  'docs/phase-9/incident-response-plan.md',
  'docs/phase-9/beta-evidence-summary.md',
  'docs/phase-9/dependency-sbom.md',
  'docs/phase-9/apple-ios-privacy-baseline.json',
  'docs/phase-9/ios-sdk-package-mapping.json',
  'docs/phase-9/ios-privacy-baseline-notes.md',
  'docs/phase-9/release-candidates/README.md',
  'docs/phase-9/release-candidates/_template/manifest.md',
  'docs/phase-9/release-candidates/_template/commands.md',
  'docs/phase-9/release-candidates/_template/automated-verification.md',
  'docs/phase-9/release-candidates/_template/manual-qa-matrix.md',
  'docs/phase-9/release-candidates/_template/security-review.md',
  'docs/phase-9/release-candidates/_template/privacy-review.md',
  'docs/phase-9/release-candidates/_template/ios-archive-privacy-evidence.json',
  'docs/phase-9/release-candidates/_template/payments-review.md',
  'docs/phase-9/release-candidates/_template/observability-review.md',
  'docs/phase-9/release-candidates/_template/store-review-packet.md',
  'docs/phase-9/release-candidates/_template/rollout-plan.md',
  'docs/phase-9/release-candidates/_template/incident-plan.md',
  'docs/phase-9/release-candidates/_template/signoff.md',
  '.github/workflows/quality.yml',
  'apps/mobile/plugins/withRoutineKindWidgetPrivacyManifest.js',
  'apps/mobile/src/app/_layout.tsx',
  'apps/mobile/src/features/widgets/actionRegistry.ts',
  'apps/mobile/src/features/widgets/actionRegistry.test.ts',
  'apps/mobile/src/features/widgets/contract.ts',
  'apps/mobile/src/features/widgets/contract.test.ts',
  'apps/mobile/src/features/widgets/controllerCore.ts',
  'apps/mobile/src/features/widgets/controllerCore.test.ts',
  'apps/mobile/src/features/widgets/nativeLifecycle.ts',
  'apps/mobile/src/features/widgets/nativeLifecycle.ios.ts',
  'apps/mobile/src/features/widgets/nativeLifecycleContract.ts',
  'apps/mobile/src/features/widgets/nativeLifecycleContract.test.ts',
  'apps/mobile/src/features/widgets/nativeLifecycleBridge.test.ts',
  'apps/mobile/src/features/widgets/nativeOutboxModel.ts',
  'apps/mobile/src/features/widgets/nativeOutboxModel.test.ts',
  'apps/mobile/src/features/widgets/ownerAuthority.ts',
  'apps/mobile/src/features/widgets/ownerAuthority.test.ts',
  'apps/mobile/src/features/widgets/lifecycleCoordinator.ts',
  'apps/mobile/src/features/widgets/lifecycleCoordinator.test.ts',
  'apps/mobile/src/features/widgets/lifecycleRuntime.ts',
  'apps/mobile/src/features/widgets/lifecycleRuntime.ios.ts',
  'apps/mobile/src/features/widgets/lifecycleRuntime.test.ts',
  'apps/mobile/src/features/widgets/RoutineWidgetLifecycleHost.tsx',
  'apps/mobile/src/features/widgets/RoutineWidgetLifecycleHost.test.ts',
  'apps/mobile/src/features/widgets/runtimeGate.ts',
  'apps/mobile/src/features/widgets/runtimeGate.test.ts',
  'apps/mobile/src/features/widgets/TodayWidget.ios.tsx',
  'apps/mobile/src/features/widgets/TonightActivity.ios.tsx',
  'apps/mobile/src/features/widgets/widgetViews.test.ts',
  'apps/mobile/src/features/healthConsent/HealthDataActivationMount.tsx',
  'apps/mobile/src/features/healthConsent/HealthDataActivationMount.test.ts',
  'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx',
  'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.navigation.test.ts',
  'apps/mobile/src/features/healthConsent/healthLifecycleRoutes.test.ts',
  'apps/mobile/src/features/healthConsent/selectiveCleanup.ts',
  'apps/mobile/src/features/healthConsent/selectiveCleanup.test.ts',
  'apps/mobile/src/lib/auth/AuthProvider.tsx',
  'apps/mobile/src/lib/auth/authDerivedCleanupAuthProviderContracts.test.ts',
  'apps/mobile/src/lib/auth/revokedCredentialActivity.ts',
  'apps/mobile/src/lib/auth/revokedCredentialActivity.test.ts',
  'apps/mobile/src/features/settings/AccountDeletionRecoveryGate.tsx',
  'apps/mobile/src/features/settings/accountDeletionClientState.ts',
  'apps/mobile/src/features/settings/accountDeletionClientState.test.ts',
  'apps/mobile/src/features/settings/accountDeletionRecovery.ts',
  'apps/mobile/src/features/settings/accountDeletionRecovery.test.ts',
  'apps/mobile/src/features/settings/accountDeletionRecoveryGate.test.ts',
  'apps/mobile/src/features/settings/actions.ts',
  'apps/mobile/src/features/settings/actions.test.ts',
  'apps/mobile/src/features/settings/localPrivateData.ts',
  'apps/mobile/src/features/settings/localPrivateData.test.ts',
  'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
  'apps/mobile/src/features/settings/localPrivateDataKeys.test.ts',
  'supabase/config.toml',
  'supabase/functions/manifest.json',
  'supabase/functions/account-deletion/appleDeletionExecutor.test.ts',
  'supabase/functions/account-deletion/appleDeletionExecutor.ts',
  'supabase/functions/account-deletion/appleDeletionNetwork.test.ts',
  'supabase/functions/account-deletion/appleDeletionNetwork.ts',
  'supabase/functions/account-deletion/authDeletionExecutor.test.ts',
  'supabase/functions/account-deletion/authDeletionExecutor.ts',
  'supabase/functions/account-deletion/deletionProviderNetwork.test.ts',
  'supabase/functions/account-deletion/deletionProviderNetwork.ts',
  'supabase/functions/account-deletion/durableDeletionCore.test.ts',
  'supabase/functions/account-deletion/durableDeletionCore.ts',
  'supabase/functions/account-deletion/durableDeletionCrypto.test.ts',
  'supabase/functions/account-deletion/durableDeletionCrypto.ts',
  'supabase/functions/account-deletion/durableDeletionDatabaseGateway.test.ts',
  'supabase/functions/account-deletion/durableDeletionDatabaseGateway.ts',
  'supabase/functions/account-deletion/durableDeletionEncryptedStateStore.test.ts',
  'supabase/functions/account-deletion/durableDeletionEncryptedStateStore.ts',
  'supabase/functions/account-deletion/durableDeletionHttpHandler.test.ts',
  'supabase/functions/account-deletion/durableDeletionHttpHandler.ts',
  'supabase/functions/account-deletion/durableDeletionPayloads.test.ts',
  'supabase/functions/account-deletion/durableDeletionPayloads.ts',
  'supabase/functions/account-deletion/durableDeletionRuntime.test.ts',
  'supabase/functions/account-deletion/durableDeletionRuntime.ts',
  'supabase/functions/account-deletion/durableDeletionRuntimeCore.test.ts',
  'supabase/functions/account-deletion/durableDeletionRuntimeCore.ts',
  'supabase/functions/account-deletion/durableDeletionWorker.test.ts',
  'supabase/functions/account-deletion/durableDeletionWorker.ts',
  'supabase/functions/account-deletion/durableProviderDeletion.test.ts',
  'supabase/functions/account-deletion/durableProviderDeletion.ts',
  'supabase/functions/account-deletion/index.ts',
  'supabase/functions/account-deletion/localDeletionExecutors.test.ts',
  'supabase/functions/account-deletion/photoStorageCleanup.test.ts',
  'supabase/functions/account-deletion/photoStorageCleanup.ts',
  'supabase/functions/account-deletion/photoStorageDeletionExecutor.ts',
  'supabase/functions/account-deletion/postHogDeletionExecutor.test.ts',
  'supabase/functions/account-deletion/postHogDeletionExecutor.ts',
  'supabase/functions/account-deletion/providerDeletion.test.ts',
  'supabase/functions/account-deletion/providerDeletion.ts',
  'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.test.ts',
  'supabase/functions/account-deletion/revenueCatV2DeletionExecutor.ts',
  'supabase/functions/account-deletion/serviceRoleCleanup.test.ts',
  'supabase/functions/account-deletion/serviceRoleCleanup.ts',
  'supabase/functions/account-deletion/serviceRowsDeletionExecutor.ts',
  'supabase/functions/order-report-poll/index.ts',
  'supabase/functions/order-report-poll/orderAttributionCore.ts',
  'supabase/functions/order-report-poll/orderAttributionCore.test.ts',
  'supabase/functions/_shared/storagePath.ts',
  'supabase/functions/_shared/storagePath.test.ts',
  'supabase/functions/_shared/rateLimitOwnership.test.ts',
  'supabase/functions/_shared/revenueCatIdentityTombstone.ts',
  'supabase/functions/_shared/revenueCatIdentityTombstone.test.ts',
  'supabase/functions/data-export/index.ts',
  'supabase/functions/data-export/exportCore.ts',
  'supabase/functions/data-export/exportCore.test.ts',
  'supabase/functions/data-export/catalogCorrectionExportCore.ts',
  'supabase/functions/data-export/catalogCorrectionExportCore.test.ts',
  'supabase/functions/data-export/exportRegistry.ts',
  'supabase/functions/data-export/exportRegistry.test.ts',
  'supabase/functions/consent-withdrawal/index.ts',
  'supabase/functions/catalog-report/deletionBarrier.test.ts',
  'supabase/functions/revenuecat-webhook/webhookCore.ts',
  'supabase/functions/revenuecat-webhook/webhookCore.test.ts',
  'supabase/functions/subscription-grants/deletionBarrierContract.test.ts',
  'supabase/functions/subscription-grants/grantErrors.ts',
  'supabase/functions/subscription-grants/grantErrors.test.ts',
  'supabase/functions/subscription-reconciliation/index.ts',
  'supabase/functions/subscription-reconciliation/publicationLease.ts',
  'supabase/functions/subscription-reconciliation/publicationLease.test.ts',
  'supabase/functions/subscription-reconciliation/reconciliationCore.ts',
  'supabase/functions/subscription-reconciliation/reconciliationCore.test.ts',
  'supabase/functions/subscription-reconciliation/reconciliationContract.test.ts',
  'supabase/functions/_shared/verifiedAuthSessionClaims.ts',
  'supabase/functions/catalog-lookup/catalogContract.ts',
  'supabase/functions/catalog-lookup/catalogContract.test.ts',
  'supabase/functions/catalog-search/catalogContract.ts',
  'supabase/functions/catalog-search/catalogContract.test.ts',
  'supabase/migrations/20260705000034_phase9_security_definer_hardening.sql',
  'supabase/migrations/20260711000038_shelf_freshness_invariants.sql',
  'supabase/migrations/20260711000039_replenishment_alert_opt_in.sql',
  'supabase/migrations/20260718000060_cat07_truthful_freshness.sql',
  'supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql',
  'supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
  'scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql',
  'scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql',
  'supabase/tests/database/catalog_import_lifecycle.test.sql',
  'supabase/tests/database/catalog_launch_curation.test.sql',
  'supabase/tests/database/catalog_serving_gate.test.sql',
  'supabase/tests/database/cat07_truthful_freshness.test.sql',
  'supabase/migrations/20260615000027_phase6_payments.sql',
  'supabase/migrations/20260713000045_anonymous_photo_storage_guard.sql',
  'supabase/migrations/20260713000046_account_service_row_scrub.sql',
  'supabase/migrations/20260713000047_account_obf_contribution_erasure.sql',
  'supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql',
  'supabase/migrations/20260713000049_revenuecat_deletion_barrier_guard.sql',
  'supabase/migrations/20260713000050_service_writer_deletion_barriers.sql',
  'supabase/migrations/20260713000051_revenuecat_identity_tombstones.sql',
  'supabase/migrations/20260713000052_account_publication_fence.sql',
  'supabase/migrations/20260714000053_entitlement_authority_lanes.sql',
  'scripts/phase9/lib.mjs',
  'scripts/phase2/supabase-rls-smoke.mjs',
  'scripts/phase9/build-release-qa-packet.mjs',
  ...PHASE9_CAT07_BOUND_INPUT_PATHS,
  ...localVerifierFiles,
  ...liveHarnessFiles,
  'apps/mobile/src/lib/observability/scrub.ts',
  'apps/mobile/src/lib/analytics/eventRegistry.ts',
  'apps/mobile/src/lib/env.ts',
  'apps/mobile/src/lib/env.test.ts',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
  'apps/mobile/src/features/photos/encryptedStorage.ts',
  'apps/mobile/src/features/photos/encryptedStorage.test.ts',
  'apps/mobile/src/features/photos/store.ts',
  'apps/mobile/src/features/photos/store.test.ts',
  'apps/mobile/src/lib/supabase/largeSecureStore.ts',
  'apps/mobile/src/lib/supabase/largeSecureStore.test.ts',
  'apps/mobile/src/lib/applock/singleFlight.ts',
  'apps/mobile/src/lib/applock/singleFlight.test.ts',
  'apps/mobile/src/lib/auth/accountGeneration.ts',
  'apps/mobile/src/lib/auth/accountGeneration.test.ts',
  'apps/mobile/src/lib/auth/localAccountIsolation.ts',
  'apps/mobile/src/lib/auth/localAccountIsolation.test.ts',
  'apps/mobile/src/app/community/ask.tsx',
  'apps/mobile/src/app/community/people-like-you.tsx',
  'apps/mobile/src/app/trend/optin.tsx',
  'apps/mobile/src/app/routine/widgets.tsx',
  'apps/mobile/src/app/routine/_layout.tsx',
  'apps/mobile/src/features/subscription/gatedRoutes.ts',
  'apps/mobile/src/features/subscription/copy.ts',
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
];
for (const path of PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS) {
  if (!requiredFiles.includes(path)) requiredFiles.push(path);
}

for (const file of requiredFiles) block(errors, exists(file), `${file} is missing.`);

for (const key of [
  'APP_IOS_BUNDLE_IDENTIFIER',
  'APPLE_SIWA_CLIENT_ID',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'POSTHOG_PERSONAL_API_KEY',
  'POSTHOG_PROJECT_ID',
  'POSTHOG_API_HOST',
  'TURNSTILE_SECRET_KEY',
  'PUBLIC_FORMS_TURNSTILE_REQUIRED',
  'PUBLIC_FORMS_RATE_LIMIT_MAX',
  'PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS',
  'PUBLIC_FORMS_MAX_BYTES',
  'PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX',
  'CATALOG_RATE_LIMIT_MAX',
  'CATALOG_RATE_LIMIT_WINDOW_SECONDS',
  'USER_EDGE_BODY_MAX_BYTES',
  'EDGE_EXTERNAL_FETCH_TIMEOUT_MS',
  'EDGE_EXTERNAL_RESPONSE_MAX_BYTES',
  'DATA_EXPORT_RATE_LIMIT_MAX',
  'DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS',
  'DATA_EXPORT_PHOTO_URL_TTL_SECONDS',
  'PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX',
  'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK',
  'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS',
  'PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX',
  'SHOPMY_BRAND_API_KEY',
  'SHOPMY_BRAND_DOMAIN',
  'ORDER_REPORT_POLL_SECRET',
  'ACCOUNT_DELETION_PAYLOAD_KEY_HEX',
  'ACCOUNT_DELETION_RECEIPT_HMAC_KEY_HEX',
  'ACCOUNT_DELETION_RECEIPT_HMAC_KEY_VERSION',
  'ACCOUNT_DELETION_WORKER_SECRET',
  'HEALTH_CONSENT_WORKER_SECRET',
  'REVENUECAT_PROJECT_ID',
  'REVENUECAT_SECRET_API_KEY',
  'REVENUECAT_V2_SECRET_API_KEY',
  'REVENUECAT_IDENTITY_TOMBSTONE_HMAC_CURRENT_VERSION',
  'REVENUECAT_IDENTITY_TOMBSTONE_HMAC_KEYS',
  'REVENUECAT_WEBHOOK_MAX_BYTES',
  'POSTHOG_CAPTURE_SHUTDOWN_AT',
  'POSTHOG_ABSENCE_INTERVAL_SECONDS',
  'POSTHOG_NO_RECORDINGS_EVIDENCE',
  'POSTHOG_NO_RECORDINGS_VERIFIED_AT',
  'PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL',
  'PHASE9_ANONYMOUS_CAPTCHA_TOKEN',
  'PHASE9_ALLOW_PRODUCTION_LIVE_SUPABASE_ADVERSARIAL',
  'PHASE9_RUN_LIVE_EDGE_AUTH',
  'PHASE9_EXPECTED_SUPABASE_PROJECT_REF',
  'PHASE9_RUN_LIVE_PUBLIC_FORMS',
  'PHASE9_ALLOW_PRODUCTION_LIVE_PUBLIC_FORMS',
  'PHASE9_RUN_LIVE_CATALOG_RATE_LIMIT',
  'PHASE9_ALLOW_PRODUCTION_LIVE_CATALOG_RATE_LIMIT',
  'PHASE9_RUN_LIVE_ORDER_REPORT_POLL',
  'PHASE9_ALLOW_PRODUCTION_LIVE_ORDER_REPORT_POLL',
  'PHASE9_ORDER_REPORT_POLL_ACTIVATED_EXPECTED',
  'PHASE9_RUN_LIVE_REVENUECAT_WEBHOOK',
  'PHASE9_ALLOW_PRODUCTION_LIVE_REVENUECAT_WEBHOOK',
  'PHASE9_RUN_LIVE_DATA_RIGHTS',
  'PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL',
  'PHASE9_CONSENT_WITHDRAWAL_WORKER_POLL_TIMEOUT_SECONDS',
  'PHASE9_CONSENT_WITHDRAWAL_WORKER_POLL_INTERVAL_SECONDS',
  'PHASE9_RELEASE_CANDIDATE_DIR',
  ...phase7EvidenceKeys,
  ...requiredPhase9EvidenceKeys(),
  'PHASE9_SIGNED_OFF_BY',
]) {
  block(
    errors,
    Object.prototype.hasOwnProperty.call(exampleEnv, key),
    `.env.example is missing ${key}.`,
  );
}

const packageJson = JSON.parse(read('package.json'));
const mobilePackageJson = JSON.parse(read('apps/mobile/package.json'));
const qualityWorkflowText = read('.github/workflows/quality.yml');
const phase7VerifyCommands = (packageJson.scripts?.['phase7:verify'] ?? '').split(' && ');
const phase9VerifyCommands = new Set((packageJson.scripts?.['phase9:verify'] ?? '').split(' && '));
const launchVerifyCommands = new Set((packageJson.scripts?.['launch:verify'] ?? '').split(' && '));
const edgeFunctionManifest = JSON.parse(read('supabase/functions/manifest.json'));
const integerInRange = (value, min, max) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
};
const validServerHostname = (value) =>
  typeof value === 'string' &&
  value.length <= 253 &&
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/i.test(
    value.trim(),
  );
const POSTHOG_MOBILE_INGEST_HOST = 'https://eu.i.posthog.com';
const POSTHOG_SERVER_API_HOST = 'https://eu.posthog.com';

block(
  errors,
  exampleEnv.EXPO_PUBLIC_POSTHOG_HOST === POSTHOG_MOBILE_INGEST_HOST &&
    exampleEnv.POSTHOG_API_HOST === POSTHOG_SERVER_API_HOST,
  'The checked-in PostHog mobile ingest and server API hosts must use the paired EU endpoints.',
);
block(
  errors,
  has(
    'apps/mobile/src/lib/env.ts',
    /posthogHost:\s*process\.env\.EXPO_PUBLIC_POSTHOG_HOST\s*\?\?\s*['"]https:\/\/eu\.i\.posthog\.com['"]/,
  ) &&
    has(
      'supabase/functions/account-deletion/durableDeletionRuntime.ts',
      /host:\s*envString\(readEnvironment,\s*['"]POSTHOG_API_HOST['"]\)/,
    ),
  'Mobile default and account-deletion explicit configuration must preserve the paired EU PostHog hosts.',
);

const appleSiwaClientId = env.APPLE_SIWA_CLIENT_ID;
const iosBundleIdentifier = env.APP_IOS_BUNDLE_IDENTIFIER;
block(
  errors,
  !placeholderEnvValue(appleSiwaClientId),
  'APPLE_SIWA_CLIENT_ID must be explicitly configured for Apple credential revocation.',
);
if (!placeholderEnvValue(appleSiwaClientId) && !placeholderEnvValue(iosBundleIdentifier)) {
  block(
    errors,
    appleSiwaClientId.trim() === iosBundleIdentifier.trim(),
    'APPLE_SIWA_CLIENT_ID must exactly match APP_IOS_BUNDLE_IDENTIFIER.',
  );
}

if (!placeholderEnvValue(env.EXPO_PUBLIC_POSTHOG_KEY)) {
  block(
    errors,
    !placeholderEnvValue(env.POSTHOG_PROJECT_ID),
    'POSTHOG_PROJECT_ID is required when EXPO_PUBLIC_POSTHOG_KEY enables PostHog.',
  );
  block(
    errors,
    !placeholderEnvValue(env.POSTHOG_PERSONAL_API_KEY),
    'POSTHOG_PERSONAL_API_KEY is required when EXPO_PUBLIC_POSTHOG_KEY enables PostHog.',
  );
  block(
    errors,
    env.EXPO_PUBLIC_POSTHOG_HOST?.trim() === POSTHOG_MOBILE_INGEST_HOST,
    `EXPO_PUBLIC_POSTHOG_HOST must equal ${POSTHOG_MOBILE_INGEST_HOST} when PostHog is enabled.`,
  );
  block(
    errors,
    env.POSTHOG_API_HOST?.trim() === POSTHOG_SERVER_API_HOST,
    `POSTHOG_API_HOST must equal ${POSTHOG_SERVER_API_HOST} when PostHog is enabled.`,
  );
}

const accountDeletionManifest = edgeFunctionManifest.functions?.['account-deletion'];
block(
  errors,
  accountDeletionManifest?.conditionalEnvironment?.some(
    (condition) =>
      /Sign in with Apple identity/.test(condition.when) &&
      condition.anyOf?.length === 1 &&
      condition.anyOf[0] === 'APPLE_SIWA_CLIENT_ID',
  ) &&
    accountDeletionManifest?.conditionalEnvironment?.some(
      (condition) =>
        /Sign in with Apple identity/.test(condition.when) &&
        condition.anyOf?.length === 1 &&
        condition.anyOf[0] === 'APP_IOS_BUNDLE_IDENTIFIER',
    ),
  'Account deletion must separately attest APPLE_SIWA_CLIENT_ID and APP_IOS_BUNDLE_IDENTIFIER instead of using client-ID fallbacks.',
);

for (const script of [
  'postinstall:check',
  'phase5:expo-widgets-lifecycle:patch',
  'phase5:expo-widgets-lifecycle:check',
  'phase5:expo-widgets-lifecycle:test',
  'phase9:release-smoke',
  'phase9:release-qa-integrity:test',
  'phase9:governed-evidence-chain:test',
  'phase9:governed-publication-coverage:test',
  'phase9:git-status-exclusion:test',
  'phase9:dependency-sbom:test',
  'phase9:rls-adversarial-smoke',
  'phase9:rls-adversarial',
  'phase9:supabase-policy-lint',
  'phase9:live-supabase-adversarial',
  'phase9:edge-auth-smoke',
  'phase9:edge-functions-check',
  'phase9:live-edge-auth',
  'phase9:live-public-forms',
  'phase9:live-catalog-rate-limit',
  'phase9:live-order-report-poll',
  'phase9:live-revenuecat-webhook',
  'phase9:security-ci-smoke',
  'phase9:data-rights-smoke',
  'phase9:data-export-contract-smoke',
  'phase9:storage-path-privacy-smoke',
  'phase9:account-deletion-photo-storage-smoke',
  'phase9:account-provider-deletion-smoke',
  'phase9:account-service-scrub-smoke',
  'phase9:account-deletion-durable-smoke',
  'phase9:order-attribution-integrity-smoke',
  'phase9:revenuecat-webhook-atomic-smoke',
  'phase9:live-data-rights',
  'phase9:consent-withdrawal',
  'phase9:live-consent-withdrawal',
  'phase9:privacy-payload-audit',
  'phase9:view-shot-privacy:patch',
  'phase9:view-shot-privacy:check',
  'phase9:view-shot-privacy:test',
  'phase9:ios-privacy-source-audit',
  'phase9:ios-privacy-source-audit:check',
  'phase9:ios-privacy-source-audit:test',
  'phase9:ios-archive-privacy-evidence:test',
  'phase9:release-candidate-git-contract:test',
  'phase9:verification-wiring:test',
  'phase9:store-build-inspect',
  'phase9:store-build-inspect:write:strict',
  'phase9:store-build-inspect:check',
  'phase9:store-build-inspect:strict',
  'phase9:dependency-sbom',
  'phase9:qa-packet',
  'phase9:qa-packet:check',
  'phase9:verify',
  'phase4:beta-coverage-report:check',
  'phase4:beta-coverage-contract:test',
  'phase5:qa-packet:check',
  'phase7:qa-packet:check',
  'phase7:qa-packet:contract:test',
  'release:governed-packets:check',
  'docs:readiness-status-audit:test',
  'docs:readiness-status-audit:check',
  'docs:generated-packet-status-audit:check',
  'docs:generated-packet-status-audit:strict',
  'e2e:human:manifest:contract:test',
  'e2e:human:manifest:check',
  'docs:device-support-policy-audit:test',
]) {
  block(errors, Boolean(packageJson.scripts?.[script]), `package.json is missing ${script}.`);
}
const iosPrivacyVerifierDefinitions = {
  'postinstall:check': 'node scripts/postinstall.mjs --check',
  'phase5:expo-widgets-lifecycle:test':
    'node --test scripts/phase5/patch-expo-widgets-lifecycle.test.mjs scripts/phase5/expo-widgets-lifecycle-source.test.mjs',
  'phase9:view-shot-privacy:test':
    'node --test scripts/phase9/patch-react-native-view-shot-privacy.test.mjs',
  'phase9:ios-privacy-source-audit:test':
    'node --test scripts/phase9/ios-privacy-source-audit.test.mjs',
  'phase9:ios-privacy-source-audit:check':
    'node scripts/phase9/ios-privacy-source-audit.mjs --check --strict',
  'phase9:ios-archive-privacy-evidence:test':
    'node --test scripts/phase9/ios-archive-privacy-evidence.test.mjs',
  'phase9:release-candidate-git-contract:test':
    'node --test scripts/phase9/release-candidate-git-contract.test.mjs',
  'phase9:verification-wiring:test':
    'node --test scripts/phase9/verification-wiring-contract.test.mjs',
  'phase9:store-build-inspect:check': 'node scripts/phase9/store-build-inspect.mjs --check',
};
const releaseProvenanceVerifierDefinitions = {
  'phase9:release-qa-integrity:test': 'node --test scripts/phase9/release-qa-integrity.test.mjs',
  'phase9:governed-evidence-chain:test':
    'node --test scripts/launch/governed-evidence-chain.test.mjs scripts/phase9/build-evidence-chain-ledger.test.mjs',
  'phase9:governed-publication-coverage:test':
    'node --test scripts/launch/governed-publication-coverage.test.mjs',
  'phase9:git-status-exclusion:test': 'node --test scripts/phase9/git-status-exclusion.test.mjs',
  'phase9:dependency-sbom:test': 'node --test scripts/phase9/dependency-sbom-contract.test.mjs',
  'e2e:human:manifest:contract:test':
    'node --test scripts/e2e/human-e2e-manifest-contract.test.mjs',
  'phase7:qa-packet:contract:test':
    'node --test scripts/phase7/core-loop-qa-packet-contract.test.mjs',
};
block(
  errors,
  packageJson.scripts?.['phase9:store-build-inspect:write:strict'] ===
    'node scripts/phase9/store-build-inspect.mjs --strict',
  'Store inspection must expose a distinct strict writer for governed publication.',
);
block(
  errors,
  packageJson.scripts?.['phase9:store-build-inspect:strict'] ===
    'node scripts/phase9/store-build-inspect.mjs --check --strict',
  'Strict iOS archive/store inspection must be check-only so it cannot dirty the immutable RC.',
);
block(
  errors,
  packageJson.scripts?.postinstall === 'node scripts/postinstall.mjs',
  'Root postinstall must run the exact reviewed composite native-source patch installer.',
);
block(
  errors,
  mobilePackageJson.scripts?.['eas-build-post-install'] ===
    'npm --prefix ../.. run postinstall:check',
  'The EAS post-install hook must fail closed on every reviewed patched native source.',
);
const iosPrivacyWiring = auditVerificationWiring({
  packageJson,
  workflowText: qualityWorkflowText,
  verifierDefinitions: iosPrivacyVerifierDefinitions,
});
for (const error of iosPrivacyWiring.errors) {
  block(errors, false, `iOS privacy verification wiring is invalid: ${error}`);
}
const releaseProvenanceWiring = auditVerificationWiring({
  packageJson,
  workflowText: qualityWorkflowText,
  verifierDefinitions: releaseProvenanceVerifierDefinitions,
  workflowStep: 'Verify governed release provenance',
});
for (const error of releaseProvenanceWiring.errors) {
  block(errors, false, `Governed release provenance verification wiring is invalid: ${error}`);
}
block(
  errors,
  /\n  supabase-local-reset:\n[\s\S]*?\n    timeout-minutes:\s*120\n[\s\S]*?\n    steps:/.test(
    qualityWorkflowText,
  ),
  'The credential-free Supabase reset and full pgTAP lane must retain its reviewed 120-minute CI timeout.',
);
for (const output of [
  'docs/phase-9/generated/ios-privacy-source-audit.json',
  'docs/phase-9/generated/ios-privacy-source-audit.md',
]) {
  block(
    errors,
    generatedEvidenceOutputPaths.includes(output),
    `Generated evidence exclusions must include ${output}.`,
  );
}
block(
  errors,
  /phase9:rls-adversarial-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:rls-adversarial/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'phase9:verify must run the credential-free RLS contract and static adversarial gates.',
);
block(
  errors,
  /phase9:rls-adversarial-smoke/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    /phase9:rls-adversarial/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    /phase9:supabase-policy-lint/.test(packageJson.scripts?.['launch:verify'] ?? ''),
  'launch:verify must run the RLS contract, static adversarial, and Supabase policy gates.',
);
block(
  errors,
  /phase9:consent-withdrawal/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    /consent-withdrawal-evidence\.test\.mjs/.test(
      packageJson.scripts?.['phase9:consent-withdrawal'] ?? '',
    ) &&
    /consent-withdrawal-smoke\.mjs/.test(packageJson.scripts?.['phase9:consent-withdrawal'] ?? ''),
  'launch:verify must run the health-consent source gate, including the bound-artifact validator meta-tests and release smoke.',
);
block(
  errors,
  /phase9:data-export-contract-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:data-export-contract-smoke/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    has('.github/workflows/quality.yml', /npm run phase9:data-export-contract-smoke/),
  'Phase 9, launch, and CI verification must run the canonical data-export contract.',
);
block(
  errors,
  /phase9:storage-path-privacy-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'phase9:verify must run the storage-path privacy contract.',
);
block(
  errors,
  /phase9:account-deletion-photo-storage-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'phase9:verify must run the account-deletion photo-storage contract.',
);
block(
  errors,
  /phase9:account-provider-deletion-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:account-provider-deletion-smoke/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    has('.github/workflows/quality.yml', /npm run phase9:account-provider-deletion-smoke/),
  'Phase 9, launch, and CI verification must run the account provider-deletion contract.',
);
block(
  errors,
  /phase9:account-service-scrub-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:account-service-scrub-smoke/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    has('.github/workflows/quality.yml', /npm run phase9:account-service-scrub-smoke/),
  'Phase 9, launch, and CI verification must run the account service-row scrub contract.',
);
block(
  errors,
  /phase9:account-deletion-durable-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:account-deletion-durable-smoke/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    has('.github/workflows/quality.yml', /npm run phase9:account-deletion-durable-smoke/),
  'Phase 9, launch, and CI verification must run the complete durable account-deletion contract.',
);
block(
  errors,
  /phase9:account-deletion-work-lane-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:account-deletion-work-lane-smoke/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    has('.github/workflows/quality.yml', /npm run phase9:account-deletion-work-lane-smoke/),
  'Phase 9, launch, and CI verification must run the durable account-deletion work-lane contract.',
);
block(
  errors,
  /phase9:apple-auth-work-lane-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:apple-auth-work-lane-smoke/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    has('.github/workflows/quality.yml', /npm run phase9:apple-auth-work-lane-smoke/),
  'Phase 9, launch, and CI verification must run the durable Apple-auth work-lane contract.',
);
block(
  errors,
  has('.github/workflows/quality.yml', /postgres:\s*\n\s*- 15-alpine\s*\n\s*- 17-alpine/) &&
    has(
      '.github/workflows/quality.yml',
      /database:\s*account_deletion_0048[\s\S]{0,120}script:\s*account-deletion-lifecycle-postgres-rehearsal\.sql/,
    ) &&
    has(
      '.github/workflows/quality.yml',
      /database:\s*revenuecat_barrier_0049[\s\S]{0,120}script:\s*revenuecat-deletion-barrier-postgres-rehearsal\.sql/,
    ) &&
    has(
      '.github/workflows/quality.yml',
      /database:\s*service_writers_0050[\s\S]{0,120}script:\s*service-writer-deletion-barriers-postgres-rehearsal\.sql/,
    ) &&
    has(
      '.github/workflows/quality.yml',
      /database:\s*revenuecat_tombstones_0051[\s\S]{0,120}script:\s*revenuecat-identity-tombstones-postgres-rehearsal\.sql/,
    ) &&
    has(
      '.github/workflows/quality.yml',
      /database:\s*account_publication_fence_0052[\s\S]{0,120}script:\s*account-publication-fence-postgres-rehearsal\.sql/,
    ) &&
    has(
      '.github/workflows/quality.yml',
      /database:\s*entitlement_lanes_0053[\s\S]{0,120}script:\s*entitlement-authority-lanes-postgres-rehearsal\.sql/,
    ) &&
    has(
      '.github/workflows/quality.yml',
      /database:\s*catalog_scan_minimization_0059[\s\S]{0,140}script:\s*catalog-scan-minimization-postgres-rehearsal\.sql/,
    ) &&
    has(
      '.github/workflows/quality.yml',
      /database:\s*cat07_truthful_freshness_0060[\s\S]{0,140}script:\s*cat07-truthful-freshness-postgres-rehearsal\.sql/,
    ) &&
    has(
      '.github/workflows/quality.yml',
      /database:\s*catalog_import_upgrade_0061[\s\S]{0,140}script:\s*catalog-import-0061-upgrade-postgres-rehearsal\.sql/,
      /database:\s*catalog_curation_upgrade_0062[\s\S]{0,140}script:\s*catalog-curation-0062-upgrade-postgres-rehearsal\.sql/,
    ) &&
    has('.github/workflows/quality.yml', /image:\s*postgres:\$\{\{ matrix\.postgres \}\}/) &&
    has(
      '.github/workflows/quality.yml',
      /-f \"scripts\/phase9\/\$\{\{ matrix\.rehearsal\.script \}\}\"/,
    ),
  'CI must execute the 0048-0053 lifecycle lanes plus the 0059, 0060, 0061, and 0062 catalog rehearsals in isolated PostgreSQL 15 and 17 databases.',
);
block(
  errors,
  has(
    '.github/workflows/quality.yml',
    /services:\s*[\s\S]*?image:\s*postgres:15-alpine[\s\S]*?psql -h 127\.0\.0\.1 -U postgres -v ON_ERROR_STOP=1\s+-f scripts\/phase9\/account-service-scrub-postgres-rehearsal\.sql/,
  ),
  'CI must execute the account service-row scrub migration rehearsal on PostgreSQL 15.',
);
block(
  errors,
  /phase9:order-attribution-integrity-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? '') &&
    /phase9:order-attribution-integrity-smoke/.test(packageJson.scripts?.['launch:verify'] ?? '') &&
    has('.github/workflows/quality.yml', /npm run phase9:order-attribution-integrity-smoke/),
  'Phase 9, launch, and CI verification must run the order-attribution integrity contract.',
);
block(
  errors,
  /phase9:revenuecat-webhook-atomic-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'phase9:verify must run the RevenueCat atomic webhook contract.',
);
block(
  errors,
  /reconciliationCore\.test\.ts/.test(
    packageJson.scripts?.['phase6:subscription-reconciliation-smoke'] ?? '',
  ) &&
    /reconciliationContract\.test\.ts/.test(
      packageJson.scripts?.['phase6:subscription-reconciliation-smoke'] ?? '',
    ) &&
    /publicationLease\.test\.ts/.test(
      packageJson.scripts?.['phase6:subscription-reconciliation-smoke'] ?? '',
    ) &&
    /phase6:subscription-reconciliation-smoke/.test(packageJson.scripts?.['phase9:verify'] ?? ''),
  'Phase 6 and Phase 9 must run the bounded RevenueCat CustomerInfo and publication-lease contracts.',
);
const forbiddenPreSnapshotPhase9Commands = [
  'npm run e2e:human:manifest:check',
  'npm run phase9:qa-packet',
  'npm run phase9:qa-packet:check',
  'npm run docs:generated-packet-status-audit:check',
  'npm run docs:generated-packet-status-audit:strict',
];
const forbiddenPreSnapshotLaunchCommands = [
  'npm run e2e:human:manifest:check',
  'npm run docs:readiness-status-audit:check',
  'npm run docs:device-support-policy-audit:check',
  'npm run docs:generated-packet-status-audit:check',
  'npm run docs:generated-packet-status-audit:strict',
  'npm run phase5:native-ocr-evidence',
  'npm run phase5:camera-lifecycle-evidence',
  'npm run phase5:performance-evidence',
  'npm run phase5:widget-lifecycle-evidence',
];
block(
  errors,
  forbiddenPreSnapshotPhase9Commands.every(
    (commandName) => !phase9VerifyCommands.has(commandName),
  ) &&
    forbiddenPreSnapshotLaunchCommands.every(
      (commandName) => !launchVerifyCommands.has(commandName),
    ),
  'Pre-S phase9:verify and launch:verify must not depend on post-E/F committed-packet checks or packet publication.',
);
block(
  errors,
  phase7VerifyCommands.filter(
    (commandName) => commandName === 'npm run phase7:qa-packet:contract:test',
  ).length === 1 &&
    phase7VerifyCommands.indexOf('npm run phase7:qa-packet:contract:test') <
      phase7VerifyCommands.indexOf('npm run phase7:qa-packet'),
  'phase7:verify must run the packet-builder contract exactly once before publishing the Phase 7 packet.',
);
block(
  errors,
  phase9VerifyCommands.has('npm run phase9:release-qa-integrity:test') &&
    launchVerifyCommands.has('npm run phase9:release-qa-integrity:test') &&
    phase9VerifyCommands.has('npm run phase9:governed-publication-coverage:test') &&
    launchVerifyCommands.has('npm run phase9:governed-publication-coverage:test') &&
    phase9VerifyCommands.has('npm run phase9:git-status-exclusion:test') &&
    launchVerifyCommands.has('npm run phase9:git-status-exclusion:test') &&
    phase9VerifyCommands.has('npm run phase9:dependency-sbom:test') &&
    launchVerifyCommands.has('npm run phase9:dependency-sbom:test') &&
    phase9VerifyCommands.has('npm run e2e:human:manifest:contract:test') &&
    launchVerifyCommands.has('npm run e2e:human:manifest:contract:test') &&
    phase9VerifyCommands.has('npm run phase7:qa-packet:contract:test') &&
    launchVerifyCommands.has('npm run phase7:qa-packet:contract:test') &&
    launchVerifyCommands.has('npm run docs:readiness-status-audit:test') &&
    launchVerifyCommands.has('npm run docs:device-support-policy-audit:test') &&
    launchVerifyCommands.has('npm run docs:performance-readiness-audit:check') &&
    [
      'native-ocr-evidence',
      'camera-lifecycle-evidence',
      'performance-evidence',
      'widget-lifecycle-evidence',
    ].every(
      (name) =>
        launchVerifyCommands.has(`npm run phase5:${name}:smoke`) &&
        launchVerifyCommands.has(`npm run phase5:${name}:template:check`),
    ),
  'Pre-S Phase 9 and launch verification must run source-safe integrity, exact-status, publication coverage, dependency-SBOM, human/Phase 7/device contracts, performance source replay, and all Phase 5 evidence smoke/template gates.',
);
block(
  errors,
  packageJson.scripts?.['phase4:beta-coverage-report:check'] ===
    'node scripts/phase4/beta-coverage-report.mjs --strict --check' &&
    packageJson.scripts?.['phase4:beta-coverage-contract:test'] ===
      'node --test scripts/phase4/beta-coverage-packet-contract.test.mjs scripts/phase4/beta-coverage-committed-check.test.mjs scripts/phase9/upstream-packet-contract.test.mjs',
  'Phase 4 must expose the strict non-writing beta publication check and its focused contracts.',
);
block(
  errors,
  packageJson.scripts?.['release:governed-packets:check'] ===
    GOVERNED_POST_F_COMMANDS.map((commandName) => `npm run ${commandName}`).join(' && '),
  'The post-F governed packet verifier must run every reviewed deterministic replay and contract exactly once in dependency order.',
);

block(
  errors,
  has('apps/mobile/app.config.js', /associatedDomains/),
  'app.config.js must configure iOS associated domains.',
);
if (androidReleaseRequired) {
  block(
    errors,
    has('apps/mobile/app.config.js', /intentFilters/),
    'app.config.js must configure Android App Links.',
  );
}
block(
  errors,
  has('apps/mobile/eas.json', /"production"/) &&
    has('apps/mobile/eas.json', /"channel":\s*"production"/),
  'eas.json must define a production channel.',
);
block(
  errors,
  has('apps/mobile/app.config.js', /function readVariantEnv/) &&
    has('apps/mobile/app.config.js', /trim\(\)\.toLowerCase\(\)/) &&
    has('apps/mobile/app.config.js', /must be development, staging, or production/),
  'app.config.js must normalize and validate APP_VARIANT before resolving native identity.',
);
block(
  errors,
  !/^production$/i.test(env.EXPO_PUBLIC_APP_ENV ?? '') ||
    !env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY,
  'Production builds must not include RevenueCat Test Store key.',
);
block(
  errors,
  has('apps/mobile/src/lib/env.ts', /function readAppEnvironment/),
  'Mobile env helper must normalize app environment.',
);
block(
  errors,
  has('apps/mobile/src/lib/env.ts', /return isDevRuntime\(\) \? 'development' : 'production'/),
  'Mobile env helper must default missing/invalid non-dev app environment to production.',
);
block(
  errors,
  !has(
    'apps/mobile/src/lib/env.ts',
    /appEnvironment:\s*process\.env\.EXPO_PUBLIC_APP_ENV\s*\?\?\s*'development'/,
  ),
  'Mobile env helper must not default appEnvironment to development in release bundles.',
);
block(
  errors,
  has('apps/mobile/src/lib/env.test.ts', /defaults missing non-dev app env to production/) &&
    has('apps/mobile/src/lib/env.test.ts', /defaults invalid non-dev app env to production/),
  'Mobile env tests must prove non-dev app environment fails closed to production.',
);
block(
  errors,
  has('scripts/phase9/lib.mjs', /function readScriptAppEnvironment/) &&
    has('scripts/phase9/lib.mjs', /envFile\('\.env'\)/) &&
    has('scripts/phase9/lib.mjs', /process\.env/) &&
    has('scripts/phase9/lib.mjs', /return 'production'/),
  'Phase 9 script app-environment helper must default missing or invalid values to production.',
);
for (const file of liveHarnessFiles) {
  if (!exists(file)) continue;
  const source = read(file);
  block(
    errors,
    /readScriptAppEnvironment\(\)/.test(source),
    `${file} must use readScriptAppEnvironment().`,
  );
  block(
    errors,
    !/\?\?\s*'development'/.test(source),
    `${file} must not default live app environment to development.`,
  );
  block(
    errors,
    /placeholderEnvValue/.test(source),
    `${file} must use the shared placeholderEnvValue helper.`,
  );
  block(
    errors,
    !/function\s+placeholder\s*\(/.test(source),
    `${file} must not carry a local placeholder regex.`,
  );
  if (/cleanup (?:warning|failed)/i.test(source)) {
    block(
      errors,
      /redactedErrorKind/.test(source),
      `${file} cleanup warnings must use redacted error kinds.`,
    );
    block(
      errors,
      !/cleanup (?:warning|failed)[^\n]*(?:\.message|resultError\(error\)|user\.email|externalOrderId)/i.test(
        source,
      ),
      `${file} cleanup warnings must not include raw messages, user emails, or synthetic identifiers.`,
    );
  }
}

const qaPacketBuilder = read('scripts/phase9/build-release-qa-packet.mjs');
const releaseQaIntegrity = read('scripts/phase9/release-qa-integrity.mjs');
const releaseQaIntegrityTests = read('scripts/phase9/release-qa-integrity.test.mjs');
const redirectedPhase9Packet = spawnSync(
  process.execPath,
  ['scripts/phase9/build-release-qa-packet.mjs'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      PHASE9_PACKET_OUT_DIR: 'docs/phase-9/release-candidates/rc-redirection-probe',
    },
    maxBuffer: 2 * 1024 * 1024,
    timeout: 60_000,
    windowsHide: true,
  },
);
block(
  errors,
  redirectedPhase9Packet.status !== 0 &&
    /PHASE9_PACKET_OUT_DIR cannot redirect the governed Phase 9 release packet outputs/.test(
      `${redirectedPhase9Packet.stdout ?? ''}\n${redirectedPhase9Packet.stderr ?? ''}`,
    ),
  'Phase 9 release QA packet must reject caller-selected output directories before publication.',
);
block(
  errors,
  /scripts\/phase9\/build-release-qa-packet\.mjs/.test(qaPacketBuilder),
  'Phase 9 release QA packet must include its own builder in source hashes.',
);
block(
  errors,
  /const defaultPacketOutputPaths = \[\s*'docs\/phase-9\/generated\/release-engineering-qa-packet\.json',\s*'docs\/phase-9\/generated\/release-engineering-qa-packet\.md',\s*\]/.test(
    qaPacketBuilder,
  ) &&
    /PHASE9_PACKET_OUT_DIR cannot redirect the governed Phase 9 release packet outputs/.test(
      qaPacketBuilder,
    ) &&
    /const packetOutputPaths = \[\.\.\.defaultPacketOutputPaths\]/.test(qaPacketBuilder),
  'Phase 9 release QA packet must publish only the fixed governed output pair.',
);
block(
  errors,
  /Release QA packet generated with a dirty Git worktree/.test(qaPacketBuilder) &&
    /Git status: \$\{packet\.gitStatus \? 'DIRTY' : 'clean'\}/.test(qaPacketBuilder),
  'Phase 9 release QA packet must warn on dirty worktrees and expose Git status in Markdown.',
);
block(
  errors,
  /captureReleaseQaSnapshot\(\{[\s\S]*?expectedHeadSha:\s*gitSha[\s\S]*?outputPaths: check \? \[\] : packetOutputPaths/.test(
    qaPacketBuilder,
  ) &&
    /sourceSnapshot\.gitStatus/.test(qaPacketBuilder) &&
    /NUL Git status SHA-256/.test(qaPacketBuilder),
  'Phase 9 release QA packet must pin HEAD and expose the output-excluded NUL Git status binding.',
);
block(
  errors,
  /environmentBootstrap\.records\['\.env\.example'\]\.headBytes/.test(qaPacketBuilder) &&
    /workingInputPaths:\s*\['\.env'\]/.test(qaPacketBuilder) &&
    /validateLaunchContract\(launchContract\)/.test(qaPacketBuilder) &&
    /sourceSnapshot\.records\['docs\/hugeToDo\/launch-contract\.json'\]\.headBytes/.test(
      qaPacketBuilder,
    ) &&
    /verifyAdditional\(\) \{[\s\S]*phase9AssemblyStabilityErrors\(\{ includeSourceSnapshot: false \}\)/.test(
      qaPacketBuilder,
    ) &&
    /phase9AssemblyStabilityErrors\(\{ includeSourceSnapshot: true \}\)/.test(qaPacketBuilder),
  'Phase 9 packet inputs must cache pinned env defaults and launch contract, recheck optional .env bytes, and guard the process environment.',
);
block(
  errors,
  /validateCat07CommittedEvidence\(validationRoot, \{ expectedHeadSha \}\)/.test(qaPacketBuilder) &&
    /validateCat07FullEvidenceContract\(validationRoot, \{ expectedHeadSha \}\)/.test(
      qaPacketBuilder,
    ) &&
    /cat07Evidence\.status === 'pass'/.test(qaPacketBuilder) &&
    /CAT07 Launch Evidence/.test(qaPacketBuilder) &&
    /boundInputHashes/.test(qaPacketBuilder),
  'Phase 9 release QA readiness must require both HEAD-pinned CAT07 validators and expose their exact hashes/statuses.',
);
block(
  errors,
  /evaluateReleaseCandidateReadiness\(\{/.test(qaPacketBuilder) &&
    /releaseCandidateEvidence\.status === 'pass'/.test(qaPacketBuilder) &&
    /expectedReleaseCandidateMetadataPaths/.test(qaPacketBuilder) &&
    /auditGitContract:\s*auditReleaseCandidateGitContract/.test(qaPacketBuilder) &&
    /store-build-inspect\.mjs', '--check', '--strict'/.test(qaPacketBuilder) &&
    /captureReleaseCandidateRawEvidenceBindings/.test(qaPacketBuilder) &&
    /verifyReleaseCandidateRawEvidenceBindings/.test(qaPacketBuilder) &&
    /RC archive\/store cross-binding/.test(qaPacketBuilder),
  'Phase 9 packet readiness must require the exact pinned RC inventory, Git contract, and strict archive/store cross-binding.',
);
block(
  errors,
  /auditGovernedEvidenceChain\(\{[\s\S]*sourceGitSha: governedSourceGitSha,[\s\S]*releaseCandidateDir: governedReleaseCandidateSelection,[\s\S]*expectedHeadSha: gitSha,/.test(
    qaPacketBuilder,
  ) &&
    /PHASE9_IOS_SOURCE_GIT_SHA[\s\S]*GOVERNED_EVIDENCE_SOURCE_GIT_SHA/.test(qaPacketBuilder) &&
    /PHASE9_RELEASE_CANDIDATE_DIR[\s\S]*GOVERNED_EVIDENCE_RC_DIR/.test(qaPacketBuilder) &&
    /select different governed evidence/.test(qaPacketBuilder) &&
    /governedEvidenceChain\.status === 'pass'/.test(qaPacketBuilder) &&
    /sourcePacketCodeBoundToSourceCommit/.test(qaPacketBuilder) &&
    /captureGovernedEvidenceWorkingBindings\([\s\S]*governedEvidenceChainAudit,[\s\S]*root,/.test(
      qaPacketBuilder,
    ) &&
    /if \(!governedEvidenceBindings\) \{[\s\S]*no retained governed evidence file bindings/.test(
      qaPacketBuilder,
    ) &&
    /verifyGovernedEvidenceWorkingBindings\(governedEvidenceBindings, root, \{[\s\S]*context: 'Phase 9 packet assembly'/.test(
      qaPacketBuilder,
    ) &&
    /Governed Evidence Chain/.test(qaPacketBuilder),
  'Phase 9 packet must consume and publish the central S-to-E-to-current ledger audit, reject conflicting aliases, bind packet code to S, and recheck immutable evidence during publication.',
);
block(
  errors,
  /inputPaths: check[\s\S]*\.\.\.packetOutputPaths/.test(qaPacketBuilder) &&
    /outputPaths: check \? \[\] : packetOutputPaths/.test(qaPacketBuilder) &&
    /record\?\.workingKind !== 'file'/.test(qaPacketBuilder) &&
    /!record\.workingTreeMatchesHead/.test(qaPacketBuilder) &&
    /canonicalJsonBytes\(recordedPacket\)\.equals\(jsonRecord\.workingBytes\)/.test(
      qaPacketBuilder,
    ) &&
    /exactIsoTimestamp\(recordedPacket\.generatedAt\)/.test(qaPacketBuilder) &&
    /phase9AssemblyStabilityErrors\(\{ includeSourceSnapshot: true \}\)/.test(qaPacketBuilder) &&
    /PHASE9_QA_PACKET_CHECK_COMPARISON_COMPLETE/.test(qaPacketBuilder),
  'Phase 9 check mode must validate committed canonical output bytes and recheck source, raw evidence, CAT07, environment, and governed bindings after its adversarial drift window.',
);
block(
  errors,
  !/governed-evidence-chain\.mjs/.test(releaseQaIntegrity),
  'The low-level release QA integrity module must not import the governed evidence chain and create a dependency cycle.',
);
block(
  errors,
  /'status',[\s\S]{0,80}'--porcelain=v1',[\s\S]{0,80}'-z'/.test(releaseQaIntegrity) &&
    /'cat-file', '--batch'/.test(releaseQaIntegrity) &&
    /trustedGitExecutable/.test(releaseQaIntegrity) &&
    /env:\s*trustedGitEnvironment\(executable\)/.test(releaseQaIntegrity) &&
    /readStableRootBoundWorkingFile/.test(releaseQaIntegrity) &&
    /PHASE9_RELEASE_INPUT_AGGREGATE_MAX_BYTES/.test(releaseQaIntegrity) &&
    /verifyReleaseQaSnapshot\(snapshot\)/.test(releaseQaIntegrity) &&
    /ReleaseQaSnapshotDriftError/.test(releaseQaIntegrity) &&
    /atomicWriteReleaseQaOutputs/.test(qaPacketBuilder),
  'Phase 9 packet publication must cache pinned HEAD blobs, use NUL status, recheck every input, and atomically delete/block on drift.',
);
block(
  errors,
  /rejects missing, untracked, forged, and stale evidence/.test(releaseQaIntegrityTests) &&
    /rejects timeout, execution failure, and PASS-marker mismatch/.test(releaseQaIntegrityTests) &&
    /removes both outputs when an input drifts after writing/.test(releaseQaIntegrityTests) &&
    /uses an absolute executable, a minimal environment, and ignores repository redirection/.test(
      releaseQaIntegrityTests,
    ) &&
    /reject oversized optional inputs and unsafe ancestors/.test(releaseQaIntegrityTests) &&
    /detect path replacement after descriptor open/.test(releaseQaIntegrityTests) &&
    /requires exact pinned metadata plus real gate results/.test(releaseQaIntegrityTests) &&
    /removes outputs when ignored mounted raw RC evidence changes/.test(releaseQaIntegrityTests) &&
    /validateCat07CommittedEvidence/.test(releaseQaIntegrityTests) &&
    /validateCat07FullEvidenceContract/.test(releaseQaIntegrityTests),
  'Phase 9 must retain real/synthetic CAT07 forgery, validator-failure, and packet-TOCTOU adversarial tests.',
);
for (const file of ['.env.example', ...requiredFiles]) {
  block(
    errors,
    qaPacketBuilder.includes(`'${file}'`) ||
      qaPacketBuilder.includes(`"${file}"`) ||
      (PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS.includes(file) &&
        /PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS/.test(qaPacketBuilder)) ||
      (PHASE9_CAT07_BOUND_INPUT_PATHS.includes(file) &&
        /\.\.\.PHASE9_CAT07_BOUND_INPUT_PATHS/.test(qaPacketBuilder)),
    `Phase 9 release QA packet must hash ${file}.`,
  );
}
block(
  errors,
  has('apps/mobile/src/lib/launch/phase7.ts', /productionSurfaceReady/) &&
    has(
      'apps/mobile/src/lib/launch/phase7.ts',
      /env\.appEnvironment\s*!==\s*'production'\s*\|\|\s*finalDomainReady/,
    ),
  'Phase 7 launch flags must fail closed for production bundles until a final brand domain is configured.',
);
block(
  errors,
  has(
    'apps/mobile/src/lib/launch/phase7.ts',
    /phase7Capabilities\s*=\s*Object\.freeze\([\s\S]*communityQuestionSubmission:\s*false[\s\S]*communityAggregates:\s*false[\s\S]*trendEngine:\s*false[\s\S]*nativeWidgets:\s*false/,
  ),
  'Unimplemented community, Trend, and native-widget capabilities must remain non-environment-driven.',
);
block(
  errors,
  has(
    'apps/mobile/src/lib/launch/phase7.test.ts',
    /keeps production Phase 7 surfaces disabled without a final brand domain/,
  ) &&
    has(
      'apps/mobile/src/lib/launch/phase7.test.ts',
      /keeps unimplemented capabilities closed even when staging flags are enabled/,
    ),
  'Phase 7 launch tests must cover production identity gates and non-bypassable unavailable capabilities.',
);

for (const [path, surface, label] of [
  ['apps/mobile/src/app/community/ask.tsx', 'communityPosting', 'community ask screen'],
  [
    'apps/mobile/src/app/community/people-like-you.tsx',
    'communityPosting',
    'community aggregate screen',
  ],
  ['apps/mobile/src/app/trend/optin.tsx', 'trend', 'trend opt-in screen'],
  ['apps/mobile/src/app/routine/widgets.tsx', 'widgets', 'widgets screen'],
]) {
  const source = read(path);
  block(
    errors,
    /DeferredSurface/.test(source) && source.includes(`surface="${surface}"`),
    `${label} must remain a truthful deferred surface.`,
  );
}

const communityAsk = read('apps/mobile/src/app/community/ask.tsx');
const communityAggregate = read('apps/mobile/src/app/community/people-like-you.tsx');
const trendOptIn = read('apps/mobile/src/app/trend/optin.tsx');
const widgetsRoute = read('apps/mobile/src/app/routine/widgets.tsx');
const routineLayout = read('apps/mobile/src/app/routine/_layout.tsx');
const routineGatedRoutes = read('apps/mobile/src/features/subscription/gatedRoutes.ts');
const subscriptionCopy = read('apps/mobile/src/features/subscription/copy.ts');
block(
  errors,
  !/question_submitted|grantCommunityConsent|confirmCommunityAge|TextInput/.test(communityAsk),
  'Unavailable community posting must not collect consent, accept text, or emit submission analytics.',
);
block(
  errors,
  !/dry, sensitive|alternate-night cycling|Aggregated & anonymised/.test(communityAggregate),
  'People-like-you must not render illustrative aggregate data as real.',
);
block(
  errors,
  !/grantTrendConsent|revokeTrendConsent|photo_trend_insights|ToggleSwitch/.test(trendOptIn),
  'Unavailable Trend must not solicit consent or present an opt-in control.',
);
block(
  errors,
  !/Show on Lock Screen|useUpdateNotifPrefs|Live Activity/.test(widgetsRoute) &&
    !/withProGate|<ProGate/.test(widgetsRoute) &&
    /if \(routeName === 'widgets'\) return null/.test(routineGatedRoutes) &&
    /if \(!gateFeature\) return stack/.test(routineLayout) &&
    !/glanceable|home screen|Live Activit(?:y|ies)/i.test(subscriptionCopy),
  'Unavailable native widgets and Live Activities must bypass paywalls and not appear as working claims.',
);

blockPublicEnvSecrets(errors, env, exampleEnv);

const placeholder = placeholderEnvValue;

function markdownTableValue(source, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    source
      .match(new RegExp(`^\\|\\s*${escaped}\\s*\\|\\s*([^|]+?)\\s*\\|\\s*$`, 'im'))?.[1]
      ?.trim() ?? ''
  );
}

function validSignoffDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

for (const [key, validate] of [
  ['EXPO_PUBLIC_PRIVACY_URL', productionUrl],
  ['EXPO_PUBLIC_TERMS_URL', productionUrl],
  ['EXPO_PUBLIC_SUPPORT_URL', productionUrl],
  ['EXPO_PUBLIC_ACCOUNT_DELETION_URL', productionUrl],
  ['EXPO_PUBLIC_DATA_EXPORT_URL', productionUrl],
  ['EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL', productionUrl],
  ['EXPO_PUBLIC_FINAL_BRAND_DOMAIN', productionDomain],
  ['EXPO_PUBLIC_MARKETING_URL', productionUrl],
  ['EXPO_PUBLIC_SUPPORT_EMAIL', productionSupportEmail],
  ['EXPO_PUBLIC_APP_STORE_URL', productionUrl],
  ...(androidReleaseRequired ? [['EXPO_PUBLIC_PLAY_STORE_URL', productionUrl]] : []),
]) {
  warn(warnings, validate(env[key]), `Missing or non-production final value for ${key}.`);
}

for (const key of requiredPhase9EvidenceKeys()) {
  warn(warnings, evidenceFlagEnabled(env[key]), `Missing Phase 9 release evidence: ${key}=true.`);
}
warn(
  warnings,
  Boolean(normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY)),
  'Missing Phase 9 named signoff: PHASE9_SIGNED_OFF_BY.',
);

const claimedPhase9EvidenceKeys = requiredPhase9EvidenceKeys().filter((key) =>
  evidenceFlagEnabled(env[key]),
);
const claimedPhase9Signoff = Boolean(normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY));
const releaseCandidateDir = String(env.PHASE9_RELEASE_CANDIDATE_DIR ?? '')
  .replace(/\\/g, '/')
  .replace(/\/+$/g, '');
if (claimedPhase9EvidenceKeys.length > 0 || claimedPhase9Signoff) {
  block(
    errors,
    !placeholder(releaseCandidateDir),
    'PHASE9_RELEASE_CANDIDATE_DIR is required when any Phase 9 evidence or signoff is claimed.',
  );
  if (!placeholder(releaseCandidateDir)) {
    block(
      errors,
      /^docs\/phase-9\/release-candidates\/rc-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(releaseCandidateDir),
      'PHASE9_RELEASE_CANDIDATE_DIR must point to one immutable non-template folder under docs/phase-9/release-candidates/.',
    );

    const rcFileNames = [
      'manifest.md',
      'commands.md',
      'automated-verification.md',
      'manual-qa-matrix.md',
      'security-review.md',
      'privacy-review.md',
      'ios-archive-privacy-evidence.json',
      'payments-review.md',
      'observability-review.md',
      'store-review-packet.md',
      'rollout-plan.md',
      'incident-plan.md',
      'signoff.md',
    ];
    const rcFiles = rcFileNames.map((file) => `${releaseCandidateDir}/${file}`);

    block(
      errors,
      env.PHASE9_IOS_ARCHIVE_PRIVACY_EVIDENCE_PATH ===
        `${releaseCandidateDir}/ios-archive-privacy-evidence.json`,
      'PHASE9_IOS_ARCHIVE_PRIVACY_EVIDENCE_PATH must bind the claimed RC archive-evidence JSON.',
    );

    for (const file of rcFiles) {
      block(errors, exists(file), `${file} is missing from claimed release-candidate evidence.`);
    }

    for (const file of rcFiles) {
      if (!exists(file)) continue;
      block(
        errors,
        !/(?:\b(?:tbd|blocked|pending|todo|unknown)\b|replace_with_)/iu.test(read(file)),
        `${file} must not contain unresolved placeholders when Phase 9 evidence is claimed.`,
      );
    }
    for (const name of rcFileNames) {
      const file = `${releaseCandidateDir}/${name}`;
      const templateFile = `docs/phase-9/release-candidates/_template/${name}`;
      if (!exists(file) || !exists(templateFile)) continue;
      block(
        errors,
        hash(file) !== hash(templateFile),
        `${file} must be customized from the RC template when Phase 9 evidence is claimed.`,
      );
    }

    const signoffPath = `${releaseCandidateDir}/signoff.md`;
    if (exists(signoffPath)) {
      const expectedAreas = [
        'Product',
        'Engineering',
        'Security/privacy',
        'Legal/clinical claims',
        'Payments/finance',
        'Support',
        'Release manager',
      ];
      const rows = read(signoffPath)
        .split(/\r?\n/u)
        .filter((line) => /^\|.*\|$/u.test(line))
        .map((line) =>
          line
            .slice(1, -1)
            .split('|')
            .map((cell) => cell.trim()),
        )
        .filter((cells) => cells.length === 5);
      const signoffs = new Map();
      for (const area of expectedAreas) {
        const matchingRows = rows.filter((row) => row[0] === area);
        block(errors, matchingRows.length === 1, `${signoffPath} must contain one ${area} row.`);
        if (matchingRows.length !== 1) continue;
        const [, owner, decision, date, residualRisk] = matchingRows[0];
        const normalizedOwner = normalizeNamedSignoff(owner);
        block(errors, Boolean(normalizedOwner), `${signoffPath} ${area} must name a real owner.`);
        block(errors, decision === 'APPROVE', `${signoffPath} ${area} decision must be APPROVE.`);
        block(
          errors,
          validSignoffDate(date),
          `${signoffPath} ${area} must use a real YYYY-MM-DD date.`,
        );
        block(
          errors,
          Boolean(residualRisk) &&
            !/(?:\b(?:tbd|blocked|pending|todo|unknown)\b|replace_with_)/iu.test(residualRisk),
          `${signoffPath} ${area} must record reviewed residual risk.`,
        );
        if (normalizedOwner) signoffs.set(area, normalizedOwner);
      }
      block(
        errors,
        signoffs.get('Release manager') === normalizeNamedSignoff(env.PHASE9_SIGNED_OFF_BY),
        'PHASE9_SIGNED_OFF_BY must match the RC release-manager signoff owner.',
      );
      block(
        errors,
        signoffs.get('Security/privacy') !== signoffs.get('Release manager'),
        'Security/privacy and release-manager signoffs must be distinct people.',
      );
    }

    const manifestPath = `${releaseCandidateDir}/manifest.md`;
    if (exists(manifestPath)) {
      const manifestSource = read(manifestPath);
      const manifestSha = markdownTableValue(manifestSource, 'Build-source Git SHA');
      block(
        errors,
        /^[a-f0-9]{40}$/.test(manifestSha),
        `${manifestPath} must contain the full lowercase build-source Git SHA.`,
      );
      if (/^[a-f0-9]{40}$/.test(manifestSha)) {
        block(
          errors,
          env.PHASE9_IOS_SOURCE_GIT_SHA === manifestSha,
          'PHASE9_IOS_SOURCE_GIT_SHA must match the RC manifest build-source SHA.',
        );
        try {
          const gitAudit = auditReleaseCandidateGitContract({
            root: process.cwd(),
            sourceGitSha: manifestSha,
            releaseCandidateDir,
            requiredTrackedFiles: rcFiles,
          });
          for (const error of gitAudit.errors) {
            block(errors, false, `Phase 9 release-candidate Git contract: ${error}`);
          }
        } catch {
          block(errors, false, 'Phase 9 release-candidate Git contract could not be evaluated.');
        }
      }
    }
  }

  if (strict) {
    try {
      command(process.execPath, ['scripts/phase9/store-build-inspect.mjs', '--check', '--strict']);
    } catch {
      block(
        errors,
        false,
        'Strict Phase 9 release smoke requires strict archive/store inspection to pass for the same environment.',
      );
    }
  }
}

if (evidenceFlagEnabled(env.EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED)) {
  warn(
    warnings,
    productionDomain(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
    'Public links are enabled before final domain evidence.',
  );
}

const productionPhase7SurfaceEvidence = [
  {
    flag: 'EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED',
    label: 'Commerce',
    evidence: [
      'PHASE7_BRAND_READY',
      'PHASE7_CLINICAL_REVIEW_PASS',
      'PHASE7_CATALOG_BETA_IMPORT_PASS',
      'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
    ],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED',
    label: 'Community posting',
    evidence: [
      'PHASE7_CLINICAL_REVIEW_PASS',
      'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
      'PHASE7_BETA_DASHBOARD_READY',
    ],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_TREND_ENABLED',
    label: 'Trend insights',
    evidence: [
      'PHASE7_CLINICAL_REVIEW_PASS',
      'PHASE7_DEVICE_QA_PASS',
      'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
    ],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED',
    label: 'Cloud Ask',
    evidence: [
      'PHASE7_CLINICAL_REVIEW_PASS',
      'PHASE7_PRIVACY_EXPORT_DELETE_PASS',
      'PHASE7_BETA_DASHBOARD_READY',
    ],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED',
    label: 'Widgets',
    evidence: ['PHASE7_DEVICE_QA_PASS', 'PHASE7_BETA_DASHBOARD_READY'],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED',
    label: 'Share cards',
    evidence: ['PHASE7_BRAND_READY', 'PHASE7_CLINICAL_REVIEW_PASS', 'PHASE7_DEVICE_QA_PASS'],
  },
  {
    flag: 'EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED',
    label: 'Goal-active recommendations',
    evidence: ['PHASE7_CLINICAL_REVIEW_PASS', 'PHASE7_CATALOG_BETA_IMPORT_PASS'],
  },
];

if (/^production$/i.test(env.EXPO_PUBLIC_APP_ENV ?? '')) {
  for (const surface of productionPhase7SurfaceEvidence) {
    if (!evidenceFlagEnabled(env[surface.flag])) continue;
    block(
      errors,
      productionDomain(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN),
      `Production ${surface.label} cannot be enabled before EXPO_PUBLIC_FINAL_BRAND_DOMAIN is final.`,
    );
    for (const key of surface.evidence) {
      block(
        errors,
        evidenceFlagEnabled(env[key]),
        `Production ${surface.label} requires ${key}=true.`,
      );
    }
    block(
      errors,
      Boolean(normalizeNamedSignoff(env.PHASE7_SIGNED_OFF_BY)),
      `Production ${surface.label} requires PHASE7_SIGNED_OFF_BY.`,
    );
  }
}

if (evidenceFlagEnabled(env.EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED)) {
  warn(
    warnings,
    evidenceFlagEnabled(env.PHASE7_CLINICAL_REVIEW_PASS),
    'Cloud Ask is enabled without clinical/legal release evidence.',
  );
}
if (evidenceFlagEnabled(env.EXPO_PUBLIC_NATIVE_OCR_ENABLED)) {
  const nativeOcrEvidenceCheck = spawnSync(
    process.execPath,
    ['scripts/phase5/check-native-ocr-evidence.mjs', '--strict'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, ...env },
    },
  );
  warn(
    warnings,
    nativeOcrEvidenceCheck.status === 0,
    'Native OCR is enabled without a passing exact-source/build/profile PHASE5_NATIVE_OCR_EVIDENCE_PATH artifact.',
  );
}
if (env.EXPO_PUBLIC_APP_ENV === 'production') {
  warn(
    warnings,
    !placeholder(env.TURNSTILE_SECRET_KEY),
    'Production public forms require TURNSTILE_SECRET_KEY.',
  );
}
if (!placeholder(env.SHOPMY_BRAND_API_KEY)) {
  block(
    errors,
    !placeholder(env.ORDER_REPORT_POLL_SECRET),
    'ORDER_REPORT_POLL_SECRET is required when SHOPMY_BRAND_API_KEY is configured.',
  );
  block(
    errors,
    !placeholder(env.SHOPMY_BRAND_DOMAIN) && validServerHostname(env.SHOPMY_BRAND_DOMAIN),
    'SHOPMY_BRAND_DOMAIN must be the registered hostname without a scheme or path when SHOPMY_BRAND_API_KEY is configured.',
  );
}
block(
  errors,
  integerInRange(env.PUBLIC_FORMS_RATE_LIMIT_MAX, 1, 1000),
  'PUBLIC_FORMS_RATE_LIMIT_MAX must be an integer from 1 to 1000.',
);
block(
  errors,
  integerInRange(env.PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS, 60, 86400),
  'PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS must be an integer from 60 to 86400.',
);
block(
  errors,
  integerInRange(env.PUBLIC_FORMS_MAX_BYTES, 1024, 65536),
  'PUBLIC_FORMS_MAX_BYTES must be an integer from 1024 to 65536.',
);
block(
  errors,
  integerInRange(env.PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX, 2, 1100),
  'PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX must be an integer from 2 to 1100.',
);
block(
  errors,
  Number(env.PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX) > Number(env.PUBLIC_FORMS_RATE_LIMIT_MAX),
  'PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX must be greater than PUBLIC_FORMS_RATE_LIMIT_MAX.',
);
block(
  errors,
  integerInRange(env.CATALOG_RATE_LIMIT_MAX, 1, 1000),
  'CATALOG_RATE_LIMIT_MAX must be an integer from 1 to 1000.',
);
block(
  errors,
  integerInRange(env.CATALOG_RATE_LIMIT_WINDOW_SECONDS, 60, 86400),
  'CATALOG_RATE_LIMIT_WINDOW_SECONDS must be an integer from 60 to 86400.',
);
block(
  errors,
  integerInRange(env.USER_EDGE_BODY_MAX_BYTES, 1024, 65536),
  'USER_EDGE_BODY_MAX_BYTES must be an integer from 1024 to 65536.',
);
block(
  errors,
  integerInRange(env.EDGE_EXTERNAL_FETCH_TIMEOUT_MS, 1000, 30000),
  'EDGE_EXTERNAL_FETCH_TIMEOUT_MS must be an integer from 1000 to 30000.',
);
block(
  errors,
  integerInRange(env.EDGE_EXTERNAL_RESPONSE_MAX_BYTES, 1024, 1048576),
  'EDGE_EXTERNAL_RESPONSE_MAX_BYTES must be an integer from 1024 to 1048576.',
);
block(
  errors,
  integerInRange(env.DATA_EXPORT_RATE_LIMIT_MAX, 1, 100),
  'DATA_EXPORT_RATE_LIMIT_MAX must be an integer from 1 to 100.',
);
block(
  errors,
  integerInRange(env.DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS, 60, 86400),
  'DATA_EXPORT_RATE_LIMIT_WINDOW_SECONDS must be an integer from 60 to 86400.',
);
block(
  errors,
  integerInRange(env.DATA_EXPORT_PHOTO_URL_TTL_SECONDS, 30, 60),
  'DATA_EXPORT_PHOTO_URL_TTL_SECONDS must be an integer from 30 to 60.',
);
block(
  errors,
  integerInRange(env.PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX, 2, 110),
  'PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX must be an integer from 2 to 110.',
);
block(
  errors,
  Number(env.PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX) > Number(env.DATA_EXPORT_RATE_LIMIT_MAX),
  'PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX must be greater than DATA_EXPORT_RATE_LIMIT_MAX.',
);
block(
  errors,
  ['true', 'false'].includes(String(env.PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK)),
  'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK must be true or false.',
);
block(
  errors,
  integerInRange(env.PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS, 0, 3900),
  'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS must be an integer from 0 to 3900.',
);
if (env.PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK === 'true') {
  block(
    errors,
    Number(env.DATA_EXPORT_PHOTO_URL_TTL_SECONDS) <= 60,
    'DATA_EXPORT_PHOTO_URL_TTL_SECONDS must be 60 or lower when signed URL expiry evidence is enabled.',
  );
  block(
    errors,
    Number(env.PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS) >
      Number(env.DATA_EXPORT_PHOTO_URL_TTL_SECONDS),
    'PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS must be greater than DATA_EXPORT_PHOTO_URL_TTL_SECONDS when expiry evidence is enabled.',
  );
}
block(
  errors,
  integerInRange(env.PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX, 2, 1100),
  'PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX must be an integer from 2 to 1100.',
);
block(
  errors,
  Number(env.PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX) > Number(env.CATALOG_RATE_LIMIT_MAX),
  'PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX must be greater than CATALOG_RATE_LIMIT_MAX.',
);
block(
  errors,
  integerInRange(env.REVENUECAT_WEBHOOK_MAX_BYTES, 1024, 262144),
  'REVENUECAT_WEBHOOK_MAX_BYTES must be an integer from 1024 to 262144.',
);

if (env.PHASE9_RUN_LIVE_SUPABASE_CHECK === 'true') {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    const response = await fetch(`${url.replace(/\/+$/g, '')}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    block(errors, response.ok, `Supabase connectivity check failed with ${response.status}.`);
  } catch (error) {
    block(
      errors,
      false,
      `Supabase connectivity check failed: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
} else {
  warn(
    warnings,
    false,
    'Live Supabase connectivity check not run; set PHASE9_RUN_LIVE_SUPABASE_CHECK=true for RC evidence.',
  );
}

if (!androidReleaseRequired) {
  console.log(
    'N/A Android build, Play testing, Play packet, and Play Store URL evidence: excluded by launch contract.',
  );
}
printResult('Phase 9 release smoke', errors, warnings);
