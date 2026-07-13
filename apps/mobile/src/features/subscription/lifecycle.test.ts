import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import * as privateKV from '@/lib/storage/privateKV';

import {
  acknowledgeLifecyclePromptPresented,
  pendingLifecycleRoute,
  type LifecyclePrompt,
} from './lifecycle';

const mocks = vi.hoisted(() => ({
  entitlement: null as null | Record<string, unknown>,
  loadEntitlement: vi.fn(),
  physicalWrites: 0,
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as 'before' | 'after' | null,
  updateBlocker: null as Promise<void> | null,
  uuidCounter: 0,
  randomUUID: vi.fn(() => {
    const tail = (++mocks.uuidCounter).toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${tail}`;
  }),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: mocks.randomUUID,
}));

vi.mock('./store', () => ({
  loadEntitlement: mocks.loadEntitlement,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
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
        const blocker = mocks.updateBlocker;
        mocks.updateBlocker = null;
        if (blocker) await blocker;
        if (mocks.updateFailure === 'before') throw new Error('storage unavailable');
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (next !== current) {
          mocks.physicalWrites += 1;
          if (next === null) mocks.storage.delete(key);
          else mocks.storage.set(key, next);
        }
        if (mocks.updateFailure === 'after') throw new Error('native post-commit rejection');
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'onskin.subscription.promptedExpiry';
const NOW = '2026-07-12T12:00:00.000Z';
const EXPIRES_AT = '2026-07-11T12:00:00.000Z';
const REPLAY_PROMPT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PREVIOUS_SESSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function entitlement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tier: 'pro',
    isActive: false,
    expiresAt: EXPIRES_AT,
    periodType: 'reverse_trial',
    ...overrides,
  };
}

function storedEnvelope(): Record<string, unknown> {
  return JSON.parse(mocks.storage.get(KEY) ?? '{}') as Record<string, unknown>;
}

function preparedEnvelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 2,
    expiresAt: EXPIRES_AT,
    route: '/paywall/reoffer',
    promptId: REPLAY_PROMPT_ID,
    deliverySessionId: PREVIOUS_SESSION_ID,
    phase: 'prepared',
    ...overrides,
  });
}

describe('subscription expiry lifecycle prompt', () => {
  let boundaryActive = false;

  beforeEach(() => {
    mocks.entitlement = entitlement();
    mocks.loadEntitlement.mockReset().mockImplementation(async () => mocks.entitlement);
    mocks.physicalWrites = 0;
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.updateBlocker = null;
    vi.mocked(privateKV.getPrivateItem).mockClear();
    vi.mocked(privateKV.updatePrivateItem).mockClear();
  });

  afterEach(() => {
    if (!boundaryActive) return;
    endAccountGenerationBoundary();
    boundaryActive = false;
  });

  it('durably prepares a reverse-trial prompt without marking it presented', async () => {
    const prompt = await pendingLifecycleRoute(NOW);

    expect(prompt).toEqual({
      promptId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      route: '/paywall/reoffer',
    });
    expect(storedEnvelope()).toEqual({
      version: 2,
      expiresAt: EXPIRES_AT,
      route: '/paywall/reoffer',
      promptId: prompt?.promptId,
      deliverySessionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      phase: 'prepared',
    });
    expect(mocks.physicalWrites).toBe(1);
  });

  it('suppresses duplicate delivery attempts in the same JS process', async () => {
    await expect(pendingLifecycleRoute(NOW)).resolves.toMatchObject({
      route: '/paywall/reoffer',
    });
    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();

    expect(storedEnvelope().phase).toBe('prepared');
    expect(mocks.physicalWrites).toBe(1);
  });

  it('reoffers an unacknowledged prepared prompt after a new JS process', async () => {
    mocks.storage.set(KEY, preparedEnvelope());

    await expect(pendingLifecycleRoute(NOW)).resolves.toEqual({
      promptId: REPLAY_PROMPT_ID,
      route: '/paywall/reoffer',
    });

    const replayed = storedEnvelope();
    expect(replayed.phase).toBe('prepared');
    expect(replayed.promptId).toBe(REPLAY_PROMPT_ID);
    expect(replayed.deliverySessionId).not.toBe(PREVIOUS_SESSION_ID);
    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
  });

  it('acknowledges presentation only for the exact prompt and route', async () => {
    const prompt = (await pendingLifecycleRoute(NOW)) as LifecyclePrompt;

    await expect(acknowledgeLifecyclePromptPresented(prompt)).resolves.toBe(true);
    expect(storedEnvelope().phase).toBe('presented');
    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();

    const settled = mocks.storage.get(KEY);
    await expect(
      acknowledgeLifecyclePromptPresented({
        promptId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        route: '/paywall/reoffer',
      }),
    ).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(settled);
  });

  it('routes a lapsed paid period to graceful downgrade', async () => {
    mocks.entitlement = entitlement({ periodType: 'normal' });

    await expect(pendingLifecycleRoute(NOW)).resolves.toMatchObject({
      route: '/paywall/downgrade',
    });
    expect(storedEnvelope()).toMatchObject({
      route: '/paywall/downgrade',
      phase: 'prepared',
    });
  });

  it('does not reserve or route an active unexpired entitlement', async () => {
    mocks.entitlement = entitlement({
      isActive: true,
      expiresAt: '2026-07-13T12:00:00.000Z',
    });

    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('serializes simultaneous callers so only one receives the delivery', async () => {
    const prompts = await Promise.all([pendingLifecycleRoute(NOW), pendingLifecycleRoute(NOW)]);

    expect(prompts.filter(Boolean)).toHaveLength(1);
    expect(prompts.filter(Boolean)[0]).toMatchObject({ route: '/paywall/reoffer' });
    expect(mocks.physicalWrites).toBe(1);
  });

  it('accepts reservation commit-then-reject only after exact readback', async () => {
    mocks.updateFailure = 'after';

    await expect(pendingLifecycleRoute(NOW)).resolves.toMatchObject({
      route: '/paywall/reoffer',
    });
    expect(storedEnvelope().phase).toBe('prepared');
    expect(privateKV.getPrivateItem).toHaveBeenCalledWith(KEY);
  });

  it('does not route a commit-then-reject reservation when exact readback disagrees', async () => {
    mocks.updateFailure = 'after';
    vi.mocked(privateKV.getPrivateItem).mockResolvedValueOnce(
      preparedEnvelope({ promptId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }),
    );

    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
    expect(storedEnvelope().phase).toBe('prepared');
  });

  it('accepts acknowledgement commit-then-reject only after exact readback', async () => {
    const prompt = (await pendingLifecycleRoute(NOW)) as LifecyclePrompt;
    mocks.updateFailure = 'after';

    await expect(acknowledgeLifecyclePromptPresented(prompt)).resolves.toBe(true);
    expect(storedEnvelope().phase).toBe('presented');
    expect(privateKV.getPrivateItem).toHaveBeenCalledWith(KEY);
  });

  it('keeps a pre-commit reservation failure retryable and does not route', async () => {
    mocks.updateFailure = 'before';

    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('cancels a delayed presentation acknowledgement at an account boundary', async () => {
    const prompt = (await pendingLifecycleRoute(NOW)) as LifecyclePrompt;
    let releaseUpdate!: () => void;
    mocks.updateBlocker = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });

    const acknowledgement = acknowledgeLifecyclePromptPresented(prompt);
    await vi.waitFor(() => expect(privateKV.updatePrivateItem).toHaveBeenCalledTimes(2));

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(acknowledgement).resolves.toBe(false);
    mocks.updateFailure = 'before';
    releaseUpdate();
    await vi.waitFor(() => expect(mocks.tails.size).toBe(0));
    expect(storedEnvelope().phase).toBe('prepared');
    expect(mocks.physicalWrites).toBe(1);
  });

  it('cancels a delayed owner-A entitlement after a boundary without writing or routing', async () => {
    let releaseEntitlement!: () => void;
    mocks.loadEntitlement.mockImplementationOnce(
      () =>
        new Promise<Record<string, unknown> | null>((resolve) => {
          releaseEntitlement = () => resolve(mocks.entitlement);
        }),
    );

    const route = pendingLifecycleRoute(NOW);
    await vi.waitFor(() => expect(mocks.loadEntitlement).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(route).resolves.toBeNull();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.physicalWrites).toBe(0);

    releaseEntitlement();
    await Promise.resolve();
  });

  it('keeps a delayed entitlement valid while the same owner generation remains current', async () => {
    let releaseEntitlement!: () => void;
    mocks.loadEntitlement.mockImplementationOnce(
      () =>
        new Promise<Record<string, unknown> | null>((resolve) => {
          releaseEntitlement = () => resolve(mocks.entitlement);
        }),
    );

    const route = pendingLifecycleRoute(NOW);
    await vi.waitFor(() => expect(mocks.loadEntitlement).toHaveBeenCalledOnce());
    releaseEntitlement();

    await expect(route).resolves.toMatchObject({ route: '/paywall/reoffer' });
    expect(mocks.physicalWrites).toBe(1);
  });

  it('preserves malformed and future prompt state and fails closed', async () => {
    for (const stored of [
      'not-an-iso-date',
      JSON.stringify({ version: 3, expiresAt: '2026-07-10T12:00:00.000Z' }),
    ]) {
      mocks.storage.set(KEY, stored);

      await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
      expect(mocks.storage.get(KEY)).toBe(stored);
      expect(mocks.physicalWrites).toBe(0);
    }
  });

  it('reads equal legacy prompted state without rewriting or presenting it again', async () => {
    for (const legacy of [EXPIRES_AT, JSON.stringify({ version: 1, expiresAt: EXPIRES_AT })]) {
      mocks.storage.set(KEY, legacy);

      await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
      expect(mocks.storage.get(KEY)).toBe(legacy);
      expect(mocks.physicalWrites).toBe(0);
    }
  });

  it('rejects invalid wall-clock and acknowledgement inputs without touching state', async () => {
    await expect(pendingLifecycleRoute('not-a-date')).resolves.toBeNull();
    await expect(
      acknowledgeLifecyclePromptPresented({
        promptId: '../not-opaque',
        route: '/paywall/reoffer',
      }),
    ).resolves.toBe(false);

    expect(mocks.storage.has(KEY)).toBe(false);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });
});
