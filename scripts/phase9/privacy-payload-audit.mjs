#!/usr/bin/env node
import { abs, block, evidenceFlagEnabled, listFiles, printResult, read, warn } from './lib.mjs';
import { auditAnalyticsSource } from './analytics-source-audit.mjs';
import { auditSentrySource } from './sentry-source-audit.mjs';

const errors = [];
const warnings = [];
const analyticsSourceAudit = auditAnalyticsSource();
errors.push(...analyticsSourceAudit.errors);
const sentrySourceAudit = auditSentrySource();
errors.push(...sentrySourceAudit.errors);

const registrySource = read('apps/mobile/src/lib/analytics/eventRegistry.ts');
const trackSource = read('apps/mobile/src/lib/analytics/track.ts');
const sentrySource = read('apps/mobile/src/lib/observability/sentry.ts');
const scrubSource = read('apps/mobile/src/lib/observability/scrub.ts');
const safeLogSource = read('apps/mobile/src/lib/observability/safeLog.ts');
const authProviderSource = read('apps/mobile/src/lib/auth/AuthProvider.tsx');
const localPrivateDataSource = read('apps/mobile/src/features/settings/localPrivateData.ts');
const localPrivateDataRegistrySource = read(
  'apps/mobile/src/features/settings/localPrivateDataRegistry.ts',
);
const revenueCatSource = read('apps/mobile/src/lib/iap/revenuecat.ts');
const revenueCatOwnerCoordinatorSource = read(
  'apps/mobile/src/lib/iap/revenuecatOwnerCoordinator.ts',
);
const shareCardSource = read('apps/mobile/src/features/growth/shareCard.ts');
const encryptedPhotoSource = read('apps/mobile/src/features/photos/encryptedStorage.ts');
const sharePhotoSource = read('apps/mobile/src/features/photos/sharePhoto.ts');
const photoMetadataSource = read('apps/mobile/src/features/photos/metadata.ts');
const plaintextStagingSource = read('apps/mobile/src/lib/storage/plaintextStagingCore.ts');
const plaintextStagingAdapterSource = read('apps/mobile/src/lib/storage/plaintextStaging.ts');
const photoConsentSource = read('apps/mobile/src/features/photos/consent.ts');
const photoStoreSource = read('apps/mobile/src/features/photos/store.ts');
const photoDetailSource = read('apps/mobile/src/app/progress/[id].tsx');
const photoCopySource = read('apps/mobile/src/features/photos/copy.ts');
const photoSettingsSource = read('apps/mobile/src/app/(tabs)/you.tsx');
const rootLayoutSource = read('apps/mobile/src/app/_layout.tsx');
const plaintextStagingStartupGateSource = read(
  'apps/mobile/src/lib/storage/PlaintextStagingStartupGate.tsx',
);
const privateStorageStartupSource = read('apps/mobile/src/lib/storage/privateStorageStartup.ts');
const notificationCopySource = read('apps/mobile/src/features/notifications/copy.ts');
const notificationDeliverSource = read('apps/mobile/src/features/notifications/deliver.ts');
const notificationStoreSource = read('apps/mobile/src/features/notifications/store.ts');
const notificationTimingSource = read('apps/mobile/src/app/settings/timing.tsx');
const notificationLockscreenMigrationSource = read(
  'supabase/migrations/20260705000033_phase9_notification_lock_screen_privacy.sql',
);
const sentrySdkAcquisitionFiles = sentrySourceAudit.acquisitionFiles;
const sentrySdkMethods = sentrySourceAudit.methods;
const photoShareFileSource = encryptedPhotoSource.slice(
  encryptedPhotoSource.indexOf('export async function createPhotoShareFile'),
  encryptedPhotoSource.indexOf('export async function deletePhotoShareFile'),
);

const allowedEvents = analyticsSourceAudit.allowedEvents;
const allowed = analyticsSourceAudit.allowedProps;
const untrackedAllowedEvents = [...allowedEvents].filter(
  (event) => !analyticsSourceAudit.trackedEvents.has(event),
);
const sensitiveKey =
  /(barcode(?!_type)|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|rule_id|content_id|question_id|id$|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|(^|_)age($|_)|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide|dspt|fitzpatrick|monk|axis|step|score|slug)/i;
const retiredAnalyticsProps = new Set(['intent', 'product_type', 'trigger']);
const approvedBucketExceptions = new Set([
  'barcode_type',
  'native_ocr_enabled',
  'screen_name',
  'share_id',
]);

block(errors, allowed.size > 0, 'Analytics event registry is empty or missing.');
block(errors, allowedEvents.size > 0, 'Analytics event-name registry is empty or missing.');
block(
  errors,
  /isAllowedAnalyticsEventName/.test(trackSource),
  'Analytics event names must use the allowlist gate.',
);
block(
  errors,
  /sanitizeAnalyticsEventName/.test(trackSource),
  'Analytics tracker must sanitize event names before vendor capture.',
);
block(
  errors,
  /posthog\?\.capture\(prepared\.event,\s*prepared\.props\)/.test(trackSource),
  'PostHog capture must use the sanitized event name.',
);
block(
  errors,
  !/posthog\?\.capture\(event/.test(trackSource),
  'PostHog capture must not receive the raw event name.',
);
block(
  errors,
  /isAllowedAnalyticsPropKey/.test(trackSource),
  'Analytics sanitizer must call isAllowedAnalyticsPropKey.',
);
block(
  errors,
  /analyticsSchemaForEvent/.test(trackSource) && /isAllowedAnalyticsPropValue/.test(trackSource),
  'Analytics sanitizer is missing its exact event-key/value guard.',
);
block(
  errors,
  /analyticsSchemaForEvent/.test(trackSource) && /isAllowedAnalyticsPropValue/.test(trackSource),
  'Analytics sanitizer must enforce the exact schema for the event.',
);
block(
  errors,
  /safeOwnDataEntries/.test(trackSource) && /Object\.getOwnPropertyDescriptor/.test(trackSource),
  'Analytics sanitizer must reject accessors and hostile property containers without invoking them.',
);
block(
  errors,
  /ANALYTICS_EVENT_SCHEMAS/.test(registrySource),
  'Analytics registry must define an exact schema for every event.',
);
block(
  errors,
  analyticsSourceAudit.callCount > 0 &&
    analyticsSourceAudit.trackedEventCount > 0 &&
    analyticsSourceAudit.allowedEventCount === allowedEvents.size &&
    analyticsSourceAudit.trackedEventCount === analyticsSourceAudit.allowedEventCount &&
    untrackedAllowedEvents.length === 0,
  `Analytics source audit must inspect at least one valid literal runtime call for every registered event${
    untrackedAllowedEvents.length ? ` (missing: ${untrackedAllowedEvents.join(', ')})` : ''
  }.`,
);
block(
  errors,
  !/value\s+instanceof\s+Date/.test(trackSource),
  'Analytics sanitizer must drop Date props instead of serializing precise timestamps.',
);
block(
  errors,
  /pseudonymousUserId/.test(trackSource),
  'Analytics identify must pseudonymize raw user IDs before vendor calls.',
);
block(
  errors,
  /posthog\?\.identify\(pseudonymousId/.test(trackSource),
  'PostHog identify must use a pseudonymous user ID.',
);
block(
  errors,
  /captureAppLifecycleEvents:\s*false/.test(trackSource),
  'PostHog automatic lifecycle capture must stay disabled.',
);
block(
  errors,
  /enableSessionReplay:\s*false/.test(trackSource),
  'PostHog session replay must stay disabled.',
);
block(
  errors,
  /sanitizeObservabilityContext/.test(sentrySource),
  'Sentry captureException must sanitize context.',
);
block(
  errors,
  sentrySdkAcquisitionFiles.length === 1 &&
    sentrySdkAcquisitionFiles[0].endsWith('/apps/mobile/src/lib/observability/sentry.ts'),
  'Only the fixed Sentry wrapper may import the Sentry SDK directly.',
);
block(
  errors,
  [...sentrySdkMethods].sort().join(',') === 'captureException,init,setTag,setUser',
  'The Sentry wrapper may use only init, setTag, setUser, and captureException.',
);
block(
  errors,
  /context\?:\s*ObservabilityContext/.test(sentrySource) &&
    /Sentry\.setTag\('app_environment',\s*env\.appEnvironment\)/.test(sentrySource) &&
    /source:\s*'phase2-runbook'/.test(sentrySource),
  'Sentry producers must use only the fixed app_environment tag and phase2-runbook context.',
);
block(
  errors,
  /sanitizeCapturedException/.test(sentrySource),
  'Sentry captureException must sanitize the captured throwable.',
);
block(
  errors,
  !/Sentry\.captureException\(error/.test(sentrySource),
  'Sentry captureException must not send the raw throwable to Sentry.',
);
block(
  errors,
  /pseudonymousUserId/.test(sentrySource),
  'Sentry setUser must pseudonymize raw user IDs before vendor calls.',
);
block(
  errors,
  /sendDefaultPii:\s*false/.test(sentrySource),
  'Sentry default PII capture must stay disabled.',
);
block(
  errors,
  /tracesSampleRate:\s*0/.test(sentrySource),
  'Sentry performance tracing must stay disabled.',
);
block(
  errors,
  /enableCaptureFailedRequests:\s*false/.test(sentrySource),
  'Sentry failed-request capture must stay disabled.',
);
block(
  errors,
  /attachScreenshot:\s*false/.test(sentrySource),
  'Sentry screenshot attachments must stay disabled.',
);
block(
  errors,
  /attachViewHierarchy:\s*false/.test(sentrySource),
  'Sentry view hierarchy attachments must stay disabled.',
);
block(errors, /maxBreadcrumbs:\s*0/.test(sentrySource), 'Sentry breadcrumbs must stay disabled.');
block(
  errors,
  /beforeBreadcrumb:\s*\(\)\s*=>\s*null/.test(sentrySource),
  'Sentry breadcrumbs must be dropped before capture.',
);
block(
  errors,
  /beforeSend:\s*sanitizeSentryEvent/.test(sentrySource),
  'Sentry events must pass through the global sanitizer before upload.',
);
block(
  errors,
  /request:\s*undefined/.test(sentrySource) &&
    /breadcrumbs:\s*undefined/.test(sentrySource) &&
    /contexts:\s*undefined/.test(sentrySource) &&
    /fingerprint:\s*undefined/.test(sentrySource) &&
    /transaction:\s*undefined/.test(sentrySource) &&
    /debug_meta:\s*sanitizeSentryDebugMeta/.test(sentrySource) &&
    /logentry:\s*undefined/.test(sentrySource) &&
    /measurements:\s*undefined/.test(sentrySource) &&
    /modules:\s*undefined/.test(sentrySource) &&
    /sdkProcessingMetadata:\s*undefined/.test(sentrySource) &&
    /server_name:\s*undefined/.test(sentrySource) &&
    /spans:\s*undefined/.test(sentrySource) &&
    /threads:\s*undefined/.test(sentrySource) &&
    /transaction_info:\s*undefined/.test(sentrySource),
  'Sentry global sanitizer must drop unsafe metadata and strictly sanitize symbolication structure.',
);
block(
  errors,
  /sanitizeSentryStacktrace/.test(sentrySource) &&
    /sanitizeSentryDebugImage/.test(sentrySource) &&
    /SAFE_DEBUG_ID/.test(sentrySource) &&
    /SAFE_GENERATED_BUNDLE_PATH/.test(sentrySource) &&
    /imageType === 'sourcemap'/.test(sentrySource),
  'Sentry must retain only fixed generated-bundle frames and exact Mach-O/source-map recovery IDs.',
);
block(
  errors,
  /OBSERVABILITY_CONTEXT_VALUES/.test(scrubSource) && /source:\s*new Set/.test(scrubSource),
  'Sentry scrubber must use a fixed context-key/value allowlist.',
);
block(
  errors,
  !/value\s+instanceof\s+Date/.test(scrubSource),
  'Sentry scrubber must drop Date context values instead of serializing precise timestamps.',
);
block(
  errors,
  /sanitizeCapturedException/.test(scrubSource),
  'Sentry scrubber must expose a captured-exception sanitizer.',
);
block(
  errors,
  /Object\.getOwnPropertyDescriptors/.test(scrubSource) && !/scrubValue/.test(scrubSource),
  'Sentry context must reject nested values and skip accessors without invoking them.',
);
block(
  errors,
  /redactedErrorForLog/.test(safeLogSource),
  'Mobile dev logging must use a redacted error helper.',
);
block(
  errors,
  !/\.message|\.stack/.test(safeLogSource),
  'Mobile dev logging redaction must not include exception message or stack.',
);
block(
  errors,
  /devWarn/.test(trackSource),
  'Analytics dev warnings must not log raw exception objects.',
);
block(
  errors,
  /devWarn/.test(sentrySource),
  'Sentry dev warnings must not log raw exception objects.',
);
block(
  errors,
  /devWarn/.test(authProviderSource),
  'RevenueCat setup warnings must not log raw exception objects.',
);
block(
  errors,
  !/console\.log\(/.test(trackSource),
  'Analytics tracking must not log events or props to the dev console.',
);
block(
  errors,
  /export async function resetAnalyticsIdentity/.test(trackSource) &&
    /posthog\?\.reset\(\)/.test(trackSource),
  'PostHog client identity must expose an account-boundary reset.',
);
block(
  errors,
  /export async function resetRevenueCatIdentity/.test(revenueCatSource) &&
    /await resetRevenueCatSdkIdentity\(\)/.test(revenueCatSource) &&
    /await ownerCoordinator\.reset\(loadRevenueCatIdentityAdapter\)/.test(revenueCatSource) &&
    /cachedOfferings = null/.test(revenueCatSource) &&
    /logOut:\s*\(\)\s*=>\s*Purchases\.logOut\(\)/.test(revenueCatSource) &&
    /await this\.logOutAndProveAnonymous\(adapter\)/.test(revenueCatOwnerCoordinatorSource) &&
    /this\.ready = null/.test(revenueCatOwnerCoordinatorSource),
  'RevenueCat client identity reset must log out and clear cached account/offering state.',
);
block(
  errors,
  /resetVendorIdentityWithinBound\(resetAnalyticsIdentity\)/.test(localPrivateDataSource) &&
    /resetVendorIdentityWithinBound\(resetRevenueCatIdentity\)/.test(localPrivateDataSource),
  'Local private-data cleanup must reset PostHog and RevenueCat client identities.',
);
block(
  errors,
  /result:\s*'base64'/.test(shareCardSource) &&
    shareCardSource.indexOf("result: 'base64'") <
      shareCardSource.indexOf("deps.reserve('conflict_share_png')") &&
    /FileSystem\.writeAsStringAsync\(uri, value,[\s\S]*EncodingType\.Base64/.test(shareCardSource),
  'Share-card capture must remain memory-first before writing journal-owned plaintext staging.',
);
block(
  errors,
  /try\s*\{[\s\S]*deps\.reserve\('conflict_share_png'\)[\s\S]*deps\.writeBase64\(staging\.uri, base64\)[\s\S]*deps\.markState\(staging, 'plaintext_written'\)[\s\S]*deps\.share\(staging\.uri, SHARE_OPTIONS\)[\s\S]*\}\s*finally\s*\{[\s\S]*await deps\.cleanup\(staging\)/.test(
    shareCardSource,
  ) && /cleanup:\s*cleanupPlaintextStaging/.test(shareCardSource),
  'Share-card export must journal and clean its owned plaintext file after every share attempt.',
);
block(
  errors,
  /PHOTO_CLOUD_BACKUP_AVAILABLE\s*=\s*false/.test(photoConsentSource) &&
    !/setCloudBackupEnabled/.test(photoConsentSource) &&
    !/getCloudBackupEnabled/.test(photoConsentSource) &&
    /key:\s*'onskin\.photos\.cloudBackup'[\s\S]*lifecycle:\s*'legacy_retained'[\s\S]*mode:\s*'read_only'[\s\S]*legacy_unavailable_cloud_backup_preference/m.test(
      localPrivateDataRegistrySource,
    ),
  'Unavailable photo cloud backup must have no runtime reader/setter and must retain its legacy preference only in the cleanup/export registry.',
);
block(
  errors,
  !/supabase\.from\(['"]photos['"]\)\.insert/.test(photoStoreSource) &&
    !/getCloudBackupEnabled/.test(photoStoreSource),
  'Local photo save must not automatically upload or mirror photo metadata.',
);
block(
  errors,
  /Progress photo storage/.test(photoSettingsSource) &&
    /Cloud backup is not available in this build/.test(photoSettingsSource) &&
    !/accessibilityLabel=['"]Encrypted cloud backup['"]/.test(photoSettingsSource) &&
    !/cloud_backup_opted_in/.test(photoSettingsSource),
  'Settings must show device-only photo storage without an actionable backup switch or event.',
);
block(
  errors,
  /reservePlaintextStaging\([\s\S]*'photo_share_png'[\s\S]*'photo_share_jpeg'/.test(
    encryptedPhotoSource,
  ) && /PLAINTEXT_STAGING_CACHE_UNAVAILABLE/.test(plaintextStagingSource),
  'Photo share export must reserve an owned plaintext operation and fail closed when cache storage is unavailable.',
);
block(
  errors,
  /createOperationId:\s*randomUUID/.test(plaintextStagingAdapterSource) &&
    /return `\$\{entry\.operationId\}\.\$\{extensionForPurpose\(entry\.purpose\)\}`/.test(
      plaintextStagingSource,
    ) &&
    photoShareFileSource.indexOf('await reservePlaintextStaging(') <
      photoShareFileSource.indexOf('const base64 = decryptEnvelopeToUtf8(envelope, key);') &&
    photoShareFileSource.indexOf('await reservePlaintextStaging(') !== -1,
  'Photo sharing must reserve a random opaque filename before decrypted image plaintext is created.',
);
block(
  errors,
  /stripImageMetadataFromBase64/.test(encryptedPhotoSource) &&
    /const strippedBase64 = stripImageMetadataFromBase64\(base64,\s*mimeType\)/.test(
      encryptedPhotoSource,
    ) &&
    /const strippedBase64 = stripImageMetadataFromBase64\(base64,\s*envelope\.mimeType\)/.test(
      encryptedPhotoSource,
    ),
  'Photo storage/share must strip image metadata before encrypting or exporting bytes.',
);
block(
  errors,
  /marker === 0xe1/.test(photoMetadataSource) &&
    /marker === 0xed/.test(photoMetadataSource) &&
    /marker === 0xfe/.test(photoMetadataSource) &&
    /PNG_METADATA_CHUNKS/.test(photoMetadataSource) &&
    /eXIf/.test(photoMetadataSource),
  'Photo metadata stripper must remove JPEG EXIF/IPTC/comment metadata and PNG EXIF/text metadata.',
);
block(
  errors,
  /export async function deletePhotoShareFile/.test(encryptedPhotoSource) &&
    /cleanupPlaintextStagingUri\(uri\)/.test(encryptedPhotoSource) &&
    /journal\.entries\.findIndex\(\(entry\) => uriForEntry\(entry\) === uri\)/.test(
      plaintextStagingSource,
    ),
  'Photo share cleanup must delete only a URI derived from an owned journal entry.',
);
block(
  errors,
  /sharePhotoImageOnly/.test(photoDetailSource) &&
    /runAccountGenerationOperation/.test(sharePhotoSource) &&
    /try\s*\{[\s\S]*createPhotoShareFile\(localUri\)[\s\S]*Sharing\.shareAsync\(shareUri\)[\s\S]*\}\s*finally\s*\{[\s\S]*deletePhotoShareFile\(shareUri,\s*localUri\)/.test(
      sharePhotoSource,
    ),
  'Photo detail share must hold the account boundary through share-sheet completion and clean the generated plaintext without deleting the source photo.',
);
block(
  errors,
  rootLayoutSource.indexOf('<SessionBoundaryGate>') <
    rootLayoutSource.indexOf('<PlaintextStagingStartupGate>') &&
    rootLayoutSource.indexOf('<PlaintextStagingStartupGate>') <
      rootLayoutSource.indexOf('<AppLockProvider>') &&
    /preparePrivateStorageForSession\(userId\)/.test(plaintextStagingStartupGateSource) &&
    privateStorageStartupSource.indexOf('await dependencies.recoverPhotos(lease);') <
      privateStorageStartupSource.indexOf('await dependencies.scavengePlaintext();') &&
    /if \(status === 'ready'\) return children;/.test(plaintextStagingStartupGateSource) &&
    !/\.catch\(\(\) => undefined\)/.test(plaintextStagingStartupGateSource),
  'Plaintext staging recovery must remain a fail-closed owner-bound gate before App Lock and app content.',
);
block(
  errors,
  !/Share with redaction/.test(photoDetailSource),
  'Photo detail share UI must not promise redaction unless redaction is implemented.',
);
block(
  errors,
  /sharePhotoImageOnly/.test(photoDetailSource),
  'Photo detail share helper must describe the current image-only behavior.',
);
block(
  errors,
  /const\s+\[\s*shareConfirmVisible,\s*setShareConfirmVisible\s*\]\s*=\s*useState\(false\)/.test(
    photoDetailSource,
  ) &&
    /function\s+confirmShare\(\)\s*\{[\s\S]*setShareConfirmVisible\(true\);[\s\S]*\}/.test(
      photoDetailSource,
    ) &&
    /onPress=\{confirmShare\}/.test(photoDetailSource) &&
    /\{shareConfirmVisible\s*\?\s*\(/.test(photoDetailSource) &&
    /PHOTO_COPY\.detail\.shareTitle/.test(photoDetailSource) &&
    /PHOTO_COPY\.detail\.shareBody/.test(photoDetailSource) &&
    /PHOTO_COPY\.detail\.shareConfirm/.test(photoDetailSource),
  'Photo detail share must show route-owned confirmation copy before exporting a progress photo.',
);
block(
  errors,
  /onPress=\{\(\)\s*=>\s*setShareConfirmVisible\(false\)\}/.test(photoDetailSource) &&
    /onPress=\{\(\)\s*=>\s*void\s+shareCurrentPhoto\(\)\}/.test(photoDetailSource) &&
    !/Alert\.alert\(PHOTO_COPY\.detail\.shareTitle/.test(photoDetailSource),
  'Photo detail share confirmation must offer cancel/confirm actions without native alerts.',
);
block(
  errors,
  /shareBody:\s*'[^']*not blurred[^']*notes are not included/.test(photoCopySource) &&
    /shareUnavailable/.test(photoCopySource),
  'Photo share confirmation copy must disclose that the image is not blurred and notes are not included.',
);
block(
  errors,
  /import\s+\{\s*BRAND\s*\}\s+from\s+'@\/lib\/brand'/.test(notificationCopySource) &&
    /LOCK_SCREEN_NOTIFICATION_TITLE\s*=\s*BRAND\.appName/.test(notificationCopySource) &&
    /function notificationContentForLockScreen/.test(notificationCopySource) &&
    /body:\s*c\.discreet/.test(notificationCopySource),
  'Notification lock-screen content must use the runtime app brand and discreet body helper.',
);
block(
  errors,
  /notificationContentForLockScreen\(kind\)/.test(notificationDeliverSource) &&
    /notificationContentForLockScreen\('capture'\)/.test(notificationDeliverSource) &&
    !/copyFor\(/.test(notificationDeliverSource) &&
    !/p\.lockscreenDiscreet/.test(notificationDeliverSource),
  'Notification delivery must never choose detailed copy based on lockscreenDiscreet.',
);
block(
  errors,
  /normalizeNotifPrefs/.test(notificationStoreSource) &&
    /export function normalizeNotifPrefs\([\s\S]*lockscreenDiscreet:\s*true,\s*\n\s*\};\s*\n\}/.test(
      notificationStoreSource,
    ) &&
    /normalizeNotifPatch/.test(notificationStoreSource) &&
    /patch\.lockscreenDiscreet\s*===\s*false/.test(notificationStoreSource),
  'Notification preferences must coerce legacy discretion-off values back to true.',
);
block(
  errors,
  !/onValueChange=\{\(v\)\s*=>\s*update\.mutate\(\{\s*lockscreenDiscreet:\s*v\s*\}\)\}/.test(
    notificationTimingSource,
  ) &&
    !/Showing routine detail/.test(notificationTimingSource) &&
    /Always generic on the lock screen/.test(notificationTimingSource),
  'Notification settings must not expose a switch that disables generic lock-screen copy.',
);
block(
  errors,
  /notification_preferences_lockscreen_discreet_true/.test(notificationLockscreenMigrationSource) &&
    /check\s*\(\s*lockscreen_discreet\s+is\s+true\s*\)/i.test(
      notificationLockscreenMigrationSource,
    ),
  'Notification lock-screen privacy migration must constrain lockscreen_discreet to true.',
);

for (const key of allowed) {
  block(
    errors,
    !sensitiveKey.test(key) || approvedBucketExceptions.has(key),
    `Sensitive analytics prop is allowlisted: ${key}.`,
  );
  block(
    errors,
    !retiredAnalyticsProps.has(key),
    `Retired sensitive analytics prop is allowlisted: ${key}.`,
  );
}

for (const file of listFiles('apps/mobile/src').filter(
  (item) =>
    /\.(ts|tsx)$/.test(item) &&
    !/\.(?:test|spec)\.(?:ts|tsx)$/.test(item) &&
    !item.replace(/\\/g, '/').includes('/__tests__/'),
)) {
  const text = read(file);
  const normalizedFile = file.replace(/\\/g, '/');
  if (!normalizedFile.endsWith('apps/mobile/src/lib/observability/safeLog.ts')) {
    const rawConsoleError = text.match(
      /console\.(warn|error|log)\([^;\n]*(error|err|exception)\b/i,
    );
    block(
      errors,
      !rawConsoleError,
      `Raw exception object may be logged to console in ${file.replace(abs('.'), '.')}.`,
    );
  }
}

warn(
  warnings,
  evidenceFlagEnabled(process.env.PHASE9_OBSERVABILITY_PAYLOAD_PASS),
  'Missing live Sentry/PostHog payload sample approval: PHASE9_OBSERVABILITY_PAYLOAD_PASS=true.',
);

printResult('Phase 9 privacy payload audit', errors, warnings);
