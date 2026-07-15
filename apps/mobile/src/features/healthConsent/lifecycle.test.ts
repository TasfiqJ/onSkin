import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginHealthDataConsentWithdrawal,
  completeHealthDataActivationRoute,
  declineAuthoritativeInitialHealthDataConsent,
  grantAuthoritativeHealthDataConsent,
  reconcileHealthDataLifecycle,
  resumeHealthDataConsentWithdrawal,
} from './lifecycle';
import type { HealthDataLifecycleRecord } from './lifecycleStore';
import type { PendingHealthWithdrawalIntent } from './pendingIntent';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = '2026-07-15T12:00:00.000Z';
const KEY = 'ab'.repeat(32);
const OWNER_BINDING = 'cd'.repeat(32);

const mocks = vi.hoisted(() => ({
  appEnvironment: 'development' as 'development' | 'staging' | 'production',
  activeLease: null as {
    generation: number;
    epoch: number;
    ownerUserId: string;
    ownerBinding: string;
    accountGeneration: number;
    identityGeneration: number;
    expiresAt: null;
  } | null,
  beginRemote: vi.fn(),
  cleanup: vi.fn(async () => {}),
  clearDependentRecovery: vi.fn(async () => {}),
  clearEpoch: vi.fn(),
  clearPending: vi.fn(),
  configured: true,
  contractMatches: vi.fn(async () => true),
  createKey: vi.fn(async () => KEY),
  declineRemote: vi.fn(),
  fetchRemote: vi.fn(),
  grantRemote: vi.fn(),
  hasCurrentConsent: vi.fn(async () => true),
  identityGeneration: 0,
  order: [] as string[],
  ownership: 'match',
  pending: null as PendingHealthWithdrawalIntent | null,
  preparePending: vi.fn(),
  publishImmediateInterlock: vi.fn(),
  read: vi.fn(),
  record: null as HealthDataLifecycleRecord | null,
  retryRemote: vi.fn(),
  runAccountGenerationOperation: vi.fn(),
  setEpoch: vi.fn(),
  setLocalConsent: vi.fn(async () => {}),
  syncLocalConsent: vi.fn(async () => {}),
  updatePending: vi.fn(),
  write: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    get appEnvironment() {
      return mocks.appEnvironment;
    },
  },
  get isSupabaseConfigured() {
    return mocks.configured;
  },
}));
vi.mock('@/lib/auth/accountGeneration', () => ({
  AccountGenerationLeaseError: class AccountGenerationLeaseError extends Error {
    readonly code = 'ACCOUNT_GENERATION_CHANGED';

    constructor() {
      super('ACCOUNT_GENERATION_CHANGED');
    }
  },
  assertAccountIdentityGeneration: (expected: number) => {
    if (expected !== mocks.identityGeneration) {
      throw Object.assign(new Error('ACCOUNT_GENERATION_CHANGED'), {
        code: 'ACCOUNT_GENERATION_CHANGED',
      });
    }
  },
  captureAccountIdentityGeneration: () => mocks.identityGeneration,
  isAccountGenerationLeaseError: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ACCOUNT_GENERATION_CHANGED',
  runAccountGenerationOperation: mocks.runAccountGenerationOperation,
}));
vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: vi.fn(async () => OWNER_BINDING),
  readLocalDataOwnership: vi.fn(async () => mocks.ownership),
}));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingLeaseSnapshot: vi.fn(() => mocks.activeLease),
  clearActiveHealthProcessingEpoch: mocks.clearEpoch,
  setActiveHealthProcessingEpoch: mocks.setEpoch,
}));
vi.mock('@/lib/consent/dependentConsentLocal', () => ({
  clearAllDependentConsentWithdrawalTombstones: mocks.clearDependentRecovery,
}));
vi.mock('@/features/onboarding/healthConsentStore', () => ({
  hasCurrentHealthDataCollectionConsent: mocks.hasCurrentConsent,
  setHealthDataCollectionConsentLocal: mocks.setLocalConsent,
  synchronizeAuthoritativeHealthDataCollectionConsent: mocks.syncLocalConsent,
}));
vi.mock('./lifecycleStore', () => ({
  readHealthDataLifecycle: mocks.read,
  verificationRequiredRecord: ({
    ownerUserId,
    previous,
    reason,
    resumeState,
    localCleanupComplete,
  }: {
    ownerUserId: string;
    previous?: HealthDataLifecycleRecord | null;
    reason?: HealthDataLifecycleRecord['verificationReason'];
    resumeState?: HealthDataLifecycleRecord['verificationResumeState'];
    localCleanupComplete?: boolean;
  }) => {
    const verificationReason =
      reason ??
      (previous?.state === 'verification_required'
        ? previous.verificationReason
        : previous?.state === 'withdrawing' || previous?.state === 'withdrawn'
          ? 'withdrawal_status_unavailable'
          : 'status_unavailable');
    const verificationResumeState =
      resumeState !== undefined
        ? resumeState
        : previous?.state === 'verification_required'
          ? previous.verificationResumeState
          : (previous?.state ?? null);
    return {
      ownerUserId,
      state: 'verification_required',
      processingEpoch: previous?.processingEpoch ?? 0,
      operationId: previous?.operationId ?? null,
      idempotencyKey: null,
      localCleanupComplete:
        localCleanupComplete ??
        (previous?.state === 'active' ? false : (previous?.localCleanupComplete ?? false)),
      activationRoutePending:
        verificationReason === 'status_unavailable' &&
        verificationResumeState === 'active' &&
        previous?.activationRoutePending === true,
      verificationReason,
      verificationResumeState,
      serverVerifiedAt: previous?.serverVerifiedAt ?? null,
      updatedAt: NOW,
      schemaVersion: 3,
    };
  },
  verificationRequiresLocalCleanup: (record: HealthDataLifecycleRecord) =>
    record.state === 'verification_required' && record.verificationReason !== 'status_unavailable',
  verificationCanResumeActiveEpoch: (record: HealthDataLifecycleRecord, processingEpoch: number) =>
    record.state === 'verification_required' &&
    record.verificationReason === 'status_unavailable' &&
    record.verificationResumeState === 'active' &&
    record.processingEpoch === processingEpoch,
  publishImmediateHealthDataWithdrawalInterlock: mocks.publishImmediateInterlock,
  writeHealthDataLifecycle: mocks.write,
}));
vi.mock('./pendingIntent', () => ({
  readPendingHealthWithdrawalIntent: vi.fn(async () => mocks.pending),
  preparePendingHealthWithdrawalIntent: mocks.preparePending,
  preparePendingHealthWithdrawalIntentByOwnerBinding: mocks.preparePending,
  updatePendingHealthWithdrawalIntent: mocks.updatePending,
  clearPendingHealthWithdrawalIntent: mocks.clearPending,
}));
vi.mock('./remote', () => ({
  beginRemoteHealthDataWithdrawal: mocks.beginRemote,
  createHealthWithdrawalIdempotencyKey: mocks.createKey,
  declineRemoteInitialHealthDataConsent: mocks.declineRemote,
  fetchRemoteHealthDataLifecycle: mocks.fetchRemote,
  grantRemoteHealthDataConsent: mocks.grantRemote,
  remoteHealthDataConsentMatchesCurrentContract: mocks.contractMatches,
  retryRemoteHealthDataWithdrawal: mocks.retryRemote,
}));
vi.mock('./selectiveCleanup', () => ({ clearHealthPurposeLocalData: mocks.cleanup }));

function localRecord(
  state: HealthDataLifecycleRecord['state'],
  overrides: Partial<HealthDataLifecycleRecord> = {},
): HealthDataLifecycleRecord {
  return {
    schemaVersion: 3,
    ownerUserId: OWNER,
    state,
    processingEpoch: state === 'unconsented' ? 0 : 2,
    operationId: null,
    idempotencyKey: state === 'withdrawing' ? KEY : null,
    localCleanupComplete: state !== 'withdrawing',
    activationRoutePending: false,
    verificationReason: state === 'verification_required' ? 'status_unavailable' : null,
    verificationResumeState: state === 'verification_required' ? 'active' : null,
    serverVerifiedAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function remote(
  state: 'unconsented' | 'active' | 'withdrawing' | 'withdrawn',
  epoch = state === 'unconsented' ? 0 : 2,
) {
  return {
    ownerUserId: OWNER,
    state,
    processingEpoch: epoch,
    operationId: state === 'withdrawing' || state === 'withdrawn' ? 'operation-1' : null,
    operationState: state === 'withdrawn' ? 'completed' : null,
    resultCode: state === 'withdrawn' ? 'HEALTH_DATA_WITHDRAWN' : null,
    serverVerifiedAt: NOW,
    withdrawn: state === 'withdrawn',
    retryRequired: state === 'withdrawing',
    consentVersion: state === 'active' ? 'draft-v1-2026-07-10' : null,
    consentTextHash: state === 'active' ? '79'.repeat(32) : null,
  };
}

function pendingIntent(overrides: Partial<PendingHealthWithdrawalIntent> = {}) {
  return {
    processingEpoch: 2,
    idempotencyKey: KEY,
    operationId: null,
    localCleanupComplete: false,
    requestedAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } satisfies PendingHealthWithdrawalIntent;
}

describe('health consent lifecycle orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appEnvironment = 'development';
    mocks.configured = true;
    mocks.ownership = 'match';
    mocks.identityGeneration += 1;
    mocks.order.length = 0;
    mocks.pending = null;
    mocks.record = localRecord('active');
    mocks.activeLease = {
      generation: 10,
      epoch: 2,
      ownerUserId: OWNER,
      ownerBinding: OWNER_BINDING,
      accountGeneration: 1,
      identityGeneration: mocks.identityGeneration,
      expiresAt: null,
    };
    mocks.runAccountGenerationOperation.mockImplementation(
      (
        operation: (lease: {
          generation: number;
          signal: AbortSignal;
          assertCurrent: () => void;
        }) => unknown,
      ) =>
        operation({
          generation: 1,
          signal: new AbortController().signal,
          assertCurrent: vi.fn(),
        }),
    );
    mocks.clearEpoch.mockImplementation(() => {
      mocks.activeLease = null;
      return true;
    });
    mocks.setEpoch.mockImplementation((epoch: number, options) => {
      const active = {
        generation: 10,
        epoch,
        ownerUserId: options.ownerUserId,
        ownerBinding: options.ownerBinding,
        accountGeneration: options.accountGeneration,
        identityGeneration: options.identityGeneration,
        expiresAt: null,
      };
      mocks.activeLease = active;
      return active;
    });
    mocks.read.mockImplementation(async () => mocks.record);
    mocks.write.mockImplementation(async (input) => {
      mocks.record = {
        schemaVersion: 3,
        updatedAt: NOW,
        ...input,
      } as HealthDataLifecycleRecord;
      return mocks.record;
    });
    mocks.preparePending.mockImplementation(async (params) => {
      mocks.pending ??= pendingIntent({
        processingEpoch: params.processingEpoch,
        idempotencyKey: params.idempotencyKey ?? null,
      });
      return mocks.pending;
    });
    mocks.updatePending.mockImplementation(async (params) => {
      if (!mocks.pending) throw new Error('missing pending');
      mocks.pending = {
        ...mocks.pending,
        ...(params.idempotencyKey === undefined ? {} : { idempotencyKey: params.idempotencyKey }),
        ...(params.operationId === undefined ? {} : { operationId: params.operationId }),
        ...(params.localCleanupComplete === undefined
          ? {}
          : { localCleanupComplete: params.localCleanupComplete }),
        updatedAt: NOW,
      };
      return mocks.pending;
    });
    mocks.clearPending.mockImplementation(async () => {
      mocks.pending = null;
    });
    mocks.cleanup.mockImplementation(async () => {
      mocks.order.push('cleanup');
    });
    mocks.beginRemote.mockImplementation(async () => {
      mocks.order.push('remote');
      return remote('withdrawing');
    });
    mocks.hasCurrentConsent.mockResolvedValue(true);
    mocks.contractMatches.mockResolvedValue(true);
    mocks.syncLocalConsent.mockResolvedValue(undefined);
  });

  it('keeps production status reconciliation and destructive withdrawal available', async () => {
    mocks.appEnvironment = 'production';
    mocks.fetchRemote.mockResolvedValueOnce(remote('active'));

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'active',
      processingEpoch: 2,
    });
    await expect(beginHealthDataConsentWithdrawal(OWNER)).resolves.toMatchObject({
      state: 'withdrawing',
      processingEpoch: 2,
      localCleanupComplete: true,
    });
    expect(mocks.cleanup).toHaveBeenCalledWith(OWNER);
    expect(mocks.beginRemote).toHaveBeenCalled();
  });

  it('releases a durable initial refusal so the same owner can later grant consent', async () => {
    mocks.record = localRecord('unconsented');
    mocks.declineRemote.mockResolvedValueOnce(remote('unconsented', 0));

    await expect(declineAuthoritativeInitialHealthDataConsent(OWNER)).resolves.toMatchObject({
      state: 'unconsented',
      processingEpoch: 0,
    });

    // The onboarding grant facade reconciles first. This call is the exact
    // regression for a close fence that previously remained latched forever.
    mocks.fetchRemote.mockResolvedValueOnce(remote('unconsented', 0));
    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'unconsented',
      processingEpoch: 0,
    });

    mocks.grantRemote.mockResolvedValueOnce(remote('active', 1));
    await expect(
      grantAuthoritativeHealthDataConsent({
        ownerUserId: OWNER,
        expectedProcessingEpoch: 0,
      }),
    ).resolves.toMatchObject({
      state: 'active',
      processingEpoch: 1,
      activationRoutePending: true,
    });
  });

  it('blocks a new production grant before local or remote mutation', async () => {
    mocks.appEnvironment = 'production';

    await expect(
      grantAuthoritativeHealthDataConsent({
        ownerUserId: OWNER,
        expectedProcessingEpoch: 2,
      }),
    ).rejects.toThrow('HEALTH_DATA_CONSENT_COPY_RELEASE_BLOCKED');
    expect(mocks.grantRemote).not.toHaveBeenCalled();
    expect(mocks.setLocalConsent).not.toHaveBeenCalled();
  });

  it('closes the exact owner lease synchronously before the first withdrawal read settles', async () => {
    let resolveRead!: (record: HealthDataLifecycleRecord) => void;
    mocks.read.mockReturnValueOnce(
      new Promise<HealthDataLifecycleRecord>((resolve) => {
        resolveRead = resolve;
      }),
    );

    const withdrawal = beginHealthDataConsentWithdrawal(OWNER);
    expect(mocks.clearEpoch).toHaveBeenCalledWith({
      ownerUserId: OWNER,
      generation: 10,
      accountGeneration: 1,
    });
    expect(mocks.publishImmediateInterlock).toHaveBeenCalledWith({
      ownerUserId: OWNER,
      processingEpoch: 2,
    });
    expect(mocks.createKey).not.toHaveBeenCalled();
    expect(() => reconcileHealthDataLifecycle(OWNER)).toThrow('ACCOUNT_GENERATION_CHANGED');

    resolveRead(localRecord('active'));
    await withdrawal;
  });

  it('remains closed when the first durable pre-intake write fails before random work', async () => {
    mocks.preparePending.mockRejectedValueOnce(new Error('pending store unavailable'));

    await expect(beginHealthDataConsentWithdrawal(OWNER)).rejects.toThrow(
      'pending store unavailable',
    );

    expect(mocks.publishImmediateInterlock).toHaveBeenCalledOnce();
    expect(mocks.createKey).not.toHaveBeenCalled();
    expect(mocks.setEpoch).not.toHaveBeenCalled();
    expect(mocks.beginRemote).not.toHaveBeenCalled();

    await expect(
      resumeHealthDataConsentWithdrawal(OWNER, {
        expectedInterruptedProcessingEpoch: 2,
      }),
    ).resolves.toMatchObject({
      state: 'withdrawing',
      processingEpoch: 2,
      localCleanupComplete: true,
    });
    expect(mocks.createKey).toHaveBeenCalledOnce();
    expect(mocks.beginRemote).toHaveBeenCalledOnce();
  });

  it('will not reinterpret an active grant as withdrawal without the mounted-shell capability', async () => {
    mocks.activeLease = null;

    await expect(resumeHealthDataConsentWithdrawal(OWNER)).rejects.toThrow(
      'HEALTH_DATA_WITHDRAWAL_NOT_ACTIVE',
    );
    expect(mocks.preparePending).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });

  it('recovers a kill after durable pre-intake but before random-key assignment', async () => {
    mocks.createKey.mockRejectedValueOnce(new Error('process interrupted'));

    await expect(beginHealthDataConsentWithdrawal(OWNER)).rejects.toThrow('process interrupted');
    expect(mocks.pending).toMatchObject({
      processingEpoch: 2,
      idempotencyKey: null,
      localCleanupComplete: false,
    });
    expect(mocks.record).toMatchObject({
      state: 'withdrawing',
      processingEpoch: 2,
      idempotencyKey: null,
      localCleanupComplete: false,
    });
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(mocks.beginRemote).not.toHaveBeenCalled();

    // A cold-start recovery reads the durable pre-intake journal, assigns the
    // first key once, performs cleanup, and reuses that key for intake.
    mocks.beginRemote.mockResolvedValueOnce(remote('withdrawn'));
    await expect(resumeHealthDataConsentWithdrawal(OWNER)).resolves.toMatchObject({
      state: 'withdrawn',
      localCleanupComplete: true,
    });
    expect(mocks.updatePending).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedIdempotencyKey: null,
        idempotencyKey: KEY,
      }),
    );
    expect(mocks.beginRemote).toHaveBeenCalledWith({
      ownerUserId: OWNER,
      expectedProcessingEpoch: 2,
      idempotencyKey: KEY,
    });
  });

  it('rejects a stale A-to-B-to-A random-key continuation after the pre-intake journal', async () => {
    let resolveKey!: (key: string) => void;
    mocks.createKey.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveKey = resolve;
      }),
    );
    const withdrawal = beginHealthDataConsentWithdrawal(OWNER);
    await vi.waitFor(() => expect(mocks.createKey).toHaveBeenCalledOnce());

    mocks.identityGeneration += 2;
    resolveKey(KEY);

    await expect(withdrawal).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
    expect(mocks.preparePending).toHaveBeenCalledOnce();
    expect(mocks.record).toMatchObject({ state: 'withdrawing', idempotencyKey: null });
    expect(mocks.updatePending).not.toHaveBeenCalled();
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('lets a newer withdrawal invalidate a deferred active reconcile before publication', async () => {
    let resolveContract!: (matches: boolean) => void;
    mocks.fetchRemote.mockResolvedValueOnce(remote('active'));
    mocks.contractMatches.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveContract = resolve;
      }),
    );
    const staleReconcile = reconcileHealthDataLifecycle(OWNER);
    await vi.waitFor(() => expect(mocks.contractMatches).toHaveBeenCalledOnce());

    const withdrawal = beginHealthDataConsentWithdrawal(OWNER);
    await withdrawal;
    const writesBeforeRelease = mocks.write.mock.calls.length;
    resolveContract(true);

    await expect(staleReconcile).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
    expect(mocks.write.mock.calls.length).toBe(writesBeforeRelease);
    expect(mocks.record?.state).not.toBe('active');
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('does not turn an A-to-B-to-A aborted reconcile into a fresh verification write', async () => {
    let resolveRemote!: (value: ReturnType<typeof remote>) => void;
    mocks.fetchRemote.mockReturnValueOnce(
      new Promise<ReturnType<typeof remote>>((resolve) => {
        resolveRemote = resolve;
      }),
    );
    const reconciliation = reconcileHealthDataLifecycle(OWNER);
    await vi.waitFor(() => expect(mocks.fetchRemote).toHaveBeenCalledOnce());
    mocks.identityGeneration += 2;
    resolveRemote(remote('active'));

    await expect(reconciliation).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('does not let an older active status regress a newer withdrawn status', async () => {
    let resolveOldContract!: (matches: boolean) => void;
    mocks.fetchRemote
      .mockResolvedValueOnce(remote('active'))
      .mockResolvedValueOnce(remote('withdrawn'));
    mocks.contractMatches.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveOldContract = resolve;
      }),
    );

    const older = reconcileHealthDataLifecycle(OWNER);
    await vi.waitFor(() => expect(mocks.contractMatches).toHaveBeenCalledOnce());
    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'withdrawn',
      localCleanupComplete: false,
    });
    resolveOldContract(true);

    await expect(older).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
    expect(mocks.record).toMatchObject({ state: 'withdrawn' });
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('clears local health data before a bounded intake and preserves an ambiguous journal', async () => {
    mocks.beginRemote.mockImplementationOnce(async () => {
      mocks.order.push('remote');
      throw new Error('network lost');
    });

    await expect(beginHealthDataConsentWithdrawal(OWNER)).rejects.toThrow('network lost');

    expect(mocks.order).toEqual(['cleanup', 'remote']);
    expect(mocks.clearEpoch).toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledWith(OWNER);
    expect(mocks.pending).toMatchObject({
      idempotencyKey: KEY,
      localCleanupComplete: true,
    });
    expect(mocks.record).toMatchObject({
      state: 'withdrawing',
      idempotencyKey: KEY,
      localCleanupComplete: true,
    });
  });

  it('never records local cleanup complete when a required analytics purge fails', async () => {
    mocks.cleanup.mockRejectedValueOnce(new Error('analytics persistence unavailable'));

    await expect(beginHealthDataConsentWithdrawal(OWNER)).rejects.toThrow(
      'analytics persistence unavailable',
    );

    expect(mocks.beginRemote).not.toHaveBeenCalled();
    expect(mocks.pending).toMatchObject({
      idempotencyKey: KEY,
      localCleanupComplete: false,
    });
    expect(mocks.record).toMatchObject({
      state: 'withdrawing',
      idempotencyKey: KEY,
      localCleanupComplete: false,
    });
  });

  it('re-sends the same owner, epoch, and idempotency key after ambiguous intake', async () => {
    mocks.pending = pendingIntent({ localCleanupComplete: true });
    mocks.record = localRecord('withdrawing', { localCleanupComplete: true });
    mocks.beginRemote.mockResolvedValueOnce(remote('withdrawn'));

    await expect(resumeHealthDataConsentWithdrawal(OWNER)).resolves.toMatchObject({
      state: 'withdrawn',
    });

    expect(mocks.beginRemote).toHaveBeenCalledWith({
      ownerUserId: OWNER,
      expectedProcessingEpoch: 2,
      idempotencyKey: KEY,
    });
    expect(mocks.retryRemote).not.toHaveBeenCalled();
    expect(mocks.pending).toBeNull();
    expect(mocks.clearDependentRecovery).toHaveBeenCalledOnce();
  });

  it('restores a withdrawal journal after ordinary private state was removed', async () => {
    mocks.pending = pendingIntent();
    mocks.record = null;
    mocks.beginRemote.mockResolvedValueOnce(remote('withdrawn'));

    await expect(resumeHealthDataConsentWithdrawal(OWNER)).resolves.toMatchObject({
      state: 'withdrawn',
      localCleanupComplete: true,
    });
    expect(mocks.cleanup).toHaveBeenCalledWith(OWNER);
    expect(mocks.beginRemote).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: OWNER, idempotencyKey: KEY }),
    );
  });

  it('never inherits active local-cleanup proof for a cross-device terminal withdrawal', async () => {
    mocks.fetchRemote.mockResolvedValueOnce(remote('withdrawn'));

    const observed = await reconcileHealthDataLifecycle(OWNER);
    expect(observed).toMatchObject({ state: 'withdrawn', localCleanupComplete: false });
    expect(mocks.cleanup).not.toHaveBeenCalled();

    await expect(resumeHealthDataConsentWithdrawal(OWNER)).resolves.toMatchObject({
      state: 'withdrawn',
      localCleanupComplete: true,
    });
    expect(mocks.cleanup).toHaveBeenCalledWith(OWNER);
    expect(mocks.clearDependentRecovery).toHaveBeenCalledOnce();
  });

  it('locks and purges the prior epoch before adopting a newer active epoch', async () => {
    mocks.fetchRemote.mockResolvedValueOnce(remote('active', 3));
    mocks.cleanup.mockImplementationOnce(async () => {
      mocks.order.push('cleanup');
      expect(mocks.record?.state).toBe('verification_required');
    });

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'active',
      processingEpoch: 3,
      activationRoutePending: true,
    });
    expect(mocks.cleanup).toHaveBeenCalledWith(OWNER);
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('clears legacy local health data before adopting an epoch-zero unconsented owner', async () => {
    mocks.record = null;
    mocks.fetchRemote.mockResolvedValueOnce(remote('unconsented'));
    mocks.cleanup.mockImplementationOnce(async () => {
      mocks.order.push('cleanup');
      expect(mocks.record).toMatchObject({
        state: 'verification_required',
        processingEpoch: 0,
        localCleanupComplete: false,
      });
    });

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'unconsented',
      processingEpoch: 0,
      localCleanupComplete: true,
      verificationReason: null,
    });
    expect(mocks.cleanup).toHaveBeenCalledWith(OWNER);
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('keeps installed-base unconsented adoption closed until local cleanup can retry', async () => {
    mocks.record = null;
    mocks.fetchRemote.mockResolvedValue(remote('unconsented'));
    mocks.cleanup.mockRejectedValueOnce(new Error('disk unavailable'));

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      processingEpoch: 0,
      localCleanupComplete: false,
      verificationReason: 'authoritative_unconsented',
    });
    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'unconsented',
      processingEpoch: 0,
      localCleanupComplete: true,
    });
    expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  });

  it('cleans but preserves the higher local epoch when authority falls back to epoch zero', async () => {
    mocks.record = localRecord('active', { processingEpoch: 1 });
    mocks.fetchRemote.mockResolvedValue(remote('unconsented'));

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      processingEpoch: 1,
      localCleanupComplete: true,
      verificationReason: 'authoritative_unconsented',
      verificationResumeState: 'active',
    });
    expect(mocks.cleanup).toHaveBeenCalledOnce();

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      processingEpoch: 1,
      localCleanupComplete: true,
      verificationReason: 'authoritative_unconsented',
    });
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('treats a lower-epoch remote withdrawal as cleanup-required, not a transient outage', async () => {
    mocks.record = localRecord('active', { processingEpoch: 3 });
    mocks.fetchRemote.mockResolvedValue(remote('withdrawn', 2));

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      processingEpoch: 3,
      localCleanupComplete: true,
      verificationReason: 'processing_epoch_changed',
      verificationResumeState: 'withdrawn',
    });
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.setEpoch).not.toHaveBeenCalled();

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      localCleanupComplete: true,
      verificationReason: 'processing_epoch_changed',
    });
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });

  it('cleans before adopting a newer-epoch remote withdrawal', async () => {
    mocks.record = localRecord('active', { processingEpoch: 2 });
    mocks.fetchRemote.mockResolvedValueOnce(remote('withdrawing', 3));

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'withdrawing',
      processingEpoch: 3,
      localCleanupComplete: true,
    });
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('caches consent only after exact authoritative proof so a fresh profile can persist', async () => {
    mocks.fetchRemote.mockResolvedValueOnce(remote('active', 3));
    mocks.contractMatches.mockImplementationOnce(async () => {
      mocks.order.push('authoritative-proof');
      return true;
    });
    mocks.syncLocalConsent.mockImplementationOnce(async () => {
      mocks.order.push('local-consent-cache');
    });

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'active',
      processingEpoch: 3,
    });
    expect(mocks.order).toEqual(['authoritative-proof', 'cleanup', 'local-consent-cache']);
    expect(mocks.syncLocalConsent).toHaveBeenCalledWith({
      version: 'draft-v1-2026-07-10',
      consentTextHash: '79'.repeat(32),
    });
  });

  it('keeps an epoch-change cleanup marker durable and retries after partial failure', async () => {
    mocks.fetchRemote.mockResolvedValue(remote('active', 3));
    mocks.cleanup.mockRejectedValueOnce(new Error('disk unavailable'));

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      processingEpoch: 3,
      localCleanupComplete: false,
    });
    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'active',
      processingEpoch: 3,
    });
    expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  });

  it('requires the exact current server consent contract before active runtime', async () => {
    mocks.fetchRemote.mockResolvedValueOnce(remote('active'));
    mocks.contractMatches.mockResolvedValueOnce(false);

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      processingEpoch: 2,
      localCleanupComplete: true,
      verificationReason: 'consent_contract_mismatch',
    });
    expect(mocks.cleanup).toHaveBeenCalledWith(OWNER);
    expect(mocks.setEpoch).not.toHaveBeenCalled();
    expect(mocks.syncLocalConsent).not.toHaveBeenCalled();
  });

  it('does not expose reconsent when exact-contract cleanup fails', async () => {
    mocks.fetchRemote.mockResolvedValue(remote('active'));
    mocks.contractMatches.mockResolvedValue(false);
    mocks.cleanup.mockRejectedValueOnce(new Error('disk unavailable'));

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      processingEpoch: 2,
      localCleanupComplete: false,
      verificationReason: 'consent_contract_mismatch',
    });
    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      processingEpoch: 2,
      localCleanupComplete: true,
      verificationReason: 'consent_contract_mismatch',
    });
    expect(mocks.cleanup).toHaveBeenCalledTimes(2);
    expect(mocks.setEpoch).not.toHaveBeenCalled();

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      verificationReason: 'consent_contract_mismatch',
      localCleanupComplete: true,
    });
    expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  });

  it('preserves local health data across a transient outage and resumes the same exact epoch', async () => {
    mocks.fetchRemote
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(remote('active', 2));

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      processingEpoch: 2,
      localCleanupComplete: false,
      verificationReason: 'status_unavailable',
      verificationResumeState: 'active',
    });
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(mocks.setEpoch).not.toHaveBeenCalled();

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'active',
      processingEpoch: 2,
    });
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(mocks.syncLocalConsent).toHaveBeenCalledOnce();
    expect(mocks.setEpoch).toHaveBeenLastCalledWith(2, {
      ownerUserId: OWNER,
      ownerBinding: OWNER_BINDING,
      accountGeneration: 1,
      identityGeneration: mocks.identityGeneration,
      serverVerifiedAt: NOW,
    });
  });

  it('preserves a pre-route activation barrier across a transient same-epoch outage', async () => {
    mocks.record = localRecord('active', {
      processingEpoch: 2,
      activationRoutePending: true,
    });
    mocks.fetchRemote
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(remote('active', 2));

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      activationRoutePending: true,
      verificationReason: 'status_unavailable',
      verificationResumeState: 'active',
    });
    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'active',
      processingEpoch: 2,
      activationRoutePending: true,
    });
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('rejects reconsent from a configured verification epoch the server cannot accept', async () => {
    mocks.record = localRecord('verification_required', {
      processingEpoch: 1,
      localCleanupComplete: true,
      verificationReason: 'authoritative_unconsented',
      verificationResumeState: 'active',
    });

    await expect(
      grantAuthoritativeHealthDataConsent({
        ownerUserId: OWNER,
        expectedProcessingEpoch: 1,
      }),
    ).rejects.toThrow('HEALTH_DATA_RECONSENT_SERVER_STATE_INCOMPATIBLE');
    expect(mocks.grantRemote).not.toHaveBeenCalled();
    expect(mocks.setLocalConsent).not.toHaveBeenCalled();
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('turns an unconfigured stale active grant into explicit verification', async () => {
    mocks.configured = false;
    mocks.hasCurrentConsent.mockResolvedValueOnce(false);

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      processingEpoch: 2,
      localCleanupComplete: true,
      verificationReason: 'local_consent_unavailable',
    });
    expect(mocks.cleanup).toHaveBeenCalledWith(OWNER);
    expect(mocks.setEpoch).not.toHaveBeenCalled();

    const activated = await grantAuthoritativeHealthDataConsent({
      ownerUserId: OWNER,
      expectedProcessingEpoch: 2,
    });
    expect(activated).toMatchObject({
      state: 'active',
      processingEpoch: 3,
      activationRoutePending: true,
    });
    expect(mocks.setEpoch).not.toHaveBeenCalled();
    await expect(
      completeHealthDataActivationRoute({
        ownerUserId: OWNER,
        expectedProcessingEpoch: 3,
      }),
    ).resolves.toMatchObject({ activationRoutePending: false });
    expect(mocks.cleanup.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setEpoch.mock.invocationCallOrder[0]!,
    );
  });

  it('keeps fresh activation pending across a kill/relaunch until goals mount acknowledges it', async () => {
    mocks.record = localRecord('withdrawn', { processingEpoch: 2, localCleanupComplete: true });
    mocks.grantRemote.mockResolvedValueOnce(remote('active', 3));

    await expect(
      grantAuthoritativeHealthDataConsent({
        ownerUserId: OWNER,
        expectedProcessingEpoch: 2,
      }),
    ).resolves.toMatchObject({
      state: 'active',
      processingEpoch: 3,
      activationRoutePending: true,
    });
    expect(mocks.setEpoch).not.toHaveBeenCalled();

    // Simulate a process restart before the goals route ever mounted.
    mocks.fetchRemote.mockResolvedValue(remote('active', 3));
    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'active',
      processingEpoch: 3,
      activationRoutePending: true,
    });
    expect(mocks.setEpoch).not.toHaveBeenCalled();

    await expect(
      completeHealthDataActivationRoute({
        ownerUserId: OWNER,
        expectedProcessingEpoch: 3,
      }),
    ).resolves.toMatchObject({ activationRoutePending: false });
    expect(mocks.setEpoch).toHaveBeenLastCalledWith(3, {
      ownerUserId: OWNER,
      ownerBinding: OWNER_BINDING,
      accountGeneration: 1,
      identityGeneration: mocks.identityGeneration,
      serverVerifiedAt: NOW,
    });

    // The next cold reconciliation is now an established same-epoch grant.
    mocks.setEpoch.mockClear();
    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'active',
      activationRoutePending: false,
    });
    expect(mocks.setEpoch).toHaveBeenCalledOnce();
  });

  it('keeps activation fenced when the mounted-goals acknowledgement cannot persist', async () => {
    mocks.record = localRecord('active', {
      processingEpoch: 3,
      activationRoutePending: true,
    });
    mocks.write.mockRejectedValueOnce(new Error('private store unavailable'));

    await expect(
      completeHealthDataActivationRoute({
        ownerUserId: OWNER,
        expectedProcessingEpoch: 3,
      }),
    ).rejects.toThrow('private store unavailable');
    expect(mocks.record).toMatchObject({ activationRoutePending: true });
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });

  it('clears an unconfigured installed base before declaring it unconsented', async () => {
    mocks.configured = false;
    mocks.record = null;
    mocks.hasCurrentConsent.mockResolvedValueOnce(false);
    mocks.cleanup.mockImplementationOnce(async () => {
      expect(mocks.record).toMatchObject({
        state: 'verification_required',
        processingEpoch: 0,
        localCleanupComplete: false,
      });
    });

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'unconsented',
      processingEpoch: 0,
      localCleanupComplete: true,
    });
    expect(mocks.cleanup).toHaveBeenCalledWith(OWNER);
  });

  it('finishes incomplete unconfigured closed-state cleanup even without a journal', async () => {
    mocks.configured = false;
    mocks.record = localRecord('withdrawn', { localCleanupComplete: false });

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'withdrawn',
      localCleanupComplete: true,
    });
    expect(mocks.setLocalConsent).toHaveBeenCalledWith(expect.objectContaining({ granted: false }));
    expect(mocks.cleanup).toHaveBeenCalledWith(OWNER);
  });

  it('fails before remote or local mutation when the durable owner proof is foreign', async () => {
    mocks.ownership = 'mismatch';

    await expect(beginHealthDataConsentWithdrawal(OWNER)).rejects.toThrow(
      'HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE',
    );
    // The owner-bound control journal is safe to preserve, but no foreign
    // private bytes may be read, changed, or cleaned.
    expect(mocks.preparePending).toHaveBeenCalledOnce();
    expect(mocks.beginRemote).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });

  it('keeps an owner-mismatched lifecycle fenced and cleanup-required', async () => {
    mocks.ownership = 'mismatch';

    await expect(reconcileHealthDataLifecycle(OWNER)).resolves.toMatchObject({
      state: 'verification_required',
      verificationReason: 'owner_unavailable',
      localCleanupComplete: false,
    });
    expect(mocks.fetchRemote).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(mocks.setEpoch).not.toHaveBeenCalled();
  });
});
