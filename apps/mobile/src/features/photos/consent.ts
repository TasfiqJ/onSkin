import {
  grantHealthDependentConsent,
  isHealthDependentConsentActive,
} from '@/lib/consent/dependentConsentLifecycle';
import { removePrivateItem } from '@/lib/storage/privateKV';
import { clearPhotos } from './store';

const CLOUD_KEY = 'onskin.photos.cloudBackup';

export const PHOTO_CAPTURE_CONSENT_INVALID = 'PHOTO_CAPTURE_CONSENT_INVALID';
export const PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION =
  'PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION';
export const PHOTO_CLOUD_BACKUP_AVAILABLE = false as const;

/** Full version/hash/owner/epoch local receipt; never a boolean-only fallback. */
export function hasPhotoCaptureConsent(): Promise<boolean> {
  return isHealthDependentConsentActive('photo_capture', {
    allowExactLocalReceiptWhenUnconfigured: true,
    deleteLocalOnAuthoritativeClose: clearPhotos,
  });
}

export function grantPhotoCaptureConsent(): Promise<void> {
  return grantHealthDependentConsent('photo_capture', {
    allowExactLocalReceiptWhenUnconfigured: true,
  });
}

/** Removes flags written by builds that exposed backup before it existed. */
export async function clearUnavailableCloudBackupPreference(): Promise<void> {
  if (PHOTO_CLOUD_BACKUP_AVAILABLE) return;
  await removePrivateItem(CLOUD_KEY).catch(() => undefined);
}
