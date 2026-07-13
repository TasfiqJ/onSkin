import { getPrivateBooleanFailClosed, setPrivateBoolean } from '@/lib/storage/privateBoolean';

// Whether this device has passed the neutral age gate (docs/01 §4). We persist ONLY
// the pass/fail boolean, never the date of birth itself (data minimization). Mirror
// of the app-lock store convention (lib/applock/store.ts).
const KEY = 'onskin.ageVerified';

export async function getAgeVerified(): Promise<boolean> {
  // This is the one app-wide hard gate where every unreadable state must remain
  // not-verified. The root private-data boundary owns storage recovery UI.
  return getPrivateBooleanFailClosed(KEY);
}

export async function setAgeVerified(): Promise<void> {
  await setPrivateBoolean(KEY, true);
}
