import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  drainRoutineWidgetOutboxBeforeHealthLeaseClose,
  mountRoutineWidgetLifecycle,
  ROUTINE_WIDGET_PRE_CLOSE_DRAIN_TIMEOUT_MS,
  type RoutineWidgetLifecyclePublicationOptions,
} from './lifecycleRuntime.ios';
import type { RoutineWidgetLifecycleDependencies } from './lifecycleCoordinator';

const OWNER_GENERATION = '11111111-1111-4111-8111-111111111111';
const AUTHORITY_NONCE = '22222222-2222-4222-8222-222222222222';
const SNAPSHOT_NONCE = '33333333-3333-4333-8333-333333333333';
const ACTION_TOKEN = '44444444-4444-4444-8444-444444444444';
const QUIESCENCE_NONCE = '55555555-5555-4555-8555-555555555555';

const mocks = vi.hoisted(() => ({
  nativeConfigured: false,
  runtimeEnabled: false,
  liveActivityStartEnabled: true,
  mount: vi.fn(),
  release: vi.fn(),
  acknowledgeActions: vi.fn(),
  activateOwner: vi.fn(),
  clearActions: vi.fn(),
  discardPreparedActions: vi.fn(),
  closeAdmission: vi.fn(),
  clearNativeState: vi.fn(),
  commitReconciliation: vi.fn(),
  commitCapturedReconciliation: vi.fn(),
  completeAction: vi.fn(),
  invalidateOutbox: vi.fn(),
  prepareActions: vi.fn(),
  retainPublishedActions: vi.fn(),
  publishTimeline: vi.fn(),
  quiesceAdmission: vi.fn(),
  readAuthority: vi.fn(),
  readOutbox: vi.fn(),
  reconcileActivities: vi.fn(),
  reconcileOutbox: vi.fn(),
  reconcileCapturedOutbox: vi.fn(),
  resolveActions: vi.fn(),
  runWithOwnerAuthority: vi.fn(),
  activityStart: vi.fn(),
  activityGetInstances: vi.fn(),
  randomUUID: vi.fn(),
}));

vi.mock('./lifecycleCoordinator', () => ({
  mountRoutineWidgetLifecycleWithDependencies: mocks.mount,
}));
vi.mock('./controllerCore', () => ({
  RoutineWidgetReconciliationCoordinator: class {
    invalidate = mocks.invalidateOutbox;
    reconcile = mocks.reconcileOutbox;
    reconcileCaptured = mocks.reconcileCapturedOutbox;
  },
}));
vi.mock('./actionRegistry', () => ({
  acknowledgeRoutineWidgetActionTokens: mocks.acknowledgeActions,
  clearRoutineWidgetActions: mocks.clearActions,
  discardRoutineWidgetPreparedActions: mocks.discardPreparedActions,
  prepareRoutineWidgetActions: mocks.prepareActions,
  retainOnlyPublishedRoutineWidgetActions: mocks.retainPublishedActions,
  resolveRoutineWidgetActionTokens: mocks.resolveActions,
}));
vi.mock('./nativeLifecycle', () => ({
  activateRoutineWidgetNativeOwner: mocks.activateOwner,
  clearRoutineWidgetNativeState: mocks.clearNativeState,
  closeRoutineWidgetNativeAdmission: mocks.closeAdmission,
  commitRoutineWidgetNativeReconciliation: mocks.commitReconciliation,
  commitRoutineWidgetNativeQuiescedReconciliation: mocks.commitCapturedReconciliation,
  publishRoutineWidgetNativeTimeline: mocks.publishTimeline,
  quiesceRoutineWidgetNativeAdmission: mocks.quiesceAdmission,
  readRoutineWidgetNativeAuthority: mocks.readAuthority,
  readRoutineWidgetNativeOutbox: mocks.readOutbox,
  reconcileRoutineWidgetNativeActivities: mocks.reconcileActivities,
  routineWidgetNativeStateConfigured: () => mocks.nativeConfigured,
}));
vi.mock('./ownerAuthority', () => ({
  runWithRoutineWidgetOwnerAuthority: mocks.runWithOwnerAuthority,
}));
vi.mock('./runtimeGate', () => ({
  get ROUTINE_LIVE_ACTIVITY_START_ENABLED() {
    return mocks.liveActivityStartEnabled;
  },
  ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED: true,
  routineWidgetRuntimeEnabled: () => mocks.runtimeEnabled,
}));
vi.mock('./TonightActivity.ios', () => ({
  default: {
    getInstances: mocks.activityGetInstances,
    start: mocks.activityStart,
  },
}));
vi.mock('expo-crypto', () => ({ randomUUID: mocks.randomUUID }));
vi.mock('@/features/today/completionsStore', () => ({
  toggleCompletion: mocks.completeAction,
}));
vi.mock('@/lib/env', () => ({ env: { appEnvironment: 'production' } }));

const lease = {
  accountGeneration: 2,
  epoch: 7,
  expiresAt: new Date(2026, 6, 16, 9, 5).getTime(),
  generation: 3,
  ownerUserId: 'owner-a',
  signal: new AbortController().signal,
  assertCurrent: vi.fn(),
};

function enableProductionWiring(): void {
  mocks.nativeConfigured = true;
  mocks.runtimeEnabled = true;
}

function arrangeSuccessfulMount(): void {
  mocks.runWithOwnerAuthority.mockImplementation(
    async (_input: unknown, operation: (authority: unknown, leaseValue: unknown) => unknown) =>
      operation(
        {
          schemaVersion: 1,
          ownerUserId: 'owner-a',
          ownerGeneration: OWNER_GENERATION,
          processingEpoch: 7,
          processingGeneration: 3,
          accountGeneration: 2,
        },
        lease,
      ),
  );
  mocks.mount.mockImplementation((input, dependencies: RoutineWidgetLifecycleDependencies) => {
    void dependencies.runWithOwnerAuthority(input, async () => undefined);
    return mocks.release;
  });
}

function publication(
  overrides: Partial<{
    completedCount: number;
    liveActivityEnabled: boolean;
    phase: 'AM' | 'PM';
    remainingStepKeys: readonly string[];
    totalCount: number;
  }> = {},
): RoutineWidgetLifecyclePublicationOptions {
  const phase = overrides.phase ?? 'AM';
  return {
    readSnapshot: () => ({
      enabled: true,
      completedCount: overrides.completedCount ?? 0,
      liveActivityEnabled: overrides.liveActivityEnabled ?? false,
      localDate: '2026-07-16',
      phase,
      remainingStepKeys: overrides.remainingStepKeys ?? [`${phase}:cleanser`],
      totalCount: overrides.totalCount ?? 1,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 16, 9, 0));
  lease.expiresAt = new Date(2026, 6, 16, 9, 5).getTime();
  mocks.nativeConfigured = false;
  mocks.runtimeEnabled = false;
  mocks.liveActivityStartEnabled = true;
  mocks.mount.mockReturnValue(mocks.release);
  mocks.clearActions.mockResolvedValue(undefined);
  mocks.discardPreparedActions.mockResolvedValue(undefined);
  mocks.retainPublishedActions.mockResolvedValue(undefined);
  mocks.closeAdmission.mockReturnValue({ status: 'closed' });
  mocks.clearNativeState.mockResolvedValue({
    status: 'cleared',
    authority: null,
    endedActivities: 0,
  });
  mocks.readAuthority.mockReturnValue({
    schemaVersion: 1,
    authorityNonce: AUTHORITY_NONCE,
    enabled: true,
    ownerGeneration: OWNER_GENERATION,
  });
  mocks.readOutbox.mockReturnValue({
    schemaVersion: 1,
    authorityNonce: AUTHORITY_NONCE,
    records: [],
  });
  mocks.reconcileActivities.mockResolvedValue({ ended: 0, kept: 0 });
  mocks.reconcileOutbox.mockResolvedValue({
    acknowledgedTokenCount: 0,
    completedStepCount: 0,
    ignoredTokenCount: 0,
    nativeStatus: 'empty',
    outboxRecordCount: 0,
    resolvedTokenCount: 0,
  });
  mocks.reconcileCapturedOutbox.mockResolvedValue({
    acknowledgedTokenCount: 0,
    completedStepCount: 0,
    ignoredTokenCount: 0,
    nativeStatus: 'empty',
    outboxRecordCount: 0,
    resolvedTokenCount: 0,
  });
  mocks.publishTimeline.mockReturnValue({ status: 'published' });
  mocks.quiesceAdmission.mockReturnValue({
    status: 'quiesced',
    ownerGeneration: OWNER_GENERATION,
    quiescenceNonce: QUIESCENCE_NONCE,
    outbox: {
      schemaVersion: 1,
      authorityNonce: AUTHORITY_NONCE,
      records: [],
    },
  });
  mocks.prepareActions.mockResolvedValue({
    actionTokens: [ACTION_TOKEN],
    ownerGeneration: OWNER_GENERATION,
    snapshotNonce: SNAPSHOT_NONCE,
  });
  mocks.activityGetInstances.mockReturnValue([]);
  mocks.randomUUID.mockReturnValue(SNAPSHOT_NONCE);
});

describe('iOS routine widget lifecycle production wiring', () => {
  it('passes exact activation dependencies and requires every native capability gate', () => {
    const input = { ownerUserId: 'owner-a', processingEpoch: 7 };
    const release = mountRoutineWidgetLifecycle(input);

    expect(mocks.mount).toHaveBeenCalledOnce();
    expect(mocks.mount.mock.calls[0]?.[0]).toEqual(input);

    const dependencies = mocks.mount.mock.calls[0]?.[1] as RoutineWidgetLifecycleDependencies;
    expect(dependencies.capabilityEnabled()).toBe(false);
    mocks.runtimeEnabled = true;
    expect(dependencies.capabilityEnabled()).toBe(false);
    mocks.nativeConfigured = true;
    expect(dependencies.capabilityEnabled()).toBe(true);

    expect(dependencies).toMatchObject({
      activateOwner: mocks.activateOwner,
      closeAdmission: mocks.closeAdmission,
      clearNativeState: expect.any(Function),
      readAuthority: mocks.readAuthority,
      reconcileActivities: mocks.reconcileActivities,
    });
    expect(dependencies.controllerDependencies).toMatchObject({
      acknowledgeActions: mocks.acknowledgeActions,
      commitReconciliation: mocks.commitReconciliation,
      readAuthority: mocks.readAuthority,
      readOutbox: mocks.readOutbox,
      resolveActions: mocks.resolveActions,
    });
    expect(dependencies.controllerDependencies.completeAction).not.toBe(mocks.completeAction);

    release();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('waits for activation, verifies an empty outbox, and publishes an exact current/stale pair', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      publication(),
    );

    await release.refresh();

    expect(mocks.reconcileOutbox).toHaveBeenCalledWith(
      OWNER_GENERATION,
      expect.objectContaining({ readOutbox: mocks.readOutbox }),
    );
    expect(mocks.prepareActions).toHaveBeenCalledWith({
      ownerGeneration: OWNER_GENERATION,
      localDate: '2026-07-16',
      phase: 'AM',
      stepKeys: ['AM:cleanser'],
      expiresAt: new Date(2026, 6, 16, 9, 4, 30).getTime(),
    });
    expect(mocks.publishTimeline).toHaveBeenCalledOnce();
    const [authorityNonce, entries] = mocks.publishTimeline.mock.calls[0]!;
    expect(authorityNonce).toBe(AUTHORITY_NONCE);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      timestamp: new Date(2026, 6, 16, 9, 0).getTime(),
      props: {
        status: 'ready',
        phase: 'AM',
        completedCount: 0,
        totalCount: 1,
        actionTokens: [ACTION_TOKEN],
      },
    });
    expect(entries[1]).toMatchObject({
      timestamp: new Date(2026, 6, 16, 9, 4, 30).getTime(),
      props: { status: 'stale', phase: 'none', actionTokens: [] },
    });
    expect(mocks.activityStart).not.toHaveBeenCalled();
  });

  it('refetches canonical completions and withholds stale publication after initial reconciliation writes', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    mocks.completeAction.mockResolvedValue({ done: true, inserted: true });
    mocks.mount.mockImplementation((input, dependencies: RoutineWidgetLifecycleDependencies) => {
      void dependencies.runWithOwnerAuthority(input, async () => {
        await dependencies.controllerDependencies.completeAction('AM:cleanser', '2026-07-16');
      });
      return mocks.release;
    });
    const onCanonicalMutation = vi.fn().mockResolvedValue(undefined);
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      { ...publication(), onCanonicalMutation },
    );

    await release.refresh();

    expect(onCanonicalMutation).toHaveBeenCalledOnce();
    expect(mocks.reconcileOutbox).not.toHaveBeenCalled();
    expect(mocks.publishTimeline).not.toHaveBeenCalled();
  });

  it('starts an opted-in PM activity only after publishing its matching widget snapshot', async () => {
    vi.setSystemTime(new Date(2026, 6, 16, 21, 0));
    lease.expiresAt = new Date(2026, 6, 16, 21, 5).getTime();
    enableProductionWiring();
    arrangeSuccessfulMount();
    mocks.publishTimeline.mockImplementation(() => {
      expect(mocks.activityStart).not.toHaveBeenCalled();
      return { status: 'published' };
    });
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      publication({ phase: 'PM', liveActivityEnabled: true }),
    );

    await release.refresh();

    expect(mocks.activityStart).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerGeneration: OWNER_GENERATION,
        snapshotNonce: SNAPSHOT_NONCE,
        status: 'in_progress',
      }),
      'layerwell://today',
    );
  });

  it('updates one matching opted-in PM activity and ends duplicate instances', async () => {
    vi.setSystemTime(new Date(2026, 6, 16, 21, 0));
    lease.expiresAt = new Date(2026, 6, 16, 21, 5).getTime();
    enableProductionWiring();
    arrangeSuccessfulMount();
    const current = { update: vi.fn().mockResolvedValue(undefined), end: vi.fn() };
    const duplicate = { update: vi.fn(), end: vi.fn().mockResolvedValue(undefined) };
    mocks.activityGetInstances.mockReturnValue([current, duplicate]);
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      publication({ phase: 'PM', liveActivityEnabled: true }),
    );

    await release.refresh();

    expect(current.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_progress', snapshotNonce: SNAPSHOT_NONCE }),
    );
    expect(current.end).not.toHaveBeenCalled();
    expect(duplicate.end).toHaveBeenCalledWith('immediate');
    expect(mocks.activityStart).not.toHaveBeenCalled();
  });

  it('keeps Live Activity operations cleanup-only while the separate signed JS gate is closed', async () => {
    vi.setSystemTime(new Date(2026, 6, 16, 21, 0));
    lease.expiresAt = new Date(2026, 6, 16, 21, 5).getTime();
    enableProductionWiring();
    arrangeSuccessfulMount();
    mocks.liveActivityStartEnabled = false;
    const current = {
      update: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    };
    mocks.activityGetInstances.mockReturnValue([current]);
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      publication({ phase: 'PM', liveActivityEnabled: true }),
    );

    await release.refresh();

    expect(current.end).toHaveBeenCalledWith('immediate');
    expect(current.update).not.toHaveBeenCalled();
    expect(mocks.activityStart).not.toHaveBeenCalled();
  });

  it('refetches canonical completions and republishes under the same owner lease', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    mocks.reconcileOutbox.mockResolvedValue({
      acknowledgedTokenCount: 1,
      completedStepCount: 1,
      ignoredTokenCount: 0,
      nativeStatus: 'committed',
      outboxRecordCount: 1,
      resolvedTokenCount: 1,
    });
    const onCanonicalMutation = vi.fn();
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      { ...publication(), onCanonicalMutation },
    );

    await release.refresh();

    expect(onCanonicalMutation).toHaveBeenCalledOnce();
    expect(mocks.prepareActions).toHaveBeenCalledOnce();
    expect(mocks.publishTimeline).toHaveBeenCalledOnce();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it('leaves a sustained concurrent outbox durable without releasing or purging authority', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    mocks.readOutbox.mockReturnValue({
      schemaVersion: 1,
      authorityNonce: AUTHORITY_NONCE,
      records: [{}],
    });
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      publication(),
    );

    await release.refresh();

    expect(mocks.prepareActions).not.toHaveBeenCalled();
    expect(mocks.publishTimeline).not.toHaveBeenCalled();
    expect(mocks.reconcileOutbox).toHaveBeenCalledTimes(4);
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it('reconciles and retries when an AppIntent wins the final native publication CAS', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    mocks.publishTimeline
      .mockReturnValueOnce({ status: 'outbox_pending' })
      .mockReturnValue({ status: 'published' });
    mocks.reconcileOutbox
      .mockResolvedValueOnce({
        acknowledgedTokenCount: 0,
        completedStepCount: 0,
        ignoredTokenCount: 0,
        nativeStatus: 'empty',
        outboxRecordCount: 0,
        resolvedTokenCount: 0,
      })
      .mockResolvedValueOnce({
        acknowledgedTokenCount: 1,
        completedStepCount: 1,
        ignoredTokenCount: 0,
        nativeStatus: 'committed',
        outboxRecordCount: 1,
        resolvedTokenCount: 1,
      });
    const onCanonicalMutation = vi.fn().mockResolvedValue(undefined);
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      { ...publication(), onCanonicalMutation },
    );

    await release.refresh();

    expect(mocks.publishTimeline).toHaveBeenCalledTimes(2);
    expect(mocks.discardPreparedActions).toHaveBeenCalledWith({
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: SNAPSHOT_NONCE,
    });
    expect(mocks.retainPublishedActions).toHaveBeenCalledOnce();
    expect(mocks.reconcileOutbox).toHaveBeenCalledTimes(2);
    expect(onCanonicalMutation).toHaveBeenCalledOnce();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it('treats a stale Live Activity authorization as typed concurrency and retries safely', async () => {
    vi.setSystemTime(new Date(2026, 6, 16, 21, 0));
    lease.expiresAt = new Date(2026, 6, 16, 21, 5).getTime();
    enableProductionWiring();
    arrangeSuccessfulMount();
    const staleError = Object.assign(new Error('stale activity'), {
      code: 'ERR_LAYERWELL_LIVE_ACTIVITY_STALE',
    });
    const current = {
      update: vi.fn().mockRejectedValueOnce(staleError).mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
    };
    mocks.activityGetInstances.mockReturnValue([current]);
    mocks.reconcileOutbox
      .mockResolvedValueOnce({
        acknowledgedTokenCount: 0,
        completedStepCount: 0,
        ignoredTokenCount: 0,
        nativeStatus: 'empty',
        outboxRecordCount: 0,
        resolvedTokenCount: 0,
      })
      .mockResolvedValueOnce({
        acknowledgedTokenCount: 1,
        completedStepCount: 1,
        ignoredTokenCount: 0,
        nativeStatus: 'committed',
        outboxRecordCount: 1,
        resolvedTokenCount: 1,
      });
    const onCanonicalMutation = vi.fn().mockResolvedValue(undefined);
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      { ...publication({ phase: 'PM', liveActivityEnabled: true }), onCanonicalMutation },
    );

    await release.refresh();

    expect(current.end).toHaveBeenCalledWith('immediate');
    expect(current.update).toHaveBeenCalledTimes(2);
    expect(mocks.publishTimeline).toHaveBeenCalledTimes(2);
    expect(mocks.discardPreparedActions).not.toHaveBeenCalled();
    expect(mocks.retainPublishedActions).toHaveBeenCalledTimes(2);
    expect(onCanonicalMutation).toHaveBeenCalledOnce();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it('awaits a freshly created stale Live Activity ending before retrying publication', async () => {
    vi.setSystemTime(new Date(2026, 6, 16, 21, 0));
    lease.expiresAt = new Date(2026, 6, 16, 21, 5).getTime();
    enableProductionWiring();
    arrangeSuccessfulMount();
    const staleError = Object.assign(new Error('post-start authority race'), {
      code: 'ERR_LAYERWELL_LIVE_ACTIVITY_STALE',
    });
    let endFinished = false;
    let finishEnd!: () => void;
    let signalEndStarted!: () => void;
    const endStarted = new Promise<void>((resolve) => {
      signalEndStarted = resolve;
    });
    const endBarrier = new Promise<void>((resolve) => {
      finishEnd = () => {
        endFinished = true;
        resolve();
      };
    });
    const fresh = {
      update: vi.fn().mockResolvedValue(undefined),
      end: vi.fn(async () => {
        signalEndStarted();
        await endBarrier;
      }),
    };
    mocks.activityGetInstances
      .mockReturnValueOnce([])
      .mockReturnValueOnce([fresh])
      .mockReturnValue([]);
    mocks.activityStart
      .mockImplementationOnce(() => {
        throw staleError;
      })
      .mockImplementationOnce(() => {
        expect(endFinished).toBe(true);
      });
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      publication({ phase: 'PM', liveActivityEnabled: true }),
    );

    const refresh = release.refresh();
    await endStarted;

    expect(fresh.end).toHaveBeenCalledWith('immediate');
    expect(mocks.publishTimeline).toHaveBeenCalledTimes(1);
    expect(mocks.activityStart).toHaveBeenCalledTimes(1);

    finishEnd();
    await refresh;

    expect(mocks.activityGetInstances).toHaveBeenCalledTimes(3);
    expect(mocks.activityStart).toHaveBeenCalledTimes(2);
    expect(mocks.publishTimeline).toHaveBeenCalledTimes(2);
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it('clears native and private capability state for an ineligible snapshot', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      { readSnapshot: () => ({ enabled: false }) },
    );

    await release.refresh();

    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.publishTimeline).not.toHaveBeenCalled();
  });

  it('withdraws prepared capabilities when eligibility changes before native publication', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    const eligible = publication().readSnapshot();
    const readSnapshot = vi
      .fn<() => ReturnType<RoutineWidgetLifecyclePublicationOptions['readSnapshot']>>()
      .mockReturnValueOnce(eligible)
      .mockReturnValueOnce(eligible)
      .mockReturnValue({ enabled: false });
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      { readSnapshot },
    );

    await release.refresh();

    expect(mocks.prepareActions).toHaveBeenCalledOnce();
    expect(mocks.publishTimeline).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('withholds publication when the health lease cannot preserve reconciliation headroom', async () => {
    lease.expiresAt = new Date(2026, 6, 16, 9, 0, 29).getTime();
    enableProductionWiring();
    arrangeSuccessfulMount();
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      publication(),
    );

    await release.refresh();

    expect(mocks.prepareActions).not.toHaveBeenCalled();
    expect(mocks.publishTimeline).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('drains only the matching native outbox and seals admission without publishing', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    mountRoutineWidgetLifecycle({ ownerUserId: 'owner-a', processingEpoch: 7 }, publication());

    await expect(
      drainRoutineWidgetOutboxBeforeHealthLeaseClose({
        ownerUserId: 'owner-a',
        processingEpoch: 7,
      }),
    ).resolves.toEqual({ status: 'drained' });

    expect(mocks.quiesceAdmission).toHaveBeenCalledWith({
      expectedAuthorityNonce: AUTHORITY_NONCE,
      ownerGeneration: OWNER_GENERATION,
    });
    expect(mocks.reconcileCapturedOutbox).toHaveBeenCalledWith(
      {
        expectedAuthorityNonce: AUTHORITY_NONCE,
        expectedOwnerGeneration: OWNER_GENERATION,
        outbox: { schemaVersion: 1, authorityNonce: AUTHORITY_NONCE, records: [] },
        quiescenceNonce: QUIESCENCE_NONCE,
      },
      expect.objectContaining({ commitReconciliation: mocks.commitReconciliation }),
    );
    expect(mocks.closeAdmission).not.toHaveBeenCalled();
    expect(mocks.publishTimeline).not.toHaveBeenCalled();
  });

  it('resolves the exact final outbox captured by native quiescence before returning drained', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    const finalRecord = {
      actionToken: ACTION_TOKEN,
      createdAtMs: new Date(2026, 6, 16, 9, 0).getTime(),
      localDate: '2026-07-16',
      ownerGeneration: OWNER_GENERATION,
      phase: 'AM' as const,
      revision: 1,
      snapshotNonce: SNAPSHOT_NONCE,
      staleAtMs: new Date(2026, 6, 16, 9, 4, 30).getTime(),
    };
    mocks.quiesceAdmission.mockReturnValueOnce({
      status: 'quiesced',
      ownerGeneration: OWNER_GENERATION,
      quiescenceNonce: QUIESCENCE_NONCE,
      outbox: {
        schemaVersion: 1,
        authorityNonce: AUTHORITY_NONCE,
        records: [finalRecord],
      },
    });
    mocks.reconcileCapturedOutbox.mockResolvedValueOnce({
      acknowledgedTokenCount: 1,
      completedStepCount: 1,
      ignoredTokenCount: 0,
      nativeStatus: 'committed',
      outboxRecordCount: 1,
      resolvedTokenCount: 1,
    });
    const onCanonicalMutation = vi.fn().mockResolvedValue(undefined);
    mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      { ...publication(), onCanonicalMutation },
    );

    await expect(
      drainRoutineWidgetOutboxBeforeHealthLeaseClose({
        ownerUserId: 'owner-a',
        processingEpoch: 7,
      }),
    ).resolves.toEqual({ status: 'drained' });

    expect(mocks.reconcileCapturedOutbox).toHaveBeenCalledWith(
      expect.objectContaining({ outbox: expect.objectContaining({ records: [finalRecord] }) }),
      expect.any(Object),
    );
    expect(onCanonicalMutation).toHaveBeenCalledOnce();
    expect(mocks.closeAdmission).not.toHaveBeenCalled();
  });

  it('synchronously seals admission when the matching Host cannot run publication', async () => {
    arrangeSuccessfulMount();
    mountRoutineWidgetLifecycle({ ownerUserId: 'owner-a', processingEpoch: 7 }, publication());

    const result = drainRoutineWidgetOutboxBeforeHealthLeaseClose({
      ownerUserId: 'owner-a',
      processingEpoch: 7,
    });

    expect(mocks.closeAdmission).toHaveBeenCalledOnce();
    await expect(result).resolves.toEqual({ status: 'skipped' });
    expect(mocks.reconcileOutbox).not.toHaveBeenCalled();
    expect(mocks.publishTimeline).not.toHaveBeenCalled();
  });

  it('keeps atomically quiesced admission closed when captured reconciliation times out', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    mocks.reconcileCapturedOutbox.mockReturnValue(new Promise(() => undefined));
    mountRoutineWidgetLifecycle({ ownerUserId: 'owner-a', processingEpoch: 7 }, publication());
    const draining = drainRoutineWidgetOutboxBeforeHealthLeaseClose({
      ownerUserId: 'owner-a',
      processingEpoch: 7,
    });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(ROUTINE_WIDGET_PRE_CLOSE_DRAIN_TIMEOUT_MS);

    await expect(draining).resolves.toEqual({ status: 'timed_out' });
    expect(mocks.quiesceAdmission).toHaveBeenCalledOnce();
    expect(mocks.closeAdmission).not.toHaveBeenCalled();
    expect(mocks.publishTimeline).not.toHaveBeenCalled();
  });

  it('keeps atomic admission closed on captured failure and closes when no Host is active', async () => {
    enableProductionWiring();
    arrangeSuccessfulMount();
    mocks.reconcileCapturedOutbox.mockRejectedValueOnce(new Error('outbox read failed'));
    const release = mountRoutineWidgetLifecycle(
      { ownerUserId: 'owner-a', processingEpoch: 7 },
      publication(),
    );

    await expect(
      drainRoutineWidgetOutboxBeforeHealthLeaseClose({
        ownerUserId: 'owner-a',
        processingEpoch: 7,
      }),
    ).resolves.toEqual({ status: 'failed' });
    expect(mocks.quiesceAdmission).toHaveBeenCalledOnce();
    expect(mocks.closeAdmission).not.toHaveBeenCalled();

    release();
    mocks.closeAdmission.mockClear();
    await expect(
      drainRoutineWidgetOutboxBeforeHealthLeaseClose({
        ownerUserId: 'owner-b',
        processingEpoch: 8,
      }),
    ).resolves.toEqual({ status: 'skipped' });
    expect(mocks.closeAdmission).toHaveBeenCalledOnce();

    mocks.closeAdmission.mockReturnValueOnce({ status: 'not_configured' });
    await expect(
      drainRoutineWidgetOutboxBeforeHealthLeaseClose({
        ownerUserId: 'owner-c',
        processingEpoch: 9,
      }),
    ).resolves.toEqual({ status: 'failed' });
  });
});
