import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';
import {
  readPrivateItem,
  removePrivateItem,
  type PrivateKVReadFailureReason,
  type PrivateKVReadResult,
  updatePrivateItem,
} from '@/lib/storage/privateKV';

import { HEALTH_DATA_CONSENT } from './consentCopy';

const HEALTH_DATA_CONSENT_KEY = 'onskin.healthDataCollectionConsent.v1';
const SCHEMA_VERSION = 1 as const;

export const HEALTH_CONSENT_INVALID = 'HEALTH_CONSENT_INVALID';
export const HEALTH_CONSENT_UNSUPPORTED_VERSION = 'HEALTH_CONSENT_UNSUPPORTED_VERSION';
export const HEALTH_CONSENT_UNAVAILABLE = 'HEALTH_CONSENT_UNAVAILABLE';

export type LocalHealthDataConsent = {
  type: ConsentType;
  granted: boolean;
  version: string;
  consentTextHash: string;
  recordedAt: string;
};

type PrivateKVCorruptReason = Extract<
  PrivateKVReadResult,
  { status: 'corrupt' }
>['reason'];

export type HealthConsentReadResult =
  | { status: 'absent'; consent: null }
  | { status: 'available'; consent: LocalHealthDataConsent }
  | { status: 'unavailable'; consent: null; reason: PrivateKVReadFailureReason }
  | {
      status: 'corrupt';
      consent: null;
      reason: PrivateKVCorruptReason | 'invalid_record';
    }
  | { status: 'unsupported_version'; consent: null };

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
  await runAccountGenerationOperation(async (lease) => {
    const consentTextHash = await awaitAccountGenerationLease(lease, () =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, params.consentText),
    );
    lease.assertCurrent();

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
    lease.assertCurrent();
  });
}

/** Read and classify the local proof without repairing, deleting, or migrating bytes. */
export async function readHealthDataCollectionConsentLocal(): Promise<HealthConsentReadResult> {
  const stored = await readPrivateItem(HEALTH_DATA_CONSENT_KEY);
  if (stored.status === 'absent') return { status: 'absent', consent: null };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', consent: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', consent: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', consent: null };
  }

  try {
    return { status: 'available', consent: decodeConsent(stored.value) };
  } catch (error) {
    if (error instanceof Error && error.message === HEALTH_CONSENT_UNSUPPORTED_VERSION) {
      return { status: 'unsupported_version', consent: null };
    }
    return { status: 'corrupt', consent: null, reason: 'invalid_record' };
  }
}

/** Compatibility API: only genuine absence maps to null; unreadable state remains explicit. */
export async function getHealthDataCollectionConsentLocal(): Promise<LocalHealthDataConsent | null> {
  const result = await readHealthDataCollectionConsentLocal();
  if (result.status === 'available') return result.consent;
  if (result.status === 'absent') return null;
  if (result.status === 'unsupported_version') {
    throw new Error(HEALTH_CONSENT_UNSUPPORTED_VERSION);
  }
  if (result.status === 'corrupt') throw new Error(HEALTH_CONSENT_INVALID);
  throw new Error(HEALTH_CONSENT_UNAVAILABLE);
}

export async function hasCurrentHealthDataCollectionConsent(): Promise<boolean> {
  const result = await readHealthDataCollectionConsentLocal();
  if (result.status !== 'available') return false;
  const consent = result.consent;
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
