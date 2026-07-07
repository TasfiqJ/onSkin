import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

// Whether this device has passed the neutral age gate (docs/01 §4). We persist ONLY
// the pass/fail boolean, never the date of birth itself (data minimization). Mirror
// of the app-lock store convention (lib/applock/store.ts).
const KEY = 'onskin.ageVerified';

async function repairStoredValue(value: '0' | '1'): Promise<void> {
  try {
    await setPrivateItem(KEY, value);
  } catch {
    // Keep the locally read age-gate decision authoritative if repair is unavailable.
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

  await repairStoredValue('0');
  return false;
}

export async function getAgeVerified(): Promise<boolean> {
  try {
    const value = await getPrivateItem(KEY);
    if (value == null) return false;
    return normalizeStoredValue(value);
  } catch {
    return false;
  }
}

export async function setAgeVerified(): Promise<void> {
  await setPrivateItem(KEY, '1');
}
