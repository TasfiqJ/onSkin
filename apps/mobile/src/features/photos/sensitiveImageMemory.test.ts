import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  purgeSensitiveImageMemory,
  subscribeToSensitiveImageLifecycle,
} from './sensitiveImageMemory';

const mocks = vi.hoisted(() => ({
  appState: 'active',
  change: null as ((state: string) => void) | null,
  memoryWarning: null as (() => void) | null,
  clearMemoryCache: vi.fn(async () => true),
}));

vi.mock('expo-image', () => ({
  Image: { clearMemoryCache: mocks.clearMemoryCache },
}));

vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mocks.appState;
    },
    addEventListener: vi.fn((event: string, listener: (value: never) => void) => {
      if (event === 'change') mocks.change = listener as (state: string) => void;
      if (event === 'memoryWarning') mocks.memoryWarning = listener as () => void;
      return { remove: vi.fn() };
    }),
  },
}));

describe('sensitive image memory lifecycle', () => {
  beforeEach(() => {
    mocks.clearMemoryCache.mockClear();
  });

  it('purges on inactive/background, memory warning, explicit boundaries, and resumes once active', async () => {
    const events: string[] = [];
    const unsubscribe = subscribeToSensitiveImageLifecycle((event) => events.push(event));

    mocks.change?.('inactive');
    await vi.waitFor(() => expect(mocks.clearMemoryCache).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    mocks.change?.('active');
    mocks.memoryWarning?.();
    await vi.waitFor(() => expect(mocks.clearMemoryCache).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await purgeSensitiveImageMemory();

    expect(events).toEqual(['purge', 'resume', 'purge', 'purge']);
    expect(mocks.clearMemoryCache).toHaveBeenCalledTimes(3);
    unsubscribe();
  });
});
