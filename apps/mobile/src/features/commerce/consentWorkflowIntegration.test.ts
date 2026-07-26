import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  declineHealthDataCollectionConsent,
  grantHealthDataCollectionConsent,
} from '../onboarding/healthConsent';
import { persistSettingsPrivacyConsentChoice } from '../settings/privacyConsentPersistence';
import { grantCommerceConsent } from './consent';

const mocks = vi.hoisted(() => ({
  clearCommerceConsentLocal: vi.fn(),
  getLatestConsentsWithLease: vi.fn(),
  readCommerceConsentLocal: vi.fn(),
  recordConsent: vi.fn(),
  setCommerceConsentLocal: vi.fn(),
  setHealthDataCollectionConsentLocal: vi.fn(),
  track: vi.fn(),
  withdrawConsent: vi.fn(),
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));
vi.mock('@/lib/consent/consent', () => ({
  getLatestConsentsWithLease: mocks.getLatestConsentsWithLease,
  recordConsent: mocks.recordConsent,
}));
vi.mock('@/lib/consent/withdrawal', () => ({
  withdrawConsent: mocks.withdrawConsent,
}));
vi.mock('./store', () => ({
  clearCommerceConsentLocal: mocks.clearCommerceConsentLocal,
  COMMERCE_CONSENT_WITHDRAWAL_PENDING: 'COMMERCE_CONSENT_WITHDRAWAL_PENDING',
  readCommerceConsentLocal: mocks.readCommerceConsentLocal,
  setCommerceConsentLocal: mocks.setCommerceConsentLocal,
}));
vi.mock('../onboarding/healthConsentStore', () => ({
  setHealthDataCollectionConsentLocal: mocks.setHealthDataCollectionConsentLocal,
}));
vi.mock('@/lib/storage/privateBoolean', () => ({
  requirePrivateBoolean: (result: { status: string; value?: boolean }) => {
    if (result.status === 'available') return result.value === true;
    throw new Error('PRIVATE_BOOLEAN_UNAVAILABLE');
  },
}));

function deferred(): Readonly<{ promise: Promise<void>; resolve: () => void }> {
  let resolve!: () => void;
  const promise = new Promise<void>((release) => {
    resolve = release;
  });
  return { promise, resolve };
}

describe('cross-surface consent workflow serialization', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.clearCommerceConsentLocal.mockResolvedValue(undefined);
    mocks.getLatestConsentsWithLease.mockResolvedValue({});
    mocks.readCommerceConsentLocal.mockResolvedValue({ status: 'absent' });
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.setCommerceConsentLocal.mockResolvedValue(undefined);
    mocks.setHealthDataCollectionConsentLocal.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
  });

  it('finishes a slow commerce grant before a later Settings decline can complete', async () => {
    const slowGrant = deferred();
    const events: string[] = [];
    mocks.setCommerceConsentLocal.mockImplementation(async (granted: boolean) => {
      events.push(`local:${String(granted)}`);
    });
    mocks.recordConsent.mockImplementationOnce(async () => {
      events.push('grant:started');
      await slowGrant.promise;
      events.push('grant:completed');
    });
    mocks.withdrawConsent.mockImplementationOnce(async () => {
      events.push('withdrawal:completed');
    });
    mocks.clearCommerceConsentLocal.mockImplementationOnce(async () => {
      events.push('local:cleared');
    });

    const grant = grantCommerceConsent();
    await vi.waitFor(() => expect(events).toEqual(['local:true', 'grant:started']));

    let declineSettled = false;
    const decline = persistSettingsPrivacyConsentChoice(createOwnerQueryScope(), {
      type: 'data_sharing',
      granted: false,
    }).finally(() => {
      declineSettled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(declineSettled).toBe(false);
    expect(events).toEqual(['local:true', 'grant:started']);

    slowGrant.resolve();
    await expect(grant).resolves.toBeUndefined();
    await expect(decline).resolves.toEqual({ remote: 'confirmed' });
    expect(events).toEqual([
      'local:true',
      'grant:started',
      'grant:completed',
      'local:false',
      'withdrawal:completed',
      'local:cleared',
    ]);
  });

  it('finishes a slow Settings decline before a later commerce grant can start', async () => {
    const slowWithdrawal = deferred();
    const events: string[] = [];
    mocks.setCommerceConsentLocal.mockImplementation(async (granted: boolean) => {
      events.push(`local:${String(granted)}`);
    });
    mocks.withdrawConsent.mockImplementationOnce(async () => {
      events.push('withdrawal:started');
      await slowWithdrawal.promise;
      events.push('withdrawal:completed');
    });
    mocks.clearCommerceConsentLocal.mockImplementationOnce(async () => {
      events.push('local:cleared');
    });
    mocks.recordConsent.mockImplementationOnce(async () => {
      events.push('grant:completed');
    });

    const decline = persistSettingsPrivacyConsentChoice(createOwnerQueryScope(), {
      type: 'data_sharing',
      granted: false,
    });
    await vi.waitFor(() => expect(events).toEqual(['local:false', 'withdrawal:started']));

    let grantSettled = false;
    const grant = grantCommerceConsent().finally(() => {
      grantSettled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(grantSettled).toBe(false);
    expect(events).toEqual(['local:false', 'withdrawal:started']);

    slowWithdrawal.resolve();
    await expect(decline).resolves.toEqual({ remote: 'confirmed' });
    await expect(grant).resolves.toBeUndefined();
    expect(events).toEqual([
      'local:false',
      'withdrawal:started',
      'withdrawal:completed',
      'local:cleared',
      'local:true',
      'grant:completed',
    ]);
  });

  it('finishes a slow commerce grant before a later health decline can start', async () => {
    const slowGrant = deferred();
    const events: string[] = [];
    mocks.setCommerceConsentLocal.mockImplementation(async () => {
      events.push('commerce:local');
    });
    mocks.setHealthDataCollectionConsentLocal.mockImplementation(async ({ granted }) => {
      events.push(`health:local:${String(granted)}`);
    });
    mocks.recordConsent
      .mockImplementationOnce(async () => {
        events.push('commerce:ledger-started');
        await slowGrant.promise;
        events.push('commerce:ledger-finished');
      })
      .mockImplementationOnce(async () => {
        events.push('health:ledger');
      });

    const commerce = grantCommerceConsent();
    await vi.waitFor(() => expect(events).toEqual(['commerce:local', 'commerce:ledger-started']));
    const health = declineHealthDataCollectionConsent();
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['commerce:local', 'commerce:ledger-started']);

    slowGrant.resolve();
    await expect(Promise.all([commerce, health])).resolves.toEqual([undefined, undefined]);
    expect(events).toEqual([
      'commerce:local',
      'commerce:ledger-started',
      'commerce:ledger-finished',
      'health:local:false',
      'health:ledger',
    ]);
  });

  it('finishes a slow health grant before a later Settings withdrawal can start', async () => {
    const slowGrant = deferred();
    const events: string[] = [];
    mocks.setHealthDataCollectionConsentLocal.mockImplementation(async ({ granted }) => {
      events.push(`health:local:${String(granted)}`);
    });
    mocks.recordConsent.mockImplementationOnce(async () => {
      events.push('health:ledger-started');
      await slowGrant.promise;
      events.push('health:ledger-finished');
    });
    mocks.setCommerceConsentLocal.mockImplementation(async (granted: boolean) => {
      events.push(`commerce:local:${String(granted)}`);
    });
    mocks.withdrawConsent.mockImplementation(async () => {
      events.push('commerce:withdrawal');
    });
    mocks.clearCommerceConsentLocal.mockImplementation(async () => {
      events.push('commerce:cleared');
    });

    const health = grantHealthDataCollectionConsent();
    await vi.waitFor(() => expect(events).toEqual(['health:local:true', 'health:ledger-started']));
    const commerce = persistSettingsPrivacyConsentChoice(createOwnerQueryScope(), {
      type: 'data_sharing',
      granted: false,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['health:local:true', 'health:ledger-started']);

    slowGrant.resolve();
    await expect(Promise.all([health, commerce])).resolves.toEqual([
      undefined,
      { remote: 'confirmed' },
    ]);
    expect(events).toEqual([
      'health:local:true',
      'health:ledger-started',
      'health:ledger-finished',
      'commerce:local:false',
      'commerce:withdrawal',
      'commerce:cleared',
    ]);
  });
});
