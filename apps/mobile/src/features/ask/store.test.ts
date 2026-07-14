import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrivateKVReadResult } from '@/lib/storage/privateKV';

import { ASK_TRIAL_GROUNDED_CAP } from './gate';
import {
  ASK_TURN_CAP_REACHED,
  ASK_TURN_RECORD_INVALID,
  ASK_TURN_RECORD_UNAVAILABLE,
  ASK_TURN_RECORD_UNSUPPORTED_VERSION,
  ASK_TURN_PERIOD_STALE,
  getGroundedTurns,
  readAskConsentLocal,
  readGroundedTurns,
  reserveTrialGroundedTurn as recordGroundedTurn,
  setAskConsentLocal,
  type GroundedTurnOperationId,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  readFailures: new Map<string, Error>(),
  readThrows: new Map<string, Error>(),
  readResults: new Map<string, PrivateKVReadResult>(),
  updateFailures: new Map<string, Error>(),
  updateFailuresAfterCommit: new Map<string, Error>(),
  writes: 0,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => {
    const failure = mocks.readFailures.get(key);
    if (failure) throw failure;
    return mocks.storage.get(key) ?? null;
  }),
  readPrivateItem: vi.fn(async (key: string) => {
    const thrown = mocks.readThrows.get(key);
    if (thrown) throw thrown;
    const failure = mocks.readFailures.get(key);
    if (failure) return { status: 'unavailable', reason: 'storage_unavailable' };
    const override = mocks.readResults.get(key);
    if (override) return override;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
    mocks.writes += 1;
  }),
  multiRemovePrivateItems: vi.fn(async (keys: readonly string[]) => {
    for (const key of keys) mocks.storage.delete(key);
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
        const failureAfterCommit = mocks.updateFailuresAfterCommit.get(key);
        if (failureAfterCommit) throw failureAfterCommit;
      } finally {
        release();
        if (mocks.tails.get(key) === ownTail) mocks.tails.delete(key);
      }
    },
  ),
}));

const TURNS_KEY = 'onskin.ask.groundedTurns.v1';
const CONSENT_KEY = 'onskin.ask.consent.v1';
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

function operationId(index: number): GroundedTurnOperationId {
  return index.toString(16).padStart(32, '0') as GroundedTurnOperationId;
}

function storedTurns(): {
  version: number;
  period: string;
  count: number;
  operationIds: string[];
} {
  return JSON.parse(mocks.storage.get(TURNS_KEY) ?? '{}') as {
    version: number;
    period: string;
    count: number;
    operationIds: string[];
  };
}

describe('Ask grounded-turn store', () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE;
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readFailures.clear();
    mocks.readThrows.clear();
    mocks.readResults.clear();
    mocks.updateFailures.clear();
    mocks.updateFailuresAfterCommit.clear();
    mocks.writes = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('distinguishes genuine absence from an unreadable quota record', async () => {
    await expect(readGroundedTurns('2026-07')).resolves.toEqual({ status: 'absent', count: 0 });
    await expect(getGroundedTurns('2026-07')).resolves.toBe(0);

    const original = '{not-json';
    mocks.storage.set(TURNS_KEY, original);

    await expect(readGroundedTurns('2026-07')).resolves.toEqual({
      status: 'corrupt',
      count: null,
      reason: 'invalid_payload',
    });
    await expect(getGroundedTurns('2026-07')).rejects.toThrow(ASK_TURN_RECORD_INVALID);

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('preserves malformed records and refuses to overwrite them on mutation', async () => {
    const original = JSON.stringify({ period: '2026-13', count: -1 });
    mocks.storage.set(TURNS_KEY, original);

    await expect(readGroundedTurns('2026-07')).resolves.toMatchObject({ status: 'corrupt' });
    await expect(getGroundedTurns('2026-07')).rejects.toThrow(ASK_TURN_RECORD_INVALID);
    await expect(recordGroundedTurn('2026-07', operationId(1))).rejects.toThrow(
      ASK_TURN_RECORD_INVALID,
    );

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('normalizes strict legacy data in memory without rewriting an ordinary read', async () => {
    const original = JSON.stringify({ period: ' 2026-07 ', count: 99 });
    mocks.storage.set(TURNS_KEY, original);

    await expect(readGroundedTurns('2026-07')).resolves.toEqual({
      status: 'available',
      count: ASK_TRIAL_GROUNDED_CAP,
      format: 'legacy',
    });
    await expect(getGroundedTurns('2026-07')).resolves.toBe(ASK_TRIAL_GROUNDED_CAP);

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it.each([
    JSON.stringify({ version: 1, period: ' 2026-07 ', count: 2 }),
    JSON.stringify({ version: 1, period: '2026-07', count: ASK_TRIAL_GROUNDED_CAP + 1 }),
    JSON.stringify({ version: 1, period: '2026-07', count: 2, extra: true }),
    JSON.stringify({ version: 2, period: '2026-07', count: 1, operationIds: ['bad-id'] }),
    JSON.stringify({
      version: 2,
      period: '2026-07',
      count: 1,
      operationIds: [operationId(1), operationId(2)],
    }),
    JSON.stringify({
      version: 2,
      period: '2026-07',
      count: 2,
      operationIds: [operationId(1), operationId(1)],
    }),
    JSON.stringify({ period: '2026-07', count: 2, extra: true }),
  ])('rejects a non-canonical current or malformed legacy record without repair', async (original) => {
    mocks.storage.set(TURNS_KEY, original);

    await expect(readGroundedTurns('2026-07')).resolves.toMatchObject({ status: 'corrupt' });
    await expect(recordGroundedTurn('2026-07', operationId(3))).rejects.toThrow(
      ASK_TURN_RECORD_INVALID,
    );

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('reports a valid record from another month as zero without rewriting it', async () => {
    const original = JSON.stringify({ version: 1, period: '2026-06', count: 3 });
    mocks.storage.set(TURNS_KEY, original);

    await expect(readGroundedTurns('2026-07')).resolves.toEqual({
      status: 'available',
      count: 0,
      format: 'legacy_v1',
    });

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('rejects a backward-period read or reservation without replacing the newer month', async () => {
    const original = JSON.stringify({
      version: 2,
      period: '2026-07',
      count: 2,
      operationIds: [operationId(1), operationId(2)],
    });
    mocks.storage.set(TURNS_KEY, original);

    await expect(readGroundedTurns('2026-06')).resolves.toEqual({
      status: 'stale_period',
      count: null,
      storedPeriod: '2026-07',
    });
    await expect(getGroundedTurns('2026-06')).rejects.toThrow(ASK_TURN_PERIOD_STALE);
    await expect(recordGroundedTurn('2026-06', operationId(3))).rejects.toThrow(
      ASK_TURN_PERIOD_STALE,
    );

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('reads a strict v2 operation journal without rewriting it', async () => {
    const original = JSON.stringify({
      version: 2,
      period: '2026-07',
      count: 2,
      operationIds: [operationId(1)],
    });
    mocks.storage.set(TURNS_KEY, original);

    await expect(readGroundedTurns('2026-07')).resolves.toEqual({
      status: 'available',
      count: 2,
      format: 'current',
    });

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('resets a legacy counter into the versioned envelope for a new billing period', async () => {
    mocks.storage.set(TURNS_KEY, JSON.stringify({ period: '2026-06', count: 3 }));

    await expect(recordGroundedTurn('2026-07', operationId(1))).resolves.toBe(1);

    expect(storedTurns()).toEqual({
      version: 2,
      period: '2026-07',
      count: 1,
      operationIds: [operationId(1)],
    });
  });

  it('migrates a same-period v1 count while journaling the new operation identity', async () => {
    mocks.storage.set(TURNS_KEY, JSON.stringify({ version: 1, period: '2026-07', count: 2 }));

    await expect(recordGroundedTurn('2026-07', operationId(3))).resolves.toBe(3);

    expect(storedTurns()).toEqual({
      version: 2,
      period: '2026-07',
      count: 3,
      operationIds: [operationId(3)],
    });
  });

  it('serializes 100 distinct reservations and rejects every operation above the cap', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, (_, index) =>
        recordGroundedTurn('2026-07', operationId(index + 1)),
      ),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      ASK_TRIAL_GROUNDED_CAP,
    );
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
      100 - ASK_TRIAL_GROUNDED_CAP,
    );
    for (const result of results.filter((candidate) => candidate.status === 'rejected')) {
      expect(result.reason).toMatchObject({ message: ASK_TURN_CAP_REACHED });
    }
    expect(storedTurns()).toEqual({
      version: 2,
      period: '2026-07',
      count: ASK_TRIAL_GROUNDED_CAP,
      operationIds: Array.from({ length: ASK_TRIAL_GROUNDED_CAP }, (_, index) =>
        operationId(index + 1),
      ),
    });
    expect(mocks.writes).toBe(ASK_TRIAL_GROUNDED_CAP);
  });

  it('deduplicates only the same durable operation identity', async () => {
    await expect(recordGroundedTurn('2026-07', operationId(1))).resolves.toBe(1);
    await expect(recordGroundedTurn('2026-07', operationId(1))).resolves.toBe(1);
    await expect(recordGroundedTurn('2026-07', operationId(2))).resolves.toBe(2);

    expect(storedTurns().operationIds).toEqual([operationId(1), operationId(2)]);
    expect(mocks.writes).toBe(2);
  });

  it('preserves a full current or legacy record and rejects a distinct operation', async () => {
    for (const original of [
      JSON.stringify({ version: 1, period: '2026-07', count: ASK_TRIAL_GROUNDED_CAP }),
      JSON.stringify({ period: ' 2026-07 ', count: 99 }),
    ]) {
      mocks.storage.set(TURNS_KEY, original);

      await expect(recordGroundedTurn('2026-07', operationId(9))).rejects.toThrow(
        ASK_TURN_CAP_REACHED,
      );

      expect(mocks.storage.get(TURNS_KEY)).toBe(original);
      expect(mocks.writes).toBe(0);
    }
  });

  it('returns the exact full v2 record for a replay without writing', async () => {
    const original = JSON.stringify({
      version: 2,
      period: '2026-07',
      count: ASK_TRIAL_GROUNDED_CAP,
      operationIds: Array.from({ length: ASK_TRIAL_GROUNDED_CAP }, (_, index) =>
        operationId(index + 1),
      ),
    });
    mocks.storage.set(TURNS_KEY, original);

    await expect(recordGroundedTurn('2026-07', operationId(3))).resolves.toBe(
      ASK_TRIAL_GROUNDED_CAP,
    );

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('preserves future-version bytes and refuses to downgrade them', async () => {
    const original = JSON.stringify({
      version: 3,
      period: '2026-07',
      count: 2,
      operationIds: [operationId(1)],
    });
    mocks.storage.set(TURNS_KEY, original);

    await expect(readGroundedTurns('2026-07')).resolves.toEqual({
      status: 'unsupported_version',
      count: null,
    });
    await expect(getGroundedTurns('2026-07')).rejects.toThrow(
      ASK_TURN_RECORD_UNSUPPORTED_VERSION,
    );
    await expect(recordGroundedTurn('2026-07', operationId(2))).rejects.toThrow(
      ASK_TURN_RECORD_UNSUPPORTED_VERSION,
    );

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it.each([
    [
      { status: 'unavailable', reason: 'content_key_missing' } as const,
      { status: 'unavailable', count: null, reason: 'content_key_missing' },
      ASK_TURN_RECORD_UNAVAILABLE,
    ],
    [
      { status: 'corrupt', reason: 'decryption_failed' } as const,
      { status: 'corrupt', count: null, reason: 'decryption_failed' },
      ASK_TURN_RECORD_INVALID,
    ],
    [
      { status: 'unsupported_version' } as const,
      { status: 'unsupported_version', count: null },
      ASK_TURN_RECORD_UNSUPPORTED_VERSION,
    ],
  ])('forwards private-envelope status %# without inventing an empty allowance', async (stored, expected, code) => {
    mocks.readResults.set(TURNS_KEY, stored);

    await expect(readGroundedTurns('2026-07')).resolves.toEqual(expected);
    await expect(getGroundedTurns('2026-07')).rejects.toThrow(code);
  });

  it('maps an unexpected private read rejection to unavailable without changing bytes', async () => {
    const original = JSON.stringify({ version: 1, period: '2026-07', count: 2 });
    mocks.storage.set(TURNS_KEY, original);
    mocks.readThrows.set(TURNS_KEY, new Error('PRIVATE_KEY_UNAVAILABLE'));

    await expect(readGroundedTurns('2026-07')).resolves.toEqual({
      status: 'unavailable',
      count: null,
      reason: 'storage_unavailable',
    });
    await expect(getGroundedTurns('2026-07')).rejects.toThrow(ASK_TURN_RECORD_UNAVAILABLE);

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('propagates a failed atomic write and leaves the prior counter intact', async () => {
    const original = JSON.stringify({ version: 1, period: '2026-07', count: 2 });
    mocks.storage.set(TURNS_KEY, original);
    mocks.updateFailures.set(TURNS_KEY, new Error('PRIVATE_WRITE_FAILED'));

    await expect(recordGroundedTurn('2026-07', operationId(3))).rejects.toThrow(
      'PRIVATE_WRITE_FAILED',
    );

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('reconciles a committed write whose response was lost without double-counting', async () => {
    mocks.updateFailuresAfterCommit.set(TURNS_KEY, new Error('PRIVATE_WRITE_RESULT_UNKNOWN'));

    await expect(recordGroundedTurn('2026-07', operationId(1))).resolves.toBe(1);
    expect(storedTurns().count).toBe(1);

    mocks.updateFailuresAfterCommit.clear();
    await expect(recordGroundedTurn('2026-07', operationId(1))).resolves.toBe(1);

    expect(storedTurns().count).toBe(1);
    expect(storedTurns().operationIds).toEqual([operationId(1)]);
    expect(mocks.writes).toBe(1);
  });

  it('uses the same operation identity to retry when commit confirmation is unavailable', async () => {
    mocks.updateFailuresAfterCommit.set(TURNS_KEY, new Error('PRIVATE_WRITE_RESULT_UNKNOWN'));
    mocks.readFailures.set(TURNS_KEY, new Error('PRIVATE_READ_UNAVAILABLE'));

    await expect(recordGroundedTurn('2026-07', operationId(1))).rejects.toThrow(
      'PRIVATE_WRITE_RESULT_UNKNOWN',
    );
    expect(storedTurns().count).toBe(1);

    mocks.updateFailuresAfterCommit.clear();
    mocks.readFailures.clear();
    await expect(recordGroundedTurn('2026-07', operationId(1))).resolves.toBe(1);

    expect(storedTurns().count).toBe(1);
    expect(mocks.writes).toBe(1);
  });

  it('rejects invalid periods and operation identities before doing storage I/O', async () => {
    await expect(readGroundedTurns('2026-99')).rejects.toThrow(ASK_TURN_RECORD_INVALID);
    await expect(recordGroundedTurn('2026-99', operationId(1))).rejects.toThrow(
      ASK_TURN_RECORD_INVALID,
    );
    await expect(
      recordGroundedTurn('2026-07', 'NOT-A-DURABLE-ID' as GroundedTurnOperationId),
    ).rejects.toThrow(ASK_TURN_RECORD_INVALID);

    expect(mocks.storage.has(TURNS_KEY)).toBe(false);
    expect(mocks.writes).toBe(0);
  });

  it('exposes development-only persistent, one-shot, and future-state fixtures', async () => {
    runtime.__DEV__ = true;

    process.env.EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE = 'always';
    await expect(readGroundedTurns('2026-07')).resolves.toMatchObject({ status: 'unavailable' });

    process.env.EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE = 'future';
    await expect(readGroundedTurns('2026-07')).resolves.toEqual({
      status: 'unsupported_version',
      count: null,
    });

    process.env.EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE = 'once';
    await expect(readGroundedTurns('2026-07')).resolves.toMatchObject({ status: 'unavailable' });
    await expect(readGroundedTurns('2026-07')).resolves.toEqual({ status: 'absent', count: 0 });
  });

  it('ignores the development fixture in a production build', async () => {
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE = 'always';

    await expect(readGroundedTurns('2026-07')).resolves.toEqual({ status: 'absent', count: 0 });
  });
});

describe('Ask consent store', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readFailures.clear();
    mocks.readThrows.clear();
    mocks.readResults.clear();
    mocks.updateFailures.clear();
    mocks.updateFailuresAfterCommit.clear();
    mocks.writes = 0;
    vi.clearAllMocks();
  });

  it('reads legacy consent grants without repair and writes versioned flags', async () => {
    mocks.storage.set(CONSENT_KEY, 'true');

    await expect(readAskConsentLocal()).resolves.toEqual({
      status: 'available',
      value: true,
      format: 'legacy',
    });
    expect(mocks.storage.get(CONSENT_KEY)).toBe('true');

    await setAskConsentLocal(false);
    expect(mocks.storage.get(CONSENT_KEY)).toBe('v1:0');
  });

  it('classifies and preserves malformed ask consent values', async () => {
    mocks.storage.set(CONSENT_KEY, 'yes');

    await expect(readAskConsentLocal()).resolves.toEqual({
      status: 'corrupt',
      reason: 'invalid_value',
    });

    expect(mocks.storage.get(CONSENT_KEY)).toBe('yes');
  });

  it('does not turn private storage unavailability into an ordinary Ask decline', async () => {
    mocks.readFailures.set(CONSENT_KEY, new Error('PRIVATE_KEY_UNAVAILABLE'));

    await expect(readAskConsentLocal()).resolves.toEqual({
      status: 'unavailable',
      reason: 'storage_unavailable',
    });
  });
});
