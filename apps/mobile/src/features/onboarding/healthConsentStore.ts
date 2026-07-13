import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import { HEALTH_DATA_CONSENT } from './consentCopy';

const HEALTH_DATA_CONSENT_KEY = 'onskin.healthDataCollectionConsent.v1';
const SCHEMA_VERSION = 1 as const;

export const HEALTH_CONSENT_INVALID = 'HEALTH_CONSENT_INVALID';
export const HEALTH_CONSENT_UNSUPPORTED_VERSION = 'HEALTH_CONSENT_UNSUPPORTED_VERSION';

export type LocalHealthDataConsent = {
  type: ConsentType;
  granted: boolean;
  version: string;
  consentTextHash: string;
  recordedAt: string;
};

type HealthConsentEnvelope = {
  schemaVersion: typeof SCHEMA_VERSION;
  consent: LocalHealthDataConsent;
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

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => hasOwn(value, key));
}

function decodeConsent(raw: string): LocalHealthDataConsent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(HEALTH_CONSENT_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(HEALTH_CONSENT_INVALID);

  if (hasOwn(parsed, 'schemaVersion')) {
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      if (
        typeof parsed.schemaVersion === 'number' &&
        Number.isSafeInteger(parsed.schemaVersion) &&
        parsed.schemaVersion > SCHEMA_VERSION
      ) {
        throw new Error(HEALTH_CONSENT_UNSUPPORTED_VERSION);
      }
      throw new Error(HEALTH_CONSENT_INVALID);
    }
    if (!hasExactKeys(parsed, ['schemaVersion', 'consent']) || !isRecord(parsed.consent)) {
      throw new Error(HEALTH_CONSENT_INVALID);
    }
    const normalized = normalizeConsent(parsed.consent);
    if (
      !normalized ||
      !hasExactKeys(parsed.consent, [
        'type',
        'granted',
        'version',
        'consentTextHash',
        'recordedAt',
      ]) ||
      JSON.stringify(normalized) !== JSON.stringify(parsed.consent)
    ) {
      throw new Error(HEALTH_CONSENT_INVALID);
    }
    return normalized;
  }

  const normalized = normalizeConsent(parsed);
  if (!normalized) throw new Error(HEALTH_CONSENT_INVALID);
  return normalized;
}

function encodeConsent(consent: LocalHealthDataConsent): string {
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    consent,
  } satisfies HealthConsentEnvelope);
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

  const consent: LocalHealthDataConsent = {
      type: 'health_data_collection',
      granted: params.granted,
      version: params.version,
      consentTextHash,
      recordedAt: new Date().toISOString(),
  };
  await updatePrivateItem(HEALTH_DATA_CONSENT_KEY, (current) => {
    if (current !== null) decodeConsent(current);
    return encodeConsent(consent);
  });
}

export async function getHealthDataCollectionConsentLocal(): Promise<LocalHealthDataConsent | null> {
  try {
    const raw = await getPrivateItem(HEALTH_DATA_CONSENT_KEY);
    return raw === null ? null : decodeConsent(raw);
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
