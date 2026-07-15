import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import { ASK_TRIAL_GROUNDED_CAP } from './gate';
import {
  clearAskStore,
  getAskConsentLocal,
  getGroundedTurns,
  recordGroundedTurn,
  setAskConsentLocal,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  readFailures: new Map<string, Error>(),
  updateFailures: new Map<string, Error>(),
  writes: 0,
  readGate: null as Promise<void> | null,
  readStarted: null as (() => void) | null,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => {
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
      } finally {
        release();
        if (mocks.tails.get(key) === ownTail) mocks.tails.delete(key);
      }
    },
  ),
}));

const TURNS_KEY = 'onskin.ask.groundedTurns.v1';
const CONSENT_KEY = 'onskin.ask.consent.v1';
let accountGeneration = 0;

async function openHealthProcessing(ownerUserId = 'user-a', epoch = 1): Promise<void> {
  await runAccountGenerationOperation((lease) => {
    accountGeneration = lease.generation;
  });
  setActiveHealthProcessingEpoch(epoch, { ownerUserId, accountGeneration });
}

function storedTurns(): { version: number; period: string; count: number } {
  return JSON.parse(mocks.storage.get(TURNS_KEY) ?? '{}') as {
    version: number;
    period: string;
    count: number;
  };
}

describe('Ask grounded-turn store', () => {
  beforeEach(async () => {
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readFailures.clear();
    mocks.updateFailures.clear();
    mocks.writes = 0;
    mocks.readGate = null;
    mocks.readStarted = null;
    vi.clearAllMocks();
    clearActiveHealthProcessingEpoch();
    await openHealthProcessing();
  });

  afterEach(() => {
    clearActiveHealthProcessingEpoch();
  });

  it('treats unreadable JSON as unused without deleting the original bytes', async () => {
    const original = '{not-json';
    mocks.storage.set(TURNS_KEY, original);

    await expect(getGroundedTurns('2026-07')).resolves.toBe(0);

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('preserves malformed records and refuses to overwrite them on mutation', async () => {
    const original = JSON.stringify({ period: '2026-13', count: -1 });
    mocks.storage.set(TURNS_KEY, original);

    await expect(getGroundedTurns('2026-07')).resolves.toBe(0);
    await expect(recordGroundedTurn('2026-07')).resolves.toBeUndefined();

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('normalizes legacy whitespace and caps counts in memory without rewriting a read', async () => {
    const original = JSON.stringify({ period: ' 2026-07 ', count: 99 });
    mocks.storage.set(TURNS_KEY, original);

    await expect(getGroundedTurns('2026-07')).resolves.toBe(ASK_TRIAL_GROUNDED_CAP);

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('resets a legacy counter into the versioned envelope for a new billing period', async () => {
    mocks.storage.set(TURNS_KEY, JSON.stringify({ period: '2026-06', count: 3 }));

    await recordGroundedTurn('2026-07');

    expect(storedTurns()).toEqual({
      version: 1,
      period: '2026-07',
      count: 1,
    });
  });

  it('serializes simultaneous grounded turns without losing an increment', async () => {
    await Promise.all(Array.from({ length: 4 }, () => recordGroundedTurn('2026-07')));

    expect(storedTurns()).toEqual({
      version: 1,
      period: '2026-07',
      count: 4,
    });
  });

  it('keeps the atomic counter capped at the trial limit', async () => {
    await Promise.all(
      Array.from({ length: ASK_TRIAL_GROUNDED_CAP + 3 }, () => recordGroundedTurn('2026-07')),
    );

    expect(storedTurns().count).toBe(ASK_TRIAL_GROUNDED_CAP);
  });

  it('preserves future-version bytes and refuses to downgrade them', async () => {
    const original = JSON.stringify({ version: 2, period: '2026-07', count: 2 });
    mocks.storage.set(TURNS_KEY, original);

    await expect(getGroundedTurns('2026-07')).resolves.toBe(0);
    await expect(recordGroundedTurn('2026-07')).resolves.toBeUndefined();

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('does not overwrite state when the private key is unavailable', async () => {
    const original = JSON.stringify({ version: 1, period: '2026-07', count: 2 });
    mocks.storage.set(TURNS_KEY, original);
    mocks.readFailures.set(TURNS_KEY, new Error('PRIVATE_KEY_UNAVAILABLE'));

    await expect(getGroundedTurns('2026-07')).resolves.toBe(0);
    expect(mocks.storage.get(TURNS_KEY)).toBe(original);

    mocks.readFailures.delete(TURNS_KEY);
    mocks.updateFailures.set(TURNS_KEY, new Error('PRIVATE_KEY_UNAVAILABLE'));
    await expect(recordGroundedTurn('2026-07')).resolves.toBeUndefined();

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('leaves the prior counter intact when the atomic write fails', async () => {
    const original = JSON.stringify({ version: 1, period: '2026-07', count: 2 });
    mocks.storage.set(TURNS_KEY, original);
    mocks.updateFailures.set(TURNS_KEY, new Error('PRIVATE_WRITE_FAILED'));

    await expect(recordGroundedTurn('2026-07')).resolves.toBeUndefined();

    expect(mocks.storage.get(TURNS_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('does not persist an invalid requested period', async () => {
    await recordGroundedTurn('2026-99');

    expect(mocks.storage.has(TURNS_KEY)).toBe(false);
  });

  it('does not publish its fail-soft result after close and same-epoch re-grant', async () => {
    mocks.storage.set(
      TURNS_KEY,
      JSON.stringify({ version: 1, period: '2026-07', count: 2 }),
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

    const pending = getGroundedTurns('2026-07');
    await readStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'user-a',
      accountGeneration,
    });
    releaseRead();

    await expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
  });

  it('keeps deletion-only cleanup callable after health processing closes', async () => {
    mocks.storage.set(TURNS_KEY, 'turns');
    mocks.storage.set(CONSENT_KEY, 'v1:1');
    clearActiveHealthProcessingEpoch();

    await expect(clearAskStore()).resolves.toBeUndefined();

    expect(mocks.storage.has(TURNS_KEY)).toBe(false);
    expect(mocks.storage.has(CONSENT_KEY)).toBe(false);
  });
});

describe('Ask consent store', () => {
  beforeEach(async () => {
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readFailures.clear();
    mocks.updateFailures.clear();
    mocks.writes = 0;
    mocks.readGate = null;
    mocks.readStarted = null;
    vi.clearAllMocks();
    clearActiveHealthProcessingEpoch();
    await openHealthProcessing();
  });

  afterEach(() => {
    clearActiveHealthProcessingEpoch();
  });

  it('reads legacy consent grants without repair and writes versioned flags', async () => {
    mocks.storage.set(CONSENT_KEY, 'true');

    await expect(getAskConsentLocal()).resolves.toBe(true);
    expect(mocks.storage.get(CONSENT_KEY)).toBe('true');

    await setAskConsentLocal(false);
    expect(mocks.storage.get(CONSENT_KEY)).toBe('v1:0');
  });

  it('fails closed and preserves malformed ask consent values', async () => {
    mocks.storage.set(CONSENT_KEY, 'yes');

    await expect(getAskConsentLocal()).resolves.toBe(false);

    expect(mocks.storage.get(CONSENT_KEY)).toBe('yes');
  });
});
