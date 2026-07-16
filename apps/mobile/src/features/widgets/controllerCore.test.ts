import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE,
  ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID,
  ROUTINE_WIDGET_PENDING_ACTIONS_INVALID,
  ROUTINE_WIDGET_RECONCILIATION_INVALIDATED,
  ROUTINE_WIDGET_TIMELINE_REPLACED,
  ROUTINE_WIDGET_TIMELINE_REPLACEMENT_NOT_COMMITTED,
  ROUTINE_WIDGET_TIMELINE_INVALID,
  RoutineWidgetReconciliationCoordinator,
  type RoutineWidgetControllerDependencies,
} from './controllerCore';
import {
  ROUTINE_WIDGET_TODAY_DEEP_LINK,
  createRoutineWidgetProps,
  normalizeRoutineWidgetProps,
  type RoutineWidgetProps,
} from './contract';

const NOW = Date.parse('2026-07-16T12:00:00.000Z');
const DAY = '2026-07-16';
const TOKEN_A = '00000000-0000-4000-8000-000000000001';
const TOKEN_B = '00000000-0000-4000-8000-000000000002';
const TOKEN_C = '00000000-0000-4000-8000-000000000003';
const TOKEN_D = '00000000-0000-4000-8000-000000000004';

function pendingProps(input: {
  actionTokens?: readonly string[];
  completedCount?: number;
  localDate?: string;
  pendingActionTokens: readonly string[];
  phase?: 'AM' | 'PM';
  status?: 'ready' | 'complete';
  totalCount?: number;
  updatedAtMs?: number;
}): RoutineWidgetProps {
  const phase = input.phase ?? 'PM';
  const totalCount = input.totalCount ?? 3;
  const completedCount = input.completedCount ?? input.pendingActionTokens.length;
  const actionTokens =
    input.actionTokens ??
    (completedCount === totalCount ? [] : [TOKEN_D].slice(0, totalCount - completedCount));
  const base = createRoutineWidgetProps({
    phase,
    localDate: input.localDate ?? DAY,
    completedCount,
    totalCount,
    actionTokens,
    deepLink: ROUTINE_WIDGET_TODAY_DEEP_LINK,
    updatedAtMs: input.updatedAtMs ?? NOW - 1_000,
    staleAtMs: NOW + 60_000,
  });
  const normalized = normalizeRoutineWidgetProps({
    ...base,
    status: input.status ?? base.status,
    pendingActionTokens: [...input.pendingActionTokens],
    interactionRevision: input.pendingActionTokens.length,
  });
  if (!normalized) throw new Error('invalid test widget props');
  return normalized;
}

function entry(props: RoutineWidgetProps, dateMs = NOW - 2_000) {
  return { date: new Date(dateMs), props };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

function harness(timeline: unknown): {
  dependencies: RoutineWidgetControllerDependencies;
  events: string[];
  mocks: {
    acknowledge: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
  };
} {
  const events: string[] = [];
  const read = vi.fn(async () => {
    events.push('read');
    return timeline;
  });
  const resolve = vi.fn(async (request: { tokens: readonly string[] }) => {
    events.push(`resolve:${request.tokens.join(',')}`);
    return request.tokens.map((token, index) => ({
      token,
      stepKey: `PM:step-${index + 1}`,
      status: 'resolved' as const,
    }));
  });
  const complete = vi.fn(async (stepKey: string) => {
    events.push(`complete:${stepKey}`);
    return { done: true, inserted: true, firstEver: false };
  });
  const acknowledge = vi.fn(async (tokens: readonly string[]) => {
    events.push(`ack:${tokens.join(',')}`);
    return tokens.length;
  });
  const replace = vi.fn((): typeof ROUTINE_WIDGET_TIMELINE_REPLACED => {
    events.push('replace');
    return ROUTINE_WIDGET_TIMELINE_REPLACED;
  });
  return {
    dependencies: {
      readTimeline: read,
      resolveActions: resolve,
      completeAction: complete,
      acknowledgeActions: acknowledge,
      replaceTimeline: replace,
      now: () => NOW,
    },
    events,
    mocks: { acknowledge, complete, read, replace, resolve },
  };
}

describe('routine widget reconciliation core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates groups and preserves resolve -> completion -> exact ack -> replace ordering', async () => {
    const first = pendingProps({
      pendingActionTokens: [TOKEN_A, TOKEN_B],
      completedCount: 2,
      totalCount: 3,
    });
    const repeated = pendingProps({
      pendingActionTokens: [TOKEN_B, TOKEN_C],
      completedCount: 3,
      totalCount: 3,
      status: 'complete',
    });
    const test = harness([entry(first), entry(repeated, NOW - 1_000)]);
    const result = await new RoutineWidgetReconciliationCoordinator().reconcile(test.dependencies);

    expect(test.mocks.resolve).toHaveBeenCalledOnce();
    expect(test.mocks.resolve).toHaveBeenCalledWith({
      tokens: [TOKEN_A, TOKEN_B, TOKEN_C],
      localDate: DAY,
      phase: 'PM',
    });
    expect(test.events).toEqual([
      'read',
      `resolve:${TOKEN_A},${TOKEN_B},${TOKEN_C}`,
      'complete:PM:step-1',
      'complete:PM:step-2',
      'complete:PM:step-3',
      `ack:${TOKEN_A},${TOKEN_B},${TOKEN_C}`,
      'replace',
    ]);
    expect(result).toEqual({
      timelineEntryCount: 2,
      pendingTokenCount: 3,
      ignoredTokenCount: 0,
      resolvedTokenCount: 3,
      completedStepCount: 3,
      acknowledgedTokenCount: 3,
    });
  });

  it('deduplicates canonical writes for two resolved capabilities targeting the same step', async () => {
    const test = harness([
      entry(
        pendingProps({
          pendingActionTokens: [TOKEN_A, TOKEN_B],
          completedCount: 2,
          totalCount: 3,
        }),
      ),
    ]);
    test.mocks.resolve.mockResolvedValueOnce([
      { token: TOKEN_A, stepKey: 'PM:same-step', status: 'resolved' },
      { token: TOKEN_B, stepKey: 'PM:same-step', status: 'resolved' },
    ]);

    const result = await new RoutineWidgetReconciliationCoordinator().reconcile(test.dependencies);

    expect(test.mocks.complete).toHaveBeenCalledOnce();
    expect(test.mocks.complete).toHaveBeenCalledWith('PM:same-step', DAY);
    expect(test.mocks.acknowledge).toHaveBeenCalledWith([TOKEN_A, TOKEN_B]);
    expect(result.completedStepCount).toBe(1);
    expect(result.acknowledgedTokenCount).toBe(2);
  });

  it.each(['unknown', 'stale', 'expired'] as const)(
    'never writes a %s token but permits the caller to prune it',
    async (status) => {
      const test = harness([
        entry(
          pendingProps({
            pendingActionTokens: [TOKEN_A],
            completedCount: 1,
            totalCount: 2,
          }),
        ),
      ]);
      test.mocks.resolve.mockResolvedValueOnce([{ token: TOKEN_A, stepKey: null, status }]);

      const result = await new RoutineWidgetReconciliationCoordinator().reconcile(
        test.dependencies,
      );

      expect(test.mocks.complete).not.toHaveBeenCalled();
      expect(test.mocks.acknowledge).not.toHaveBeenCalled();
      expect(test.mocks.replace).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        pendingTokenCount: 1,
        resolvedTokenCount: 0,
        acknowledgedTokenCount: 0,
      });
    },
  );

  it('does not resolve or write rolled-back, expired, or explicit stale entries', async () => {
    const rollback = pendingProps({
      pendingActionTokens: [TOKEN_A],
      completedCount: 1,
      totalCount: 2,
      updatedAtMs: NOW + 1,
    });
    const expired = normalizeRoutineWidgetProps({
      ...pendingProps({
        pendingActionTokens: [TOKEN_B],
        completedCount: 1,
        totalCount: 2,
      }),
      updatedAtMs: NOW - 60_000,
      staleAtMs: NOW,
    });
    const stale = normalizeRoutineWidgetProps({
      ...pendingProps({
        pendingActionTokens: [TOKEN_C],
        completedCount: 1,
        totalCount: 2,
      }),
      status: 'stale',
      phase: 'none',
      completedCount: 0,
      totalCount: 0,
      actionTokens: [],
    });
    expect(expired).not.toBeNull();
    expect(stale).not.toBeNull();
    const test = harness([entry(rollback), entry(expired!, NOW - 1_000), entry(stale!, NOW)]);

    const result = await new RoutineWidgetReconciliationCoordinator().reconcile(test.dependencies);

    expect(test.mocks.resolve).not.toHaveBeenCalled();
    expect(test.mocks.complete).not.toHaveBeenCalled();
    expect(test.mocks.acknowledge).not.toHaveBeenCalled();
    expect(test.mocks.replace).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ pendingTokenCount: 3, ignoredTokenCount: 3 });
  });

  it('preserves the timeline when a canonical completion fails or is rejected', async () => {
    for (const failure of [new Error('disk unavailable'), { done: false, inserted: false }]) {
      const test = harness([
        entry(
          pendingProps({
            pendingActionTokens: [TOKEN_A],
            completedCount: 1,
            totalCount: 2,
          }),
        ),
      ]);
      if (failure instanceof Error) test.mocks.complete.mockRejectedValueOnce(failure);
      else test.mocks.complete.mockResolvedValueOnce(failure);

      await expect(
        new RoutineWidgetReconciliationCoordinator().reconcile(test.dependencies),
      ).rejects.toThrow();
      expect(test.mocks.acknowledge).not.toHaveBeenCalled();
      expect(test.mocks.replace).not.toHaveBeenCalled();
    }
  });

  it('preserves the timeline unless acknowledgement removes the exact resolved token count', async () => {
    const test = harness([
      entry(
        pendingProps({
          pendingActionTokens: [TOKEN_A, TOKEN_B],
          completedCount: 2,
          totalCount: 3,
        }),
      ),
    ]);
    test.mocks.acknowledge.mockResolvedValueOnce(1);

    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(test.dependencies),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_ACKNOWLEDGEMENT_INCOMPLETE);
    expect(test.mocks.complete).toHaveBeenCalledTimes(2);
    expect(test.mocks.replace).not.toHaveBeenCalled();
  });

  it('rejects an async replacement callback instead of reporting a committed timeline', async () => {
    const test = harness([
      entry(
        pendingProps({
          pendingActionTokens: [TOKEN_A],
          completedCount: 1,
          totalCount: 2,
        }),
      ),
    ]);
    test.dependencies = {
      ...test.dependencies,
      replaceTimeline: (async () =>
        ROUTINE_WIDGET_TIMELINE_REPLACED) as unknown as RoutineWidgetControllerDependencies['replaceTimeline'],
    };

    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(test.dependencies),
    ).rejects.toThrow(ROUTINE_WIDGET_TIMELINE_REPLACEMENT_NOT_COMMITTED);
    expect(test.mocks.complete).toHaveBeenCalledOnce();
    expect(test.mocks.acknowledge).toHaveBeenCalledOnce();
  });

  it('rejects malformed, unordered, oversized, and context-conflicting timelines before writes', async () => {
    const valid = pendingProps({
      pendingActionTokens: [TOKEN_A],
      completedCount: 1,
      totalCount: 2,
    });
    const otherPhase = pendingProps({
      pendingActionTokens: [TOKEN_A],
      completedCount: 1,
      totalCount: 2,
      phase: 'AM',
    });
    const cases: { code: string; timeline: unknown }[] = [
      { code: ROUTINE_WIDGET_TIMELINE_INVALID, timeline: 'not-an-array' },
      {
        code: ROUTINE_WIDGET_TIMELINE_INVALID,
        timeline: [{ date: new Date(NOW), props: valid, extra: true }],
      },
      {
        code: ROUTINE_WIDGET_TIMELINE_INVALID,
        timeline: [entry(valid, NOW), entry(valid, NOW)],
      },
      {
        code: ROUTINE_WIDGET_TIMELINE_INVALID,
        timeline: Array.from({ length: 33 }, (_, index) => entry(valid, NOW + index)),
      },
      {
        code: ROUTINE_WIDGET_PENDING_ACTIONS_INVALID,
        timeline: [entry(valid, NOW - 1), entry(otherPhase, NOW)],
      },
    ];

    for (const { code, timeline } of cases) {
      const test = harness(timeline);
      await expect(
        new RoutineWidgetReconciliationCoordinator().reconcile(test.dependencies),
      ).rejects.toThrow(code);
      expect(test.mocks.resolve).not.toHaveBeenCalled();
      expect(test.mocks.complete).not.toHaveBeenCalled();
      expect(test.mocks.acknowledge).not.toHaveBeenCalled();
      expect(test.mocks.replace).not.toHaveBeenCalled();
    }
  });

  it('rejects more than 32 unique pending capabilities across the whole timeline', async () => {
    const tokens = Array.from(
      { length: 34 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    );
    const first = pendingProps({
      pendingActionTokens: tokens.slice(0, 17),
      completedCount: 17,
      totalCount: 17,
      status: 'complete',
    });
    const second = pendingProps({
      pendingActionTokens: tokens.slice(17),
      completedCount: 17,
      totalCount: 17,
      status: 'complete',
      localDate: '2026-07-17',
    });
    const test = harness([entry(first), entry(second, NOW - 1_000)]);

    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(test.dependencies),
    ).rejects.toThrow(ROUTINE_WIDGET_PENDING_ACTIONS_INVALID);
    expect(test.mocks.resolve).not.toHaveBeenCalled();
    expect(test.mocks.complete).not.toHaveBeenCalled();
    expect(test.mocks.acknowledge).not.toHaveBeenCalled();
    expect(test.mocks.replace).not.toHaveBeenCalled();
  });

  it('rejects malformed resolver output before the first canonical write', async () => {
    const test = harness([
      entry(
        pendingProps({
          pendingActionTokens: [TOKEN_A],
          completedCount: 1,
          totalCount: 2,
        }),
      ),
    ]);
    test.mocks.resolve.mockResolvedValueOnce([
      { token: TOKEN_A, stepKey: 'AM:wrong-phase', status: 'resolved' },
    ]);

    await expect(
      new RoutineWidgetReconciliationCoordinator().reconcile(test.dependencies),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_RESOLUTION_INVALID);
    expect(test.mocks.complete).not.toHaveBeenCalled();
    expect(test.mocks.acknowledge).not.toHaveBeenCalled();
    expect(test.mocks.replace).not.toHaveBeenCalled();
  });

  it('serializes callers and re-reads the timeline only after the prior operation settles', async () => {
    const firstResolution = deferred<{ token: string; stepKey: string; status: 'resolved' }[]>();
    const first = harness([
      entry(
        pendingProps({
          pendingActionTokens: [TOKEN_A],
          completedCount: 1,
          totalCount: 2,
        }),
      ),
    ]);
    first.mocks.resolve.mockReturnValueOnce(firstResolution.promise);
    const second = harness([]);
    const coordinator = new RoutineWidgetReconciliationCoordinator();

    const firstRun = coordinator.reconcile(first.dependencies);
    await vi.waitFor(() => expect(first.mocks.resolve).toHaveBeenCalledOnce());
    const secondRun = coordinator.reconcile(second.dependencies);
    expect(second.mocks.read).not.toHaveBeenCalled();

    firstResolution.resolve([{ token: TOKEN_A, stepKey: 'PM:step-1', status: 'resolved' }]);
    await firstRun;
    await secondRun;

    expect(first.mocks.replace).toHaveBeenCalledOnce();
    expect(second.mocks.read).toHaveBeenCalledOnce();
    expect(second.mocks.replace).toHaveBeenCalledOnce();
  });

  it('invalidation after a canonical completion prevents stale acknowledgement and replacement', async () => {
    const completion = deferred<{ done: boolean; inserted: boolean }>();
    const test = harness([
      entry(
        pendingProps({
          pendingActionTokens: [TOKEN_A],
          completedCount: 1,
          totalCount: 2,
        }),
      ),
    ]);
    test.mocks.complete.mockReturnValueOnce(completion.promise);
    const coordinator = new RoutineWidgetReconciliationCoordinator();
    const run = coordinator.reconcile(test.dependencies);
    await vi.waitFor(() => expect(test.mocks.complete).toHaveBeenCalledOnce());

    coordinator.invalidate();
    completion.resolve({ done: true, inserted: true });

    await expect(run).rejects.toThrow(ROUTINE_WIDGET_RECONCILIATION_INVALIDATED);
    expect(test.mocks.acknowledge).not.toHaveBeenCalled();
    expect(test.mocks.replace).not.toHaveBeenCalled();
  });

  it('invalidates queued work before it can read or replace an obsolete timeline', async () => {
    const resolution = deferred<{ token: string; stepKey: string; status: 'resolved' }[]>();
    const first = harness([
      entry(
        pendingProps({
          pendingActionTokens: [TOKEN_A],
          completedCount: 1,
          totalCount: 2,
        }),
      ),
    ]);
    first.mocks.resolve.mockReturnValueOnce(resolution.promise);
    const queued = harness([]);
    const coordinator = new RoutineWidgetReconciliationCoordinator();
    const firstRun = coordinator.reconcile(first.dependencies);
    await vi.waitFor(() => expect(first.mocks.resolve).toHaveBeenCalledOnce());
    const queuedRun = coordinator.reconcile(queued.dependencies);

    coordinator.invalidate();
    resolution.resolve([{ token: TOKEN_A, stepKey: 'PM:step-1', status: 'resolved' }]);

    await expect(firstRun).rejects.toThrow(ROUTINE_WIDGET_RECONCILIATION_INVALIDATED);
    await expect(queuedRun).rejects.toThrow(ROUTINE_WIDGET_RECONCILIATION_INVALIDATED);
    expect(queued.mocks.read).not.toHaveBeenCalled();
    expect(queued.mocks.replace).not.toHaveBeenCalled();
  });
});
