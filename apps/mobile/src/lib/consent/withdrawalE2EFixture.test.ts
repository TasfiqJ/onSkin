import { describe, expect, it, vi } from 'vitest';

import {
  DATA_SHARING_WITHDRAWAL_E2E_ATTEMPTS_KEY,
  DATA_SHARING_WITHDRAWAL_E2E_FAILURE,
  DATA_SHARING_WITHDRAWAL_E2E_RELEASE_HOOK,
  DATA_SHARING_WITHDRAWAL_E2E_STORAGE_UNAVAILABLE,
  resolveConsentWithdrawalE2EFixture,
  runConsentWithdrawalE2EFixture,
} from './withdrawalE2EFixture';

function createStorage(initial?: string) {
  expect(DATA_SHARING_WITHDRAWAL_E2E_ATTEMPTS_KEY).toBe(
    'routinekind.e2e.dataSharingWithdrawalAttempts.v1',
  );
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(DATA_SHARING_WITHDRAWAL_E2E_ATTEMPTS_KEY, initial);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    value: () => values.get(DATA_SHARING_WITHDRAWAL_E2E_ATTEMPTS_KEY),
  };
}

describe('data-sharing withdrawal development fixture', () => {
  it.each([
    ['production', false, 'web', 'data_sharing', 'fail_twice_then_succeed'],
    ['native', true, 'ios', 'data_sharing', 'fail_twice_then_succeed'],
    ['other consent', true, 'web', 'marketing', 'fail_twice_then_succeed'],
    ['unknown mode', true, 'web', 'data_sharing', 'unknown'],
  ])('rejects the %s boundary', (_label, development, platform, consentType, raw) => {
    expect(
      resolveConsentWithdrawalE2EFixture({ consentType, development, platform, raw }),
    ).toBeNull();
  });

  it.each(['fail_twice_then_succeed', 'hold_then_succeed'] as const)(
    'accepts exact development-web data-sharing mode %s',
    (raw) => {
      expect(
        resolveConsentWithdrawalE2EFixture({
          consentType: 'data_sharing',
          development: true,
          platform: 'web',
          raw: ` ${raw.toUpperCase()} `,
        }),
      ).toBe(raw);
    },
  );

  it('fails twice and exposes the exact valid acknowledgement on the third attempt', async () => {
    const storage = createStorage();

    await expect(
      runConsentWithdrawalE2EFixture('fail_twice_then_succeed', { storage }),
    ).rejects.toThrow(DATA_SHARING_WITHDRAWAL_E2E_FAILURE);
    expect(storage.value()).toBe('1');

    await expect(
      runConsentWithdrawalE2EFixture('fail_twice_then_succeed', { storage }),
    ).rejects.toThrow(DATA_SHARING_WITHDRAWAL_E2E_FAILURE);
    expect(storage.value()).toBe('2');

    await expect(
      runConsentWithdrawalE2EFixture('fail_twice_then_succeed', { storage }),
    ).resolves.toEqual({
      withdrawn: true,
      consent_type: 'data_sharing',
      cleanup: {
        order_attributions_detached: 0,
        commerce_click_events_deleted: 0,
      },
    });
    expect(storage.value()).toBe('3');
  });

  it('retains the content-free attempt count across helper re-instantiation', async () => {
    const storage = createStorage('1');

    await expect(
      runConsentWithdrawalE2EFixture('fail_twice_then_succeed', { storage }),
    ).rejects.toThrow(DATA_SHARING_WITHDRAWAL_E2E_FAILURE);
    await expect(
      runConsentWithdrawalE2EFixture('fail_twice_then_succeed', { storage }),
    ).resolves.toMatchObject({ withdrawn: true, consent_type: 'data_sharing' });

    expect(storage.value()).toBe('3');
  });

  it('fails closed to the first attempt for malformed or excessive stored counters', async () => {
    for (const raw of ['-1', '1.5', '1000000', 'private-data']) {
      const storage = createStorage(raw);
      await expect(
        runConsentWithdrawalE2EFixture('fail_twice_then_succeed', { storage }),
      ).rejects.toThrow(DATA_SHARING_WITHDRAWAL_E2E_FAILURE);
      expect(storage.value()).toBe('1');
    }
  });

  it.each(['read', 'write'] as const)(
    'normalizes a restricted session-storage %s failure',
    async (failure) => {
      const storage = {
        getItem: () => {
          if (failure === 'read') throw new DOMException('blocked', 'SecurityError');
          return null;
        },
        setItem: () => {
          if (failure === 'write') throw new DOMException('blocked', 'SecurityError');
        },
      };

      await expect(
        runConsentWithdrawalE2EFixture('fail_twice_then_succeed', { storage }),
      ).rejects.toThrow(DATA_SHARING_WITHDRAWAL_E2E_STORAGE_UNAVAILABLE);
    },
  );

  it('normalizes a restricted global session-storage getter', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });

    try {
      await expect(runConsentWithdrawalE2EFixture('fail_twice_then_succeed')).rejects.toThrow(
        DATA_SHARING_WITHDRAWAL_E2E_STORAGE_UNAVAILABLE,
      );
    } finally {
      if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
      else delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });

  it('holds until the explicit dev hook releases the exact acknowledgement', async () => {
    const storage = createStorage();
    const root = {} as typeof globalThis & {
      __ROUTINEKIND_E2E_RELEASE_DATA_SHARING_WITHDRAWAL__?: () => void;
    };

    const pending = runConsentWithdrawalE2EFixture('hold_then_succeed', { root, storage });
    expect(storage.value()).toBe('1');
    expect(root[DATA_SHARING_WITHDRAWAL_E2E_RELEASE_HOOK]).toBeTypeOf('function');

    root[DATA_SHARING_WITHDRAWAL_E2E_RELEASE_HOOK]?.();

    await expect(pending).resolves.toMatchObject({
      withdrawn: true,
      consent_type: 'data_sharing',
    });
    expect(root[DATA_SHARING_WITHDRAWAL_E2E_RELEASE_HOOK]).toBeUndefined();
  });
});
