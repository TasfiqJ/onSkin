import { describe, expect, it, vi } from 'vitest';

import type { ResolvedRoutineWidgetAction } from './actionRegistry';
import {
  ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE,
  ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID,
  ROUTINE_WIDGET_CANONICAL_COMPLETION_REJECTED,
  ROUTINE_WIDGET_NATIVE_AUTHORITY_INVALID,
  ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID,
  ROUTINE_WIDGET_NATIVE_RECONCILIATION_INVALID,
  ROUTINE_WIDGET_RECONCILIATION_INVALIDATED,
  RoutineWidgetReconciliationCoordinator,
  type RoutineWidgetControllerDependencies,
} from './controllerCore';
import type {
  RoutineWidgetNativeAuthority,
  RoutineWidgetNativeOutbox,
} from './nativeLifecycleContract';

const NOW = 20_000;
const AUTHORITY_NONCE = '10000000-0000-4000-8000-000000000001';
const OWNER_GENERATION = '20000000-0000-4000-8000-000000000002';
const SNAPSHOT_NONCE = '30000000-0000-4000-8000-000000000003';
const TOKEN_A = '40000000-0000-4000-8000-000000000004';
const TOKEN_B = '50000000-0000-4000-8000-000000000005';
const QUIESCENCE_NONCE = '60000000-0000-4000-8000-000000000006';

function authority(
  overrides: Partial<RoutineWidgetNativeAuthority> = {},
): RoutineWidgetNativeAuthority {
  return {
    schemaVersion: 1,
    authorityNonce: AUTHORITY_NONCE,
    enabled: true,
    ownerGeneration: OWNER_GENERATION,
    ...overrides,
  };
}

function outbox(overrides: Partial<RoutineWidgetNativeOutbox> = {}): RoutineWidgetNativeOutbox {
  return {
    schemaVersion: 1,
    authorityNonce: AUTHORITY_NONCE,
    records: [
      {
        actionToken: TOKEN_A,
        createdAtMs: NOW - 1_000,
        localDate: '2026-07-16',
        ownerGeneration: OWNER_GENERATION,
        phase: 'AM',
        revision: 1,
        snapshotNonce: SNAPSHOT_NONCE,
        staleAtMs: NOW + 60_000,
      },
      {
        actionToken: TOKEN_B,
        createdAtMs: NOW - 500,
        localDate: '2026-07-16',
        ownerGeneration: OWNER_GENERATION,
        phase: 'AM',
        revision: 2,
        snapshotNonce: SNAPSHOT_NONCE,
        staleAtMs: NOW + 60_000,
      },
    ],
    ...overrides,
  };
}

function harness(
  input: {
    authority?: RoutineWidgetNativeAuthority;
    outbox?: RoutineWidgetNativeOutbox;
    resolution?: readonly ResolvedRoutineWidgetAction[];
    nativeStatus?: 'committed' | 'redacted';
  } = {},
): {
  dependencies: RoutineWidgetControllerDependencies;
  events: string[];
} {
  const events: string[] = [];
  const resolution = input.resolution ?? [
    { token: TOKEN_A, stepKey: 'AM:cleanser', status: 'resolved' },
    { token: TOKEN_B, stepKey: 'AM:moisturizer', status: 'resolved' },
  ];
  return {
    events,
    dependencies: {
      acknowledgeActions: vi.fn(async () => {
        events.push('private:ack');
        return resolution.filter(({ status }) => status === 'resolved').length;
      }),
      commitReconciliation: vi.fn((request) => {
        events.push(`native:commit:${request.acceptedTokens.length}`);
        return { status: input.nativeStatus ?? 'committed' };
      }),
      commitCapturedReconciliation: vi.fn((request) => {
        events.push(`native:captured-commit:${request.acceptedTokens.length}`);
        return { status: input.nativeStatus ?? 'committed' };
      }),
      completeAction: vi.fn(async (stepKey) => {
        events.push(`canonical:${stepKey}`);
        return { done: true, inserted: true, firstEver: false };
      }),
      now: () => NOW,
      readAuthority: vi.fn(() => {
        events.push('native:authority');
        return input.authority ?? authority();
      }),
      readOutbox: vi.fn(() => {
        events.push('native:outbox');
        return input.outbox ?? outbox();
      }),
      resolveActions: vi.fn(async () => {
        events.push('private:resolve');
        return resolution;
      }),
    },
  };
}

describe('native routine widget outbox reconciliation', () => {
  it('orders resolve-all, canonical writes, native CAS, then private acknowledgement', async () => {
    const test = harness();
    const result = await new RoutineWidgetReconciliationCoordinator().reconcile(
      OWNER_GENERATION,
      test.dependencies,
    );

    expect(test.events).toEqual([
      'native:authority',
      'native:outbox',
      'private:resolve',
      'canonical:AM:cleanser',
      'canonical:AM:moisturizer',
      'native:commit:2',
      'private:ack',
    ]);
    expect(result).toEqual({
      acknowledgedTokenCount: 2,
      completedStepCount: 2,
      ignoredTokenCount: 0,
      nativeStatus: 'committed',
      outboxRecordCount: 2,
      resolvedTokenCount: 2,
    });
  });

  it('reconciles an atomically captured final outbox without reopening native admission', async () => {
    const test = harness();
    const result = await new RoutineWidgetReconciliationCoordinator().reconcileCaptured(
      {
        expectedAuthorityNonce: AUTHORITY_NONCE,
        expectedOwnerGeneration: OWNER_GENERATION,
        outbox: outbox(),
        quiescenceNonce: QUIESCENCE_NONCE,
      },
      test.dependencies,
    );

    expect(test.dependencies.readAuthority).not.toHaveBeenCalled();
    expect(test.dependencies.readOutbox).not.toHaveBeenCalled();
    expect(test.events).toEqual([
      'private:resolve',
      'canonical:AM:cleanser',
      'canonical:AM:moisturizer',
      'native:captured-commit:2',
      'private:ack',
    ]);
    expect(result).toMatchObject({ nativeStatus: 'committed', outboxRecordCount: 2 });
  });

  it('rejects a captured authority or owner transplant before private resolution', async () => {
    const test = harness();
    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcileCaptured(
        {
          expectedAuthorityNonce: '70000000-0000-4000-8000-000000000007',
          expectedOwnerGeneration: OWNER_GENERATION,
          outbox: outbox(),
          quiescenceNonce: QUIESCENCE_NONCE,
        },
        test.dependencies,
      ),
    ).rejects.toThrow(ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID);
    expect(test.dependencies.resolveActions).not.toHaveBeenCalled();
  });

  it('passes only resolved tokens so any unknown capability atomically redacts native state', async () => {
    const test = harness({
      nativeStatus: 'redacted',
      resolution: [
        { token: TOKEN_A, stepKey: 'AM:cleanser', status: 'resolved' },
        { token: TOKEN_B, stepKey: null, status: 'unknown' },
      ],
    });

    const result = await new RoutineWidgetReconciliationCoordinator().reconcile(
      OWNER_GENERATION,
      test.dependencies,
    );

    expect(test.dependencies.commitReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedTokens: [TOKEN_A], expectedRevision: 2 }),
    );
    expect(test.dependencies.acknowledgeActions).toHaveBeenCalledWith({
      events: [{ token: TOKEN_A, createdAtMs: NOW - 1_000 }],
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: SNAPSHOT_NONCE,
    });
    expect(result).toMatchObject({
      completedStepCount: 1,
      ignoredTokenCount: 1,
      nativeStatus: 'redacted',
    });
  });

  it('validates the entire resolver response before the first canonical mutation', async () => {
    const test = harness({
      resolution: [
        { token: TOKEN_A, stepKey: 'AM:cleanser', status: 'resolved' },
        { token: TOKEN_A, stepKey: 'AM:duplicate', status: 'resolved' },
      ],
    });

    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(OWNER_GENERATION, test.dependencies),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID);
    expect(test.dependencies.completeAction).not.toHaveBeenCalled();
    expect(test.dependencies.commitReconciliation).not.toHaveBeenCalled();
    expect(test.dependencies.acknowledgeActions).not.toHaveBeenCalled();
  });

  it('rejects authority nonce and owner transplants before private resolution', async () => {
    const wrongOwner = '60000000-0000-4000-8000-000000000006';
    const wrongAuthority = harness({ authority: authority({ ownerGeneration: wrongOwner }) });
    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(
        OWNER_GENERATION,
        wrongAuthority.dependencies,
      ),
    ).rejects.toThrow(ROUTINE_WIDGET_NATIVE_AUTHORITY_INVALID);

    const wrongNonce = harness({
      outbox: outbox({ authorityNonce: '70000000-0000-4000-8000-000000000007' }),
    });
    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(
        OWNER_GENERATION,
        wrongNonce.dependencies,
      ),
    ).rejects.toThrow(ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID);
    expect(wrongNonce.dependencies.resolveActions).not.toHaveBeenCalled();
  });

  it('rejects a mixed snapshot batch before any canonical or private work', async () => {
    const mixed = outbox();
    const test = harness({
      outbox: {
        ...mixed,
        records: [
          mixed.records[0]!,
          { ...mixed.records[1]!, snapshotNonce: '80000000-0000-4000-8000-000000000008' },
        ],
      },
    });

    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(OWNER_GENERATION, test.dependencies),
    ).rejects.toThrow(ROUTINE_WIDGET_NATIVE_OUTBOX_INVALID);
    expect(test.dependencies.resolveActions).not.toHaveBeenCalled();
    expect(test.dependencies.completeAction).not.toHaveBeenCalled();
  });

  it('reconciles an action accepted before staleAt when the app foregrounds after staleAt', async () => {
    const acceptedBeforeExpiry = outbox({
      records: outbox().records.map((record) => ({ ...record, staleAtMs: NOW })),
    });
    const test = harness({ outbox: acceptedBeforeExpiry });

    const result = await new RoutineWidgetReconciliationCoordinator().reconcile(
      OWNER_GENERATION,
      test.dependencies,
    );

    expect(test.dependencies.resolveActions).toHaveBeenCalledWith({
      events: [
        { token: TOKEN_A, createdAtMs: NOW - 1_000 },
        { token: TOKEN_B, createdAtMs: NOW - 500 },
      ],
      localDate: '2026-07-16',
      ownerGeneration: OWNER_GENERATION,
      phase: 'AM',
      snapshotNonce: SNAPSHOT_NONCE,
    });
    expect(test.dependencies.completeAction).toHaveBeenCalledTimes(2);
    expect(test.dependencies.commitReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedTokens: [TOKEN_A, TOKEN_B] }),
    );
    expect(test.dependencies.acknowledgeActions).toHaveBeenCalledOnce();
    expect(result.nativeStatus).toBe('committed');
  });

  it('redacts a future-dated batch without resolving private mappings', async () => {
    const future = outbox({
      records: outbox().records.map((record, index) => ({
        ...record,
        createdAtMs: NOW + index + 1,
      })),
    });
    const test = harness({ outbox: future, nativeStatus: 'redacted' });

    const result = await new RoutineWidgetReconciliationCoordinator().reconcile(
      OWNER_GENERATION,
      test.dependencies,
    );

    expect(test.dependencies.resolveActions).not.toHaveBeenCalled();
    expect(test.dependencies.completeAction).not.toHaveBeenCalled();
    expect(test.dependencies.commitReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedTokens: [] }),
    );
    expect(test.dependencies.acknowledgeActions).not.toHaveBeenCalled();
    expect(result.nativeStatus).toBe('redacted');
  });

  it('does not consume native or private state after a canonical failure', async () => {
    const test = harness();
    vi.mocked(test.dependencies.completeAction).mockResolvedValueOnce({
      done: false,
      inserted: false,
    });

    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(OWNER_GENERATION, test.dependencies),
    ).rejects.toThrow(ROUTINE_WIDGET_CANONICAL_COMPLETION_REJECTED);
    expect(test.dependencies.commitReconciliation).not.toHaveBeenCalled();
    expect(test.dependencies.acknowledgeActions).not.toHaveBeenCalled();
  });

  it('requires a coherent native disposition and exact private acknowledgement', async () => {
    const impossibleCommit = harness({
      resolution: [
        { token: TOKEN_A, stepKey: 'AM:cleanser', status: 'resolved' },
        { token: TOKEN_B, stepKey: null, status: 'unknown' },
      ],
      nativeStatus: 'committed',
    });
    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(
        OWNER_GENERATION,
        impossibleCommit.dependencies,
      ),
    ).rejects.toThrow(ROUTINE_WIDGET_NATIVE_RECONCILIATION_INVALID);
    expect(impossibleCommit.dependencies.acknowledgeActions).not.toHaveBeenCalled();

    const shortAck = harness();
    vi.mocked(shortAck.dependencies.acknowledgeActions).mockResolvedValueOnce(1);
    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(
        OWNER_GENERATION,
        shortAck.dependencies,
      ),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE);
  });

  it('invalidates an awaiting generation before native CAS or private acknowledgement', async () => {
    let release!: (value: readonly ResolvedRoutineWidgetAction[]) => void;
    const waiting = new Promise<readonly ResolvedRoutineWidgetAction[]>((resolve) => {
      release = resolve;
    });
    const test = harness();
    vi.mocked(test.dependencies.resolveActions).mockReturnValueOnce(waiting);
    const coordinator = new RoutineWidgetReconciliationCoordinator();
    const operation = coordinator.reconcile(OWNER_GENERATION, test.dependencies);
    await vi.waitFor(() => expect(test.dependencies.resolveActions).toHaveBeenCalledOnce());

    coordinator.invalidate();
    release([
      { token: TOKEN_A, stepKey: 'AM:cleanser', status: 'resolved' },
      { token: TOKEN_B, stepKey: 'AM:moisturizer', status: 'resolved' },
    ]);

    await expect(operation).rejects.toThrow(ROUTINE_WIDGET_RECONCILIATION_INVALIDATED);
    expect(test.dependencies.completeAction).not.toHaveBeenCalled();
    expect(test.dependencies.commitReconciliation).not.toHaveBeenCalled();
  });

  it('serializes callers and recovers its queue after rejection', async () => {
    const coordinator = new RoutineWidgetReconciliationCoordinator();
    const first = harness();
    const second = harness({ outbox: outbox({ records: [] }) });
    vi.mocked(first.dependencies.resolveActions).mockRejectedValueOnce(new Error('resolver down'));

    const one = coordinator.reconcile(OWNER_GENERATION, first.dependencies);
    const two = coordinator.reconcile(OWNER_GENERATION, second.dependencies);
    await expect(one).rejects.toThrow('resolver down');
    await expect(two).resolves.toMatchObject({ nativeStatus: 'empty', outboxRecordCount: 0 });
    expect(second.events[0]).toBe('native:authority');
  });
});
