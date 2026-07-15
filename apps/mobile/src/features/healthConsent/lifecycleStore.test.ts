import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyHealthDataLifecycleRecord,
  createHealthDataGateSnapshot,
  healthDataPausedShellRequired,
} from './activationInterlock';

import {
  HEALTH_DATA_LIFECYCLE_INVALID,
  HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH,
  HEALTH_DATA_LIFECYCLE_TRANSITION_STALE,
  parseHealthDataLifecycleRecord,
  publishImmediateHealthDataWithdrawalInterlock,
  readHealthDataLifecycle,
  subscribeToHealthDataLifecycle,
  verificationCanResumeActiveEpoch,
  verificationRequiredRecord,
  verificationRequiresLocalCleanup,
  writeHealthDataLifecycle,
} from './lifecycleStore';

const OWNER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const mocks = vi.hoisted(() => ({ raw: null as string | null }));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async () => mocks.raw),
  updatePrivateItem: vi.fn(
    async (_key: string, updater: (value: string | null) => string | null) => {
      mocks.raw = updater(mocks.raw);
    },
  ),
}));

describe('health lifecycle private authority', () => {
  beforeEach(() => {
    mocks.raw = null;
  });

  it('round-trips an owner-bound active epoch and publishes it', async () => {
    const published: string[] = [];
    const unsubscribe = subscribeToHealthDataLifecycle((record) => {
      if (record) published.push(`${record.state}:${record.processingEpoch}`);
    });
    const saved = await writeHealthDataLifecycle({
      ownerUserId: OWNER_A,
      state: 'active',
      processingEpoch: 3,
      operationId: null,
      idempotencyKey: null,
      localCleanupComplete: true,
      activationRoutePending: false,
      verificationReason: null,
      verificationResumeState: null,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });
    unsubscribe();

    await expect(readHealthDataLifecycle(OWNER_A)).resolves.toEqual(saved);
    expect(published).toEqual(['active:3']);
  });

  it('unmounts an active health tree synchronously before durable preparation settles', async () => {
    const active = await writeHealthDataLifecycle({
      ownerUserId: OWNER_A,
      state: 'active',
      processingEpoch: 3,
      operationId: null,
      idempotencyKey: null,
      localCleanupComplete: true,
      activationRoutePending: false,
      verificationReason: null,
      verificationResumeState: null,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });
    const persistedBefore = mocks.raw;
    let mountedSnapshot = createHealthDataGateSnapshot(active);
    const unsubscribe = subscribeToHealthDataLifecycle((next) => {
      mountedSnapshot = applyHealthDataLifecycleRecord(mountedSnapshot, next);
    });

    const interlock = publishImmediateHealthDataWithdrawalInterlock({
      ownerUserId: OWNER_A,
      processingEpoch: 3,
    });
    unsubscribe();

    expect(interlock).toMatchObject({
      state: 'withdrawing',
      localCleanupComplete: false,
      idempotencyKey: null,
    });
    expect(healthDataPausedShellRequired(mountedSnapshot, OWNER_A)).toBe(true);
    // The synchronous notification is not allowed to impersonate durability.
    expect(mocks.raw).toBe(persistedBefore);
  });

  it('will not read or overwrite a different account owner', async () => {
    await writeHealthDataLifecycle({
      ownerUserId: OWNER_A,
      state: 'unconsented',
      processingEpoch: 0,
      operationId: null,
      idempotencyKey: null,
      localCleanupComplete: true,
      activationRoutePending: false,
      verificationReason: null,
      verificationResumeState: null,
      serverVerifiedAt: null,
    });

    await expect(readHealthDataLifecycle(OWNER_B)).rejects.toThrow(
      HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH,
    );
    await expect(
      writeHealthDataLifecycle({
        ownerUserId: OWNER_B,
        state: 'unconsented',
        processingEpoch: 0,
        operationId: null,
        idempotencyKey: null,
        localCleanupComplete: true,
        activationRoutePending: false,
        verificationReason: null,
        verificationResumeState: null,
        serverVerifiedAt: null,
      }),
    ).rejects.toThrow(HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH);
  });

  it('rejects impossible or extra-field lifecycle records', () => {
    const base = {
      schemaVersion: 3,
      ownerUserId: OWNER_A,
      state: 'withdrawn',
      processingEpoch: 0,
      operationId: null,
      idempotencyKey: null,
      localCleanupComplete: true,
      activationRoutePending: false,
      verificationReason: null,
      verificationResumeState: null,
      serverVerifiedAt: null,
      updatedAt: '2026-07-15T12:00:00.000Z',
    };
    expect(() => parseHealthDataLifecycleRecord(JSON.stringify(base))).toThrow(
      HEALTH_DATA_LIFECYCLE_INVALID,
    );
    expect(() =>
      parseHealthDataLifecycleRecord(JSON.stringify({ ...base, processingEpoch: 1, extra: true })),
    ).toThrow(HEALTH_DATA_LIFECYCLE_INVALID);
    expect(() =>
      parseHealthDataLifecycleRecord(JSON.stringify({ ...base, schemaVersion: 1 })),
    ).toThrow(HEALTH_DATA_LIFECYCLE_INVALID);
    expect(() =>
      parseHealthDataLifecycleRecord(JSON.stringify({ ...base, schemaVersion: 2 })),
    ).toThrow(HEALTH_DATA_LIFECYCLE_INVALID);
    expect(() =>
      parseHealthDataLifecycleRecord(
        JSON.stringify({
          ...base,
          state: 'withdrawn',
          processingEpoch: 1,
          activationRoutePending: true,
        }),
      ),
    ).toThrow(HEALTH_DATA_LIFECYCLE_INVALID);
  });

  it('does not let a stale active response reopen a durable withdrawal', async () => {
    await writeHealthDataLifecycle({
      ownerUserId: OWNER_A,
      state: 'withdrawing',
      processingEpoch: 3,
      operationId: null,
      idempotencyKey: 'ab'.repeat(32),
      localCleanupComplete: false,
      activationRoutePending: false,
      verificationReason: null,
      verificationResumeState: null,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });

    await expect(
      writeHealthDataLifecycle({
        ownerUserId: OWNER_A,
        state: 'active',
        processingEpoch: 3,
        operationId: null,
        idempotencyKey: null,
        localCleanupComplete: true,
        activationRoutePending: false,
        verificationReason: null,
        verificationResumeState: null,
        serverVerifiedAt: '2026-07-15T12:00:01.000Z',
      }),
    ).rejects.toThrow(HEALTH_DATA_LIFECYCLE_TRANSITION_STALE);
  });

  it('distinguishes resumable status outages from cleanup-required withdrawal states', () => {
    const base = {
      schemaVersion: 3,
      ownerUserId: OWNER_A,
      processingEpoch: 3,
      operationId: null,
      idempotencyKey: null,
      localCleanupComplete: true,
      activationRoutePending: false,
      verificationReason: null,
      verificationResumeState: null,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
      updatedAt: '2026-07-15T12:00:00.000Z',
    } as const;

    const activeOutage = verificationRequiredRecord({
      ownerUserId: OWNER_A,
      previous: { ...base, state: 'active' },
    });
    expect(activeOutage).toMatchObject({
      localCleanupComplete: false,
      verificationReason: 'status_unavailable',
      verificationResumeState: 'active',
    });
    expect(verificationCanResumeActiveEpoch(activeOutage, 3)).toBe(true);
    expect(verificationCanResumeActiveEpoch(activeOutage, 4)).toBe(false);
    expect(verificationRequiresLocalCleanup(activeOutage)).toBe(false);
    const withdrawingOutage = verificationRequiredRecord({
      ownerUserId: OWNER_A,
      previous: {
        ...base,
        state: 'withdrawing',
        operationId: 'operation-1',
        idempotencyKey: 'ab'.repeat(32),
      },
    });
    expect(withdrawingOutage).toMatchObject({
      localCleanupComplete: true,
      verificationReason: 'withdrawal_status_unavailable',
      verificationResumeState: 'withdrawing',
    });
    expect(verificationRequiresLocalCleanup(withdrawingOutage)).toBe(true);
    expect(
      verificationRequiredRecord({
        ownerUserId: OWNER_A,
        previous: { ...base, state: 'withdrawn' },
      }).localCleanupComplete,
    ).toBe(true);
  });

  it('persists a resumable outage marker and reopens only the same active epoch', async () => {
    const active = await writeHealthDataLifecycle({
      ownerUserId: OWNER_A,
      state: 'active',
      processingEpoch: 3,
      operationId: null,
      idempotencyKey: null,
      localCleanupComplete: true,
      activationRoutePending: false,
      verificationReason: null,
      verificationResumeState: null,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });
    const outage = verificationRequiredRecord({ ownerUserId: OWNER_A, previous: active });
    await writeHealthDataLifecycle({
      ownerUserId: outage.ownerUserId,
      state: outage.state,
      processingEpoch: outage.processingEpoch,
      operationId: outage.operationId,
      idempotencyKey: outage.idempotencyKey,
      localCleanupComplete: outage.localCleanupComplete,
      activationRoutePending: outage.activationRoutePending,
      verificationReason: outage.verificationReason,
      verificationResumeState: outage.verificationResumeState,
      serverVerifiedAt: outage.serverVerifiedAt,
    });
    await expect(
      writeHealthDataLifecycle({
        ownerUserId: OWNER_A,
        state: 'active',
        processingEpoch: 3,
        operationId: null,
        idempotencyKey: null,
        localCleanupComplete: true,
        activationRoutePending: false,
        verificationReason: null,
        verificationResumeState: null,
        serverVerifiedAt: '2026-07-15T12:01:00.000Z',
      }),
    ).resolves.toMatchObject({ state: 'active', processingEpoch: 3 });
  });

  it('preserves a durable pending activation through a same-epoch status fence', async () => {
    const pendingActive = await writeHealthDataLifecycle({
      ownerUserId: OWNER_A,
      state: 'active',
      processingEpoch: 3,
      operationId: null,
      idempotencyKey: null,
      localCleanupComplete: true,
      activationRoutePending: true,
      verificationReason: null,
      verificationResumeState: null,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });
    const outage = verificationRequiredRecord({ ownerUserId: OWNER_A, previous: pendingActive });

    expect(outage).toMatchObject({
      state: 'verification_required',
      processingEpoch: 3,
      activationRoutePending: true,
      verificationReason: 'status_unavailable',
      verificationResumeState: 'active',
    });
  });
});
