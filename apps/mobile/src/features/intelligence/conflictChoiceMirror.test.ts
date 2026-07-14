import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import type { DetectedConflict } from './engine';
import {
  mirrorConflictChoiceForOwner,
  resetConflictChoiceMirrorStateForTests,
} from './conflictChoiceMirror';
import { STARTER_RULES } from './rules';

const mocks = vi.hoisted(() => {
  const abortSignal = vi.fn<(signal: AbortSignal) => Promise<{ error: Error | null }>>(
    async () => ({ error: null }),
  );
  const upsert = vi.fn(() => ({ abortSignal }));
  return {
    abortSignal,
    devWarn: vi.fn(),
    from: vi.fn(() => ({ upsert })),
    getUser: vi.fn(),
    upsert,
  };
});

vi.mock('@/lib/observability/safeLog', () => ({ devWarn: mocks.devWarn }));
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

const PRODUCT_A_ID = '00000000-0000-4000-8000-000000000101';
const PRODUCT_B_ID = '00000000-0000-4000-8000-000000000102';
const CONFLICT: DetectedConflict = {
  rule: STARTER_RULES[0]!,
  productAId: PRODUCT_B_ID,
  productBId: PRODUCT_A_ID,
  productAName: 'Retinol',
  productBName: 'Glycolic acid',
  computedSeverity: 'moderate',
};

let boundaryActive = false;

afterEach(() => {
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('conflict-choice owner-bound mirror', () => {
  beforeEach(() => {
    mocks.abortSignal.mockReset();
    mocks.abortSignal.mockResolvedValue({ error: null });
    mocks.devWarn.mockClear();
    mocks.from.mockClear();
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-a' } },
      error: null,
    });
    mocks.upsert.mockClear();
    mocks.upsert.mockImplementation(() => ({ abortSignal: mocks.abortSignal }));
    resetConflictChoiceMirrorStateForTests();
  });

  it('writes the captured owner and canonical pair through the generation abort signal', async () => {
    await mirrorConflictChoiceForOwner(createOwnerQueryScope(), CONFLICT, 'use_together');

    expect(mocks.from).toHaveBeenCalledWith('routine_conflicts');
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'owner-a',
        rule_id: CONFLICT.rule.id,
        product_a_id: PRODUCT_A_ID,
        product_b_id: PRODUCT_B_ID,
        status: 'overridden',
        user_choice: 'use_together',
        rule_version: CONFLICT.rule.ruleVersion,
      }),
      { onConflict: 'user_id,rule_id,product_a_id,product_b_id' },
    );
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('serializes reversed representations of one canonical conflict so the newest choice wins', async () => {
    let releaseFirst!: (value: { error: null }) => void;
    mocks.abortSignal.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
    );
    const ownerScope = createOwnerQueryScope();
    const first = mirrorConflictChoiceForOwner(ownerScope, CONFLICT, 'use_together');
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalledOnce());

    const reversed = {
      ...CONFLICT,
      productAId: PRODUCT_A_ID,
      productBId: PRODUCT_B_ID,
    };
    const second = mirrorConflictChoiceForOwner(ownerScope, reversed, 'accept_suggested_timing');
    await Promise.resolve();
    expect(mocks.upsert).toHaveBeenCalledOnce();

    releaseFirst({ error: null });
    await first;
    await second;

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    const calls = mocks.upsert.mock.calls as unknown as [Record<string, unknown>][];
    expect(calls[1]?.[0]).toMatchObject({
      product_a_id: PRODUCT_A_ID,
      product_b_id: PRODUCT_B_ID,
      status: 'accepted',
      user_choice: 'accept_suggested_timing',
    });
  });

  it('snapshots queued payload fields before the caller can mutate its conflict object', async () => {
    let releaseFirst!: (value: { error: null }) => void;
    mocks.abortSignal.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
    );
    const ownerScope = createOwnerQueryScope();
    const first = mirrorConflictChoiceForOwner(ownerScope, CONFLICT, 'use_together');
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalledOnce());

    const queuedConflict: DetectedConflict = {
      ...CONFLICT,
      rule: { ...CONFLICT.rule },
      computedSeverity: 'mild',
    };
    const queuedRuleVersion = queuedConflict.rule.ruleVersion;
    const second = mirrorConflictChoiceForOwner(
      ownerScope,
      queuedConflict,
      'accept_suggested_timing',
    );
    queuedConflict.computedSeverity = 'high';
    queuedConflict.rule.ruleVersion = queuedRuleVersion + 10;

    releaseFirst({ error: null });
    await first;
    await second;

    const calls = mocks.upsert.mock.calls as unknown as [Record<string, unknown>][];
    expect(calls[1]?.[0]).toMatchObject({
      computed_severity: 'mild',
      rule_version: queuedRuleVersion,
      status: 'accepted',
      user_choice: 'accept_suggested_timing',
    });
  });

  it('continues with the newest queued mirror after an earlier best-effort write fails', async () => {
    mocks.abortSignal.mockResolvedValueOnce({ error: new Error('first mirror failed') });
    const ownerScope = createOwnerQueryScope();

    const first = mirrorConflictChoiceForOwner(ownerScope, CONFLICT, 'use_together');
    const second = mirrorConflictChoiceForOwner(ownerScope, CONFLICT, 'accept_suggested_timing');
    await first;
    await second;

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    const calls = mocks.upsert.mock.calls as unknown as [Record<string, unknown>][];
    expect(calls[1]?.[0]).toMatchObject({
      status: 'accepted',
      user_choice: 'accept_suggested_timing',
    });
    expect(mocks.devWarn).toHaveBeenCalledOnce();
  });

  it('drops an owner-A mirror when the account boundary starts during owner capture', async () => {
    let releaseOwner!: (value: { data: { user: { id: string } }; error: null }) => void;
    mocks.getUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseOwner = resolve;
        }),
    );
    const pending = mirrorConflictChoiceForOwner(createOwnerQueryScope(), CONFLICT, 'use_together');
    await vi.waitFor(() => expect(mocks.getUser).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseOwner({ data: { user: { id: 'owner-a' } }, error: null });

    await expect(pending).resolves.toBeUndefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.devWarn).toHaveBeenCalledWith(
      'routine_conflict_mirror_upsert_failed',
      expect.objectContaining({ code: 'ACCOUNT_GENERATION_CHANGED' }),
    );
  });

  it('contains a stale owner-A mirror and permits a fresh owner-B mirror after the boundary', async () => {
    let releaseOwner!: (value: { data: { user: { id: string } }; error: null }) => void;
    mocks.getUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseOwner = resolve;
        }),
    );
    const stale = mirrorConflictChoiceForOwner(createOwnerQueryScope(), CONFLICT, 'use_together');
    await vi.waitFor(() => expect(mocks.getUser).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseOwner({ data: { user: { id: 'owner-a' } }, error: null });
    await stale;
    endAccountGenerationBoundary();
    boundaryActive = false;

    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-b' } },
      error: null,
    });
    await mirrorConflictChoiceForOwner(
      createOwnerQueryScope(),
      CONFLICT,
      'accept_suggested_timing',
    );

    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'owner-b',
        user_choice: 'accept_suggested_timing',
      }),
      { onConflict: 'user_id,rule_id,product_a_id,product_b_id' },
    );
  });

  it('aborts an in-flight owner-A request and prevents its queued mirror from starting', async () => {
    const signals: AbortSignal[] = [];
    mocks.abortSignal.mockImplementationOnce(
      (signal: AbortSignal) =>
        new Promise<{ error: null }>((resolve) => {
          signals.push(signal);
          signal.addEventListener('abort', () => resolve({ error: null }), { once: true });
        }),
    );
    const ownerScope = createOwnerQueryScope();
    const first = mirrorConflictChoiceForOwner(ownerScope, CONFLICT, 'use_together');
    await vi.waitFor(() => expect(mocks.abortSignal).toHaveBeenCalledOnce());
    const queued = mirrorConflictChoiceForOwner(ownerScope, CONFLICT, 'accept_suggested_timing');

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await first;
    await queued;

    expect(signals[0]?.aborted).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });
});
