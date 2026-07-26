import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  AccountGenerationLeaseError,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import {
  readRequestMetricSamples,
  resetRequestMetricSamplesForTests,
} from '@/lib/network/requestPolicy';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import { useProgress, type ProgressData } from './useProgress';

const mocks = vi.hoisted(() => ({
  getCompletionSummary: vi.fn(),
  ownerScope: { generation: 0 },
  supabaseConfigured: true,
  supabaseFrom: vi.fn(),
  useQuery: vi.fn((options: unknown) => options),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@/features/today/completionsStore', () => ({
  getCompletionSummary: mocks.getCompletionSummary,
}));

vi.mock('@/features/today/useToday', () => ({
  localDateString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
}));

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.supabaseConfigured;
  },
}));

vi.mock('@/lib/query/localDateBoundaryStore', () => ({
  useLocalDateBoundary: () => ({
    localDate: '2026-07-14',
    timeZone: 'America/Toronto',
  }),
}));

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => mocks.ownerScope,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: mocks.supabaseFrom,
  },
}));

const ROUTINE_DIR = fileURLToPath(new URL('./', import.meta.url));

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  reject: (error: unknown) => void;
  resolve: (value: T) => void;
}>;

type CompletionResponse = {
  data: { completed_date: string }[] | null;
  error?: unknown;
  status?: number;
};
type ProfileResponse = {
  data: { longest_streak: unknown } | null;
  error?: unknown;
  status?: number;
};

type ServerHarness = Readonly<{
  completions: Deferred<CompletionResponse>;
  profiles: Deferred<ProfileResponse>;
  signals: AbortSignal[];
  starts: string[];
}>;

type ImmediateServerHarness = Readonly<{
  calls: { completions: number; profiles: number };
  retryFlags: { completions: boolean[]; profiles: boolean[] };
  signals: AbortSignal[];
}>;

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

function abortable<T>(source: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (operation: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      operation();
    };
    const onAbort = () =>
      finish(() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));

    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    void source.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

function installServerHarness(
  starts: string[] = [],
  options: Readonly<{ ignoreAbort?: boolean }> = {},
): ServerHarness {
  const completions = deferred<CompletionResponse>();
  const profiles = deferred<ProfileResponse>();
  const signals: AbortSignal[] = [];

  mocks.supabaseFrom.mockReset();
  mocks.supabaseFrom.mockImplementation((table: string) => {
    if (table === 'routine_completions') {
      const builder = {
        select: vi.fn(),
        gte: vi.fn(),
        retry: vi.fn(),
        abortSignal: vi.fn(),
      };
      builder.select.mockReturnValue(builder);
      builder.gte.mockReturnValue(builder);
      builder.retry.mockReturnValue(builder);
      builder.abortSignal.mockImplementation((signal: AbortSignal) => {
        starts.push('completions');
        signals.push(signal);
        return options.ignoreAbort ? completions.promise : abortable(completions.promise, signal);
      });
      return builder;
    }
    if (table === 'profiles') {
      let signal: AbortSignal | null = null;
      const builder = {
        select: vi.fn(),
        limit: vi.fn(),
        retry: vi.fn(),
        abortSignal: vi.fn(),
        maybeSingle: vi.fn(),
      };
      builder.select.mockReturnValue(builder);
      builder.limit.mockReturnValue(builder);
      builder.retry.mockReturnValue(builder);
      builder.abortSignal.mockImplementation((nextSignal: AbortSignal) => {
        signal = nextSignal;
        signals.push(nextSignal);
        return builder;
      });
      builder.maybeSingle.mockImplementation(() => {
        if (!signal) throw new Error('profile request did not receive an owner signal');
        starts.push('profiles');
        return options.ignoreAbort ? profiles.promise : abortable(profiles.promise, signal);
      });
      return builder;
    }
    throw new Error(`unexpected Supabase table: ${table}`);
  });

  return { completions, profiles, signals, starts };
}

function installImmediateServerHarness(input: {
  completions: readonly CompletionResponse[];
  profiles: readonly ProfileResponse[];
}): ImmediateServerHarness {
  const calls = { completions: 0, profiles: 0 };
  const retryFlags = { completions: [] as boolean[], profiles: [] as boolean[] };
  const signals: AbortSignal[] = [];

  mocks.supabaseFrom.mockReset();
  mocks.supabaseFrom.mockImplementation((table: string) => {
    if (table === 'routine_completions') {
      const builder = {
        select: vi.fn(),
        gte: vi.fn(),
        retry: vi.fn(),
        abortSignal: vi.fn(),
      };
      builder.select.mockReturnValue(builder);
      builder.gte.mockReturnValue(builder);
      builder.retry.mockImplementation((enabled: boolean) => {
        retryFlags.completions.push(enabled);
        return builder;
      });
      builder.abortSignal.mockImplementation((signal: AbortSignal) => {
        signals.push(signal);
        const response = input.completions[calls.completions];
        calls.completions += 1;
        if (!response) throw new Error('missing completion response fixture');
        return Promise.resolve(response);
      });
      return builder;
    }
    if (table === 'profiles') {
      let signal: AbortSignal | null = null;
      const builder = {
        select: vi.fn(),
        limit: vi.fn(),
        retry: vi.fn(),
        abortSignal: vi.fn(),
        maybeSingle: vi.fn(),
      };
      builder.select.mockReturnValue(builder);
      builder.limit.mockReturnValue(builder);
      builder.retry.mockImplementation((enabled: boolean) => {
        retryFlags.profiles.push(enabled);
        return builder;
      });
      builder.abortSignal.mockImplementation((nextSignal: AbortSignal) => {
        signal = nextSignal;
        signals.push(nextSignal);
        return builder;
      });
      builder.maybeSingle.mockImplementation(() => {
        if (!signal) throw new Error('profile request did not receive an attempt signal');
        const response = input.profiles[calls.profiles];
        calls.profiles += 1;
        if (!response) throw new Error('missing profile response fixture');
        return Promise.resolve(response);
      });
      return builder;
    }
    throw new Error(`unexpected Supabase table: ${table}`);
  });

  return { calls, retryFlags, signals };
}

function emptyLocalSummary() {
  return {
    completedDates: new Set<string>(),
    countByDate: new Map<string, number>(),
  };
}

function useCapturedQueryFn(): () => Promise<ProgressData> {
  const options = useProgress() as unknown as { queryFn: () => Promise<ProgressData> };
  return options.queryFn;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
  mocks.getCompletionSummary.mockReset();
  mocks.getCompletionSummary.mockResolvedValue(emptyLocalSummary());
  mocks.supabaseConfigured = true;
  mocks.supabaseFrom.mockReset();
  mocks.useQuery.mockClear();
  mocks.ownerScope = createOwnerQueryScope();
  resetRequestMetricSamplesForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useProgress local-first contract', () => {
  it('does not require Supabase before showing local streak progress', () => {
    const source = readFileSync(`${ROUTINE_DIR}/useProgress.ts`, 'utf8');

    expect(source).toContain("import { isSupabaseConfigured } from '@/lib/env'");
    expect(source).toContain('if (!isSupabaseConfigured) return []');
    expect(source).toContain('if (!isSupabaseConfigured) return 0');
    expect(source).toContain('runOwnerQueryOperation(ownerScope, async (lease) => {');
    expect(source.match(/\.abortSignal\(signal\)/g)).toHaveLength(2);
    expect(source.match(/\.retry\(false\)/g)).toHaveLength(2);
    expect(source.match(/runRequestWithLease\(/g)).toHaveLength(2);
    expect(source).toContain("endpoint: 'progress_completions'");
    expect(source).toContain("endpoint: 'progress_longest_streak'");
    expect(source).toContain('...deterministicLocalQueryPolicy');
    expect(source).toContain(
      'export function useProgressFromBoundary(boundary: LocalDateBoundaryIdentity)',
    );
    expect(source).toContain('deadlineMs: OPTIONAL_PROGRESS_READ_DEADLINE_MS');
    expect(source).toContain('maxResponseBytes: COMPLETIONS_RESPONSE_LIMIT_BYTES');
    expect(source).toContain('maxResponseBytes: LONGEST_STREAK_RESPONSE_LIMIT_BYTES');
    expect(source).toContain('if (response.error) throw supabaseRequestFailure(');
    expect(source).toContain(
      'awaitAccountGenerationLease(childLease, () => getCompletionSummary())',
    );
    expect(source).toContain('catch (error) {');
    expect(source).toContain(
      '[localSummary, completions, serverLongest] = await settleOwnerQueryOperations(lease, [',
    );
    expect(source).toContain('getCompletionSummary()');
    expect(source).toContain('for (const d of localSummary.completedDates)');
    expect(source).toContain('for (const [d, n] of localSummary.countByDate)');
    expect(source).not.toContain('getCompletedDates()');
    expect(source).not.toContain('getCountByDate()');
    expect(source).toContain(
      'const longest = Math.max(serverLongest, bestStreak(completed), s.current)',
    );
    expect(source).not.toContain('const { data: completions } = await supabase');
  });
});

describe('useProgress owner-bound query behavior', () => {
  it('starts one local read and both server reads in parallel under one owner lease', async () => {
    const starts: string[] = [];
    const localSummary = deferred<ReturnType<typeof emptyLocalSummary>>();
    mocks.getCompletionSummary.mockImplementation(() => {
      starts.push('local');
      return localSummary.promise;
    });
    const server = installServerHarness(starts);

    const pending = useCapturedQueryFn()();
    await vi.advanceTimersByTimeAsync(0);

    expect(starts).toEqual(['local', 'completions', 'profiles']);
    expect(mocks.getCompletionSummary).toHaveBeenCalledTimes(1);
    expect(mocks.supabaseFrom.mock.calls.map(([table]) => table)).toEqual([
      'routine_completions',
      'profiles',
    ]);
    expect(server.signals).toHaveLength(2);
    expect(server.signals[0]).not.toBe(server.signals[1]);
    expect(server.signals[0]?.aborted).toBe(false);

    localSummary.resolve({
      completedDates: new Set(['2026-07-14']),
      countByDate: new Map([['2026-07-14', 2]]),
    });
    server.completions.resolve({ data: [{ completed_date: '2026-07-13' }] });
    server.profiles.resolve({ data: { longest_streak: 9 } });

    const result = await pending;
    expect(result.longest).toBe(9);
    expect(result.weeklyDone).toBe(1);
    expect(result.streak).toBe(2);
    expect(server.signals.every((signal) => !signal.aborted)).toBe(true);
    expect(
      readRequestMetricSamples()
        .map(({ endpoint }) => endpoint)
        .sort(),
    ).toEqual(['progress_completions', 'progress_longest_streak']);
    expect(JSON.stringify(readRequestMetricSamples())).not.toContain('2026-07');
  });

  it('returns local progress at the exact ceiling when optional reads ignore abort', async () => {
    mocks.getCompletionSummary.mockResolvedValue({
      completedDates: new Set(['2026-07-14']),
      countByDate: new Map([['2026-07-14', 1]]),
    });
    const server = installServerHarness([], { ignoreAbort: true });

    let settled = false;
    const pending = useCapturedQueryFn()();
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(server.signals).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(7_999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toMatchObject({ longest: 1, streak: 1 });
    expect(settled).toBe(true);
    expect(server.signals.every((signal) => signal.aborted)).toBe(true);
    expect(readRequestMetricSamples()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpoint: 'progress_completions',
          statusClass: 'network',
          attemptCount: 1,
        }),
        expect.objectContaining({
          endpoint: 'progress_longest_streak',
          statusClass: 'network',
          attemptCount: 1,
        }),
      ]),
    );
  });

  it('throws a returned transient Supabase error into classification and retries once', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const server = installImmediateServerHarness({
      completions: [
        {
          data: null,
          error: new Error('private response must not become empty success'),
          status: 503,
        },
        { data: [{ completed_date: '2026-07-14' }], error: null, status: 200 },
      ],
      profiles: [{ data: { longest_streak: 0 }, error: null, status: 200 }],
    });

    const pending = useCapturedQueryFn()();
    await vi.advanceTimersByTimeAsync(0);

    await expect(pending).resolves.toMatchObject({ streak: 1 });
    expect(server.calls).toEqual({ completions: 2, profiles: 1 });
    expect(server.retryFlags).toEqual({ completions: [false, false], profiles: [false] });
    expect(server.signals).toHaveLength(3);
    expect(readRequestMetricSamples()).toContainEqual(
      expect.objectContaining({
        endpoint: 'progress_completions',
        statusClass: '2xx',
        attemptCount: 2,
      }),
    );
  });

  it('retries the production PostgREST status-zero transport shape exactly once', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const server = installImmediateServerHarness({
      completions: [
        {
          data: null,
          error: {
            code: '',
            details: 'private completion transport details',
            hint: '',
            message: 'TypeError: Network request failed for private completion content',
          },
          status: 0,
        },
        { data: [{ completed_date: '2026-07-14' }], error: null, status: 200 },
      ],
      profiles: [{ data: { longest_streak: 0 }, error: null, status: 200 }],
    });

    const pending = useCapturedQueryFn()();
    await vi.advanceTimersByTimeAsync(0);

    await expect(pending).resolves.toMatchObject({ streak: 1 });
    expect(server.calls).toEqual({ completions: 2, profiles: 1 });
    expect(server.retryFlags).toEqual({ completions: [false, false], profiles: [false] });
    expect(readRequestMetricSamples()).toContainEqual(
      expect.objectContaining({
        endpoint: 'progress_completions',
        statusClass: '2xx',
        attemptCount: 2,
      }),
    );
    expect(JSON.stringify(readRequestMetricSamples())).not.toContain('private completion');
  });

  it('does not broaden a status-zero non-transport response into a retry', async () => {
    const server = installImmediateServerHarness({
      completions: [
        {
          data: null,
          error: { message: 'validation failed for private completion content' },
          status: 0,
        },
      ],
      profiles: [{ data: { longest_streak: 0 }, error: null, status: 200 }],
    });

    await expect(useCapturedQueryFn()()).resolves.toMatchObject({ longest: 0, streak: 0 });
    expect(server.calls).toEqual({ completions: 1, profiles: 1 });
    expect(server.retryFlags).toEqual({ completions: [false], profiles: [false] });
    expect(readRequestMetricSamples()).toContainEqual(
      expect.objectContaining({
        endpoint: 'progress_completions',
        statusClass: 'unknown',
        attemptCount: 1,
      }),
    );
    expect(JSON.stringify(readRequestMetricSamples())).not.toContain('private completion');
  });

  it('fails soft without retrying a deterministic returned Supabase error', async () => {
    const server = installImmediateServerHarness({
      completions: [
        {
          data: [{ completed_date: '2026-07-14' }],
          error: new Error('validation failed'),
          status: 422,
        },
      ],
      profiles: [{ data: { longest_streak: 0 }, error: null, status: 200 }],
    });

    await expect(useCapturedQueryFn()()).resolves.toMatchObject({ longest: 0, streak: 0 });
    expect(server.calls).toEqual({ completions: 1, profiles: 1 });
    expect(readRequestMetricSamples()).toContainEqual(
      expect.objectContaining({
        endpoint: 'progress_completions',
        statusClass: '4xx',
        attemptCount: 1,
      }),
    );
  });

  it('aborts and rejects owner A, then allows the fresh owner generation to resolve', async () => {
    const ownerA = installServerHarness();
    const pendingA = useCapturedQueryFn()();
    await vi.advanceTimersByTimeAsync(0);
    expect(ownerA.signals).toHaveLength(2);

    beginAccountGenerationBoundary();
    try {
      expect(ownerA.signals.every((signal) => signal.aborted)).toBe(true);
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await waitForAccountGenerationOperationsToSettle();
    } finally {
      endAccountGenerationBoundary();
    }

    mocks.ownerScope = createOwnerQueryScope();
    const ownerB = installServerHarness();
    const pendingB = useCapturedQueryFn()();
    ownerB.completions.resolve({ data: [{ completed_date: '2026-07-14' }] });
    ownerB.profiles.resolve({ data: { longest_streak: 4 } });

    await expect(pendingB).resolves.toMatchObject({ longest: 4, streak: 1, weeklyDone: 0 });
    expect(ownerB.signals.every((signal) => !signal.aborted)).toBe(true);
  });

  it('detaches a hung local read so an offline account boundary can drain', async () => {
    mocks.supabaseConfigured = false;
    const localSummary = deferred<ReturnType<typeof emptyLocalSummary>>();
    mocks.getCompletionSummary.mockReturnValueOnce(localSummary.promise);

    const pending = useCapturedQueryFn()();
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pending).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    localSummary.resolve(emptyLocalSummary());
    await Promise.resolve();
  });

  it('fails soft for genuine same-generation server errors', async () => {
    mocks.getCompletionSummary.mockResolvedValue({
      completedDates: new Set(['2026-07-14']),
      countByDate: new Map([['2026-07-14', 1]]),
    });
    const server = installServerHarness();
    const pending = useCapturedQueryFn()();

    server.completions.reject(new Error('offline'));
    server.profiles.reject(new Error('server unavailable'));

    await expect(pending).resolves.toMatchObject({ longest: 1, streak: 1, weeklyDone: 0 });
  });

  it('never translates same-generation abort or account-generation errors into empty data', async () => {
    const abortingServer = installServerHarness();
    const aborted = useCapturedQueryFn()();
    abortingServer.completions.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    abortingServer.profiles.resolve({ data: { longest_streak: 3 } });
    await expect(aborted).rejects.toMatchObject({ kind: 'cancelled' });

    const staleServer = installServerHarness();
    const stale = useCapturedQueryFn()();
    staleServer.completions.reject(new AccountGenerationLeaseError());
    staleServer.profiles.resolve({ data: { longest_streak: 3 } });
    await expect(stale).rejects.toMatchObject({ kind: 'owner_changed' });
  });
});
