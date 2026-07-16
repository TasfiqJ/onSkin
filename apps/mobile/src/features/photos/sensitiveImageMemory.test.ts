import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isSensitiveImageLifecycleActive,
  purgeSensitiveImageMemory,
  subscribeToSensitiveImageLifecycle,
} from './sensitiveImageMemory';

const mocks = vi.hoisted(() => ({
  appState: 'active',
  change: null as ((state: string) => void) | null,
  memoryWarning: null as (() => void) | null,
  clearMemoryCache: vi.fn(async () => true),
  purgeCoordinator: vi.fn(),
}));

vi.mock('expo-image', () => ({
  Image: { clearMemoryCache: mocks.clearMemoryCache },
}));

vi.mock('./sensitiveImageCoordinator', () => ({
  purgeSensitiveImageCoordinator: mocks.purgeCoordinator,
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    get currentState() {
      return mocks.appState;
    },
    addEventListener: vi.fn((event: string, listener: (value: never) => void) => {
      if (event === 'change') {
        mocks.change = (state: string) => {
          mocks.appState = state;
          listener(state as never);
        };
      }
      if (event === 'memoryWarning') mocks.memoryWarning = listener as () => void;
      return { remove: vi.fn() };
    }),
  },
}));

describe('sensitive image memory lifecycle', () => {
  beforeEach(() => {
    mocks.appState = 'active';
    mocks.clearMemoryCache.mockReset();
    mocks.clearMemoryCache.mockResolvedValue(true);
    mocks.purgeCoordinator.mockClear();
  });

  it('purges on inactive/background, memory warning, explicit boundaries, and resumes once active', async () => {
    const events: string[] = [];
    const unsubscribe = subscribeToSensitiveImageLifecycle((event) => events.push(event));

    mocks.change?.('inactive');
    await vi.waitFor(() => expect(mocks.clearMemoryCache).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    mocks.change?.('active');
    await vi.waitFor(() => expect(events).toEqual(['purge', 'resume']));
    mocks.memoryWarning?.();
    await vi.waitFor(() => expect(mocks.clearMemoryCache).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await purgeSensitiveImageMemory();

    expect(events).toEqual(['purge', 'resume', 'purge', 'resume', 'purge', 'resume']);
    expect(mocks.clearMemoryCache).toHaveBeenCalledTimes(3);
    expect(mocks.purgeCoordinator).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it('fails closed when the first image subscriber mounts while already inactive', async () => {
    mocks.appState = 'inactive';
    const events: string[] = [];

    expect(isSensitiveImageLifecycleActive()).toBe(false);
    const unsubscribe = subscribeToSensitiveImageLifecycle((event) => events.push(event));

    await vi.waitFor(() => expect(mocks.clearMemoryCache).toHaveBeenCalledOnce());
    expect(events).toEqual(['purge']);
    expect(isSensitiveImageLifecycleActive()).toBe(false);

    mocks.change?.('active');
    await vi.waitFor(() => expect(events).toEqual(['purge', 'resume']));
    expect(isSensitiveImageLifecycleActive()).toBe(true);
    unsubscribe();
  });

  it('does not resume foreground demand until the background cache clear settles', async () => {
    let resolveClear!: (value: boolean) => void;
    mocks.clearMemoryCache.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveClear = resolve;
        }),
    );
    const events: string[] = [];
    const unsubscribe = subscribeToSensitiveImageLifecycle((event) => events.push(event));

    mocks.change?.('background');
    mocks.change?.('active');
    expect(events).toEqual(['purge']);
    expect(isSensitiveImageLifecycleActive()).toBe(false);

    await Promise.resolve();
    resolveClear(true);
    await vi.waitFor(() => expect(events).toEqual(['purge', 'resume']));
    expect(isSensitiveImageLifecycleActive()).toBe(true);
    unsubscribe();
  });

  it('stays fail-closed after a failed memory clear and recovers on a later purge', async () => {
    mocks.clearMemoryCache.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const events: string[] = [];
    const unsubscribe = subscribeToSensitiveImageLifecycle((event) => events.push(event));

    await expect(purgeSensitiveImageMemory()).resolves.toBe(false);
    expect(events).toEqual(['purge']);
    expect(isSensitiveImageLifecycleActive()).toBe(false);

    await expect(purgeSensitiveImageMemory()).resolves.toBe(true);
    await vi.waitFor(() => expect(events).toEqual(['purge', 'purge', 'resume']));
    expect(isSensitiveImageLifecycleActive()).toBe(true);
    unsubscribe();
  });

  it('continues privacy teardown through listener and synchronous native failures', async () => {
    const throwingUnsubscribe = subscribeToSensitiveImageLifecycle(() => {
      throw new Error('BROKEN_IMAGE_LISTENER');
    });
    const events: string[] = [];
    const observingUnsubscribe = subscribeToSensitiveImageLifecycle((event) => events.push(event));
    mocks.clearMemoryCache.mockImplementationOnce(() => {
      throw new Error('SYNC_NATIVE_CLEAR_FAILURE');
    });

    await expect(purgeSensitiveImageMemory()).resolves.toBe(false);

    expect(events).toEqual(['purge']);
    expect(mocks.purgeCoordinator).toHaveBeenCalledOnce();
    expect(isSensitiveImageLifecycleActive()).toBe(false);
    throwingUnsubscribe();
    observingUnsubscribe();
  });
});
