import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  persistSettingsPrivacyConsentChoice,
  retryableSettingsPrivacyChoice,
} from './privacyConsentPersistence';

vi.mock('@/features/commerce/store', () => ({
  clearCommerceConsentLocal: vi.fn(),
  COMMERCE_CONSENT_WITHDRAWAL_PENDING: 'COMMERCE_CONSENT_WITHDRAWAL_PENDING',
  readCommerceConsentLocal: vi.fn(),
  setCommerceConsentLocal: vi.fn(),
}));
vi.mock('@/lib/consent/consent', () => ({
  recordConsent: vi.fn(),
}));
vi.mock('@/lib/consent/withdrawal', () => ({
  withdrawConsent: vi.fn(),
}));
vi.mock('@/lib/storage/privateBoolean', () => ({
  requirePrivateBoolean: (result: { status: string; value?: boolean }) => {
    if (result.status === 'available') return result.value === true;
    throw new Error('PRIVATE_BOOLEAN_UNAVAILABLE');
  },
}));

type PersistenceDeps = NonNullable<Parameters<typeof persistSettingsPrivacyConsentChoice>[2]>;

const mocks = {
  clearCommerceConsentLocal: vi.fn<PersistenceDeps['clearCommerceConsentLocal']>(),
  readCommerceConsentLocal: vi.fn<PersistenceDeps['readCommerceConsentLocal']>(),
  recordConsent: vi.fn<PersistenceDeps['recordConsent']>(),
  setCommerceConsentLocal: vi.fn<PersistenceDeps['setCommerceConsentLocal']>(),
  withdrawConsent: vi.fn<PersistenceDeps['withdrawConsent']>(),
};

let boundaryActive = false;

afterEach(() => {
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('Settings privacy consent persistence', () => {
  beforeEach(() => {
    mocks.clearCommerceConsentLocal.mockReset();
    mocks.readCommerceConsentLocal.mockReset();
    mocks.recordConsent.mockReset();
    mocks.setCommerceConsentLocal.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.clearCommerceConsentLocal.mockResolvedValue(undefined);
    mocks.readCommerceConsentLocal.mockResolvedValue({ status: 'absent' });
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.setCommerceConsentLocal.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
  });

  it('saves a data-sharing grant locally before recording only a granted ledger row', async () => {
    const events: string[] = [];
    mocks.setCommerceConsentLocal.mockImplementationOnce(async (granted) => {
      events.push(`local:${String(granted)}`);
    });
    mocks.recordConsent.mockImplementationOnce(async ({ granted }) => {
      events.push(`ledger:${String(granted)}`);
    });

    await expect(
      persistSettingsPrivacyConsentChoice(
        createOwnerQueryScope(),
        { type: 'data_sharing', granted: true },
        mocks,
      ),
    ).resolves.toEqual({ remote: 'confirmed' });

    expect(events).toEqual(['local:true', 'ledger:true']);
    expect(mocks.recordConsent).toHaveBeenCalledWith({
      type: 'data_sharing',
      granted: true,
      version: expect.any(String),
      consentText: expect.stringContaining('data_sharing'),
    });
    expect(mocks.withdrawConsent).not.toHaveBeenCalled();
  });

  it('retains the existing offline-local data-sharing grant behavior', async () => {
    let local = false;
    mocks.setCommerceConsentLocal.mockImplementationOnce(async (granted) => {
      local = granted;
    });
    mocks.recordConsent.mockRejectedValueOnce(new Error('offline'));

    await expect(
      persistSettingsPrivacyConsentChoice(
        createOwnerQueryScope(),
        { type: 'data_sharing', granted: true },
        mocks,
      ),
    ).resolves.toEqual({ remote: 'deferred' });

    expect(local).toBe(true);
    expect(mocks.withdrawConsent).not.toHaveBeenCalled();
  });

  it('locks data sharing locally before confirming withdrawal and never records false directly', async () => {
    const events: string[] = [];
    mocks.setCommerceConsentLocal.mockImplementationOnce(async (granted) => {
      events.push(`local:${String(granted)}`);
    });
    mocks.withdrawConsent.mockImplementationOnce(async ({ type }) => {
      events.push(`withdraw:${type}`);
    });
    mocks.clearCommerceConsentLocal.mockImplementationOnce(async () => {
      events.push('local:cleared');
    });

    await expect(
      persistSettingsPrivacyConsentChoice(
        createOwnerQueryScope(),
        { type: 'data_sharing', granted: false },
        mocks,
      ),
    ).resolves.toEqual({ remote: 'confirmed' });

    expect(events).toEqual(['local:false', 'withdraw:data_sharing', 'local:cleared']);
    expect(mocks.withdrawConsent).toHaveBeenCalledWith({
      type: 'data_sharing',
      version: expect.any(String),
      consentText: expect.stringContaining('data_sharing'),
    });
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it('relocks the owner cache before withdrawal and clears pending only after exact success', async () => {
    const events: string[] = [];
    mocks.setCommerceConsentLocal.mockImplementationOnce(async () => {
      events.push('local:false');
    });
    mocks.withdrawConsent.mockImplementationOnce(async () => {
      events.push('withdraw:ack');
    });
    mocks.clearCommerceConsentLocal.mockImplementationOnce(async () => {
      events.push('local:cleared');
    });

    await persistSettingsPrivacyConsentChoice(
      createOwnerQueryScope(),
      {
        type: 'data_sharing',
        granted: false,
        onLocalDataSharingSaved: () => {
          events.push('cache:locked');
        },
        onDataSharingWithdrawalCompleted: () => {
          events.push('cache:pending-cleared');
        },
      },
      mocks,
    );

    expect(events).toEqual([
      'local:false',
      'cache:locked',
      'withdraw:ack',
      'local:cleared',
      'cache:pending-cleared',
    ]);
  });

  it('retains a local data-sharing revocation but rejects unconfirmed remote cleanup', async () => {
    let local = true;
    mocks.setCommerceConsentLocal.mockImplementationOnce(async (granted) => {
      local = granted;
    });
    mocks.withdrawConsent.mockRejectedValueOnce(new Error('cleanup unavailable'));

    await expect(
      persistSettingsPrivacyConsentChoice(
        createOwnerQueryScope(),
        { type: 'data_sharing', granted: false },
        mocks,
      ),
    ).rejects.toThrow('cleanup unavailable');

    expect(local).toBe(false);
    expect(mocks.clearCommerceConsentLocal).not.toHaveBeenCalled();
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it('preserves pending false across relaunch and blocks a regrant until cleanup completes', async () => {
    mocks.readCommerceConsentLocal.mockResolvedValueOnce({
      status: 'available',
      value: false,
      format: 'current',
    });

    await expect(
      persistSettingsPrivacyConsentChoice(
        createOwnerQueryScope(),
        { type: 'data_sharing', granted: true },
        mocks,
      ),
    ).rejects.toThrow('COMMERCE_CONSENT_WITHDRAWAL_PENDING');

    expect(mocks.setCommerceConsentLocal).not.toHaveBeenCalled();
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it('retries the exact failed false choice only for the current owner generation', () => {
    const scope = createOwnerQueryScope();
    const failed = {
      granted: false,
      ownerGeneration: scope.generation,
      placement: 'privacy' as const,
      type: 'data_sharing' as const,
    };

    expect(retryableSettingsPrivacyChoice(failed, scope)).toEqual({
      granted: false,
      placement: 'privacy',
      type: 'data_sharing',
    });

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    expect(retryableSettingsPrivacyChoice(failed, scope)).toBeNull();
  });

  it('records a marketing grant and routes a marketing revocation through withdrawal', async () => {
    await expect(
      persistSettingsPrivacyConsentChoice(
        createOwnerQueryScope(),
        { type: 'marketing', granted: true },
        mocks,
      ),
    ).resolves.toEqual({ remote: 'confirmed' });

    expect(mocks.recordConsent).toHaveBeenCalledWith({
      type: 'marketing',
      granted: true,
      version: expect.any(String),
      consentText: expect.stringContaining('marketing'),
    });
    expect(mocks.setCommerceConsentLocal).not.toHaveBeenCalled();
    expect(mocks.clearCommerceConsentLocal).not.toHaveBeenCalled();
    expect(mocks.withdrawConsent).not.toHaveBeenCalled();

    mocks.recordConsent.mockClear();
    await expect(
      persistSettingsPrivacyConsentChoice(
        createOwnerQueryScope(),
        { type: 'marketing', granted: false },
        mocks,
      ),
    ).resolves.toEqual({ remote: 'confirmed' });

    expect(mocks.withdrawConsent).toHaveBeenCalledWith({
      type: 'marketing',
      version: expect.any(String),
      consentText: expect.stringContaining('marketing'),
    });
    expect(mocks.recordConsent).not.toHaveBeenCalled();
    expect(mocks.setCommerceConsentLocal).not.toHaveBeenCalled();
  });

  it('rejects a marketing withdrawal failure instead of publishing it as saved', async () => {
    mocks.withdrawConsent.mockRejectedValueOnce(new Error('cleanup unavailable'));

    await expect(
      persistSettingsPrivacyConsentChoice(
        createOwnerQueryScope(),
        { type: 'marketing', granted: false },
        mocks,
      ),
    ).rejects.toThrow('cleanup unavailable');

    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it('does no work for a stale owner scope', async () => {
    const staleScope = createOwnerQueryScope();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(
      persistSettingsPrivacyConsentChoice(
        staleScope,
        { type: 'data_sharing', granted: false },
        mocks,
      ),
    ).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });

    expect(mocks.setCommerceConsentLocal).not.toHaveBeenCalled();
    expect(mocks.withdrawConsent).not.toHaveBeenCalled();
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });

  it('never starts remote consent work after a delayed local write crosses an owner boundary', async () => {
    let releaseLocal!: () => void;
    mocks.setCommerceConsentLocal.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseLocal = resolve;
        }),
    );
    const persistence = persistSettingsPrivacyConsentChoice(
      createOwnerQueryScope(),
      { type: 'data_sharing', granted: false },
      mocks,
    );
    await vi.waitFor(() => expect(mocks.setCommerceConsentLocal).toHaveBeenCalledWith(false));

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(persistence).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.withdrawConsent).not.toHaveBeenCalled();
    expect(mocks.recordConsent).not.toHaveBeenCalled();

    releaseLocal();
    await Promise.resolve();
  });

  it('suppresses a delayed pending-cache callback after an owner boundary', async () => {
    let releaseLocal!: () => void;
    const onLocalDataSharingSaved = vi.fn();
    mocks.setCommerceConsentLocal.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseLocal = resolve;
        }),
    );
    const persistence = persistSettingsPrivacyConsentChoice(
      createOwnerQueryScope(),
      { type: 'data_sharing', granted: false, onLocalDataSharingSaved },
      mocks,
    );
    await vi.waitFor(() => expect(mocks.setCommerceConsentLocal).toHaveBeenCalledWith(false));

    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseLocal();

    await expect(persistence).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(onLocalDataSharingSaved).not.toHaveBeenCalled();
    expect(mocks.withdrawConsent).not.toHaveBeenCalled();
  });
});
