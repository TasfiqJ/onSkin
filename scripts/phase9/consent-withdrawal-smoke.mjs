#!/usr/bin/env node
import { block, evidenceFlagEnabled, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];
const packageJson = JSON.parse(read('package.json'));

const settings = read('apps/mobile/src/features/settings/actions.ts');
const you = read('apps/mobile/src/app/(tabs)/you.tsx');
const trend = read('apps/mobile/src/features/trend/consent.ts');
const community = read('apps/mobile/src/features/community/consent.ts');
const commerce = read('apps/mobile/src/features/commerce/consent.ts');
const ask = read('apps/mobile/src/features/ask/consent.ts');
const photoConsent = read('apps/mobile/src/features/photos/consent.ts');
const withdrawalClient = read('apps/mobile/src/lib/consent/withdrawal.ts');
const edgeFunction = read('supabase/functions/consent-withdrawal/index.ts');
const storagePathHelper = read('supabase/functions/_shared/storagePath.ts');
const storagePathHelperTest = read('supabase/functions/_shared/storagePath.test.ts');
const liveHarness = read('scripts/phase9/live-consent-withdrawal.mjs');
const migrations =
  read('supabase/migrations/20260613000023_community.sql') +
  read('supabase/migrations/20260614000025_ask_onskin.sql');
const phase9ConsentMigration = read(
  'supabase/migrations/20260705000032_phase9_consent_withdrawal.sql',
);

block(
  errors,
  /withdrawHealthDataConsent/.test(settings),
  'Health-data consent withdrawal action is missing.',
);
block(
  errors,
  /granted:\s*false/.test(settings) && /deleteAccount/.test(settings),
  'Health-data withdrawal must record false consent and delete account data.',
);
block(
  errors,
  /recordConsent/.test(you) && /granted/.test(you) && /setCommerceConsentLocal/.test(you),
  'Settings consent toggles must record ledger rows and sync commerce local flag.',
);

block(
  errors,
  /revokeTrendInsightsConsent/.test(trend),
  'Trend consent revocation function is missing.',
);
block(
  errors,
  /deleteTrendState/.test(trend),
  'Trend consent revocation must delete local trend state.',
);
block(
  errors,
  /photo_trend_insights/.test(trend) && /withdrawConsent/.test(trend),
  'Trend consent revocation must call the server withdrawal path.',
);

block(
  errors,
  /withdrawCommunityConsent/.test(community),
  'Community consent withdrawal function is missing.',
);
block(
  errors,
  /community_participation/.test(community) && /withdrawConsent/.test(community),
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
  /declineCommerceConsent/.test(commerce) && /setCommerceConsentLocal\(false\)/.test(commerce),
  'Commerce decline must relock local paid-link affordance.',
);
block(
  errors,
  /declineCommerceConsent/.test(commerce) && /withdrawConsent/.test(commerce),
  'Commerce consent withdrawal must call the server withdrawal path.',
);

block(errors, /revokeAskConsent/.test(ask), 'Ask consent revocation function is missing.');
block(errors, /clearAskStore/.test(ask), 'Ask consent revocation must clear local Ask state.');
block(
  errors,
  /ask_onskin/.test(ask) && /withdrawConsent/.test(ask),
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
    /case 'photo_cloud_backup':\s*return withdrawPhotoCloudBackup/.test(edgeFunction),
  'Unavailable cloud backup must expose no grant setter, clear stale local preference, and retain server-side legacy cleanup.',
);

block(
  errors,
  /supabase\.functions\.invoke\('consent-withdrawal'/.test(withdrawalClient),
  'Mobile withdrawal helper must invoke consent-withdrawal.',
);
block(
  errors,
  /CryptoDigestAlgorithm\.SHA256/.test(withdrawalClient),
  'Mobile withdrawal helper must send a SHA-256 consent text hash.',
);

block(
  errors,
  /auth\.getUser\(token\)/.test(edgeFunction),
  'consent-withdrawal must validate the caller JWT.',
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
    edgeFunction.indexOf('auth.getUser(token)') !== -1 &&
    edgeFunction.indexOf("req.method !== 'POST'") < edgeFunction.indexOf('auth.getUser(token)'),
  'consent-withdrawal method check must run before caller auth resolution.',
);
block(
  errors,
  /allowedBodyKeys/.test(edgeFunction) && /INVALID_BODY/.test(edgeFunction),
  'consent-withdrawal must reject unknown or invalid body fields.',
);
block(
  errors,
  /granted:\s*false/.test(edgeFunction) && /revoked_at/.test(edgeFunction),
  'consent-withdrawal must append a false consent ledger row.',
);
block(
  errors,
  /withdrawPhotoCloudBackup/.test(edgeFunction) &&
    /photoPathBelongsToUser/.test(edgeFunction) &&
    /storage\.from\('photos'\)\.remove/.test(edgeFunction),
  'Photo cloud withdrawal must remove only caller-owned storage paths.',
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
  /local_only:\s*true/.test(edgeFunction) && /storage_path:\s*null/.test(edgeFunction),
  'Photo cloud withdrawal must relocalize photo metadata.',
);
block(
  errors,
  /withdrawAskOnSkin/.test(edgeFunction) && /ask_safety_audit/.test(edgeFunction),
  'Ask withdrawal must delete server-side safety audit content.',
);
block(
  errors,
  /withdrawTrendInsights/.test(edgeFunction) && /photo_trend/.test(edgeFunction),
  'Trend withdrawal must delete server-side trend rows.',
);
block(
  errors,
  /withdrawCommunityParticipation/.test(edgeFunction) &&
    /community_questions/.test(edgeFunction) &&
    /community_reactions/.test(edgeFunction),
  'Community withdrawal must delete user community questions and reactions.',
);
block(
  errors,
  /withdrawDataSharing/.test(edgeFunction) &&
    /order_attributions/.test(edgeFunction) &&
    /commerce_click_events/.test(edgeFunction),
  'Data-sharing withdrawal must detach order attributions and delete commerce clicks.',
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
    /PHASE9_ALLOW_PRODUCTION_LIVE_CONSENT_WITHDRAWAL/.test(liveHarness) &&
    /docs\/phase-9\/generated\/live-consent-withdrawal\.json/.test(liveHarness),
  'Live consent-withdrawal harness must be explicit-flagged, production-guarded, and write evidence artifacts.',
);
block(
  errors,
  /photo_cloud_backup withdrawal relocalizes metadata and removes owned storage object/.test(
    liveHarness,
  ) &&
    /ask_onskin withdrawal deletes server-side safety audit content only/.test(liveHarness) &&
    /photo_trend_insights withdrawal deletes trend rows/.test(liveHarness) &&
    /community_participation withdrawal deletes user community rows/.test(liveHarness) &&
    /data_sharing withdrawal detaches order links and deletes commerce clicks/.test(liveHarness),
  'Live consent-withdrawal harness must cover photo, Ask, trend, community, and commerce cleanup.',
);
block(
  errors,
  /expectRevocationRecorded/.test(liveHarness) &&
    /consentTextHash/.test(liveHarness) &&
    /cloud photo object was still downloadable/.test(liveHarness) &&
    /order\.click_token === null/.test(liveHarness),
  'Live consent-withdrawal harness must prove false ledger rows, storage removal, and commerce detachment.',
);

for (const [type, policy] of [
  ['photo_cloud_backup', 'photos_cloud_backup_consent_insert'],
  ['data_sharing', 'commerce_click_events_consent_insert'],
  ['photo_trend_insights', 'photo_trend_consent_insert'],
  ['community_participation', 'community_reactions_consent_insert'],
  ['ask_onskin', 'ask_sessions_consent_insert'],
]) {
  block(
    errors,
    phase9ConsentMigration.includes(`has_current_consent('${type}')`) &&
      phase9ConsentMigration.includes(policy),
    `RLS must enforce current ${type} consent for sensitive writes.`,
  );
}

warn(
  warnings,
  evidenceFlagEnabled(process.env.PHASE9_CONSENT_WITHDRAWAL_PASS),
  'Missing live consent-withdrawal evidence: PHASE9_CONSENT_WITHDRAWAL_PASS=true.',
);

printResult('Phase 9 consent withdrawal smoke', errors, warnings);
