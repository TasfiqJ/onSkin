import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ASK_TRIAL_GROUNDED_CAP } from './gate';
import { getAskConsentLocal, getGroundedTurns, recordGroundedTurn, setAskConsentLocal } from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
  multiRemovePrivateItems: vi.fn(async (keys: readonly string[]) => {
    for (const key of keys) mocks.storage.delete(key);
  }),
}));

const TURNS_KEY = 'onskin.ask.groundedTurns.v1';
const CONSENT_KEY = 'onskin.ask.consent.v1';

describe('Ask grounded-turn store', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('removes unreadable grounded-turn JSON and treats the period as unused', async () => {
    mocks.storage.set(TURNS_KEY, '{not-json');

    await expect(getGroundedTurns('2026-07')).resolves.toBe(0);

    expect(mocks.storage.has(TURNS_KEY)).toBe(false);
  });

  it('removes malformed grounded-turn records before the gate reads them', async () => {
    mocks.storage.set(TURNS_KEY, JSON.stringify({ period: '2026-13', count: -1 }));

    await expect(getGroundedTurns('2026-07')).resolves.toBe(0);

    expect(mocks.storage.has(TURNS_KEY)).toBe(false);
  });

  it('normalizes period whitespace and caps oversized local counts to the trial limit', async () => {
    mocks.storage.set(TURNS_KEY, JSON.stringify({ period: ' 2026-07 ', count: 99 }));

    await expect(getGroundedTurns('2026-07')).resolves.toBe(ASK_TRIAL_GROUNDED_CAP);

    expect(JSON.parse(mocks.storage.get(TURNS_KEY) ?? '{}')).toEqual({
      period: '2026-07',
      count: ASK_TRIAL_GROUNDED_CAP,
    });
  });

  it('resets the counter when a new billing period is recorded', async () => {
    mocks.storage.set(TURNS_KEY, JSON.stringify({ period: '2026-06', count: 3 }));

    await recordGroundedTurn('2026-07');

    expect(JSON.parse(mocks.storage.get(TURNS_KEY) ?? '{}')).toEqual({
      period: '2026-07',
      count: 1,
    });
  });

  it('does not persist an invalid requested period', async () => {
    await recordGroundedTurn('2026-99');

    expect(mocks.storage.has(TURNS_KEY)).toBe(false);
  });
});

describe('Ask consent store', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('normalizes legacy consent grants and writes compact canonical flags', async () => {
    mocks.storage.set(CONSENT_KEY, 'true');

    await expect(getAskConsentLocal()).resolves.toBe(true);
    expect(mocks.storage.get(CONSENT_KEY)).toBe('1');

    await setAskConsentLocal(false);
    expect(mocks.storage.get(CONSENT_KEY)).toBe('0');
  });

  it('fails closed and repairs malformed ask consent values', async () => {
    mocks.storage.set(CONSENT_KEY, 'yes');

    await expect(getAskConsentLocal()).resolves.toBe(false);

    expect(mocks.storage.get(CONSENT_KEY)).toBe('0');
  });
});
