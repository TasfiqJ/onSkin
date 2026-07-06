#!/usr/bin/env node
import { abs, block, listFiles, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];

const registrySource = read('apps/mobile/src/lib/analytics/eventRegistry.ts');
const trackSource = read('apps/mobile/src/lib/analytics/track.ts');
const sentrySource = read('apps/mobile/src/lib/observability/sentry.ts');
const scrubSource = read('apps/mobile/src/lib/observability/scrub.ts');
const safeLogSource = read('apps/mobile/src/lib/observability/safeLog.ts');
const authProviderSource = read('apps/mobile/src/lib/auth/AuthProvider.tsx');
const localPrivateDataSource = read('apps/mobile/src/features/settings/localPrivateData.ts');
const revenueCatSource = read('apps/mobile/src/lib/iap/revenuecat.ts');
const shareCardSource = read('apps/mobile/src/features/growth/shareCard.ts');
const encryptedPhotoSource = read('apps/mobile/src/features/photos/encryptedStorage.ts');
const sharePhotoSource = read('apps/mobile/src/features/photos/sharePhoto.ts');
const photoMetadataSource = read('apps/mobile/src/features/photos/metadata.ts');
const photoDetailSource = read('apps/mobile/src/app/progress/[id].tsx');
const photoCopySource = read('apps/mobile/src/features/photos/copy.ts');
const notificationCopySource = read('apps/mobile/src/features/notifications/copy.ts');
const notificationDeliverSource = read('apps/mobile/src/features/notifications/deliver.ts');
const notificationStoreSource = read('apps/mobile/src/features/notifications/store.ts');
const notificationTimingSource = read('apps/mobile/src/app/settings/timing.tsx');
const notificationLockscreenMigrationSource = read('supabase/migrations/20260705000033_phase9_notification_lock_screen_privacy.sql');

const eventRegistryBody = registrySource.match(/ANALYTICS_ALLOWED_EVENTS\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? '';
const allowedEvents = new Set([...eventRegistryBody.matchAll(/'([^']+)'/g)].map((match) => match[1]));
const registryBody = registrySource.match(/ANALYTICS_ALLOWED_PROP_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? '';
const allowed = new Set([...registryBody.matchAll(/'([^']+)'/g)].map((match) => match[1]));
const sensitiveKey =
  /(barcode(?!_type)|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|rule_id|content_id|question_id|id$|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|(^|_)age($|_)|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide|dspt|fitzpatrick|monk|axis|step|score|slug)/i;
const retiredAnalyticsProps = new Set(['intent', 'product_type', 'trigger']);
const approvedBucketExceptions = new Set(['barcode_type', 'native_ocr_enabled', 'screen_name', 'share_id']);

block(errors, allowed.size > 0, 'Analytics event registry is empty or missing.');
block(errors, allowedEvents.size > 0, 'Analytics event-name registry is empty or missing.');
block(errors, /isAllowedAnalyticsEventName/.test(trackSource), 'Analytics event names must use the allowlist gate.');
block(errors, /sanitizeAnalyticsEventName/.test(trackSource), 'Analytics tracker must sanitize event names before vendor capture.');
block(errors, /posthog\?\.capture\(safeEvent,\s*safeProps\)/.test(trackSource), 'PostHog capture must use the sanitized event name.');
block(errors, !/posthog\?\.capture\(event/.test(trackSource), 'PostHog capture must not receive the raw event name.');
block(errors, /isAllowedAnalyticsPropKey/.test(trackSource), 'Analytics sanitizer must call isAllowedAnalyticsPropKey.');
block(errors, /SENSITIVE_ANALYTICS_KEY/.test(trackSource), 'Analytics sanitizer is missing sensitive-key guard.');
block(errors, /SENSITIVE_ANALYTICS_VALUE/.test(trackSource), 'Analytics sanitizer is missing sensitive-value guard.');
block(errors, /SENSITIVE_ANALYTICS_VALUE\.test\(trimmed\)/.test(trackSource), 'Analytics sanitizer must check trimmed string values against the sensitive-value guard.');
block(errors, /https\?:\\\/\\\//.test(trackSource) && /token\|jwt\|secret\|signed_url/.test(trackSource), 'Analytics sensitive-value guard must block URLs and token-like strings.');
block(errors, /MAX_SAFE_ANALYTICS_INTEGER/.test(trackSource), 'Analytics sanitizer must cap numeric prop values.');
block(errors, /Number\.isSafeInteger\(value\)/.test(trackSource), 'Analytics sanitizer must drop non-integer numeric prop values.');
block(errors, !/value\s+instanceof\s+Date/.test(trackSource), 'Analytics sanitizer must drop Date props instead of serializing precise timestamps.');
block(errors, /pseudonymousUserId/.test(trackSource), 'Analytics identify must pseudonymize raw user IDs before vendor calls.');
block(errors, /posthog\?\.identify\(pseudonymousId/.test(trackSource), 'PostHog identify must use a pseudonymous user ID.');
block(errors, /captureAppLifecycleEvents:\s*false/.test(trackSource), 'PostHog automatic lifecycle capture must stay disabled.');
block(errors, /enableSessionReplay:\s*false/.test(trackSource), 'PostHog session replay must stay disabled.');
block(errors, /sanitizeObservabilityContext/.test(sentrySource), 'Sentry captureException must sanitize context.');
block(errors, /sanitizeCapturedException/.test(sentrySource), 'Sentry captureException must sanitize the captured throwable.');
block(errors, !/Sentry\.captureException\(error/.test(sentrySource), 'Sentry captureException must not send the raw throwable to Sentry.');
block(errors, /pseudonymousUserId/.test(sentrySource), 'Sentry setUser must pseudonymize raw user IDs before vendor calls.');
block(errors, /sendDefaultPii:\s*false/.test(sentrySource), 'Sentry default PII capture must stay disabled.');
block(errors, /tracesSampleRate:\s*0/.test(sentrySource), 'Sentry performance tracing must stay disabled.');
block(errors, /enableCaptureFailedRequests:\s*false/.test(sentrySource), 'Sentry failed-request capture must stay disabled.');
block(errors, /attachScreenshot:\s*false/.test(sentrySource), 'Sentry screenshot attachments must stay disabled.');
block(errors, /attachViewHierarchy:\s*false/.test(sentrySource), 'Sentry view hierarchy attachments must stay disabled.');
block(errors, /maxBreadcrumbs:\s*0/.test(sentrySource), 'Sentry breadcrumbs must stay disabled.');
block(errors, /beforeBreadcrumb:\s*\(\)\s*=>\s*null/.test(sentrySource), 'Sentry breadcrumbs must be dropped before capture.');
block(errors, /beforeSend:\s*sanitizeSentryEvent/.test(sentrySource), 'Sentry events must pass through the global sanitizer before upload.');
block(
  errors,
  /request:\s*undefined/.test(sentrySource) &&
    /breadcrumbs:\s*undefined/.test(sentrySource) &&
    /contexts:\s*undefined/.test(sentrySource) &&
    /fingerprint:\s*undefined/.test(sentrySource) &&
    /transaction:\s*undefined/.test(sentrySource) &&
    /debug_meta:\s*undefined/.test(sentrySource) &&
    /logentry:\s*undefined/.test(sentrySource) &&
    /measurements:\s*undefined/.test(sentrySource) &&
    /modules:\s*undefined/.test(sentrySource) &&
    /sdkProcessingMetadata:\s*undefined/.test(sentrySource) &&
    /server_name:\s*undefined/.test(sentrySource) &&
    /spans:\s*undefined/.test(sentrySource) &&
    /threads:\s*undefined/.test(sentrySource) &&
    /transaction_info:\s*undefined/.test(sentrySource),
  'Sentry global sanitizer must drop request, breadcrumb, context, fingerprint, transaction, and diagnostic metadata fields.',
);
block(errors, /SENSITIVE_CONTEXT_KEY/.test(scrubSource), 'Sentry scrubber is missing sensitive-key guard.');
block(errors, /SENSITIVE_VALUE/.test(scrubSource), 'Sentry scrubber is missing sensitive-value guard.');
block(errors, /MAX_SAFE_CONTEXT_INTEGER/.test(scrubSource), 'Sentry scrubber must cap numeric context values.');
block(errors, /Number\.isSafeInteger\(value\)/.test(scrubSource), 'Sentry scrubber must drop non-integer numeric context values.');
block(errors, !/value\s+instanceof\s+Date/.test(scrubSource), 'Sentry scrubber must drop Date context values instead of serializing precise timestamps.');
block(errors, /sanitizeCapturedException/.test(scrubSource), 'Sentry scrubber must expose a captured-exception sanitizer.');
block(errors, /route|query|url|receipt|ocr|barcode|free_text/i.test(scrubSource), 'Sentry scrubber must explicitly cover route/query/url/receipt/OCR/barcode/free text.');
block(errors, /redactedErrorForLog/.test(safeLogSource), 'Mobile dev logging must use a redacted error helper.');
block(errors, !/\.message|\.stack/.test(safeLogSource), 'Mobile dev logging redaction must not include exception message or stack.');
block(errors, /devWarn/.test(trackSource), 'Analytics dev warnings must not log raw exception objects.');
block(errors, /devWarn/.test(sentrySource), 'Sentry dev warnings must not log raw exception objects.');
block(errors, /devWarn/.test(authProviderSource), 'RevenueCat setup warnings must not log raw exception objects.');
block(errors, !/console\.log\(/.test(trackSource), 'Analytics tracking must not log events or props to the dev console.');
block(
  errors,
  /export async function resetAnalyticsIdentity/.test(trackSource) &&
    /posthog\?\.reset\(\)/.test(trackSource),
  'PostHog client identity must expose an account-boundary reset.',
);
block(
  errors,
  /export async function resetRevenueCatIdentity/.test(revenueCatSource) &&
    /await Purchases\.logOut\(\)/.test(revenueCatSource) &&
    /configuredForUserId = null/.test(revenueCatSource) &&
    /cachedOfferings = null/.test(revenueCatSource),
  'RevenueCat client identity reset must log out and clear cached account/offering state.',
);
block(
  errors,
  /resetAnalyticsIdentity\(\)/.test(localPrivateDataSource) &&
    /resetRevenueCatIdentity\(\)/.test(localPrivateDataSource),
  'Local private-data cleanup must reset PostHog and RevenueCat client identities.',
);
block(errors, /result:\s*'tmpfile'/.test(shareCardSource), 'Share-card export must keep using an OS tmpfile capture result.');
block(
  errors,
  /try\s*\{[\s\S]*Sharing\.isAvailableAsync\(\)[\s\S]*Sharing\.shareAsync\(uri[\s\S]*return true;[\s\S]*\}\s*finally\s*\{[\s\S]*FileSystem\.deleteAsync\(uri,\s*\{\s*idempotent:\s*true\s*\}\)\.catch\(\(\)\s*=>\s*\{\}\)/.test(
    shareCardSource,
  ),
  'Share-card export must delete its generated tmpfile after the share attempt.',
);
block(errors, /PHOTO_SHARE_CACHE_UNAVAILABLE/.test(encryptedPhotoSource), 'Photo share export must fail closed when cacheDirectory is unavailable.');
block(errors, /safePhotoShareId/.test(encryptedPhotoSource), 'Photo share export filenames must sanitize local photo IDs.');
block(errors, /onskin-share-\$\{safePhotoShareId\(photoId\)\}-\$\{Date\.now\(\)\}/.test(encryptedPhotoSource), 'Photo share export must use a unique generated cache filename.');
block(
  errors,
  /stripImageMetadataFromBase64/.test(encryptedPhotoSource) &&
    /const strippedBase64 = stripImageMetadataFromBase64\(base64,\s*mimeType\)/.test(encryptedPhotoSource) &&
    /const strippedBase64 = stripImageMetadataFromBase64\(base64,\s*envelope\.mimeType\)/.test(encryptedPhotoSource),
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
    /uri\.startsWith\(`\$\{cacheDirectory\}onskin-share-`\)/.test(encryptedPhotoSource) &&
    /FileSystem\.deleteAsync\(uri,\s*\{\s*idempotent:\s*true\s*\}\)\.catch\(\(\)\s*=>\s*\{\}\)/.test(
      encryptedPhotoSource,
    ),
  'Photo share export must expose a scoped cache cleanup helper.',
);
block(
  errors,
  /sharePhotoImageOnly/.test(photoDetailSource) &&
    /try\s*\{[\s\S]*createPhotoShareFile\(photo\.localUri,\s*photo\.id\)[\s\S]*Sharing\.shareAsync\(shareUri\)[\s\S]*\}\s*finally\s*\{[\s\S]*deletePhotoShareFile\(shareUri,\s*photo\.localUri\)/.test(
      sharePhotoSource,
    ),
  'Photo detail share must delete generated decrypted share files without deleting the source photo URI.',
);
block(errors, !/Share with redaction/.test(photoDetailSource), 'Photo detail share UI must not promise redaction unless redaction is implemented.');
block(errors, /sharePhotoImageOnly/.test(photoDetailSource), 'Photo detail share helper must describe the current image-only behavior.');
block(
  errors,
  /confirmShare/.test(photoDetailSource) &&
    /Alert\.alert\(PHOTO_COPY\.detail\.shareTitle,\s*PHOTO_COPY\.detail\.shareBody/.test(photoDetailSource) &&
    /PHOTO_COPY\.detail\.shareConfirm/.test(photoDetailSource),
  'Photo detail share must require explicit confirmation before exporting a progress photo.',
);
block(
  errors,
  /shareBody:\s*'[^']*not blurred[^']*notes are not included/.test(photoCopySource) &&
    /shareUnavailable/.test(photoCopySource),
  'Photo share confirmation copy must disclose that the image is not blurred and notes are not included.',
);
block(
  errors,
  /LOCK_SCREEN_NOTIFICATION_TITLE\s*=\s*'OnSkin'/.test(notificationCopySource) &&
    /function notificationContentForLockScreen/.test(notificationCopySource) &&
    /body:\s*c\.discreet/.test(notificationCopySource),
  'Notification lock-screen content must use the generic title and discreet body helper.',
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
    /\.\.\.prefs,\s*lockscreenDiscreet:\s*true/.test(notificationStoreSource) &&
    /normalizeNotifPatch/.test(notificationStoreSource) &&
    /patch\.lockscreenDiscreet\s*===\s*false/.test(notificationStoreSource),
  'Notification preferences must coerce legacy discretion-off values back to true.',
);
block(
  errors,
  !/onValueChange=\{\(v\)\s*=>\s*update\.mutate\(\{\s*lockscreenDiscreet:\s*v\s*\}\)\}/.test(notificationTimingSource) &&
    !/Showing routine detail/.test(notificationTimingSource) &&
    /Always generic on the lock screen/.test(notificationTimingSource),
  'Notification settings must not expose a switch that disables generic lock-screen copy.',
);
block(
  errors,
  /notification_preferences_lockscreen_discreet_true/.test(notificationLockscreenMigrationSource) &&
    /check\s*\(\s*lockscreen_discreet\s+is\s+true\s*\)/i.test(notificationLockscreenMigrationSource),
  'Notification lock-screen privacy migration must constrain lockscreen_discreet to true.',
);

for (const key of allowed) {
  block(errors, !sensitiveKey.test(key) || approvedBucketExceptions.has(key), `Sensitive analytics prop is allowlisted: ${key}.`);
  block(errors, !retiredAnalyticsProps.has(key), `Retired sensitive analytics prop is allowlisted: ${key}.`);
}

const seenDropped = new Set();
function objectFromTrackSnippet(snippet) {
  const start = snippet.indexOf('{');
  if (start === -1) return '';
  let depth = 0;
  for (let index = start; index < snippet.length; index += 1) {
    const char = snippet[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return snippet.slice(start + 1, index);
  }
  return '';
}

function stripJsComments(source) {
  let out = '';
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        out += char;
      }
      continue;
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      out += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      out += char;
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }

    out += char;
  }

  return out;
}

function maskJsStrings(source) {
  let out = '';
  let quote = null;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      out += char === '\n' ? char : ' ';
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      out += ' ';
      continue;
    }

    out += char;
  }

  return out;
}

function trackPayloadKeys(objectLiteral) {
  const masked = maskJsStrings(stripJsComments(objectLiteral));
  const keys = new Set();
  for (const keyMatch of masked.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g)) {
    keys.add(keyMatch[1]);
  }
  for (const shorthandMatch of masked.matchAll(/(?:^|[,{]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(?=\s*(?:,|$))/g)) {
    keys.add(shorthandMatch[1]);
  }
  return keys;
}

for (const file of listFiles('apps/mobile/src').filter((item) => /\.(ts|tsx)$/.test(item) && !item.endsWith('.test.ts'))) {
  const text = read(file);
  const normalizedFile = file.replace(/\\/g, '/');
  if (!normalizedFile.endsWith('apps/mobile/src/lib/observability/safeLog.ts')) {
    const rawConsoleError = text.match(/console\.(warn|error|log)\([^;\n]*(error|err|exception)\b/i);
    block(errors, !rawConsoleError, `Raw exception object may be logged to console in ${file.replace(abs('.'), '.')}.`);
  }
  const lines = text.split(/\r?\n/);
  const scanTrackCalls = !normalizedFile.endsWith('apps/mobile/src/lib/analytics/track.ts');
  for (let index = 0; scanTrackCalls && index < lines.length; index += 1) {
    if (!/\btrack\(/.test(lines[index])) continue;
    const eventMatch = lines[index].match(/\btrack\(\s*(['"])([^'"]+)\1/);
    block(
      errors,
      Boolean(eventMatch),
      `Analytics track call must use a literal event name: ${file.replace(abs('.'), '.')}:${index + 1}.`,
    );
    if (eventMatch) {
      block(
        errors,
        allowedEvents.has(eventMatch[2]),
        `Analytics track event is not allowlisted: ${file.replace(abs('.'), '.')} -> ${eventMatch[2]}.`,
      );
    }

    let snippet = lines[index];
    for (let next = index + 1; next < Math.min(lines.length, index + 12) && !/\);/.test(snippet); next += 1) {
      snippet += `\n${lines[next]}`;
    }
    const objectLiteral = objectFromTrackSnippet(snippet);
    if (!objectLiteral) continue;
    for (const key of trackPayloadKeys(objectLiteral)) {
      if (retiredAnalyticsProps.has(key)) {
        block(errors, false, `Retired sensitive analytics prop used in track payload: ${file.replace(abs('.'), '.')} -> ${key}.`);
      } else if (sensitiveKey.test(key) && !approvedBucketExceptions.has(key)) {
        block(errors, false, `Sensitive analytics prop used in track payload: ${file.replace(abs('.'), '.')} -> ${key}.`);
      } else if (!allowed.has(key)) {
        seenDropped.add(`${file.replace(abs('.'), '.')} -> ${key}`);
      }
    }
  }
}

for (const item of [...seenDropped].sort()) {
  warn(warnings, false, `Track prop is not approved and will be dropped by sanitizer: ${item}.`);
}

warn(warnings, process.env.PHASE9_OBSERVABILITY_PAYLOAD_PASS === 'true', 'Missing live Sentry/PostHog payload sample approval: PHASE9_OBSERVABILITY_PAYLOAD_PASS=true.');

printResult('Phase 9 privacy payload audit', errors, warnings);
