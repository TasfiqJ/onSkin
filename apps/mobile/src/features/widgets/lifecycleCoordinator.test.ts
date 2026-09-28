import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RoutineWidgetLifecycleCoordinator,
  type RoutineWidgetLifecycleDependencies,
} from './lifecycleCoordinator';

vi.mock('./actionRegistry', () => ({
  acknowledgeRoutineWidgetActionTokens: vi.fn(),
  resolveRoutineWidgetActionTokens: vi.fn(),
}));
vi.mock('./nativeLifecycle', () => ({
  activateRoutineWidgetNativeOwner: vi.fn(),
  clearRoutineWidgetNativeState: vi.fn(),
  closeRoutineWidgetNativeAdmission: vi.fn(),
  commitRoutineWidgetNativeReconciliation: vi.fn(),
  readRoutineWidgetNativeAuthority: vi.fn(),
  readRoutineWidgetNativeOutbox: vi.fn(),
  reconcileRoutineWidgetNativeActivities: vi.fn(),
  routineWidgetNativeStateConfigured: vi.fn(() => false),
}));
vi.mock('./ownerAuthority', () => ({ runWithRoutineWidgetOwnerAuthority: vi.fn() }));
vi.mock('./runtimeGate', () => ({
  ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED: false,
  routineWidgetRuntimeEnabled: vi.fn(() => false),
}));
vi.mock('@/features/today/completionsStore', () => ({ toggleCompletion: vi.fn() }));

const NONCE = '10000000-0000-4000-8000-000000000001';
const NONCE_AFTER_ACTIVATION = '20000000-0000-4000-8000-000000000002';
const OWNER_A_GENERATION = '30000000-0000-4000-8000-000000000003';
const OWNER_B_GENERATION = '40000000-0000-4000-8000-000000000004';

function harness(capabilityEnabled: boolean) {
  const events: string[] = [];
  let activeOwnerGeneration: string | null = null;
  let activityCall = 0;
  let releaseFirstActivity: (() => void) | null = null;
  const firstActivity = new Promise<void>((resolve) => {
    releaseFirstActivity = resolve;
  });
  let holdFirstActivity = false;
  const clearNativeState = vi.fn(async () => {
    events.push('native:clear');
    activeOwnerGeneration = null;
    return { status: 'not_configured' as const, authority: null, endedActivities: 0 };
  });
  const closeAdmission = vi.fn(() => {
    events.push('native:close-admission');
    return { status: 'closed' as const };
  });
  const activateOwner = vi.fn(
    ({ ownerGeneration }: { expectedAuthorityNonce: string; ownerGeneration: string }) => {
      events.push(`native:activate:${ownerGeneration}`);
      activeOwnerGeneration = ownerGeneration;
      return {
        schemaVersion: 1 as const,
        authorityNonce: NONCE_AFTER_ACTIVATION,
        enabled: true,
        ownerGeneration,
      };
    },
  );
  const readAuthority = vi.fn(() => {
    events.push('native:read-authority');
    return activeOwnerGeneration
      ? {
          schemaVersion: 1 as const,
          authorityNonce: NONCE_AFTER_ACTIVATION,
          enabled: true,
          ownerGeneration: activeOwnerGeneration,
        }
      : {
          schemaVersion: 1 as const,
          authorityNonce: NONCE,
          enabled: false,
          ownerGeneration: null,
        };
  });
  const reconcileActivities = vi.fn(async () => {
    activityCall += 1;
    events.push(`native:activities:${activityCall}`);
    if (holdFirstActivity && activityCall === 1) await firstActivity;
    return { ended: 0, kept: 0 };
  });
  const runWithOwnerAuthority = vi.fn(async (input, operation) => {
    events.push(`private:owner:${input.ownerUserId}`);
    const ownerGeneration =
      input.ownerUserId === 'owner-a' ? OWNER_A_GENERATION : OWNER_B_GENERATION;
    const lease = {
      generation: input.ownerUserId === 'owner-a' ? 1 : 2,
      epoch: input.processingEpoch,
      ownerUserId: input.ownerUserId,
      accountGeneration: input.ownerUserId === 'owner-a' ? 1 : 2,
      expiresAt: 999_999,
      signal: new AbortController().signal,
      assertCurrent: vi.fn(),
    };
    return operation(
      {
        schemaVersion: 1,
        ownerUserId: input.ownerUserId,
        ownerGeneration,
        processingEpoch: input.processingEpoch,
        processingGeneration: lease.generation,
        accountGeneration: lease.accountGeneration,
      },
      lease,
    );
  }) as unknown as RoutineWidgetLifecycleDependencies['runWithOwnerAuthority'];

  const dependencies: RoutineWidgetLifecycleDependencies = {
    activateOwner,
    capabilityEnabled: () => capabilityEnabled,
    closeAdmission,
    clearNativeState,
    controllerDependencies: {
      acknowledgeActions: vi.fn(async () => 0),
      commitCapturedReconciliation: vi.fn(() => ({ status: 'redacted' as const })),
      commitReconciliation: vi.fn(() => ({ status: 'redacted' as const })),
      completeAction: vi.fn(async () => ({ done: true, inserted: true })),
      readAuthority,
      readOutbox: vi.fn((authorityNonce: string) => {
        events.push(`native:outbox:${activeOwnerGeneration}`);
        return { schemaVersion: 1 as const, authorityNonce, records: [] };
      }),
      resolveActions: vi.fn(async () => []),
    },
    readAuthority,
    reconcileActivities,
    runWithOwnerAuthority,
  };
  return {
    activateOwner,
    closeAdmission,
    clearNativeState,
    dependencies,
    events,
    holdFirstActivity: () => {
      holdFirstActivity = true;
    },
    releaseFirstActivity: () => releaseFirstActivity?.(),
    runWithOwnerAuthority,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('serialized routine widget lifecycle', () => {
  it('is clear-only while the publication capability remains hard-disabled', async () => {
    const test = harness(false);
    const coordinator = new RoutineWidgetLifecycleCoordinator(test.dependencies);
    const release = coordinator.mount({ ownerUserId: 'owner-a', processingEpoch: 1 });

    await vi.waitFor(() => expect(test.clearNativeState).toHaveBeenCalledOnce());
    expect(test.closeAdmission).toHaveBeenCalledOnce();
    expect(test.events.slice(0, 2)).toEqual(['native:close-admission', 'native:clear']);
    expect(test.runWithOwnerAuthority).not.toHaveBeenCalled();
    expect(test.activateOwner).not.toHaveBeenCalled();

    release();
    await vi.waitFor(() => expect(test.clearNativeState).toHaveBeenCalledTimes(2));
    expect(test.closeAdmission).toHaveBeenCalledTimes(2);
  });

  it('activates exact opaque authority and reconciles before the queue advances', async () => {
    const test = harness(true);
    const coordinator = new RoutineWidgetLifecycleCoordinator(test.dependencies);
    coordinator.mount({ ownerUserId: 'owner-a', processingEpoch: 1 });

    await vi.waitFor(() =>
      expect(test.dependencies.controllerDependencies.readOutbox).toHaveBeenCalledOnce(),
    );
    expect(test.events).toEqual([
      'private:owner:owner-a',
      'native:read-authority',
      `native:activate:${OWNER_A_GENERATION}`,
      'native:activities:1',
      'native:read-authority',
      `native:outbox:${OWNER_A_GENERATION}`,
    ]);
  });

  it('finishes A privacy cleanup before B can activate after an awaiting release', async () => {
    const test = harness(true);
    test.holdFirstActivity();
    const coordinator = new RoutineWidgetLifecycleCoordinator(test.dependencies);
    const releaseA = coordinator.mount({ ownerUserId: 'owner-a', processingEpoch: 1 });
    await vi.waitFor(() => expect(test.dependencies.reconcileActivities).toHaveBeenCalledOnce());

    releaseA();
    coordinator.mount({ ownerUserId: 'owner-b', processingEpoch: 2 });
    test.releaseFirstActivity();

    await vi.waitFor(() =>
      expect(test.dependencies.controllerDependencies.readOutbox).toHaveBeenCalledOnce(),
    );
    const bActivation = test.events.indexOf(`native:activate:${OWNER_B_GENERATION}`);
    const lastClearBeforeB = test.events.lastIndexOf('native:clear', bActivation);
    expect(lastClearBeforeB).toBeGreaterThanOrEqual(0);
    expect(lastClearBeforeB).toBeLessThan(bActivation);
    expect(test.events).not.toContain(`native:outbox:${OWNER_A_GENERATION}`);
  });

  it('keeps the queue usable after a surfaced privacy cleanup failure', async () => {
    const test = harness(true);
    test.clearNativeState.mockRejectedValueOnce(new Error('app group unavailable'));
    const coordinator = new RoutineWidgetLifecycleCoordinator(test.dependencies);

    await expect(coordinator.clearForPrivacy()).rejects.toThrow('app group unavailable');
    coordinator.mount({ ownerUserId: 'owner-b', processingEpoch: 2 });
    await vi.waitFor(() =>
      expect(test.dependencies.controllerDependencies.readOutbox).toHaveBeenCalledOnce(),
    );
    expect(test.activateOwner).toHaveBeenCalledWith({
      expectedAuthorityNonce: NONCE,
      ownerGeneration: OWNER_B_GENERATION,
    });
  });

  it('closes admission synchronously even when an older FIFO operation never resolves', async () => {
    const test = harness(true);
    const reconcileActivities = vi.fn(() => new Promise<never>(() => undefined));
    const dependencies = { ...test.dependencies, reconcileActivities };
    const coordinator = new RoutineWidgetLifecycleCoordinator(dependencies);
    coordinator.mount({ ownerUserId: 'owner-a', processingEpoch: 1 });
    await vi.waitFor(() => expect(reconcileActivities).toHaveBeenCalledOnce());

    const cleanup = coordinator.clearForPrivacy();
    void cleanup.catch(() => undefined);

    expect(test.closeAdmission).toHaveBeenCalledOnce();
    expect(test.clearNativeState).not.toHaveBeenCalled();
    expect(test.events.at(-1)).toBe('native:close-admission');
  });

  it('still queues the full purge when synchronous close admission fails', async () => {
    const test = harness(true);
    test.closeAdmission.mockImplementationOnce(() => {
      throw new Error('close admission unavailable');
    });
    const coordinator = new RoutineWidgetLifecycleCoordinator(test.dependencies);

    await expect(coordinator.clearForPrivacy()).rejects.toThrow('close admission unavailable');
    expect(test.clearNativeState).toHaveBeenCalledOnce();
  });
});
