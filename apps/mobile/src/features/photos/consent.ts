import { PHOTO_CAPTURE_CONSENT, PHOTO_CLOUD_BACKUP_CONSENT } from '@/features/onboarding/consentCopy';
import { recordConsent } from '@/lib/consent/consent';
import { withdrawConsent } from '@/lib/consent/withdrawal';
import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

/**
 * Photo consents (docs/01 §4, docs/06 §7). Unbundled and local-first. Capture
 * consent is requested at FIRST camera use; cloud backup is a SEPARATE, off-by-
 * default opt-in. Each grant/revoke writes the immutable ledger AND a local flag
 * so the gates work offline. The image bytes stay on device regardless. These
 * flags gate behaviour, not storage location for v1 (the cloud upload job itself
 * is B-CAMERA).
 */
const CAPTURE_KEY = 'onskin.photos.captureConsent';
const CLOUD_KEY = 'onskin.photos.cloudBackup';

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

export async function hasPhotoCaptureConsent(): Promise<boolean> {
  return getFlag(CAPTURE_KEY);
}

export async function grantPhotoCaptureConsent(): Promise<void> {
  await setPrivateItem(CAPTURE_KEY, '1');
  try {
    await recordConsent({
      type: 'photo_capture',
      granted: true,
      version: PHOTO_CAPTURE_CONSENT.version,
      consentText: PHOTO_CAPTURE_CONSENT.fullText,
    });
  } catch (error) {
    await setPrivateItem(CAPTURE_KEY, '0').catch(() => undefined);
    throw error;
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
