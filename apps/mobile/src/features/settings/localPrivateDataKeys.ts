import {
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
  LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
  LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
} from '@/lib/auth/sessionOwnerKey';
import { AUTH_DERIVED_CLEANUP_REQUIRED_KEY } from '@/lib/auth/authDerivedCleanupRequired';
import { APPLE_CREDENTIAL_QUARANTINE_KEY } from '@/lib/auth/appleCredentialQuarantine';
import { brandCachePrefix } from '@/lib/brand';
import { HEALTH_DEPENDENT_CONSENT_RECOVERY_KEY_PREFIX } from '@/lib/consent/dependentConsentRecoveryContract';
import {
  LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY,
  PLAINTEXT_STAGING_JOURNAL_KEY,
} from '@/lib/storage/plaintextStagingCore';

export const LOCAL_PRIVATE_DATA_KEYS = [
  'onskin.ageVerified',
  'onskin.appLock.enabled',
  'onskin.ask.consent.v1',
  'onskin.ask.groundedTurns.v1',
  'onskin.commerceConsent.v1',
  'onskin.community.reactions.v1',
  'onskin.communityAge16.v1',
  'onskin.communityConsent.v1',
  'onskin.completions.firstCompletion.v1',
  'onskin.completions.pending',
  'onskin.completions.v1',
  'onskin.conflict.overrides',
  'onskin.cycle.v1',
  'onskin.cycleAnchor',
  'onskin.entitlement.v1',
  'onskin.entitlement.v2',
  'onskin.healthDataCollectionConsent.v1',
  'onskin.milestones.v1',
  'onskin.notifPrefs.v1',
  'onskin.notiflog.v1',
  'onskin.photos.captureConsent',
  'onskin.photos.captureConsent.v1',
  'onskin.photos.cloudBackup',
  'onskin.photos.v1',
  'onskin.ramp.v1',
  'onskin.recDismissed.v1',
  'onskin.recPrefs.v1',
  'onskin.reviewPrompt.v1',
  'routinekind.cycle.v2',
  'routinekind.healthDataLifecycle.v1',
  'routinekind.routineActivation.v1',
  'routinekind.routineOrder.v1',
  'routinekind.widgetActionMap.v1',
  'onskin.shelf.v1',
  'onskin.skinprofile.v1',
  'onskin.subscription.freeConflictCheckRuleIds.v1',
  'onskin.subscription.promptedExpiry',
  'onskin.trendInsights.v1',
  'onskin.trendState.v1',
] as const;

export const LOCAL_PRIVATE_SECURE_STORE_KEYS = [
  'onskin.photo.content_key.v1',
  'onskin.private_kv.content_key.v1',
] as const;

// Survives ordinary account-boundary cleanup until the capability-only status
// endpoint proves terminal deletion and the local completion is committed.
export const LOCAL_PRIVATE_SECURE_CONTROL_KEYS = [
  'routinekind.account_deletion.pending.v1',
  'routinekind.health_data_withdrawal.pending.v1',
] as const;

export const LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES = [
  HEALTH_DEPENDENT_CONSENT_RECOVERY_KEY_PREFIX,
] as const;

export const LOCAL_PRIVATE_METADATA_KEYS = [
  'onskin.photo.content_key_created.v1',
  LOCAL_DATA_OWNER_HASH_KEY,
  LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
  LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
] as const;

// Survive partial cleanup so the next launch must retry before data can mount.
export const LOCAL_PRIVATE_CONTROL_KEYS = [
  APPLE_CREDENTIAL_QUARANTINE_KEY,
  AUTH_DERIVED_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  PLAINTEXT_STAGING_JOURNAL_KEY,
  LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY,
  // Device-global purchase admission remains closed across sign-out/account
  // cleanup until the exact owner completes an authenticated Restore check.
  'routinekind.store_transaction_notice.v2',
] as const;

export const LOCAL_PRIVATE_CACHE_FILENAMES = ['onskin-export.json'] as const;

export const CURRENT_LOCAL_PRIVATE_CACHE_PREFIXES = [
  'routinekind-export-',
  'routinekind-share-',
] as const;

export const LEGACY_LOCAL_PRIVATE_CACHE_PREFIXES = ['onskin-export-', 'onskin-share-'] as const;

export const LOCAL_PRIVATE_CACHE_PREFIXES = [
  ...CURRENT_LOCAL_PRIVATE_CACHE_PREFIXES,
  ...LEGACY_LOCAL_PRIVATE_CACHE_PREFIXES,
] as const;

export function localPrivateCachePrefixes(): readonly string[] {
  return [
    ...new Set([
      ...LOCAL_PRIVATE_CACHE_PREFIXES,
      brandCachePrefix('export'),
      brandCachePrefix('share'),
    ]),
  ];
}
