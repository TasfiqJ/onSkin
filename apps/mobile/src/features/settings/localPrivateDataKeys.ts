import {
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
} from '@/lib/auth/sessionOwnerKey';
import { ACCOUNT_DELETION_VENDOR_FREEZE_KEY } from '@/lib/auth/accountDeletionVendorFreezeKey';
import { brandCachePrefix } from '@/lib/brand';
import { PLAINTEXT_STAGING_JOURNAL_KEY } from '@/lib/storage/plaintextStagingCore';

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
  'routinekind.routineActivation.v1',
  'routinekind.routineOrder.v1',
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

export const LOCAL_PRIVATE_METADATA_KEYS = [
  'onskin.photo.content_key_created.v1',
  LOCAL_DATA_OWNER_HASH_KEY,
] as const;

// Survive partial cleanup so the next launch must retry before data can mount.
export const LOCAL_PRIVATE_CONTROL_KEYS = [
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  ACCOUNT_DELETION_VENDOR_FREEZE_KEY,
  PLAINTEXT_STAGING_JOURNAL_KEY,
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
