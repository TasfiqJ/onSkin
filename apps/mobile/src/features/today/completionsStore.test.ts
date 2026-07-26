import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  COMPLETION_LOG_INVALID,
  COMPLETION_LOG_UNSUPPORTED_VERSION,
  clearCompletions,
  acknowledgeCompletionSyncOperation,
  deferCompletionSyncDependencyOperation,
  getCompletedSteps,
  getCompletionSyncUnsynced,
  getPendingCompletionSyncOperations,
  getCompletionSummary,
  getCountByDate,
  isBeyondBackfillCap,
  rejectCompletionSyncOperation,
  recoverCompletionSyncUnsynced,
  subscribeCompletionSyncOutboxChanges,
  toggleCompletion,
} from './completionsStore';
import { shouldTrackCycleNightCompleted } from './cycleCompletion';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  readFailures: new Map<string, Error>(),
  updateFailures: new Map<string, Error>(),
  reads: 0,
  writes: 0,
  readGate: null as Promise<void> | null,
  readStarted: null as (() => void) | null,
  uuidCounter: 0,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => {
    mocks.uuidCounter += 1;
    return `00000000-0000-4000-8000-${mocks.uuidCounter.toString(16).padStart(12, '0')}`;
  }),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => {
    mocks.reads += 1;
    const failure = mocks.readFailures.get(key);
    if (failure) throw failure;
    mocks.readStarted?.();
    if (mocks.readGate) await mocks.readGate;
    return mocks.storage.get(key) ?? null;
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
    mocks.writes += 1;
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
    mocks.writes += 1;
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const ownTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, ownTail);
      await previous;
      try {
        const failure = mocks.updateFailures.get(key);
        if (failure) throw failure;
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (next === current) return;
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
        mocks.writes += 1;
      } finally {
        release();
        if (mocks.tails.get(key) === ownTail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'onskin.completions.v1';
const FIRST_COMPLETION_KEY = 'onskin.completions.firstCompletion.v1';
const DAY = '2026-07-07';
const NOW = new Date('2026-07-08T16:00:00.000Z');
const REMOTE_PRODUCT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REMOTE_PRODUCT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REMOTE = { source: 'real_plan', timezone: 'America/Toronto', stepOrder: 1 } as const;

function storedDays(): Record<string, string[]> {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    version?: number;
    days?: Record<string, string[]>;
    completedDays?: string[];
  };
  expect(parsed.version).toBe(3);
  return parsed.days ?? {};
}

function storedCompletedDays(): string[] {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    completedDays?: string[];
  };
  return parsed.completedDays ?? [];
}

function storedSync(): {
  routineIds: { AM: string | null; PM: string | null };
  stepIds: Record<string, { id: string; stepOrder: number }>;
  journal: { eventId: string; kind: string; completedAt: string }[];
  outbox: string[];
  terminal: { eventId: string; code: string }[];
  unsynced: {
    eventId: string;
    stepKey: string;
    completionDayInserted: boolean;
    reason: string;
  }[];
} {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    sync?: ReturnType<typeof storedSync>;
  };
  if (!parsed.sync) throw new Error('missing sync state');
  return parsed.sync;
}

describe('today completion persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readFailures.clear();
    mocks.updateFailures.clear();
    mocks.reads = 0;
    mocks.writes = 0;
    mocks.readGate = null;
    mocks.readStarted = null;
    mocks.uuidCounter = 0;
    vi.clearAllMocks();
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails closed without deleting malformed encrypted bytes', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('rejects a mutation over malformed state without replacing the original bytes', async () => {
    const original = JSON.stringify({ [DAY]: 'AM:cleanser' });
    mocks.storage.set(KEY, original);

    await expect(toggleCompletion('AM:cleanser', DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('persists a normal check-off in the versioned envelope across fresh Today reads', async () => {
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      inserted: true,
      firstEver: true,
      completionDayInserted: false,
      completedStepKeysAfter: new Set(['AM:cleanser']),
    });

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser']));
    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser']));
    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser'] });
  });

  it('preserves an existing completion and does not re-fire first-ever activation', async () => {
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      inserted: true,
      firstEver: true,
      completionDayInserted: false,
      completedStepKeysAfter: new Set(['AM:cleanser']),
    });
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      inserted: false,
      firstEver: false,
      completionDayInserted: false,
      completedStepKeysAfter: new Set(['AM:cleanser']),
    });

    expect(mocks.storage.get(FIRST_COMPLETION_KEY)).toBe('true');
    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser']));
    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser'] });
  });

  it('migrates a valid legacy log only inside an explicit atomic mutation', async () => {
    mocks.storage.set(KEY, JSON.stringify({ [DAY]: ['AM:cleanser'] }));

    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      inserted: false,
      firstEver: false,
      completionDayInserted: false,
      completedStepKeysAfter: new Set(['AM:cleanser']),
    });

    expect(mocks.storage.get(FIRST_COMPLETION_KEY)).toBe('true');
    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser'] });
  });

  it('normalizes valid legacy whitespace and duplicates in memory without rewriting reads', async () => {
    const original = JSON.stringify({
      [` ${DAY} `]: [' AM:cleanser ', 'AM:cleanser', 'PM:retinol'],
    });
    mocks.storage.set(KEY, original);

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser', 'PM:retinol']));

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('rejects an entire legacy log containing a malformed row and preserves it', async () => {
    const original = JSON.stringify({
      [DAY]: ['AM:cleanser'],
      '2026-02-31': ['PM:bad-date'],
    });
    mocks.storage.set(KEY, original);

    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);
    await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('merges completion rows when padded legacy dates normalize to the same day', async () => {
    const original = JSON.stringify({
      [` ${DAY} `]: ['AM:cleanser'],
      [DAY]: ['PM:retinol'],
    });
    mocks.storage.set(KEY, original);

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser', 'PM:retinol']));
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('serializes simultaneous check-offs without losing a writer', async () => {
    const stepKeys = Array.from({ length: 40 }, (_, index) => `AM:item-${index}`);

    const results = await Promise.all(stepKeys.map((key) => toggleCompletion(key, DAY)));

    expect(new Set(storedDays()[DAY])).toEqual(new Set(stepKeys));
    expect(results.filter((result) => result.inserted)).toHaveLength(stepKeys.length);
    expect(results.filter((result) => result.firstEver)).toHaveLength(1);
  });

  it('serializes simultaneous retries of one step as exactly one insertion', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => toggleCompletion('PM:retinoid', DAY)),
    );

    expect(results.every((result) => result.done)).toBe(true);
    expect(results.filter((result) => result.inserted)).toHaveLength(1);
    expect(results.filter((result) => result.firstEver)).toHaveLength(1);
    expect(
      results.every(
        (result) =>
          result.completedStepKeysAfter.size === 1 &&
          result.completedStepKeysAfter.has('PM:retinoid'),
      ),
    ).toBe(true);
    expect(storedDays()).toEqual({ [DAY]: ['PM:retinoid'] });
  });

  it('identifies exactly one completed cycle night when the final two steps race', async () => {
    const stepKeys = ['PM:cleanser', 'PM:retinoid', 'PM:moisturiser'] as const;
    const scheduled = { phase: 'PM' as const, stepKeys };
    await toggleCompletion(stepKeys[0], DAY, scheduled);

    const completions = await Promise.all(
      stepKeys.slice(1).map(async (completedKey) => ({
        completedKey,
        result: await toggleCompletion(completedKey, DAY, scheduled),
      })),
    );

    expect(
      completions.filter(({ completedKey, result }) =>
        shouldTrackCycleNightCompleted({
          completedStepKeysAfter: result.completedStepKeysAfter,
          completedKey,
          cycleActive: true,
          phase: 'PM',
          stepKeys,
          completionInserted: result.inserted,
        }),
      ),
    ).toHaveLength(1);
    expect(completions.map(({ result }) => result.completedStepKeysAfter.size).sort()).toEqual([
      2, 3,
    ]);
    expect(completions.filter(({ result }) => result.completionDayInserted)).toHaveLength(1);
    expect(storedCompletedDays()).toEqual([DAY]);
    expect(new Set(storedDays()[DAY])).toEqual(new Set(stepKeys));
  });

  it('preserves future-version bytes and refuses to downgrade them', async () => {
    const original = JSON.stringify({ version: 4, days: { [DAY]: ['AM:cleanser'] } });
    mocks.storage.set(KEY, original);

    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_UNSUPPORTED_VERSION);
    await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow(
      COMPLETION_LOG_UNSUPPORTED_VERSION,
    );

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('does not overwrite state when the private key is unavailable', async () => {
    const original = JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } });
    mocks.storage.set(KEY, original);
    mocks.readFailures.set(KEY, new Error('PRIVATE_KEY_UNAVAILABLE'));

    await expect(getCompletedSteps(DAY)).rejects.toThrow('PRIVATE_KEY_UNAVAILABLE');
    expect(mocks.storage.get(KEY)).toBe(original);

    mocks.readFailures.delete(KEY);
    mocks.updateFailures.set(KEY, new Error('PRIVATE_KEY_UNAVAILABLE'));
    await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow('PRIVATE_KEY_UNAVAILABLE');

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('leaves the prior log intact when the atomic write fails', async () => {
    const original = JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } });
    mocks.storage.set(KEY, original);
    mocks.updateFailures.set(KEY, new Error('PRIVATE_WRITE_FAILED'));

    await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('does not persist empty step keys or invalid completion dates', async () => {
    await expect(toggleCompletion('   ', DAY)).resolves.toEqual({
      done: false,
      inserted: false,
      firstEver: false,
      completionDayInserted: false,
      completedStepKeysAfter: new Set(),
    });
    await expect(toggleCompletion('AM:cleanser', '2026-02-31')).resolves.toEqual({
      done: false,
      inserted: false,
      firstEver: false,
      completionDayInserted: false,
      completedStepKeysAfter: new Set(),
    });

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('rejects unscoped step keys instead of admitting an ambiguous completion', async () => {
    await expect(toggleCompletion('cleanser', DAY)).resolves.toEqual({
      done: false,
      inserted: false,
      firstEver: false,
      completionDayInserted: false,
      completedStepKeysAfter: new Set(),
    });

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('rejects non-canonical current envelopes without rewriting their bytes', async () => {
    const cases = [
      { version: 2, days: { [DAY]: [' AM:cleanser '] }, completedDays: [] },
      {
        version: 2,
        days: { [DAY]: ['AM:cleanser', 'AM:cleanser'] },
        completedDays: [],
      },
      { version: 2, days: { [` ${DAY} `]: ['AM:cleanser'] }, completedDays: [] },
      { version: 2, days: { [DAY]: [] }, completedDays: [] },
      { version: 2, days: { [DAY]: ['AM:cleanser'] }, completedDays: [], extra: true },
      { version: 2, days: { [DAY]: ['AM:cleanser'] }, completedDays: [DAY] },
      { version: 2, days: { [DAY]: ['PM:cleanser'] }, completedDays: [DAY, DAY] },
    ];

    for (const value of cases) {
      const original = JSON.stringify(value);
      mocks.storage.set(KEY, original);

      await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);
      await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);
      expect(mocks.storage.get(KEY)).toBe(original);
    }
    expect(mocks.writes).toBe(0);
  });

  it('treats invalid dates as beyond the backfill cap', () => {
    expect(isBeyondBackfillCap('2026-02-31', DAY)).toBe(true);
    expect(isBeyondBackfillCap(DAY, 'not-a-day')).toBe(true);
  });

  it('rejects dates beyond the timezone-tolerant future window', () => {
    expect(isBeyondBackfillCap('2026-07-08', DAY)).toBe(false);
    expect(isBeyondBackfillCap('2026-07-09', DAY)).toBe(true);
  });

  it('uses normalized completion rows for heat-map counts without rewriting reads', async () => {
    const original = JSON.stringify({
      [DAY]: ['AM:cleanser', ' AM:cleanser ', 'PM:retinol'],
    });
    mocks.storage.set(KEY, original);

    const counts = await getCountByDate();

    expect(counts.get(DAY)).toBe(2);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('derives streak dates and heat-map counts from one atomic storage read', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 2,
        days: {
          [DAY]: ['AM:cleanser', 'PM:retinol'],
          '2026-07-06': ['PM:cleanser'],
        },
        completedDays: [DAY, '2026-07-06'],
      }),
    );

    const summary = await getCompletionSummary();

    expect(summary.completedDates).toEqual(new Set([DAY, '2026-07-06']));
    expect(summary.countByDate).toEqual(
      new Map([
        [DAY, 2],
        ['2026-07-06', 1],
      ]),
    );
    expect(mocks.reads).toBe(1);
  });

  it('does not invent adherence from AM, partial PM, or legacy step rows', async () => {
    await toggleCompletion('AM:cleanser', DAY);
    await toggleCompletion('PM:cleanser', DAY, {
      phase: 'PM',
      stepKeys: ['PM:cleanser', 'PM:moisturiser'],
    });

    await expect(getCompletionSummary()).resolves.toMatchObject({
      completedDates: new Set(),
    });
    expect(storedCompletedDays()).toEqual([]);

    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 1,
        days: { [DAY]: ['PM:cleanser', 'PM:moisturiser'] },
      }),
    );
    await expect(getCompletionSummary()).resolves.toMatchObject({
      completedDates: new Set(),
    });
  });

  it('records exactly one adherence day only after every scheduled PM step is durable', async () => {
    const scheduled = {
      phase: 'PM' as const,
      stepKeys: ['PM:cleanser', 'PM:moisturiser'],
    };

    await expect(toggleCompletion('PM:cleanser', DAY, scheduled)).resolves.toMatchObject({
      completionDayInserted: false,
    });
    await expect(toggleCompletion('PM:moisturiser', DAY, scheduled)).resolves.toMatchObject({
      completionDayInserted: true,
    });
    await expect(toggleCompletion('PM:moisturiser', DAY, scheduled)).resolves.toMatchObject({
      completionDayInserted: false,
    });
    await expect(getCompletionSummary()).resolves.toMatchObject({
      completedDates: new Set([DAY]),
    });
    expect(storedCompletedDays()).toEqual([DAY]);
  });

  it('upgrades v2 without inventing remote identities, timestamps, or replay work', async () => {
    const original = JSON.stringify({
      version: 2,
      days: { [DAY]: [`PM:${REMOTE_PRODUCT_A}`] },
      completedDays: [DAY],
    });
    mocks.storage.set(KEY, original);

    await expect(getPendingCompletionSyncOperations()).resolves.toEqual([]);
    expect(mocks.storage.get(KEY)).toBe(original);

    await toggleCompletion(`AM:${REMOTE_PRODUCT_B}`, DAY);

    expect(storedSync()).toEqual({
      routineIds: { AM: null, PM: null },
      stepIds: {},
      journal: [],
      outbox: [],
      terminal: [],
      unsynced: [],
    });
  });

  it('atomically journals real-plan step and full-PM attestations with stable identities', async () => {
    const stepA = `PM:${REMOTE_PRODUCT_A}`;
    const stepB = `PM:${REMOTE_PRODUCT_B}`;
    const scheduled = { phase: 'PM' as const, stepKeys: [stepA, stepB] };
    const wake = vi.fn();
    const unsubscribe = subscribeCompletionSyncOutboxChanges(wake);

    await toggleCompletion(stepA, DAY, scheduled, REMOTE);
    await toggleCompletion(stepB, DAY, scheduled, { ...REMOTE, stepOrder: 2 });
    unsubscribe();

    const sync = storedSync();
    expect(sync.routineIds.PM).toMatch(/^[0-9a-f-]{36}$/u);
    expect(sync.routineIds.AM).toBeNull();
    expect(sync.stepIds[stepA]?.stepOrder).toBe(1);
    expect(sync.stepIds[stepB]?.stepOrder).toBe(2);
    expect(sync.journal.map(({ kind }) => kind)).toEqual(['step', 'step', 'routine_day']);
    expect(sync.journal.every(({ completedAt }) => completedAt === NOW.toISOString())).toBe(true);
    expect(sync.outbox).toEqual(sync.journal.map(({ eventId }) => eventId));
    expect(sync.terminal).toEqual([]);
    expect(JSON.stringify(sync)).not.toContain('user-a');
    expect(wake).toHaveBeenCalledTimes(2);
    await expect(getPendingCompletionSyncOperations()).resolves.toHaveLength(3);

    await toggleCompletion(stepA, DAY, scheduled, REMOTE);
    expect(storedSync()).toEqual(sync);
  });

  it('acknowledges or quarantines only outbox pointers while retaining the journal', async () => {
    const step = `AM:${REMOTE_PRODUCT_A}`;
    await toggleCompletion(step, DAY, undefined, REMOTE);
    const [operation] = await getPendingCompletionSyncOperations();
    expect(operation).toBeDefined();
    const wake = vi.fn();
    const unsubscribe = subscribeCompletionSyncOutboxChanges(wake);

    await expect(acknowledgeCompletionSyncOperation(operation!.eventId)).resolves.toBe(true);
    await expect(acknowledgeCompletionSyncOperation(operation!.eventId)).resolves.toBe(false);
    expect(storedSync().journal).toHaveLength(1);
    expect(storedSync().outbox).toEqual([]);

    await toggleCompletion(`AM:${REMOTE_PRODUCT_B}`, DAY, undefined, {
      ...REMOTE,
      stepOrder: 2,
    });
    const [next] = await getPendingCompletionSyncOperations();
    const beforeInvalidReject = mocks.storage.get(KEY);
    await expect(
      rejectCompletionSyncOperation(next!.eventId, 'COMPLETION_NEW_UNKNOWN_CODE' as never),
    ).rejects.toThrow(COMPLETION_LOG_INVALID);
    expect(mocks.storage.get(KEY)).toBe(beforeInvalidReject);
    await expect(
      rejectCompletionSyncOperation(next!.eventId, 'COMPLETION_REQUEST_INVALID'),
    ).resolves.toBe(true);
    await expect(
      rejectCompletionSyncOperation(next!.eventId, 'COMPLETION_REQUEST_INVALID'),
    ).resolves.toBe(false);
    unsubscribe();

    expect(storedSync().journal).toHaveLength(2);
    expect(storedSync().outbox).toEqual([]);
    expect(storedSync().terminal).toEqual([
      { eventId: next!.eventId, code: 'COMPLETION_REQUEST_INVALID' },
    ]);
    expect(wake).toHaveBeenCalledTimes(1);
  });

  it('refuses out-of-order acknowledgement or quarantine so FIFO work cannot be skipped', async () => {
    await toggleCompletion(`AM:${REMOTE_PRODUCT_A}`, DAY, undefined, REMOTE);
    await toggleCompletion(`AM:${REMOTE_PRODUCT_B}`, DAY, undefined, {
      ...REMOTE,
      stepOrder: 2,
    });
    const [head, tail] = await getPendingCompletionSyncOperations();

    await expect(acknowledgeCompletionSyncOperation(tail!.eventId)).resolves.toBe(false);
    await expect(
      rejectCompletionSyncOperation(tail!.eventId, 'COMPLETION_REQUEST_INVALID'),
    ).resolves.toBe(false);
    await expect(getPendingCompletionSyncOperations()).resolves.toEqual([head, tail]);

    await expect(acknowledgeCompletionSyncOperation(head!.eventId)).resolves.toBe(true);
    await expect(
      rejectCompletionSyncOperation(tail!.eventId, 'COMPLETION_REQUEST_INVALID'),
    ).resolves.toBe(true);
    expect(storedSync().journal).toHaveLength(2);
    expect(storedSync().outbox).toEqual([]);
  });

  it('atomically cascades a terminal final PM step to its bound routine-day marker', async () => {
    const stepA = `PM:${REMOTE_PRODUCT_A}`;
    const stepB = `PM:${REMOTE_PRODUCT_B}`;
    const scheduled = { phase: 'PM' as const, stepKeys: [stepA, stepB] };
    await toggleCompletion(stepA, DAY, scheduled, REMOTE);
    await toggleCompletion(stepB, DAY, scheduled, { ...REMOTE, stepOrder: 2 });
    const [first, finalStep, routineDay] = await getPendingCompletionSyncOperations();

    await expect(acknowledgeCompletionSyncOperation(first!.eventId)).resolves.toBe(true);
    await expect(
      rejectCompletionSyncOperation(finalStep!.eventId, 'COMPLETION_IDENTITY_CONFLICT'),
    ).resolves.toBe(true);

    const sync = storedSync();
    expect(sync.journal).toHaveLength(3);
    expect(sync.journal.map(({ eventId }) => eventId)).toEqual([
      first!.eventId,
      finalStep!.eventId,
      routineDay!.eventId,
    ]);
    expect(sync.outbox).toEqual([]);
    expect(sync.terminal).toEqual([
      { eventId: finalStep!.eventId, code: 'COMPLETION_IDENTITY_CONFLICT' },
      {
        eventId: routineDay!.eventId,
        code: 'COMPLETION_DEPENDENCY_TERMINAL',
        dependencyEventIds: [finalStep!.eventId],
      },
    ]);
  });

  it('blocks the routine-day marker for any terminal scheduled step and preserves unrelated FIFO work', async () => {
    const stepA = `PM:${REMOTE_PRODUCT_A}`;
    const stepB = `PM:${REMOTE_PRODUCT_B}`;
    const scheduled = { phase: 'PM' as const, stepKeys: [stepA, stepB] };
    await toggleCompletion(stepA, DAY, scheduled, REMOTE);
    await toggleCompletion(stepB, DAY, scheduled, { ...REMOTE, stepOrder: 2 });
    await toggleCompletion(`AM:${REMOTE_PRODUCT_A}`, DAY, undefined, REMOTE);
    const [first, finalStep, routineDay, unrelated] = await getPendingCompletionSyncOperations();

    await expect(
      rejectCompletionSyncOperation(first!.eventId, 'COMPLETION_IDENTITY_CONFLICT'),
    ).resolves.toBe(true);
    await expect(getPendingCompletionSyncOperations()).resolves.toEqual([finalStep, unrelated]);
    expect(storedSync().terminal).toEqual([
      { eventId: first!.eventId, code: 'COMPLETION_IDENTITY_CONFLICT' },
      {
        eventId: routineDay!.eventId,
        code: 'COMPLETION_DEPENDENCY_TERMINAL',
        dependencyEventIds: [first!.eventId],
      },
    ]);

    await expect(
      rejectCompletionSyncOperation(finalStep!.eventId, 'COMPLETION_REQUEST_INVALID'),
    ).resolves.toBe(true);
    await expect(getPendingCompletionSyncOperations()).resolves.toEqual([unrelated]);
    expect(storedSync().terminal).toEqual([
      { eventId: first!.eventId, code: 'COMPLETION_IDENTITY_CONFLICT' },
      {
        eventId: routineDay!.eventId,
        code: 'COMPLETION_DEPENDENCY_TERMINAL',
        dependencyEventIds: [first!.eventId, finalStep!.eventId],
      },
      { eventId: finalStep!.eventId, code: 'COMPLETION_REQUEST_INVALID' },
    ]);
  });

  it('atomically defers a missing Shelf dependency and its bound routine-day marker', async () => {
    const stepA = `PM:${REMOTE_PRODUCT_A}`;
    const stepB = `PM:${REMOTE_PRODUCT_B}`;
    const scheduled = { phase: 'PM' as const, stepKeys: [stepA, stepB] };
    await toggleCompletion(stepA, DAY, scheduled, REMOTE);
    await toggleCompletion(stepB, DAY, scheduled, { ...REMOTE, stepOrder: 2 });
    await toggleCompletion(`AM:${REMOTE_PRODUCT_A}`, DAY, undefined, REMOTE);
    const [first, finalStep, routineDay, unrelated] = await getPendingCompletionSyncOperations();

    await expect(
      deferCompletionSyncDependencyOperation(first!.eventId, REMOTE_PRODUCT_A),
    ).resolves.toEqual({ deferred: true, moved: 3 });

    const sync = storedSync();
    expect(sync.outbox).toEqual([
      unrelated!.eventId,
      first!.eventId,
      finalStep!.eventId,
      routineDay!.eventId,
    ]);
    expect(sync.terminal).toEqual([]);
    await expect(getPendingCompletionSyncOperations()).resolves.toEqual([
      unrelated,
      first,
      finalStep,
      routineDay,
    ]);
    await expect(
      deferCompletionSyncDependencyOperation(first!.eventId, REMOTE_PRODUCT_B),
    ).resolves.toEqual({ deferred: false, moved: 0 });
  });

  it('keeps timezone-blocked real-plan evidence and atomically promotes it after recovery', async () => {
    const step = `PM:${REMOTE_PRODUCT_A}`;
    const scheduled = { phase: 'PM' as const, stepKeys: [step] };
    const completedAt = new Date('2026-07-07T16:00:00.000Z');
    vi.setSystemTime(completedAt);
    await toggleCompletion(step, DAY, scheduled, {
      source: 'real_plan',
      timezone: null,
      stepOrder: 1,
      unavailableReason: 'COMPLETION_TIMEZONE_UNAVAILABLE',
    });

    const [unavailable] = await getCompletionSyncUnsynced();
    expect(unavailable).toMatchObject({
      stepKey: step,
      routineType: 'PM',
      stepOrder: 1,
      completedAt: completedAt.toISOString(),
      completedDate: DAY,
      completionDayInserted: true,
      reason: 'COMPLETION_TIMEZONE_UNAVAILABLE',
    });
    expect(storedSync().journal).toEqual([]);
    expect(storedSync().outbox).toEqual([]);
    expect(mocks.storage.get(KEY)).toContain('COMPLETION_TIMEZONE_UNAVAILABLE');

    await expect(recoverCompletionSyncUnsynced('America/Toronto')).resolves.toBe(1);
    await expect(getCompletionSyncUnsynced()).resolves.toEqual([]);
    const pending = await getPendingCompletionSyncOperations();
    expect(pending.map(({ kind }) => kind)).toEqual(['step', 'routine_day']);
    expect(pending[0]?.eventId).toBe(unavailable?.eventId);
    expect(pending.every(({ timezone }) => timezone === 'America/Toronto')).toBe(true);
  });

  it('keeps timezone evidence quarantined when a later zone maps its instant to another date', async () => {
    const step = `AM:${REMOTE_PRODUCT_A}`;
    vi.setSystemTime(new Date('2026-07-08T01:30:00.000Z'));
    await toggleCompletion(step, '2026-07-07', undefined, {
      source: 'real_plan',
      timezone: null,
      stepOrder: 1,
      unavailableReason: 'COMPLETION_TIMEZONE_UNAVAILABLE',
    });

    await expect(recoverCompletionSyncUnsynced('Asia/Tokyo')).resolves.toBe(0);
    await expect(getPendingCompletionSyncOperations()).resolves.toEqual([]);
    await expect(getCompletionSyncUnsynced()).resolves.toMatchObject([
      {
        stepKey: step,
        completedDate: '2026-07-07',
        disposition: 'recoverable',
        timezoneEvidence: null,
      },
    ]);
  });

  it('keeps an incompatible legacy product check-off actionable and non-mirrorable', async () => {
    const step = 'AM:legacy-shelf-product';
    await toggleCompletion(step, DAY, undefined, {
      source: 'real_plan',
      timezone: 'America/Toronto',
      stepOrder: 1,
      unavailableReason: 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED',
    });

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set([step]));
    await expect(getPendingCompletionSyncOperations()).resolves.toEqual([]);
    await expect(recoverCompletionSyncUnsynced('America/Toronto')).resolves.toBe(0);
    await expect(getCompletionSyncUnsynced()).resolves.toMatchObject([
      {
        stepKey: step,
        reason: 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED',
        disposition: 'terminal',
        timezoneEvidence: 'America/Toronto',
      },
    ]);
  });

  it('rejects invalid remote metadata before mutating local evidence', async () => {
    await expect(
      toggleCompletion(`AM:${REMOTE_PRODUCT_A}`, DAY, undefined, {
        source: 'real_plan',
        timezone: 'Not/A_Zone',
        stepOrder: 1,
      }),
    ).rejects.toThrow(COMPLETION_LOG_INVALID);
    await expect(toggleCompletion('AM:not-a-shelf-uuid', DAY, undefined, REMOTE)).rejects.toThrow(
      COMPLETION_LOG_INVALID,
    );

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('does not return account-A completion data after an A-to-B same-epoch switch', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({ version: 1, days: { [DAY]: ['AM:account-a-secret'] } }),
    );
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    mocks.readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.readStarted = markReadStarted;

    const pending = getCompletedSteps(DAY);
    await readStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-b', accountGeneration: 0 });
    releaseRead();

    await expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_OWNER_MISMATCH');
  });

  it('keeps the deletion-only reset available after health processing closes', async () => {
    mocks.storage.set(KEY, JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } }));
    mocks.storage.set(FIRST_COMPLETION_KEY, 'true');
    clearActiveHealthProcessingEpoch();

    await expect(clearCompletions()).resolves.toBeUndefined();

    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.storage.has(FIRST_COMPLETION_KEY)).toBe(false);
  });
});
