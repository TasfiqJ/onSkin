import {
  getPrivateItem,
  PRIVATE_KV_CONTENT_KEY_INVALID,
  PRIVATE_KV_CONTENT_KEY_MISSING,
  PRIVATE_KV_DECRYPTION_FAILED,
  PRIVATE_KV_ENVELOPE_INVALID,
  PRIVATE_KV_ENVELOPE_UNSUPPORTED,
  PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  removePrivateItem,
  updatePrivateItem,
} from '@/lib/storage/privateKV';

import type {
  AppLockPreferenceReadResult,
  AppLockPreferenceUnavailableReason,
} from './preferenceResult';

export {
  isRepairableAppLockPreferenceResult,
  type AppLockPreferenceReadResult,
} from './preferenceResult';

// Current Layerwell identity. Do not restore the checkpoint's legacy brand key.
const KEY = 'layerwell.appLock.enabled';
const CURRENT_ENABLED = 'v1:1';
const CURRENT_DISABLED = 'v1:0';
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

function decodeStoredValue(value: string): AppLockPreferenceReadResult {
  if (value === CURRENT_ENABLED) {
    return { status: 'available', enabled: true, format: 'current' };
  }
  if (value === CURRENT_DISABLED) {
    return { status: 'available', enabled: false, format: 'current' };
  }
  const versioned = /^v([1-9]\d*):/.exec(value);
  if (versioned) {
    return versioned[1] === '1'
      ? { status: 'corrupt', enabled: null, reason: 'invalid_value' }
      : { status: 'unsupported_version', enabled: null };
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    return { status: 'available', enabled: true, format: 'legacy' };
  }
  if (normalized === '0' || normalized === 'false') {
    return { status: 'available', enabled: false, format: 'legacy' };
  }
  return { status: 'corrupt', enabled: null, reason: 'invalid_value' };
}

function unavailableReason(error: unknown): AppLockPreferenceReadResult {
  const message = error instanceof Error ? error.message : '';
  if (message === PRIVATE_KV_ENVELOPE_INVALID) {
    return { status: 'corrupt', enabled: null, reason: 'envelope_invalid' };
  }
  if (message === PRIVATE_KV_ENVELOPE_UNSUPPORTED) {
    return { status: 'unsupported_version', enabled: null };
  }
  const reason: AppLockPreferenceUnavailableReason =
    message === PRIVATE_KV_CONTENT_KEY_MISSING
      ? 'content_key_missing'
      : message === PRIVATE_KV_CONTENT_KEY_INVALID
        ? 'content_key_invalid'
        : message === PRIVATE_KV_DECRYPTION_FAILED
          ? 'decryption_failed'
          : message === PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY
            ? 'account_boundary'
            : 'storage_unavailable';
  return { status: 'unavailable', enabled: null, reason };
}

/** Classify without repairing, deleting, or collapsing a failed state. */
export async function readAppLockPreference(): Promise<AppLockPreferenceReadResult> {
  if (consumeE2EReadFailure()) {
    return { status: 'unavailable', enabled: null, reason: 'storage_unavailable' };
  }
  const fixture = e2eAppLockEnabled();
  if (fixture !== null) {
    return { status: 'available', enabled: fixture, format: 'current' };
  }
  try {
    const value = await getPrivateItem(KEY);
    return value === null ? { status: 'absent', enabled: false } : decodeStoredValue(value);
  } catch (error) {
    return unavailableReason(error);
  }
}

export async function setAppLockEnabledStored(enabled: boolean): Promise<void> {
  await updatePrivateItem(KEY, (current) => {
    if (current !== null) {
      const decoded = decodeStoredValue(current);
      if (decoded.status !== 'available') throw new Error('APP_LOCK_PREFERENCE_NOT_WRITABLE');
    }
    return enabled ? CURRENT_ENABLED : CURRENT_DISABLED;
  });
}

/** Called only after successful device authentication for a repairable result. */
export async function clearMalformedAppLockPreference(): Promise<void> {
  await removePrivateItem(KEY);
}
