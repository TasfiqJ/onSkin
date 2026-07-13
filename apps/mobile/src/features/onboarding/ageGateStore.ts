import { getPrivateBoolean, setPrivateBoolean } from '@/lib/storage/privateBoolean';

// Whether this device has passed the neutral age gate (docs/01 §4). We persist ONLY
// the pass/fail boolean, never the date of birth itself (data minimization). Mirror
// of the app-lock store convention (lib/applock/store.ts).
const KEY = 'onskin.ageVerified';

export async function getAgeVerified(): Promise<boolean> {
  return getPrivateBoolean(KEY);
}

export async function setAgeVerified(): Promise<void> {
  await setPrivateBoolean(KEY, true);
}
