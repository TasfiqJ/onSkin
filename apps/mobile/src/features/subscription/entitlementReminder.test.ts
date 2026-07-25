import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { deriveState, type StoredEntitlement } from './entitlement';
import { publishEntitlementQueryAcceptance } from './entitlementQuery';
import {
  reconcileLocalEntitlementTrialReminder,
  reconcileEntitlementTrialReminder,
} from './entitlementReminder';
import type { EntitlementCacheRead } from './store';

const mocks = vi.hoisted(() => ({
  readEntitlementCache: vi.fn(),
}));

vi.mock('@/features/notifications/deliver', () => ({
  scheduleTrialReminder: vi.fn(),
  cancelTrialReminder: vi.fn(),
}));
vi.mock('./store', () => ({ readEntitlementCache: mocks.readEntitlementCache }));

const NOW = '2026-07-05T12:00:00.000Z';
let boundaryActive = false;

beforeEach(() => {
  mocks.readEntitlementCache.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

function entitlement(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'trial',
    store: 'app_store',
    productId: 'routinekind_pro_annual',
    expiresAt: '2026-07-19T12:00:00.000Z',
    willRenew: true,
    grantedAt: NOW,
    source: 'revenuecat',
    environment: 'production',
    managementUrl: null,
    verifiedAt: NOW,
    offeringId: 'default',
    packageId: 'annual',
    storeUserId: 'owner-a',
    priceLabel: '$49.99/year',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('entitlement trial reminder reconciliation', () => {
  it('restores an active trial reminder from authoritative cached entitlement evidence', async () => {
    const scheduleTrialReminder = vi.fn().mockResolvedValue(true);
    const cancelTrialReminder = vi.fn().mockResolvedValue(undefined);
    mocks.readEntitlementCache.mockResolvedValueOnce({
      status: 'available',
      entitlement: entitlement(),
    } satisfies EntitlementCacheRead);

    await expect(
      reconcileLocalEntitlementTrialReminder(createOwnerQueryScope(), {
        expectedStoreUserId: 'owner-a',
        nowMs: () => Date.parse(NOW),
        appEnvironment: 'production',
        loadDelivery: async () => ({ scheduleTrialReminder, cancelTrialReminder }),
      }),
    ).resolves.toBe('scheduled');

    expect(mocks.readEntitlementCache).toHaveBeenCalledWith({
      expectedStoreUserId: 'owner-a',
    });
    expect(scheduleTrialReminder).toHaveBeenCalledWith({
      expiresAt: '2026-07-19T12:00:00.000Z',
      priceLabel: '$49.99/year',
    });
    expect(cancelTrialReminder).not.toHaveBeenCalled();
  });

  it('cancels the trial reminder only for authoritative absent cache evidence', async () => {
    const scheduleTrialReminder = vi.fn().mockResolvedValue(true);
    const cancelTrialReminder = vi.fn().mockResolvedValue(undefined);
    mocks.readEntitlementCache.mockResolvedValueOnce({
      status: 'absent',
      entitlement: null,
    } satisfies EntitlementCacheRead);

    await expect(
      reconcileLocalEntitlementTrialReminder(createOwnerQueryScope(), {
        nowMs: () => Date.parse(NOW),
        appEnvironment: 'production',
        loadDelivery: async () => ({ scheduleTrialReminder, cancelTrialReminder }),
      }),
    ).resolves.toBe('cancelled');

    expect(mocks.readEntitlementCache).toHaveBeenCalledWith({});
    expect(scheduleTrialReminder).not.toHaveBeenCalled();
    expect(cancelTrialReminder).toHaveBeenCalledOnce();
  });

  it.each(['unavailable', 'corrupt', 'unsupported_version'] as const)(
    'rejects %s cache evidence without collapsing it to a reminder cancellation',
    async (status) => {
      const scheduleTrialReminder = vi.fn().mockResolvedValue(true);
      const cancelTrialReminder = vi.fn().mockResolvedValue(undefined);
      mocks.readEntitlementCache.mockResolvedValueOnce({
        status,
        entitlement: null,
      } satisfies EntitlementCacheRead);

      await expect(
        reconcileLocalEntitlementTrialReminder(createOwnerQueryScope(), {
          expectedStoreUserId: 'owner-a',
          nowMs: () => Date.parse(NOW),
          appEnvironment: 'production',
          loadDelivery: async () => ({ scheduleTrialReminder, cancelTrialReminder }),
        }),
      ).rejects.toMatchObject({
        name: 'EntitlementReminderUnreadableEvidenceError',
        code: 'ENTITLEMENT_REMINDER_EVIDENCE_UNREADABLE',
        evidenceStatus: status,
      });

      expect(scheduleTrialReminder).not.toHaveBeenCalled();
      expect(cancelTrialReminder).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['stale', '2026-07-01T12:00:00.000Z'],
    ['invalid', '2026-07-05T13:00:00.000Z'],
  ] as const)(
    'preserves an existing trial reminder when available cache evidence derives as %s',
    async (evidenceStatus, verifiedAt) => {
      const scheduleTrialReminder = vi.fn().mockResolvedValue(true);
      const cancelTrialReminder = vi.fn().mockResolvedValue(undefined);
      mocks.readEntitlementCache.mockResolvedValueOnce({
        status: 'available',
        entitlement: entitlement({ verifiedAt }),
      } satisfies EntitlementCacheRead);

      await expect(
        reconcileLocalEntitlementTrialReminder(createOwnerQueryScope(), {
          expectedStoreUserId: 'owner-a',
          nowMs: () => Date.parse(NOW),
          appEnvironment: 'production',
          loadDelivery: async () => ({ scheduleTrialReminder, cancelTrialReminder }),
        }),
      ).rejects.toMatchObject({
        code: 'ENTITLEMENT_REMINDER_EVIDENCE_UNREADABLE',
        evidenceStatus,
      });

      expect(scheduleTrialReminder).not.toHaveBeenCalled();
      expect(cancelTrialReminder).not.toHaveBeenCalled();
    },
  );

  it('fences a delayed authoritative read across an account boundary', async () => {
    const cacheRead = deferred<EntitlementCacheRead>();
    const scheduleTrialReminder = vi.fn().mockResolvedValue(true);
    const cancelTrialReminder = vi.fn().mockResolvedValue(undefined);
    let markReadStarted!: () => void;
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.readEntitlementCache.mockImplementationOnce(() => {
      markReadStarted();
      return cacheRead.promise;
    });

    const pending = reconcileLocalEntitlementTrialReminder(createOwnerQueryScope(), {
      expectedStoreUserId: 'owner-a',
      nowMs: () => Date.parse(NOW),
      appEnvironment: 'production',
      loadDelivery: async () => ({ scheduleTrialReminder, cancelTrialReminder }),
    });
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });
    await readStarted;

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await waitForAccountGenerationOperationsToSettle();
    await rejected;

    expect(scheduleTrialReminder).not.toHaveBeenCalled();
    expect(cancelTrialReminder).not.toHaveBeenCalled();

    cacheRead.resolve({
      status: 'available',
      entitlement: entitlement(),
    });
    await Promise.resolve();
    expect(scheduleTrialReminder).not.toHaveBeenCalled();
    expect(cancelTrialReminder).not.toHaveBeenCalled();
  });

  it('schedules an active carded trial and cancels for non-trial evidence', async () => {
    const scheduleTrialReminder = vi.fn().mockResolvedValue(true);
    const cancelTrialReminder = vi.fn().mockResolvedValue(undefined);
    const options = {
      nowMs: () => Date.parse(NOW),
      loadDelivery: async () => ({ scheduleTrialReminder, cancelTrialReminder }),
    };

    await expect(
      reconcileEntitlementTrialReminder(
        createOwnerQueryScope(),
        deriveState(entitlement(), NOW, 'fresh'),
        options,
      ),
    ).resolves.toBe('scheduled');
    await expect(
      reconcileEntitlementTrialReminder(
        createOwnerQueryScope(),
        deriveState(entitlement({ periodType: 'normal' }), NOW, 'fresh'),
        options,
      ),
    ).resolves.toBe('cancelled');
    expect(scheduleTrialReminder).toHaveBeenCalledOnce();
    expect(cancelTrialReminder).toHaveBeenCalledOnce();
  });

  it.each(['schedule', 'cancel'] as const)(
    'keeps accepted access successful when reminder %s rejects',
    async (operation) => {
      const scheduleTrialReminder = vi.fn().mockImplementation(async () => {
        if (operation === 'schedule') throw new Error('schedule failed');
        return true;
      });
      const cancelTrialReminder = vi.fn().mockImplementation(async () => {
        if (operation === 'cancel') throw new Error('cancel failed');
      });

      await expect(
        reconcileEntitlementTrialReminder(
          createOwnerQueryScope(),
          deriveState(
            operation === 'schedule' ? entitlement() : entitlement({ periodType: 'normal' }),
            NOW,
            'fresh',
          ),
          {
            nowMs: () => Date.parse(NOW),
            loadDelivery: async () => ({ scheduleTrialReminder, cancelTrialReminder }),
          },
        ),
      ).resolves.toBe('failed');
    },
  );

  it.each([
    ['newer trial', 'trial', 'schedule'] as const,
    ['newer paid access', 'normal', 'cancel'] as const,
  ])(
    'reconciles the published %s winner instead of an older acceptance',
    async (_label, winningPeriod, expectedAction) => {
      const client = new QueryClient();
      const scope = createOwnerQueryScope();
      const observedNow = '2026-07-05T12:03:00.000Z';
      vi.useFakeTimers();
      vi.setSystemTime(Date.parse(observedNow));
      const winner = deriveState(
        entitlement({
          periodType: winningPeriod,
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
        observedNow,
        'fresh',
      );
      client.setQueryData(queryKeys.entitlement(scope), winner);
      const published = publishEntitlementQueryAcceptance(
        client,
        scope,
        winningPeriod === 'trial'
          ? {
              entitlement: null,
              revenueCatEmpty: {
                verifiedAt: '2026-07-05T12:01:00.000Z',
                storeUserId: 'owner-a',
              },
            }
          : {
              entitlement: entitlement({
                periodType: 'trial',
                verifiedAt: '2026-07-05T12:01:00.000Z',
              }),
              revenueCatEmpty: null,
            },
        observedNow,
        'production',
      );
      const scheduleTrialReminder = vi.fn().mockResolvedValue(true);
      const cancelTrialReminder = vi.fn().mockResolvedValue(undefined);

      await expect(
        reconcileEntitlementTrialReminder(scope, published, {
          nowMs: () => Date.parse(observedNow),
          loadDelivery: async () => ({ scheduleTrialReminder, cancelTrialReminder }),
        }),
      ).resolves.toBe(expectedAction === 'schedule' ? 'scheduled' : 'cancelled');
      expect(scheduleTrialReminder).toHaveBeenCalledTimes(expectedAction === 'schedule' ? 1 : 0);
      expect(cancelTrialReminder).toHaveBeenCalledTimes(expectedAction === 'cancel' ? 1 : 0);
      client.clear();
    },
  );

  it('serializes inverted completion so the newest cancellation wins', async () => {
    const scope = createOwnerQueryScope();
    type Delivery = {
      scheduleTrialReminder: (input: {
        expiresAt: string;
        priceLabel: string | null;
      }) => Promise<boolean>;
      cancelTrialReminder: () => Promise<void>;
    };
    const olderDelivery = deferred<{
      scheduleTrialReminder: Delivery['scheduleTrialReminder'];
      cancelTrialReminder: Delivery['cancelTrialReminder'];
    }>();
    const effects: string[] = [];
    const scheduleTrialReminder = vi.fn<Delivery['scheduleTrialReminder']>(async () => {
      effects.push('schedule');
      return true;
    });
    const cancelTrialReminder = vi.fn<Delivery['cancelTrialReminder']>(async () => {
      effects.push('cancel');
    });
    const older = reconcileEntitlementTrialReminder(
      scope,
      deriveState(entitlement(), NOW, 'fresh'),
      {
        nowMs: () => Date.parse(NOW),
        loadDelivery: () => olderDelivery.promise,
      },
    );
    const newer = reconcileEntitlementTrialReminder(
      scope,
      deriveState(entitlement({ periodType: 'normal' }), NOW, 'fresh'),
      {
        nowMs: () => Date.parse(NOW),
        loadDelivery: async () => ({ scheduleTrialReminder, cancelTrialReminder }),
      },
    );
    await Promise.resolve();
    expect(cancelTrialReminder).not.toHaveBeenCalled();

    olderDelivery.resolve({ scheduleTrialReminder, cancelTrialReminder });
    await expect(older).resolves.toBe('scheduled');
    await expect(newer).resolves.toBe('cancelled');
    expect(effects).toEqual(['schedule', 'cancel']);
  });

  it('reports a permission-blocked trial reminder as cancelled instead of scheduled', async () => {
    const scheduleTrialReminder = vi.fn().mockResolvedValue(false);
    const cancelTrialReminder = vi.fn().mockResolvedValue(undefined);

    await expect(
      reconcileEntitlementTrialReminder(
        createOwnerQueryScope(),
        deriveState(entitlement(), NOW, 'fresh'),
        {
          nowMs: () => Date.parse(NOW),
          loadDelivery: async () => ({ scheduleTrialReminder, cancelTrialReminder }),
        },
      ),
    ).resolves.toBe('cancelled');

    expect(scheduleTrialReminder).toHaveBeenCalledOnce();
    expect(cancelTrialReminder).not.toHaveBeenCalled();
  });
});
