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

  it('stays fail-closed when the native decoded-memory cache cannot be cleared', async () => {
    const events: string[] = [];
    const unsubscribe = subscribeToSensitiveImageLifecycle((event) => events.push(event));
    mocks.clearMemoryCache.mockResolvedValueOnce(false);

    await expect(purgeSensitiveImageMemory()).resolves.toBe(false);

    expect(events).toEqual(['purge']);
    expect(isSensitiveImageLifecycleActive()).toBe(false);
    expect(mocks.purgeCoordinator).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
