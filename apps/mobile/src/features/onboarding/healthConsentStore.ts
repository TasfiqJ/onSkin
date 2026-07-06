import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

const HEALTH_DATA_CONSENT_KEY = 'onskin.healthDataCollectionConsent.v1';

export type LocalHealthDataConsent = {
  type: ConsentType;
  granted: boolean;
  version: string;
  consentTextHash: string;
  recordedAt: string;
};

export async function setHealthDataCollectionConsentLocal(params: {
  granted: boolean;
  version: string;
  consentText: string;
}): Promise<void> {
  const consentTextHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    params.consentText,
  );

  await setPrivateItem(
    HEALTH_DATA_CONSENT_KEY,
    JSON.stringify({
      type: 'health_data_collection',
      granted: params.granted,
      version: params.version,
      consentTextHash,
      recordedAt: new Date().toISOString(),
    } satisfies LocalHealthDataConsent),
  );
}

export async function getHealthDataCollectionConsentLocal(): Promise<LocalHealthDataConsent | null> {
  try {
    const raw = await getPrivateItem(HEALTH_DATA_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalHealthDataConsent>;
    if (
      parsed.type !== 'health_data_collection' ||
      typeof parsed.granted !== 'boolean' ||
      typeof parsed.version !== 'string' ||
      typeof parsed.consentTextHash !== 'string' ||
      typeof parsed.recordedAt !== 'string'
    ) {
      return null;
    }
    return parsed as LocalHealthDataConsent;
  } catch {
    return null;
  }
}

/** Test/seed reset. */
export async function clearHealthDataCollectionConsentLocal(): Promise<void> {
  await removePrivateItem(HEALTH_DATA_CONSENT_KEY);
}
