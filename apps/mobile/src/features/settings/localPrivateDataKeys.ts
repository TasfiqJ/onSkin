export const LOCAL_PRIVATE_DATA_KEYS = [
  'onskin.ageVerified',
  'onskin.appLock.enabled',
  'onskin.ask.consent.v1',
  'onskin.ask.groundedTurns.v1',
  'onskin.commerceConsent.v1',
  'onskin.community.reactions.v1',
  'onskin.communityAge16.v1',
  'onskin.communityConsent.v1',
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
  'onskin.photos.cloudBackup',
  'onskin.photos.v1',
  'onskin.ramp.v1',
  'onskin.recDismissed.v1',
  'onskin.recPrefs.v1',
  'onskin.reviewPrompt.v1',
  'onskin.routineActivation.v1',
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

export const LOCAL_PRIVATE_CACHE_FILENAMES = ['onskin-export.json'] as const;

export const LOCAL_PRIVATE_CACHE_PREFIXES = ['onskin-export-', 'onskin-share-'] as const;
