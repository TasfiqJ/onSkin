import * as React from 'react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { PHOTO_COPY } from './copy';
import { PhotoDeleteReplay } from './PhotoDeleteReplay';
import { PhotoDeleteSyncStatus } from './PhotoDeleteSyncStatus';

const mocks = vi.hoisted(() => ({
  owner: 'owner-a',
  appState: 'active',
  status: { localPending: 0, remotePending: 0, needsAttention: false },
  retry: vi.fn(),
  readStatus: vi.fn(),
  appListeners: new Set<(state: string) => void>(),
  journalListeners: new Set<() => void>(),
}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  AppState: {
    get currentState() {
      return mocks.appState;
    },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.appListeners.add(listener);
      return {
        remove: () => {
          mocks.appListeners.delete(listener);
        },
      };
    },
  },
}));
vi.mock('@/components/ui', () => ({ Text: 'Text' }));
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ user: mocks.owner ? { id: mocks.owner } : null }),
}));
vi.mock('./store', () => ({
  retryPhotoDeletes: mocks.retry,
  getPhotoDeleteStatus: mocks.readStatus,
}));
vi.mock('./photoDeleteJournal', () => ({
  subscribePhotoDeleteChanges: (listener: () => void) => {
    mocks.journalListeners.add(listener);
    return () => {
      mocks.journalListeners.delete(listener);
    };
  },
}));
let renderer: ReactTestRenderer | null;
let client: QueryClient;
async function flush(work: () => void = () => undefined) {
  await act(async () => {
    work();
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });
}
function renderNode(node: React.ReactNode) {
  return React.createElement(QueryClientProvider, { client }, node);
}
async function mount(node: React.ReactNode) {
  await flush(() => {
    renderer = create(renderNode(node));
  });
}
function text(node: ReactTestInstance | string | number): string {
  return typeof node === 'object'
    ? node.children.map((child) => text(child as ReactTestInstance | string | number)).join(' ')
    : String(node);
}
function visible() {
  return renderer ? text(renderer.root) : '';
}
function button(label: string) {
  const matches = renderer!.root.findAll(
    (node) => (node.type as unknown) === 'Pressable' && text(node) === label,
  );
  expect(matches, visible()).toHaveLength(1);
  return matches[0]!;
}
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function grant(owner = mocks.owner) {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  await flush(() => setActiveHealthProcessingEpoch(1, { ownerUserId: owner, accountGeneration }));
}
async function appState(state: string) {
  await flush(() => {
    mocks.appState = state;
    for (const listener of mocks.appListeners) listener(state);
  });
}
async function changedJournal() {
  await flush(() => {
    for (const listener of mocks.journalListeners) listener();
  });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  renderer = null;
  mocks.owner = 'owner-a';
  mocks.appState = 'active';
  mocks.appListeners.clear();
  mocks.journalListeners.clear();
  mocks.status = { localPending: 0, remotePending: 0, needsAttention: false };
  mocks.retry.mockReset().mockResolvedValue(undefined);
  mocks.readStatus.mockReset().mockImplementation(async () => ({ ...mocks.status }));
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  onlineManager.setOnline(true);
  clearActiveHealthProcessingEpoch();
  await grant();
});
afterEach(async () => {
  if (renderer) await flush(() => renderer?.unmount());
  renderer = null;
  client.clear();
  clearActiveHealthProcessingEpoch();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe.sequential('C-08B2 visible deletion recovery and live replay wiring', () => {
  it('shows aggregate pending account cleanup without exposing IDs or device paths', async () => {
    mocks.status.remotePending = 1;
    await mount(React.createElement(PhotoDeleteSyncStatus));
    expect(visible()).toContain(PHOTO_COPY.deleteSync.savedTitle);
    expect(visible()).toContain(PHOTO_COPY.deleteSync.retry);
    expect(visible()).not.toContain('owner-a');
    expect(visible()).not.toContain('file:');
  });

  it('retries visibly in one flight, then removes completed status', async () => {
    mocks.status.localPending = 1;
    const pending = deferred();
    mocks.retry.mockImplementation(async () => {
      await pending.promise;
      mocks.status = { localPending: 0, remotePending: 0, needsAttention: false };
    });
    await mount(React.createElement(PhotoDeleteSyncStatus));
    const retry = button(PHOTO_COPY.deleteSync.retry).props.onPress as () => void;
    await flush(() => {
      retry();
      retry();
    });
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(mocks.retry).toHaveBeenCalledWith('owner-a');
    expect(button(PHOTO_COPY.deleteSync.retrying).props.disabled).toBe(true);
    pending.resolve();
    await flush();
    expect(visible()).not.toContain(PHOTO_COPY.deleteSync.retry);
  });

  it('checks unreadable status without blindly issuing deletion or remote replay', async () => {
    mocks.readStatus.mockRejectedValueOnce(new Error('PRIVATE_STORE_UNREADABLE'));
    await mount(React.createElement(PhotoDeleteSyncStatus));
    expect(visible()).toContain(PHOTO_COPY.deleteSync.unavailableTitle);
    await flush(() => button(PHOTO_COPY.deleteSync.checkAgain).props.onPress());
    expect(mocks.retry).not.toHaveBeenCalled();
    expect(visible()).not.toContain(PHOTO_COPY.deleteSync.unavailableTitle);
  });

  it('keeps failed manual replay available rather than claiming the account row was removed', async () => {
    mocks.status.remotePending = 1;
    mocks.retry.mockRejectedValueOnce(new Error('OFFLINE'));
    await mount(React.createElement(PhotoDeleteSyncStatus));
    await flush(() => button(PHOTO_COPY.deleteSync.retry).props.onPress());
    expect(visible()).toContain(PHOTO_COPY.deleteSync.attentionTitle);
    expect(button(PHOTO_COPY.deleteSync.retry).props.disabled).toBe(false);
  });

  it('does not adopt a stale visible retry or late completion into a new owner lease', async () => {
    mocks.status.remotePending = 1;
    const pending = deferred();
    mocks.retry.mockReturnValueOnce(pending.promise);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await mount(React.createElement(PhotoDeleteSyncStatus));
    const stale = button(PHOTO_COPY.deleteSync.retry).props.onPress as () => void;
    await flush(() => stale());
    mocks.owner = 'owner-b';
    mocks.status.remotePending = 0;
    await grant('owner-b');
    await flush(() => stale());
    pending.resolve();
    await flush();
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(visible()).not.toContain(PHOTO_COPY.deleteSync.savedTitle);
  });

  it('does not start while closed and wakes only after current health authority becomes available', async () => {
    await flush(() => clearActiveHealthProcessingEpoch());
    await mount(React.createElement(PhotoDeleteReplay));
    expect(mocks.retry).not.toHaveBeenCalled();
    await grant();
    expect(mocks.retry).toHaveBeenCalledWith('owner-a', false);
  });

  it('keeps offline work local and dispatches authenticated intent after an online transition', async () => {
    vi.useFakeTimers();
    onlineManager.setOnline(false);
    mocks.status.remotePending = 1;
    await mount(React.createElement(PhotoDeleteReplay));
    expect(mocks.retry.mock.calls).toEqual([[null, false]]);
    await flush(() => {
      onlineManager.setOnline(true);
    });
    expect(mocks.retry.mock.calls[1]).toEqual(['owner-a', false]);
  });

  it('uses bounded retry after failure and cancels its timer in the background', async () => {
    vi.useFakeTimers();
    mocks.retry.mockRejectedValue(new Error('OFFLINE'));
    await mount(React.createElement(PhotoDeleteReplay));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    await flush(() => vi.advanceTimersByTime(999));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    await flush(() => vi.advanceTimersByTime(1));
    expect(mocks.retry).toHaveBeenCalledTimes(2);
    await appState('background');
    await flush(() => vi.advanceTimersByTime(120_000));
    expect(mocks.retry).toHaveBeenCalledTimes(2);
    await appState('active');
    expect(mocks.retry).toHaveBeenCalledTimes(3);
  });

  it('reacts to durable journal changes and invalidates photo publication', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await mount(React.createElement(PhotoDeleteReplay));
    await changedJournal();
    expect(mocks.retry).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['photos'] });
  });

  it('does not reschedule old-owner work after health loss, regrant or unmount', async () => {
    vi.useFakeTimers();
    mocks.status.remotePending = 1;
    const old = deferred();
    mocks.retry.mockReturnValueOnce(old.promise);
    await mount(React.createElement(PhotoDeleteReplay));
    await flush(() => clearActiveHealthProcessingEpoch());
    old.resolve();
    await flush();
    await flush(() => vi.advanceTimersByTime(120_000));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    mocks.owner = 'owner-b';
    mocks.status.remotePending = 0;
    await flush(() => renderer!.update(renderNode(React.createElement(PhotoDeleteReplay))));
    await grant('owner-b');
    expect(mocks.retry).toHaveBeenLastCalledWith('owner-b', false);
    await flush(() => renderer!.unmount());
    renderer = null;
    const count = mocks.retry.mock.calls.length;
    await flush(() => vi.advanceTimersByTime(120_000));
    expect(mocks.retry).toHaveBeenCalledTimes(count);
  });

  it('does not automatically spin on a permanent account cleanup disposition', async () => {
    vi.useFakeTimers();
    mocks.status = { localPending: 0, remotePending: 1, needsAttention: true };
    await mount(React.createElement(PhotoDeleteReplay));
    await flush(() => vi.advanceTimersByTime(120_000));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(mocks.retry).toHaveBeenCalledWith('owner-a', false);
  });

  it('uses only local cleanup while signed out, including foreground and journal retries', async () => {
    mocks.owner = '';
    await grant('local-owner');
    await mount(React.createElement(PhotoDeleteReplay));
    await changedJournal();
    await appState('background');
    await appState('active');
    expect(mocks.retry.mock.calls.length).toBeGreaterThan(1);
    expect(mocks.retry.mock.calls.every(([owner]) => owner === null)).toBe(true);
  });

  it('starts a fresh visible retry flight for a new owner while an obsolete flight is still pending', async () => {
    mocks.status.remotePending = 1;
    const old = deferred();
    mocks.retry.mockReturnValueOnce(old.promise);
    await mount(React.createElement(PhotoDeleteSyncStatus));
    const stale = button(PHOTO_COPY.deleteSync.retry).props.onPress as () => void;
    await flush(() => stale());
    mocks.owner = 'owner-b';
    await grant('owner-b');
    expect(button(PHOTO_COPY.deleteSync.retry).props.disabled).toBe(false);
    await flush(() => button(PHOTO_COPY.deleteSync.retry).props.onPress());
    expect(mocks.retry.mock.calls).toEqual([['owner-a'], ['owner-b']]);
    await flush(() => stale());
    old.resolve();
    await flush();
    expect(mocks.retry).toHaveBeenCalledTimes(2);
    expect(button(PHOTO_COPY.deleteSync.retry).props.disabled).toBe(false);
  });
});

describe.sequential('C-08B2-R3 deletion recovery accessibility', () => {
  it.each(['local-attention', 'remote-attention', 'unavailable'])(
    'exposes a single live alert for %s, stable action name, and busy/disabled state',
    async (kind) => {
      const pending = deferred();
      if (kind === 'unavailable') mocks.readStatus.mockRejectedValueOnce(new Error('UNAVAILABLE'));
      else if (kind === 'local-attention') mocks.status.localPending = 1;
      else {
        mocks.status.remotePending = 1;
        mocks.status.needsAttention = true;
      }
      await mount(React.createElement(PhotoDeleteSyncStatus));
      const alerts = () =>
        renderer!.root.findAll((node) => node.props.accessibilityRole === 'alert');
      expect(alerts()).toHaveLength(1);
      expect(alerts()[0]!.props.accessibilityLiveRegion).toBe('polite');
      const label =
        kind === 'unavailable' ? PHOTO_COPY.deleteSync.checkAgain : PHOTO_COPY.deleteSync.retry;
      const action = button(label);
      expect(action.props.accessibilityLabel).toBe(label);
      if (kind === 'unavailable')
        mocks.readStatus.mockImplementationOnce(async () => {
          await pending.promise;
          return { ...mocks.status };
        });
      else mocks.retry.mockReturnValueOnce(pending.promise);
      await flush(() => action.props.onPress());
      expect(alerts()).toHaveLength(1);
      expect(alerts()[0]!.props.accessibilityState).toEqual({ busy: true });
      const busy = button(PHOTO_COPY.deleteSync.retrying);
      expect(busy.props.accessibilityLabel).toBe(label);
      expect(busy.props.accessibilityState).toEqual({ disabled: true, busy: true });
      expect(
        renderer!.root.findAll((node) => node.props.accessibilityRole === 'progressbar'),
      ).toHaveLength(0);
      pending.resolve();
      await flush();
    },
  );
});
