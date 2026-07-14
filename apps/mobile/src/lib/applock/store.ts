import { readPrivateBoolean, setPrivateBoolean } from '@/lib/storage/privateBoolean';
import { removePrivateItemsForAuthorizedReset } from '@/lib/storage/privateKV';

import type { AppLockPreferenceReadResult } from './preferenceResult';

export {
  isRepairableAppLockPreferenceResult,
  type AppLockPreferenceReadResult,
} from './preferenceResult';

// Whether the biometric app lock is enabled (opt-in, docs/01 §5). Stored locally;
// the lock state itself is in memory in AppLockProvider.
const KEY = 'onskin.appLock.enabled';

let e2eReadFailureCount = 0;

function consumeE2EReadFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;

  const fixture = process.env.EXPO_PUBLIC_E2E_APP_LOCK_READ_FAILURE?.trim().toLowerCase();
  if (fixture === 'always') return true;
  if (fixture !== 'once' || e2eReadFailureCount > 0) return false;
  e2eReadFailureCount += 1;
  return true;
}

function e2eAppLockEnabled(): boolean | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;

  const fixture = process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED?.trim().toLowerCase();
  if (fixture === '1' || fixture === 'true' || fixture === 'enabled') return true;
  if (fixture === '0' || fixture === 'false' || fixture === 'disabled') return false;

  return null;
}

/** Classify the stored preference without repairing, deleting, or collapsing failed state. */
export async function readAppLockPreference(): Promise<AppLockPreferenceReadResult> {
  if (consumeE2EReadFailure()) {
    return { status: 'unavailable', enabled: null, reason: 'storage_unavailable' };
  }

  const fixture = e2eAppLockEnabled();
  if (fixture !== null) {
    return { status: 'available', enabled: fixture, format: 'current' };
  }

  const result = await readPrivateBoolean(KEY);
  if (result.status === 'absent') return { status: 'absent', enabled: false };
  if (result.status === 'available') {
    return { status: 'available', enabled: result.value, format: result.format };
  }
  if (result.status === 'unavailable') return { ...result, enabled: null };
  if (result.status === 'corrupt') return { ...result, enabled: null };
  return { status: 'unsupported_version', enabled: null };
}

export async function setAppLockEnabledStored(enabled: boolean): Promise<void> {
  await setPrivateBoolean(KEY, enabled);
}

export async function clearMalformedAppLockPreference(): Promise<void> {
  await removePrivateItemsForAuthorizedReset([KEY], 'device_authenticated_app_lock_repair');
}
