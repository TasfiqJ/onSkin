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
import { AGE_POLICY_RECEIPT_KEY } from '@/features/onboarding/ageGate';

export const LOCAL_PRIVATE_DATA_KEYS = [
  AGE_POLICY_RECEIPT_KEY,
  'layerwell.appLock.enabled',
  'layerwell.ask.consent.v1',
  'layerwell.ask.groundedTurns.v1',
  'layerwell.catalog.lookupQueue.v1',
  'layerwell.commerceConsent.v1',
  'layerwell.community.reactions.v1',
  'layerwell.communityAge16.v1',
  'layerwell.communityConsent.v1',
  'layerwell.completions.firstCompletion.v1',
  'layerwell.completions.pending',
  'layerwell.completions.v1',
  'layerwell.conflict.overrides',
  'layerwell.cycle.v1',
  'layerwell.cycleAnchor',
  'layerwell.entitlement.v1',
  'layerwell.entitlement.v2',
  'layerwell.healthDataCollectionConsent.v1',
  'layerwell.milestones.v1',
  'layerwell.notifPrefs.v1',
  'layerwell.notiflog.v1',
  'layerwell.photos.captureConsent',
  'layerwell.photos.captureConsent.v1',
  'layerwell.photos.cloudBackup',
  'layerwell.photos.v1',
  'layerwell.ramp.v1',
  'layerwell.recDismissed.v1',
  'layerwell.recPrefs.v1',
  'layerwell.reviewPrompt.v1',
  'layerwell.cycle.v2',
  'layerwell.healthDataLifecycle.v1',
  'layerwell.routineActivation.v1',
  'layerwell.routineOrder.v1',
  'layerwell.widgetActionMap.v1',
  'layerwell.widgetActionMap.v2',
  'layerwell.widgetOwnerAuthority.v1',
  'layerwell.shelf.v1',
  'layerwell.skinprofile.v1',
  'layerwell.subscription.freeConflictCheckRuleIds.v1',
  'layerwell.subscription.promptedExpiry',
  'layerwell.trendInsights.v1',
  'layerwell.trendState.v1',
] as const;

export const LOCAL_PRIVATE_SECURE_STORE_KEYS = [
  'layerwell.photo.content_key.v1',
  'layerwell.private_kv.content_key.v1',
] as const;

// Survives ordinary account-boundary cleanup until the capability-only status
// endpoint proves terminal deletion and the local completion is committed.
export const LOCAL_PRIVATE_SECURE_CONTROL_KEYS = [
  'layerwell.account_deletion.pending.v1',
  'layerwell.health_data_withdrawal.pending.v1',
] as const;

export const LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES = [
  HEALTH_DEPENDENT_CONSENT_RECOVERY_KEY_PREFIX,
] as const;

export const LOCAL_PRIVATE_METADATA_KEYS = [
  'layerwell.photo.content_key_created.v1',
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
  'layerwell.store_transaction_notice.v2',
] as const;

export const LOCAL_PRIVATE_CACHE_FILENAMES = ['layerwell-export.json'] as const;

export const CURRENT_LOCAL_PRIVATE_CACHE_PREFIXES = [
  'layerwell-export-',
  'layerwell-share-',
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
