import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import type { PrivateKVReadResult } from '@/lib/storage/privateKV';
import * as privateKV from '@/lib/storage/privateKV';

import {
  currentDeviceTimezone,
  DEFAULT_PREFS,
  loadNotifPrefs,
  NOTIF_PREFS_INVALID,
  NOTIF_PREFS_UNAVAILABLE,
  NOTIF_PREFS_UNSUPPORTED_VERSION,
  NOTIF_PREFS_WRITE_UNCERTAIN,
  readNotifPrefs,
  saveNotifPrefs,
  type NotifPrefs,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  readOverride: null as PrivateKVReadResult | null,
  readQueue: [] as PrivateKVReadResult[],
  readFailure: null as Error | null,
  updateFailureBeforeTransform: null as Error | null,
  updateFailureAfterTransform: null as Error | null,
  updateFailureAfterCommit: null as Error | null,
  writes: 0,
  getUser: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  upsertAbortSignal: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    if (mocks.readFailure) throw mocks.readFailure;
    const queued = mocks.readQueue.shift();
    if (queued) return queued;
    if (mocks.readOverride) return mocks.readOverride;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, tail);
      await previous;
      try {
        if (mocks.updateFailureBeforeTransform) throw mocks.updateFailureBeforeTransform;
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (mocks.updateFailureAfterTransform) throw mocks.updateFailureAfterTransform;
        if (next !== current) {
          mocks.writes += 1;
          if (next === null) mocks.storage.delete(key);
          else mocks.storage.set(key, next);
        }
        if (mocks.updateFailureAfterCommit) throw mocks.updateFailureAfterCommit;
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

const KEY = 'onskin.notifPrefs.v1';
let boundaryActive = false;

function prefs(overrides: Partial<NotifPrefs> = {}): NotifPrefs {
  return {
    ...DEFAULT_PREFS,
    timezone: currentDeviceTimezone(),
    ...overrides,
  };
}

function currentRaw(overrides: Partial<NotifPrefs> = {}): string {
  const value = prefs(overrides);
  return JSON.stringify({
    version: 1,
    prefs: {
      ...value,
      replenishmentAlertsOptInConfirmed: value.replenishmentAlerts,
    },
  });
}

function storedPrefs(): Record<string, unknown> {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    prefs?: Record<string, unknown>;
  };
  return parsed.prefs ?? {};
}

async function settleMirrors(): Promise<void> {
  await Promise.resolve();
  await waitForAccountGenerationOperationsToSettle();
}

describe('notification preference store', () => {
  beforeEach(async () => {
    await waitForAccountGenerationOperationsToSettle();
    delete process.env.EXPO_PUBLIC_E2E_NOTIF_PREFS_STORAGE_FAILURE;
    delete process.env.EXPO_PUBLIC_E2E_NOTIF_PREFS_WRITE_FAILURE;
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readOverride = null;
    mocks.readQueue.length = 0;
    mocks.readFailure = null;
    mocks.updateFailureBeforeTransform = null;
    mocks.updateFailureAfterTransform = null;
    mocks.updateFailureAfterCommit = null;
    mocks.writes = 0;
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.from.mockReset();
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockReset();
    mocks.upsert.mockReturnValue({ abortSignal: mocks.upsertAbortSignal });
    mocks.upsertAbortSignal.mockReset();
    mocks.upsertAbortSignal.mockResolvedValue({ error: null });
    vi.mocked(privateKV.readPrivateItem).mockClear();
    vi.mocked(privateKV.removePrivateItem).mockClear();
    vi.mocked(privateKV.updatePrivateItem).mockClear();
  });

  afterEach(async () => {
    if (boundaryActive) {
      endAccountGenerationBoundary();
      boundaryActive = false;
    }
    await waitForAccountGenerationOperationsToSettle();
    delete process.env.EXPO_PUBLIC_E2E_NOTIF_PREFS_STORAGE_FAILURE;
    delete process.env.EXPO_PUBLIC_E2E_NOTIF_PREFS_WRITE_FAILURE;
  });

  it('treats only genuine absence as safe defaults and never reads it as consent', async () => {
    const result = await readNotifPrefs();

    expect(result).toEqual({
      status: 'absent',
      prefs: {
        ...DEFAULT_PREFS,
        timezone: currentDeviceTimezone(),
      },
    });
    expect(result.prefs).toMatchObject({
      amEnabled: false,
      pmEnabled: false,
      streakNudges: false,
      replenishmentAlerts: false,
      captureReminders: false,
      liveActivityEnabled: false,
      promotionalOptIn: false,
      lockscreenDiscreet: true,
    });
    await expect(loadNotifPrefs()).resolves.toEqual(result.prefs);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
  });

  it('strictly reads current and compatible legacy records without rewriting bytes', async () => {
    const cases = [
      {
        raw: currentRaw({ amEnabled: true, pmTime: '20:30' }),
        expected: {
          status: 'available',
          format: 'current',
          prefs: prefs({ amEnabled: true, pmTime: '20:30' }),
        },
      },
      {
        raw: JSON.stringify({
          amEnabled: true,
          amTime: ' 08:15 ',
          quietEnd: ' 06:30 ',
          lockscreenDiscreet: false,
        }),
        expected: {
          status: 'available',
          format: 'legacy',
          prefs: prefs({
            amEnabled: true,
            amTime: '08:15',
            quietEnd: '06:30',
            lockscreenDiscreet: true,
          }),
        },
      },
    ] as const;

    for (const { raw, expected } of cases) {
      mocks.storage.set(KEY, raw);

      await expect(readNotifPrefs()).resolves.toEqual(expected);

      expect(mocks.storage.get(KEY)).toBe(raw);
    }
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
  });

  it.each([
    [
      { status: 'unavailable', reason: 'content_key_missing' } as const,
      { status: 'unavailable', prefs: null, reason: 'content_key_missing' },
      NOTIF_PREFS_UNAVAILABLE,
    ],
    [
      { status: 'corrupt', reason: 'decryption_failed' } as const,
      { status: 'corrupt', prefs: null, reason: 'decryption_failed' },
      NOTIF_PREFS_INVALID,
    ],
    [
      { status: 'unsupported_version' } as const,
      { status: 'unsupported_version', prefs: null },
      NOTIF_PREFS_UNSUPPORTED_VERSION,
    ],
  ])(
    'forwards typed private state %# and its strict adapter error',
    async (stored, expected, code) => {
      mocks.readOverride = stored;

      await expect(readNotifPrefs()).resolves.toEqual(expected);
      await expect(loadNotifPrefs()).rejects.toThrow(code);

      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
      expect(mocks.writes).toBe(0);
    },
  );

  it('maps an unexpected private read rejection to typed unavailability', async () => {
    mocks.readFailure = new Error('READ_FAILED');

    await expect(readNotifPrefs()).resolves.toEqual({
      status: 'unavailable',
      prefs: null,
      reason: 'storage_unavailable',
    });
    await expect(loadNotifPrefs()).rejects.toThrow(NOTIF_PREFS_UNAVAILABLE);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', '{not-json', 'corrupt', NOTIF_PREFS_INVALID],
    ['wrong top-level shape', JSON.stringify(['amEnabled']), 'corrupt', NOTIF_PREFS_INVALID],
    [
      'unknown legacy keys',
      JSON.stringify({ amEnabled: true, extra: false }),
      'corrupt',
      NOTIF_PREFS_INVALID,
    ],
    [
      'invalid current privacy state',
      JSON.stringify({
        version: 1,
        prefs: {
          ...prefs(),
          replenishmentAlertsOptInConfirmed: false,
          lockscreenDiscreet: false,
        },
      }),
      'corrupt',
      NOTIF_PREFS_INVALID,
    ],
    [
      'oversized otherwise-valid legacy data',
      `${' '.repeat(16_385)}${JSON.stringify({ amEnabled: true })}`,
      'corrupt',
      NOTIF_PREFS_INVALID,
    ],
    [
      'future schema',
      JSON.stringify({ version: 2, prefs: {} }),
      'unsupported_version',
      NOTIF_PREFS_UNSUPPORTED_VERSION,
    ],
  ])(
    'preserves %s bytes across strict reads and refused writes',
    async (_label, raw, status, code) => {
      mocks.storage.set(KEY, raw);

      const result = await readNotifPrefs();
      expect(result.status).toBe(status);
      await expect(loadNotifPrefs()).rejects.toThrow(code);
      await expect(saveNotifPrefs({ pmEnabled: true })).rejects.toThrow(code);

      expect(mocks.storage.get(KEY)).toBe(raw);
      expect(mocks.writes).toBe(0);
      expect(mocks.upsert).not.toHaveBeenCalled();
    },
  );

  it('requires an explicit replenishment marker and always hardens lock-screen privacy', async () => {
    const withoutMarker = JSON.stringify({
      replenishmentAlerts: true,
      lockscreenDiscreet: false,
    });
    mocks.storage.set(KEY, withoutMarker);

    await expect(readNotifPrefs()).resolves.toMatchObject({
      status: 'available',
      format: 'legacy',
      prefs: { replenishmentAlerts: false, lockscreenDiscreet: true },
    });
    expect(mocks.storage.get(KEY)).toBe(withoutMarker);

    mocks.storage.delete(KEY);
    const first = await saveNotifPrefs({
      replenishmentAlerts: true,
      lockscreenDiscreet: false,
    });
    const second = await saveNotifPrefs({ pmEnabled: true });
    await settleMirrors();

    expect(first).toMatchObject({
      changed: true,
      prefs: { replenishmentAlerts: true, lockscreenDiscreet: true },
    });
    expect(second).toMatchObject({
      changed: true,
      prefs: { pmEnabled: true, replenishmentAlerts: true, lockscreenDiscreet: true },
    });
    expect(storedPrefs()).toMatchObject({
      replenishmentAlerts: true,
      replenishmentAlertsOptInConfirmed: true,
      lockscreenDiscreet: true,
    });
    expect(mocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pm_reminder_enabled: true,
        replenishment_alerts: true,
        lockscreen_discreet: true,
      }),
    );
    expect(mocks.upsertAbortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('persists and mirrors an explicit valid timezone instead of discarding it', async () => {
    mocks.storage.set(KEY, currentRaw());

    await expect(saveNotifPrefs({ timezone: 'UTC' })).resolves.toMatchObject({
      changed: currentDeviceTimezone() !== 'UTC',
      prefs: { timezone: 'UTC' },
    });
    await settleMirrors();

    expect(storedPrefs()).toMatchObject({ timezone: 'UTC' });
    if (currentDeviceTimezone() !== 'UTC') {
      expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'UTC' }));
    }
  });

  it('rejects invalid runtime patches before any storage or owner I/O', async () => {
    const invalidPatches: unknown[] = [
      null,
      [],
      { unknown: true },
      { replenishmentAlertsOptInConfirmed: true },
      { amEnabled: 'yes' },
      { amTime: '7:30' },
      { quietStart: 22 },
      { timezone: 'bad timezone' },
      { timezone: 'x'.repeat(129) },
    ];

    for (const patch of invalidPatches) {
      await expect(saveNotifPrefs(patch as Partial<NotifPrefs>)).rejects.toThrow(
        NOTIF_PREFS_INVALID,
      );
    }

    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
  });

  it('returns changed false and performs no write or mirror for semantic no-ops', async () => {
    for (const raw of [currentRaw({ amEnabled: true }), JSON.stringify({ amEnabled: true })]) {
      mocks.storage.set(KEY, raw);

      await expect(saveNotifPrefs({ amEnabled: true })).resolves.toEqual({
        prefs: prefs({ amEnabled: true }),
        changed: false,
      });

      expect(mocks.storage.get(KEY)).toBe(raw);
    }
    await settleMirrors();

    expect(mocks.writes).toBe(0);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('preserves prior bytes and the original error when a write fails before transforming', async () => {
    const original = currentRaw({ amEnabled: true });
    mocks.storage.set(KEY, original);
    mocks.updateFailureBeforeTransform = new Error('PRIVATE_WRITE_FAILED');

    await expect(saveNotifPrefs({ pmEnabled: true })).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
    expect(mocks.writes).toBe(0);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('provides a one-shot non-destructive write-failure fixture for route recovery', async () => {
    const original = currentRaw({ amEnabled: false });
    mocks.storage.set(KEY, original);
    process.env.EXPO_PUBLIC_E2E_NOTIF_PREFS_WRITE_FAILURE = 'once';
    vi.stubGlobal('__DEV__', true);
    try {
      await expect(saveNotifPrefs({ amEnabled: true })).rejects.toThrow(
        'E2E_NOTIF_PREFS_WRITE_FAILURE',
      );
      expect(mocks.storage.get(KEY)).toBe(original);
      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();

      await expect(saveNotifPrefs({ amEnabled: true })).resolves.toMatchObject({
        changed: true,
        prefs: { amEnabled: true },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('recovers commit-response loss only from the exact expected readback', async () => {
    mocks.storage.set(KEY, currentRaw());
    mocks.updateFailureAfterCommit = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');

    const result = await saveNotifPrefs({ pmEnabled: true });
    await settleMirrors();

    expect(result).toEqual({ prefs: prefs({ pmEnabled: true }), changed: true });
    expect(storedPrefs()).toMatchObject({ pmEnabled: true });
    expect(privateKV.readPrivateItem).toHaveBeenCalledTimes(1);
    expect(mocks.writes).toBe(1);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ pm_reminder_enabled: true }),
    );
  });

  it('confirms a semantic legacy no-op against the exact plaintext returned to privateKV', async () => {
    const legacy = JSON.stringify({ amEnabled: true });
    mocks.storage.set(KEY, legacy);
    mocks.updateFailureAfterCommit = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');

    await expect(saveNotifPrefs({ amEnabled: true })).resolves.toEqual({
      prefs: prefs({ amEnabled: true }),
      changed: false,
    });

    expect(mocks.storage.get(KEY)).toBe(legacy);
    expect(privateKV.readPrivateItem).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('reports write uncertainty when readback does not exactly match the desired envelope', async () => {
    const original = currentRaw();
    mocks.storage.set(KEY, original);
    mocks.updateFailureAfterTransform = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');

    await expect(saveNotifPrefs({ pmEnabled: true })).rejects.toThrow(NOTIF_PREFS_WRITE_UNCERTAIN);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(privateKV.readPrivateItem).toHaveBeenCalledTimes(1);
    expect(mocks.writes).toBe(0);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('reports write uncertainty when commit-loss readback is unavailable', async () => {
    const original = currentRaw();
    mocks.storage.set(KEY, original);
    mocks.updateFailureAfterTransform = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');
    mocks.readOverride = { status: 'unavailable', reason: 'content_key_missing' };

    await expect(saveNotifPrefs({ pmEnabled: true })).rejects.toThrow(NOTIF_PREFS_WRITE_UNCERTAIN);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(privateKV.readPrivateItem).toHaveBeenCalledTimes(1);
    expect(mocks.writes).toBe(0);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('preserves account-generation invalidation when confirmation read crosses a boundary', async () => {
    mocks.storage.set(KEY, currentRaw());
    mocks.updateFailureAfterTransform = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');
    vi.mocked(privateKV.readPrivateItem).mockImplementationOnce(async () => {
      beginAccountGenerationBoundary();
      boundaryActive = true;
      throw new Error('READ_ABORTED');
    });

    await expect(saveNotifPrefs({ pmEnabled: true })).rejects.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });

    expect(mocks.storage.get(KEY)).toBe(currentRaw());
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('serializes 100 atomic desired-state edits without losing any field', async () => {
    mocks.storage.set(KEY, currentRaw());
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const desired = [
      ['amEnabled', true],
      ['pmEnabled', true],
      ['streakNudges', true],
      ['replenishmentAlerts', true],
      ['captureReminders', true],
      ['liveActivityEnabled', true],
      ['promotionalOptIn', true],
    ] as const;
    const edits = Array.from({ length: 100 }, (_, index) => {
      const [key, value] = desired[index % desired.length]!;
      return { [key]: value } as Partial<NotifPrefs>;
    });

    const results = await Promise.all(edits.map((patch) => saveNotifPrefs(patch)));
    await settleMirrors();

    expect(results.filter((result) => result.changed)).toHaveLength(desired.length);
    await expect(readNotifPrefs()).resolves.toMatchObject({
      status: 'available',
      prefs: Object.fromEntries(desired),
    });
    expect(mocks.writes).toBe(desired.length);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('keeps same-owner mirrors in local commit order', async () => {
    mocks.storage.set(KEY, currentRaw());
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    mocks.upsertAbortSignal
      .mockImplementationOnce(async () => {
        markFirstStarted();
        await firstGate;
        return { error: null };
      })
      .mockResolvedValue({ error: null });

    await saveNotifPrefs({ amEnabled: true });
    await firstStarted;
    await saveNotifPrefs({ pmEnabled: true });

    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    releaseFirst();
    await settleMirrors();

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ am_reminder_enabled: true, pm_reminder_enabled: false }),
    );
    expect(mocks.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ am_reminder_enabled: true, pm_reminder_enabled: true }),
    );
  });

  it('does not publish an old preference mirror after an account boundary begins', async () => {
    let releaseUser!: () => void;
    let markUserStarted!: () => void;
    const userGate = new Promise<void>((resolve) => {
      releaseUser = resolve;
    });
    const userStarted = new Promise<void>((resolve) => {
      markUserStarted = resolve;
    });
    mocks.getUser.mockImplementationOnce(async () => {
      markUserStarted();
      await userGate;
      return { data: { user: { id: 'user-1' } }, error: null };
    });

    await saveNotifPrefs({ amEnabled: true });
    await userStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseUser();
    await waitForAccountGenerationOperationsToSettle();
    endAccountGenerationBoundary();
    boundaryActive = false;

    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
