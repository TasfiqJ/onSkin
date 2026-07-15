import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { deriveState, type StoredEntitlement } from './entitlement';
import { publishEntitlementQueryAcceptance } from './entitlementQuery';
import { reconcileEntitlementTrialReminder } from './entitlementReminder';

vi.mock('@/features/notifications/deliver', () => ({
  scheduleTrialReminder: vi.fn(),
  cancelTrialReminder: vi.fn(),
}));
vi.mock('./store', () => ({ readEntitlementCache: vi.fn() }));

const NOW = '2026-07-05T12:00:00.000Z';

afterEach(() => vi.useRealTimers());

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
  it('schedules an active carded trial and cancels for non-trial evidence', async () => {
    const scheduleTrialReminder = vi.fn().mockResolvedValue(undefined);
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
      const scheduleTrialReminder = vi.fn().mockResolvedValue(undefined);
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
      }) => Promise<void>;
      cancelTrialReminder: () => Promise<void>;
    };
    const olderDelivery = deferred<{
      scheduleTrialReminder: Delivery['scheduleTrialReminder'];
      cancelTrialReminder: Delivery['cancelTrialReminder'];
    }>();
    const effects: string[] = [];
    const scheduleTrialReminder = vi.fn<Delivery['scheduleTrialReminder']>(async () => {
      effects.push('schedule');
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
});
