import {
  getPrivateItem,
  PRIVATE_KV_ENVELOPE_INVALID,
  PRIVATE_KV_ENVELOPE_UNSUPPORTED,
  removePrivateItem,
  setPrivateItem,
} from '@/lib/storage/privateKV';

// Whether the biometric app-lock is enabled (opt-in, docs/01 §5). Stored locally;
// the lock state itself is in-memory in AppLockProvider.
const KEY = 'onskin.appLock.enabled';
export const APP_LOCK_PREFERENCE_INVALID = 'APP_LOCK_PREFERENCE_INVALID';

export function isRepairableAppLockPreferenceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return (
    message === APP_LOCK_PREFERENCE_INVALID ||
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

async function repairStoredValue(value: '0' | '1'): Promise<void> {
  try {
    await setPrivateItem(KEY, value);
  } catch {
    // Keep reads authoritative even when encrypted preference repair is unavailable.
  }
}

async function normalizeStoredValue(value: string): Promise<boolean> {
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    if (value !== '1') await repairStoredValue('1');
    return true;
  }
  if (normalized === '0' || normalized === 'false') {
    if (value !== '0') await repairStoredValue('0');
    return false;
  }

  throw new Error(APP_LOCK_PREFERENCE_INVALID);
}

export async function getAppLockEnabled(): Promise<boolean> {
  const fixture = e2eAppLockEnabled();
  if (fixture !== null) return fixture;

  const value = await getPrivateItem(KEY);
  if (value == null) return false;
  return normalizeStoredValue(value);
}

export async function setAppLockEnabledStored(enabled: boolean): Promise<void> {
  await setPrivateItem(KEY, enabled ? '1' : '0');
}

export async function clearMalformedAppLockPreference(): Promise<void> {
  await removePrivateItem(KEY);
}
