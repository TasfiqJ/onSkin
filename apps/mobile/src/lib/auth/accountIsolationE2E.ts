import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { LOCAL_DATA_OWNER_HASH_KEY } from './sessionOwnerKey';

const E2E_USER_ID = '00000000-0000-4000-8000-0000000000a1';
const E2E_EMAIL = 'tas.account-a.e2e@example.com';

export type AccountIsolationE2EFixture = {
  clearDelayMs: number;
  failFirstClear: boolean;
  mode: 'owner_marker_future' | 'signout_clear_retry';
  session: Session;
};

export const ACCOUNT_ISOLATION_E2E_SENTINEL_KEY = 'onskin.ageVerified';
export const ACCOUNT_ISOLATION_E2E_SENTINEL_VALUE = 'e2e-private-record-preserved';
export const ACCOUNT_ISOLATION_E2E_FUTURE_OWNER_MARKER = `v2:${'a'.repeat(64)}`;

export type AccountIsolationE2EStorageProof = Readonly<{
  cleanupMarkerAbsent: boolean;
  ownerMarkerPreserved: boolean;
  privateRecordPreserved: boolean;
}>;

function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function fixtureSession(): Session {
  const createdAt = '2026-07-10T00:00:00.000Z';
  return {
    access_token: 'e2e-account-a-access-token',
    expires_in: 3600,
    refresh_token: 'e2e-account-a-refresh-token',
    token_type: 'bearer',
    user: {
      app_metadata: { provider: 'email', providers: ['email'] },
      aud: 'authenticated',
      created_at: createdAt,
      email: E2E_EMAIL,
      id: E2E_USER_ID,
      identities: [],
      is_anonymous: false,
      role: 'authenticated',
      updated_at: createdAt,
      user_metadata: {},
    },
  };
}

export function getAccountIsolationE2EFixture(
  isDev = isDevRuntime(),
): AccountIsolationE2EFixture | null {
  if (!isDev) return null;
  const mode = process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION?.trim().toLowerCase();
  if (mode !== 'signout_clear_retry' && mode !== 'owner_marker_future') return null;
  return {
    clearDelayMs: mode === 'signout_clear_retry' ? 700 : 0,
    failFirstClear: mode === 'signout_clear_retry',
    mode,
    session: fixtureSession(),
  };
}

export async function seedAccountIsolationE2EFixture(
  fixture: AccountIsolationE2EFixture,
  persist: (entries: [string, string][]) => Promise<void> = (entries) =>
    AsyncStorage.multiSet(entries),
): Promise<void> {
  if (fixture.mode !== 'owner_marker_future') return;
  await persist([
    [LOCAL_DATA_OWNER_HASH_KEY, ACCOUNT_ISOLATION_E2E_FUTURE_OWNER_MARKER],
    [ACCOUNT_ISOLATION_E2E_SENTINEL_KEY, ACCOUNT_ISOLATION_E2E_SENTINEL_VALUE],
  ]);
}

export async function readAccountIsolationE2EStorageProof(
  fixture: AccountIsolationE2EFixture,
  read: (keys: string[]) => Promise<readonly [string, string | null][]> = (keys) =>
    AsyncStorage.multiGet(keys),
): Promise<AccountIsolationE2EStorageProof | null> {
  if (fixture.mode !== 'owner_marker_future') return null;
  const values = new Map(
    await read([
      LOCAL_DATA_OWNER_HASH_KEY,
      ACCOUNT_ISOLATION_E2E_SENTINEL_KEY,
      'routinekind.localDataCleanupRequired.v1',
    ]),
  );
  return {
    ownerMarkerPreserved:
      values.get(LOCAL_DATA_OWNER_HASH_KEY) === ACCOUNT_ISOLATION_E2E_FUTURE_OWNER_MARKER,
    privateRecordPreserved:
      values.get(ACCOUNT_ISOLATION_E2E_SENTINEL_KEY) === ACCOUNT_ISOLATION_E2E_SENTINEL_VALUE,
    cleanupMarkerAbsent: values.get('routinekind.localDataCleanupRequired.v1') === null,
  };
}
