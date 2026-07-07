import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import { PHOTO_CAPTURE_CONSENT, PHOTO_CLOUD_BACKUP_CONSENT } from '@/features/onboarding/consentCopy';
import { recordConsent } from '@/lib/consent/consent';
import { withdrawConsent } from '@/lib/consent/withdrawal';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

/**
 * Photo consents (docs/01 §4, docs/06 §7). Unbundled and local-first. Capture
 * consent is requested at FIRST camera use; cloud backup is a SEPARATE, off-by-
 * default opt-in. Capture stores a local proof first so the camera gate works
 * offline / pre-account; the ledger sync is best-effort. Cloud backup remains
 * fail-closed because it moves images off device. These records gate behaviour,
 * not storage location for v1 (the cloud upload job itself is B-CAMERA).
 */
const CAPTURE_KEY = 'onskin.photos.captureConsent';
const CAPTURE_RECORD_KEY = 'onskin.photos.captureConsent.v1';
const CLOUD_KEY = 'onskin.photos.cloudBackup';

type LocalPhotoCaptureConsent = {
  type: ConsentType;
  granted: true;
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

async function repairFlag(key: string, value: '0' | '1'): Promise<void> {
  try {
    await setPrivateItem(key, value);
  } catch {
    // Consent reads stay fail-closed even if local encrypted flag repair is unavailable.
  }
}

async function getFlag(key: string): Promise<boolean> {
  try {
    const value = await getPrivateItem(key);
    if (value == null) return false;
    const normalized = value.trim();
    if (normalized === '1') {
      if (value !== '1') await repairFlag(key, '1');
      return true;
    }
    if (normalized === '0') {
      if (value !== '0') await repairFlag(key, '0');
      return false;
    }
    await repairFlag(key, '0');
    return false;
  } catch {
    return false;
  }
}

async function getPhotoCaptureConsentLocal(): Promise<boolean> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(CAPTURE_RECORD_KEY);
  } catch {
    return false;
  }
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const normalized = normalizePhotoCaptureConsent(parsed);
      if (!normalized) {
        await removePrivateItem(CAPTURE_RECORD_KEY).catch(() => undefined);
        return getFlag(CAPTURE_KEY);
      }
      if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
        await setPrivateItem(CAPTURE_RECORD_KEY, JSON.stringify(normalized)).catch(
          () => undefined,
        );
      }
      return true;
    } catch {
      await removePrivateItem(CAPTURE_RECORD_KEY).catch(() => undefined);
      return getFlag(CAPTURE_KEY);
    }
  }
  return getFlag(CAPTURE_KEY);
}

async function setPhotoCaptureConsentLocal(): Promise<void> {
  const consentTextHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    PHOTO_CAPTURE_CONSENT.fullText,
  );
  await setPrivateItem(
    CAPTURE_RECORD_KEY,
    JSON.stringify({
      type: 'photo_capture',
      granted: true,
      version: PHOTO_CAPTURE_CONSENT.version,
      consentTextHash,
      recordedAt: new Date().toISOString(),
    } satisfies LocalPhotoCaptureConsent),
  );
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

export async function getCloudBackupEnabled(): Promise<boolean> {
  return getFlag(CLOUD_KEY);
}

export async function setCloudBackupEnabled(enabled: boolean): Promise<void> {
  await setPrivateItem(CLOUD_KEY, enabled ? '1' : '0');
  if (!enabled) {
    await withdrawConsent({
      type: 'photo_cloud_backup',
      version: PHOTO_CLOUD_BACKUP_CONSENT.version,
      consentText: PHOTO_CLOUD_BACKUP_CONSENT.fullText,
    });
    return;
  }
  try {
    await recordConsent({
      type: 'photo_cloud_backup',
      granted: true,
      version: PHOTO_CLOUD_BACKUP_CONSENT.version,
      consentText: PHOTO_CLOUD_BACKUP_CONSENT.fullText,
    });
  } catch (error) {
    await setPrivateItem(CLOUD_KEY, '0').catch(() => undefined);
    throw error;
  }
}
