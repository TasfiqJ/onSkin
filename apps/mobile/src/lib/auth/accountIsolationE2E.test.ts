import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_ISOLATION_E2E_FUTURE_OWNER_MARKER,
  ACCOUNT_ISOLATION_E2E_SENTINEL_KEY,
  ACCOUNT_ISOLATION_E2E_SENTINEL_VALUE,
  getAccountIsolationE2EFixture,
  readAccountIsolationE2EStorageProof,
  seedAccountIsolationE2EFixture,
} from './accountIsolationE2E';

afterEach(() => {
  delete process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION;
});

describe('account isolation E2E fixture', () => {
  it('provides a permanent synthetic session only in the explicit development mode', () => {
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION = 'signout_clear_retry';

    const fixture = getAccountIsolationE2EFixture(true);

    expect(fixture).toMatchObject({
      clearDelayMs: 700,
      failFirstClear: true,
      mode: 'signout_clear_retry',
      session: {
        user: {
          email: 'tas.account-a.e2e@example.com',
          id: '00000000-0000-4000-8000-0000000000a1',
          is_anonymous: false,
        },
      },
    });
    expect(getAccountIsolationE2EFixture(false)).toBeNull();
  });

  it('stays disabled for missing or unknown values', () => {
    expect(getAccountIsolationE2EFixture(true)).toBeNull();
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION = 'unknown';
    expect(getAccountIsolationE2EFixture(true)).toBeNull();
  });

  it('seeds a future owner marker and preservation sentinel only in its explicit mode', async () => {
    process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION = 'owner_marker_future';
    const fixture = getAccountIsolationE2EFixture(true)!;
    const persist = vi.fn(async () => {});

    expect(fixture).toMatchObject({
      clearDelayMs: 0,
      failFirstClear: false,
      mode: 'owner_marker_future',
    });
    await seedAccountIsolationE2EFixture(fixture, persist);

    expect(persist).toHaveBeenCalledWith([
      ['routinekind.localDataOwnerHash.v1', ACCOUNT_ISOLATION_E2E_FUTURE_OWNER_MARKER],
      [ACCOUNT_ISOLATION_E2E_SENTINEL_KEY, ACCOUNT_ISOLATION_E2E_SENTINEL_VALUE],
    ]);

    await expect(
      readAccountIsolationE2EStorageProof(fixture, async (keys) =>
        keys.map((key) => {
          if (key === 'routinekind.localDataOwnerHash.v1') {
            return [key, ACCOUNT_ISOLATION_E2E_FUTURE_OWNER_MARKER] as const;
          }
          if (key === ACCOUNT_ISOLATION_E2E_SENTINEL_KEY) {
            return [key, ACCOUNT_ISOLATION_E2E_SENTINEL_VALUE] as const;
          }
          return [key, null] as const;
        }),
      ),
    ).resolves.toEqual({
      cleanupMarkerAbsent: true,
      ownerMarkerPreserved: true,
      privateRecordPreserved: true,
    });
  });
});
