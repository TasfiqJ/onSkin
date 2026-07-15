import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  grantHealthDependentConsent,
  isHealthDependentConsentActive,
  refuseHealthDependentConsent,
  withdrawHealthDependentConsent,
} from './dependentConsentLifecycle';
import {
  beginHealthDependentConsentCheck,
  publishHealthDependentConsentActive,
  resetHealthDependentConsentLeasesForTests,
  runHealthDependentConsentOperation,
} from './dependentConsentLease';

const mocks = vi.hoisted(() => ({
  appEnvironment: 'development' as 'development' | 'staging' | 'production',
  configured: true,
  healthGeneration: 1,
  status: vi.fn(),
  record: vi.fn(),
  withdraw: vi.fn(),
  readTombstone: vi.fn(),
  writeTombstone: vi.fn(),
  clearTombstone: vi.fn(),
  readReceipt: vi.fn(),
  writeReceipt: vi.fn(),
  removeReceipt: vi.fn(),
  tombstone: null as null | Record<string, unknown>,
  random: vi.fn(),
  callOrder: [] as string[],
}));

vi.mock('@/lib/env', () => ({
  env: {
    get appEnvironment() {
      return mocks.appEnvironment;
    },
  },
  get isSupabaseConfigured() { return mocks.configured; },
}));
vi.mock('@/lib/auth/accountGeneration', () => ({
  runAccountGenerationOperation: async (operation: (lease: {
    generation: number;
    signal: AbortSignal;
    assertCurrent: () => void;
  }) => unknown) => operation({
    generation: 3,
    signal: new AbortController().signal,
    assertCurrent: () => undefined,
  }),
}));
vi.mock('./healthProcessingEpoch', () => ({
  activeHealthProcessingLeaseSnapshot: (owner?: string) =>
    owner && owner !== 'user-a'
      ? null
      : {
          generation: mocks.healthGeneration,
          epoch: 7,
          ownerUserId: 'user-a',
          accountGeneration: 3,
          expiresAt: null,
        },
  registerDependentConsentTransportSnapshotProvider: vi.fn(),
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(async (_algorithm: string, text: string) =>
    createHash('sha256').update(text).digest('hex'),
  ),
  getRandomBytesAsync: mocks.random,
}));
vi.mock('./consent', () => ({
  getHealthDependentConsentStatus: mocks.status,
  recordConsent: mocks.record,
}));
vi.mock('./withdrawal', () => ({
  HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING: 'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING',
  withdrawConsent: mocks.withdraw,
}));
vi.mock('./dependentConsentLocal', () => ({
  clearDependentConsentWithdrawalTombstone: mocks.clearTombstone,
  readDependentConsentWithdrawalTombstone: mocks.readTombstone,
  readLocalDependentConsentReceipt: mocks.readReceipt,
  removeLocalDependentConsentReceipt: mocks.removeReceipt,
  writeDependentConsentWithdrawalTombstone: mocks.writeTombstone,
  writeLocalDependentConsentReceipt: mocks.writeReceipt,
}));

function status(state: 'unconsented' | 'active' | 'withdrawing' | 'withdrawn', generation: number) {
  return {
    consentType: 'data_sharing' as const,
    state,
    generation,
    healthEpoch: 7,
    version: state === 'unconsented' ? null : 'v',
    consentTextHash: state === 'unconsented' ? null : 'a'.repeat(64),
  };
}

function tombstone(
  state: 'pending' | 'withdrawn' = 'pending',
  generation: number | null = 4,
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: 1,
    type: 'data_sharing',
    ownerUserId: 'user-a',
    state,
    authority: 'remote_required' as const,
    resumeMode: 'local_intent' as const,
    healthEpoch: 7,
    expectedConsentGeneration: generation,
    observedConsentGeneration: generation,
    idempotencyKey: '11'.repeat(32),
    version: 'v',
    consentTextHash: 'a'.repeat(64),
    requestedAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('dependent consent lifecycle', () => {
  beforeEach(() => {
    resetHealthDependentConsentLeasesForTests();
    mocks.appEnvironment = 'development';
    mocks.configured = true;
    mocks.healthGeneration = 1;
    mocks.callOrder.length = 0;
    mocks.tombstone = null;
    mocks.random.mockReset();
    mocks.random.mockResolvedValue(Uint8Array.from({ length: 32 }, () => 7));
    mocks.status.mockReset();
    mocks.status.mockResolvedValue(status('active', 4));
    mocks.record.mockReset();
    mocks.record.mockResolvedValue(status('active', 5));
    mocks.withdraw.mockReset();
    mocks.withdraw.mockResolvedValue({
      operationId: 'op-1',
      consentType: 'data_sharing',
      processingEpoch: 7,
      consentGeneration: 5,
      replayed: false,
    });
    mocks.readTombstone.mockReset();
    mocks.readTombstone.mockImplementation(async () => mocks.tombstone);
    mocks.writeTombstone.mockReset();
    mocks.writeTombstone.mockImplementation(async (value: Record<string, unknown>) => {
      mocks.callOrder.push(`tombstone:${String(value.state)}`);
      mocks.tombstone = { ...tombstone(value.state as 'pending' | 'withdrawn'), ...value };
      return mocks.tombstone;
    });
    mocks.clearTombstone.mockReset();
    mocks.clearTombstone.mockImplementation(async () => { mocks.tombstone = null; });
    mocks.readReceipt.mockReset();
    mocks.readReceipt.mockResolvedValue(null);
    mocks.writeReceipt.mockReset();
    mocks.writeReceipt.mockImplementation(async () => { mocks.callOrder.push('receipt:write'); });
    mocks.removeReceipt.mockReset();
    mocks.removeReceipt.mockImplementation(async () => { mocks.callOrder.push('receipt:remove'); });
  });

  it('fails closed on a configured status outage without using a local receipt', async () => {
    mocks.status.mockRejectedValueOnce(new Error('configured outage'));
    mocks.readReceipt.mockResolvedValueOnce({ granted: true });
    await expect(isHealthDependentConsentActive('data_sharing')).resolves.toBe(false);
    expect(mocks.readReceipt).not.toHaveBeenCalled();
    await expect(
      runHealthDependentConsentOperation('data_sharing', async () => undefined),
    ).rejects.toThrow();
  });

  it('cleans second-device residue after authoritative remote withdrawal', async () => {
    mocks.appEnvironment = 'production';
    mocks.status.mockResolvedValueOnce(status('withdrawn', 5));
    const deletePurpose = vi.fn(async () => { mocks.callOrder.push('purpose:delete'); });
    await expect(
      isHealthDependentConsentActive('data_sharing', {
        deleteLocalOnAuthoritativeClose: deletePurpose,
      }),
    ).resolves.toBe(false);
    expect(deletePurpose).toHaveBeenCalledOnce();
    expect(mocks.callOrder.indexOf('tombstone:withdrawn')).toBeLessThan(
      mocks.callOrder.indexOf('purpose:delete'),
    );
  });

  it('cleans unconsented residue without creating a permanent pending barrier', async () => {
    mocks.status.mockResolvedValueOnce(status('unconsented', 0));
    await expect(
      isHealthDependentConsentActive('data_sharing', {
        deleteLocalOnAuthoritativeClose: vi.fn(async () => undefined),
      }),
    ).resolves.toBe(false);
    expect(mocks.tombstone).toBeNull();

    mocks.status.mockResolvedValueOnce(status('unconsented', 0));
    mocks.record.mockResolvedValueOnce(status('active', 1));
    await expect(grantHealthDependentConsent('data_sharing')).resolves.toBeUndefined();
  });

  it('confirms a never-consented refusal without creating a withdrawal tombstone', async () => {
    mocks.appEnvironment = 'production';
    mocks.status.mockResolvedValueOnce(status('unconsented', 0));
    const deletePurpose = vi.fn(async () => undefined);

    await expect(
      refuseHealthDependentConsent({
        type: 'data_sharing',
        deleteLocal: deletePurpose,
      }),
    ).resolves.toBeUndefined();

    expect(deletePurpose).toHaveBeenCalledOnce();
    expect(mocks.writeTombstone).not.toHaveBeenCalled();
    expect(mocks.withdraw).not.toHaveBeenCalled();
  });

  it('resumes kill-before-begin intent on relaunch with the original capability', async () => {
    mocks.tombstone = tombstone('pending', 4);
    mocks.status.mockResolvedValueOnce(status('active', 4));
    await expect(isHealthDependentConsentActive('data_sharing')).resolves.toBe(false);
    expect(mocks.withdraw).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedConsentGeneration: 4,
        idempotencyKey: '11'.repeat(32),
      }),
    );
    expect((mocks.tombstone as { state?: string } | null)?.state).toBe('withdrawn');
  });

  it('polls but never adopts a cross-device in-progress operation with a new key', async () => {
    mocks.status.mockResolvedValueOnce(status('withdrawing', 5));
    await expect(isHealthDependentConsentActive('data_sharing')).resolves.toBe(false);
    expect(mocks.withdraw).not.toHaveBeenCalled();
    expect((mocks.tombstone as { expectedConsentGeneration?: number | null } | null)
      ?.expectedConsentGeneration).toBeNull();
  });

  it('never applies a poll-only cross-device capability to a fresh active generation', async () => {
    mocks.tombstone = tombstone('pending', null, {
      resumeMode: 'poll_only',
      observedConsentGeneration: 5,
    });
    mocks.status.mockResolvedValueOnce(status('active', 6));

    await expect(isHealthDependentConsentActive('data_sharing')).resolves.toBe(false);

    expect(mocks.withdraw).not.toHaveBeenCalled();
    expect(mocks.clearTombstone).toHaveBeenCalledWith('user-a', 'data_sharing');
  });

  it('resumes active N, fails closed on active N+1, and retires on fresh active N+2', async () => {
    mocks.tombstone = tombstone('pending', 4);
    mocks.status.mockResolvedValueOnce(status('active', 4));
    await expect(isHealthDependentConsentActive('data_sharing')).resolves.toBe(false);
    expect(mocks.withdraw).toHaveBeenCalledOnce();

    resetHealthDependentConsentLeasesForTests();
    mocks.withdraw.mockClear();
    mocks.tombstone = tombstone('pending', 4);
    mocks.status.mockResolvedValueOnce(status('active', 5));
    await expect(isHealthDependentConsentActive('data_sharing')).resolves.toBe(false);
    expect(mocks.withdraw).not.toHaveBeenCalled();
    expect((mocks.tombstone as { state?: string } | null)?.state).toBe('pending');

    resetHealthDependentConsentLeasesForTests();
    mocks.tombstone = tombstone('pending', 4);
    mocks.status.mockResolvedValueOnce(status('active', 6));
    await expect(isHealthDependentConsentActive('data_sharing')).resolves.toBe(false);
    expect(mocks.withdraw).not.toHaveBeenCalled();
    expect(mocks.tombstone).toBeNull();
  });

  it('does not turn unexpected unconsented or wrong-generation withdrawn into terminal proof', async () => {
    mocks.tombstone = tombstone('pending', 4);
    mocks.status.mockResolvedValueOnce(status('unconsented', 0));
    await expect(isHealthDependentConsentActive('data_sharing')).resolves.toBe(false);
    expect((mocks.tombstone as { state?: string } | null)?.state).toBe('pending');
    expect(mocks.withdraw).not.toHaveBeenCalled();

    resetHealthDependentConsentLeasesForTests();
    mocks.tombstone = tombstone('pending', 4);
    mocks.status.mockResolvedValueOnce(status('withdrawn', 6));
    await expect(isHealthDependentConsentActive('data_sharing')).resolves.toBe(false);
    expect((mocks.tombstone as { state?: string } | null)?.state).toBe('pending');
    expect(mocks.withdraw).not.toHaveBeenCalled();
  });

  it('does not publish a configured grant when the exact CAS fails', async () => {
    mocks.record.mockRejectedValueOnce(new Error('stale generation'));
    await expect(grantHealthDependentConsent('data_sharing')).rejects.toThrow('stale generation');
    expect(mocks.writeReceipt).not.toHaveBeenCalled();
    await expect(
      runHealthDependentConsentOperation('data_sharing', async () => undefined),
    ).rejects.toThrow();
  });

  it('blocks a new production grant before starting its lifecycle', () => {
    mocks.appEnvironment = 'production';

    expect(() => grantHealthDependentConsent('data_sharing')).toThrow(
      'HEALTH_DEPENDENT_CONSENT_COPY_RELEASE_BLOCKED',
    );
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('closes before the first withdrawal await and persists pending before deletion', async () => {
    const active = beginHealthDependentConsentCheck('data_sharing');
    publishHealthDependentConsentActive({ lease: active, serverGeneration: 4 });
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const didStart = new Promise<void>((resolve) => { started = resolve; });
    mocks.readTombstone.mockImplementationOnce(async () => { started(); await gate; return null; });
    const pending = withdrawHealthDependentConsent({ type: 'data_sharing' });
    await didStart;
    await expect(
      runHealthDependentConsentOperation('data_sharing', async () => undefined),
    ).rejects.toThrow();
    release();
    await pending;
    expect(mocks.callOrder[0]).toBe('tombstone:pending');
  });

  it('starts remote intake during slow cleanup and publishes terminal only after both', async () => {
    mocks.appEnvironment = 'production';
    const active = beginHealthDependentConsentCheck('data_sharing');
    publishHealthDependentConsentActive({ lease: active, serverGeneration: 4 });
    let releaseCleanup!: () => void;
    const cleanupGate = new Promise<void>((resolve) => { releaseCleanup = resolve; });
    const deleteLocal = vi.fn(async () => cleanupGate);

    const pending = withdrawHealthDependentConsent({
      type: 'data_sharing',
      deleteLocal,
    });
    await vi.waitFor(() => expect(mocks.withdraw).toHaveBeenCalledOnce());
    expect(deleteLocal).toHaveBeenCalledOnce();
    expect((mocks.tombstone as { state?: string } | null)?.state).toBe('pending');

    releaseCleanup();
    await expect(pending).resolves.toBeUndefined();
    expect((mocks.tombstone as { state?: string } | null)?.state).toBe('withdrawn');
  });

  it('keeps a 202 response durably pending and visibly unsuccessful', async () => {
    const active = beginHealthDependentConsentCheck('data_sharing');
    publishHealthDependentConsentActive({ lease: active, serverGeneration: 4 });
    mocks.withdraw.mockRejectedValueOnce(
      new Error('HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING'),
    );
    await expect(
      withdrawHealthDependentConsent({ type: 'data_sharing' }),
    ).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING');
    expect((mocks.tombstone as { state?: string } | null)?.state).toBe('pending');
  });

  it('replays the original capability directly after a lost terminal response', async () => {
    mocks.appEnvironment = 'production';
    mocks.tombstone = tombstone('pending', 4);
    mocks.status.mockResolvedValueOnce(status('withdrawn', 5));
    await withdrawHealthDependentConsent({ type: 'data_sharing' });
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.withdraw).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedConsentGeneration: 4,
        idempotencyKey: '11'.repeat(32),
      }),
    );
    expect((mocks.tombstone as { state?: string } | null)?.state).toBe('withdrawn');
  });

  it('preserves original generation and idempotency on a lost-begin retry', async () => {
    mocks.tombstone = tombstone('pending', 4);
    mocks.status.mockResolvedValueOnce(status('withdrawing', 5));
    mocks.withdraw.mockRejectedValueOnce(
      new Error('HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING'),
    );
    await expect(
      withdrawHealthDependentConsent({ type: 'data_sharing' }),
    ).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING');
    expect(mocks.withdraw).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedConsentGeneration: 4,
        idempotencyKey: '11'.repeat(32),
      }),
    );
  });

  it('does not abandon withdrawal when same-owner base verification renews', async () => {
    const active = beginHealthDependentConsentCheck('data_sharing');
    publishHealthDependentConsentActive({ lease: active, serverGeneration: 4 });
    mocks.withdraw.mockImplementationOnce(async () => {
      mocks.healthGeneration += 1;
      return {
        operationId: 'op-1', consentType: 'data_sharing', processingEpoch: 7,
        consentGeneration: 5, replayed: false,
      };
    });
    await expect(
      withdrawHealthDependentConsent({ type: 'data_sharing' }),
    ).resolves.toBeUndefined();
    expect((mocks.tombstone as { state?: string } | null)?.state).toBe('withdrawn');
  });

  it('completes proven local-only revocation locally and reconciles when backend appears', async () => {
    mocks.configured = false;
    await grantHealthDependentConsent('photo_trend_insights', {
      allowExactLocalReceiptWhenUnconfigured: true,
    });
    await expect(
      withdrawHealthDependentConsent({ type: 'photo_trend_insights' }),
    ).resolves.toBeUndefined();
    expect(mocks.withdraw).not.toHaveBeenCalled();
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.tombstone).toBeNull();

    await expect(
      grantHealthDependentConsent('photo_trend_insights', {
        allowExactLocalReceiptWhenUnconfigured: true,
      }),
    ).resolves.toBeUndefined();

    mocks.configured = true;
    mocks.status.mockResolvedValueOnce({
      ...status('unconsented', 0),
      consentType: 'photo_trend_insights',
    });
    await expect(
      isHealthDependentConsentActive('photo_trend_insights'),
    ).resolves.toBe(false);
  });
});
