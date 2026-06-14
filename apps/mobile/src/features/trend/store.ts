import AsyncStorage from '@react-native-async-storage/async-storage';

// Local-first trend state (docs/12 §8/§10, the D-029 pattern). The
// photo_trend_insights consent flag is the v1 source of truth (default-OFF, offline-
// safe), with a guarded ledger mirror in consent.ts. The on-device-derived trend state
// lives in the same local, client-side-encrypted store as the photo bytes (docs/06);
// it is EXCLUDED from any cloud backup and DELETED on revocation. The source image
// never leaves the device. This flag gates behaviour, not storage location.

const CONSENT_KEY = 'onskin.trendInsights.v1';
const STATE_KEY = 'onskin.trendState.v1'; // the derived narrative state (no image, no score)

export async function getTrendInsightsLocal(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === 'true';
  } catch {
    return false;
  }
}
export async function setTrendInsightsLocal(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(CONSENT_KEY, enabled ? 'true' : 'false');
}

/** Delete the derived trend state on revocation (no retention exception, §8/§10).
 *  The source photos are untouched (they're the docs/06 local store). */
export async function deleteTrendState(): Promise<void> {
  await AsyncStorage.removeItem(STATE_KEY);
}

/** Test/seed reset. */
export async function clearTrendStore(): Promise<void> {
  await AsyncStorage.multiRemove([CONSENT_KEY, STATE_KEY]);
}
