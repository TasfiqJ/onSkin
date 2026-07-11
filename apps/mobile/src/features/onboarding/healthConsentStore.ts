import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import { HEALTH_DATA_CONSENT } from './consentCopy';

const HEALTH_DATA_CONSENT_KEY = 'onskin.healthDataCollectionConsent.v1';

export type LocalHealthDataConsent = {
  type: ConsentType;
  granted: boolean;
  version: string;
  consentTextHash: string;
  recordedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function isoString(value: unknown): string | null {
  const text = nonEmptyString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
}

function normalizeConsent(value: unknown): LocalHealthDataConsent | null {
  if (!isRecord(value)) return null;
  const version = nonEmptyString(value.version);
  const consentTextHash = nonEmptyString(value.consentTextHash);
  const recordedAt = isoString(value.recordedAt);
  const type = nonEmptyString(value.type);
  if (
    type !== 'health_data_collection' ||
    typeof value.granted !== 'boolean' ||
    !version ||
    !consentTextHash ||
    !recordedAt
  ) {
    return null;
  }
  return {
    type: 'health_data_collection',
    granted: value.granted,
    version,
    consentTextHash,
    recordedAt,
  };
}

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
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(HEALTH_DATA_CONSENT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeConsent(parsed);
    if (!normalized) return null;
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await setPrivateItem(HEALTH_DATA_CONSENT_KEY, JSON.stringify(normalized)).catch(
        () => undefined,
      );
    }
    return normalized;
  } catch {
    return null;
  }
}

export async function hasCurrentHealthDataCollectionConsent(): Promise<boolean> {
  const consent = await getHealthDataCollectionConsentLocal();
  if (consent?.granted !== true || consent.version !== HEALTH_DATA_CONSENT.version) {
    return false;
  }

  const currentConsentTextHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    HEALTH_DATA_CONSENT.fullText,
  );
  return consent.consentTextHash === currentConsentTextHash;
}

/** Test/seed reset. */
export async function clearHealthDataCollectionConsentLocal(): Promise<void> {
  await removePrivateItem(HEALTH_DATA_CONSENT_KEY);
}
