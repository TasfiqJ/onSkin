import { getPrivateBoolean, setPrivateBoolean } from '@/lib/storage/privateBoolean';
import { multiRemovePrivateItems } from '@/lib/storage/privateKV';

// Local-first community state (docs/11 §6/§8, the D-029 pattern). The
// community_participation consent flag + the 16+ age confirmation are the v1 source of
// truth (offline-safe), with a guarded ledger mirror in consent.ts. Peer POSTING is
// deferred (B-COMMUNITY-MOD), so this only governs the Phase-1/2 gates today.

const CONSENT_KEY = 'layerwell.communityConsent.v1';
const AGE_KEY = 'layerwell.communityAge16.v1';

export async function getCommunityConsentLocal(): Promise<boolean> {
  return getPrivateBoolean(CONSENT_KEY);
}
export async function setCommunityConsentLocal(granted: boolean): Promise<void> {
  await setPrivateBoolean(CONSENT_KEY, granted);
}

export async function getAgeConfirmedLocal(): Promise<boolean> {
  return getPrivateBoolean(AGE_KEY);
}
export async function setAgeConfirmedLocal(confirmed: boolean): Promise<void> {
  await setPrivateBoolean(AGE_KEY, confirmed);
}

/** Test/seed reset. */
export async function clearCommunityState(): Promise<void> {
  await multiRemovePrivateItems([CONSENT_KEY, AGE_KEY]);
}
