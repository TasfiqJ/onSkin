import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OfflineSync } from './OfflineSync';

const OFFLINE_SYNC = fileURLToPath(new URL('./OfflineSync.tsx', import.meta.url));

const h = vi.hoisted(() => ({
  appStateListener: null as ((state: string) => void) | null,
  lease: null as
    | Readonly<{
        generation: number;
        epoch: number;
        ownerUserId: string;
        accountGeneration: number;
        expiresAt: null;
      }>
    | null,
  flushCompletions: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: h.invalidateQueries }),
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn((_event: string, listener: (state: string) => void) => {
      h.appStateListener = listener;
      return { remove: vi.fn() };
    }),
  },
}));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingLeaseSnapshot: () => h.lease,
}));
vi.mock('./completionQueue', () => ({
  flushCompletions: h.flushCompletions,
}));

let renderer: ReactTestRenderer | null = null;

async function flushEffects(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  h.appStateListener = null;
  h.lease = null;
  h.flushCompletions.mockReset().mockResolvedValue({ flushed: 1, remaining: 0 });
  h.invalidateQueries.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('OfflineSync health-processing admission', () => {
  it('does not read or flush on mount or foreground while no epoch is active', async () => {
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.flushCompletions).not.toHaveBeenCalled();

    await act(async () => h.appStateListener?.('active'));
    await flushEffects();
    expect(h.flushCompletions).not.toHaveBeenCalled();
    expect(h.invalidateQueries).not.toHaveBeenCalled();
  });

  it('flushes on mount and foreground only while the same active epoch remains current', async () => {
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.flushCompletions).toHaveBeenCalledOnce();
    expect(h.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['completions'] });
    expect(h.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['progress'] });

    await act(async () => h.appStateListener?.('background'));
    expect(h.flushCompletions).toHaveBeenCalledOnce();
    await act(async () => h.appStateListener?.('active'));
    await flushEffects();
    expect(h.flushCompletions).toHaveBeenCalledTimes(2);
  });

  it('does not publish a flush that settles after processing closes', async () => {
    let resolve!: (result: { flushed: number; remaining: number }) => void;
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.flushCompletions.mockReturnValueOnce(
      new Promise((next) => {
        resolve = next;
      }),
    );
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    expect(h.flushCompletions).toHaveBeenCalledOnce();

    h.lease = null;
    resolve({ flushed: 1, remaining: 0 });
    await flushEffects();
    expect(h.invalidateQueries).not.toHaveBeenCalled();
  });

  it('does not publish across an exact numeric epoch owner/generation collision', async () => {
    let resolve!: (result: { flushed: number; remaining: number }) => void;
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.flushCompletions.mockReturnValueOnce(
      new Promise((next) => {
        resolve = next;
      }),
    );
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });

    h.lease = {
      generation: 2,
      epoch: 4,
      ownerUserId: 'owner-b',
      accountGeneration: 1,
      expiresAt: null,
    };
    resolve({ flushed: 1, remaining: 0 });
    await flushEffects();

    expect(h.invalidateQueries).not.toHaveBeenCalled();
  });

  it('refreshes the queries Today actually reads after an admitted completion flush', () => {
    const source = readFileSync(OFFLINE_SYNC, 'utf8');

    expect(source).toContain("invalidateQueries({ queryKey: ['completions'] })");
    expect(source).toContain("invalidateQueries({ queryKey: ['progress'] })");
    expect(source).not.toContain("invalidateQueries({ queryKey: ['today'] })");
  });
});
