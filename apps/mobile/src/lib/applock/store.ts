import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

// Whether the biometric app-lock is enabled (opt-in, docs/01 §5). Stored locally;
// the lock state itself is in-memory in AppLockProvider.
const KEY = 'onskin.appLock.enabled';

async function normalizeStoredValue(value: string): Promise<boolean> {
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    if (value !== '1') await setPrivateItem(KEY, '1');
    return true;
  }
  if (normalized === '0' || normalized === 'false') {
    if (value !== '0') await setPrivateItem(KEY, '0');
    return false;
  }

  await setPrivateItem(KEY, '0');
  return false;
}

export async function getAppLockEnabled(): Promise<boolean> {
  try {
    const value = await getPrivateItem(KEY);
    if (value == null) return false;
    return normalizeStoredValue(value);
  } catch {
    return false;
  }
}

export async function setAppLockEnabledStored(enabled: boolean): Promise<void> {
  await setPrivateItem(KEY, enabled ? '1' : '0');
}
