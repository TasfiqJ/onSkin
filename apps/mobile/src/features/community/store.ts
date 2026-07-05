import { getPrivateItem, multiRemovePrivateItems, setPrivateItem } from '@/lib/storage/privateKV';

// Local-first community state (docs/11 §6/§8, the D-029 pattern). The
// community_participation consent flag + the 16+ age confirmation are the v1 source of
// truth (offline-safe), with a guarded ledger mirror in consent.ts. Peer POSTING is
// deferred (B-COMMUNITY-MOD), so this only governs the Phase-1/2 gates today.

const CONSENT_KEY = 'onskin.communityConsent.v1';
const AGE_KEY = 'onskin.communityAge16.v1';

export async function getCommunityConsentLocal(): Promise<boolean> {
  try {
    return (await getPrivateItem(CONSENT_KEY)) === 'true';
  } catch {
    return false;
  }
}
export async function setCommunityConsentLocal(granted: boolean): Promise<void> {
  await setPrivateItem(CONSENT_KEY, granted ? 'true' : 'false');
}

export async function getAgeConfirmedLocal(): Promise<boolean> {
  try {
    return (await getPrivateItem(AGE_KEY)) === 'true';
  } catch {
    return false;
  }
}
export async function setAgeConfirmedLocal(confirmed: boolean): Promise<void> {
  await setPrivateItem(AGE_KEY, confirmed ? 'true' : 'false');
}

/** Test/seed reset. */
export async function clearCommunityState(): Promise<void> {
  await multiRemovePrivateItems([CONSENT_KEY, AGE_KEY]);
}
