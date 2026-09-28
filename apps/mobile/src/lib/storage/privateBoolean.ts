import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

const CURRENT_TRUE = 'v1:1';
const CURRENT_FALSE = 'v1:0';

function decodePrivateBoolean(value: string): boolean {
  if (value === CURRENT_TRUE) return true;
  if (value === CURRENT_FALSE) return false;
  if (/^v\d+:/.test(value)) return false;

  // Pre-version values remain readable but ordinary reads never repair bytes.
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return false;
}

export async function getPrivateBoolean(key: string): Promise<boolean> {
  try {
    const value = await getPrivateItem(key);
    if (value == null) return false;
    return decodePrivateBoolean(value);
  } catch {
    return false;
  }
}

export async function setPrivateBoolean(key: string, enabled: boolean): Promise<void> {
  await setPrivateItem(key, enabled ? CURRENT_TRUE : CURRENT_FALSE);
}
