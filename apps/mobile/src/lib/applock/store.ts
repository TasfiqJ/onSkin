import {
  getPrivateItem,
  PRIVATE_KV_ENVELOPE_INVALID,
  PRIVATE_KV_ENVELOPE_UNSUPPORTED,
  removePrivateItemsForAuthorizedReset,
  setPrivateItem,
} from '@/lib/storage/privateKV';

// Whether the biometric app-lock is enabled (opt-in, docs/01 §5). Stored locally;
// the lock state itself is in-memory in AppLockProvider.
const KEY = 'onskin.appLock.enabled';
export const APP_LOCK_PREFERENCE_INVALID = 'APP_LOCK_PREFERENCE_INVALID';
export const APP_LOCK_PREFERENCE_UNSUPPORTED_VERSION =
  'APP_LOCK_PREFERENCE_UNSUPPORTED_VERSION';
const CURRENT_ENABLED = 'v1:1';
const CURRENT_DISABLED = 'v1:0';

export function isRepairableAppLockPreferenceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return (
    message === APP_LOCK_PREFERENCE_INVALID ||
    message === APP_LOCK_PREFERENCE_UNSUPPORTED_VERSION ||
    message === PRIVATE_KV_ENVELOPE_INVALID ||
    message === PRIVATE_KV_ENVELOPE_UNSUPPORTED
  );
}

function e2eAppLockEnabled(): boolean | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;

  const fixture = process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED?.trim().toLowerCase();
  if (fixture === '1' || fixture === 'true' || fixture === 'enabled') return true;
  if (fixture === '0' || fixture === 'false' || fixture === 'disabled') return false;

  return null;
}

function decodeStoredValue(value: string): boolean {
  if (value === CURRENT_ENABLED) return true;
  if (value === CURRENT_DISABLED) return false;
  if (/^v\d+:/.test(value)) throw new Error(APP_LOCK_PREFERENCE_UNSUPPORTED_VERSION);

  // Pre-version values remain readable but are never repaired during a read.
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;

  throw new Error(APP_LOCK_PREFERENCE_INVALID);
}

export async function getAppLockEnabled(): Promise<boolean> {
  const fixture = e2eAppLockEnabled();
  if (fixture !== null) return fixture;

  const value = await getPrivateItem(KEY);
  if (value == null) return false;
  return decodeStoredValue(value);
}

export async function setAppLockEnabledStored(enabled: boolean): Promise<void> {
  await setPrivateItem(KEY, enabled ? CURRENT_ENABLED : CURRENT_DISABLED);
}

export async function clearMalformedAppLockPreference(): Promise<void> {
  await removePrivateItemsForAuthorizedReset([KEY], 'device_authenticated_app_lock_repair');
}
