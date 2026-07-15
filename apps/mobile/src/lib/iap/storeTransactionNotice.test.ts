import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const OWNER_A_BINDING = 'a'.repeat(64);
const OWNER_B_BINDING = 'b'.repeat(64);
const NOW = '2026-07-14T12:00:00.000Z';
const THIRTY_DAYS_LATER = '2026-08-13T12:00:00.000Z';

type NativeCall = {
  beforeNativeStoreCall: () => Promise<void>;
  markNativeCallStarted: () => void;
  markDefinitiveCancellation: () => void;
  markProviderResultPersisted: (active: boolean) => void;
};

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  corruptSet: false,
  dropSet: false,
  failGet: false,
  failReadBack: false,
  failSet: false,
  readBackPending: false,
  getItem: vi.fn(async (key: string) => {
    if (mocks.failReadBack && mocks.readBackPending) {
      mocks.readBackPending = false;
      throw new Error('storage readback failed');
    }
    if (mocks.failGet) throw new Error('storage read failed');
    return mocks.storage.get(key) ?? null;
  }),
  setItem: vi.fn(async (key: string, value: string) => {
    if (mocks.failSet) throw new Error('storage write failed');
    if (!mocks.dropSet) mocks.storage.set(key, mocks.corruptSet ? `${value}corrupt` : value);
    mocks.readBackPending = true;
  }),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mocks.getItem,
    setItem: mocks.setItem,
  },
}));

vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: vi.fn(async (ownerUserId: string) => {
    if (ownerUserId === OWNER_A) return OWNER_A_BINDING;
    if (ownerUserId === OWNER_B) return OWNER_B_BINDING;
    const fixtureIndex = ownerUserId.match(/^owner-(\d+)$/)?.[1];
    return fixtureIndex ? Number(fixtureIndex).toString(16).padStart(64, '0') : 'c'.repeat(64);
  }),
}));

vi.mock('@/lib/env', () => ({
  env: { appEnvironment: 'development' },
}));

vi.mock('./revenuecat', () => ({
  isRevenueCatCancellationAmbiguous: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'PURCHASE_CANCELLED_ERROR',
  isRevenueCatPaymentPendingError: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'PAYMENT_PENDING_ERROR',
  revenueCatUnconfirmedStoreMessage: (error: unknown, action: 'purchase' | 'restore') =>
    error instanceof Error && error.message === 'UNCONFIRMED'
      ? `${action} completion unconfirmed; do not buy again`
      : null,
}));

async function loadModule() {
  return import('./storeTransactionNotice');
}

async function enterNative(nativeCall: NativeCall): Promise<void> {
  await nativeCall.beforeNativeStoreCall();
  nativeCall.markNativeCallStarted();
}

function paymentPendingError(): Error & { code: string } {
  return Object.assign(new Error('approval pending'), { code: 'PAYMENT_PENDING_ERROR' });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  mocks.storage.clear();
  mocks.corruptSet = false;
  mocks.dropSet = false;
  mocks.failGet = false;
  mocks.failReadBack = false;
  mocks.failSet = false;
  mocks.readBackPending = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('durable Store transaction notice', () => {
  it('does not journal failures before the native-call hook', async () => {
    const mod = await loadModule();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async () => {
          throw new Error('offering unavailable');
        },
      }),
    ).rejects.toThrow('offering unavailable');

    expect(mocks.storage.has(mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY)).toBe(false);
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toBeNull();
  });

  it('commits write-ahead immediately before native work and stops the SDK on write failure', async () => {
    const mod = await loadModule();
    mocks.failSet = true;
    const sdk = vi.fn();

    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await nativeCall.beforeNativeStoreCall();
          nativeCall.markNativeCallStarted();
          sdk();
        },
      }),
    ).rejects.toMatchObject({ code: mod.STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE });
    expect(sdk).not.toHaveBeenCalled();
  });

  it.each(['dropped', 'corrupt', 'read_failure'] as const)(
    'stops the SDK when the write-ahead readback is %s',
    async (mode) => {
      const mod = await loadModule();
      mocks.dropSet = mode === 'dropped';
      mocks.corruptSet = mode === 'corrupt';
      mocks.failReadBack = mode === 'read_failure';
      const sdk = vi.fn();

      await expect(
        mod.runOwnedStoreTransaction({
          action: 'purchase',
          ownerUserId: OWNER_A,
          operation: async (nativeCall) => {
            await nativeCall.beforeNativeStoreCall();
            nativeCall.markNativeCallStarted();
            sdk();
          },
        }),
      ).rejects.toMatchObject({ code: mod.STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE });
      expect(sdk).not.toHaveBeenCalled();
    },
  );

  it('compensates a committed hook when authority closes before native invocation', async () => {
    const mod = await loadModule();
    const sdk = vi.fn();

    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await nativeCall.beforeNativeStoreCall();
          throw new Error('ACCOUNT_PUBLICATION_RESULT_STALE');
        },
      }),
    ).rejects.toThrow('ACCOUNT_PUBLICATION_RESULT_STALE');
    expect(sdk).not.toHaveBeenCalled();
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toBeNull();
  });

  it('promotes post-native uncertainty with only a hashed owner', async () => {
    const mod = await loadModule();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          throw new Error('UNCONFIRMED');
        },
      }),
    ).rejects.toThrow('UNCONFIRMED');

    const raw = mocks.storage.get(mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY)!;
    expect(JSON.parse(raw)).toEqual({
      deletedOwnerSafety: null,
      notices: [
        {
          createdAt: NOW,
          expiresAt: null,
          ownerBinding: OWNER_A_BINDING,
          reason: 'completion_unconfirmed',
          status: 'unconfirmed',
        },
      ],
      version: 2,
    });
    expect(raw).not.toContain(OWNER_A);
    expect(raw).not.toMatch(/RevenueCat|StoreKit|app[_ ]?user|product|order|transaction[_-]?id/i);
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toEqual({
      kind: 'owner_pending',
      reason: 'completion_unconfirmed',
    });
  });

  it('does not clear a fulfilled native purchase without persisted active access', async () => {
    const mod = await loadModule();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          nativeCall.markProviderResultPersisted(false);
          return { purchased: false };
        },
      }),
    ).rejects.toMatchObject({ code: mod.STORE_TRANSACTION_COMPLETION_UNCONFIRMED });
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toMatchObject({
      kind: 'owner_pending',
      reason: 'completion_unconfirmed',
    });
  });

  it('clears only definitive cancellation or a fully persisted active purchase', async () => {
    const mod = await loadModule();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          nativeCall.markDefinitiveCancellation();
          return 'cancelled';
        },
      }),
    ).resolves.toBe('cancelled');
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toBeNull();

    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          nativeCall.markProviderResultPersisted(true);
          return 'active';
        },
      }),
    ).resolves.toBe('active');
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toBeNull();
  });

  it('lets persisted verified-empty Restore clear generic uncertainty', async () => {
    const mod = await loadModule();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          throw new Error('uncertain');
        },
      }),
    ).rejects.toThrow('uncertain');

    await expect(
      mod.runOwnedStoreTransaction({
        action: 'restore',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          nativeCall.markProviderResultPersisted(false);
          return 'verified empty';
        },
      }),
    ).resolves.toBe('verified empty');
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toBeNull();
  });

  it('keeps the Restore journal unresolved when verified-empty cache commit is blocked', async () => {
    const mod = await loadModule();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'restore',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          throw new Error('ENTITLEMENT_CACHE_COMMIT_BLOCKED');
        },
      }),
    ).rejects.toThrow('ENTITLEMENT_CACHE_COMMIT_BLOCKED');
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toEqual({
      kind: 'owner_pending',
      reason: 'completion_unconfirmed',
    });
  });

  it('retains PAYMENT_PENDING through empty Restore and past its device-clock review date', async () => {
    const mod = await loadModule();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          throw paymentPendingError();
        },
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_PENDING_ERROR' });

    vi.setSystemTime(new Date('2026-07-20T12:00:00.000Z'));
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'restore',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          nativeCall.markProviderResultPersisted(false);
          return 'empty';
        },
      }),
    ).resolves.toBe('empty');
    const raw = JSON.parse(mocks.storage.get(mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY)!) as {
      notices: { createdAt: string; expiresAt: string; reason: string }[];
    };
    expect(raw.notices[0]).toMatchObject({
      createdAt: NOW,
      expiresAt: THIRTY_DAYS_LATER,
      reason: 'payment_pending',
    });
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toMatchObject({
      kind: 'owner_pending',
      reason: 'payment_pending',
    });

    vi.setSystemTime(new Date(Date.parse(THIRTY_DAYS_LATER) + 24 * 60 * 60 * 1_000));
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toMatchObject({
      kind: 'owner_pending',
      reason: 'payment_pending',
    });
    const blockedPurchase = vi.fn();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: blockedPurchase,
      }),
    ).rejects.toMatchObject({ code: mod.STORE_TRANSACTION_PURCHASE_BLOCKED });
    expect(blockedPurchase).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toMatchObject({
      kind: 'owner_pending',
      reason: 'payment_pending',
    });
    const retained = JSON.parse(mocks.storage.get(mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY)!) as {
      notices: { ownerBinding: string }[];
    };
    expect(retained.notices).toEqual([expect.objectContaining({ ownerBinding: OWNER_A_BINDING })]);
  });

  it('preserves PAYMENT_PENDING durably across process death during Restore', async () => {
    const firstProcess = await loadModule();
    await expect(
      firstProcess.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          throw paymentPendingError();
        },
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_PENDING_ERROR' });

    let reportNativeStarted!: () => void;
    const nativeStarted = new Promise<void>((resolve) => {
      reportNativeStarted = resolve;
    });
    void firstProcess.runOwnedStoreTransaction({
      action: 'restore',
      ownerUserId: OWNER_A,
      operation: async (nativeCall) => {
        await enterNative(nativeCall);
        reportNativeStarted();
        return new Promise<never>(() => {});
      },
    });
    await nativeStarted;

    // Simulate process termination: only AsyncStorage survives module reset.
    vi.resetModules();
    const relaunched = await loadModule();
    await expect(relaunched.readStoreTransactionNotice(OWNER_A)).resolves.toEqual({
      kind: 'owner_pending',
      reason: 'payment_pending',
    });
    const raw = JSON.parse(mocks.storage.get(relaunched.STORE_TRANSACTION_NOTICE_STORAGE_KEY)!) as {
      notices: { createdAt: string; expiresAt: string }[];
    };
    expect(raw.notices[0]).toMatchObject({ createdAt: NOW, expiresAt: THIRTY_DAYS_LATER });

    await expect(
      relaunched.runOwnedStoreTransaction({
        action: 'restore',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          nativeCall.markProviderResultPersisted(false);
          return 'empty';
        },
      }),
    ).resolves.toBe('empty');
    await expect(relaunched.readStoreTransactionNotice(OWNER_A)).resolves.toMatchObject({
      kind: 'owner_pending',
      reason: 'payment_pending',
    });
  });

  it('preserves generic uncertainty durably across process death during Restore', async () => {
    const firstProcess = await loadModule();
    await expect(
      firstProcess.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          throw new Error('generic uncertainty');
        },
      }),
    ).rejects.toThrow('generic uncertainty');

    let reportNativeStarted!: () => void;
    const nativeStarted = new Promise<void>((resolve) => {
      reportNativeStarted = resolve;
    });
    void firstProcess.runOwnedStoreTransaction({
      action: 'restore',
      ownerUserId: OWNER_A,
      operation: async (nativeCall) => {
        await enterNative(nativeCall);
        reportNativeStarted();
        return new Promise<never>(() => {});
      },
    });
    await nativeStarted;

    vi.resetModules();
    const relaunched = await loadModule();
    await expect(relaunched.readStoreTransactionNotice(OWNER_A)).resolves.toEqual({
      kind: 'owner_pending',
      reason: 'completion_unconfirmed',
    });
  });

  it('converts terminal deletion to one fresh ownerless review-marked tombstone', async () => {
    const mod = await loadModule();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          throw new Error('uncertain');
        },
      }),
    ).rejects.toThrow('uncertain');
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'restore',
        ownerUserId: OWNER_B,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          throw new Error('foreign uncertain');
        },
      }),
    ).rejects.toThrow('foreign uncertain');

    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    await mod.convertStoreTransactionNoticeForTerminalDeletion(OWNER_A_BINDING);
    const raw = mocks.storage.get(mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY)!;
    const parsed = JSON.parse(raw) as {
      deletedOwnerSafety: Record<string, unknown>;
      notices: { ownerBinding: string }[];
    };
    expect(parsed.deletedOwnerSafety).toEqual({
      createdAt: '2026-07-15T12:00:00.000Z',
      expiresAt: '2026-08-14T12:00:00.000Z',
      kind: 'deleted_owner_store_safety',
    });
    expect(parsed.notices).toEqual([expect.objectContaining({ ownerBinding: OWNER_B_BINDING })]);
    expect(raw).not.toContain(OWNER_A_BINDING);
    expect(Object.keys(parsed.deletedOwnerSafety).sort()).toEqual([
      'createdAt',
      'expiresAt',
      'kind',
    ]);
    expect(JSON.stringify(parsed.deletedOwnerSafety)).not.toMatch(
      /ownerBinding|action|provider|product|original/i,
    );
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toEqual({
      kind: 'deleted_account_pending',
    });
  });

  it('requires active Restore to clear a deleted-account tombstone even past its review date', async () => {
    const mod = await loadModule();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          throw new Error('uncertain');
        },
      }),
    ).rejects.toThrow('uncertain');
    await mod.convertStoreTransactionNoticeForTerminalDeletion(OWNER_A_BINDING);
    vi.setSystemTime(new Date('2026-08-14T12:00:00.000Z'));

    await expect(
      mod.runOwnedStoreTransaction({
        action: 'restore',
        ownerUserId: OWNER_B,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          nativeCall.markProviderResultPersisted(false);
          return 'empty';
        },
      }),
    ).resolves.toBe('empty');
    await expect(mod.readStoreTransactionNotice(OWNER_B)).resolves.toEqual({
      kind: 'deleted_account_pending',
    });

    await expect(
      mod.runOwnedStoreTransaction({
        action: 'restore',
        ownerUserId: OWNER_B,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          nativeCall.markProviderResultPersisted(true);
          return 'active';
        },
      }),
    ).resolves.toBe('active');
    await expect(mod.readStoreTransactionNotice(OWNER_B)).resolves.toBeNull();
  });

  it('reconciles failed post-native promotion before any later read or admission', async () => {
    const mod = await loadModule();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          mocks.failSet = true;
          throw new Error('uncertain');
        },
      }),
    ).rejects.toMatchObject({ code: mod.STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE });

    mocks.failSet = false;
    await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toMatchObject({
      kind: 'owner_pending',
    });
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_B,
        operation: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: mod.STORE_TRANSACTION_PURCHASE_BLOCKED });
  });

  it('never overwrites malformed/future storage and serializes native operations', async () => {
    const mod = await loadModule();
    const corrupt = JSON.stringify({ version: 3, notices: [] });
    mocks.storage.set(mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY, corrupt);
    const checkout = vi.fn();
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId: OWNER_A,
        operation: checkout,
      }),
    ).rejects.toMatchObject({ code: mod.STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE });
    expect(checkout).not.toHaveBeenCalled();
    expect(mocks.storage.get(mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY)).toBe(corrupt);

    const overbroad = JSON.stringify({
      deletedOwnerSafety: null,
      notices: [
        {
          acknowledgedAt: NOW,
          action: 'purchase',
          createdAt: NOW,
          expiresAt: null,
          ownerBinding: OWNER_A_BINDING,
          reason: 'completion_unconfirmed',
          status: 'unconfirmed',
        },
      ],
      version: 2,
    });
    mocks.storage.set(mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY, overbroad);
    await expect(mod.readStoreTransactionNotice(OWNER_A)).rejects.toMatchObject({
      code: mod.STORE_TRANSACTION_NOTICE_STORAGE_UNAVAILABLE,
    });
    expect(mocks.storage.get(mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY)).toBe(overbroad);

    mocks.storage.clear();
    let finish!: () => void;
    const first = mod.runOwnedStoreTransaction({
      action: 'restore',
      ownerUserId: OWNER_A,
      operation: async (nativeCall) => {
        await enterNative(nativeCall);
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        nativeCall.markProviderResultPersisted(true);
      },
    });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'restore',
        ownerUserId: OWNER_B,
        operation: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: mod.STORE_TRANSACTION_OPERATION_IN_PROGRESS });
    finish();
    await expect(first).resolves.toBeUndefined();
  });

  it('keeps more than sixteen exact-owner records recoverable', async () => {
    const mod = await loadModule();
    const notices = Array.from({ length: 17 }, (_, index) => ({
      createdAt: NOW,
      expiresAt: null,
      ownerBinding: index.toString(16).padStart(64, '0'),
      reason: 'completion_unconfirmed',
      status: 'unconfirmed',
    }));
    mocks.storage.set(
      mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY,
      JSON.stringify({ deletedOwnerSafety: null, notices, version: 2 }),
    );

    await expect(mod.readStoreTransactionNotice('owner-16')).resolves.toMatchObject({
      kind: 'owner_pending',
    });
    await expect(
      mod.runOwnedStoreTransaction({
        action: 'restore',
        ownerUserId: 'owner-16',
        operation: async (nativeCall) => {
          await enterNative(nativeCall);
          nativeCall.markProviderResultPersisted(false);
          return 'empty';
        },
      }),
    ).resolves.toBe('empty');
    const remaining = JSON.parse(mocks.storage.get(mod.STORE_TRANSACTION_NOTICE_STORAGE_KEY)!) as {
      notices: unknown[];
    };
    expect(remaining.notices).toHaveLength(16);
  });

  it('enables fixtures only in an explicit development runtime', async () => {
    const mod = await loadModule();
    for (const fixture of [
      'purchase_unconfirmed',
      'payment_pending',
      'deleted_account_pending',
      'foreign_pending',
    ]) {
      expect(
        mod.shouldSeedStoreTransactionNoticeE2E({
          appEnvironment: 'development',
          fixture,
          isDev: true,
        }),
      ).toBe(true);
      expect(
        mod.shouldSeedStoreTransactionNoticeE2E({
          appEnvironment: 'production',
          fixture,
          isDev: true,
        }),
      ).toBe(false);
    }
    expect(
      mod.shouldSeedStoreTransactionNoticeE2E({
        appEnvironment: 'production',
        fixture: 'purchase_unconfirmed',
        isDev: true,
      }),
    ).toBe(false);
    expect(
      mod.shouldSeedStoreTransactionNoticeE2E({
        appEnvironment: 'development',
        fixture: 'provider-user-123',
        isDev: true,
      }),
    ).toBe(false);
  });

  it('seeds every allowlisted UI state through the guarded fixture path', async () => {
    vi.stubGlobal('__DEV__', true);
    const expected = {
      purchase_unconfirmed: {
        kind: 'owner_pending',
        reason: 'completion_unconfirmed',
      },
      payment_pending: {
        kind: 'owner_pending',
        reason: 'payment_pending',
      },
      deleted_account_pending: { kind: 'deleted_account_pending' },
      foreign_pending: { kind: 'another_account_pending' },
    } as const;

    for (const [fixture, notice] of Object.entries(expected)) {
      mocks.storage.clear();
      vi.stubEnv('EXPO_PUBLIC_E2E_STORE_TRANSACTION_NOTICE', fixture);
      const mod = await loadModule();
      await mod.seedStoreTransactionNoticeE2E(OWNER_A);
      await expect(mod.readStoreTransactionNotice(OWNER_A)).resolves.toEqual(notice);
    }
  });
});
