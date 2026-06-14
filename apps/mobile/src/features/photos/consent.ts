import AsyncStorage from '@react-native-async-storage/async-storage';

import { PHOTO_CAPTURE_CONSENT, PHOTO_CLOUD_BACKUP_CONSENT } from '@/features/onboarding/consentCopy';
import { recordConsent } from '@/lib/consent/consent';

/**
 * Photo consents (docs/01 §4, docs/06 §7). Unbundled and local-first. Capture
 * consent is requested at FIRST camera use; cloud backup is a SEPARATE, off-by-
 * default opt-in. Each grant/revoke writes the immutable ledger (best-effort until
 * B-SUPABASE) AND a local flag so the gates work offline. The image bytes stay on
 * device regardless. These flags gate behaviour, not storage location for v1
 * (the cloud upload job itself is B-CAMERA).
 */
const CAPTURE_KEY = 'onskin.photos.captureConsent';
const CLOUD_KEY = 'onskin.photos.cloudBackup';

async function getFlag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return false;
  }
}

export async function hasPhotoCaptureConsent(): Promise<boolean> {
  return getFlag(CAPTURE_KEY);
}

export async function grantPhotoCaptureConsent(): Promise<void> {
  await AsyncStorage.setItem(CAPTURE_KEY, '1');
  try {
    await recordConsent({
      type: 'photo_capture',
      granted: true,
      version: PHOTO_CAPTURE_CONSENT.version,
      consentText: PHOTO_CAPTURE_CONSENT.fullText,
    });
  } catch {
    /* best-effort until backend configured (B-SUPABASE) */
  }
}

export async function getCloudBackupEnabled(): Promise<boolean> {
  return getFlag(CLOUD_KEY);
}

export async function setCloudBackupEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(CLOUD_KEY, enabled ? '1' : '0');
  try {
    await recordConsent({
      type: 'photo_cloud_backup',
      granted: enabled, // revocation is a new row with granted=false (D-015)
      version: PHOTO_CLOUD_BACKUP_CONSENT.version,
      consentText: PHOTO_CLOUD_BACKUP_CONSENT.fullText,
    });
  } catch {
    /* best-effort */
  }
}
