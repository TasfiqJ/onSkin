import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

// Whether the biometric app-lock is enabled (opt-in, docs/01 §5). Stored locally;
// the lock state itself is in-memory in AppLockProvider.
const KEY = 'onskin.appLock.enabled';

export async function getAppLockEnabled(): Promise<boolean> {
  try {
    return (await getPrivateItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setAppLockEnabledStored(enabled: boolean): Promise<void> {
  await setPrivateItem(KEY, enabled ? '1' : '0');
}
