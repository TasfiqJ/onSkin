import {
  readPrivateBoolean,
  setPrivateBoolean,
  type PrivateBooleanReadResult,
} from '@/lib/storage/privateBoolean';

// Whether this device has passed the neutral age gate (docs/01 §4). We persist ONLY
// the pass/fail boolean, never the date of birth itself (data minimization). Mirror
// of the app-lock store convention (lib/applock/store.ts).
const KEY = 'onskin.ageVerified';

let e2eReadFailureConsumed = false;
let e2eWriteFailureConsumed = false;

function shouldSimulateFailure(kind: 'read' | 'write'): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const fixture =
    kind === 'read'
      ? process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_READ_FAILURE
      : process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_WRITE_FAILURE;
  if (fixture === 'always') return true;
  if (fixture !== 'once') return false;

  if (kind === 'read') {
    if (e2eReadFailureConsumed) return false;
    e2eReadFailureConsumed = true;
    return true;
  }
  if (e2eWriteFailureConsumed) return false;
  e2eWriteFailureConsumed = true;
  return true;
}

/** Read the age-gate flag without repairing, deleting, or collapsing unreadable state. */
export async function readAgeVerification(): Promise<PrivateBooleanReadResult> {
  if (shouldSimulateFailure('read')) {
    return { status: 'unavailable', reason: 'storage_unavailable' };
  }
  return readPrivateBoolean(KEY);
}

export async function setAgeVerified(): Promise<void> {
  if (shouldSimulateFailure('write')) {
    throw new Error('E2E_AGE_VERIFICATION_WRITE_FAILURE');
  }
  await setPrivateBoolean(KEY, true);
}
