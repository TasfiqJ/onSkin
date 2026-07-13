import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import { PHOTO_CAPTURE_CONSENT } from '@/features/onboarding/consentCopy';
import { recordConsent } from '@/lib/consent/consent';
import { getPrivateBoolean } from '@/lib/storage/privateBoolean';
import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

/**
 * Photo consents (docs/01 §4, docs/06 §7). Unbundled and local-first. Capture
 * consent is requested at FIRST camera use. Capture stores a local proof first
 * so the camera gate works offline / pre-account; the ledger sync is best-effort.
 * Cloud backup is unavailable until encrypted upload, restore, and deletion are
 * implemented end to end, so no runtime setter exists in this build.
 */
const CAPTURE_KEY = 'onskin.photos.captureConsent';
const CAPTURE_RECORD_KEY = 'onskin.photos.captureConsent.v1';
const CLOUD_KEY = 'onskin.photos.cloudBackup';
const CAPTURE_SCHEMA_VERSION = 1 as const;

export const PHOTO_CAPTURE_CONSENT_INVALID = 'PHOTO_CAPTURE_CONSENT_INVALID';
export const PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION =
  'PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION';

export const PHOTO_CLOUD_BACKUP_AVAILABLE = false as const;

type LocalPhotoCaptureConsent = {
  type: ConsentType;
  granted: true;
  version: string;
  consentTextHash: string;
  recordedAt: string;
};

type PhotoCaptureConsentEnvelope = {
  schemaVersion: typeof CAPTURE_SCHEMA_VERSION;
  consent: LocalPhotoCaptureConsent;
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

function normalizePhotoCaptureConsent(value: unknown): LocalPhotoCaptureConsent | null {
  if (!isRecord(value)) return null;
  const type = nonEmptyString(value.type);
  const version = nonEmptyString(value.version);
  const consentTextHash = nonEmptyString(value.consentTextHash);
  const recordedAt = isoString(value.recordedAt);
  if (
    type !== 'photo_capture' ||
    value.granted !== true ||
    !version ||
    !consentTextHash ||
    !recordedAt
  ) {
    return null;
  }
  return {
    type: 'photo_capture',
    granted: true,
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

function decodePhotoCaptureConsent(raw: string): LocalPhotoCaptureConsent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);

  if (hasOwn(parsed, 'schemaVersion')) {
    if (parsed.schemaVersion !== CAPTURE_SCHEMA_VERSION) {
      if (
        typeof parsed.schemaVersion === 'number' &&
        Number.isSafeInteger(parsed.schemaVersion) &&
        parsed.schemaVersion > CAPTURE_SCHEMA_VERSION
      ) {
        throw new Error(PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION);
      }
      throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);
    }
    if (!hasExactKeys(parsed, ['schemaVersion', 'consent']) || !isRecord(parsed.consent)) {
      throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);
    }
    const normalized = normalizePhotoCaptureConsent(parsed.consent);
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
      throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);
    }
    return normalized;
  }

  const normalized = normalizePhotoCaptureConsent(parsed);
  if (!normalized) throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);
  return normalized;
}

function encodePhotoCaptureConsent(consent: LocalPhotoCaptureConsent): string {
  return JSON.stringify({
    schemaVersion: CAPTURE_SCHEMA_VERSION,
    consent,
  } satisfies PhotoCaptureConsentEnvelope);
}

async function getPhotoCaptureConsentLocal(): Promise<boolean> {
  try {
    const raw = await getPrivateItem(CAPTURE_RECORD_KEY);
    if (raw === null) return getPrivateBoolean(CAPTURE_KEY);
    decodePhotoCaptureConsent(raw);
    return true;
  } catch {
    // A non-absent malformed/future primary proof is authoritative and must not
    // revive a potentially stale legacy grant.
    return false;
  }
}

async function setPhotoCaptureConsentLocal(): Promise<void> {
  const consentTextHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    PHOTO_CAPTURE_CONSENT.fullText,
  );
  const consent: LocalPhotoCaptureConsent = {
      type: 'photo_capture',
      granted: true,
      version: PHOTO_CAPTURE_CONSENT.version,
      consentTextHash,
      recordedAt: new Date().toISOString(),
  };
  await updatePrivateItem(CAPTURE_RECORD_KEY, (current) => {
    if (current !== null) decodePhotoCaptureConsent(current);
    return encodePhotoCaptureConsent(consent);
  });
}

export async function hasPhotoCaptureConsent(): Promise<boolean> {
  return getPhotoCaptureConsentLocal();
}

export async function grantPhotoCaptureConsent(): Promise<void> {
  await setPhotoCaptureConsentLocal();
  try {
    await recordConsent({
      type: 'photo_capture',
      granted: true,
      version: PHOTO_CAPTURE_CONSENT.version,
      consentText: PHOTO_CAPTURE_CONSENT.fullText,
    });
  } catch {
    /* offline / no anonymous session. Keep the local-only proof; production ledger QA is a launch gate. */
  }
}

/** Removes flags written by builds that exposed backup before it existed. */
export async function clearUnavailableCloudBackupPreference(): Promise<void> {
  if (PHOTO_CLOUD_BACKUP_AVAILABLE) return;
  try {
    if ((await getPrivateItem(CLOUD_KEY)) != null) {
      await removePrivateItem(CLOUD_KEY);
    }
  } catch {
    // The capability remains disabled even if encrypted preference cleanup fails.
  }
}
