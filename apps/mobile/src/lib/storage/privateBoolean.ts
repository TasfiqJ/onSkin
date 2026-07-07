import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

type StoredBoolean = '0' | '1';

async function repairPrivateBoolean(key: string, value: StoredBoolean): Promise<void> {
  try {
    await setPrivateItem(key, value);
  } catch {
    // Reads stay fail-closed even if encrypted flag repair is unavailable.
  }
}

async function normalizePrivateBoolean(key: string, value: string): Promise<boolean> {
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    if (value !== '1') await repairPrivateBoolean(key, '1');
    return true;
  }
  if (normalized === '0' || normalized === 'false') {
    if (value !== '0') await repairPrivateBoolean(key, '0');
    return false;
  }

  await repairPrivateBoolean(key, '0');
  return false;
}

export async function getPrivateBoolean(key: string): Promise<boolean> {
  try {
    const value = await getPrivateItem(key);
    if (value == null) return false;
    return normalizePrivateBoolean(key, value);
  } catch {
    return false;
  }
}

export async function setPrivateBoolean(key: string, enabled: boolean): Promise<void> {
  await setPrivateItem(key, enabled ? '1' : '0');
}
