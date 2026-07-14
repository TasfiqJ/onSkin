import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  createGroundedTurnOperationId,
  runGroundedTurnForOwner,
} from './groundedTurnReservation';
import { reserveTrialGroundedTurn } from './store';

const mocks = vi.hoisted(() => ({
  randomUUID: vi.fn(),
}));

vi.mock('expo-crypto', () => ({ randomUUID: mocks.randomUUID }));
vi.mock('./store', () => ({ reserveTrialGroundedTurn: vi.fn() }));

const OPERATION_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as ReturnType<
  typeof createGroundedTurnOperationId
>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('future grounded-turn provider boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.randomUUID
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  it('owns fresh opaque operation identities for distinct provider turns', () => {
    expect(createGroundedTurnOperationId()).toBe('aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa');
    expect(createGroundedTurnOperationId()).toBe('bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb');
  });

  it('rejects a malformed entropy-provider result', () => {
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockReturnValueOnce('not-a-uuid');

    expect(() => createGroundedTurnOperationId()).toThrow('ASK_TURN_OPERATION_ID_UNAVAILABLE');
  });

  it('reserves trial quota and keeps provider publication inside the owner lease', async () => {
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(3);
    const scope = createOwnerQueryScope();
    const operation = vi.fn(async (context) => {
      expect(context.recordedTrialCount).toBe(3);
      expect(context.signal).toBeInstanceOf(AbortSignal);
      context.assertCurrent();
      return 'published-answer';
    });

    await expect(
      runGroundedTurnForOwner(
        scope,
        { kind: 'trial', period: '2026-07', operationId: OPERATION_ID },
        operation,
      ),
    ).resolves.toBe('published-answer');
    expect(reserveTrialGroundedTurn).toHaveBeenCalledWith('2026-07', OPERATION_ID);
    expect(operation).toHaveBeenCalledOnce();
  });

  it('uses an explicit uncapped path for fully paid access', async () => {
    const scope = createOwnerQueryScope();

    await expect(
      runGroundedTurnForOwner(scope, { kind: 'uncapped' }, ({ recordedTrialCount }) => {
        expect(recordedTrialCount).toBeNull();
        return 'paid-answer';
      }),
    ).resolves.toBe('paid-answer');
    expect(reserveTrialGroundedTurn).not.toHaveBeenCalled();
  });

  it('rejects delayed account-A provider publication after the owner changes', async () => {
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1);
    const scopeA = createOwnerQueryScope();
    const provider = deferred<string>();
    const pending = runGroundedTurnForOwner(
      scopeA,
      { kind: 'trial', period: '2026-07', operationId: OPERATION_ID },
      () => provider.promise,
    );

    beginAccountGenerationBoundary();
    try {
      provider.resolve('stale-answer');
      await expect(pending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    } finally {
      endAccountGenerationBoundary();
    }
  });
});
