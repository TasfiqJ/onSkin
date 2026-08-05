import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import type { CompletionSyncOperation } from '@/features/today/completionSync';

import { COMPLETION_SYNC_RESPONSE_INVALID, flushCompletions } from './completionQueue';

const h = vi.hoisted(() => ({
  pending: [] as CompletionSyncOperation[],
  acknowledged: [] as string[],
  deferred: [] as string[],
  rejected: [] as { eventId: string; code: string }[],
  unresolvedTerminalShelfProducts: new Set<string>(),
  onTerminalShelfLookup: null as (() => void) | null,
  currentUserId: 'owner-a' as string | null,
  rpc: vi.fn(),
  recoverUnsynced: vi.fn(),
}));

vi.mock('@/features/today/completionsStore', () => ({
  recoverCompletionSyncUnsynced: h.recoverUnsynced,
  getPendingCompletionSyncOperations: vi.fn(async () => [...h.pending]),
  acknowledgeCompletionSyncOperation: vi.fn(async (eventId: string) => {
    const index = h.pending.findIndex((operation) => operation.eventId === eventId);
    if (index < 0) return false;
    h.pending.splice(index, 1);
    h.acknowledged.push(eventId);
    return true;
  }),
  rejectCompletionSyncOperation: vi.fn(async (eventId: string, code: string) => {
    if (h.pending[0]?.eventId !== eventId) return false;
    const operation = h.pending.shift()!;
    const dependent = h.pending[0];
    if (
      operation.kind === 'step' &&
      dependent?.kind === 'routine_day' &&
      dependent.routineId === operation.routineId &&
      dependent.completedDate === operation.completedDate &&
      dependent.completedAt === operation.completedAt &&
      dependent.timezone === operation.timezone
    ) {
      h.pending.shift();
    }
    h.rejected.push({ eventId, code });
    return true;
  }),
  deferCompletionSyncDependencyOperation: vi.fn(async (eventId: string, userProductId: string) => {
    if (
      h.pending[0]?.eventId !== eventId ||
      h.pending[0]?.kind !== 'step' ||
      h.pending[0]?.userProductId !== userProductId
    ) {
      return { deferred: false, moved: 0 };
    }
    const operation = h.pending.shift()!;
    const deferred = [operation];
    const dependent = h.pending[0];
    if (
      dependent?.kind === 'routine_day' &&
      dependent.routineId === operation.routineId &&
      dependent.completedDate === operation.completedDate &&
      dependent.completedAt === operation.completedAt &&
      dependent.timezone === operation.timezone
    ) {
      deferred.push(h.pending.shift()!);
    }
    h.pending.push(...deferred);
    h.deferred.push(eventId);
    return { deferred: true, moved: deferred.length };
  }),
}));

vi.mock('@/features/shelf/store', () => ({
  hasUnresolvedTerminalShelfMirrorOperationForProduct: vi.fn(async (productId: string) => {
    const unresolved = h.unresolvedTerminalShelfProducts.has(productId);
    h.onTerminalShelfLookup?.();
    return unresolved;
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: vi.fn(async () => ({
    data: { user: h.currentUserId === null ? null : { id: h.currentUserId } },
  })),
  supabase: { rpc: h.rpc },
}));

const EVENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EVENT_C = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

function operation(
  eventId: string,
  overrides: Partial<CompletionSyncOperation> = {},
): CompletionSyncOperation {
  return {
    eventId,
    kind: 'step',
    routineId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    routineType: 'PM',
    stepId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    userProductId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    stepOrder: 2,
    completedAt: '2026-07-26T18:00:00.000Z',
    completedDate: '2026-07-26',
    timezone: 'America/Toronto',
    ...overrides,
  };
}

function response(
  eventId: string,
  status: 'accepted' | 'idempotent' | 'retryable' | 'terminal' = 'accepted',
  code: string | null = status === 'retryable'
    ? 'COMPLETION_PRODUCT_RETRY_LATER'
    : status === 'terminal'
      ? 'COMPLETION_EVENT_CONFLICT'
      : null,
) {
  return { data: { version: 1, event_id: eventId, status, code }, error: null };
}

describe('v3 completion RPC replay worker', () => {
  beforeEach(() => {
    h.pending = [];
    h.acknowledged = [];
    h.deferred = [];
    h.rejected = [];
    h.unresolvedTerminalShelfProducts = new Set();
    h.onTerminalShelfLookup = null;
    h.currentUserId = 'owner-a';
    h.rpc.mockReset();
    h.recoverUnsynced.mockReset().mockResolvedValue(0);
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(9, {
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
  });

  it('does not touch Auth or the network when there is no replay work', async () => {
    await expect(flushCompletions()).resolves.toEqual({
      flushed: 0,
      terminal: 0,
      remaining: 0,
    });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('retains impossible mixed-null and AM-marker payloads without touching the network', async () => {
    const invalidOperations = [
      operation(EVENT_A, { stepId: null }),
      operation(EVENT_B, {
        kind: 'routine_day',
        routineType: 'AM',
        stepId: null,
        userProductId: null,
        stepOrder: null,
      }),
    ];

    for (const invalidOperation of invalidOperations) {
      h.pending = [invalidOperation];
      await expect(flushCompletions()).resolves.toEqual({
        flushed: 0,
        terminal: 0,
        remaining: 1,
      });
    }

    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('never purges the exportable legacy queue from an ordinary replay wake', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./completionQueue.ts', import.meta.url)),
      'utf8',
    );
    expect(source).toContain('legacy_pending_completion_sync');
    expect(source).not.toContain("removePrivateItem('onskin.completions.pending')");
    expect(source).not.toContain('LEGACY_COMPLETION_QUEUE_KEY');
  });

  it('keeps FIFO work when there is no current server session', async () => {
    h.pending = [operation(EVENT_A)];
    h.currentUserId = null;

    await expect(flushCompletions()).resolves.toEqual({
      flushed: 0,
      terminal: 0,
      remaining: 1,
    });
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.pending).toHaveLength(1);
  });

  it('sends the exact owner-free RPC payload and acknowledges an accepted event', async () => {
    h.pending = [operation(EVENT_A)];
    h.rpc.mockResolvedValueOnce(response(EVENT_A));

    await expect(flushCompletions()).resolves.toEqual({
      flushed: 1,
      terminal: 0,
      remaining: 0,
    });

    expect(h.rpc).toHaveBeenCalledWith('record_routine_completion', {
      p_event_id: EVENT_A,
      p_routine_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      p_routine_type: 'PM',
      p_step_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      p_user_product_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      p_step_order: 2,
      p_completed_at: '2026-07-26T18:00:00.000Z',
      p_completed_date: '2026-07-26',
      p_timezone: 'America/Toronto',
    });
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain('owner-a');
    expect(h.acknowledged).toEqual([EVENT_A]);
  });

  it('acknowledges exact idempotent replay and quarantines only explicit terminal results', async () => {
    h.pending = [
      operation(EVENT_A),
      operation(EVENT_B, {
        kind: 'routine_day',
        stepId: null,
        userProductId: null,
        stepOrder: null,
      }),
    ];
    h.rpc
      .mockResolvedValueOnce(response(EVENT_A, 'idempotent'))
      .mockResolvedValueOnce(response(EVENT_B, 'terminal'));

    await expect(flushCompletions()).resolves.toEqual({
      flushed: 1,
      terminal: 1,
      remaining: 0,
    });
    expect(h.acknowledged).toEqual([EVENT_A]);
    expect(h.rejected).toEqual([{ eventId: EVENT_B, code: 'COMPLETION_EVENT_CONFLICT' }]);
  });

  it('stops the stale snapshot after a final-step terminal cascade and never dispatches its marker', async () => {
    h.pending = [
      operation(EVENT_A),
      operation(EVENT_B, {
        kind: 'routine_day',
        stepId: null,
        userProductId: null,
        stepOrder: null,
      }),
      operation(EVENT_C, {
        routineType: 'AM',
        completedAt: '2026-07-27T12:00:00.000Z',
        completedDate: '2026-07-27',
      }),
    ];
    h.rpc.mockResolvedValueOnce(response(EVENT_A, 'terminal'));

    await expect(flushCompletions()).resolves.toEqual({
      flushed: 0,
      terminal: 1,
      remaining: 1,
    });
    expect(h.rejected).toEqual([{ eventId: EVENT_A, code: 'COMPLETION_EVENT_CONFLICT' }]);
    expect(
      h.rpc.mock.calls.filter(([functionName]) => functionName === 'record_routine_completion'),
    ).toEqual([['record_routine_completion', expect.objectContaining({ p_event_id: EVENT_A })]]);
    expect(h.pending.map(({ eventId }) => eventId)).toEqual([EVENT_C]);
  });

  it('stops a stale snapshot when an accepted response no longer matches the durable FIFO head', async () => {
    h.pending = [operation(EVENT_A), operation(EVENT_B)];
    h.rpc.mockImplementationOnce(async () => {
      h.pending.shift();
      return response(EVENT_A);
    });

    await expect(flushCompletions()).resolves.toEqual({
      flushed: 0,
      terminal: 0,
      remaining: 1,
    });
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.acknowledged).toEqual([]);
    expect(h.pending.map(({ eventId }) => eventId)).toEqual([EVENT_B]);
  });

  it('stops at the first retryable, PostgREST error, or network ambiguity', async () => {
    for (const firstResult of [
      Promise.resolve(response(EVENT_A, 'retryable')),
      Promise.resolve({ data: null, error: { code: '42501', message: 'not admitted' } }),
      Promise.reject(new Error('offline')),
    ]) {
      h.pending = [operation(EVENT_A), operation(EVENT_B)];
      h.acknowledged = [];
      h.rpc.mockReset().mockReturnValueOnce(firstResult);

      await expect(flushCompletions()).resolves.toEqual({
        flushed: 0,
        terminal: 0,
        remaining: 2,
      });
      expect(h.rpc).toHaveBeenCalledTimes(1);
      expect(h.acknowledged).toEqual([]);
    }
  });

  it('defers a retryable missing Shelf dependency and drains later unrelated FIFO work', async () => {
    const missingProductId = operation(EVENT_A).userProductId!;
    h.pending = [
      operation(EVENT_A),
      operation(EVENT_B, {
        kind: 'routine_day',
        stepId: null,
        userProductId: null,
        stepOrder: null,
      }),
      operation(EVENT_C, {
        routineType: 'AM',
        stepId: '11111111-1111-4111-8111-111111111111',
        userProductId: '22222222-2222-4222-8222-222222222222',
        stepOrder: 1,
        completedAt: '2026-07-27T12:00:00.000Z',
        completedDate: '2026-07-27',
      }),
    ];
    h.unresolvedTerminalShelfProducts.add(missingProductId);
    h.rpc
      .mockResolvedValueOnce(response(EVENT_A, 'retryable'))
      .mockResolvedValueOnce(response(EVENT_C));

    await expect(flushCompletions()).resolves.toEqual({
      flushed: 1,
      terminal: 0,
      remaining: 2,
    });
    expect(h.deferred).toEqual([EVENT_A]);
    expect(h.rejected).toEqual([]);
    expect(h.acknowledged).toEqual([EVENT_C]);
    expect(h.pending.map(({ eventId }) => eventId)).toEqual([EVENT_A, EVENT_B]);
    expect(h.rpc.mock.calls.map(([, args]) => args.p_event_id)).toEqual([EVENT_A, EVENT_C]);
  });

  it('retains and later replays the original event when Shelf is corrected after the terminal check', async () => {
    const missingProductId = operation(EVENT_A).userProductId!;
    h.pending = [
      operation(EVENT_A),
      operation(EVENT_C, {
        routineType: 'AM',
        stepId: '11111111-1111-4111-8111-111111111111',
        userProductId: '22222222-2222-4222-8222-222222222222',
        stepOrder: 1,
        completedAt: '2026-07-27T12:00:00.000Z',
        completedDate: '2026-07-27',
      }),
    ];
    h.unresolvedTerminalShelfProducts.add(missingProductId);
    h.onTerminalShelfLookup = () => {
      h.unresolvedTerminalShelfProducts.delete(missingProductId);
      h.onTerminalShelfLookup = null;
    };
    h.rpc
      .mockResolvedValueOnce(response(EVENT_A, 'retryable'))
      .mockResolvedValueOnce(response(EVENT_C))
      .mockResolvedValueOnce(response(EVENT_A));

    await expect(flushCompletions()).resolves.toEqual({
      flushed: 1,
      terminal: 0,
      remaining: 1,
    });
    expect(h.pending.map(({ eventId }) => eventId)).toEqual([EVENT_A]);
    await expect(flushCompletions()).resolves.toEqual({
      flushed: 1,
      terminal: 0,
      remaining: 0,
    });
    expect(h.acknowledged).toEqual([EVENT_C, EVENT_A]);
    expect(h.rejected).toEqual([]);
  });

  it('does not mutate adherence authority in a separate RPC before a terminal result', async () => {
    h.pending = [operation(EVENT_A)];
    h.rpc.mockResolvedValueOnce(response(EVENT_A, 'terminal'));

    await expect(flushCompletions()).resolves.toEqual({
      flushed: 0,
      terminal: 1,
      remaining: 0,
    });
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith(
      'record_routine_completion',
      expect.objectContaining({ p_event_id: EVENT_A, p_timezone: 'America/Toronto' }),
    );
    expect(h.rpc).not.toHaveBeenCalledWith('set_routine_adherence_timezone', expect.anything());
  });

  it('fails closed on malformed, foreign-event, or over-shaped success responses', async () => {
    for (const data of [
      null,
      { version: 1, event_id: EVENT_B, status: 'accepted', code: null },
      { version: 1, event_id: EVENT_A, status: 'accepted', code: null, extra: true },
      {
        version: 1,
        event_id: EVENT_A,
        status: 'terminal',
        code: 'permission denied',
      },
      {
        version: 1,
        event_id: EVENT_A,
        status: 'terminal',
        code: 'COMPLETION_NEW_UNKNOWN_CODE',
      },
      {
        version: 1,
        event_id: EVENT_A,
        status: 'terminal',
        code: 'COMPLETION_PRODUCT_RETRY_LATER',
      },
      {
        version: 1,
        event_id: EVENT_A,
        status: 'retryable',
        code: 'COMPLETION_EVENT_CONFLICT',
      },
    ]) {
      h.pending = [operation(EVENT_A)];
      h.rpc.mockReset().mockResolvedValueOnce({ data, error: null });

      await expect(flushCompletions()).rejects.toThrow(COMPLETION_SYNC_RESPONSE_INVALID);
      expect(h.pending).toHaveLength(1);
      expect(h.acknowledged).toEqual([]);
      expect(h.rejected).toEqual([]);
    }
  });

  it('rejects a persisted-session owner mismatch before dispatch', async () => {
    h.pending = [operation(EVENT_A)];
    h.currentUserId = 'owner-b';

    await expect(flushCompletions()).rejects.toThrow('HEALTH_DATA_WRITE_OWNER_MISMATCH');
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.pending).toHaveLength(1);
  });

  it('coalesces concurrent wakeups into one network drain', async () => {
    h.pending = [operation(EVENT_A)];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    h.rpc.mockImplementationOnce(async () => {
      await gate;
      return response(EVENT_A);
    });

    const first = flushCompletions();
    const second = flushCompletions();
    expect(second).toBe(first);
    release();

    await expect(first).resolves.toEqual({ flushed: 1, terminal: 0, remaining: 0 });
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it('runs one dirty follow-up snapshot for an event appended during the active RPC', async () => {
    h.pending = [operation(EVENT_A)];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    h.rpc
      .mockImplementationOnce(async () => {
        markStarted();
        await gate;
        return response(EVENT_A);
      })
      .mockResolvedValueOnce(response(EVENT_B));

    const first = flushCompletions();
    await started;
    h.pending.push(operation(EVENT_B));
    const wake = flushCompletions();
    expect(wake).toBe(first);
    release();

    await expect(first).resolves.toEqual({ flushed: 2, terminal: 0, remaining: 0 });
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(h.acknowledged).toEqual([EVENT_A, EVENT_B]);
  });

  it('serializes a new-owner wake behind the stale flight and still drains the new lease', async () => {
    h.pending = [operation(EVENT_A)];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    h.rpc
      .mockImplementationOnce(async () => {
        markStarted();
        await gate;
        return response(EVENT_A);
      })
      .mockResolvedValueOnce(response(EVENT_B));

    const ownerA = flushCompletions();
    await started;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(10, {
      ownerUserId: 'owner-b',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
    h.currentUserId = 'owner-b';
    h.pending = [operation(EVENT_B)];
    const ownerB = flushCompletions();
    expect(ownerB).not.toBe(ownerA);
    expect(h.rpc).toHaveBeenCalledTimes(1);

    release();
    await expect(ownerA).rejects.toThrow('HEALTH_DATA_WRITE_OWNER_MISMATCH');
    await expect(ownerB).resolves.toEqual({ flushed: 1, terminal: 0, remaining: 0 });
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(h.acknowledged).toEqual([EVENT_B]);
  });

  it('returns a rejected promise instead of throwing synchronously after admission closes', async () => {
    clearActiveHealthProcessingEpoch();

    const pending = flushCompletions();

    await expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('does not acknowledge an old response after withdrawal', async () => {
    h.pending = [operation(EVENT_A)];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    h.rpc.mockImplementationOnce(async () => {
      markStarted();
      await gate;
      return response(EVENT_A);
    });

    const pending = flushCompletions();
    await started;
    clearActiveHealthProcessingEpoch();
    release();

    await expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(h.pending).toHaveLength(1);
    expect(h.acknowledged).toEqual([]);
  });
});
